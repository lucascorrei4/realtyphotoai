import { Request, Response, NextFunction } from 'express';
import authService from '../services/authService';
import { logger } from '../utils/logger';
import { supabase } from '../config/supabase';
import planRulesService from '../services/planRulesService';
import { getImageCredits, getVideoCredits } from '../config/subscriptionPlans';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    subscription_plan: string;
  };
}

/**
 * Middleware to authenticate JWT tokens or Supabase access tokens
 */
export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({ error: 'Access token required' });
      return;
    }

    // First try to verify as JWT token
    let decoded = authService.verifyToken(token);

    if (!decoded) {
      // If JWT verification fails, try to verify as Supabase token
      try {
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
          res.status(403).json({ error: 'Invalid or expired token' });
          return;
        }

        // Get user profile from database
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profileError || !profile) {
          // Profile doesn't exist, create one
          try {
            const { data: newProfile, error: createError } = await supabase
              .from('user_profiles')
              .insert({
                id: user.id,
                email: user.email,
                role: 'user',
                subscription_plan: 'free',
                monthly_generations_limit: 10,
                total_generations: 0,
                successful_generations: 0,
                failed_generations: 0,
                is_active: true
              })
              .select()
              .single();

            if (createError || !newProfile) {
              logger.error('Failed to create user profile:', createError as Error);
              res.status(500).json({ error: 'Failed to create user profile' });
              return;
            }

            decoded = {
              id: newProfile.id,
              email: newProfile.email,
              role: newProfile.role,
              subscription_plan: newProfile.subscription_plan
            };
          } catch (createProfileError) {
            logger.error('Error creating user profile:', createProfileError as Error);
            res.status(500).json({ error: 'Failed to create user profile' });
            return;
          }
        } else {
          // Profile exists, use it
          decoded = {
            id: profile.id,
            email: profile.email,
            role: profile.role,
            subscription_plan: profile.subscription_plan
          };
        }
      } catch (supabaseError) {
        logger.error('Supabase token verification failed:', supabaseError as Error);
        res.status(403).json({ error: 'Invalid or expired token' });
        return;
      }
    }

    // Add user info to request
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      subscription_plan: decoded.subscription_plan
    };

    next();
  } catch (error) {
    logger.error('Authentication error:', error as Error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

/**
 * Middleware to require admin role
 */
export const requireAdmin = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  next();
};

/**
 * Middleware to require super admin role
 */
export const requireSuperAdmin = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  if (req.user.role !== 'super_admin') {
    res.status(403).json({ error: 'Super admin access required' });
    return;
  }

  next();
};

/**
 * Middleware to check user generation limits and credits
 */
