import Stripe from 'stripe';
import { logger } from '../utils/logger';

export interface StripeProduct {
  id: string;
  name: string;
  description: string | undefined;
  active: boolean;
  metadata: Record<string, string>;
}

export interface StripePrice {
  id: string;
  product_id: string;
  active: boolean;
  currency: string;
  unit_amount: number;
  recurring: {
    interval: 'month' | 'year' | 'week';
    interval_count: number;
  };
  metadata: Record<string, string>;
}

export interface StripeSubscription {
  id: string;
  customer_id: string;
  status: string;
  current_period_start: number;
  current_period_end: number;
  items: {
    data: Array<{
      price: {
        id: string;
        product_id: string;
        unit_amount: number;
        currency: string;
      };
      quantity: number;
    }>;
  };
}

export class StripeService {
  private stripe: Stripe;

  constructor() {
    // Import getStripeSecretKey dynamically to avoid circular dependencies
    const { getStripeSecretKey } = require('../utils/stripeConfig');
    const stripeSecretKey = getStripeSecretKey();
    
    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
    });
  }

  /**
   * Get all products from Stripe
   */
  async getProducts(): Promise<StripeProduct[]> {
    try {
      const products = await this.stripe.products.list({
        active: true,
        limit: 100,
      });

      return products.data.map((product: Stripe.Product) => ({
        id: product.id,
        name: product.name,
        description: product.description ?? undefined,
        active: product.active,
        metadata: product.metadata,
      }));
    } catch (error) {
      logger.error('Error fetching Stripe products:', error as Error);
      throw new Error('Failed to fetch Stripe products');
    }
  }

  /**
   * Get all prices for a specific product
   */
  async getProductPrices(productId: string): Promise<StripePrice[]> {
    try {
      const prices = await this.stripe.prices.list({
        product: productId,
        active: true,
      });

      return prices.data.map((price: Stripe.Price) => ({
        id: price.id,
        product_id: price.product as string,
        active: price.active,
        currency: price.currency,
        unit_amount: price.unit_amount || 0,
        recurring: price.recurring ? {
          interval: price.recurring.interval as 'month' | 'year' | 'week',
          interval_count: price.recurring.interval_count,
        } : {
          interval: 'month',
          interval_count: 1,
        },
        metadata: price.metadata,
      }));
    } catch (error) {
      logger.error('Error fetching Stripe prices:', error as Error);
      throw new Error('Failed to fetch Stripe prices');
    }
  }

  /**
   * Get all prices from Stripe
   */
  async getAllPrices(): Promise<StripePrice[]> {
    try {
      const prices = await this.stripe.prices.list({
        active: true,
        limit: 100,
      });

      return prices.data.map((price: Stripe.Price) => ({
        id: price.id,
        product_id: price.product as string,
        active: price.active,
        currency: price.currency,
        unit_amount: price.unit_amount || 0,
        recurring: price.recurring ? {
          interval: price.recurring.interval as 'month' | 'year' | 'week',
          interval_count: price.recurring.interval_count,
        } : {
          interval: 'month',
          interval_count: 1,
        },
        metadata: price.metadata,
      }));
    } catch (error) {
      logger.error('Error fetching Stripe prices:', error as Error);
      throw new Error('Failed to fetch Stripe prices');
    }
  }

  /**
   * Create a new product in Stripe
   */
  async createProduct(productData: {
    name: string;
    description?: string;
    metadata?: Record<string, string>;
  }): Promise<StripeProduct> {
    try {
      const product = await this.stripe.products.create({
        name: productData.name,
        ...(productData.description && { description: productData.description }),
        ...(productData.metadata && { metadata: productData.metadata }),
      });

      return {
        id: product.id,
        name: product.name,
        description: product.description ?? undefined,
        active: product.active,
        metadata: product.metadata,
      };
    } catch (error) {
      logger.error('Error creating Stripe product:', error as Error);
      throw new Error('Failed to create Stripe product');
    }
  }

  /**
   * Create a new price in Stripe
   */
  async createPrice(priceData: {
    product_id: string;
    unit_amount: number;
    currency: string;
    recurring: {
      interval: 'month' | 'year';
      interval_count: number;
    };
    metadata?: Record<string, string>;
  }): Promise<StripePrice> {
    try {
      const price = await this.stripe.prices.create({
        product: priceData.product_id,
        unit_amount: priceData.unit_amount,
        currency: priceData.currency,
        recurring: priceData.recurring,
        ...(priceData.metadata && { metadata: priceData.metadata }),
      });

      return {
        id: price.id,
        product_id: price.product as string,
        active: price.active,
        currency: price.currency,
        unit_amount: price.unit_amount || 0,
        recurring: priceData.recurring,
        metadata: price.metadata,
      };
    } catch (error) {
      logger.error('Error creating Stripe price:', error as Error);
      throw new Error('Failed to create Stripe price');
    }
  }

  /**
   * Update a product in Stripe
   */
  async updateProduct(productId: string, updates: {
    name?: string;
    description?: string;
    metadata?: Record<string, string>;
  }): Promise<StripeProduct> {
    try {
      const product = await this.stripe.products.update(productId, updates);

      return {
        id: product.id,
        name: product.name,
        description: product.description ?? undefined,
        active: product.active,
        metadata: product.metadata,
      };
    } catch (error) {
      logger.error('Error updating Stripe product:', error as Error);
      throw new Error('Failed to update Stripe product');
    }
  }

  /**
   * Archive a product in Stripe (soft delete)
   */
  async archiveProduct(productId: string): Promise<boolean> {
    try {
      await this.stripe.products.update(productId, { active: false });
      return true;
    } catch (error) {
      logger.error('Error archiving Stripe product:', error as Error);
      throw new Error('Failed to archive Stripe product');
    }
  }

  /**
   * Get subscription by ID
   */
  async getSubscription(subscriptionId: string): Promise<StripeSubscription | null> {
    try {
      const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
      
      return {
        id: subscription.id,
        customer_id: subscription.customer as string,
        status: subscription.status,
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
        items: {
          data: subscription.items.data.map((item: Stripe.SubscriptionItem) => ({
            price: {
              id: item.price.id,
              product_id: item.price.product as string,
              unit_amount: item.price.unit_amount || 0,
              currency: item.price.currency,
            },
            quantity: item.quantity || 1,
          })),
        },
      };
    } catch (error) {
      logger.error('Error fetching Stripe subscription:', error as Error);
      return null;
    }
  }

  /**
   * Get customer subscriptions
   */
  async getCustomerSubscriptions(customerId: string): Promise<StripeSubscription[]> {
    try {
      const subscriptions = await this.stripe.subscriptions.list({
        customer: customerId,
        status: 'all',
        limit: 100,
      });

      return subscriptions.data.map((subscription: Stripe.Subscription) => ({
        id: subscription.id,
        customer_id: subscription.customer as string,
        status: subscription.status,
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
        items: {
          data: subscription.items.data.map((item: Stripe.SubscriptionItem) => ({
            price: {
              id: item.price.id,
              product_id: item.price.product as string,
              unit_amount: item.price.unit_amount || 0,
              currency: item.price.currency,
            },
            quantity: item.quantity || 1,
          })),
        },
      }));
    } catch (error) {
      logger.error('Error fetching customer subscriptions:', error as Error);
      throw new Error('Failed to fetch customer subscriptions');
    }
  }

  /**
   * Sync Stripe products with local database
   */
  async syncProductsWithDatabase(): Promise<{
    products: StripeProduct[];
    prices: StripePrice[];
  }> {
    try {
      const [products, prices] = await Promise.all([
        this.getProducts(),
        this.getAllPrices(),
      ]);

      return { products, prices };
    } catch (error) {
      logger.error('Error syncing Stripe products with database:', error as Error);
      throw new Error('Failed to sync Stripe products');
    }
  }

  /**
   * List recent Stripe customers
   */
  async listCustomers(limit: number = 20): Promise<Array<{
    id: string;
    email: string | null;
    name: string | null;
    created: number | null;
  }>> {
    try {
      // Fetch customers and also derive customer info from recent sessions as fallback
      const customers = await this.stripe.customers.list({ limit });
      const sessions = await this.stripe.checkout.sessions.list({ limit });

      const map: Record<string, { id: string; email: string | null; name: string | null; created: number | null }> = {};

      customers.data.forEach((c) => {
        map[c.id] = {
          id: c.id,
          email: c.email ?? null,
          name: (c as any).name ?? null,
          created: c.created ?? null,
        };
      });

      sessions.data.forEach((s) => {
        const cid = typeof s.customer === 'string' ? s.customer : (s.customer as any)?.id;
        const email = s.customer_details?.email ?? s.customer_email ?? null;
        const created = s.created ?? null;
        if (cid) {
          if (!map[cid]) {
            map[cid] = { id: cid, email, name: null, created };
          } else if (!map[cid].email && email) {
            map[cid].email = email;
          }
          if (!map[cid].created && created) {
            map[cid].created = created;
          }
        } else if (email) {
          const key = `email:${email}`;
          if (!map[key]) {
            map[key] = { id: key, email, name: null, created };
          }
        }
      });

      // Sort by created desc where available
      return Object.values(map).sort((a, b) => (b.created || 0) - (a.created || 0)).slice(0, limit);
    } catch (error) {
      logger.error('Error listing Stripe customers:', error as Error);
      throw new Error('Failed to list Stripe customers');
    }
  }

  /**
   * List recent Stripe checkout sessions (transactions)
   */
  async listCheckoutSessions(limit: number = 20): Promise<Array<{
    id: string;
    customer: string | null;
    customer_email: string | null;
    payment_intent: string | null;
    amount_total: number | null;
    currency: string | null;
    payment_status: string | null;
    created: number | null;
    product_name: string | null;
  }>> {
    try {
      const sessions = await this.stripe.checkout.sessions.list({
        limit,
        expand: ['data.line_items'],
      } as Stripe.Checkout.SessionListParams);
      // Sort by created desc in case Stripe returns ascending
      const sorted = [...sessions.data].sort((a, b) => (b.created || 0) - (a.created || 0));
      return sorted.map((s) => ({
        id: s.id,
        customer: typeof s.customer === 'string' ? s.customer : (s.customer as any)?.id ?? null,
        customer_email: s.customer_details?.email ?? s.customer_email ?? null,
        payment_intent: typeof s.payment_intent === 'string' ? s.payment_intent : (s.payment_intent as any)?.id ?? null,
        amount_total: s.amount_total ?? null,
        currency: s.currency ?? null,
        payment_status: s.payment_status ?? null,
        created: s.created ?? null,
        product_name: ((s as any).line_items?.data?.[0]?.description) || ((s as any).line_items?.data?.[0]?.price?.product as any)?.name || null,
      }));
    } catch (error) {
      logger.error('Error listing Stripe checkout sessions:', error as Error);
      throw new Error('Failed to list Stripe checkout sessions');
    }
  }

  /**
   * List recent Stripe subscriptions
   */
  async listSubscriptions(limit: number = 20): Promise<Array<{
    id: string;
    customer: string | null;
    status: string | null;
    plan: string | null;
    amount: number | null;
    currency: string | null;
    current_period_end: number | null;
    trial_end: number | null;
  }>> {
    try {
      const subs = await this.stripe.subscriptions.list({
        limit,
        expand: ['data.latest_invoice', 'data.items.data.price.product'],
      });

      return subs.data.map((s) => {
        const item = s.items?.data?.[0];
        const price = item?.price;
        const product = (price?.product as any);
        const latestInvoice = (s as any).latest_invoice;
        const amount = latestInvoice?.total ?? price?.unit_amount ?? null;
        const currency = latestInvoice?.currency ?? price?.currency ?? null;

        return {
          id: s.id,
          customer: typeof s.customer === 'string' ? s.customer : (s.customer as any)?.id ?? null,
          status: s.status ?? null,
          plan: product?.name || price?.nickname || price?.id || null,
          amount: amount ?? null,
          currency: currency ?? null,
          current_period_end: s.current_period_end ?? null,
          trial_end: s.trial_end ?? null,
        };
      });
    } catch (error) {
      logger.error('Error listing Stripe subscriptions:', error as Error);
      throw new Error('Failed to list Stripe subscriptions');
    }
  }

  /**
   * List recent Stripe invoices
   */
  async listInvoices(limit: number = 20): Promise<Array<{
    id: string;
    customer: string | null;
    customer_email: string | null;
    status: string | null;
    total: number | null;
    amount_due: number | null;
    amount_paid: number | null;
    currency: string | null;
    due_date: number | null;
    hosted_invoice_url: string | null;
  }>> {
    try {
      const invoices = await this.stripe.invoices.list({ limit });

      return invoices.data.map((inv) => ({
        id: inv.id,
        customer: typeof inv.customer === 'string' ? inv.customer : (inv.customer as any)?.id ?? null,
        customer_email: inv.customer_email ?? null,
        status: inv.status ?? null,
        total: inv.total ?? null,
        amount_due: inv.amount_due ?? null,
        amount_paid: inv.amount_paid ?? null,
        currency: inv.currency ?? null,
        due_date: inv.due_date ?? inv.created ?? null,
        hosted_invoice_url: inv.hosted_invoice_url ?? null,
      }));
    } catch (error) {
      logger.error('Error listing Stripe invoices:', error as Error);
      throw new Error('Failed to list Stripe invoices');
    }
  }

  /**
   * List recent Stripe payouts
   */
  async listPayouts(limit: number = 10): Promise<Array<{
    id: string;
    amount: number;
    currency: string;
    status: string;
    arrival_date: number | null;
    created: number | null;
  }>> {
    try {
      const payouts = await this.stripe.payouts.list({ limit });
      return payouts.data.map((p) => ({
        id: p.id,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        arrival_date: (p as any).arrival_date ?? null,
        created: p.created ?? null,
      }));
    } catch (error) {
      logger.error('Error listing Stripe payouts:', error as Error);
      throw new Error('Failed to list Stripe payouts');
    }
  }

  /**
   * Get Stripe balance (available/pending)
   */
  async getBalance(): Promise<{
    available: Array<{ amount: number; currency: string }>;
    pending: Array<{ amount: number; currency: string }>;
  }> {
    try {
      const balance = await this.stripe.balance.retrieve();
      return {
        available: balance.available?.map((b) => ({ amount: b.amount, currency: b.currency })) || [],
        pending: balance.pending?.map((b) => ({ amount: b.amount, currency: b.currency })) || [],
      };
    } catch (error) {
      logger.error('Error fetching Stripe balance:', error as Error);
      throw new Error('Failed to fetch Stripe balance');
    }
  }
}

export default new StripeService();
