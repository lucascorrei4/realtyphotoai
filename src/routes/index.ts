import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { ImageController } from '../controllers/imageController';
import {
  uploadMiddleware,
  uploadMultipleMiddleware,
  handleUploadError,
  validateUploadedFile,
  validateUploadedFiles,
} from '../middleware/uploadMiddleware';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticateToken, checkGenerationLimit, checkModelAccess } from '../middleware/authMiddleware';
import { config } from '../config';
import conversionEventService, {
  ConversionEventPayload,
  ConversionEventType,
} from '../services/conversionEventService';
import authRoutes from './auth';
import adminRoutes from './admin';
import userRoutes from './user';
// Stripe routes are registered directly in app.ts to avoid conflicts
// import stripeRoutes from './stripe';

const router = Router();
const imageController = new ImageController();

// Rate limiting
const createRateLimit = (windowMs: number, max: number): ReturnType<typeof rateLimit> =>
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

const isValidEventType = (value: unknown): value is ConversionEventType =>
  value === 'Lead' || value === 'CompleteRegistration';

const sanitizeConversionPayload = (input: unknown): Partial<ConversionEventPayload> => {
  if (!input || typeof input !== 'object') {
    return {};
  }

  const candidate = input as Record<string, unknown>;
  const sanitized: Partial<ConversionEventPayload> = {};

  if (typeof candidate.email === 'string') {
    sanitized.email = candidate.email;
  }

  if (typeof candidate.firstName === 'string') {
    sanitized.firstName = candidate.firstName;
  }

  if (typeof candidate.lastName === 'string') {
    sanitized.lastName = candidate.lastName;
  }

  if (typeof candidate.phone === 'string') {
    sanitized.phone = candidate.phone;
  }

  if (typeof candidate.ip === 'string') {
    sanitized.ip = candidate.ip;
  }

  if (typeof candidate.userAgent === 'string') {
    sanitized.userAgent = candidate.userAgent;
  }

  if (typeof candidate.fbp === 'string') {
    sanitized.fbp = candidate.fbp;
  }

  if (typeof candidate.fbc === 'string') {
    sanitized.fbc = candidate.fbc;
  }

  if (typeof candidate.createdAt === 'string') {
    sanitized.createdAt = candidate.createdAt;
  }

  if (typeof candidate.amount === 'number' && Number.isFinite(candidate.amount)) {
    sanitized.amount = candidate.amount;
  }

  if (typeof candidate.currency === 'string') {
    sanitized.currency = candidate.currency;
  }

  if (typeof candidate.eventIdOverride === 'string') {
    sanitized.eventIdOverride = candidate.eventIdOverride;
  }

  if (typeof candidate.actionSource === 'string') {
    sanitized.actionSource = candidate.actionSource;
  }

  if (typeof candidate.eventSourceUrl === 'string') {
    sanitized.eventSourceUrl = candidate.eventSourceUrl;
  }

  if (typeof candidate.externalId === 'string') {
    sanitized.externalId = candidate.externalId;
  }

  if (typeof candidate.utmSource === 'string') {
    sanitized.utmSource = candidate.utmSource;
  }

  if (typeof candidate.utmMedium === 'string') {
    sanitized.utmMedium = candidate.utmMedium;
  }

  if (typeof candidate.utmCampaign === 'string') {
    sanitized.utmCampaign = candidate.utmCampaign;
  }

  if (typeof candidate.utmContent === 'string') {
    sanitized.utmContent = candidate.utmContent;
  }

  if (typeof candidate.utmTerm === 'string') {
    sanitized.utmTerm = candidate.utmTerm;
  }

  return sanitized;
};

// Health check endpoint (no rate limit)
router.get('/health', asyncHandler(imageController.health));

// Test endpoint
router.get('/test', generalRateLimit, asyncHandler(imageController.test));

