import express from 'express';
import adminService from '../services/adminService';
import { authenticateToken, requireAdmin, requireSuperAdmin } from '../middleware/authMiddleware';
import { logger } from '../utils/logger';

const router = express.Router();

// All admin routes require authentication
router.use(authenticateToken);

/**
 * Get system statistics (admin only)
 * GET /admin/stats
 */
router.get('/stats', requireAdmin, async (_req, res) => {
  try {
    const stats = await adminService.getSystemStats();
    return res.json({
      success: true,
      stats
    });
  } catch (error) {
    logger.error('Error in admin stats route:', error as Error);
    return res.status(500).json({ error: 'Failed to fetch system statistics' });
  }
});

/**
 * Get all users (admin only)
 * GET /admin/users
 */
router.get('/users', requireAdmin, async (_req, res) => {
  try {
    const users = await adminService.getAllUsers();
    return res.json({
      success: true,
      users
    });
  } catch (error) {
    logger.error('Error in admin users route:', error as Error);
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/**
 * Get user by ID (admin only)
 * GET /admin/users/:userId
 */
router.get('/users/:userId', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await adminService.getUserById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({
      success: true,
      user
    });
  } catch (error) {
    logger.error('Error in admin user detail route:', error as Error);
    return res.status(500).json({ error: 'Failed to fetch user' });
  }
});

/**
 * Update user (admin only)
 * PUT /admin/users/:userId
 */
router.put('/users/:userId', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const updates = req.body;

    // Remove sensitive fields that shouldn't be updated via admin
    delete updates.id;
    delete updates.created_at;
    delete updates.updated_at;

    const success = await adminService.updateUser(userId, updates);
    
    if (success) {
      const updatedUser = await adminService.getUserById(userId);
      return res.json({
        success: true,
        message: 'User updated successfully',
        user: updatedUser
      });
    } else {
      return res.status(500).json({ error: 'Failed to update user' });
    }
  } catch (error) {
    logger.error('Error in admin user update route:', error as Error);
    return res.status(500).json({ error: 'Failed to update user' });
  }
});

/**
 * Toggle user status (admin only)
 * PATCH /admin/users/:userId/toggle-status
 */
router.patch('/users/:userId/toggle-status', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ error: 'isActive must be a boolean' });
    }

    const success = await adminService.toggleUserStatus(userId, isActive);
    
    if (success) {
      return res.json({
        success: true,
        message: `User ${isActive ? 'activated' : 'deactivated'} successfully`
      });
    } else {
      return res.status(500).json({ error: 'Failed to toggle user status' });
    }
  } catch (error) {
    logger.error('Error in admin toggle user status route:', error as Error);
    return res.status(500).json({ error: 'Failed to toggle user status' });
  }
});

/**
 * Change user subscription plan (admin only)
 * PATCH /admin/users/:userId/change-plan
 */
router.patch('/users/:userId/change-plan', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { newPlan } = req.body;

    if (!newPlan) {
      return res.status(400).json({ error: 'newPlan is required' });
    }

    const success = await adminService.changeUserPlan(userId, newPlan);
    
    if (success) {
      const updatedUser = await adminService.getUserById(userId);
      return res.json({
        success: true,
        message: `User plan changed to ${newPlan} successfully`,
        user: updatedUser
      });
    } else {
      return res.status(500).json({ error: 'Failed to change user plan' });
    }
  } catch (error) {
    logger.error('Error in admin change user plan route:', error as Error);
    return res.status(500).json({ error: 'Failed to change user plan' });
  }
});

/**
 * Get user generations (admin only)
 * GET /admin/users/:userId/generations
 */
router.get('/users/:userId/generations', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50 } = req.query;

    const generations = await adminService.getUserGenerations(userId, Number(limit));
    return res.json({
      success: true,
      generations
    });
  } catch (error) {
    logger.error('Error in admin user generations route:', error as Error);
    return res.status(500).json({ error: 'Failed to fetch user generations' });
  }
});

/**
 * Get all generations with pagination and filtering (admin only)
 * GET /admin/generations
 */
router.get('/generations', requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    
    // Extract filters
    const filters = {
      modelType: req.query.modelType as string,
      status: req.query.status as string,
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
      userId: req.query.userId as string
    };

    // Validate pagination parameters
    if (page < 1 || limit < 1 || limit > 100) {
      return res.status(400).json({
        success: false,
        message: 'Invalid pagination parameters. Page must be >= 1, limit must be between 1 and 100',
        error: 'INVALID_PAGINATION_PARAMS'
      });
    }

    const result = await adminService.getAllGenerations(page, limit, filters);
    
    logger.info(`[AdminGenerations] Fetched ${result.generations.length} generations (Total: ${result.total})`);
    
    return res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Error in admin generations route:', error as Error);
    return res.status(500).json({ 
      success: false,
      error: 'Failed to fetch generations' 
    });
  }
});

/**
 * Delete a generation (admin only - can delete any generation)
 * DELETE /admin/generations/:generationId
 */
