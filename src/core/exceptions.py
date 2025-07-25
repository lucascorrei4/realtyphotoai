"""
Custom exceptions for the Real Estate Photo AI Backend
"""
from typing import Optional, Any, Dict


class RealEstateAIException(Exception):
    """Base exception for Real Estate AI application"""
    
    def __init__(
        self,
        message: str,
        status_code: int = 500,
        details: Optional[Dict[str, Any]] = None
    ):
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        super().__init__(self.message)


class ValidationError(RealEstateAIException):
    """Raised when input validation fails"""
    
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message, status_code=400, details=details)


class FileProcessingError(RealEstateAIException):
    """Raised when file processing fails"""
    
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message, status_code=422, details=details)


class ModelLoadingError(RealEstateAIException):
    """Raised when AI model loading fails"""
    
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message, status_code=503, details=details)


class ImageProcessingError(RealEstateAIException):
    """Raised when image processing fails"""
    
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message, status_code=422, details=details)


class AuthenticationError(RealEstateAIException):
    """Raised when authentication fails"""
    
    def __init__(self, message: str = "Authentication required", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, status_code=401, details=details)


class AuthorizationError(RealEstateAIException):
    """Raised when authorization fails"""
    
    def __init__(self, message: str = "Insufficient permissions", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, status_code=403, details=details)


class ResourceNotFoundError(RealEstateAIException):
    """Raised when a requested resource is not found"""
    
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message, status_code=404, details=details)


class ServiceUnavailableError(RealEstateAIException):
    """Raised when a service is temporarily unavailable"""
    
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message, status_code=503, details=details) 