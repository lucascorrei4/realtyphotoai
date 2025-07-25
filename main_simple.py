"""
Simplified FastAPI application for testing without AI dependencies
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Simple app without AI dependencies for testing
app = FastAPI(
    title="Real Estate Photo AI Backend",
    description="Professional backend API for real estate photo enhancement using AI.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "name": "Real Estate Photo AI Backend",
        "version": "1.0.0",
        "status": "operational",
        "docs_url": "/docs",
        "api_prefix": "/api/v1",
        "message": "🏠 Real Estate Photo AI Backend is running!"
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "version": "1.0.0",
        "timestamp": "2024-01-15T10:00:00Z",
        "models_loaded": False,  # Will be True when AI models are loaded
        "dependencies": {
            "python": "3.11+",
            "fastapi": "0.100+",
            "status": "core_only"
        }
    }

@app.get("/api/v1/test")
async def test_endpoint():
    """Test endpoint to verify API is working"""
    return {
        "message": "✅ API is working correctly!",
        "endpoints": [
            "GET /",
            "GET /health", 
            "GET /api/v1/test",
            "GET /docs"
        ]
    }

if __name__ == "__main__":
    import uvicorn
    
    print("🚀 Starting Real Estate Photo AI Backend (Simplified)")
    print("📖 API Documentation: http://localhost:8000/docs")
    print("🔍 Health Check: http://localhost:8000/health")
    print("🧪 Test Endpoint: http://localhost:8000/api/v1/test")
    
    uvicorn.run(
        "main_simple:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    ) 