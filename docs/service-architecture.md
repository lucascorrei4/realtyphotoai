# Service Architecture - Model-Specific Services

## 🎯 **Overview**

This document describes the new service architecture that separates each AI model into its own specialized service. This approach ensures that each model's specific parameters and requirements are preserved exactly as tested.

## 🏗️ **Architecture Design**

### **Before (Monolithic)**
- Single `ReplicateService` handling all models
- Generic parameter mapping that could break model-specific requirements
- Risk of parameter conflicts between different models

### **After (Specialized Services)**
- Each model gets its own dedicated service
- Model-specific parameters are hardcoded and cannot be changed
- Clear separation of concerns
- Easy to maintain and debug

## 🔧 **Service Structure**

```
src/services/
├── replicateService.ts          # Main service (delegates to specialized services)
├── interiorDesignService.ts     # Interior Design model service
├── elementReplacementService.ts # Element Replacement model service
└── imageEnhancementService.ts   # Image Enhancement model service
```

## 📋 **Service Details**

### 1. **InteriorDesignService**
- **Model**: `adirik/interior-design:76604baddc85b1b4616e1c6475eca080da339c8875bd4996705440484a6eac38`
- **Purpose**: Interior design and furniture placement
- **Parameters**: Fixed and tested - cannot be changed
- **Image Format**: Raw base64 (no data URL prefix)

### 2. **ElementReplacementService**
- **Model**: `black-forest-labs/flux-kontext-pro:aa776ca45ce7f7d185418f700df8ec6ca6cb367bfd88e9cd225666c4c179d1d7`
- **Purpose**: Replace elements in images
- **Parameters**: Fixed and tested - cannot be changed
- **Image Format**: Data URL format (`data:image/jpeg;base64,{base64}`)

### 3. **ImageEnhancementService**
- **Model**: `bria/increase-resolution:9ccbba9d7165d73c331075144c562dd84c750bb4267d84b3f1f675a156570c99`
- **Purpose**: Increase image resolution and quality
- **Parameters**: Fixed and tested - cannot be changed
- **Image Format**: Data URL format (`data:image/jpeg;base64,{base64}`)

## 🔄 **How It Works**

### **Main Service Delegation**
The main `ReplicateService` now acts as a coordinator, delegating specific model calls to the appropriate specialized service:

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

### **API Compatibility**
- **No breaking changes** to existing API endpoints
- All existing methods continue to work exactly as before
- Controllers and routes remain unchanged
- Backward compatibility is maintained

## ✅ **Benefits**

### **1. Parameter Safety**
- Each model's parameters are hardcoded and cannot be accidentally changed
- No risk of generic parameter mapping breaking model-specific requirements
- Clear documentation of what parameters each model needs

### **2. Maintainability**
- Easy to find and fix issues with specific models
- Clear separation of concerns
- Each service can be tested independently

### **3. Scalability**
- Easy to add new models by creating new specialized services
- No need to modify existing services when adding new functionality
- Clear pattern for future development

### **4. Debugging**
- Easy to identify which service is causing issues
- Clear logging with service-specific prefixes
- Isolated error handling per model

## ⚠️ **Critical Rules**

### **DO NOT CHANGE**
1. **Model IDs**: The exact model identifiers are tested and working
2. **Parameters**: All parameters are fixed and tested - changing them will break functionality
3. **Image Formats**: Each model has specific image format requirements
4. **Service Structure**: The delegation pattern must be maintained

### **DO CHANGE**
1. **Logging**: Add more detailed logging as needed
2. **Error Handling**: Improve error messages and handling
3. **Documentation**: Update documentation when adding new features
4. **Tests**: Add tests for new functionality

## 🚀 **Adding New Models**

### **Step 1: Create Specialized Service**
```typescript
// src/services/newModelService.ts
export class NewModelService {
  private readonly modelId = 'owner/model-name:version';
  
  public async processImage(...) {
    // Model-specific implementation
  }
}
```

### **Step 2: Add to Main Service**
```typescript
export class ReplicateService {
  private readonly newModelService: NewModelService;
  
  constructor() {
    this.newModelService = new NewModelService();
  }
  
  public async processWithNewModel(...) {
    return this.newModelService.processImage(...);
  }
}
```

### **Step 3: Update Documentation**
- Add model details to `docs/model-versioning-strategy.md`
- Update this architecture document
- Document any new parameters or requirements

## 🔍 **Troubleshooting**

### **Common Issues**

1. **Parameter Mismatch**: Ensure you're using the specialized service for each model
2. **Image Format**: Check that images are in the correct format for each model
3. **Service Initialization**: Verify all services are properly initialized in the constructor

### **Debugging Steps**

1. Check service logs for specific model calls
2. Verify parameter values in specialized services
3. Ensure image conversion is happening correctly
4. Check that the right service is being called

## 📚 **Related Documentation**

- `docs/model-versioning-strategy.md` - Model-specific parameters and requirements
- `src/services/` - Implementation of all services
- `src/controllers/` - API endpoints that use these services

## 🎉 **Conclusion**

This new architecture provides:
- **Safety**: Parameters cannot be accidentally changed
- **Clarity**: Each model has its own dedicated service
- **Maintainability**: Easy to debug and extend
- **Compatibility**: No breaking changes to existing APIs

The specialized services ensure that each AI model works exactly as intended, with no risk of parameter conflicts or format mismatches.
