# Interior Design Model Integration

This document describes how to use the new Interior Design model integration in your RealtyPhotoAI Lab backend.

## Overview

The Interior Design model (`adirik/interior-design:76604baddc85b1b4616e1c6475eca080da339c8875bd4996705440484a6eac38`) is a specialized AI model designed specifically for interior design and furniture placement. It can transform empty or furnished rooms into beautifully designed spaces based on your descriptions.

## Features

- **Specialized for Interiors**: Optimized for room transformation and furniture placement
- **Prompt-Driven**: Uses natural language descriptions to guide the design
- **High Quality**: Produces photorealistic interior design results
- **Customizable**: Adjustable parameters for different styles and preferences

## API Endpoint

### POST `/api/v1/interior-design`

Process an image with the Interior Design model.

#### Request

- **Content-Type**: `multipart/form-data`
- **Method**: `POST`

#### Parameters

| Parameter | Type | Required | Description | Default |
|-----------|------|----------|-------------|---------|
| `image` | File | Yes | The image file to process | - |
| `prompt` | String | Yes | Description of the desired interior design | - |
| `promptStrength` | Number | No | How strongly to apply the prompt (0.0-1.0) | 0.8 |
| `numInferenceSteps` | Number | No | Number of inference steps (higher = better quality) | 25 |
| `guidanceScale` | Number | No | How closely to follow the prompt (1.0-20.0) | 7.5 |
| `seed` | Number | No | Random seed for reproducible results | Random |

#### Example Request

```bash
curl -X POST http://localhost:8000/api/v1/interior-design \
  -F "image=@bedroom.jpg" \
  -F "prompt=A bedroom with a bohemian spirit centered around a relaxed canopy bed complemented by a large macrame wall hanging. An eclectic dresser serves as a unique storage solution while an array of potted plants brings life and color to the room" \
  -F "promptStrength=0.8" \
  -F "numInferenceSteps=25" \
  -F "guidanceScale=7.5"
```

#### Response

```json
{
  "success": true,
  "message": "Interior design processing completed successfully",
  "originalImage": "/uploads/bedroom.jpg",
  "processedImage": "/outputs/interior_design_bedroom.jpg",
  "processingTime": 45000,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Usage Examples

### 1. Bohemian Bedroom

**Prompt**: "A bedroom with a bohemian spirit centered around a relaxed canopy bed complemented by a large macrame wall hanging. An eclectic dresser serves as a unique storage solution while an array of potted plants brings life and color to the room"

**Parameters**:
- `promptStrength`: 0.8
- `numInferenceSteps`: 25
- `guidanceScale`: 7.5

### 2. Modern Minimalist Living Room

**Prompt**: "A modern minimalist living room with clean lines, neutral colors, and Scandinavian furniture. Large windows with natural light, a comfortable sofa, and a coffee table with a vase of fresh flowers"

**Parameters**:
- `promptStrength`: 0.7
- `numInferenceSteps`: 30
- `guidanceScale`: 8.0

### 3. Cozy Farmhouse Kitchen

**Prompt**: "A cozy farmhouse-style kitchen with warm wooden cabinets, a farmhouse sink, vintage lighting fixtures, and rustic decor. Open shelving with mason jars and fresh herbs, a large wooden dining table"

**Parameters**:
- `promptStrength`: 0.9
- `numInferenceSteps`: 35
- `guidanceScale`: 7.0

## Parameter Guidelines

### promptStrength (0.0 - 1.0)
- **0.0-0.3**: Subtle changes, preserves original structure
- **0.4-0.6**: Moderate transformation, balanced approach
- **0.7-0.9**: Strong transformation, significant design changes
- **1.0**: Maximum transformation, may completely redesign the space

### numInferenceSteps (15 - 50)
- **15-20**: Fast processing, good for prototyping
- **25-30**: Balanced quality and speed (recommended)
- **35-50**: High quality, slower processing

### guidanceScale (1.0 - 20.0)
- **1.0-5.0**: Creative, less strict adherence to prompt
- **6.0-10.0**: Balanced creativity and accuracy (recommended)
- **11.0-20.0**: Strict adherence to prompt, less creative

## Best Practices

### Writing Effective Prompts

1. **Be Specific**: Include details about furniture, colors, materials, and style
2. **Describe the Mood**: Mention the atmosphere you want to create
3. **Include Lighting**: Describe natural or artificial lighting preferences
4. **Specify Style**: Mention design styles (modern, rustic, minimalist, etc.)
5. **Room Function**: Clarify the room's purpose and how it should feel

### Example Prompt Structure

```
[Style] [Room Type] with [Key Features], [Color Scheme], [Furniture Description], [Lighting], [Mood/Atmosphere]
```

### Image Requirements

- **Format**: JPEG, PNG, WebP, or HEIC (iOS devices)
- **Size**: Recommended 1024x1024 pixels (will be automatically resized)
- **Content**: Clear room photos work best
- **Lighting**: Good lighting helps the model understand the space

## Error Handling

The API returns appropriate HTTP status codes and error messages:

- **400**: Missing required parameters (image, prompt)
- **500**: Processing errors or model failures
- **429**: Rate limit exceeded

## Rate Limiting

The interior design endpoint has a rate limit of **10 requests per 15 minutes** to ensure quality service for all users.

## Comparison with Other Models

| Model | Best For | Speed | Quality | Control |
|-------|----------|-------|---------|---------|
| **Interior Design** | Room transformation, furniture placement | Medium | High | High |
| Juggernaut XL | Photorealistic results, general AI art | Slow | Very High | Medium |
| FLUX ControlNet | Structure preservation, architectural | Fast | Medium | Very High |

## Troubleshooting

### Common Issues

1. **Poor Results**: Try adjusting `promptStrength` and `guidanceScale`
2. **Slow Processing**: Reduce `numInferenceSteps` for faster results
3. **Prompt Not Followed**: Increase `guidanceScale` for stricter adherence
4. **Too Much Change**: Reduce `promptStrength` for subtler transformations

### Getting Help

- Check the logs for detailed error information
- Verify your Replicate API token is valid
- Ensure the image file is properly uploaded
- Test with simpler prompts first

## Integration Examples

See `examples/interior-design-example.js` for a complete working example of how to use the Interior Design API endpoint.

## Future Enhancements

- Batch processing for multiple images
- Style presets for common design themes
- Integration with furniture catalogs
- Before/after comparison tools
- Design recommendation engine
