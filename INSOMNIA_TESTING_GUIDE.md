# 🧪 Insomnia Testing Guide

Complete guide for testing the Real Estate Photo AI Backend using Insomnia REST client.

## 📋 Prerequisites

1. **Install Insomnia**: Download from [insomnia.rest](https://insomnia.rest/download)
2. **Backend Running**: Ensure the API is running on `http://localhost:8000` (development) or your VPS domain (production)
3. **Test Images**: Have some real estate photos ready for testing

## 🚀 Quick Setup

### 1. Create New Workspace

1. Open Insomnia
2. Click "Create" → "Request Collection"
3. Name: "Real Estate Photo AI Backend"
4. Set Base URL: `http://localhost:8000` or `https://your-domain.com`

### 2. Environment Variables

Create environment variables for easy switching between development and production:

**Development Environment**:
```json
{
  "base_url": "http://localhost:8000",
  "api_key": ""
}
```

**Production Environment**:
```json
{
  "base_url": "https://your-domain.com",
  "api_key": "your-production-api-key"
}
```

## 🔍 Test Endpoints

### 1. Health Check

**Purpose**: Verify the API is running and healthy

```
Method: GET
URL: {{ _.base_url }}/health
Headers: (none required)
```

**Expected Response (200 OK)**:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "models_loaded": true,
  "dependencies": {
    "python": "3.8+",
    "torch": "2.0+",
    "transformers": "4.30+",
    "fastapi": "0.100+"
  }
}
```

### 2. Root Endpoint

**Purpose**: Get API information

```
Method: GET
URL: {{ _.base_url }}/
Headers: (none required)
```

**Expected Response (200 OK)**:
```json
{
  "name": "Real Estate Photo AI Backend",
  "version": "1.0.0",
  "status": "operational",
  "docs_url": "/docs",
  "api_prefix": "/api/v1"
}
```

### 3. Upload File (Validation Only)

**Purpose**: Test file upload and validation without processing

```
Method: POST
URL: {{ _.base_url }}/api/v1/upload
Headers:
  X-API-Key: {{ _.api_key }}  (if API key is enabled)
Body: Multipart Form
  file: [Select your image file]
