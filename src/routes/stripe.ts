import express from 'express';
import Stripe from 'stripe';
import stripeCheckoutService, { CheckoutSessionData, OneTimePaymentCheckoutData, UserData, CustomData } from '../services/stripeCheckoutService';
import { authenticateToken, AuthenticatedRequest } from '../middleware/authMiddleware';
import { logger } from '../utils/logger';
import { asyncHandler } from '../middleware/errorHandler';
import { SUBSCRIPTION_PLANS } from '../config/subscriptionPlans';
import { supabase } from '../config/supabase';
import { getStripeSecretKey } from '../utils/stripeConfig';

// Initialize Stripe - uses test key in development if STRIPE_SECRET_KEY_TEST is set
const stripe = new Stripe(getStripeSecretKey(), {
  apiVersion: '2023-10-16',
});

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
 * Create checkout session (supports both authenticated and guest checkout)
 * POST /stripe/checkout
 */
router.post('/checkout', asyncHandler(async (req: express.Request, res) => {
  const { planId, billingCycle = 'monthly', email } = req.body;
  
  // Try to get user from auth token if provided (for logged-in users)
  let userId: string | undefined;
  let userEmail: string | undefined;
  let isGuest = false;
  
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    
    if (token) {
      // Try to verify token and get user
      const authService = (await import('../services/authService')).default;
      const decoded = authService.verifyToken(token);
      
      if (decoded) {
        userId = decoded.id;
        userEmail = decoded.email;
      } else {
        // Try Supabase token
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (!error && user) {
          userId = user.id;
          userEmail = user.email;
        }
      }
    }
  } catch (error) {
    // Auth failed, continue as guest
    logger.info('No valid auth token, proceeding with guest checkout');
  }
  
  // For guest checkout, email is optional - Stripe will collect it during checkout
  if (!userId || !userEmail) {
    isGuest = true;
    // For guest checkout, we'll create the user account after payment in the webhook
    // Use a temporary identifier - email will come from Stripe after payment
    userId = `guest_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    // Email is not required - Stripe will collect it during checkout
    userEmail = email || ''; // Optional - Stripe will collect during checkout
  }

  // Validate plan ID - check both SUBSCRIPTION_PLANS and database
  if (!planId) {
    res.status(400).json({ 
      success: false,
      error: 'INVALID_REQUEST',
      message: 'Plan ID is required' 
    });
    return;
  }

  // Check if plan exists in SUBSCRIPTION_PLANS (fallback to database check if needed)
  let plan = SUBSCRIPTION_PLANS[planId];
  if (!plan) {
    // Try to get plan from database as fallback
    const { data: planRule, error: planError } = await supabase
      .from('plan_rules')
      .select('plan_name')
      .eq('plan_name', planId)
      .eq('is_active', true)
      .single();
    
    if (planError || !planRule) {
      res.status(400).json({ 
        success: false,
        error: 'INVALID_PLAN',
        message: `Invalid plan ID: ${planId}` 
      });
      return;
    }
  }

  if (!['monthly', 'yearly'].includes(billingCycle)) {
    res.status(400).json({ 
      success: false,
      error: 'INVALID_BILLING_CYCLE',
      message: 'Invalid billing cycle. Must be "monthly" or "yearly"' 
    });
    return;
  }

  // Get user profile for additional user data
  const { data: userProfile } = await supabase
    .from('user_profiles')
    .select('name, phone')
    .eq('id', userId)
    .single();

  // Extract user name components
  const fullName = userProfile?.name || '';
  const nameParts = fullName.split(' ').filter((part: string) => part.length > 0);
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  // Extract conversion tracking data from request
  const forwardedForHeader = req.headers['x-forwarded-for'];
  const forwardedFor = Array.isArray(forwardedForHeader) ? forwardedForHeader[0] : forwardedForHeader;
  const ipCandidate = forwardedFor?.split(',')[0]?.trim() ?? req.ip ?? '';
  const userAgent = req.get('User-Agent') || '';
  const refererHeader = req.headers.referer || req.headers.referrer;
  const referer = Array.isArray(refererHeader) ? refererHeader[0] : refererHeader;

  // Extract UTM parameters from query string and body
  const utmSource = req.query.utm_source || req.body.utmSource || '';
  const utmMedium = req.query.utm_medium || req.body.utmMedium || '';
  const utmCampaign = req.query.utm_campaign || req.body.utmCampaign || '';
  const utmContent = req.query.utm_content || req.body.utmContent || '';
  const utmTerm = req.query.utm_term || req.body.utmTerm || '';

  // Extract Facebook Pixel data from request body
  const fbp = req.body.fbp || '';
  const fbc = req.body.fbc || '';

  // Extract UTM from referer if not in query/body
  let finalUtmSource = utmSource as string;
  let finalUtmMedium = utmMedium as string;
  let finalUtmCampaign = utmCampaign as string;
  let finalUtmContent = utmContent as string;
  let finalUtmTerm = utmTerm as string;

  if (referer && !finalUtmSource && !finalUtmMedium && !finalUtmCampaign) {
    try {
      const urlObj = new URL(referer as string);
      const params = urlObj.searchParams;
      finalUtmSource = params.get('utm_source') || finalUtmSource;
      finalUtmMedium = params.get('utm_medium') || finalUtmMedium;
      finalUtmCampaign = params.get('utm_campaign') || finalUtmCampaign;
      finalUtmContent = params.get('utm_content') || finalUtmContent;
      finalUtmTerm = params.get('utm_term') || finalUtmTerm;
    } catch (error) {
      // Invalid URL, ignore
    }
  }

  // Get plan amount for custom_data
  const planAmount = plan ? (billingCycle === 'yearly' ? plan.price.yearly : plan.price.monthly) : 0;

  // Build user_data - only include defined values
  // For guest checkout, email may be empty (Stripe will collect it)
  const userData: UserData = {
    ...(userEmail ? { email: userEmail } : {}),
    external_id: userId,
  };

  if (firstName) {
    userData.first_name = firstName;
  }
  if (lastName) {
    userData.last_name = lastName;
  }
  if (userProfile?.phone) {
    userData.phone = userProfile.phone;
  }
  if (ipCandidate) {
    userData.ip = ipCandidate;
  }
  if (userAgent) {
    userData.user_agent = userAgent;
  }
  if (fbp) {
    userData.fbp = fbp;
  }
  if (fbc) {
    userData.fbc = fbc;
  }

  // Build custom_data - only include defined values
  const customData: CustomData = {
    value: planAmount,
    currency: 'USD',
    event_id: 'Purchase',
    external_id: userId,
  };

  if (finalUtmSource) {
    customData.utm_source = finalUtmSource;
  }
  if (finalUtmMedium) {
    customData.utm_medium = finalUtmMedium;
  }
  if (finalUtmCampaign) {
    customData.utm_campaign = finalUtmCampaign;
  }
  if (finalUtmContent) {
    customData.utm_content = finalUtmContent;
  }
  if (finalUtmTerm) {
    customData.utm_term = finalUtmTerm;
  }

  // Use localhost in development, production URL otherwise
  const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
  const baseUrl = isDevelopment 
    ? 'http://localhost:3000'
    : (process.env.FRONTEND_URL || 'https://realvisionaire.com');
  
  // For guest checkout, redirect to auth page to create account after payment
  // For logged-in users, redirect to dashboard
  // Email will come from Stripe after payment, so we don't need to pass it in URL
  const successUrl = isGuest 
    ? `${baseUrl}/auth/callback?subscription=success`
    : `${baseUrl}/dashboard?subscription=success`;
  
  const sessionData: CheckoutSessionData = {
    planId,
    billingCycle,
    userId,
    ...(userEmail ? { userEmail } : {}), // Only include userEmail if it has a value
    successUrl,
    cancelUrl: `${baseUrl}/pricing?subscription=cancelled`,
    metadata: {
      source: 'web_app',
      is_guest: isGuest ? 'true' : 'false',
    },
    userData,
    customData,
  };

  const { sessionId, url } = await stripeCheckoutService.createCheckoutSession(sessionData);

  logger.info(`Checkout session created for user ${userId}, plan ${planId}`);

  res.json({
    success: true,
    sessionId,
    url
  });
}));

/**
 * Create one-time payment checkout session
 * POST /stripe/checkout-one-time
 */
router.post('/checkout-one-time', asyncHandler(async (req: express.Request, res) => {
  const { amount, credits, description, offerType = 'credits', email } = req.body;
  
  // Try to get user from auth token if provided
  let userId: string | undefined;
  let userEmail: string | undefined;
  let isGuest = false;
  
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    
    if (token) {
      const authService = (await import('../services/authService')).default;
      const decoded = authService.verifyToken(token);
      
      if (decoded) {
        userId = decoded.id;
        userEmail = decoded.email;
      } else {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (!error && user) {
          userId = user.id;
          userEmail = user.email;
        }
      }
    }
  } catch (error) {
    logger.info('No valid auth token, proceeding with guest checkout');
  }
  
  if (!userId || !userEmail) {
    isGuest = true;
    userId = `guest_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    userEmail = email || '';
  }

  if (!amount || !description) {
    res.status(400).json({ 
      success: false,
      error: 'INVALID_REQUEST',
      message: 'Amount and description are required' 
    });
    return;
  }

  // Extract conversion tracking data
  const forwardedForHeader = req.headers['x-forwarded-for'];
  const forwardedFor = Array.isArray(forwardedForHeader) ? forwardedForHeader[0] : forwardedForHeader;
  const ipCandidate = forwardedFor?.split(',')[0]?.trim() ?? req.ip ?? '';
  const userAgent = req.get('User-Agent') || '';

  const userData: UserData = {
    ...(userEmail ? { email: userEmail } : {}),
    external_id: userId,
    ip: ipCandidate,
    user_agent: userAgent,
  };

  const customData: CustomData = {
    value: amount,
    currency: 'USD',
    event_id: 'OneTimePurchase',
    external_id: userId,
  };

  // Use localhost in development, production URL otherwise
  const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
  const baseUrl = isDevelopment 
    ? 'http://localhost:3000'
    : (process.env.FRONTEND_URL || 'https://realvisionaire.com');
  
  // Success URL with session ID for magic link authentication
  const successUrl = `${baseUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}&type=one_time`;
  
  // Build checkout data, only including optional properties when they have values
  const checkoutData: OneTimePaymentCheckoutData = {
    amount,
    description,
    userId,
    successUrl,
    cancelUrl: `${baseUrl}/pricing?payment=cancelled`,
    offerType: offerType as 'credits' | 'videos',
    metadata: {
      source: 'web_app',
      is_guest: isGuest ? 'true' : 'false',
    },
    userData,
    customData,
  };

  // Always include credits if provided, even if 0 (for tracking purposes)
  // For DIY 800, credits should be 800
  if (credits !== undefined && credits !== null) {
    checkoutData.credits = credits;
  } else if (offerType === 'credits' && amount === 27) {
    // Default to 800 credits for $27 DIY 800 offer if not specified
    checkoutData.credits = 800;
  }
  
  if (userEmail && userEmail.trim()) {
    checkoutData.userEmail = userEmail;
  }

  const { sessionId, url } = await stripeCheckoutService.createOneTimePaymentCheckout(checkoutData);

  logger.info(`One-time payment checkout session created for user ${userId}, amount $${amount}`);

  res.json({
    success: true,
    sessionId,
    url
  });
}));

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
 * Manually sync subscription from Stripe (for fixing missed webhooks)
 * POST /stripe/sync-subscription
 */
