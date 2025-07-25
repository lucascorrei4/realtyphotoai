"""
Main FastAPI application for Real Estate Photo AI Backend
"""
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.openapi.utils import get_openapi

from src.core.config import get_settings, ensure_directories
from src.core.logging import setup_logging, get_logger
from src.core.exceptions import RealEstateAIException
from src.models.schemas import ErrorResponse
from src.api.routes import router as api_router
from src.api.dependencies import get_model_manager


# Initialize settings and logging
settings = get_settings()
setup_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    # Startup
    logger.info(f"Starting {settings.app_name} v{settings.app_version}")
    
    # Ensure directories exist
    ensure_directories()
    
    # Pre-load AI models in background
    try:
        model_manager = get_model_manager()
        logger.info("Pre-loading AI models...")
        # Note: Models will be loaded on first request to avoid blocking startup
        logger.info("Application startup complete")
    except Exception as e:
        logger.error(f"Failed to initialize models: {str(e)}")
        # Continue anyway - models will be loaded on first request
    
    yield
    
    # Shutdown
    logger.info("Shutting down application")


# Create FastAPI app
app = FastAPI(
    title="Real Estate Photo AI Backend",
    description="""
    Professional backend API for real estate photo enhancement using AI.
    
    ## Features
    
    * **Image Analysis**: Identify room types, architectural styles, and key areas
    * **Enhancement Suggestions**: Get professional recommendations for photo improvements
    * **Multi-format Support**: JPEG, PNG, BMP, TIFF, WebP
    * **Secure API**: Optional API key authentication
    * **High Performance**: Optimized for production use
    
    ## Usage
    
    1. Upload an image using the `/process-image` endpoint
    2. Receive detailed analysis and enhancement suggestions
    3. Use suggestions to improve your real estate photos
    
    ## Authentication
    
    If API key authentication is enabled, include the `X-API-Key` header in your requests.
    """,
    version=settings.app_version,
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
    lifespan=lifespan
)

# Add middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

if not settings.debug:
    # Add trusted host middleware in production
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=["*"]  # Configure with your actual domains
    )


# Exception handlers
@app.exception_handler(RealEstateAIException)
async def custom_exception_handler(request: Request, exc: RealEstateAIException):
    """Handle custom application exceptions"""
    logger.error(f"Application error: {exc.message}")
    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorResponse(
            error=exc.__class__.__name__,
            message=exc.message,
            details=exc.details,
            timestamp=str(request.state.__dict__.get('start_time', 'unknown'))
        ).dict()
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions"""
    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorResponse(
            error="HTTPException",
            message=exc.detail,
            timestamp=str(request.state.__dict__.get('start_time', 'unknown'))
        ).dict()
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle unexpected exceptions"""
    logger.error(f"Unexpected error: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content=ErrorResponse(
            error="InternalServerError",
            message="An unexpected error occurred",
            timestamp=str(request.state.__dict__.get('start_time', 'unknown'))
        ).dict()
    )


# Include API routes
app.include_router(api_router, prefix="/api/v1", tags=["AI Processing"])


# Root endpoint
@app.get("/", tags=["System"])
async def root():
    """Root endpoint with API information"""
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "status": "operational",
        "docs_url": "/docs" if settings.debug else "disabled",
        "api_prefix": "/api/v1"
    }


# Custom OpenAPI schema
def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    
    openapi_schema = get_openapi(
        title="Real Estate Photo AI Backend",
        version=settings.app_version,
        description="Professional AI-powered real estate photo enhancement API",
        routes=app.routes,
    )
    
    # Add security scheme for API key
    openapi_schema["components"]["securitySchemes"] = {
        "ApiKeyAuth": {
            "type": "apiKey",
            "in": "header",
            "name": "X-API-Key"
        }
    }
    
    app.openapi_schema = openapi_schema
    return app.openapi_schema


app.openapi = custom_openapi


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_level=settings.log_level.lower(),
        access_log=True
    ) 