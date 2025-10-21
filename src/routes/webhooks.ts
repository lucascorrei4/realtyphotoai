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
        await supabase
          .from('user_profiles')
          .update({
            subscription_plan: planName,
            updated_at: new Date().toISOString(),
          })
          .eq('id', subscriptionRecord.user_id);
      }
    }

    logger.info(`Subscription updated: ${subscription.id} - ${planName}`);
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
 * Handle successful payment and process split payments
 */
async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  try {
    if (invoice.subscription) {
      // Update subscription status to active
      await supabase
        .from('stripe_subscriptions')
        .update({
          status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_subscription_id', invoice.subscription as string);

      // Process split payment for partners
      try {
        await stripeCheckoutService.processSplitPayment(invoice.subscription as string);
        logger.info(`Split payment processed for subscription: ${invoice.subscription}`);
      } catch (splitError) {
        logger.error('Error processing split payment:', splitError as Error);
        // Don't fail the webhook if split payment fails
      }
    }

    logger.info(`Payment succeeded for invoice: ${invoice.id}`);
  } catch (error) {
    logger.error('Error handling payment success:', error as Error);
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

    if (!userId || !planId) {
      logger.error('Missing metadata in checkout session:', { userId, planId });
      return;
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

    logger.info(`Checkout completed for user ${userId}, plan ${planId}, billing ${billingCycle}`);
  } catch (error) {
    logger.error('Error handling checkout completion:', error as Error);
  }
}

export default router;
