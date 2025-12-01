import { Router } from 'express';
import { UserStatisticsService } from '../services/userStatisticsService';
import { asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import rateLimit from 'express-rate-limit';

const router = Router();
const userStatsService = new UserStatisticsService();

// Rate limiting for user endpoints
const userRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests, please try again later',
    error: 'RATE_LIMIT_EXCEEDED',
    timestamp: new Date().toISOString(),
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Get user generation statistics
 * GET /user/stats
 */
router.get('/stats', userRateLimit, asyncHandler(async (req, res) => {
  try {
    // TODO: Get actual user ID from authentication middleware
    // For now, we'll use a placeholder - this should be replaced with proper auth
    const userId = req.query.userId as string || req.headers['x-user-id'] as string;
    
    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'User ID is required',
        error: 'MISSING_USER_ID'
      });
      return;
    }

    const stats = await userStatsService.getUserGenerationStats(userId);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Error in user stats route:', error as Error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user statistics',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
}));

/**
 * Get user generations by model type
 * GET /user/generations/:modelType
 */
router.get('/generations/:modelType', userRateLimit, asyncHandler(async (req, res) => {
  try {
    const userId = req.query.userId as string || req.headers['x-user-id'] as string;
    const { modelType } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    
    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'User ID is required',
        error: 'MISSING_USER_ID'
      });
      return;
    }

    const generations = await userStatsService.getUserGenerationsByType(userId, modelType, limit);
    
    res.json({
      success: true,
      data: generations
    });
  } catch (error) {
    logger.error('Error in user generations by type route:', error as Error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user generations',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
}));

/**
 * Get recent user generations (all types) with pagination and filtering
 * GET /user/generations
 */
router.get('/generations', userRateLimit, asyncHandler(async (req, res) => {
  try {
    const userId = req.query.userId as string || req.headers['x-user-id'] as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    
    // Extract filters
    const filters = {
      modelType: req.query.modelType as string,
      status: req.query.status as string,
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string
    };
    
    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'User ID is required',
        error: 'MISSING_USER_ID'
      });
      return;
    }

    // Validate pagination parameters
    if (page < 1 || limit < 1 || limit > 100) {
      res.status(400).json({
        success: false,
        message: 'Invalid pagination parameters. Page must be >= 1, limit must be between 1 and 100',
        error: 'INVALID_PAGINATION_PARAMS'
      });
      return;
    }

    const result = await userStatsService.getUserGenerationsWithPagination(userId, page, limit, filters);
    
    logger.info(`[UserGenerations] Fetched ${result.generations.length} generations for user ${userId} (Total: ${result.totalCount})`);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Error in user recent generations route (getUserGenerationsByType):', error as Error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recent generations by type (getUserGenerationsByType)',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
}));

/**
 * Create a new generation record
 * POST /user/generations
 */
router.post('/generations', userRateLimit, asyncHandler(async (req, res) => {
  try {
    const userId = req.body.userId || req.headers['x-user-id'];
    const { modelType, status, inputImageUrl, prompt } = req.body;
    
    if (!userId || !modelType || !status) {
      res.status(400).json({
        success: false,
        message: 'User ID, model type, and status are required',
        error: 'MISSING_REQUIRED_FIELDS'
      });
      return;
    }

    const generationId = await userStatsService.createGenerationRecord({
      user_id: userId,
      model_type: modelType,
      status,
      input_image_url: inputImageUrl,
      prompt
    });
    
    res.json({
      success: true,
      data: { generationId }
    });
      } catch (error) {
      logger.error('Error in create generation record route:', error as Error);
      res.status(500).json({
        success: false,
        message: 'Failed to create generation record',
        error: 'INTERNAL_SERVER_ERROR'
      });
    }
}));

/**
 * Update generation status
 * PUT /user/generations/:generationId
 */
router.put('/generations/:generationId', userRateLimit, asyncHandler(async (req, res) => {
  try {
    const { generationId } = req.params;
    const { status, outputImageUrl, errorMessage, processingTimeMs } = req.body;
    
    if (!status) {
      res.status(400).json({
        success: false,
        message: 'Status is required',
        error: 'MISSING_STATUS'
      });
      return;
    }

    await userStatsService.updateGenerationStatus(
      generationId,
      status,
      outputImageUrl,
      errorMessage,
      processingTimeMs
    );
    
    res.json({
      success: true,
      message: 'Generation status updated successfully'
    });
  } catch (error) {
    logger.error('Error in update generation status route:', error as Error);
    res.status(500).json({
      success: false,
      message: 'Failed to update generation status',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
}));

/**
 * Soft delete a generation
 * DELETE /user/generations/:generationId
 */
router.delete('/generations/:generationId', userRateLimit, asyncHandler(async (req, res) => {
  try {
    const { generationId } = req.params;
    const userId = req.query.userId as string || req.headers['x-user-id'] as string;
    
    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'User ID is required',
        error: 'MISSING_USER_ID'
      });
      return;
    }

    await userStatsService.softDeleteGeneration(generationId, userId);
    
    res.json({
      success: true,
      message: 'Generation deleted successfully'
    });
  } catch (error) {
    logger.error('Error in delete generation route:', error as Error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Check if it's an authorization error
    if (errorMessage.includes('Unauthorized') || errorMessage.includes('not found')) {
      res.status(404).json({
        success: false,
        message: errorMessage,
        error: 'GENERATION_NOT_FOUND'
      });
      return;
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to delete generation',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
}));

export default router;