router.post('/sync-subscription', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  const userEmail = req.user?.email;

  if (!userId || !userEmail) {
    res.status(401).json({ 
      success: false,
      error: 'UNAUTHORIZED',
      message: 'User authentication required' 
    });
    return;
  }

  try {
    // Get user's current profile including subscription_plan and role
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('stripe_customer_id, subscription_plan, role')
      .eq('id', userId)
      .single();

    if (!userProfile?.stripe_customer_id) {
      res.status(400).json({ 
        success: false,
        error: 'NO_CUSTOMER_ID',
        message: 'No Stripe customer ID found. Please subscribe first.' 
      });
      return;
    }

    // Get current database plan
    const currentDbPlan = userProfile.subscription_plan?.toLowerCase().trim() || 'free';
    const userRole = userProfile.role || 'user';
    
    // Plan hierarchy for comparison (higher number = higher tier)
    const planHierarchy: Record<string, number> = {
      'free': 0,
      'basic': 1,
      'premium': 2,
      'enterprise': 3,
      'ultra': 4
    };

    // Get active subscriptions from Stripe
    const subscriptions = await stripe.subscriptions.list({
      customer: userProfile.stripe_customer_id,
      status: 'active',
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      // No active subscription found in Stripe
      // Only downgrade to free if current plan is not manually set higher
      // Admins or manually set higher plans should be preserved
      if (userRole === 'admin' || userRole === 'super_admin' || planHierarchy[currentDbPlan] > planHierarchy['free']) {
        logger.info(`No active Stripe subscriptions for user ${userId}, but preserving current plan ${currentDbPlan} (admin or manually set).`);
        
        // Just mark subscription records as canceled, don't change user plan
        await supabase
          .from('stripe_subscriptions')
          .update({
            status: 'canceled',
            cancel_at_period_end: false,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId)
          .neq('status', 'canceled');

        res.json({
          success: true,
          message: 'No active Stripe subscription found. Current plan preserved.',
          subscription: null,
          preserved_plan: currentDbPlan
        });
        return;
      }

      // No active subscription and not admin/manually set - downgrade to free
      logger.info(`No active Stripe subscriptions for user ${userId}. Resetting local subscription state.`);

      await supabase
        .from('stripe_subscriptions')
        .update({
          status: 'canceled',
          cancel_at_period_end: false,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .neq('status', 'canceled');

      await supabase
        .from('user_profiles')
        .update({
          subscription_plan: 'free',
          monthly_generations_limit: 10,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      res.json({
        success: true,
        message: 'No active subscription found in Stripe. Local records reset.',
        subscription: null,
      });
      return;
    }

    const subscription = subscriptions.data[0];
    const priceId = subscription.items.data[0]?.price.id;
    
    if (!priceId) {
      res.status(400).json({ 
        success: false,
        error: 'NO_PRICE_ID',
        message: 'No price ID found in subscription.' 
      });
      return;
    }

    // Get plan name from price metadata
    const price = await stripe.prices.retrieve(priceId);
    let planName = price.metadata.plan_name;

    if (!planName) {
      res.status(400).json({ 
        success: false,
        error: 'NO_PLAN_NAME',
        message: 'No plan name found in price metadata.' 
      });
      return;
    }

    // Normalize plan name to match enum values (lowercase)
    planName = planName.toLowerCase().trim();

    // Validate plan name is a valid enum value
    const validPlans = ['free', 'basic', 'premium', 'enterprise', 'ultra'];
    if (!validPlans.includes(planName)) {
      logger.warn(`Plan name ${planName} not in valid plans, attempting to use as-is`);
      // Don't fail here - let the database error if it's truly invalid
    }

    // Check if database has a higher tier plan than Stripe (manual override)
    const stripePlanLevel = planHierarchy[planName] || 0;
    const dbPlanLevel = planHierarchy[currentDbPlan] || 0;
    
    // If database plan is higher than Stripe plan, preserve it (manual override)
    if (dbPlanLevel > stripePlanLevel) {
      logger.info(`User ${userId} has manually set plan ${currentDbPlan} (level ${dbPlanLevel}) which is higher than Stripe plan ${planName} (level ${stripePlanLevel}). Preserving database plan.`);
      
      // Still update subscription record, but don't change user plan
      // Check if subscription already exists
      const { data: existingSub } = await supabase
        .from('stripe_subscriptions')
        .select('id')
        .eq('stripe_subscription_id', subscription.id)
        .single();

      if (existingSub) {
        await supabase
          .from('stripe_subscriptions')
          .update({
            status: subscription.status,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', subscription.id);
      }

      res.json({
        success: true,
        message: `Subscription synced. Database plan ${currentDbPlan} preserved (higher than Stripe plan ${planName}).`,
        subscription: {
          plan_name: planName,
          status: subscription.status,
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        },
        preserved_plan: currentDbPlan,
        stripe_plan: planName
      });
      return;
    }
    
    logger.info(`Syncing subscription with plan name: ${planName} for user ${userId} (upgrading from ${currentDbPlan})`);

    // Get plan limits from database
    const { data: planRule } = await supabase
      .from('plan_rules')
      .select('monthly_generations_limit')
      .eq('plan_name', planName)
      .eq('is_active', true)
      .single();

    const monthlyLimit = planRule?.monthly_generations_limit || 10;

    // Update user profile - try to update subscription_plan separately to handle enum casting
    // First update other fields
    const { error: limitError } = await supabase
      .from('user_profiles')
      .update({
        monthly_generations_limit: monthlyLimit,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (limitError) {
      logger.error('Error updating user profile limits:', limitError);
      res.status(500).json({ 
        success: false,
        error: 'UPDATE_FAILED',
        message: `Failed to update user profile: ${limitError.message}` 
      });
      return;
    }

    // Update subscription_plan - try RPC function first, fallback to direct update
    let planError = null;
    const { error: rpcError } = await supabase.rpc('update_user_subscription_plan', {
      user_uuid: userId,
      new_plan: planName
    });

    if (rpcError) {
      // RPC function might not exist or failed - try direct update
      logger.warn('RPC function failed or not available, trying direct update:', {
        error: rpcError.message || rpcError,
        code: rpcError.code
      });
      const { error: directError } = await supabase
        .from('user_profiles')
        .update({
          subscription_plan: planName as any
        })
        .eq('id', userId);
      
      planError = directError;
    } else {
      // RPC succeeded - still need to update monthly limit separately
      const { error: limitUpdateError } = await supabase
        .from('user_profiles')
        .update({
          monthly_generations_limit: monthlyLimit,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);
      
      if (limitUpdateError) {
        logger.warn('Could not update monthly limit after RPC:', {
          error: limitUpdateError.message || limitUpdateError,
          code: limitUpdateError.code
        });
      }
    }

    if (planError) {
      logger.error('Error updating subscription_plan:', {
        error: planError,
        planName,
        validPlans: ['free', 'basic', 'premium', 'enterprise', 'ultra'],
        userId
      });
      
      // If enum casting fails, the subscription record will still be created
      // but the user profile won't be updated - log warning but continue
      logger.warn(`Could not update subscription_plan to ${planName} for user ${userId}. Error: ${planError.message}`);
      // Don't fail the entire sync - subscription record creation is more important
    } else {
      logger.info(`Successfully updated user ${userId} to plan ${planName}`);
    }

    // Check if subscription already exists
    const { data: existingSub } = await supabase
      .from('stripe_subscriptions')
      .select('id')
      .eq('stripe_subscription_id', subscription.id)
      .single();

    if (existingSub) {
      // Update existing subscription
      const { error: updateSubError } = await supabase
        .from('stripe_subscriptions')
        .update({
          status: subscription.status,
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          cancel_at_period_end: subscription.cancel_at_period_end,
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_subscription_id', subscription.id);

      if (updateSubError) {
        logger.error('Error updating subscription:', updateSubError);
        res.status(500).json({ 
          success: false,
          error: 'UPDATE_FAILED',
          message: `Failed to update subscription record: ${updateSubError.message}` 
        });
        return;
      }
      logger.info(`Updated existing subscription ${subscription.id} for user ${userId}`);
    } else {
      // Create new subscription record
      // Try using RPC function first if it exists, otherwise direct insert
      let insertError = null;
      
      // Try RPC function first (handles enum casting properly)
      const { error: rpcError } = await supabase.rpc('create_stripe_subscription', {
        p_user_id: userId,
        p_stripe_subscription_id: subscription.id,
        p_stripe_customer_id: userProfile.stripe_customer_id,
        p_stripe_price_id: priceId,
        p_plan_name: planName,
        p_status: subscription.status,
        p_current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        p_current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        p_cancel_at_period_end: subscription.cancel_at_period_end || false
      });
      
      if (!rpcError) {
        insertError = null; // Success with RPC function
        logger.info(`Successfully created subscription via RPC function`);
      } else {
        // RPC function doesn't exist or failed, try direct insert with subscription_plan enum
        logger.warn('RPC function not available or failed, trying direct insert with enum cast', {
          error: rpcError.message || rpcError,
          code: rpcError.code
        });
        
        const { error: enumInsertError } = await supabase
          .from('stripe_subscriptions')
          .insert({
            user_id: userId,
            stripe_subscription_id: subscription.id,
            stripe_customer_id: userProfile.stripe_customer_id,
            stripe_price_id: priceId,
            plan_name: planName, // Use plan_name TEXT column
            status: subscription.status,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        
        if (!enumInsertError) {
          insertError = null; // Success with enum column
          logger.info(`Successfully created subscription with direct enum cast`);
        } else {
          insertError = enumInsertError;
          logger.error('Direct insert with enum also failed:', enumInsertError);
        }
      }

      if (insertError) {
        logger.error('Error creating subscription:', insertError);
        res.status(500).json({ 
          success: false,
          error: 'CREATE_FAILED',
          message: `Failed to create subscription record: ${insertError.message}` 
        });
        return;
      }
      logger.info(`Created new subscription ${subscription.id} for user ${userId}`);
    }

    logger.info(`Manually synced subscription for user ${userId} to plan ${planName}`);

    res.json({
      success: true,
      message: 'Subscription synced successfully',
      subscription: {
        plan_name: planName,
        status: subscription.status,
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      }
    });
  } catch (error) {
    logger.error('Error syncing subscription:', error as Error);
    throw error;
  }
}));

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

    // Update local database to reflect cancellation
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (immediately) {
      updateData.status = 'canceled';
      updateData.cancel_at_period_end = false;
    } else {
      updateData.cancel_at_period_end = true;
      // Status remains 'active' until period ends
    }

    const { error: updateError } = await supabase
      .from('stripe_subscriptions')
      .update(updateData)
      .eq('stripe_subscription_id', subscription.stripe_subscription_id);

    if (updateError) {
      logger.error('Error updating subscription in database after cancellation:', updateError);
      // Don't fail the request - Stripe was updated successfully
    } else {
      logger.info(`Subscription ${subscription.stripe_subscription_id} cancelled and database updated for user ${userId}`);
    }

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
 * Sync all plans with Stripe from database (Admin only)
 * POST /stripe/sync-plans
 * Creates products and prices for all active plans in the database
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

    // Sync all plans from database
    const syncResult = await stripeCheckoutService.syncAllPlansWithStripe();

    return res.json({
      success: syncResult.success,
      synced: syncResult.synced,
      failed: syncResult.failed,
      results: syncResult.results,
      message: `Synced ${syncResult.synced} plans with Stripe${syncResult.failed > 0 ? `, ${syncResult.failed} failed` : ''}`
    });
  } catch (error) {
    logger.error('Error syncing plans with Stripe:', error as Error);
    return res.status(500).json({ 
      error: 'Failed to sync plans with Stripe',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Delete a Stripe Connect account
 * DELETE /stripe/account/:accountId
 */
router.delete('/account/:accountId', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { accountId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    if (!accountId) {
      return res.status(400).json({ error: 'Account ID is required' });
    }

    // Optional: Add admin-only access by uncommenting below
    // const { data: user } = await supabase
    //   .from('user_profiles')
    //   .select('role')
    //   .eq('id', userId)
    //   .single();
    // if (!user || !['admin', 'super_admin'].includes(user.role)) {
    //   return res.status(403).json({ error: 'Admin access required' });
    // }

    const deletedAccount = await stripeCheckoutService.deleteAccount(accountId);

    logger.info(`Account ${accountId} deleted by user ${userId}`);

    return res.json({
      success: true,
      account: deletedAccount,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting Stripe account:', error as Error);
    
    // Handle Stripe-specific errors
    const stripeError = error as any;
    if (stripeError?.type === 'StripeInvalidRequestError') {
      return res.status(400).json({ 
        success: false,
        error: stripeError.message || 'Invalid account ID or account not found',
        details: stripeError.raw || null
      });
    }
    
    // Return more detailed error information
    return res.status(500).json({ 
      success: false,
      error: 'Failed to delete Stripe account',
      message: (error as Error).message,
      details: stripeError?.raw || null
    });
  }
});

/**
 * Verify Stripe checkout session (for payment success page)
 * GET /stripe/verify-session
 */
router.get('/verify-session', asyncHandler(async (req: express.Request, res) => {
  const sessionId = req.query.session_id as string;

  if (!sessionId) {
    res.status(400).json({
      success: false,
      error: 'INVALID_REQUEST',
      message: 'Session ID is required'
    });
    return;
  }

  try {
    // Retrieve the session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['customer', 'customer_details']
    });

    if (!session) {
      res.status(404).json({
        success: false,
        error: 'SESSION_NOT_FOUND',
        message: 'Payment session not found'
      });
      return;
    }

    // Check if payment was successful
    if (session.payment_status !== 'paid') {
      res.status(400).json({
        success: false,
        error: 'PAYMENT_NOT_COMPLETED',
        message: 'Payment has not been completed',
        payment_status: session.payment_status
      });
      return;
    }

    // Extract customer email
    const customerEmail = session.customer_email || 
                         (typeof session.customer_details === 'object' && session.customer_details?.email) ||
                         (typeof session.customer === 'object' && (session.customer as any)?.email) ||
                         null;

    res.json({
      success: true,
      session: {
        id: session.id,
        payment_status: session.payment_status,
        amount_total: session.amount_total,
        currency: session.currency,
        customer_email: customerEmail,
        metadata: session.metadata || {}
      },
      customer_email: customerEmail
    });
  } catch (error) {
    logger.error('Error verifying checkout session:', error as Error);
    res.status(500).json({
      success: false,
      error: 'VERIFICATION_FAILED',
      message: error instanceof Error ? error.message : 'Failed to verify payment session'
    });
  }
}));

/**
 * Add credits from a Stripe checkout session (for guest users after account creation)
 * POST /stripe/add-credits-from-session
 */
router.post('/add-credits-from-session', asyncHandler(async (req: express.Request, res) => {
  const { sessionId, userId } = req.body;

  if (!sessionId || !userId) {
    res.status(400).json({
      success: false,
      error: 'INVALID_REQUEST',
      message: 'Session ID and User ID are required'
    });
    return;
  }

  try {
    // Retrieve the session from Stripe to verify payment
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['customer', 'customer_details']
    });

    if (!session || session.payment_status !== 'paid') {
      res.status(400).json({
        success: false,
        error: 'INVALID_SESSION',
        message: 'Payment session not found or payment not completed'
      });
      return;
    }

    // Check if payment type is one-time
    const paymentType = session.metadata?.payment_type;
    if (paymentType !== 'one_time') {
      res.status(400).json({
        success: false,
        error: 'INVALID_PAYMENT_TYPE',
        message: 'This endpoint is only for one-time payments'
      });
      return;
    }

    // Get credits from metadata
    const credits = parseInt(session.metadata?.credits || '0', 10);
    const description = session.metadata?.description || 'One-time payment';
    const offerType = session.metadata?.offer_type || 'credits';
    const amount = parseFloat(session.metadata?.amount || '0');
    
    // Determine subscription plan and credits to add
    // DIY 800 ($27, 800 credits) -> 'explorer'
    // A la carte ($47, 2500 credits) -> 'a_la_carte'
    let planName: string | null = null;
    let creditsToAdd = credits; // Default to credits from metadata
    
    if (offerType === 'credits' && amount === 27 && credits === 800) {
      planName = 'explorer';
    } else if (offerType === 'videos' && amount === 47) {
      planName = 'a_la_carte';
      // A la carte purchase always includes 2500 credits
      creditsToAdd = 2500;
    }

    if (creditsToAdd <= 0) {
      res.status(400).json({
        success: false,
        error: 'NO_CREDITS',
        message: 'No credits found in payment session'
      });
      return;
    }

    // Check if credits were already added for this session
    const { data: existingTransaction } = await supabase
      .from('credit_transactions')
      .select('id')
      .eq('stripe_session_id', sessionId)
      .eq('user_id', userId)
      .single();

    if (existingTransaction) {
      res.json({
        success: true,
        message: 'Credits already added for this session',
        credits: creditsToAdd
      });
      return;
    }

    // Update subscription_plan if we identified a plan
    if (planName) {
      try {
        const { error: planUpdateError } = await supabase.rpc('update_user_subscription_plan', {
          user_uuid: userId,
          new_plan: planName
        });

        if (planUpdateError) {
          logger.warn(`Failed to update subscription_plan to ${planName}, trying direct update:`, {
            error: planUpdateError.message,
            code: planUpdateError.code,
            details: planUpdateError.details,
            hint: planUpdateError.hint
          });
          // Fallback: direct update
          const { error: directUpdateError } = await supabase
            .from('user_profiles')
            .update({
              subscription_plan: planName as any,
              updated_at: new Date().toISOString()
            })
            .eq('id', userId);

          if (directUpdateError) {
            logger.error(`Error updating subscription_plan to ${planName}:`, {
              error: directUpdateError.message,
              code: directUpdateError.code,
              details: directUpdateError.details,
              hint: directUpdateError.hint
            });
          } else {
            logger.info(`Successfully updated subscription_plan to ${planName} for user ${userId}`);
          }
        } else {
          logger.info(`Successfully updated subscription_plan to ${planName} for user ${userId}`);
        }
      } catch (planError) {
        logger.error('Error updating subscription_plan:', planError as Error);
        // Don't fail - continue processing credits
      }
    }

    // Add credits using RPC function or direct insert
    // Use creditsToAdd (which may be overridden for A la carte)
    try {
      // Try RPC function first
      const { error: rpcError } = await supabase.rpc('add_prepaid_credits', {
        p_user_id: userId,
        p_credits: creditsToAdd,
        p_description: `One-time payment: ${description}`,
        p_stripe_session_id: sessionId,
        p_stripe_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : null,
        p_expires_at: null
      });

      if (rpcError) {
        logger.warn('RPC function not available, trying direct insert:', {
          error: rpcError.message,
          code: rpcError.code,
          details: rpcError.details,
          hint: rpcError.hint
        });
        
        // Fallback: direct insert
        const { data: currentBalanceData } = await supabase
          .from('credit_transactions')
          .select('credits, expires_at')
          .eq('user_id', userId);
        
        const currentBalance = (currentBalanceData || []).reduce((sum, t) => {
          // Only count non-expired credits
          if (!t.expires_at || new Date(t.expires_at) > new Date()) {
            return sum + (t.credits || 0);
          }
          return sum;
        }, 0);
        const newBalance = currentBalance + creditsToAdd;

        const { error: insertError } = await supabase
          .from('credit_transactions')
          .insert({
            user_id: userId,
            transaction_type: 'purchase',
            credits: creditsToAdd,
            balance_after: newBalance,
            description: `One-time payment: ${description}`,
            stripe_session_id: sessionId,
            stripe_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : null,
            expires_at: null
          });

        if (insertError) {
          throw insertError;
        }
      }

      logger.info(`Successfully added ${creditsToAdd} credits to user ${userId} from session ${sessionId}`);

      res.json({
        success: true,
        message: 'Credits added successfully',
        credits: creditsToAdd
      });
    } catch (creditError) {
      logger.error('Error adding credits:', creditError as Error);
      res.status(500).json({
        success: false,
        error: 'CREDIT_ADD_FAILED',
        message: 'Failed to add credits to account'
      });
      return;
    }
  } catch (error) {
    logger.error('Error adding credits from session:', error as Error);
    res.status(500).json({
      success: false,
      error: 'VERIFICATION_FAILED',
      message: error instanceof Error ? error.message : 'Failed to process credit addition'
    });
  }
}));

/**
 * Get user's credit balance including prepaid credits
 * GET /stripe/credit-balance
 */
router.get('/credit-balance', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED',
      message: 'User authentication required'
    });
    return;
  }

  try {
    // Get prepaid credits from credit_transactions
    let prepaidCredits = 0;
    try {
      const { data: prepaidBalance, error: prepaidError } = await supabase.rpc('get_user_prepaid_credit_balance', {
        p_user_id: userId
      });

      if (!prepaidError && prepaidBalance !== null && prepaidBalance !== undefined) {
        prepaidCredits = prepaidBalance;
      } else if (prepaidError) {
        // Fallback: calculate manually
        const now = new Date().toISOString();
        const { data: transactions } = await supabase
          .from('credit_transactions')
          .select('credits, expires_at')
          .eq('user_id', userId)
          .or(`expires_at.is.null,expires_at.gt.${now}`);
        
        if (transactions) {
          prepaidCredits = transactions.reduce((sum, t) => {
            if (!t.expires_at || new Date(t.expires_at) > new Date()) {
              return sum + (t.credits || 0);
            }
            return sum;
          }, 0);
        }
      }
    } catch (err) {
      logger.warn('Error fetching prepaid credits:', {
        error: err instanceof Error ? err.message : String(err)
      });
    }

    // Get user profile for plan info
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('subscription_plan, monthly_generations_limit')
      .eq('id', userId)
      .single();

    const planName = userProfile?.subscription_plan || 'free';
    const monthlyLimit = userProfile?.monthly_generations_limit || 0;

    res.json({
      success: true,
      prepaidCredits,
      monthlyLimit,
      subscriptionPlan: planName,
      totalAvailableCredits: monthlyLimit + prepaidCredits
    });
  } catch (error) {
    logger.error('Error fetching credit balance:', error as Error);
    res.status(500).json({
      success: false,
      error: 'FETCH_FAILED',
      message: 'Failed to fetch credit balance'
    });
  }
}));

export default router;