export const checkGenerationLimit = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ 
        success: false,
        error: 'Authentication required',
        message: 'Please log in to continue'
      });
      return;
    }

    // Get user profile to check limits
    const userProfile = await authService.getUserProfile(req.user.id);
    if (!userProfile) {
      res.status(404).json({ 
        success: false,
        error: 'User profile not found',
        message: 'User profile not found'
      });
      return;
    }

    // Check if user is active
    if (!userProfile.is_active) {
      res.status(403).json({ 
        success: false,
        error: 'Account is deactivated',
        message: 'Your account has been deactivated'
      });
      return;
    }

    // Check monthly generation limit (count-based)
    const monthlyUsage = await authService.getUserStatistics(req.user.id);
    if (monthlyUsage && monthlyUsage.monthly_usage >= userProfile.monthly_generations_limit) {
      res.status(429).json({
        success: false,
        error: 'Monthly generation limit reached',
        message: `You've reached your monthly generation limit of ${userProfile.monthly_generations_limit}`,
        limit: userProfile.monthly_generations_limit,
        usage: monthlyUsage.monthly_usage
      });
      return;
    }

    // Check subscription validity for paid plans
    // Users with cancelled subscriptions should still have access until period ends
    const planName = req.user.subscription_plan || 'free';
    if (planName !== 'free') {
      const { data: subscriptions, error: subscriptionError } = await supabase
        .from('stripe_subscriptions')
        .select('status, cancel_at_period_end, current_period_end')
        .eq('user_id', req.user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      // If there's a subscription record, check its validity
      if (!subscriptionError && subscriptions && subscriptions.length > 0) {
        const subscription = subscriptions[0];
        const now = new Date();
        const periodEnd = subscription.current_period_end 
          ? new Date(subscription.current_period_end) 
          : null;

        // Check if subscription is valid:
        // 1. Status is 'active' AND
        // 2. Either not cancelled OR cancelled but period hasn't ended yet
        const isSubscriptionValid = 
          subscription.status === 'active' && 
          (!subscription.cancel_at_period_end || (periodEnd && periodEnd > now));

        if (!isSubscriptionValid) {
          // If subscription is cancelled and period has ended, block access
          if (subscription.cancel_at_period_end && periodEnd && periodEnd <= now) {
            res.status(403).json({
              success: false,
              error: 'Subscription expired',
              message: 'Your subscription has expired. Please renew to continue using the platform.',
              periodEnd: periodEnd.toISOString()
            });
            return;
          }
          // If subscription status is not active, block access
          if (subscription.status !== 'active') {
            res.status(403).json({
              success: false,
              error: 'Subscription not active',
              message: 'Your subscription is not active. Please check your subscription status.',
              status: subscription.status
            });
            return;
          }
        }
      }
      // If no subscription record found for a paid plan, allow access
      // (This might happen during plan transitions or for legacy users)
    }

    // Check credits before allowing generation
    const userPlan = await planRulesService.getUserSubscriptionPlan(planName);
    
    if (!userPlan) {
      logger.warn(`Plan not found for user ${req.user.id}, plan: ${planName}`);
      res.status(500).json({
        success: false,
        error: 'Plan configuration error',
        message: 'Unable to verify your subscription plan'
      });
      return;
    }

    // Get display credits total from plan
    const displayCreditsTotal = userPlan.features?.displayCredits || userPlan.features?.monthlyCredits || 0;

    // Calculate credits used this month (in display credits)
    const now = new Date();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const { data: generations, error: generationsError } = await supabase
      .from('generations')
      .select('generation_type, duration_seconds')
      .eq('user_id', req.user.id)
      .eq('status', 'completed')
      .gte('created_at', currentMonth.toISOString());

    if (generationsError) {
      logger.error('Error fetching generations for credit check:', generationsError);
      res.status(500).json({
        success: false,
        error: 'Failed to check credits',
        message: 'Unable to verify credit balance'
      });
      return;
    }

    // Calculate credits used (in display credits)
    let displayCreditsUsed = 0;
    (generations || []).forEach((generation) => {
      if (generation.generation_type === 'video' && generation.duration_seconds) {
        displayCreditsUsed += getVideoCredits(generation.duration_seconds);
      } else {
        // All other generations are images
        displayCreditsUsed += getImageCredits(1);
      }
    });

    // Determine credits needed for this request
    // Check if it's a video generation request
    const isVideoRequest = req.body?.motionType || req.path?.includes('video');
    const durationSeconds = req.body?.options?.duration || req.body?.duration || 6; // Default 6 seconds for video
    const creditsNeeded = isVideoRequest 
      ? getVideoCredits(durationSeconds)
      : getImageCredits(1);

    // Check if user has enough credits
    const displayCreditsRemaining = displayCreditsTotal - displayCreditsUsed;
    
    if (displayCreditsRemaining < creditsNeeded) {
      res.status(402).json({
        success: false,
        error: 'Insufficient credits',
        message: `You don't have enough credits. You need ${creditsNeeded} credits but only have ${Math.max(0, displayCreditsRemaining)} remaining.`,
        creditsNeeded,
        creditsRemaining: Math.max(0, displayCreditsRemaining),
        creditsTotal: displayCreditsTotal,
        creditsUsed: displayCreditsUsed
      });
      return;
    }

    next();
  } catch (error) {
    logger.error('Generation limit check error:', error as Error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to check generation limits',
      message: 'An error occurred while checking your limits'
    });
  }
};

/**
 * Middleware to check if user can access specific AI model
 */
export const checkModelAccess = (modelType: string) => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      // Get user profile to check model access
      const userProfile = await authService.getUserProfile(req.user.id);
      if (!userProfile) {
        res.status(404).json({ error: 'User profile not found' });
        return;
      }

      // Check if user's plan allows this model
      // This would typically check against plan_rules table
      // For now, we'll implement basic checks
      const allowedModels = {
        'free': ['image_enhancement', 'interior_design', 'exterior_design', 'element_replacement', 'add_furnitures', 'smart_effects', 'video_generation'],
        'basic': ['image_enhancement', 'interior_design', 'exterior_design', 'element_replacement', 'add_furnitures', 'smart_effects', 'video_generation'],
        'premium': ['image_enhancement', 'interior_design', 'exterior_design', 'element_replacement', 'add_furnitures', 'smart_effects', 'video_generation'],
        'enterprise': ['image_enhancement', 'interior_design', 'exterior_design', 'element_replacement', 'add_furnitures', 'smart_effects', 'video_generation']
      };

      const userAllowedModels = allowedModels[userProfile.subscription_plan as keyof typeof allowedModels] || [];

      if (!userAllowedModels.includes(modelType)) {
        res.status(403).json({
          error: `Model '${modelType}' not available in your current plan`,
          currentPlan: userProfile.subscription_plan,
          allowedModels: userAllowedModels
        });
        return;
      }

      next();
    } catch (error) {
      logger.error('Model access check error:', error as Error);
      res.status(500).json({ error: 'Failed to check model access' });
    }
  };
};

export default {
  authenticateToken,
  requireAdmin,
  requireSuperAdmin,
  checkGenerationLimit,
  checkModelAccess
};
