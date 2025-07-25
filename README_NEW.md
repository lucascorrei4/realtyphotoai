# 🏠 Real Estate Photo AI Backend

A professional FastAPI-based backend for AI-powered real estate photo enhancement. Built with best practices, design patterns, and optimized for production deployment on VPS.

## 🏗️ Architecture

This backend is built using modern software engineering practices:

- **FastAPI Framework**: High-performance async web framework
- **Dependency Injection**: Clean separation of concerns
- **Service Layer Pattern**: Business logic isolation
- **Repository Pattern**: Data access abstraction
- **Configuration Management**: Environment-based settings
- **Comprehensive Logging**: Structured logging with levels
- **Error Handling**: Custom exceptions and proper HTTP responses
- **Input Validation**: Pydantic models for request/response validation
- **Security**: Optional API key authentication
- **Production Ready**: Gunicorn + Nginx configuration

## 🚀 Features

- **🔍 Image Analysis**: Identify room types, architectural styles, and key areas
- **✨ Enhancement Suggestions**: Professional recommendations for photo improvements
- **📁 Multi-format Support**: JPEG, PNG, BMP, TIFF, WebP
- **🔐 Secure API**: Optional API key authentication
- **⚡ High Performance**: Async processing with connection pooling
- **📊 Comprehensive Logging**: Detailed logging for monitoring and debugging
- **🐳 Production Ready**: Optimized for VPS deployment with monitoring

## 📁 Project Structure

```
realtyphotoai/
├── src/                          # Main application source
│   ├── api/                      # API endpoints and routes
│   │   ├── dependencies.py       # Dependency injection
│   │   └── routes.py            # API routes
│   ├── core/                     # Core application components
│   │   ├── config.py            # Configuration management
│   │   ├── exceptions.py        # Custom exceptions
│   │   └── logging.py           # Logging configuration
│   ├── models/                   # Data models and schemas
│   │   └── schemas.py           # Pydantic models
│   └── services/                 # Business logic services
│       ├── ai_service.py        # AI processing service
│       └── file_service.py      # File handling service
├── main.py                       # FastAPI application entry point
├── gunicorn.conf.py             # Gunicorn configuration
├── requirements_new.txt         # Production dependencies
├── env.example                  # Environment configuration template
├── deploy_vps_new.sh           # VPS deployment script
└── README_NEW.md               # This file
```

## 🛠️ Installation

### Development Setup

1. **Clone the repository**:
```bash
git clone <repository-url>
cd realtyphotoai
```

2. **Create virtual environment**:
```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. **Install dependencies**:
```bash
pip install -r requirements_new.txt
```

4. **Configure environment**:
```bash
cp env.example .env
# Edit .env with your settings
```

5. **Run development server**:
```bash
python main.py
```

The API will be available at `http://localhost:8000`
- Interactive API docs: `http://localhost:8000/docs`
- Alternative docs: `http://localhost:8000/redoc`

### Production Deployment (VPS)

1. **Run deployment script**:
```bash
chmod +x deploy_vps_new.sh
./deploy_vps_new.sh
```

2. **Configure environment**:
```bash
sudo nano /var/www/realestate-ai-backend/.env
```

3. **Start services**:
```bash
sudo systemctl daemon-reload
sudo systemctl enable realestate-ai-backend
sudo systemctl start realestate-ai-backend
sudo systemctl restart nginx
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file based on `env.example`:

```bash
# Application Settings
APP_NAME="Real Estate Photo AI Backend"
DEBUG=false

# Server Configuration
HOST=0.0.0.0
PORT=8000
WORKERS=2

# Security
SECRET_KEY=your-secret-key-here
API_KEY=your-api-key-here  # Optional
ALLOWED_ORIGINS=["https://yourdomain.com"]

# File Upload
MAX_FILE_SIZE=10485760  # 10MB
UPLOAD_DIR=uploads
TEMP_DIR=temp

# AI Models
MODELS_CACHE_DIR=models_cache
DEVICE=cpu

# Logging
LOG_LEVEL=INFO
```

## 📡 API Endpoints

### Core Endpoints

| Method | Endpoint | Description | Authentication |
|--------|----------|-------------|----------------|
| `GET` | `/` | Root endpoint with API info | No |
| `GET` | `/health` | Health check | No |
| `POST` | `/api/v1/process-image` | Process image and get suggestions | Optional |
| `POST` | `/api/v1/analyze-image` | Analyze image without suggestions | Optional |
| `POST` | `/api/v1/upload` | Upload and validate image | Optional |

### API Documentation

- **Swagger UI**: `http://localhost:8000/docs` (development only)
- **ReDoc**: `http://localhost:8000/redoc` (development only)

