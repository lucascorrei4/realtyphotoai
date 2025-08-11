# 🧪 Complete Insomnia Testing Guide

**Step-by-step instructions for testing the Real Estate Photo AI Backend with Insomnia on both Windows and VPS Ubuntu.**

## 📋 Prerequisites

1. **Insomnia REST Client**: Download from [insomnia.rest](https://insomnia.rest/download)
2. **Backend Running**: Either locally (Windows) or on VPS (Ubuntu)
3. **Test Images**: Real estate photos for testing (JPEG, PNG, etc.)

## 🎯 **Testing Approaches**

### **Local Development (Windows)**
- **Full AI Testing**: Install all dependencies (`pip install -r requirements.txt`) for complete functionality
- **Core API Testing**: Test configuration, routing, and basic endpoints
- **Development Features**: Access to Swagger UI documentation at `/docs`

### **Production (VPS Ubuntu)**
- **Real AI Processing**: Full model loading with CPU/GPU optimization
- **Production Security**: API key authentication, secure headers
- **Monitoring**: Health checks, logging, and service management

---

## 🖥️ **Part 1: Testing on Windows (Local Development)**

### **Step 1: Start the Local Development Server**

**Option A: Full Production Server (Recommended)**
```bash
# In your project directory
cd C:\Users\luks_\Documents\dev\loutec\realtyphotoai

# Install all dependencies (includes AI models)
pip install -r requirements.txt

# Start the full production server
python main.py
```

**Option B: Development with Uvicorn (Alternative)**
```bash
# If you prefer uvicorn directly
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**Expected Output:**
```
🚀 Starting Real Estate Photo AI Backend
📖 API Documentation: http://localhost:8000/docs (dev only)
🔍 Health Check: http://localhost:8000/health
INFO:     Will watch for changes in these directories
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

### **Step 2: Set Up Insomnia (Windows)**

1. **Open Insomnia**
2. **Create New Collection**:
   - Click `Create` → `Request Collection`
   - Name: `Real Estate AI - Local Testing`
3. **Create Environment**:
   - Click gear icon ⚙️ → `Manage Environments`
   - Click `+` → Name: `Local Development`
   - Add variables:
   ```json
   {
     "base_url": "http://localhost:8000",
     "api_key": ""
   }
   ```

### **Step 3: Test Endpoints (Windows Local)**

#### **Test 1: Health Check**
- **Method**: `GET`
- **URL**: `{{ _.base_url }}/health`
- **Headers**: None
- **Expected Response**:
```json
{
  "status": "healthy",
  "version": "1.0.0", 
  "timestamp": "2024-01-15T10:30:00.000Z",
  "models_loaded": false,
  "dependencies": {
    "python": "3.11+",
    "fastapi": "0.100+",
    "status": "test_mode"
  }
}
```

#### **Test 2: Root Endpoint**
- **Method**: `GET`
- **URL**: `{{ _.base_url }}/`
- **Headers**: None
- **Expected Response**:
```json
{
  "name": "Real Estate Photo AI Backend",
  "version": "1.0.0",
  "status": "operational",
  "docs_url": "/docs",
  "api_prefix": "/api/v1",
  "message": "🏠 Real Estate Photo AI Backend is running!",
  "mode": "test"
}
```

#### **Test 3: Real Image Processing (Local)**
- **Method**: `POST`
- **URL**: `{{ _.base_url }}/api/v1/process-image`
- **Headers**: 
  ```
  Content-Type: multipart/form-data
  X-API-Key: {{ _.api_key }}  (if API key is set in .env)
  ```
- **Body**: 
  - Type: `Multipart Form`
  - Field: `file`
  - Value: Upload a real estate image (JPG/PNG/BMP)
- **Expected Response**:
```json
{
  "success": true,
  "message": "Image processed successfully",
  "analysis": {
    "caption": "a modern living room with furniture and decor",
    "room_type": "living_room",
    "style": "modern",
    "confidence_scores": {
      "room_type": 0.95,
      "style": 0.87
    },
    "editable_areas": [
      "furniture: sofa",
      "furniture: table"
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
      "suggestion": "Add modern coffee table with clean lines",
      "priority": "high",
      "category": "furniture",
      "estimated_impact": "high"
    }
  ],
  "processing_time": 2.34
}
```

#### **Test 4: Image Analysis Only**
- **Method**: `POST`
- **URL**: `{{ _.base_url }}/api/v1/analyze-image`
- **Headers**: 
  ```
  Content-Type: multipart/form-data
  X-API-Key: {{ _.api_key }}  (if API key is set)
  ```
- **Body**: 
  - Type: `Multipart Form`
  - Field: `file`
  - Value: Upload a real estate image
- **Expected Response**:
```json
{
  "success": true,
  "message": "Image analyzed successfully",
  "analysis": {
    "caption": "a modern living room with furniture and decor",
    "room_type": "living_room",
    "style": "modern",
    "confidence_scores": {
      "room_type": 0.95,
      "style": 0.87
    },
    "editable_areas": [
      "furniture: sofa",
      "furniture: table"
    ]
  },
  "processing_time": 1.23
}
```

#### **Test 5: API Documentation**
- **Method**: Browser
- **URL**: `http://localhost:8000/docs`
- **Expected**: Interactive Swagger UI documentation

---

## 🐧 **Part 2: Testing on VPS Ubuntu (Production)**

### **Step 1: Deploy to VPS**

```bash
# On your VPS, in the git repository
cd /home/ubuntu/apps/realtyphotoai

# Run the deployment script
chmod +x deploy.sh
./deploy.sh

# After deployment completes, configure environment
nano /home/ubuntu/apps/server/.env

# Start services
sudo systemctl daemon-reload
sudo systemctl enable realestate-ai-backend
sudo systemctl start realestate-ai-backend
sudo systemctl restart nginx

# Verify services are running
sudo systemctl status realestate-ai-backend
sudo systemctl status nginx
```

### **Step 2: Set Up Insomnia (VPS Testing)**

1. **Create New Environment**:
   - Name: `VPS Production`
   - Variables:
   ```json
   {
     "base_url": "http://your-vps-ip-address",
     "api_key": "your-production-api-key"
   }
   ```
   
   **Replace**:
   - `your-vps-ip-address` with your actual VPS IP (e.g., `http://31.97.147.23`)
   - `your-production-api-key` with your actual API key from `.env`

### **Step 3: Test VPS Endpoints**

#### **Test 1: VPS Health Check**
- **Method**: `GET`
- **URL**: `{{ _.base_url }}/health`
- **Headers**: 
  ```
  X-API-Key: {{ _.api_key }}
  ```
- **Expected Response**:
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

#### **Test 2: VPS Root Endpoint**
- **Method**: `GET`
- **URL**: `{{ _.base_url }}/`
- **Headers**: None
- **Expected Response**:
```json
{
  "name": "Real Estate Photo AI Backend",
  "version": "1.0.0",
  "status": "operational",
  "docs_url": "disabled",
  "api_prefix": "/api/v1"
}
```

#### **Test 3: Real Image Processing (VPS)**
- **Method**: `POST`
- **URL**: `{{ _.base_url }}/api/v1/process-image`
- **Headers**:
  ```
  X-API-Key: {{ _.api_key }}
  Content-Type: multipart/form-data
  ```
- **Body**: 
  - Type: `Multipart Form`
  - Field: `file`
  - Value: Upload a real estate image (JPG/PNG)
- **Expected Response**:
```json
{
  "success": true,
  "message": "Image processed successfully",
  "analysis": {
    "caption": "a modern living room with furniture and decor",
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
      "suggestion": "Add modern coffee table with clean lines",
      "priority": "high",
      "category": "furniture",
      "estimated_impact": "high"
    }
  ],
  "processing_time": 3.45
}
```

---

## 🚨 **Troubleshooting Guide**

### **Windows Local Issues**

1. **Port 8000 already in use**:
   ```bash
   # Kill existing processes
   taskkill /f /im python.exe
   # Or use a different port
   uvicorn main:app --port 8001
   ```

2. **Module not found errors (AI dependencies)**:
   ```bash
   # Install full requirements for AI functionality
   pip install -r requirements.txt
   
   # Or install core dependencies only
   pip install fastapi uvicorn python-multipart pydantic pydantic-settings
   ```

3. **AI models not loading**:
   ```bash
   # Check if CUDA is available (optional)
   python -c "import torch; print(f'CUDA available: {torch.cuda.is_available()}')"
   
   # Set CPU mode in .env file
   echo "DEVICE=cpu" >> .env
   ```

4. **CORS errors in browser**:
   - ✅ Already configured in the FastAPI app

### **VPS Ubuntu Issues**

1. **Service not starting**:
   ```bash
   # Check logs
   sudo journalctl -u realestate-ai-backend -f
   
   # Check status
   sudo systemctl status realestate-ai-backend
   
   # Restart service
   sudo systemctl restart realestate-ai-backend
   ```

2. **Nginx not working**:
   ```bash
   # Test nginx config
   sudo nginx -t
   
   # Restart nginx
   sudo systemctl restart nginx
   
   # Check nginx status
   sudo systemctl status nginx
   ```

3. **API key authentication**:
   - Make sure `API_KEY` is set in `/home/ubuntu/apps/server/.env`
   - Include `X-API-Key` header in all requests

4. **File upload issues**:
   ```bash
   # Check permissions
   ls -la /home/ubuntu/apps/server/uploads/
   
   # Fix permissions if needed
   sudo chown -R ubuntu:ubuntu /home/ubuntu/apps/server/
   chmod -R 777 /home/ubuntu/apps/server/uploads/
   ```

---

## 📊 **Testing Checklist**

### **Local Windows Testing**
- [ ] Health check returns "healthy" status
- [ ] Root endpoint shows API information
- [ ] Real image processing works (with AI models)
- [ ] Image analysis returns detailed results
- [ ] Swagger UI accessible at /docs (development mode)
- [ ] File upload validation works

### **VPS Production Testing**
- [ ] Health check returns "healthy" with models_loaded: true
- [ ] Authentication works with API key
- [ ] Real image upload works
- [ ] Image analysis returns real results
- [ ] Enhancement suggestions generated
- [ ] Response times under 5 seconds

### **Performance Testing**
- [ ] Multiple concurrent requests
- [ ] Large image files (up to 10MB)
- [ ] Different image formats (JPG, PNG, BMP)
- [ ] Invalid file uploads handled gracefully

### **Security Testing**
- [ ] API key required (if enabled)
- [ ] Invalid API key rejected
- [ ] File size limits enforced
- [ ] Invalid file types rejected

---

## 🎯 **Expected Response Times**

| Endpoint | Local (Windows) | VPS (Ubuntu) |
|----------|----------------|--------------|
| `/health` | < 100ms | < 200ms |
| `/` | < 100ms | < 200ms |
| `/api/v1/test` | < 100ms | < 200ms |
| `/api/v1/process-image` (mock) | < 500ms | N/A |
| `/api/v1/process-image` (real) | N/A | 2-5 seconds |

---

## 🎉 **Success Criteria**

### **Local Testing (Windows)**
✅ All API endpoints respond correctly  
✅ AI models load successfully  
✅ Real image processing works  
✅ No errors in console  
✅ Swagger UI loads (dev mode)  
✅ CORS works for web requests  

### **Production Testing (VPS)**
✅ Real AI processing works  
✅ Image analysis accurate  
✅ Enhancement suggestions relevant  
✅ Authentication secure  
✅ File uploads handle properly  
✅ Services auto-restart on failure  

---

## 📞 **Need Help?**

1. **Check Application Logs**:
   - Local: Console output
   - VPS: `sudo journalctl -u realestate-ai-backend -f`

2. **Test Direct URLs**:
   - Local: `http://localhost:8000/docs`
   - VPS: `curl http://your-vps-ip/health`

3. **Verify Configuration**:
   - Local: Check `main.py` is running and models loaded
   - VPS: Check `.env` file and service status

**Your Real Estate Photo AI Backend is now ready for comprehensive testing!** 🚀 