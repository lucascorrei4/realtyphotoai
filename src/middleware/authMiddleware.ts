import { Request, Response, NextFunction } from 'express';
import authService from '../services/authService';
import { logger } from '../utils/logger';
import { supabase } from '../config/supabase';

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
 * Middleware to check user generation limits
 */
export const checkGenerationLimit = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Get user profile to check limits
    const userProfile = await authService.getUserProfile(req.user.id);
    if (!userProfile) {
      res.status(404).json({ error: 'User profile not found' });
      return;
    }

    // Check if user is active
    if (!userProfile.is_active) {
      res.status(403).json({ error: 'Account is deactivated' });
      return;
    }

    // Check monthly generation limit
    const monthlyUsage = await authService.getUserStatistics(req.user.id);
    if (monthlyUsage && monthlyUsage.monthly_usage >= userProfile.monthly_generations_limit) {
      res.status(429).json({
        error: 'Monthly generation limit reached',
        limit: userProfile.monthly_generations_limit,
        usage: monthlyUsage.monthly_usage
      });
      return;
    }

    next();
  } catch (error) {
    logger.error('Generation limit check error:', error as Error);
    res.status(500).json({ error: 'Failed to check generation limits' });
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
        'free': ['image_enhancement', 'interior_design', 'exterior_design', 'element_replacement', 'add_furnitures'],
        'basic': ['image_enhancement', 'interior_design', 'exterior_design', 'element_replacement', 'add_furnitures'],
        'premium': ['image_enhancement', 'interior_design', 'exterior_design', 'element_replacement', 'add_furnitures'],
        'enterprise': ['image_enhancement', 'interior_design', 'exterior_design', 'element_replacement', 'add_furnitures']
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
