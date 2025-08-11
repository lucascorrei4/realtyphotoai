# 🏠 Real Estate Photo AI - Enhanced Interior Design

Professional Node.js backend for AI-powered real estate photo enhancement that **preserves original room structure** while adding beautiful furniture and decor.

## 🎯 Achieving ChatGPT-Quality Results

This system is designed to reproduce the high-quality interior design results similar to ChatGPT, where the **original room architecture is perfectly preserved** while only adding furniture and decorative elements.

### ✅ What Good Results Look Like:
- **Kitchen islands stay in exact same position**
- **Windows and doors remain unchanged**
- **Ceiling features (fans, lights) are preserved**
- **Wall positions and angles identical**
- **Only furniture added to empty floor space**

### ❌ What to Avoid:
- Changing room layout or dimensions
- Moving windows or doors
- Altering ceiling features
- Removing architectural elements
- Adding walls or structural changes

## 🚀 Quick Start

### 1. Setup
```bash
npm install
cp env.example .env
# Add your REPLICATE_API_TOKEN to .env
npm run dev
```

### 2. Test Pages
- **Enhanced Test Page**: `http://localhost:8000/test-enhanced` - Full featured with ControlNet
- **Simple Test Page**: `http://localhost:8000/test` - Basic interface

## 🔧 Critical Configuration for Structure Preservation

### .env File Settings
```bash
# ESSENTIAL: Use working Stable Diffusion model with version
STABLE_DIFFUSION_MODEL=stability-ai/stable-diffusion:latest

# EXTREME STRUCTURE PRESERVATION
USE_CONTROLNET=true
CONTROLNET_MODEL=canny
CONTROLNET_STRENGTH=1.0
STRUCTURE_PRESERVATION_STRENGTH=0.1

# MINIMAL CHANGE PROMPTING
DEFAULT_PROMPT=add only a modern sectional sofa to the center of this empty living room, keep everything else exactly the same, preserve kitchen island, windows, doors, ceiling, and all architectural features identical
NEGATIVE_PROMPT=changing room layout, moving kitchen island, altering windows, different ceiling, modified walls, architectural changes, extra furniture, multiple items, cluttered, structural modifications
```

## 📋 Step-by-Step Testing Protocol

### Phase 1: Single Furniture Item
1. **Upload your empty room image**
2. **Use these EXACT settings:**
   - Style: `Modern`
   - Quality: `High` (35 steps)
   - ControlNet: `✅ ENABLED`
   - ControlNet Type: `Canny Edge`
   - ControlNet Strength: `1.0`
   - Structure Preservation: `0.8-1.0`
   - Transformation Strength: `0.1-0.2`
3. **Custom Prompt:** `"add only one modern sectional sofa to the living room center, preserve kitchen island and all architecture exactly"`
4. **Negative Prompt:** `"changing kitchen island, moving windows, altering room layout, architectural modifications"`

### Phase 2: If Phase 1 Works, Add More
- Add coffee table
- Add area rug
- Add plants
- Add lighting

### Phase 3: Full Staging (Only After Phase 1-2 Success)
- Multiple furniture pieces
- Complete room decoration

## 🎛️ Parameter Guide

### ControlNet Settings
| Setting | Value | Effect |
|---------|-------|--------|
| **ControlNet Strength** | `1.0` | Maximum structural control |
| **Structure Preservation** | `0.8-1.0` | Higher = more preservation |
| **Transformation Strength** | `0.1-0.2` | Lower = minimal changes |

### Quality Settings
| Preset | Steps | When to Use |
|--------|-------|-------------|
| **Fast** | 15 | Quick testing |
| **Balanced** | 25 | General use |
| **High** | 35 | ⭐ **Best for structure preservation** |
| **Ultra** | 50 | Maximum quality |

## 🔍 Troubleshooting Guide

### Problem: Room layout completely changes
**Solution:**
- Increase ControlNet Strength to `1.0`
- Decrease Transformation Strength to `0.1`
- Use more specific prompts about preserving architecture
- Try `depth` ControlNet instead of `canny`

### Problem: Kitchen island disappears or moves
**Solution:**
- Add to prompt: `"preserve kitchen island in exact same position"`
- Add to negative: `"moving kitchen island, altering kitchen"`
- Lower transformation strength to `0.1`

### Problem: Windows change size or position
**Solution:**
- Add to prompt: `"keep all windows identical"`
- Add to negative: `"changing windows, different window size"`
- Use `High` or `Ultra` quality for better detail preservation

