"""
Main API routes for Real Estate Photo AI Backend
"""
import time
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, status
from fastapi.responses import JSONResponse

from ..core.config import get_settings
from ..core.logging import get_logger
from ..core.exceptions import RealEstateAIException
from ..models.schemas import (
    ProcessImageRequest,
    ProcessImageResponse,
    ImageAnalysisResult,
    HealthCheckResponse,
    ErrorResponse,
    FileUploadResponse
)
from ..services.ai_service import RealEstateAIService
from ..services.file_service import FileService
from .dependencies import get_ai_service, get_file_service, verify_api_key

# Initialize router and logger
router = APIRouter()
logger = get_logger(__name__)
settings = get_settings()


@router.get("/health", response_model=HealthCheckResponse)
async def health_check():
    """Health check endpoint"""
    try:
        return HealthCheckResponse(
            status="healthy",
            version=settings.app_version,
            timestamp=datetime.utcnow().isoformat(),
            models_loaded=True,  # We'll update this based on actual model status
            dependencies={
                "python": "3.8+",
                "torch": "2.0+",
                "transformers": "4.30+",
                "fastapi": "0.100+"
            }
        )
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Service unhealthy"
        )


@router.post("/process-image", response_model=ProcessImageResponse)
async def process_image(
    file: UploadFile = File(..., description="Image file to process"),
    request_data: Optional[ProcessImageRequest] = None,
    ai_service: RealEstateAIService = Depends(get_ai_service),
    file_service: FileService = Depends(get_file_service),
    _: bool = Depends(verify_api_key)
):
    """
    Process uploaded image and return enhancement suggestions
    
    Args:
        file: Uploaded image file
        request_data: Optional processing parameters
        ai_service: AI service dependency
        file_service: File service dependency
        
    Returns:
        ProcessImageResponse with analysis and suggestions
    """
    start_time = time.time()
    temp_file_path = None
    optimized_file_path = None
    
    try:
        logger.info(f"Processing image: {file.filename}")
        
        # Validate file type
        if not file.content_type or not file.content_type.startswith('image/'):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File must be an image"
            )
        
        # Save uploaded file
        temp_file_path = file_service.create_temp_file_from_upload(file)
        
        # Optimize image for processing
        optimized_file_path = file_service.optimize_image_for_processing(temp_file_path)
        
        # Analyze image
        analysis = ai_service.analyze_image(optimized_file_path)
        
        # Get enhancement suggestions
        suggestions = ai_service.get_enhancement_suggestions(analysis)
        primary_suggestion = ai_service.get_primary_suggestion(analysis)
        
        processing_time = time.time() - start_time
        
        logger.info(f"Image processed successfully in {processing_time:.2f}s")
        
        return ProcessImageResponse(
            success=True,
            message="Image processed successfully",
            analysis=analysis,
            enhancement_suggestion=primary_suggestion,
            suggestions=suggestions,
            processing_time=processing_time
        )
        
    except RealEstateAIException as e:
        logger.error(f"AI processing error: {str(e)}")
        raise HTTPException(
            status_code=e.status_code,
            detail=e.message
        )
    except Exception as e:
        logger.error(f"Unexpected error processing image: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )
    finally:
        # Cleanup temporary files
        if temp_file_path:
            file_service.cleanup_file(temp_file_path)
        if optimized_file_path and optimized_file_path != temp_file_path:
            file_service.cleanup_file(optimized_file_path)


@router.post("/analyze-image", response_model=ImageAnalysisResult)
async def analyze_image(
    file: UploadFile = File(..., description="Image file to analyze"),
    ai_service: RealEstateAIService = Depends(get_ai_service),
    file_service: FileService = Depends(get_file_service),
    _: bool = Depends(verify_api_key)
):
    """
    Analyze uploaded image without enhancement suggestions
    
    Args:
        file: Uploaded image file
        ai_service: AI service dependency
        file_service: File service dependency
        
    Returns:
        ImageAnalysisResult with detailed analysis
    """
    temp_file_path = None
    optimized_file_path = None
    
    try:
        logger.info(f"Analyzing image: {file.filename}")
        
        # Validate file type
        if not file.content_type or not file.content_type.startswith('image/'):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File must be an image"
            )
        
        # Save uploaded file
        temp_file_path = file_service.create_temp_file_from_upload(file)
        
        # Optimize image for processing
        optimized_file_path = file_service.optimize_image_for_processing(temp_file_path)
        
        # Analyze image
        analysis = ai_service.analyze_image(optimized_file_path)
        
        logger.info("Image analyzed successfully")
        return analysis
        
    except RealEstateAIException as e:
        logger.error(f"AI analysis error: {str(e)}")
        raise HTTPException(
            status_code=e.status_code,
            detail=e.message
        )
    except Exception as e:
        logger.error(f"Unexpected error analyzing image: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )
    finally:
        # Cleanup temporary files
        if temp_file_path:
            file_service.cleanup_file(temp_file_path)
        if optimized_file_path and optimized_file_path != temp_file_path:
            file_service.cleanup_file(optimized_file_path)


@router.post("/upload", response_model=FileUploadResponse)
async def upload_file(
    file: UploadFile = File(..., description="Image file to upload"),
    file_service: FileService = Depends(get_file_service),
    _: bool = Depends(verify_api_key)
):
    """
    Upload and validate image file
    
    Args:
        file: Uploaded image file
        file_service: File service dependency
        
    Returns:
        FileUploadResponse with file details
    """
    try:
        logger.info(f"Uploading file: {file.filename}")
        
        # Validate file type
        if not file.content_type or not file.content_type.startswith('image/'):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File must be an image"
            )
        
        # Get file info
        file_size = 0
        content = file.file.read()
        file_size = len(content)
        
        # Reset file pointer and validate
        file.file.seek(0)
        temp_file_path = file_service.create_temp_file_from_upload(file)
        
        # Get image info
        image_info = file_service.get_image_info(temp_file_path)
        
        # Cleanup temp file
        file_service.cleanup_file(temp_file_path)
        
        logger.info(f"File uploaded successfully: {file.filename}")
        
        return FileUploadResponse(
            filename=file.filename or "unknown",
            size=file_size,
            content_type=file.content_type or "unknown",
            upload_timestamp=datetime.utcnow().isoformat()
        )
        
    except Exception as e:
        logger.error(f"Error uploading file: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upload file"
        ) 