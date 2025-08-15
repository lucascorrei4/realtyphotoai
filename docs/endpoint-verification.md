# Endpoint Verification & Service Mapping

## 🎯 **Overview**

This document verifies that all API endpoints are correctly mapped to their corresponding specialized services and that the test page calls the right endpoints.

## 🔗 **API Endpoints & Service Mappings**

### **1. Interior Design Processing**
- **Endpoint**: `POST /api/v1/interior-design`
- **Controller Method**: `processImageWithInteriorDesign`
- **Service**: `InteriorDesignService.processImage()`
- **Model**: `adirik/interior-design:76604baddc85b1b4616e1c6475eca080da339c8875bd4996705440484a6eac38`
- **Test Page Tab**: 🏠 Interior Design
- **Form ID**: `uploadForm`
- **JavaScript**: Calls `/api/v1/interior-design` when checkbox is checked

### **2. Image Enhancement**
- **Endpoint**: `POST /api/v1/image-enhancement`
- **Controller Method**: `enhanceImage`
- **Service**: `ImageEnhancementService.enhanceImage()`
- **Model**: `bria/increase-resolution:9ccbba9d7165d73c331075144c562dd84c750bb4267d84b3f1f675a156570c99`
- **Test Page Tab**: ✨ Image Enhancement
- **Form ID**: `enhancementForm`
- **JavaScript**: Calls `/api/v1/image-enhancement`

### **3. Element Replacement**
- **Endpoint**: `POST /api/v1/replace-elements`
- **Controller Method**: `replaceElements`
- **Service**: `ElementReplacementService.replaceElements()`
- **Model**: `black-forest-labs/flux-kontext-pro:aa776ca45ce7f7d185418f700df8ec6ca6cb367bfd88e9cd225666c4c179d1d7`
- **Test Page Tab**: 🎨 Replace Elements
- **Form ID**: `replaceElementsForm`
- **JavaScript**: Calls `/api/v1/replace-elements`

### **4. Standard Image Processing (Fallback)**
- **Endpoint**: `POST /api/v1/process-image`
- **Controller Method**: `processImage`
- **Service**: `ReplicateService.processImage()` (main service)
- **Model**: Configurable (from `config.stableDiffusionModel`)
- **Test Page Tab**: 🏠 Interior Design (when checkbox unchecked)
- **Form ID**: `uploadForm`
- **JavaScript**: Calls `/api/v1/process-image` when interior design checkbox is unchecked

## 📋 **Route Definitions (src/routes/index.ts)**

```typescript
// Interior design processing endpoint
router.post('/interior-design', 
  processingRateLimit,
  uploadMiddleware.single('image'),
  handleUploadError,
  validateUploadedFile,
  asyncHandler(imageController.processImageWithInteriorDesign)
);

// Image enhancement endpoint
router.post('/image-enhancement', 
  processingRateLimit,
  uploadMultipleMiddleware.fields([
    { name: 'image', maxCount: 1 },
    { name: 'referenceImage', maxCount: 1 }
  ]),
  handleUploadError,
  asyncHandler(imageController.enhanceImage)
);

// Element replacement endpoint
router.post('/replace-elements', 
  processingRateLimit,
  uploadMultipleMiddleware.fields([
    { name: 'image', maxCount: 1 }
  ]),
  handleUploadError,
  asyncHandler(imageController.replaceElements)
);

// Main image processing endpoint
router.post('/process-image', 
  processingRateLimit,
  uploadMiddleware.single('image'),
  handleUploadError,
  validateUploadedFile,
  asyncHandler(imageController.processImage)
);
```

## 🔄 **Service Delegation Flow**

### **Main ReplicateService (Coordinator)**
```typescript
export class ReplicateService {
  private readonly interiorDesignService: InteriorDesignService;
  private readonly elementReplacementService: ElementReplacementService;
  private readonly imageEnhancementService: ImageEnhancementService;

  constructor() {
    // Initialize specialized services
    this.interiorDesignService = new InteriorDesignService();
    this.elementReplacementService = new ElementReplacementService();
    this.imageEnhancementService = new ImageEnhancementService();
  }

  // Delegate to specialized services
  public async processImageWithInteriorDesign(...) {
    return this.interiorDesignService.processImage(...);
  }

  public async replaceElements(...) {
    return this.elementReplacementService.replaceElements(...);
  }

  public async enhanceImage(...) {
    return this.imageEnhancementService.enhanceImage(...);
  }
}
```

