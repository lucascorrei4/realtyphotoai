# Model Versioning Strategy & Model-Specific Parameters

## 🎯 **CRITICAL: Model Choices Are Fixed & Cannot Change**

This document documents the **EXACT** model choices and parameters that have been tested and proven to work. **DO NOT CHANGE THESE** without thorough testing.

## 🏠 **Interior Design Model**

### Model: `adirik/interior-design:76604baddc85b1b4616e1c6475eca080da339c8875bd4996705440484a6eac38`

**Purpose**: Specialized model for interior design and furniture placement

**Parameters**:
- `image`: Base64 image (raw base64 without data URL prefix)
- `prompt`: User's design prompt
- `negative_prompt`: "lowres, watermark, banner, logo, watermark, contactinfo, text, deformed, blurry, blur, out of focus, out of frame, surreal, extra, ugly, upholstered walls, fabric walls, plush walls, mirror, mirrored, functional, realistic"
- `prompt_strength`: 0.8 (default)
- `num_inference_steps`: 50 (default)
- `guidance_scale`: 15 (default)
- `seed`: Optional, for reproducible results

**Best For**: Living rooms, bedrooms, office spaces, furniture arrangement

---

## 🎨 **Element Replacement Model**

### Model: `black-forest-labs/flux-kontext-pro:aa776ca45ce7f7d185418f700df8ec6ca6cb367bfd88e9cd225666c4c179d1d7`

**Purpose**: Replace elements in images while maintaining structure

**Parameters**:
- `prompt`: User's transformation prompt
- `input_image`: Data URL format (`data:image/jpeg;base64,{base64}`)
- `output_format`: User's choice (jpg, png, webp)

**Best For**: Object replacement, style transfer, element modification

---

## 🚀 **Image Enhancement Model**

### Model: `bria/increase-resolution:9ccbba9d7165d73c331075144c562dd84c750bb4267d84b3f1f675a156570c99`

**Purpose**: Increase image resolution and quality

**Parameters**:
- `image`: Data URL format (`data:image/jpeg;base64,{base64}`)
- `desired_increase`: 2 (subtle), 4 (moderate), 6 (strong)

**Best For**: Resolution enhancement, quality improvement

---

## ⚠️ **IMPORTANT NOTES**

1. **Version Tags**: All models must include version tags (e.g., `:latest`, `:hash`)
2. **Parameter Formats**: Each model has specific parameter requirements that cannot be changed
3. **Image Formats**: Some models require raw base64, others require data URLs
4. **Testing Required**: Any parameter changes require thorough testing

## 🔧 **Implementation Strategy**

- **Separate Services**: Each model gets its own service with model-specific parameters
- **No Shared Logic**: Avoid generic parameter mapping that could break model-specific requirements
- **Direct Model Calls**: Use exact model identifiers and parameters as documented above
- **Preserve Defaults**: Keep all current default parameters exactly as they are

## 📋 **Current Default Parameters (DO NOT CHANGE)**

```typescript
// These are the working defaults - preserve them exactly
stableDiffusionModel: 'asiryan/juggernaut-xl-v7:latest'
defaultPrompt: 'modern furnished living room, stylish furniture, warm lighting, professional interior design, photorealistic'
defaultNegativePrompt: 'blurry, low quality, distorted, cluttered, messy, dark, poor lighting, oversaturated, unrealistic'
useControlNet: true
controlNetModel: 'depth'
controlNetStrength: 0.8
structurePreservationStrength: 0.4
defaultTransformationStrength: 0.2
```