```

**Expected Response (200 OK)**:
```json
{
  "filename": "living_room.jpg",
  "size": 1245670,
  "content_type": "image/jpeg",
  "upload_timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 4. Analyze Image (No Suggestions)

**Purpose**: Get detailed image analysis without enhancement suggestions

```
Method: POST
URL: {{ _.base_url }}/api/v1/analyze-image
Headers:
  X-API-Key: {{ _.api_key }}  (if API key is enabled)
Body: Multipart Form
  file: [Select your image file]
```

**Expected Response (200 OK)**:
```json
{
  "caption": "a modern living room with a gray sofa and coffee table",
  "room_type": "living_room",
  "style": "modern",
  "confidence_scores": {
    "room_type": 0.95,
    "style": 0.87
  },
  "editable_areas": [
    "furniture: sofa",
    "furniture: table",
    "lighting: lamp"
  ],
  "clutter_analysis": {
    "has_clutter": false,
    "has_empty_spaces": true,
    "clutter_level": "low",
    "space_utilization": "underutilized"
  }
}
```

### 5. Process Image (Full Analysis + Suggestions)

**Purpose**: Get complete image analysis with enhancement suggestions

```
Method: POST
URL: {{ _.base_url }}/api/v1/process-image
Headers:
  X-API-Key: {{ _.api_key }}  (if API key is enabled)
Body: Multipart Form
  file: [Select your image file]
```

**Expected Response (200 OK)**:
```json
{
  "success": true,
  "message": "Image processed successfully",
  "analysis": {
    "caption": "a modern living room with a gray sofa and coffee table",
    "room_type": "living_room",
    "style": "modern",
    "confidence_scores": {
      "room_type": 0.95,
      "style": 0.87
    },
    "editable_areas": [
      "furniture: sofa",
      "furniture: table",
      "lighting: lamp"
    ],
    "clutter_analysis": {
      "has_clutter": false,
      "has_empty_spaces": true,
      "clutter_level": "low",
      "space_utilization": "underutilized"
    }
  },
  "enhancement_suggestion": "Add modern coffee table with clean lines, declutter surfaces",
  "suggestions": [
    {
      "suggestion": "Add modern coffee table with clean lines, declutter surfaces",
      "priority": "high",
      "category": "furniture",
      "estimated_impact": "high"
    },
    {
      "suggestion": "Install contemporary lighting fixtures, enhance natural light",
      "priority": "medium",
      "category": "lighting",
      "estimated_impact": "medium"
    }
  ],
  "processing_time": 2.45
}
```

## 🖼️ Test Images

### Recommended Test Images

1. **Living Room**: Modern furniture, good lighting
2. **Kitchen**: Clean countertops, visible appliances
3. **Bedroom**: Bed visible, some decor
4. **Bathroom**: Sink/bathtub visible, clean
5. **Cluttered Room**: Messy space to test clutter detection

### Image Requirements

- **Formats**: JPEG, PNG, BMP, TIFF, WebP
- **Size**: Maximum 10MB
- **Dimensions**: 32x32 to 4096x4096 pixels
- **Content**: Clear room photos with identifiable features

## 🔐 Authentication Testing

### Without API Key

If API key is not configured, all requests should work without the `X-API-Key` header.

### With API Key

1. **Set API Key in Environment**: Add your API key to the environment variable
2. **Test Valid Key**: Include `X-API-Key: {{ _.api_key }}` header
3. **Test Invalid Key**: Use wrong API key, expect 401 Unauthorized
4. **Test Missing Key**: Omit header entirely, expect 401 Unauthorized

**Error Response (401 Unauthorized)**:
```json
{
  "error": "HTTPException",
  "message": "API key required. Provide X-API-Key header.",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## ⚠️ Error Testing

### 1. Invalid File Format

Upload a non-image file (e.g., .txt, .pdf):

**Expected Response (400 Bad Request)**:
```json
{
  "error": "HTTPException",
  "message": "File must be an image",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 2. File Too Large

Upload a file larger than 10MB:

**Expected Response (422 Unprocessable Entity)**:
```json
{
  "error": "FileProcessingError",
  "message": "File size exceeds 10.0MB limit",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 3. Missing File

Send request without file:

**Expected Response (422 Unprocessable Entity)**:
```json
{
  "detail": [
    {
      "loc": ["body", "file"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

### 4. Corrupted Image

Upload a corrupted image file:

**Expected Response (422 Unprocessable Entity)**:
```json
{
  "error": "ValidationError",
  "message": "Invalid image file: cannot identify image file",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## 📊 Performance Testing

### Response Time Testing

1. **Measure Processing Time**: Check the `processing_time` field in responses
2. **Expected Times**:
   - Health check: < 100ms
   - Upload validation: < 500ms
   - Image analysis: 2-5 seconds
   - Full processing: 3-6 seconds

### Load Testing

1. **Concurrent Requests**: Send multiple requests simultaneously
2. **Large Images**: Test with maximum allowed file sizes
3. **Different Room Types**: Test various room types and styles

## 🔧 Troubleshooting

### Common Issues

1. **Connection Refused**:
   - Check if the backend is running
   - Verify the correct port (8000)
   - Check firewall settings

2. **401 Unauthorized**:
   - Verify API key is correct
   - Check if API key authentication is enabled

3. **504 Gateway Timeout**:
   - AI model loading might take time on first request
   - Check server resources (CPU, memory)

4. **422 Unprocessable Entity**:
   - Verify image file is valid
   - Check file size and format

### Debug Steps

1. **Check Health Endpoint**: Start with `/health` to verify basic connectivity
2. **Review Logs**: Check application logs for detailed error information
3. **Test with Small Image**: Use a small, simple image first
4. **Validate Environment**: Ensure all environment variables are set correctly

## 📝 Collection Export

You can export your Insomnia collection to share with team members:

1. Right-click on collection name
2. Select "Export"
3. Choose "Insomnia v4 (JSON)"
4. Share the exported file

## 🎯 Testing Checklist

### Basic Functionality
- [ ] Health check responds correctly
- [ ] Root endpoint provides API info
- [ ] File upload validation works
- [ ] Image analysis returns expected structure
- [ ] Full processing includes suggestions

### Authentication
- [ ] Requests work without API key (if disabled)
- [ ] Valid API key allows access
- [ ] Invalid API key returns 401
- [ ] Missing API key returns 401 (if enabled)

### Error Handling
- [ ] Invalid file format rejected
- [ ] Large files rejected
- [ ] Missing file returns validation error
- [ ] Corrupted image handled gracefully

### Performance
- [ ] Response times are acceptable
- [ ] Large images process successfully
- [ ] Multiple concurrent requests handled

### Different Room Types
- [ ] Living room analysis
- [ ] Kitchen analysis  
- [ ] Bedroom analysis
- [ ] Bathroom analysis
- [ ] Other room types

---

**Happy Testing! 🚀**

For issues or questions, check the application logs or open a support ticket with your test results. 