import express from 'express';
import Stripe from 'stripe';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import stripeCheckoutService from '../services/stripeCheckoutService';

const router = express.Router();

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

/**
 * Stripe webhook handler
 * POST /webhooks/stripe
 */
router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    logger.error('Stripe webhook secret not configured');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  let event: Stripe.Event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(req.body, sig as string, webhookSecret);
  } catch (err) {
    logger.error('Webhook signature verification failed:', err as Error);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  try {
    // Log webhook event
    await supabase
      .from('stripe_webhook_events')
      .insert({
        stripe_event_id: event.id,
        event_type: event.type,
        event_data: event.data,
        processed: false,
      });

    // Handle different event types
    switch (event.type) {
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;
      
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      
      case 'invoice.created':
        // Log invoice creation (split payments happen on invoice.payment_succeeded)
        await handleInvoiceCreated(event.data.object as Stripe.Invoice);
        break;
      
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;
      
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      
      default:
        logger.info(`Unhandled event type: ${event.type}`);
    }

    // Mark webhook as processed
    await supabase
      .from('stripe_webhook_events')
      .update({ processed: true })
      .eq('stripe_event_id', event.id);

    return res.json({ received: true });
  } catch (error) {
    logger.error('Error processing webhook:', error as Error);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * Handle subscription creation
 */
async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  try {
    const customerId = subscription.customer as string;
    const priceId = subscription.items.data[0]?.price.id;
    
    if (!priceId) {
      logger.error('No price found in subscription');
      return;
    }

    // Get price details to find plan name
    const price = await stripe.prices.retrieve(priceId);
    const planName = price.metadata.plan_name;

    if (!planName) {
      logger.error('No plan name found in price metadata');
      return;
    }

    // Get user by Stripe customer ID
    const { data: user } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .single();

    if (!user) {
      logger.error('User not found for customer ID:', { customerId });
      return;
    }

    // Create subscription record
    await supabase.rpc('create_subscription', {
      user_uuid: user.id,
      stripe_sub_id: subscription.id,
      stripe_customer_id: customerId,
      stripe_price_id: priceId,
      plan_name: planName,
      status: subscription.status,
      period_start: new Date(subscription.current_period_start * 1000),
      period_end: new Date(subscription.current_period_end * 1000),
    });

    logger.info(`Subscription created for user ${user.id}: ${planName}`);
  } catch (error) {
    logger.error('Error handling subscription creation:', error as Error);
  }
}

/**
 * Handle subscription updates
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  try {
    const priceId = subscription.items.data[0]?.price.id;
    
    if (!priceId) {
      logger.error('No price found in subscription');
      return;
    }

    // Get price details to find plan name
    const price = await stripe.prices.retrieve(priceId);
    const planName = price.metadata.plan_name;

    if (!planName) {
      logger.error('No plan name found in price metadata');
      return;
    }

    // Update subscription record
    await supabase
      .from('stripe_subscriptions')
      .update({
        status: subscription.status,
        current_period_start: new Date(subscription.current_period_start * 1000),
        current_period_end: new Date(subscription.current_period_end * 1000),
        cancel_at_period_end: subscription.cancel_at_period_end,
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_subscription_id', subscription.id);

    // Update user plan if subscription is active
    if (subscription.status === 'active') {
      const { data: subscriptionRecord } = await supabase
        .from('stripe_subscriptions')
        .select('user_id')
        .eq('stripe_subscription_id', subscription.id)
        .single();

      if (subscriptionRecord) {
        // Get current user plan to check for manual overrides
        const { data: userProfile } = await supabase
          .from('user_profiles')
          .select('subscription_plan')
          .eq('id', subscriptionRecord.user_id)
          .single();

        if (userProfile) {
          const normalizedPlanName = planName.toLowerCase().trim();
          const currentDbPlan = userProfile.subscription_plan?.toLowerCase().trim() || 'free';
          
          // Plan hierarchy for comparison (higher number = higher tier)
          const planHierarchy: Record<string, number> = {
            'free': 0,
            'basic': 1,
            'premium': 2,
            'enterprise': 3,
            'ultra': 4
          };

          const stripePlanLevel = planHierarchy[normalizedPlanName] || 0;
          const dbPlanLevel = planHierarchy[currentDbPlan] || 0;

          // Only update if Stripe plan is higher or same
          // Preserve manually set higher-tier plans
          if (dbPlanLevel > stripePlanLevel) {
            logger.info(`Webhook: User ${subscriptionRecord.user_id} has manually set plan ${currentDbPlan} (level ${dbPlanLevel}) which is higher than Stripe plan ${normalizedPlanName} (level ${stripePlanLevel}). Preserving database plan.`);
            // Don't update - preserve the manually set plan
          } else if (dbPlanLevel <= stripePlanLevel) {
            // Stripe plan is higher or same - update to Stripe plan
            await supabase
              .from('user_profiles')
              .update({
                subscription_plan: normalizedPlanName,
                updated_at: new Date().toISOString(),
              })
              .eq('id', subscriptionRecord.user_id);
            logger.info(`Subscription updated via webhook: ${subscription.id} - ${normalizedPlanName}`);
          }
        } else {
          // Fallback: if we can't get user profile, update anyway
          await supabase
            .from('user_profiles')
            .update({
              subscription_plan: planName.toLowerCase().trim(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', subscriptionRecord.user_id);
          logger.info(`Subscription updated via webhook (fallback): ${subscription.id} - ${planName}`);
        }
      }
    }

    logger.info(`Subscription webhook processed: ${subscription.id} - ${planName}`);
  } catch (error) {
    logger.error('Error handling subscription update:', error as Error);
  }
}

/**
 * Handle subscription deletion
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  try {
    // Update subscription status
    await supabase
      .from('stripe_subscriptions')
      .update({
        status: 'canceled',
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_subscription_id', subscription.id);

    // Downgrade user to free plan
    const { data: subscriptionRecord } = await supabase
      .from('stripe_subscriptions')
      .select('user_id')
      .eq('stripe_subscription_id', subscription.id)
      .single();

    if (subscriptionRecord) {
      await supabase
        .from('user_profiles')
        .update({
          subscription_plan: 'free',
          monthly_generations_limit: 10,
          updated_at: new Date().toISOString(),
        })
        .eq('id', subscriptionRecord.user_id);
    }

    logger.info(`Subscription deleted: ${subscription.id}`);
  } catch (error) {
    logger.error('Error handling subscription deletion:', error as Error);
  }
}

/**
 * Handle invoice creation
 * Note: We don't set up automatic splits here anymore.
 * Instead, we use Separate Charges & Transfers on invoice.payment_succeeded
 * This requires Cross-border Payouts to be enabled on the US platform.
 */
async function handleInvoiceCreated(invoice: Stripe.Invoice) {
  try {
    // Just log invoice creation - split payments happen on invoice.payment_succeeded
    logger.info(`Invoice created: ${invoice.id} for subscription ${invoice.subscription || 'N/A'}`);
  } catch (error) {
    logger.error('Error handling invoice creation:', error as Error);
  }
}

/**
 * Handle successful payment and process split payments
 * Uses Separate Charges & Transfers pattern:
 * 1. Charge happens on US platform (normal subscription)
 * 2. Create transfers to BR connected accounts
 * 3. Store ledger for refund/reversal tracking
 * 
 * Requires:
 * - Cross-border Payouts enabled on US platform
 * - BR accounts must be Express or Custom (not Standard)
 */
async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  try {
    if (!invoice.subscription) {
      logger.info(`Payment succeeded for invoice ${invoice.id} (no subscription - one-time payment)`);
      return;
    }

    const subscriptionId = invoice.subscription as string;

    // Update subscription status to active
    await supabase
      .from('stripe_subscriptions')
      .update({
        status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_subscription_id', subscriptionId);

    // Process split payment using Separate Charges & Transfers (if enabled)
    // Feature flag: Set ENABLE_SPLIT_PAYMENTS=false to disable split payments
    const enableSplitPayments = (process.env.ENABLE_SPLIT_PAYMENTS || 'false').toLowerCase() === 'true';
    
    if (enableSplitPayments) {
      try {
        const result = await stripeCheckoutService.processSplitPayment(subscriptionId, invoice.id);
        
        if (result.success) {
          logger.info(`✅ Split payment processed successfully for subscription ${subscriptionId}`, {
            invoiceId: invoice.id,
            transfersCreated: result.transfers.filter(t => t.transferId).length,
            transfersTotal: result.transfers.length
          });

          // TODO: Store ledger in database
          // if (result.ledger) {
          //   await storeTransferLedger(result.ledger);
          // }
        } else {
          logger.warn(`⚠️  Split payment partially failed for subscription ${subscriptionId}`, {
            invoiceId: invoice.id,
            transfers: result.transfers
          });
        }
      } catch (splitError) {
        logger.error('Error processing split payment:', splitError as Error);
        // Don't fail the webhook if split payment fails - subscription still needs to be activated
        // The split can be retried manually or via a separate process
      }
    } else {
      logger.info(`Split payments are disabled (ENABLE_SPLIT_PAYMENTS=false). All funds remain in platform account.`);
    }

    logger.info(`Payment succeeded for invoice: ${invoice.id}, subscription: ${subscriptionId}`);
  } catch (error) {
    logger.error('Error handling payment success:', error as Error);
    // Don't throw - webhook processing should continue
  }
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  try {
    if (invoice.subscription) {
      // Update subscription status to past_due
      await supabase
        .from('stripe_subscriptions')
        .update({
          status: 'past_due',
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_subscription_id', invoice.subscription as string);
    }

    logger.info(`Payment failed for invoice: ${invoice.id}`);
  } catch (error) {
    logger.error('Error handling payment failure:', error as Error);
  }
}

/**
 * Handle checkout session completion
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  try {
    const userId = session.metadata?.user_id;
    const planId = session.metadata?.plan_id;
    const billingCycle = session.metadata?.billing_cycle;
    const customerId = session.customer as string;
    const subscriptionId = session.subscription as string;

    if (!userId || !planId) {
      logger.error('Missing metadata in checkout session:', { userId, planId });
      return;
    }

    logger.info(`Checkout completed for user ${userId}, plan ${planId}, billing ${billingCycle}, customer ${customerId}, subscription ${subscriptionId}`);

    // Update user's Stripe customer ID if not set
    if (customerId) {
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ 
          stripe_customer_id: customerId,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .is('stripe_customer_id', null); // Only update if null

      if (updateError && updateError.code !== 'PGRST116') {
        logger.error('Error updating stripe_customer_id:', updateError);
      }
    }

    // If subscription was created, retrieve it and process
    if (subscriptionId) {
      try {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const priceId = subscription.items.data[0]?.price.id;
        
        if (priceId) {
          // Get plan name from price metadata
          const price = await stripe.prices.retrieve(priceId);
          const planName = price.metadata.plan_name || planId;

          // Get plan limits from database
          const { data: planRule } = await supabase
            .from('plan_rules')
            .select('monthly_generations_limit')
            .eq('plan_name', planName)
            .eq('is_active', true)
            .single();

          const monthlyLimit = planRule?.monthly_generations_limit || 10;

          // Update user profile with new plan - try RPC function first for enum casting
          let profileError = null;
          const { error: rpcError } = await supabase.rpc('update_user_subscription_plan', {
            user_uuid: userId,
            new_plan: planName
          });

          if (rpcError) {
            // RPC function might not exist - try direct update
            logger.warn('RPC function not available, trying direct update:', {
              error: rpcError.message || rpcError,
              code: rpcError.code
            });
            const { error: directError } = await supabase
              .from('user_profiles')
              .update({
                subscription_plan: planName as any,
                monthly_generations_limit: monthlyLimit,
                updated_at: new Date().toISOString()
              })
              .eq('id', userId);
            profileError = directError;
          } else {
            // RPC succeeded - update monthly limit separately
            const { error: limitError } = await supabase
              .from('user_profiles')
              .update({
                monthly_generations_limit: monthlyLimit,
                updated_at: new Date().toISOString()
              })
              .eq('id', userId);
            if (limitError) {
              logger.warn('Could not update monthly limit:', {
                error: limitError.message || limitError,
                code: limitError.code
              });
            }
          }

          if (profileError) {
            logger.error('Error updating user profile:', profileError);
          } else {
            logger.info(`Updated user ${userId} to plan ${planName} with limit ${monthlyLimit}`);
          }

          // Create or update subscription record
          const { error: subError } = await supabase.rpc('create_subscription', {
            user_uuid: userId,
            stripe_sub_id: subscriptionId,
            stripe_customer_id: customerId || '',
            stripe_price_id: priceId,
            plan_name: planName,
            status: subscription.status,
            period_start: new Date(subscription.current_period_start * 1000),
            period_end: new Date(subscription.current_period_end * 1000),
          });

          if (subError) {
            // If subscription already exists, update it
            if (subError.code === '23505' || subError.message?.includes('duplicate')) {
              const { error: updateSubError } = await supabase
                .from('stripe_subscriptions')
                .update({
                  status: subscription.status,
                  current_period_start: new Date(subscription.current_period_start * 1000),
                  current_period_end: new Date(subscription.current_period_end * 1000),
                  cancel_at_period_end: subscription.cancel_at_period_end,
                  updated_at: new Date().toISOString(),
                })
                .eq('stripe_subscription_id', subscriptionId);

              if (updateSubError) {
                logger.error('Error updating subscription:', updateSubError);
              } else {
                logger.info(`Updated existing subscription ${subscriptionId} for user ${userId}`);
              }
            } else {
              logger.error('Error creating subscription:', subError);
            }
          } else {
            logger.info(`Created subscription ${subscriptionId} for user ${userId}`);
          }
        }
      } catch (subError) {
        logger.error('Error retrieving subscription from Stripe:', subError as Error);
      }
    } else {
      // No subscription ID - might be a one-time payment, but still update plan if metadata has planId
      const { data: planRule } = await supabase
        .from('plan_rules')
        .select('monthly_generations_limit')
        .eq('plan_name', planId)
        .eq('is_active', true)
        .single();

      const monthlyLimit = planRule?.monthly_generations_limit || 10;

      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({
          subscription_plan: planId,
          monthly_generations_limit: monthlyLimit,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (profileError) {
        logger.error('Error updating user profile (no subscription):', profileError);
      } else {
        logger.info(`Updated user ${userId} to plan ${planId} (no subscription record)`);
      }
    }

    // Log successful checkout
    await supabase
      .from('stripe_webhook_events')
      .insert({
        stripe_event_id: session.id,
        event_type: 'checkout.session.completed',
        event_data: session,
        processed: true,
      });

    logger.info(`Checkout processing completed for user ${userId}, plan ${planId}`);
  } catch (error) {
    logger.error('Error handling checkout completion:', error as Error);
  }
}

export default router;
