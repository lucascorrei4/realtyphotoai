import express from 'express';
import stripeCheckoutService from '../services/stripeCheckoutService';
import { authenticateToken, AuthenticatedRequest } from '../middleware/authMiddleware';
import { logger } from '../utils/logger';
import { SUBSCRIPTION_PLANS } from '../config/subscriptionPlans';
import { supabase } from '../config/supabase';

const router = express.Router();

/**
 * Get available subscription plans
 * GET /stripe/plans
 */
router.get('/plans', async (_req, res) => {
  try {
    const plans = Object.values(SUBSCRIPTION_PLANS).map(plan => ({
      id: plan.id,
      name: plan.displayName,
      description: plan.description,
      price: plan.price,
      features: plan.features,
      limits: plan.limits,
      popular: plan.popular,
      billingCycle: plan.billingCycle
    }));

    return res.json({
      success: true,
      plans
    });
  } catch (error) {
    logger.error('Error fetching subscription plans:', error as Error);
    return res.status(500).json({ error: 'Failed to fetch subscription plans' });
  }
});

/**
 * Create checkout session
 * POST /stripe/checkout
 */
router.post('/checkout', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { planId, billingCycle = 'monthly' } = req.body;
    const userId = req.user?.id;
    const userEmail = req.user?.email;

    if (!userId || !userEmail) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    if (!planId || !SUBSCRIPTION_PLANS[planId]) {
      return res.status(400).json({ error: 'Invalid plan ID' });
    }

    if (!['monthly', 'yearly'].includes(billingCycle)) {
      return res.status(400).json({ error: 'Invalid billing cycle' });
    }

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    
    const sessionData = {
      planId,
      billingCycle,
      userId,
      userEmail,
      successUrl: `${baseUrl}/dashboard?subscription=success`,
      cancelUrl: `${baseUrl}/pricing?subscription=cancelled`,
      metadata: {
        source: 'web_app',
        user_agent: req.get('User-Agent') || 'unknown'
      }
    };

    const { sessionId, url } = await stripeCheckoutService.createCheckoutSession(sessionData);

    logger.info(`Checkout session created for user ${userId}, plan ${planId}`);

    return res.json({
      success: true,
      sessionId,
      url
    });
  } catch (error) {
    logger.error('Error creating checkout session:', error as Error);
    return res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

/**
 * Create customer portal session for subscription management
 * POST /stripe/portal
 */
router.post('/portal', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id;
    const userEmail = req.user?.email;

    if (!userId || !userEmail) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    // Get user's Stripe customer ID
    const { data: user } = await supabase
      .from('user_profiles')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single();

    if (!user?.stripe_customer_id) {
      return res.status(404).json({ error: 'No subscription found. Please subscribe first.' });
    }

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const returnUrl = `${baseUrl}/dashboard?portal=success`;

    const { url } = await stripeCheckoutService.createCustomerPortalSession(
      user.stripe_customer_id,
      returnUrl
    );

    return res.json({
      success: true,
      url
    });
  } catch (error) {
    logger.error('Error creating customer portal session:', error as Error);
    return res.status(500).json({ error: 'Failed to create customer portal session' });
  }
});

/**
 * Get user's subscription details
 * GET /stripe/subscription
 */
