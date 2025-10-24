/**
 * File validation utilities for frontend components
 */

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Check if a file type is valid for image uploads
 * Supports both MIME type and file extension validation for better HEIC compatibility
 */
export function isValidImageFile(file: File): FileValidationResult {
  const validMimeTypes = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ];

  const validExtensions = [
    'jpg',
    'jpeg', 
    'png',
    'webp',
    'heic',
    'heif'
  ];

  // Get file extension
  const fileExtension = file.name.toLowerCase().split('.').pop();
  
  // Check MIME type first
  if (file.type && validMimeTypes.includes(file.type.toLowerCase())) {
    return { isValid: true };
  }
  
  // If MIME type check fails or is empty, check file extension
  // This handles cases where browsers don't set correct MIME type for HEIC files
  if (fileExtension && validExtensions.includes(fileExtension)) {
    return { isValid: true };
  }
  
  // If both checks fail, return error
  return {
    isValid: false,
    error: `Invalid file type: ${file.name}. Please select only JPG, PNG, WebP, or HEIC files.`
  };
}

/**
 * Check if file size is within limits
 */
export function isValidFileSize(file: File, maxSizeMB: number = 10): FileValidationResult {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  
  if (file.size > maxSizeBytes) {
    return {
      isValid: false,
      error: `File too large: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is ${maxSizeMB}MB.`
    };
  }
  
  return { isValid: true };
}

/**
 * Comprehensive file validation for image uploads
 */
export function validateImageFile(file: File, maxSizeMB: number = 10): FileValidationResult {
  // Check file type
  const typeValidation = isValidImageFile(file);
  if (!typeValidation.isValid) {
    return typeValidation;
  }
  
  // Check file size
  const sizeValidation = isValidFileSize(file, maxSizeMB);
  if (!sizeValidation.isValid) {
    return sizeValidation;
  }
  
  return { isValid: true };
}

/**
 * Validate multiple files for batch uploads
 */
export function validateImageFiles(files: File[], maxSizeMB: number = 10, maxCount: number = 20): FileValidationResult {
  if (files.length === 0) {
    return { isValid: false, error: 'No files selected.' };
  }
  
  if (files.length > maxCount) {
    return { isValid: false, error: `Maximum ${maxCount} files allowed. Please select fewer files.` };
  }
  
  for (const file of files) {
    const validation = validateImageFile(file, maxSizeMB);
    if (!validation.isValid) {
      return validation;
    }
  }
  
  return { isValid: true };
}