### **Controller Method Mappings**
```typescript
// src/controllers/imageController.ts

// Interior Design → InteriorDesignService
public processImageWithInteriorDesign = async (req: Request, res: Response): Promise<void> => {
  const { outputUrl, metadata } = await this.replicateService.processImageWithInteriorDesign(
    // ... parameters
  );
};

// Image Enhancement → ImageEnhancementService  
public enhanceImage = async (req: Request, res: Response): Promise<void> => {
  const enhancedImageUrl = await this.replicateService.enhanceImage(
    // ... parameters
  );
};

// Element Replacement → ElementReplacementService
public replaceElements = async (req: Request, res: Response): Promise<void> => {
  const replacedImageUrl = await this.replicateService.replaceElements(
    // ... parameters
  );
};
```

## 🧪 **Test Page Verification**

### **HTML Structure**
- **File**: `public/test-page.html`
- **JavaScript**: `public/js/test-page.js`
- **Route**: `/test-page`

### **Form Submissions**

#### **Interior Design Form**
```javascript
// Choose endpoint based on user preference
const useInteriorDesign = document.getElementById('useInteriorDesign').checked;
const endpoint = useInteriorDesign ? '/api/v1/interior-design' : '/api/v1/process-image';

const response = await fetch(endpoint, {
  method: 'POST',
  body: formData
});
```

#### **Image Enhancement Form**
```javascript
const response = await fetch('/api/v1/image-enhancement', {
  method: 'POST',
  body: formData
});
```

#### **Element Replacement Form**
```javascript
const response = await fetch('/api/v1/replace-elements', {
  method: 'POST',
  body: formData
});
```

## ✅ **Verification Checklist**

### **✅ Endpoints Correctly Mapped**
- [x] `/api/v1/interior-design` → `InteriorDesignService`
- [x] `/api/v1/image-enhancement` → `ImageEnhancementService`
- [x] `/api/v1/replace-elements` → `ElementReplacementService`
- [x] `/api/v1/process-image` → `ReplicateService` (main service)

### **✅ Controllers Correctly Delegating**
- [x] `processImageWithInteriorDesign` → `replicateService.processImageWithInteriorDesign()`
- [x] `enhanceImage` → `replicateService.enhanceImage()`
- [x] `replaceElements` → `replicateService.replaceElements()`
- [x] `processImage` → `replicateService.processImage()`

### **✅ Services Correctly Initialized**
- [x] `InteriorDesignService` in `ReplicateService` constructor
- [x] `ElementReplacementService` in `ReplicateService` constructor
- [x] `ImageEnhancementService` in `ReplicateService` constructor

### **✅ Test Page Correctly Calling Endpoints**
- [x] Interior Design form → `/api/v1/interior-design` or `/api/v1/process-image`
- [x] Image Enhancement form → `/api/v1/image-enhancement`
- [x] Element Replacement form → `/api/v1/replace-elements`

### **✅ Static File Serving**
- [x] `/js/*` → `public/js/` directory
- [x] `/css/*` → `public/css/` directory
- [x] `/test-page` → `public/test-page.html`

## 🚀 **How to Test**

### **1. Start the Server**
```bash
npm run dev
```

### **2. Access Test Page**
- Navigate to: `http://localhost:3000/test-page`
- Verify all three tabs are working
- Test each form submission

### **3. Verify API Calls**
- Open browser DevTools → Network tab
- Submit forms and verify correct endpoints are called
- Check that responses contain expected data structure

### **4. Verify Service Logging**
- Check server logs for service-specific logging
- Verify correct models are being used for each endpoint

## 🔍 **Troubleshooting**

### **Common Issues**

1. **404 on `/js/test-page.js`**
   - Verify `public/js/` directory exists
   - Check static file serving middleware

2. **Wrong Service Called**
   - Verify controller method names match routes
   - Check service initialization in `ReplicateService` constructor

3. **Model Parameters Wrong**
   - Verify specialized services have correct hardcoded parameters
   - Check model IDs in each service

4. **Test Page Not Loading**
   - Verify `/test-page` route exists
   - Check file path in `res.sendFile()`

## 📚 **Related Files**

- **Routes**: `src/routes/index.ts`
- **Controller**: `src/controllers/imageController.ts`
- **Main Service**: `src/services/replicateService.ts`
- **Specialized Services**:
  - `src/services/interiorDesignService.ts`
  - `src/services/elementReplacementService.ts`
  - `src/services/imageEnhancementService.ts`
- **Test Page**: `public/test-page.html`
- **Test JavaScript**: `public/js/test-page.js`
- **Configuration**: `src/config/index.ts`

## 🎉 **Conclusion**

All endpoints are correctly mapped to their specialized services, and the test page properly calls the right endpoints for each functionality. The architecture ensures that each model's specific parameters are preserved and that there's clear separation of concerns between different AI models.
