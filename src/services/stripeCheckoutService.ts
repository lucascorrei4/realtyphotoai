import Stripe from 'stripe';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import { SUBSCRIPTION_PLANS, SubscriptionPlan } from '../config/subscriptionPlans';
import planRulesService, { mapPlanIdToPlanName } from './planRulesService';

export interface SplitPaymentConfig {
  partner1: {
    accountId: string; // Stripe Connect account ID
    percentage: number; // Percentage of the payment (e.g., 46 for 46%)
    description: string;
  };
  partner2: {
    accountId: string; // Stripe Connect account ID
    percentage: number; // Percentage of the payment (e.g., 46 for 46%)
    description: string;
  };
  agency: {
    accountId: string; // Stripe Connect account ID
    percentage: number; // Percentage of the payment (e.g., 8 for 8%)
    description: string;
  };
}

export interface UserData {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  ip?: string;
  user_agent?: string;
  fbp?: string;
  fbc?: string;
  external_id?: string;
}

export interface CustomData {
  value?: number;
  currency?: string;
  event_id?: string;
  external_id?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
}

export interface CheckoutSessionData {
  planId: string;
  billingCycle: 'monthly' | 'yearly';
  userId: string;
  userEmail?: string; // Optional - Stripe will collect email for guest checkout
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
  userData?: UserData;
  customData?: CustomData;
}

export interface OneTimePaymentCheckoutData {
  amount: number; // Amount in dollars
  credits?: number; // Number of credits to add
  description: string;
  userId: string;
  userEmail?: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
  userData?: UserData;
  customData?: CustomData;
  offerType: 'credits' | 'videos'; // Type of one-time offer
}

export class StripeCheckoutService {
  private stripe: Stripe;
  private splitConfig: SplitPaymentConfig;