### Problem: Too many furniture items added
**Solution:**
- Start with single item prompts: `"add only one sofa"`
- Use negative prompts: `"multiple furniture, cluttered, extra items"`
- Build up gradually in separate generations

## 📱 API Usage Examples

### Basic Structure Preservation
```bash
curl -X POST http://localhost:8000/api/v1/process-image \
  -F "image=@room.jpg" \
  -F "style=modern" \
  -F "useControlNet=true" \
  -F "controlNetType=canny" \
  -F "controlNetStrength=1.0" \
  -F "strength=0.1" \
  -F "qualityPreset=high" \
  -F "prompt=add only one modern sofa, preserve all architecture"
```

### Advanced Settings
```bash
curl -X POST http://localhost:8000/api/v1/process-image \
  -F "image=@room.jpg" \
  -F "style=modern" \
  -F "useControlNet=true" \
  -F "controlNetType=canny" \
  -F "controlNetStrength=1.0" \
  -F "strength=0.1" \
  -F "guidance=8.0" \
  -F "steps=35" \
  -F "prompt=add modern furniture preserving exact kitchen island position and all windows" \
  -F "negativePrompt=changing room layout, moving kitchen island, altering windows"
```

## 🏗️ Architecture & Features

### Enhanced Features
- ✅ **ControlNet Structure Preservation** - Maintains room architecture
- ✅ **Smart Prompting System** - Optimized for interior design
- ✅ **Quality Presets** - Fast/Balanced/High/Ultra options
- ✅ **Multiple Interior Styles** - 8 professional design styles
- ✅ **Advanced Parameter Control** - Fine-tune every aspect

### File Structure
```
src/
├── controllers/imageController.ts    # Main API logic
├── services/replicateService.ts     # AI model integration
├── utils/promptingUtils.ts          # Smart prompting system
├── utils/maskingUtils.ts            # Structure preservation
└── routes/index.ts                  # API endpoints
```

## 📊 Expected Results

### ✅ Good Results Indicators:
- Original architecture 100% preserved
- Kitchen island in exact same position
- Windows and doors unchanged
- Only furniture added to empty spaces
- Professional staging quality
- Realistic lighting and shadows

### ❌ Poor Results Indicators:
- Room dimensions changed
- Kitchen island moved/removed
- Windows different size/position
- Walls added/removed
- Unrealistic furniture placement

## 🚀 Model Alternatives

If results aren't good enough, try these models in your `.env`:

```bash
# Current (recommended for most cases)
STABLE_DIFFUSION_MODEL=stability-ai/stable-diffusion:latest

# For maximum control (if available)
# STABLE_DIFFUSION_MODEL=jagilley/controlnet-canny:version_hash

# For interior design specialization (if working)
# STABLE_DIFFUSION_MODEL=adirik/interior-design:version_hash
```

## 💡 Pro Tips for Perfect Results

1. **Start Small** - Test with one furniture item first
2. **Use High Quality** - 35+ steps for better structure preservation  
3. **Be Specific** - Mention kitchen island, windows in prompts
4. **Gradual Build-up** - Add furniture piece by piece
5. **Test Different ControlNet Types** - Try `depth` if `canny` doesn't work
6. **Lower Transformation Strength** - 0.1-0.2 for maximum preservation

## 🆘 Getting Help

If you're not getting ChatGPT-quality results:

1. **Check your `.env` settings** match the examples above
2. **Start with the single sofa test** before complex scenes
3. **Use the enhanced test page** for full control
4. **Increase ControlNet strength** to maximum (1.0)
5. **Lower transformation strength** to minimum (0.1)

The goal is to achieve results where someone looking at the before/after images can immediately recognize it's the exact same room with furniture added - just like the best ChatGPT examples.

## 🚀 Deployment to Hostinger

This repository includes a GitHub Actions workflow that builds and deploys the service to a Hostinger VPS.
1. Add secrets: `HOSTINGER_HOST`, `HOSTINGER_PORT`, `HOSTINGER_USER`, `HOSTINGER_PRIVATE_KEY`, `HOSTINGER_APP_PATH`.
2. On pushes to `main` the workflow compiles the project and uploads `dist` and configuration files via SCP.
3. After upload it installs production dependencies and reloads PM2 using `ecosystem.config.js`.

## 📄 License

MIT License - See LICENSE file for details 