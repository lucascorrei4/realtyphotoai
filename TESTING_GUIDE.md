# 🧪 Testing Guide: Ultra-Realistic Real Estate Graphic Designer

This guide explains how to test the Real Estate Graphic Designer agent with images. **No webhooks needed** - you can upload images directly!

## 🚀 Quick Start Testing

### Method 1: Web Interface (Easiest) ⭐

```bash
# Start the demo web server
python3 demo_web.py
```

Then:
1. **Open your browser** to `http://localhost:8000`
2. **Upload any room image** (JPG, PNG, etc.)
3. **Click "Generate Enhancement Suggestion"**
4. **See results** instantly!

### Method 2: Command Line Interface

```bash
# Test with sample images
python3 demo_agent.py modern_kitchen.jpg --verbose
python3 demo_agent.py cluttered_living_room.jpg
python3 demo_agent.py traditional_bedroom.jpg --verbose

# Test with your own images
python3 demo_agent.py /path/to/your/room_photo.jpg --verbose
```

### Method 3: Python API

```python
from demo_agent import DemoRealEstateGraphicDesigner

# Initialize agent
agent = DemoRealEstateGraphicDesigner()

# Process an image
suggestion = agent.process_image("modern_kitchen.jpg")
print(f"Suggestion: {suggestion}")

# Get detailed analysis
analysis = agent.analyze_image("modern_kitchen.jpg")
print(f"Room: {analysis['room_type']}")
print(f"Style: {analysis['style']}")
print(f"Size: {analysis['image_properties']['width']}x{analysis['image_properties']['height']}")
```

## 📸 Sample Images Included

We've created sample images for testing:

| Image | Room Type | Style | Expected Suggestion |
|-------|-----------|-------|-------------------|
| `modern_kitchen.jpg` | Kitchen | Modern | "Enhance countertops with quartz surfaces, remove clutter including dishes" |
| `traditional_bedroom.jpg` | Bedroom | Traditional | "Add classic wooden bed frame, remove modern elements" |
| `cluttered_living_room.jpg` | Living Room | Modern | "Add modern coffee table with clean lines, declutter surfaces, remove clutter and personal items" |
| `empty_bathroom.jpg` | Bathroom | Modern | "Enhance vanity with modern vessel sink, remove personal toiletries" |
| `rustic_kitchen.jpg` | Kitchen | Rustic | Kitchen-specific rustic suggestions |
| `contemporary_bedroom.jpg` | Bedroom | Contemporary | Modern bedroom enhancements |
| `minimalist_bathroom.jpg` | Bathroom | Minimalist | Clean, minimal bathroom suggestions |

## 🔧 Testing Different Scenarios

### 1. Room Type Detection

Name your images with room types to test detection:
- `kitchen_photo.jpg` → Detects as kitchen
- `bedroom_image.jpg` → Detects as bedroom  
- `living_room_pic.jpg` → Detects as living room
- `bathroom_shot.jpg` → Detects as bathroom
- `balcony_view.jpg` → Detects as balcony

### 2. Style Recognition

Include style keywords in filenames:
- `modern_kitchen.jpg` → Modern style
- `traditional_bedroom.jpg` → Traditional style
- `rustic_living_room.jpg` → Rustic style
- `contemporary_bathroom.jpg` → Contemporary style

### 3. Clutter Detection

Test clutter analysis:
- `cluttered_kitchen.jpg` → Includes clutter removal suggestions
- `messy_bedroom.jpg` → Detects high clutter level
- `clean_living_room.jpg` → Low clutter level

### 4. Empty Space Detection

Test space utilization:
- `empty_room.jpg` → Suggests adding furniture
- `minimal_space.jpg` → Focuses on additions
- `spacious_kitchen.jpg` → Utilizes empty areas

## 🌐 Web Interface Testing

### Starting the Web Server

```bash
python3 demo_web.py
```

### Using the Web Interface

1. **Upload Methods:**
   - Drag and drop images
   - Click to browse files
   - Supports: JPG, PNG, GIF, WebP, BMP

2. **File Naming Tips:**
   - `modern_kitchen.jpg` → Modern kitchen suggestions
   - `traditional_bedroom.jpg` → Traditional bedroom ideas
   - `cluttered_living_room.jpg` → Includes clutter removal
   - `empty_bathroom.jpg` → Focuses on adding elements

