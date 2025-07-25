"""
Dependency injection for API endpoints
"""
from typing import Optional
from fastapi import Depends, HTTPException, status, Header
from functools import lru_cache

from ..core.config import get_settings
from ..core.exceptions import AuthenticationError
from ..services.ai_service import ModelManager, EnhancementDatabase, RealEstateAIService
from ..services.file_service import FileService


# Singleton instances
@lru_cache()
def get_model_manager() -> ModelManager:
    """Get ModelManager singleton"""
    return ModelManager()


@lru_cache()
def get_enhancement_database() -> EnhancementDatabase:
    """Get EnhancementDatabase singleton"""
    return EnhancementDatabase()


@lru_cache()
def get_file_service() -> FileService:
    """Get FileService singleton"""
    return FileService()


def get_ai_service(
    model_manager: ModelManager = Depends(get_model_manager),
    enhancement_db: EnhancementDatabase = Depends(get_enhancement_database)
) -> RealEstateAIService:
    """Get AI service with dependencies"""
    return RealEstateAIService(model_manager, enhancement_db)


def verify_api_key(
    x_api_key: Optional[str] = Header(None, alias="X-API-Key")
) -> bool:
    """
    Verify API key if required
    
    Args:
        x_api_key: API key from header
        
    Returns:
        True if authenticated or no API key required
        
    Raises:
        HTTPException: If authentication fails
    """
    settings = get_settings()
    
    # If no API key is configured, allow all requests
    if not settings.api_key:
        return True
    
    # If API key is configured, verify it
    if not x_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key required. Provide X-API-Key header.",
            headers={"WWW-Authenticate": "ApiKey"}
        )
    
    if x_api_key != settings.api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
            headers={"WWW-Authenticate": "ApiKey"}
        )
    
    return True 