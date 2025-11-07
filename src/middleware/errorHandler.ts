import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { ApiResponse, CustomError } from '../types';

/**
 * Global error handler middleware
 */
export const errorHandler = (
  error: CustomError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  logger.error('Unhandled error occurred', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  // Default error values
  let statusCode = error.statusCode || 500;
  let message = error.message || 'Internal server error';
  let errorCode = 'INTERNAL_ERROR';

  // Handle specific error types
  if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation error';
    errorCode = 'VALIDATION_ERROR';
  } else if (error.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid data format';
    errorCode = 'INVALID_FORMAT';
  } else if (error.name === 'MongoError' && error.message.includes('E11000')) {
    statusCode = 409;
    message = 'Duplicate entry';
    errorCode = 'DUPLICATE_ENTRY';
  } else if (error.message.includes('ENOENT')) {
    statusCode = 404;
    message = 'File not found';
    errorCode = 'FILE_NOT_FOUND';
  } else if (error.message.includes('EACCES')) {
    statusCode = 403;
    message = 'Permission denied';
    errorCode = 'PERMISSION_DENIED';
  }

  // Don't expose internal errors in production
  if (statusCode === 500 && process.env.NODE_ENV === 'production') {
    message = 'Internal server error';
  }

  const errorResponse: ApiResponse = {
    success: false,
    message,
    error: errorCode,
    timestamp: new Date().toISOString(),
  };

  // Ensure we always return JSON, never HTML
  if (!res.headersSent) {
    res.status(statusCode).json(errorResponse);
  }
};

/**
 * 404 handler for undefined routes
 */
export const notFoundHandler = (req: Request, res: Response): void => {
  logger.warn('Route not found', {
    url: req.url,
    method: req.method,
    ip: req.ip,
  });

  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.url}`,
    error: 'ROUTE_NOT_FOUND',
    timestamp: new Date().toISOString(),
  } as ApiResponse);
};

/**
 * Async error wrapper for route handlers
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Create custom error
 */
export const createError = (
  message: string,
  statusCode: number = 500,
  isOperational: boolean = true
): CustomError => {
  const error = new Error(message) as CustomError;
  error.statusCode = statusCode;
  error.isOperational = isOperational;
  return error;
}; 