router.get('/subscription', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    // Get user's subscription from database
    const { data: subscription } = await supabase
      .from('stripe_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!subscription) {
      return res.json({
        success: true,
        subscription: null,
        message: 'No active subscription found'
      });
    }

    // Get plan details
    const plan = SUBSCRIPTION_PLANS[subscription.plan_name];
    
    return res.json({
      success: true,
      subscription: {
        ...subscription,
        plan: plan ? {
          id: plan.id,
          name: plan.displayName,
          features: plan.features,
          limits: plan.limits
        } : null
      }
    });
  } catch (error) {
    logger.error('Error fetching subscription:', error as Error);
    return res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

/**
 * Cancel subscription
 * POST /stripe/cancel
 */
router.post('/cancel', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id;
    const { immediately = false } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    // Get user's active subscription
    const { data: subscription } = await supabase
      .from('stripe_subscriptions')
      .select('stripe_subscription_id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (!subscription) {
      return res.status(404).json({ error: 'No active subscription found' });
    }

    // Cancel subscription in Stripe
    await stripeCheckoutService.cancelSubscription(
      subscription.stripe_subscription_id,
      immediately
    );

    logger.info(`Subscription ${subscription.stripe_subscription_id} cancelled by user ${userId}`);

    return res.json({
      success: true,
      message: immediately ? 'Subscription cancelled immediately' : 'Subscription will be cancelled at the end of the current period'
    });
  } catch (error) {
    logger.error('Error cancelling subscription:', error as Error);
    return res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

/**
 * Update subscription plan
 * POST /stripe/update-plan
 */
router.post('/update-plan', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id;
    const { newPlanId, billingCycle = 'monthly' } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    if (!newPlanId || !SUBSCRIPTION_PLANS[newPlanId]) {
      return res.status(400).json({ error: 'Invalid plan ID' });
    }

    // Get user's active subscription
    const { data: subscription } = await supabase
      .from('stripe_subscriptions')
      .select('stripe_subscription_id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (!subscription) {
      return res.status(404).json({ error: 'No active subscription found' });
    }

    // Get new price ID
    const plan = SUBSCRIPTION_PLANS[newPlanId];
    const newPriceId = billingCycle === 'yearly' ? plan.stripe.yearlyPriceId : plan.stripe.monthlyPriceId;

    if (!newPriceId) {
      return res.status(400).json({ error: 'Price not available for this plan and billing cycle' });
    }

    // Update subscription in Stripe
    await stripeCheckoutService.updateSubscription(
      subscription.stripe_subscription_id,
      newPriceId
    );

    logger.info(`Subscription ${subscription.stripe_subscription_id} updated to plan ${newPlanId} by user ${userId}`);

    return res.json({
      success: true,
      message: 'Subscription plan updated successfully'
    });
  } catch (error) {
    logger.error('Error updating subscription plan:', error as Error);
    return res.status(500).json({ error: 'Failed to update subscription plan' });
  }
});

/**
 * Get subscription usage statistics
 * GET /stripe/usage
 */
router.get('/usage', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    // Get current subscription
    const { data: subscription } = await supabase
      .from('stripe_subscriptions')
      .select('plan_name, current_period_start, current_period_end')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (!subscription) {
      return res.json({
        success: true,
        usage: null,
        message: 'No active subscription found'
      });
    }

    // Get plan details
    const plan = SUBSCRIPTION_PLANS[subscription.plan_name];
    if (!plan) {
      return res.status(500).json({ error: 'Plan configuration not found' });
    }

    // Get current period usage
    const { data: generations } = await supabase
      .from('generations')
      .select('id')
      .eq('user_id', userId)
      .gte('created_at', subscription.current_period_start)
      .lte('created_at', subscription.current_period_end);

    const currentUsage = generations?.length || 0;
    const limit = plan.limits.monthlyGenerations;

    return res.json({
      success: true,
      usage: {
        current: currentUsage,
        limit,
        remaining: Math.max(0, limit - currentUsage),
        percentage: Math.round((currentUsage / limit) * 100),
        periodStart: subscription.current_period_start,
        periodEnd: subscription.current_period_end,
        plan: {
          id: plan.id,
          name: plan.displayName,
          features: plan.features
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching usage statistics:', error as Error);
    return res.status(500).json({ error: 'Failed to fetch usage statistics' });
  }
});

/**
 * Sync all plans with Stripe (Admin only)
 * POST /stripe/sync-plans
 */
router.post('/sync-plans', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    // Check if user is admin
    const userId = req.user?.id;
    const { data: user } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (!user || !['admin', 'super_admin'].includes(user.role)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const results = [];
    
    for (const [planId, plan] of Object.entries(SUBSCRIPTION_PLANS)) {
      try {
        const syncResult = await stripeCheckoutService.syncPlanWithStripe(plan);
        results.push({
          planId,
          success: true,
          ...syncResult
        });
      } catch (error) {
        logger.error(`Error syncing plan ${planId}:`, error as Error);
        results.push({
          planId,
          success: false,
          error: (error as Error).message
        });
      }
    }

    return res.json({
      success: true,
      results,
      message: `Synced ${results.filter(r => r.success).length}/${results.length} plans with Stripe`
    });
  } catch (error) {
    logger.error('Error syncing plans with Stripe:', error as Error);
    return res.status(500).json({ error: 'Failed to sync plans with Stripe' });
  }
});

export default router;
