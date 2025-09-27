import multer from 'multer';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { FileUtils } from '../utils/fileUtils';
import { logger } from '../utils/logger';

// Storage configuration
const storage = multer.diskStorage({
  destination: async (_, __, cb) => {
    try {
      await FileUtils.ensureDirectoryExists(config.uploadDir);
      cb(null, config.uploadDir);
    } catch (error) {
      logger.error('Failed to create upload directory', { error });
      cb(error as Error, '');
    }
  },
  filename: (_, file, cb) => {
    try {
      const uniqueFilename = FileUtils.generateUniqueFilename(file.originalname);
      cb(null, uniqueFilename);
    } catch (error) {
      logger.error('Failed to generate filename', { error, originalname: file.originalname });
      cb(error as Error, '');
    }
  },
});

// File filter
const fileFilter = (_: Request, file: Express.Multer.File, cb: multer.FileFilterCallback): void => {
  logger.debug('File filter check', { 
    mimetype: file.mimetype,
    originalname: file.originalname 
  });

  // Check mimetype first
  if (config.allowedFileTypes.includes(file.mimetype)) {
    cb(null, true);
    return;
  }

  // If mimetype check fails, check file extension for HEIC/HEIF files
  // This handles cases where browsers don't set the correct mimetype for HEIC files
  const fileExtension = file.originalname.toLowerCase().split('.').pop();
  if (fileExtension === 'heic' || fileExtension === 'heif') {
    logger.debug('HEIC/HEIF file detected by extension, allowing upload', { 
      originalname: file.originalname,
      mimetype: file.mimetype 
    });
    cb(null, true);
    return;
  }

  // File type not allowed
  const error = new Error(
    `Invalid file type. Allowed types: ${config.allowedFileTypes.join(', ')}`
  ) as Error & { code: string };
  error.code = 'INVALID_FILE_TYPE';
  cb(error as any, false);
};

// Multer configuration
export const uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: config.maxFileSize,
    files: 1, // Only allow one file at a time
  },
  fileFilter,
});

// Multer configuration for multiple files (e.g., image enhancement with reference image)
export const uploadMultipleMiddleware = multer({
  storage,
  limits: {
    fileSize: config.maxFileSize,
    files: 21, // Allow up to 21 files (20 main images + 1 optional reference image)
  },
  fileFilter,
});

// Error handling middleware for multer
export const handleUploadError = (
  error: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): Response => {
  logger.error('File upload error', { 
    error: error.message,
    code: (error as any).code 
  });

  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(413).json({
          success: false,
          message: `File too large. Maximum size is ${config.maxFileSize / (1024 * 1024)}MB`,
          error: 'FILE_TOO_LARGE',
        });
      case 'LIMIT_FILE_COUNT':
        return res.status(413).json({
          success: false,
          message: 'Too many files. Maximum 20 images plus 1 reference image allowed',
          error: 'TOO_MANY_FILES',
        });
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          success: false,
          message: 'Unexpected field name for file upload',
          error: 'UNEXPECTED_FIELD',
        });
      default:
        return res.status(400).json({
          success: false,
          message: 'File upload error',
          error: error.code,
        });
    }
  }

  if ((error as any).code === 'INVALID_FILE_TYPE') {
    return res.status(400).json({
      success: false,
      message: error.message,
      error: 'INVALID_FILE_TYPE',
    });
  }

  // Generic error
  return res.status(500).json({
    success: false,
    message: 'Internal server error during file upload',
    error: 'UPLOAD_ERROR',
  });
};

