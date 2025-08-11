# Interior Design AI Enhancement Guide

This guide explains how to consistently achieve high-quality interior design results like the ones shown in your examples, where room structure is perfectly preserved while adding beautiful furniture and decor.

## 🎯 Key Strategies for Structure Preservation

### 1. Specialized Interior Design Model
We've upgraded from basic Stable Diffusion to the **adirik/interior-design** model, which is specifically trained for furniture placement and interior design:

```bash
STABLE_DIFFUSION_MODEL=adirik/interior-design
```

**Why this works:** This model understands spatial relationships, furniture proportions, and architectural constraints better than general-purpose models.

### 2. ControlNet for Structure Preservation
ControlNet ensures the original room architecture is maintained:

```bash
USE_CONTROLNET=true
CONTROLNET_MODEL=canny
CONTROLNET_STRENGTH=0.8
```

**How it works:** ControlNet uses edge detection to create a "structural map" of your room, preventing the AI from modifying walls, windows, or architectural features.

### 3. Optimized Parameter Settings
These settings have been fine-tuned for interior design:

```bash
STRUCTURE_PRESERVATION_STRENGTH=0.4  # Lower = more structure preservation
```

## 🚀 How to Use the Enhanced Features

### Quality Presets
Choose the right quality level for your needs:

- **Fast** (15 steps): Quick results for testing
- **Balanced** (25 steps): ⭐ **Recommended** - Best quality/speed ratio
- **High** (35 steps): Professional quality
- **Ultra** (50 steps): Maximum quality for final outputs

### API Usage Examples

#### Basic Request
```bash
curl -X POST http://localhost:8000/api/v1/process-image \
  -F "image=@your_room.jpg" \
  -F "style=modern" \
  -F "qualityPreset=balanced"
```

#### Advanced Request with ControlNet
```bash
curl -X POST http://localhost:8000/api/v1/process-image \
  -F "image=@your_room.jpg" \
  -F "style=contemporary" \
  -F "useControlNet=true" \
  -F "controlNetType=canny" \
  -F "controlNetStrength=0.8" \
  -F "qualityPreset=high"
```

#### Custom Prompt
```bash
curl -X POST http://localhost:8000/api/v1/process-image \
  -F "image=@your_room.jpg" \
  -F "prompt=luxury living room with velvet sofa and marble coffee table" \
  -F "qualityPreset=ultra"
```

## 🎨 Style Options

The system now includes optimized prompts for different interior design styles:

- **modern**: Clean lines, minimalist furniture, neutral colors
- **contemporary**: Sleek furniture, bold accents, modern art
- **traditional**: Classic furniture, warm wood tones, elegant fabrics
- **rustic**: Natural wood, cozy textures, farmhouse elements
- **scandinavian**: Light wood, white tones, hygge atmosphere
- **industrial**: Exposed elements, metal fixtures, urban loft aesthetic
- **bohemian**: Eclectic mix, colorful textiles, artistic elements
- **luxury**: High-end furniture, rich materials, sophisticated ambiance

## 📊 New API Endpoints

### Get Quality Presets
```bash
GET /api/v1/quality-presets
```

Returns available quality levels with descriptions.

### Get Model Information
```bash
GET /api/v1/model-info
```

Returns current model configuration and capabilities.

## 🔧 Parameter Optimization

### For Maximum Structure Preservation
```json
{
  "useControlNet": true,
  "controlNetType": "canny",
  "controlNetStrength": 0.9,
  "strength": 0.3,
  "qualityPreset": "high"
}
```

### For Creative Freedom (more changes)
```json
{
  "useControlNet": false,
  "strength": 0.6,
  "qualityPreset": "balanced"
}
```

### For Professional Results (like your examples)
```json
{
  "style": "modern",
  "useControlNet": true,
  "controlNetType": "canny",
  "controlNetStrength": 0.8,
  "strength": 0.4,
  "qualityPreset": "high",
  "guidance": 8.0,
  "steps": 35
}
```

## 🏠 Room-Specific Tips

### Living Rooms
- Use "modern" or "contemporary" styles
- Focus on seating arrangements and coffee tables
- Include plants and lighting in prompts

### Bedrooms
- Emphasize bedding and nightstand styling
- Use softer, warmer styles like "scandinavian"
- Include window treatments

### Kitchens
- Highlight clean countertops and backsplashes
- Use "modern" style for appliance integration
- Focus on lighting and bar seating

## 🎯 Troubleshooting Common Issues

### Issue: AI changes room structure
**Solution:** Increase `controlNetStrength` to 0.9 and decrease `strength` to 0.2

### Issue: Furniture looks unrealistic
**Solution:** Use `qualityPreset: "high"` and add "realistic proportions" to custom prompts

### Issue: Colors don't match room
**Solution:** Include specific color preferences in your prompt: "warm neutral colors matching existing walls"

### Issue: Too cluttered
**Solution:** Use negative prompts: "cluttered, messy, overcrowded, too many objects"

## 📈 Expected Results

With these optimizations, you should consistently achieve:
- ✅ Perfect architectural preservation
- ✅ Realistic furniture proportions
- ✅ Professional staging quality
- ✅ Appropriate lighting and shadows
- ✅ Style consistency
- ✅ Natural-looking placement

## 🔄 Model Alternatives

If you need different capabilities, try these models:

1. **jagilley/controlnet-canny** - Maximum structure control
2. **fofr/controlnet-depth** - 3D-aware furniture placement  
3. **stability-ai/sdxl** - Higher resolution outputs

Change model in your `.env` file:
```bash
STABLE_DIFFUSION_MODEL=jagilley/controlnet-canny
```

## 💡 Pro Tips

1. **Start with balanced preset** - It gives the best results for most rooms
2. **Use ControlNet for empty rooms** - Essential for structure preservation
3. **Specify lighting** - "natural lighting" or "ambient lighting" improves realism
4. **Include architectural preservation** - This is automatically added to prompts now
5. **Test different control strengths** - 0.7-0.9 range works best for most rooms

The enhanced system is now optimized to consistently reproduce the excellent results you achieved in your examples! 