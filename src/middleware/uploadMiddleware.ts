import multer from 'multer';
import { Request } from 'express';
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

  if (config.allowedFileTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const error = new Error(
      `Invalid file type. Allowed types: ${config.allowedFileTypes.join(', ')}`
    ) as Error & { code: string };
    error.code = 'INVALID_FILE_TYPE';
    cb(error as any, false);
  }
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

// Error handling middleware for multer
export const handleUploadError = (
  error: Error,
  _: Request,
  res: any,
  __: any
): void => {
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
          message: 'Too many files. Only one file is allowed',
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
  res.status(500).json({
    success: false,
    message: 'Internal server error during file upload',
    error: 'UPLOAD_ERROR',
  });
};

// Middleware to validate uploaded file
export const validateUploadedFile = async (
  req: Request,
  res: any,
  next: any
): Promise<void> => {
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

    logger.info('File validation successful', { 
      filename: req.file.filename,
      size: req.file.size 
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