## 🧪 Testing with Insomnia

### 1. Health Check

```bash
GET http://localhost:8000/health
```

**Expected Response**:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2024-01-01T12:00:00",
  "models_loaded": true,
  "dependencies": {
    "python": "3.8+",
    "torch": "2.0+",
    "transformers": "4.30+",
    "fastapi": "0.100+"
  }
}
```

### 2. Process Image

```bash
POST http://localhost:8000/api/v1/process-image
Content-Type: multipart/form-data
X-API-Key: your-api-key-here  # If API key is enabled

# Body: Form data with 'file' field containing image
```

**Expected Response**:
```json
{
  "success": true,
  "message": "Image processed successfully",
  "analysis": {
    "caption": "a modern living room with a sofa and coffee table",
    "room_type": "living_room",
    "style": "modern",
    "confidence_scores": {
      "room_type": 0.95,
      "style": 0.87
    },
    "editable_areas": ["furniture: sofa", "furniture: table"],
    "clutter_analysis": {
      "has_clutter": false,
      "has_empty_spaces": true,
      "clutter_level": "low",
      "space_utilization": "underutilized"
    }
  },
  "enhancement_suggestion": "Add modern decor elements to enhance the space",
  "suggestions": [
    {
      "suggestion": "Add modern artwork and plants",
      "priority": "high",
      "category": "decor",
      "estimated_impact": "high"
    }
  ],
  "processing_time": 2.34
}
```

### 3. Authentication

If API key authentication is enabled, include the header:
```
X-API-Key: your-api-key-here
```

## 🔍 Monitoring

### Service Status

```bash
# Check service status
sudo systemctl status realestate-ai-backend

# View logs
sudo journalctl -u realestate-ai-backend -f

# Check Nginx status
sudo systemctl status nginx
```

### Health Monitoring

The deployment includes automatic monitoring:
- Health checks every 5 minutes
- Automatic service restart on failure
- Log rotation
- Resource monitoring

### Log Files

- Application logs: `/var/www/realestate-ai-backend/logs/`
- System logs: `journalctl -u realestate-ai-backend`
- Nginx logs: `/var/log/nginx/`

## 🛡️ Security

### Best Practices Implemented

- **Input Validation**: Pydantic models validate all inputs
- **File Upload Security**: File type validation and size limits
- **API Key Authentication**: Optional but recommended for production
- **CORS Configuration**: Configurable allowed origins
- **Security Headers**: X-Frame-Options, X-Content-Type-Options, etc.
- **Error Handling**: Secure error messages without information leakage

### Production Security Checklist

- ✅ Set strong `SECRET_KEY` in production
- ✅ Enable `API_KEY` authentication
- ✅ Configure `ALLOWED_ORIGINS` with your actual domains
- ✅ Set `DEBUG=false` in production
- ✅ Use HTTPS (SSL/TLS) in production
- ✅ Regular security updates

## 🚀 Performance

### Optimizations

- **Async Processing**: FastAPI with async/await
- **Model Caching**: AI models loaded once and reused
- **Image Optimization**: Automatic image resizing for processing
- **Connection Pooling**: Efficient database connections (future)
- **Gunicorn Workers**: Multi-process deployment
- **Nginx Proxy**: Static file serving and load balancing

### Scaling

- **Horizontal Scaling**: Add more Gunicorn workers
- **Load Balancing**: Nginx upstream configuration ready
- **Caching**: Redis integration ready for future
- **Database**: PostgreSQL integration ready for future

## 🔧 Development

### Code Quality

- **Type Hints**: Full type annotation
- **Linting**: Black, isort, flake8 configured
- **Testing**: Pytest setup ready
- **Documentation**: Comprehensive docstrings

### Adding New Features

1. **Create new service** in `src/services/`
2. **Add API endpoints** in `src/api/routes.py`
3. **Define schemas** in `src/models/schemas.py`
4. **Update dependencies** in `src/api/dependencies.py`
5. **Add tests** in `tests/`

## 📝 API Response Examples

### Success Response
```json
{
  "success": true,
  "message": "Image processed successfully",
  "data": { ... },
  "processing_time": 2.34
}
```

### Error Response
```json
{
  "error": "ValidationError",
  "message": "Invalid image file format",
  "details": {
    "supported_formats": [".jpg", ".png", ".bmp"]
  },
  "timestamp": "2024-01-01T12:00:00"
}
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Follow code quality standards
4. Add tests for new features
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
1. Check the API documentation at `/docs`
2. Review logs for error details
3. Open an issue with detailed description
4. Include sample requests and responses

---

**Built with ❤️ using FastAPI, PyTorch, and modern Python practices** 