"""
Pydantic models for request and response validation
"""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, validator
from enum import Enum


class RoomType(str, Enum):
    """Supported room types"""
    LIVING_ROOM = "living_room"
    BEDROOM = "bedroom"
    KITCHEN = "kitchen"
    BATHROOM = "bathroom"
    DINING_ROOM = "dining_room"
    BALCONY = "balcony"
    GARDEN = "garden"
    POOL_AREA = "pool_area"
    BUNGALOW = "bungalow"
    OFFICE = "office"
    BASEMENT = "basement"


class StyleType(str, Enum):
    """Supported interior design styles"""
    MODERN = "modern"
    CONTEMPORARY = "contemporary"
    TRADITIONAL = "traditional"
    RUSTIC = "rustic"
    INDUSTRIAL = "industrial"
    MINIMALIST = "minimalist"
    VINTAGE = "vintage"
    SCANDINAVIAN = "scandinavian"
    MEDITERRANEAN = "mediterranean"
    COLONIAL = "colonial"


class ClutterLevel(str, Enum):
    """Clutter level classifications"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class SpaceUtilization(str, Enum):
    """Space utilization classifications"""
    UNDERUTILIZED = "underutilized"
    WELL_UTILIZED = "well_utilized"
    OVERCROWDED = "overcrowded"


class ImageAnalysisRequest(BaseModel):
    """Request model for image analysis"""
    include_detailed_analysis: bool = Field(
        default=True,
        description="Whether to include detailed room analysis"
    )
    include_suggestions: bool = Field(
        default=True,
        description="Whether to include enhancement suggestions"
    )


class ClutterAnalysis(BaseModel):
    """Clutter analysis results"""
    has_clutter: bool = Field(description="Whether clutter is detected")
    has_empty_spaces: bool = Field(description="Whether empty spaces are detected")
    clutter_level: ClutterLevel = Field(description="Level of clutter detected")
    space_utilization: SpaceUtilization = Field(description="How well the space is utilized")


class ImageAnalysisResult(BaseModel):
    """Result of image analysis"""
    caption: str = Field(description="AI-generated description of the image")
    room_type: RoomType = Field(description="Detected room type")
    style: StyleType = Field(description="Detected interior design style")
    confidence_scores: Dict[str, float] = Field(description="Confidence scores for classifications")
    editable_areas: List[str] = Field(description="List of identified editable areas")
    clutter_analysis: ClutterAnalysis = Field(description="Clutter and space analysis")


class EnhancementSuggestion(BaseModel):
    """Enhancement suggestion model"""
    suggestion: str = Field(description="Main enhancement suggestion")
    priority: str = Field(description="Priority level (high, medium, low)")
    category: str = Field(description="Category of enhancement (furniture, decor, lighting, etc.)")
    estimated_impact: str = Field(description="Expected visual impact")


class ProcessImageRequest(BaseModel):
    """Request model for image processing"""
    analysis_options: Optional[ImageAnalysisRequest] = Field(
        default_factory=ImageAnalysisRequest,
        description="Analysis options"
    )


class ProcessImageResponse(BaseModel):
    """Response model for image processing"""
    success: bool = Field(description="Whether processing was successful")
    message: str = Field(description="Status message")
    analysis: Optional[ImageAnalysisResult] = Field(
        default=None,
        description="Detailed image analysis results"
    )
    enhancement_suggestion: str = Field(description="Main enhancement suggestion")
    suggestions: Optional[List[EnhancementSuggestion]] = Field(
        default=None,
        description="List of detailed enhancement suggestions"
    )
    processing_time: float = Field(description="Processing time in seconds")


class HealthCheckResponse(BaseModel):
    """Health check response model"""
    status: str = Field(description="Service status")
    version: str = Field(description="Application version")
    timestamp: str = Field(description="Current timestamp")
    models_loaded: bool = Field(description="Whether AI models are loaded")
    dependencies: Dict[str, str] = Field(description="Dependency versions")


class ErrorResponse(BaseModel):
    """Error response model"""
    error: str = Field(description="Error type")
    message: str = Field(description="Error message")
    details: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Additional error details"
    )
    timestamp: str = Field(description="Error timestamp")


class FileUploadResponse(BaseModel):
    """File upload response model"""
    filename: str = Field(description="Uploaded filename")
    size: int = Field(description="File size in bytes")
    content_type: str = Field(description="MIME type")
    upload_timestamp: str = Field(description="Upload timestamp") 