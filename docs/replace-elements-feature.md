# Replace Elements Feature

## Overview

The Replace Elements feature uses the **Flux Kontext Pro** model (`black-forest-labs/flux-kontext-pro`) to transform images by replacing elements or changing their artistic style while maintaining the original structure.

## What It Does

This feature can:
- Transform images into different artistic styles (cartoon, watercolor, cyberpunk, etc.)
- Replace elements within images while preserving structure
- Apply creative transformations to photos
- Generate stylized versions of existing images

## How It Works

1. **Upload Image**: Select an image file (JPG, PNG, WebP, HEIC supported)
2. **Enter Prompt**: Describe the transformation you want (e.g., "Make this a 90s cartoon")
3. **Choose Format**: Select output format (JPG, PNG, or WebP)
4. **Process**: AI processes the image using the Flux Kontext Pro model
5. **Download**: Get both original and transformed images

## Example Prompts

### Artistic Styles
- "Make this a watercolor painting"
- "Transform into anime style"
- "Convert to vintage film look"
- "Make this a cyberpunk scene"

### Element Replacements
- "Replace the car with a horse"
- "Change the background to a forest"
- "Make the building look like a castle"
- "Transform the sky to sunset colors"

## Technical Details

### Model Used
- **Model**: `black-forest-labs/flux-kontext-pro`
- **Type**: Default version (no version specified)
- **Input**: Image + text prompt
- **Output**: Transformed image in specified format

### API Endpoint
```
POST /api/v1/replace-elements
```

### Request Format
```javascript
const formData = new FormData();
formData.append('image', imageFile);
formData.append('prompt', 'Make this a 90s cartoon');
formData.append('outputFormat', 'jpg');
```

### Response Format
```json
{
  "success": true,
  "message": "Elements replaced successfully",
  "data": {
    "originalImage": "/uploads/filename.jpg",
    "replacedImage": "/outputs/transformed_filename.jpg",
    "processingTime": 45000,
    "prompt": "Make this a 90s cartoon",
    "outputFormat": "jpg",
    "modelUsed": "Flux Kontext Pro Model (black-forest-labs/flux-kontext-pro)"
  }
}
```

## Use Cases

### Real Estate Photography
- Transform modern rooms into vintage styles
- Change room aesthetics for different target markets
- Create artistic interpretations of properties

### Creative Projects
- Style transfer for artwork
- Concept development
- Visual experimentation

### Content Creation
- Social media transformations
- Marketing material variations
- Educational content styling

## Best Practices

### Prompts
- Be specific about the desired style or transformation
- Use descriptive language (e.g., "vintage 1950s diner style" vs "old style")
- Experiment with different prompt variations

### Images
- Use clear, high-quality images
- Ensure good lighting and contrast
- Keep file sizes under 10MB for optimal processing

### Output Formats
- **JPG**: Good for photos, smaller file sizes
- **PNG**: Better for graphics, supports transparency
- **WebP**: Modern format, good compression

## Limitations

- Processing time: 20-60 seconds typically
- Image size: Maximum 10MB recommended
- Style consistency: Results may vary based on input image quality
- Complex transformations: Very detailed prompts may not always produce expected results

## Troubleshooting

### Common Issues
1. **Processing fails**: Check image format and size
2. **Unexpected results**: Try different prompt wording
3. **Slow processing**: Normal for complex transformations

### Tips for Better Results
- Start with simple, clear prompts
- Use high-quality input images
- Experiment with different styles
- Combine multiple transformations for complex effects

## Future Enhancements

- Batch processing for multiple images
- Style presets for common transformations
- Advanced prompt engineering tools
- Integration with other AI models for enhanced results
