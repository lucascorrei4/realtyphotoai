import Stripe from 'stripe';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import { SUBSCRIPTION_PLANS, SubscriptionPlan } from '../config/subscriptionPlans';

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

export interface CheckoutSessionData {
  planId: string;
  billingCycle: 'monthly' | 'yearly';
  userId: string;
  userEmail: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}

export class StripeCheckoutService {
  private stripe: Stripe;
  private splitConfig: SplitPaymentConfig;

  constructor() {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }
    
    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
    });

    // Split payment configuration with fee consideration
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
        percentage: 8, // 8% of gross revenue
        description: 'Paid Ads Agency'
      }
    };
  }

  /**
   * Create a Stripe checkout session with split payments
   */
  async createCheckoutSession(data: CheckoutSessionData): Promise<{ sessionId: string; url: string }> {
    try {
      const plan = SUBSCRIPTION_PLANS[data.planId];
      if (!plan) {
        throw new Error(`Plan ${data.planId} not found`);
      }

      // Get or create Stripe customer
      const customer = await this.getOrCreateCustomer(data.userId, data.userEmail);

      // Get price ID for the plan and billing cycle
      const priceId = await this.getPriceId(plan, data.billingCycle);

      // Note: Split amounts are calculated in webhook processing after payment

      // Create checkout session with application fee and transfers
      const session = await this.stripe.checkout.sessions.create({
        customer: customer.id,
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
        metadata: {
          plan_id: data.planId,
          billing_cycle: data.billingCycle,
          user_id: data.userId,
          ...data.metadata
        },
        subscription_data: {
          metadata: {
            plan_id: data.planId,
            billing_cycle: data.billingCycle,
            user_id: data.userId,
            partner1_account: this.splitConfig.partner1.accountId,
            partner2_account: this.splitConfig.partner2.accountId,
            agency_account: this.splitConfig.agency.accountId,
            ...data.metadata
          },
          // Application fee will be charged to connected accounts, not main account
          application_fee_percent: 5, // 5% application fee to cover platform costs
        },
        // Enable customer portal for subscription management
        allow_promotion_codes: true,
        billing_address_collection: 'required',
        customer_update: {
          address: 'auto',
          name: 'auto',
        },
      });

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
   * Get or create Stripe customer for user
   */
  private async getOrCreateCustomer(userId: string, email: string): Promise<Stripe.Customer> {
    try {
      // Check if user already has a Stripe customer ID
      const { data: user } = await supabase
        .from('user_profiles')
        .select('stripe_customer_id')
        .eq('id', userId)
        .single();

      if (user?.stripe_customer_id) {
        // Retrieve existing customer
        return await this.stripe.customers.retrieve(user.stripe_customer_id) as Stripe.Customer;
      }

      // Create new customer
      const customer = await this.stripe.customers.create({
        email,
        metadata: {
          user_id: userId,
        },
      });

      // Update user profile with Stripe customer ID
      await supabase
        .from('user_profiles')
        .update({ stripe_customer_id: customer.id })
        .eq('id', userId);

      logger.info(`Created Stripe customer ${customer.id} for user ${userId}`);
      return customer;
    } catch (error) {
      logger.error('Error getting/creating Stripe customer:', error as Error);
      throw new Error('Failed to get or create customer');
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
        },
      });

      // Update plan with new price ID
      await supabase
        .from('plan_rules')
        .update({
          [`stripe_${billingCycle}_price_id`]: price.id,
        })
        .eq('plan_name', plan.name);

      logger.info(`Created ${billingCycle} price ${price.id} for plan ${plan.id}`);
      return price.id;
    } catch (error) {
      logger.error('Error creating price:', error as Error);
      throw new Error('Failed to create price');
    }
  }

  /**
   * Calculate split amounts for partners and agency
   * With application fees, connected accounts pay their share of fees
   */
  private calculateSplitAmounts(totalAmount: number): { 
    partner1: number; 
    partner2: number; 
    agency: number;
    platformApplicationFee: number;
    totalFeesPaidByConnectedAccounts: number;
  } {
    // Calculate splits based on gross revenue
    const partner1Amount = Math.round(totalAmount * this.splitConfig.partner1.percentage / 100);
    const partner2Amount = Math.round(totalAmount * this.splitConfig.partner2.percentage / 100);
    const agencyAmount = Math.round(totalAmount * this.splitConfig.agency.percentage / 100);
    
    // Application fee (5%) goes to platform, charged to connected accounts
    const platformApplicationFee = Math.round(totalAmount * 0.05);
    
    // Connected accounts pay their share of Stripe fees + application fee
    const totalFeesPaidByConnectedAccounts = Math.round(totalAmount * 0.079); // ~7.9% total (2.9% + 5%)

    return {
      partner1: partner1Amount,
      partner2: partner2Amount,
      agency: agencyAmount,
      platformApplicationFee,
      totalFeesPaidByConnectedAccounts
    };
  }

  /**
   * Process split payment after successful subscription
   */
  async processSplitPayment(subscriptionId: string): Promise<void> {
    try {
      const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
      const invoice = await this.stripe.invoices.retrieve(subscription.latest_invoice as string);
      
      const amount = invoice.amount_paid;
      const splitAmounts = this.calculateSplitAmounts(amount / 100); // Convert from cents

      // Create transfers to all partners and agency
      await Promise.all([
        this.createTransfer(
          this.splitConfig.partner1.accountId,
          splitAmounts.partner1 * 100, // Convert to cents
          this.splitConfig.partner1.description,
          subscriptionId
        ),
        this.createTransfer(
          this.splitConfig.partner2.accountId,
          splitAmounts.partner2 * 100, // Convert to cents
          this.splitConfig.partner2.description,
          subscriptionId
        ),
        this.createTransfer(
          this.splitConfig.agency.accountId,
          splitAmounts.agency * 100, // Convert to cents
          this.splitConfig.agency.description,
          subscriptionId
        )
      ]);

      logger.info(`Processed split payment for subscription ${subscriptionId}:`, {
        grossAmount: amount / 100,
        partner1: splitAmounts.partner1,
        partner2: splitAmounts.partner2,
        agency: splitAmounts.agency,
        platformApplicationFee: splitAmounts.platformApplicationFee,
        totalFeesPaidByConnectedAccounts: splitAmounts.totalFeesPaidByConnectedAccounts,
        note: 'Application fee charged to connected accounts, not main account'
      });
    } catch (error) {
      logger.error('Error processing split payment:', error as Error);
      throw new Error('Failed to process split payment');
    }
  }

  /**
   * Create transfer to connected account
   */
  private async createTransfer(
    destinationAccountId: string,
    amount: number,
    description: string,
    subscriptionId: string
  ): Promise<Stripe.Transfer> {
    try {
      const transfer = await this.stripe.transfers.create({
        amount,
        currency: 'usd',
        destination: destinationAccountId,
        description: `${description} - Subscription ${subscriptionId}`,
        metadata: {
          subscription_id: subscriptionId,
          transfer_type: 'subscription_split',
        },
      });

      return transfer;
    } catch (error) {
      logger.error('Error creating transfer:', error as Error);
      throw new Error('Failed to create transfer');
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
      if (!productId) {
        const product = await this.stripe.products.create({
          name: plan.displayName,
          description: plan.description,
          metadata: plan.stripe.metadata,
        });
        productId = product.id;
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
        },
      });

      logger.info(`Synced plan ${plan.id} with Stripe: Product ${productId}, Monthly ${monthlyPrice.id}, Yearly ${yearlyPrice.id}`);

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
}

export default new StripeCheckoutService();