router.post(
  '/conversion-events/test',
  generalRateLimit,
  asyncHandler(async (req, res) => {
    const eventTypeInput = req.body?.event;
    const payloadOverrides = sanitizeConversionPayload(req.body?.payload);

    const event: ConversionEventType = isValidEventType(eventTypeInput) ? eventTypeInput : 'Lead';

    const result = await conversionEventService.sendTestConversionEvent(event, payloadOverrides);

    const statusCode = result.success
      ? 200
      : result.status && result.status >= 400
        ? result.status
        : 502;

    res.status(statusCode).json({
      success: result.success,
      event: result.event,
      webhookUrl: result.webhookUrl,
      status: result.status,
      statusText: result.statusText,
      durationMs: result.durationMs,
      timestamp: result.timestamp,
      requestBody: result.requestBody,
      responseBody: result.responseBody ?? null,
      rawResponseBody: result.rawResponseBody ?? null,
      errorMessage: result.errorMessage ?? null,
    });
  }),
);

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
  authenticateToken,
  checkGenerationLimit,
  checkModelAccess('interior_design'),
  processingRateLimit,
  uploadMiddleware.single('image'),
  handleUploadError,
  validateUploadedFile,
  asyncHandler(imageController.processImage)
);

// Interior design processing endpoint
router.post('/interior-design', 
  authenticateToken,
  checkGenerationLimit,
  checkModelAccess('interior_design'),
  processingRateLimit,
  uploadMiddleware.single('image'),
  handleUploadError,
  validateUploadedFile,
  asyncHandler(imageController.processImageWithInteriorDesign)
);

// Image enhancement endpoint
router.get('/image-enhancement', 
  generalRateLimit,
  asyncHandler(imageController.getImageEnhancementInfo)
);

router.post('/image-enhancement', 
  authenticateToken,
  checkGenerationLimit,
  checkModelAccess('image_enhancement'),
  processingRateLimit,
  uploadMultipleMiddleware.fields([
    { name: 'image', maxCount: 20 },
    { name: 'referenceImage', maxCount: 1 }
  ]),
  validateUploadedFiles,
  handleUploadError,
  asyncHandler(imageController.enhanceImage)
);

// Element replacement endpoint
router.post('/replace-elements', 
  authenticateToken,
  checkGenerationLimit,
  checkModelAccess('element_replacement'),
  processingRateLimit,
  uploadMultipleMiddleware.fields([
    { name: 'image', maxCount: 1 }
  ]),
  validateUploadedFiles,
  handleUploadError,
  asyncHandler(imageController.replaceElements)
);

// Add furnitures endpoint
router.post('/add-furnitures', 
  authenticateToken,
  checkGenerationLimit,
  checkModelAccess('add_furnitures'),
  processingRateLimit,
  uploadMultipleMiddleware.fields([
    { name: 'roomImage', maxCount: 1 },
    { name: 'furnitureImage', maxCount: 1 }
  ]),
  validateUploadedFiles,
  handleUploadError,
  asyncHandler(imageController.addFurnitures)
);

// Exterior design endpoint
router.post('/exterior-design', 
  authenticateToken,
  checkGenerationLimit,
  checkModelAccess('exterior_design'),
  processingRateLimit,
  uploadMiddleware.single('buildingImage'),
  validateUploadedFile,
  handleUploadError,
  asyncHandler(imageController.exteriorDesign)
);

// HEIC conversion endpoint for preview
router.post('/convert-heic', 
  uploadMiddleware.single('image'),
  handleUploadError,
  asyncHandler(imageController.convertHeic)
);

// Image download proxy endpoint (bypasses CORS)
router.get('/proxy-image', 
  authenticateToken,
  asyncHandler(imageController.proxyImageDownload)
);

// Authentication routes
router.use('/auth', authRoutes);

// Admin routes
router.use('/admin', adminRoutes);

// User routes
router.use('/user', userRoutes);

// Note: Stripe routes are registered directly in app.ts to avoid conflicts
// router.use('/stripe', stripeRoutes);

export default router; 