// Middleware to validate uploaded file
export const validateUploadedFile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
        error: 'NO_FILE',
      });
    }

    logger.debug('Validating uploaded file', { 
      filename: req.file.filename,
      path: req.file.path,
      size: req.file.size 
    });

    // Validate that the file is a valid image
    const isValidImage = await FileUtils.validateImageFile(req.file.path);
    
    if (!isValidImage) {
      // Clean up invalid file
      await FileUtils.cleanupTempFiles([req.file.path]);
      
      return res.status(400).json({
        success: false,
        message: 'Invalid image file or corrupted data',
        error: 'INVALID_IMAGE',
      });
    }

    // Check if file is HEIC/HEIF and convert to WebP for better AI processing
    const isHeic = await FileUtils.isHeicFormat(req.file.path);
    if (isHeic) {
      try {
        logger.info('HEIC file detected, checking compatibility first', { 
          originalPath: req.file.path,
          originalFilename: req.file.filename 
        });
        
        // First, check if the HEIC file can be read at all
        const sharp = require('sharp');
        let metadata;
        try {
          metadata = await sharp(req.file.path).metadata();
          logger.info('HEIC file is readable, attempting conversion', {
            dimensions: `${metadata.width}x${metadata.height}`,
            format: metadata.format,
            hasAlpha: metadata.hasAlpha
          });
        } catch (metadataError) {
          // This HEIC file is fundamentally incompatible
          throw new Error(`This HEIC file uses an unsupported compression format that cannot be processed. Please convert it to JPEG or PNG using another tool first. Technical details: ${metadataError instanceof Error ? metadataError.message : String(metadataError)}`);
        }
        
        // Now try conversion to WebP
        const webpPath = req.file.path.replace(/\.[^.]+$/, '.webp');
        await FileUtils.convertHeicToWebP(req.file.path, webpPath);
        
        // Clean up original HEIC file
        await FileUtils.cleanupTempFiles([req.file.path]);
        
        // Update file info to use WebP version
        req.file.path = webpPath;
        req.file.filename = req.file.filename.replace(/\.[^.]+$/, '.webp');
        
        logger.info('HEIC to WebP conversion successful', { 
          originalPath: req.file.path,
          newPath: webpPath,
          newFilename: req.file.filename
        });
        
      } catch (conversionError) {
        logger.error('Failed to convert HEIC file', {
          error: conversionError,
          filePath: req.file.path,
          errorMessage: conversionError instanceof Error ? conversionError.message : String(conversionError)
        });
        
        // Check if this is a fundamental compatibility issue
        const errorMessage = conversionError instanceof Error ? conversionError.message : String(conversionError);
        if (errorMessage.includes('No decoding plugin installed') || 
            errorMessage.includes('bad seek') ||
            errorMessage.includes('compression format')) {
          
          // This is a fundamentally incompatible HEIC file
          throw new Error(`This HEIC file uses an unsupported compression format that cannot be processed by our system. This is a compatibility issue with the specific HEIC variant used. Please convert your image to JPEG or PNG using another tool first, then upload the converted file.`);
        }
        
        // Try alternative HEIC processing strategy for other types of errors
        try {
          logger.info('Attempting alternative HEIC processing strategy', { filePath: req.file.path });
          
          // Try converting to JPEG as a fallback
          const jpegPath = req.file.path.replace(/\.[^.]+$/, '.jpg');
          await FileUtils.convertHeicToJpeg(req.file.path, jpegPath);
          
          // Clean up original HEIC file
          await FileUtils.cleanupTempFiles([req.file.path]);
          
          // Update file info to use JPEG version
          req.file.path = jpegPath;
          req.file.filename = req.file.filename.replace(/\.[^.]+$/, '.jpg');
          
          logger.info('HEIC to JPEG conversion successful as fallback', { 
            originalPath: req.file.path,
            newPath: jpegPath,
            newFilename: req.file.filename
          });
          
        } catch (jpegFallbackError) {
          logger.error('JPEG fallback also failed', {
            error: jpegFallbackError,
            filePath: req.file.path,
            errorMessage: jpegFallbackError instanceof Error ? jpegFallbackError.message : String(jpegFallbackError)
          });
          
          // All conversion methods failed - reject this HEIC file
          throw new Error(`HEIC file cannot be processed. All conversion methods failed. This HEIC file appears to be corrupted or in an unsupported format. Please try converting it to JPEG or PNG using another tool first.`);
        }
      }
    }

    logger.info('File validation successful', { 
      filename: req.file.filename,
      size: req.file.size,
      finalPath: req.file.path
    });

    next();
  } catch (error) {
    logger.error('File validation error', { error });
    
    // Clean up file if it exists
    if (req.file?.path) {
      await FileUtils.cleanupTempFiles([req.file.path]);
    }
    
    res.status(500).json({
      success: false,
      message: 'Error validating uploaded file',
      error: 'VALIDATION_ERROR',
    });
  }
}; 