router.delete('/generations/:generationId', requireAdmin, async (req, res) => {
  try {
    const { generationId } = req.params;

    const success = await adminService.deleteGeneration(generationId);
    
    if (success) {
      return res.json({
        success: true,
        message: 'Generation deleted successfully'
      });
    } else {
      return res.status(500).json({
        success: false,
        message: 'Failed to delete generation',
        error: 'DELETE_FAILED'
      });
    }
  } catch (error) {
    logger.error('Error in admin delete generation route:', error as Error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    if (errorMessage.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: errorMessage,
        error: 'GENERATION_NOT_FOUND'
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'Failed to delete generation',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * Get all admin settings (super admin only)
 * GET /admin/settings
 */
router.get('/settings', requireSuperAdmin, async (_req, res) => {
  try {
    const settings = await adminService.getAdminSettings();
    return res.json({
      success: true,
      settings
    });
  } catch (error) {
    logger.error('Error in admin settings route:', error as Error);
    return res.status(500).json({ error: 'Failed to fetch admin settings' });
  }
});

/**
 * Update admin setting (super admin only)
 * PUT /admin/settings/:settingKey
 */
router.put('/settings/:settingKey', requireSuperAdmin, async (req, res) => {
  try {
    const { settingKey } = req.params;
    const { value } = req.body;

    if (value === undefined) {
      return res.status(400).json({ error: 'value is required' });
    }

    const success = await adminService.updateAdminSetting(settingKey, value);
    
    if (success) {
      return res.json({
        success: true,
        message: 'Admin setting updated successfully'
      });
    } else {
      return res.status(500).json({ error: 'Failed to update admin setting' });
    }
  } catch (error) {
    logger.error('Error in admin update setting route:', error as Error);
    return res.status(500).json({ error: 'Failed to update admin setting' });
  }
});

/**
 * Get all plan rules (super admin only)
 * GET /admin/plans
 */
router.get('/plans', requireSuperAdmin, async (_req, res) => {
  try {
    const plans = await adminService.getPlanRules();
    return res.json({
      success: true,
      plans
    });
  } catch (error) {
    logger.error('Error in admin plans route:', error as Error);
    return res.status(500).json({ error: 'Failed to fetch plan rules' });
  }
});

/**
 * Create new plan rule (super admin only)
 * POST /admin/plans
 */
router.post('/plans', requireSuperAdmin, async (req, res) => {
  try {
    const planData = req.body;

    // Validate required fields
    if (!planData.plan_name || !planData.monthly_generations_limit || !planData.price_per_month) {
      return res.status(400).json({ error: 'plan_name, monthly_generations_limit, and price_per_month are required' });
    }

    const newPlan = await adminService.createPlanRule(planData);
    
    if (newPlan) {
      return res.json({
        success: true,
        message: 'Plan rule created successfully',
        plan: newPlan
      });
    } else {
      return res.status(500).json({ error: 'Failed to create plan rule' });
    }
  } catch (error) {
    logger.error('Error in admin create plan route:', error as Error);
    return res.status(500).json({ error: 'Failed to create plan rule' });
  }
});

/**
 * Update plan rule (super admin only)
 * PUT /admin/plans/:planId
 */
router.put('/plans/:planId', requireSuperAdmin, async (req, res) => {
  try {
    const { planId } = req.params;
    const updates = req.body;

    // Remove sensitive fields
    delete updates.id;
    delete updates.created_at;
    delete updates.updated_at;

    const success = await adminService.updatePlanRule(planId, updates);
    
    if (success) {
      return res.json({
        success: true,
        message: 'Plan rule updated successfully'
      });
    } else {
      return res.status(500).json({ error: 'Failed to update plan rule' });
    }
  } catch (error) {
    logger.error('Error in admin update plan route:', error as Error);
    return res.status(500).json({ error: 'Failed to update plan rule' });
  }
});

/**
 * Delete plan rule (super admin only)
 * DELETE /admin/plans/:planId
 */
router.delete('/plans/:planId', requireSuperAdmin, async (req, res) => {
  try {
    const { planId } = req.params;

    const success = await adminService.deletePlanRule(planId);
    
    if (success) {
      return res.json({
        success: true,
        message: 'Plan rule deleted successfully'
      });
    } else {
      return res.status(500).json({ error: 'Failed to delete plan rule' });
    }
  } catch (error) {
    logger.error('Error in admin delete plan route:', error as Error);
    return res.status(500).json({ error: 'Failed to delete plan rule' });
  }
});

/**
 * Get Stripe products and prices (super admin only)
 * GET /admin/stripe/products
 */
router.get('/stripe/products', requireSuperAdmin, async (_req, res) => {
  try {
    const stripeData = await adminService.getStripeProducts();
    return res.json({
      success: true,
      ...stripeData
    });
  } catch (error) {
    logger.error('Error in admin Stripe products route:', error as Error);
    return res.status(500).json({ error: 'Failed to fetch Stripe products' });
  }
});

/**
 * Sync Stripe plans with database (super admin only)
 * POST /admin/stripe/sync
 */
router.post('/stripe/sync', requireSuperAdmin, async (_req, res) => {
  try {
    const result = await adminService.syncStripePlans();
    
    if (result.success) {
      return res.json({
        success: true,
        message: result.message
      });
    } else {
      return res.status(500).json({ error: result.message });
    }
  } catch (error) {
    logger.error('Error in admin Stripe sync route:', error as Error);
    return res.status(500).json({ error: 'Failed to sync Stripe plans' });
  }
});

export default router;
