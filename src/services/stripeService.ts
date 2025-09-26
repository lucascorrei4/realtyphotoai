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
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }
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
}

export default new StripeService();
