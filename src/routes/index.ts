import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { ImageController } from '../controllers/imageController';
import { uploadMiddleware, handleUploadError, validateUploadedFile } from '../middleware/uploadMiddleware';
import { asyncHandler } from '../middleware/errorHandler';
import { config } from '../config';

const router = Router();
const imageController = new ImageController();

// Rate limiting
const createRateLimit = (windowMs: number, max: number) => 
  rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      message: 'Too many requests, please try again later',
      error: 'RATE_LIMIT_EXCEEDED',
      timestamp: new Date().toISOString(),
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

// General rate limit
const generalRateLimit = createRateLimit(config.rateLimitWindowMs, config.rateLimitMaxRequests);

// Stricter rate limit for processing endpoints
const processingRateLimit = createRateLimit(15 * 60 * 1000, 10); // 10 requests per 15 minutes

// Health check endpoint (no rate limit)
router.get('/health', asyncHandler(imageController.health));

// Test endpoint
router.get('/test', generalRateLimit, asyncHandler(imageController.test));

// Model information
router.get('/model-info', generalRateLimit, asyncHandler(imageController.getModelInfo));

// Quality presets
router.get('/quality-presets', generalRateLimit, asyncHandler(imageController.getQualityPresets));

// Configuration endpoint
router.get('/config', generalRateLimit, asyncHandler(imageController.getConfig));

// Recommendations endpoint
router.get('/recommendations', generalRateLimit, asyncHandler(imageController.getRecommendations));

// File upload endpoint (for testing)
router.post('/upload', 
  generalRateLimit,
  uploadMiddleware.single('image'),
  handleUploadError,
  validateUploadedFile,
  asyncHandler(imageController.uploadFile)
);

// Main image processing endpoint
router.post('/process-image', 
  processingRateLimit,
  uploadMiddleware.single('image'),
  handleUploadError,
  validateUploadedFile,
  asyncHandler(imageController.processImage)
);

export default router; 