  constructor() {
    const { getStripeSecretKey } = require('../utils/stripeConfig');
    const stripeSecretKey = getStripeSecretKey();
    
    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
    });

    // Split payment configuration with fee consideration
    // NOTE: Currently configured for 3 recipients (2 partners + agency)
    // If you only need 2 partners, update percentages to total 100%
    // e.g., 50% each: partner1: 50, partner2: 50, agency: 0
    this.splitConfig = {
      partner1: {
        accountId: process.env.STRIPE_PARTNER1_ACCOUNT_ID || 'acct_partner1',
        percentage: 46, // 46% of gross revenue
        description: 'Business Partner'
      },
      partner2: {
        accountId: process.env.STRIPE_PARTNER2_ACCOUNT_ID || 'acct_partner2', 
        percentage: 46, // 46% of gross revenue
        description: 'Business Partner'
      },
      agency: {
        accountId: process.env.STRIPE_AGENCY_ACCOUNT_ID || 'acct_agency',
        percentage: 8, // 8% of gross revenue (set to 0 to disable if only 2 partners)
        description: 'Paid Ads Agency'
      }
    };
  }

  /**
   * Create a Stripe checkout session with split payments
   */
  async createCheckoutSession(data: CheckoutSessionData): Promise<{ sessionId: string; url: string }> {
    try {
      let plan = SUBSCRIPTION_PLANS[data.planId];
      if (!plan) {
        const planName = mapPlanIdToPlanName(data.planId);
        const planRule = await planRulesService.getPlanRule(planName);
        if (!planRule) {
          throw new Error(`Plan ${data.planId} not found`);
        }
        plan = planRulesService.convertToSubscriptionPlan(planRule);
      }

      if (!plan.stripe.productId || (data.billingCycle === 'monthly' && !plan.stripe.monthlyPriceId) || (data.billingCycle === 'yearly' && !plan.stripe.yearlyPriceId)) {
        const planName = mapPlanIdToPlanName(data.planId);
        const planRule = await planRulesService.getPlanRule(planName);
        if (!planRule) {
          throw new Error(`Plan ${data.planId} not found`);
        }
        plan = planRulesService.convertToSubscriptionPlan(planRule);

        const syncResult = await this.syncPlanWithStripe(plan);
        plan = {
          ...plan,
          stripe: {
            ...plan.stripe,
            productId: syncResult.productId,
            monthlyPriceId: syncResult.monthlyPriceId,
            yearlyPriceId: syncResult.yearlyPriceId,
          },
        };
      }

      // Check if this is guest checkout
      const isGuest = data.userId.startsWith('guest_');
      
      // Don't create Stripe customer upfront - let Stripe create it when checkout completes
      // This prevents creating customers for users who abandon checkout
      // The customer will be created automatically by Stripe when payment succeeds
      // and linked to the user in the webhook handler (checkout.session.completed)
      let customer: Stripe.Customer | null = null;
      
      // For logged-in users, check if they already have a Stripe customer ID
      // If they do, use it to link the checkout session
      if (!isGuest && data.userEmail) {
        const { data: user } = await supabase
          .from('user_profiles')
          .select('stripe_customer_id')
          .eq('id', data.userId)
          .single();

        if (user?.stripe_customer_id) {
          // User already has a customer ID (from a previous purchase)
          // Retrieve and use it to link the checkout session
          try {
            customer = await this.stripe.customers.retrieve(user.stripe_customer_id) as Stripe.Customer;
          } catch (error) {
            logger.warn(`Could not retrieve existing customer ${user.stripe_customer_id}, Stripe will create new one`);
            customer = null;
          }
        }
        // If no existing customer, let Stripe create one when checkout completes
      }

      // Get price ID for the plan and billing cycle
      const priceId = await this.getPriceId(plan, data.billingCycle);

      // Get plan amount for custom_data
      const planAmount = data.billingCycle === 'yearly' ? plan.price.yearly : plan.price.monthly;

      // Build user_data metadata from provided data or defaults
      // Email is optional for guest checkout (Stripe will collect it)
      const userData: UserData = {
        ...(data.userEmail ? { email: data.userEmail } : {}),
        external_id: data.userId,
        ...data.userData,
      };

      // Build custom_data metadata from provided data or plan defaults
      const customData: CustomData = {
        value: data.customData?.value ?? planAmount,
        currency: data.customData?.currency ?? 'USD',
        event_id: data.customData?.event_id ?? 'Purchase',
        external_id: data.customData?.external_id ?? data.userId,
        ...data.customData,
      };

      // Convert user_data and custom_data objects to metadata strings (Stripe metadata only accepts strings)
      // No prefix - fields are added directly to metadata for easier parsing in n8n
      const buildMetadataFromObject = (obj: Record<string, any>): Record<string, string> => {
        const metadata: Record<string, string> = {};
        Object.entries(obj).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            // Stringify objects/arrays, convert numbers to strings
            const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
            metadata[key] = stringValue;
          }
        });
        return metadata;
      };

      const userDataMetadata = buildMetadataFromObject(userData);
      const customDataMetadata = buildMetadataFromObject(customData);

      // Merge all metadata
      const sessionMetadata = {
        plan_id: data.planId,
        billing_cycle: data.billingCycle,
        user_id: data.userId,
        ...userDataMetadata,
        ...customDataMetadata,
        ...data.metadata,
      };

      const subscriptionMetadata = {
        plan_id: data.planId,
        billing_cycle: data.billingCycle,
        user_id: data.userId,
        ...userDataMetadata,
        ...customDataMetadata,
        // Only include partner account IDs if split payments are enabled
        ...(process.env.ENABLE_SPLIT_PAYMENTS === 'true' ? {
          partner1_account: this.splitConfig.partner1.accountId,
          partner2_account: this.splitConfig.partner2.accountId,
          agency_account: this.splitConfig.agency.accountId,
        } : {}),
        ...data.metadata,
      };

      // Note: Split amounts are calculated in webhook processing after payment

      // Create checkout session with application fee and transfers
      // For guest checkout, don't specify customer - Stripe will create it from email entered during checkout
      // For logged-in users without existing customer, use customer_email to pre-fill but let Stripe create customer on completion
      const sessionConfig: Stripe.Checkout.SessionCreateParams = {
        ...(customer ? { customer: customer.id } : {}), // Only set customer if user already has one from previous purchase
        ...(!isGuest && data.userEmail && !customer ? { customer_email: data.userEmail } : {}), // Pre-fill email for logged-in users without existing customer
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: data.successUrl,
        cancel_url: data.cancelUrl,
        metadata: sessionMetadata,
        subscription_data: {
          metadata: subscriptionMetadata,
          // Note: Using Separate Charges and Transfers model (if enabled)
          // Payment goes to platform account, then transfers to connected accounts (if ENABLE_SPLIT_PAYMENTS=true)
          // If split payments disabled, all funds remain in platform account
        },
        // Enable customer portal for subscription management
        allow_promotion_codes: true,
        // Address collection disabled - not required for digital products
        ...(customer ? {
          customer_update: {
            address: 'auto',
            name: 'auto',
          },
        } : {}),
      };

      const session = await this.stripe.checkout.sessions.create(sessionConfig);

      logger.info(`Checkout session created for user ${data.userId}, plan ${data.planId}`);
      
      return {
        sessionId: session.id,
        url: session.url!
      };
    } catch (error) {
      logger.error('Error creating checkout session:', error as Error);
      throw new Error('Failed to create checkout session');
    }
  }

  /**
   * Create a one-time payment checkout session
   */
  async createOneTimePaymentCheckout(data: OneTimePaymentCheckoutData): Promise<{ sessionId: string; url: string }> {
    try {
      // Check if user has existing Stripe customer
      let customer: Stripe.Customer | null = null;
      if (data.userId && !data.userId.startsWith('guest_')) {
        const { data: userProfile } = await supabase
          .from('user_profiles')
          .select('stripe_customer_id')
          .eq('id', data.userId)
          .single();
        
        if (userProfile?.stripe_customer_id) {
          try {
            customer = await this.stripe.customers.retrieve(userProfile.stripe_customer_id) as Stripe.Customer;
          } catch (error) {
            logger.warn(`Could not retrieve customer ${userProfile.stripe_customer_id}`, {
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
      }
      
      // Build metadata
      const userData = data.userData || {};
      const customData = data.customData || {};

      const buildMetadataFromObject = (obj: Record<string, any>): Record<string, string> => {
        const metadata: Record<string, string> = {};
        Object.entries(obj).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
            metadata[key] = stringValue;
          }
        });
        return metadata;
      };

      const userDataMetadata = buildMetadataFromObject(userData);
      const customDataMetadata = buildMetadataFromObject(customData);

      const sessionMetadata = {
        payment_type: 'one_time',
        offer_type: data.offerType,
        user_id: data.userId,
        credits: data.credits?.toString() || '0',
        amount: data.amount.toString(),
        ...userDataMetadata,
        ...customDataMetadata,
        ...data.metadata,
      };

      // Determine email for receipt_email on payment intent
      // Priority: customer email > userEmail from data > null (will use email from checkout)
      const receiptEmail = customer?.email || data.userEmail || undefined;

      // Create checkout session for one-time payment
      const sessionConfig: Stripe.Checkout.SessionCreateParams = {
        ...(customer ? { customer: customer.id } : {}),
        // Set customer_email if we have an email (for both logged-in and guest checkout)
        // This pre-fills the email field in Stripe Checkout
        ...(data.userEmail && !customer ? { customer_email: data.userEmail } : {}),
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: data.description,
                description: data.description,
              },
              unit_amount: Math.round(data.amount * 100), // Convert to cents
            },
            quantity: 1,
          },
        ],
        mode: 'payment', // One-time payment mode
        success_url: data.successUrl,
        cancel_url: data.cancelUrl,
        metadata: sessionMetadata,
        // Use payment_intent_data to set metadata and receipt_email on the Payment Intent
        // This ensures the payment intent has all the important metadata and email
        payment_intent_data: {
          metadata: sessionMetadata,
          ...(receiptEmail ? { receipt_email: receiptEmail } : {}),
        },
        allow_promotion_codes: true,
        // Address collection disabled - not required for digital products
      };

      const session = await this.stripe.checkout.sessions.create(sessionConfig);

      logger.info(`One-time payment checkout session created for user ${data.userId}, amount $${data.amount}`);
      
      return {
        sessionId: session.id,
        url: session.url!
      };
    } catch (error) {
      logger.error('Error creating one-time payment checkout session:', error as Error);
      throw new Error('Failed to create one-time payment checkout session');
    }
  }

  /**
   * Create Stripe customer portal session for subscription management
   */
  async createCustomerPortalSession(customerId: string, returnUrl: string): Promise<{ url: string }> {
    try {
      const session = await this.stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
      });

      return { url: session.url };
    } catch (error) {
      logger.error('Error creating customer portal session:', error as Error);
      throw new Error('Failed to create customer portal session');
    }
  }

  /**
   * Get price ID for plan and billing cycle
   */
  private async getPriceId(plan: SubscriptionPlan, billingCycle: 'monthly' | 'yearly'): Promise<string> {
    try {
      const priceId = billingCycle === 'yearly' ? plan.stripe.yearlyPriceId : plan.stripe.monthlyPriceId;
      
      if (!priceId) {
        // If price ID doesn't exist, create it
        return await this.createPriceForPlan(plan, billingCycle);
      }

      return priceId;
    } catch (error) {
      logger.error('Error getting price ID:', error as Error);
      throw new Error('Failed to get price ID');
    }
  }

  /**
   * Create price for plan and billing cycle
   */
  private async createPriceForPlan(plan: SubscriptionPlan, billingCycle: 'monthly' | 'yearly'): Promise<string> {
    try {
      const productId = plan.stripe.productId;
      if (!productId) {
        throw new Error(`Product ID not found for plan ${plan.id}`);
      }

      const amount = billingCycle === 'yearly' ? plan.price.yearly : plan.price.monthly;
      const interval = billingCycle === 'yearly' ? 'year' : 'month';
      const planName = mapPlanIdToPlanName(plan.id);

      const price = await this.stripe.prices.create({
        product: productId,
        unit_amount: amount * 100, // Convert to cents
        currency: 'usd',
        recurring: {
          interval,
        },
        metadata: {
          ...plan.stripe.metadata,
          billing_cycle: billingCycle,
          plan_id: plan.id,
          plan_name: planName,
        },
      });

      // Update plan with new price ID
      await supabase
        .from('plan_rules')
        .update({
          [`stripe_${billingCycle}_price_id`]: price.id,
        })
        .eq('plan_name', planName);

      logger.info(`Created ${billingCycle} price ${price.id} for plan ${plan.id}`);
      return price.id;
    } catch (error) {
      logger.error('Error creating price:', error as Error);
      throw new Error('Failed to create price');
    }
  }

  /**
   * Calculate split amounts for partners and agency
   * Fair approach: Deduct Stripe fees first, then split the remainder
   * This way partners and agency effectively share the cost of platform fees
   */
  private calculateSplitAmounts(totalAmount: number): { 
    partner1: number; 
    partner2: number; 
    agency: number;
    platformAmount: number;
    stripeFees: number;
  } {
    // Calculate Stripe fees (2.9% + $0.30)
    const stripeFees = Math.round(totalAmount * 0.029) + 30; // 2.9% + $0.30
    
    // Amount available after Stripe fees
    const netAmount = totalAmount - stripeFees;
    
    // Split the NET amount based on percentages
    // This way partners effectively share the cost of Stripe fees
    const partner1Amount = Math.round(netAmount * this.splitConfig.partner1.percentage / 100);
    const partner2Amount = Math.round(netAmount * this.splitConfig.partner2.percentage / 100);
    const agencyAmount = Math.round(netAmount * this.splitConfig.agency.percentage / 100);
    
    // Platform keeps: Stripe fees (to cover platform costs)
    const platformAmount = stripeFees;

    return {
      partner1: partner1Amount,
      partner2: partner2Amount,
      agency: agencyAmount,
      platformAmount,
      stripeFees
    };
  }

  /**
   * Process split payment for a subscription using Separate Charges & Transfers
   * Split: Partner 1 (46% - main account), Partner 2 (46% - BR), Agency (8% - BR)
   * Platform keeps Stripe fees
   * 
   * Architecture: Separate Charges & Transfers
   * - Charge happens on US platform (normal subscription)
   * - Transfers created to BR connected accounts after payment
   * - Requires Cross-border Payouts enabled on US platform
   * - Requires BR accounts to be Express or Custom (not Standard)
   */
  async processSplitPayment(subscriptionId: string, invoiceId?: string): Promise<{
    success: boolean;
    transfers: Array<{ accountId: string; transferId: string | null; amount: number; success: boolean }>;
    ledger?: { invoiceId: string; subscriptionId: string; partner1Amount: number; partner2Amount: number; agencyAmount: number; platformAmount: number };
  }> {
    try {
      const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
      const invoice = invoiceId 
        ? await this.stripe.invoices.retrieve(invoiceId)
        : await this.stripe.invoices.retrieve(subscription.latest_invoice as string);
      
      const amount = invoice.amount_paid;
      const splitAmounts = this.calculateSplitAmounts(amount / 100); // Convert from cents

      logger.info(`Processing split payment for subscription ${subscriptionId}`, {
        invoiceId: invoice.id,
        grossAmount: amount / 100,
        splitAmounts
      });

      // Create transfers to BR accounts (Partner 1 is main account - no transfer needed)
      // Use Promise.allSettled to handle partial failures gracefully
      const transferResults = await Promise.allSettled([
        // Partner 1: Main account (no transfer - funds remain)
        Promise.resolve({ accountId: this.splitConfig.partner1.accountId, amount: splitAmounts.partner1, isMainAccount: true }),
        
        // Partner 2: BR account (transfer required)
        this.createTransfer(
          this.splitConfig.partner2.accountId,
          Math.round(splitAmounts.partner2 * 100), // Convert to cents
          this.splitConfig.partner2.description,
          subscriptionId
        ).then(transfer => ({ accountId: this.splitConfig.partner2.accountId, transfer, amount: splitAmounts.partner2, isMainAccount: false })),
        
        // Agency: BR account (transfer required, if enabled)
        this.splitConfig.agency.percentage > 0 && splitAmounts.agency > 0
          ? this.createTransfer(
              this.splitConfig.agency.accountId,
              Math.round(splitAmounts.agency * 100), // Convert to cents
              this.splitConfig.agency.description,
              subscriptionId
            ).then(transfer => ({ accountId: this.splitConfig.agency.accountId, transfer, amount: splitAmounts.agency, isMainAccount: false }))
          : Promise.resolve({ accountId: this.splitConfig.agency.accountId, transfer: null, amount: 0, isMainAccount: false })
      ]);

      // Process results
      const transfers: Array<{ accountId: string; transferId: string | null; amount: number; success: boolean }> = [];
      let partner2TransferId: string | null = null;
      let agencyTransferId: string | null = null;

      transferResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const data = result.value;
          if (index === 0) {
            // Partner 1 (main account - no transfer)
            transfers.push({
              accountId: data.accountId,
              transferId: null,
              amount: data.amount,
              success: true
            });
          } else if (index === 1) {
            // Partner 2
            const partner2Data = data as { accountId: string; transfer: Stripe.Transfer | null; amount: number; isMainAccount: boolean };
            partner2TransferId = partner2Data.transfer?.id || null;
            transfers.push({
              accountId: partner2Data.accountId,
              transferId: partner2TransferId,
              amount: partner2Data.amount,
              success: partner2Data.transfer !== null
            });
          } else if (index === 2) {
            // Agency
            const agencyData = data as { accountId: string; transfer: Stripe.Transfer | null; amount: number; isMainAccount: boolean };
            agencyTransferId = agencyData.transfer?.id || null;
            transfers.push({
              accountId: agencyData.accountId,
              transferId: agencyTransferId,
              amount: agencyData.amount,
              success: agencyData.transfer !== null || agencyData.amount === 0
            });
          }
        } else {
          logger.error(`Transfer failed for index ${index}:`, result.reason);
        }
      });

      // Create ledger entry for refund/reversal tracking
      const ledger = {
        invoiceId: invoice.id,
        subscriptionId: subscriptionId,
        partner1Amount: splitAmounts.partner1,
        partner2Amount: splitAmounts.partner2,
        agencyAmount: splitAmounts.agency,
        platformAmount: splitAmounts.platformAmount,
      };

      // TODO: Store ledger in database (create transfer_ledger table)
      // await this.storeTransferLedger(ledger);

      const successCount = transfers.filter(t => t.success).length;
      const totalTransfers = transfers.length;

      logger.info(`✅ Split payment processed for subscription ${subscriptionId}`, {
        invoiceId: invoice.id,
        grossAmount: amount / 100,
        transfersCreated: successCount,
        transfersTotal: totalTransfers,
        partner1Amount: splitAmounts.partner1,
        partner2Amount: splitAmounts.partner2,
        partner2TransferId,
        agencyAmount: splitAmounts.agency,
        agencyTransferId,
        platformAmount: splitAmounts.platformAmount,
        stripeFees: splitAmounts.stripeFees,
        note: 'Partner 1 (main account) keeps 46% + fees. Partner 2 and Agency receive transfers if Cross-border Payouts enabled.'
      });

      return {
        success: successCount > 0,
        transfers,
        ledger
      };
    } catch (error) {
      logger.error('Error processing split payment:', error as Error);
      throw error;
    }
  }

  /**
   * Create transfer to connected account
   * Uses Separate Charges & Transfers pattern (Cross-border Payouts required for BR accounts)
   */
  private async createTransfer(
    destinationAccountId: string,
    amount: number,
    description: string,
    subscriptionId: string
  ): Promise<Stripe.Transfer | null> {
    try {
      // Allow dry-run to skip real transfers during testing
      if ((process.env.STRIPE_SPLIT_DRY_RUN || '').toLowerCase() === 'true') {
        logger.info('DRY RUN: Skipping Stripe transfer', {
          destinationAccountId,
          amount,
          description,
          subscriptionId,
        });
        return {
          id: 'tr_mock_dry_run',
          amount,
          currency: 'usd',
          destination: destinationAccountId as any,
        } as unknown as Stripe.Transfer;
      }

      // Skip transfers to main account (Partner 1 is the main account)
      if (destinationAccountId === process.env.STRIPE_PARTNER1_ACCOUNT_ID) {
        logger.info(`Skipping transfer to main account: ${destinationAccountId} (Partner 1 - funds remain in platform)`);
        return null;
      }

      const transfer = await this.stripe.transfers.create({
        amount,
        currency: 'usd',
        destination: destinationAccountId,
        description: `${description} - Subscription ${subscriptionId}`,
        metadata: {
          subscription_id: subscriptionId,
          transfer_type: 'subscription_split',
          invoice_id: subscriptionId, // For idempotency and ledger tracking
        },
      });

      logger.info(`✅ Transfer created: ${transfer.id} → ${destinationAccountId} ($${(amount / 100).toFixed(2)})`);
      return transfer;
    } catch (error) {
      const stripeError = error as any;
      
      // Handle region restriction (Cross-border Payouts not enabled)
      if (stripeError.code === 'transfers_not_allowed' || 
          stripeError.message?.includes('restricted outside of your platform\'s region') ||
          stripeError.message?.includes('cannot be set to your own account')) {
        logger.warn(`⚠️  Transfer failed for ${destinationAccountId}: ${stripeError.message}`, {
          errorCode: stripeError.code,
          destinationAccountId,
          amount: amount / 100,
          solution: 'Enable Cross-border Payouts on US platform and verify account is Express/Custom type',
          docs: 'https://stripe.com/docs/connect/cross-border-payouts'
        });
        return null; // Don't throw - allow other transfers to proceed
      }

      // Handle account type issues
      if (stripeError.code === 'account_invalid' || stripeError.message?.includes('must be Express or Custom')) {
        logger.error(`❌ Invalid account type for ${destinationAccountId}: Account must be Express or Custom (not Standard)`, {
          errorCode: stripeError.code,
          destinationAccountId,
          solution: 'Verify account type in Stripe Dashboard → Connect → Accounts',
          docs: 'https://stripe.com/docs/connect/account-types'
        });
        return null;
      }

      logger.error('Error creating transfer:', {
        error: stripeError.message,
        code: stripeError.code,
        destinationAccountId,
        amount: amount / 100,
      });
      return null; // Don't throw - allow other transfers to proceed
    }
  }

  /**
   * Get subscription details
   */
  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription | null> {
    try {
      return await this.stripe.subscriptions.retrieve(subscriptionId);
    } catch (error) {
      logger.error('Error retrieving subscription:', error as Error);
      return null;
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(subscriptionId: string, immediately: boolean = false): Promise<Stripe.Subscription> {
    try {
      if (immediately) {
        return await this.stripe.subscriptions.cancel(subscriptionId);
      } else {
        return await this.stripe.subscriptions.update(subscriptionId, {
          cancel_at_period_end: true,
        });
      }
    } catch (error) {
      logger.error('Error canceling subscription:', error as Error);
      throw new Error('Failed to cancel subscription');
    }
  }

  /**
   * Update subscription to new plan
   */
  async updateSubscription(subscriptionId: string, newPriceId: string): Promise<Stripe.Subscription> {
    try {
      const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
      
      return await this.stripe.subscriptions.update(subscriptionId, {
        items: [
          {
            id: subscription.items.data[0].id,
            price: newPriceId,
          },
        ],
        proration_behavior: 'create_prorations',
      });
    } catch (error) {
      logger.error('Error updating subscription:', error as Error);
      throw new Error('Failed to update subscription');
    }
  }

  /**
   * Get customer's subscriptions
   */
  async getCustomerSubscriptions(customerId: string): Promise<Stripe.Subscription[]> {
    try {
      const subscriptions = await this.stripe.subscriptions.list({
        customer: customerId,
        status: 'all',
        limit: 100,
      });

      return subscriptions.data;
    } catch (error) {
      logger.error('Error retrieving customer subscriptions:', error as Error);
      throw new Error('Failed to retrieve customer subscriptions');
    }
  }

  /**
   * Sync plan with Stripe (create product and prices)
   */
  async syncPlanWithStripe(plan: SubscriptionPlan): Promise<{ productId: string; monthlyPriceId: string; yearlyPriceId: string }> {
    try {
      // Create or get product
      let productId = plan.stripe.productId;
      const planName = mapPlanIdToPlanName(plan.id);

      if (!productId) {
        const product = await this.stripe.products.create({
          name: plan.displayName,
          description: plan.description,
          metadata: plan.stripe.metadata,
        });
        productId = product.id;

        await supabase
          .from('plan_rules')
          .update({ stripe_product_id: productId })
          .eq('plan_name', planName);
      }

      // Create monthly price
      const monthlyPrice = await this.stripe.prices.create({
        product: productId,
        unit_amount: plan.price.monthly * 100,
        currency: 'usd',
        recurring: {
          interval: 'month',
        },
        metadata: {
          ...plan.stripe.metadata,
          billing_cycle: 'monthly',
          plan_id: plan.id,
          plan_name: planName,
        },
      });

      // Create yearly price
      const yearlyPrice = await this.stripe.prices.create({
        product: productId,
        unit_amount: plan.price.yearly * 100,
        currency: 'usd',
        recurring: {
          interval: 'year',
        },
        metadata: {
          ...plan.stripe.metadata,
          billing_cycle: 'yearly',
          plan_id: plan.id,
          plan_name: planName,
        },
      });

      logger.info(`Synced plan ${plan.id} with Stripe: Product ${productId}, Monthly ${monthlyPrice.id}, Yearly ${yearlyPrice.id}`);

      await supabase
        .from('plan_rules')
        .update({
          stripe_product_id: productId,
          stripe_monthly_price_id: monthlyPrice.id,
          stripe_yearly_price_id: yearlyPrice.id,
        })
        .eq('plan_name', planName);

      return {
        productId,
        monthlyPriceId: monthlyPrice.id,
        yearlyPriceId: yearlyPrice.id,
      };
    } catch (error) {
      logger.error('Error syncing plan with Stripe:', error as Error);
      throw new Error('Failed to sync plan with Stripe');
    }
  }

  /**
   * Sync all active plans from database with Stripe
   */
  async syncAllPlansWithStripe(): Promise<{
    success: boolean;
    synced: number;
    failed: number;
    results: Array<{
      planId: string;
      planName: string;
      success: boolean;
      productId?: string;
      monthlyPriceId?: string;
      yearlyPriceId?: string;
      error?: string;
    }>;
  }> {
    try {
      const planRules = await planRulesService.getAllPlanRules();
      const results: Array<{
        planId: string;
        planName: string;
        success: boolean;
        productId?: string;
        monthlyPriceId?: string;
        yearlyPriceId?: string;
        error?: string;
      }> = [];

      let synced = 0;
      let failed = 0;

      for (const planRule of planRules) {
        try {
          const plan = planRulesService.convertToSubscriptionPlan(planRule);
          const syncResult = await this.syncPlanWithStripe(plan);
          results.push({
            planId: plan.id,
            planName: plan.displayName,
            success: true,
            productId: syncResult.productId,
            monthlyPriceId: syncResult.monthlyPriceId,
            yearlyPriceId: syncResult.yearlyPriceId,
          });
          synced += 1;
        } catch (planError) {
          failed += 1;
          const errorMessage = planError instanceof Error ? planError.message : 'Failed to sync plan';
          logger.error(`Error syncing plan ${planRule.plan_name}:`, planError as Error);
          results.push({
            planId: planRule.plan_name,
            planName: planRule.display_name || planRule.plan_name,
            success: false,
            error: errorMessage,
          });
        }
      }

      return {
        success: failed === 0,
        synced,
        failed,
        results,
      };
    } catch (error) {
      logger.error('Error syncing all plans with Stripe:', error as Error);
      throw error;
    }
  }

  /**
   * Delete a Stripe Connect account by account ID
   */
  async deleteAccount(accountId: string): Promise<{ id: string; deleted: boolean }> {
    try {
      logger.info(`Attempting to delete Stripe account: ${accountId}`);
      const deletedAccount = await this.stripe.accounts.del(accountId);
      logger.info(`Deleted Stripe account ${accountId}`, { deletedAccount });
      
      // The response should have id and deleted properties
      return {
        id: deletedAccount.id || accountId,
        deleted: true
      };
    } catch (error) {
      logger.error(`Error deleting Stripe account ${accountId}:`, error as Error);
      
      // Preserve original error details
      const stripeError = error as any;
      const errorDetails = {
        type: stripeError?.type,
        code: stripeError?.code,
        message: stripeError?.message,
        param: stripeError?.param,
        raw: stripeError?.raw
      };
      
      logger.error(`Stripe error details for account ${accountId}:`, errorDetails);
      
      // Re-throw with more context
      throw error;
    }
  }

  /**
   * @deprecated This approach doesn't work for multiple recipients
   * Payment intents only support ONE destination, which isn't sufficient for our split.
   * Use processSplitPayment() with Separate Charges & Transfers instead.
   * 
   * This method is kept for reference but is no longer called.
   */
  async setupAutomaticSplitPaymentViaPaymentIntent(_invoice: Stripe.Invoice): Promise<boolean> {
    logger.warn('setupAutomaticSplitPaymentViaPaymentIntent is deprecated. Use processSplitPayment() instead.');
    return false;
  }
}

export default new StripeCheckoutService();
