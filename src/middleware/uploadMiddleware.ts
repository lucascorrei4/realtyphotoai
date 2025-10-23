import multer from 'multer';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { FileUtils } from '../utils/fileUtils';
import { logger } from '../utils/logger';
import path from 'path';

// Choose storage based on R2 configuration
const getStorage = () => {
  if (config.useR2Storage) {
    // Use memory storage when R2 is enabled
    logger.info('Using memory storage for R2 uploads');
    return multer.memoryStorage();
  } else {
    // Use disk storage when R2 is disabled
    logger.info('Using disk storage for local uploads');
    return multer.diskStorage({
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
  }
};

// Storage configuration
const storage = getStorage();

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
      originalname: req.file.originalname,
      path: req.file.path,
      size: req.file.size,
      hasBuffer: !!req.file.buffer,
      mimetype: req.file.mimetype,
      fieldname: req.file.fieldname
    });

    // Handle validation based on storage type
    let isValidImage: boolean;
    let isHeic: boolean;

    if (req.file.buffer) {
      // Memory storage (R2 mode) - validate directly from buffer without temp files
      try {
        // Use Sharp to validate the buffer directly
        const sharp = require('sharp');
        const metadata = await sharp(req.file.buffer).metadata();
        isValidImage = !!(metadata.width && metadata.height);
        
        // Check if it's HEIC format by examining the buffer
        const bufferStart = req.file.buffer.slice(0, 12);
        const heicSignatures = [
          Buffer.from([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70]), // HEIC
          Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]), // HEIF
        ];
        isHeic = heicSignatures.some(sig => bufferStart.includes(sig));
        
        logger.info('Memory validation completed', {
          isValidImage,
          isHeic,
          width: metadata.width,
          height: metadata.height,
          format: metadata.format
        });
      } catch (bufferError) {
        logger.error('Buffer validation failed', { error: bufferError });
        isValidImage = false;
        isHeic = false;
      }
    } else {
      // Disk storage (local mode) - use existing file-based validation
      isValidImage = await FileUtils.validateImageFile(req.file.path);
      isHeic = await FileUtils.isHeicFormat(req.file.path);
    }
    
    if (!isValidImage) {
      // Clean up invalid file (only for disk storage)
      if (!req.file.buffer && req.file.path) {
        await FileUtils.cleanupTempFiles([req.file.path]);
      }
      
      return res.status(400).json({
        success: false,
        message: 'Invalid image file or corrupted data',
        error: 'INVALID_IMAGE',
      });
    }

    // Check if file is HEIC/HEIF and convert to WebP for better AI processing
    if (isHeic) {
      try {
        if (req.file.buffer) {
          // Memory storage - convert buffer directly
          logger.info('HEIC file detected in memory, converting to WebP', { 
            originalSize: req.file.buffer.length,
            isMemoryStorage: true
          });
          
          const sharp = require('sharp');
          const webpBuffer = await sharp(req.file.buffer)
            .webp({ quality: 90 })
            .toBuffer();
          
          // Update the buffer with converted WebP data
          req.file.buffer = webpBuffer;
          req.file.mimetype = 'image/webp';
          
          // Update filename to reflect WebP format
          const originalName = req.file.originalname || 'converted_image';
          req.file.originalname = originalName.replace(/\.[^.]+$/, '.webp');
          
          logger.info('HEIC to WebP conversion successful in memory', { 
            originalSize: req.file.buffer.length,
            newSize: webpBuffer.length,
            newMimetype: req.file.mimetype
          });
        } else {
          // Disk storage - use existing file-based conversion
          const filePath = req.file.path;
          logger.info('HEIC file detected on disk, checking compatibility first', { 
            originalPath: filePath,
            originalFilename: req.file.filename,
            isMemoryStorage: false
          });
          
          // First, check if the HEIC file can be read at all
          const sharp = require('sharp');
          let metadata;
          try {
            metadata = await sharp(filePath).metadata();
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
          const webpFilename = (req.file.filename || req.file.originalname || `converted_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`).replace(/\.[^.]+$/, '.webp');
          const webpPath = path.join(config.tempDir, `converted_${webpFilename}`);
          await FileUtils.ensureDirectoryExists(config.tempDir);
          await FileUtils.convertHeicToWebP(filePath, webpPath);
          
          // Disk storage - replace original file
          await FileUtils.cleanupTempFiles([req.file.path]);
          await require('fs/promises').rename(webpPath, req.file.path);
          
          // Update file info to use WebP version
          req.file.path = webpPath;
          req.file.filename = webpFilename;
          
          logger.info('HEIC to WebP conversion successful on disk', { 
            originalPath: filePath,
            newPath: webpPath,
            newFilename: req.file.filename
          });
        }
        
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

    // No temp files created for memory storage - no cleanup needed
    logger.info('File validation successful', { 
      filename: req.file.filename,
      size: req.file.size,
      finalPath: req.file.path,
      hasBuffer: !!req.file.buffer,
      mimetype: req.file.mimetype
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