3. **Expected Response:**
   ```json
   {
     "room_type": "kitchen",
     "style": "modern", 
     "suggestion": "Enhance countertops with quartz surfaces, remove clutter including dishes",
     "width": 800,
     "height": 600,
     "filename": "modern_kitchen.jpg"
   }
   ```

## 📱 Testing with Real Photos

### Best Practices for Real Room Photos

1. **Image Quality:**
   - Good lighting
   - Clear view of the room
   - Minimal motion blur
   - Resolution: 400x300 minimum

2. **Room Coverage:**
   - Include main furniture
   - Show room layout
   - Capture key elements (counters, beds, etc.)

3. **File Naming:**
   - Include room type: `my_kitchen.jpg`
   - Include style if known: `modern_living_room.jpg`
   - Include condition: `cluttered_bedroom.jpg`

### Example Real Photo Tests

```bash
# Test your own photos
python3 demo_agent.py ~/Photos/kitchen.jpg --verbose
python3 demo_agent.py ~/Downloads/bedroom_photo.png
python3 demo_agent.py ./my_living_room.jpg --verbose
```

## 🔍 Advanced Testing

### Batch Testing Multiple Images

```bash
# Test multiple images at once
for img in *.jpg; do
    echo "Testing: $img"
    python3 demo_agent.py "$img"
    echo "---"
done
```

### API Integration Testing

```python
import os
from demo_agent import DemoRealEstateGraphicDesigner

agent = DemoRealEstateGraphicDesigner()

# Test all sample images
image_files = [
    "modern_kitchen.jpg",
    "traditional_bedroom.jpg", 
    "cluttered_living_room.jpg",
    "empty_bathroom.jpg"
]

for img in image_files:
    if os.path.exists(img):
        print(f"\n=== Testing {img} ===")
        analysis = agent.analyze_image(img)
        suggestion = agent.suggest_enhancement(img)
        
        print(f"Room: {analysis['room_type']}")
        print(f"Style: {analysis['style']}")
        print(f"Suggestion: {suggestion}")
```

## 🐛 Troubleshooting

### Common Issues

1. **"Image file not found"**
   - Check file path is correct
   - Ensure image exists in current directory

2. **"Invalid image file"**
   - Verify image format (JPG, PNG, etc.)
   - Check if file is corrupted

3. **"No module named 'PIL'"**
   - Install Pillow: `pip install --break-system-packages Pillow`

4. **Web server not starting**
   - Check if port 8000 is available
   - Try different port: modify `port = 8001` in `demo_web.py`

### Error Examples

```bash
# File not found
python3 demo_agent.py nonexistent.jpg
# Output: Error processing image: Image file not found: nonexistent.jpg

# Invalid file
python3 demo_agent.py textfile.txt  
# Output: Error processing image: Invalid image file: ...

# Verbose mode for debugging
python3 demo_agent.py image.jpg --verbose
```

## 📊 Expected Results

### Sample Output Format

```
🏠 Demo Real Estate Graphic Designer
==================================================
Processing: modern_kitchen.jpg

📊 Analysis Results:
  Room Type: kitchen
  Style: modern
  Caption: a modern kitchen with furniture and decor
  Clutter Level: low
  Space Utilization: well-utilized
  Image Size: 800x600
  Editable Areas: 4 found
    - furniture: sofa
    - lighting: lamp
    - decor: pillow
    - surfaces: table

🎨 Enhancement Suggestion:
------------------------------
Enhance countertops with quartz surfaces, remove clutter including dishes

✓ Demo analysis complete!
```

## 🚀 Next Steps

After testing the demo:

1. **Install Full Version:**
   ```bash
   pip install -r requirements.txt
   python3 app.py  # Full Gradio interface
   ```

2. **Use Real AI Models:**
   - The demo uses simulated AI
   - Full version uses BLIP and CLIP models
   - More accurate room and style detection

3. **Integration:**
   - Add to your real estate website
   - Integrate with property management systems
   - Create mobile apps

## 🎯 Success Criteria

Your testing is successful if:
- ✅ Images upload without errors
- ✅ Room types are correctly identified
- ✅ Styles are reasonably detected
- ✅ Suggestions are relevant and actionable
- ✅ Clutter detection works as expected
- ✅ Web interface is responsive
- ✅ CLI processes images quickly

---

**Remember:** This is a demo version for testing. The full version with AI models provides more accurate analysis and suggestions!