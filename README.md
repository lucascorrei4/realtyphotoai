# 🏠 Ultra-Realistic Real Estate Graphic Designer

An AI-powered agent that specializes in analyzing home photos and generating professional enhancement suggestions for real estate marketing. The agent can identify room types, architectural styles, and suggest photorealistic improvements while preserving structural elements.

> **⚠️ DEPRECATED:** This version has been completely refactored. Please use the new FastAPI backend version in the same repository.
> 
> **🚀 New Version:** See `README_NEW.md` for the modern FastAPI backend with best practices.
> **📦 VPS Deployment:** Use `deploy_vps_new.sh` for production deployment.

## ✨ Features

- **Multi-Room Support**: Living rooms, bedrooms, kitchens, bathrooms, balconies, gardens, pools, bungalows, and more
- **Style Recognition**: Identifies architectural styles (modern, traditional, rustic, industrial, etc.)
- **Intelligent Analysis**: Detects clutter, empty spaces, and editable areas
- **Photorealistic Suggestions**: Provides actionable enhancement recommendations
- **Structure Preservation**: Maintains windows, doors, and room layout integrity
- **Multiple Interfaces**: Web UI, command-line, and Python API

## 🚀 Quick Start

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd realtyphotoai
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

### Usage Options

#### 1. Web Interface (Recommended)
Launch the Gradio web interface:
```bash
python app.py
```
Then open your browser to `http://localhost:7860`

#### 2. Command Line Interface
```bash
# Basic usage
python cli.py path/to/room_image.jpg

# Detailed analysis
python cli.py path/to/room_image.jpg --verbose

# Different output format
python cli.py path/to/room_image.jpg --format detailed
```

#### 3. Python API
```python
from real_estate_agent import RealEstateGraphicDesigner

# Initialize the agent
agent = RealEstateGraphicDesigner()

# Process an image
suggestion = agent.process_image("path/to/room_image.jpg")
print(suggestion)

# Get detailed analysis
analysis = agent.analyze_image("path/to/room_image.jpg")
print(f"Room: {analysis['room_type']}")
print(f"Style: {analysis['style']}")
print(f"Suggestion: {agent.suggest_enhancement('path/to/room_image.jpg')}")
```

## 🎯 Example Enhancement Suggestions

### Living Room (Modern Style)
**Input**: Photo of a living room with outdated furniture
**Output**: `Add a sleek sectional sofa in neutral tones, remove outdated furniture`

### Kitchen (Modern Style)
**Input**: Photo of a cluttered kitchen
**Output**: `Enhance countertops with quartz surfaces, remove clutter including dishes`

### Bedroom (Traditional Style)
**Input**: Photo of a bedroom with modern elements
**Output**: `Add classic wooden bed frame, remove modern elements`

### Bathroom (Modern Style)
**Input**: Photo of a bathroom with personal items
**Output**: `Enhance vanity with modern vessel sink, remove personal toiletries`

## 🏗️ Architecture

The agent uses advanced AI models for comprehensive image analysis:

- **BLIP (Bootstrapped Language-Image Pre-training)**: For image captioning and scene understanding
- **CLIP (Contrastive Language-Image Pre-training)**: For room type and style classification
- **Custom Enhancement Database**: Curated suggestions for different room types and styles
- **Intelligent Matching**: Context-aware suggestion selection based on image analysis

## 🔧 Technical Details

### Supported Room Types
- Living Room
- Bedroom
- Kitchen
- Bathroom
- Dining Room
- Balcony
- Garden
- Pool Area
- Bungalow
- Office
- Basement

### Supported Styles
- Modern
- Contemporary
- Traditional
- Rustic
- Industrial
- Minimalist
- Vintage
- Scandinavian
- Mediterranean
- Colonial

### Image Formats
- JPEG (.jpg, .jpeg)
- PNG (.png)
- BMP (.bmp)
- TIFF (.tiff)
- WebP (.webp)

## 🛠️ Requirements

- Python 3.8+
- PyTorch
- Transformers
- OpenCV
- Pillow
- Gradio
- NumPy
- scikit-image

## 📊 Performance

The agent processes images efficiently:
- **Initialization**: ~10-15 seconds (model loading)
- **Analysis Time**: ~2-5 seconds per image
- **Memory Usage**: ~2-4 GB (depending on GPU availability)
- **Accuracy**: High precision in room type and style detection

## 🔒 Privacy & Security

- **Local Processing**: All image analysis happens locally
- **No Data Storage**: Images are processed in memory and not saved
- **Temporary Files**: Automatically cleaned up after processing
- **No External Calls**: Models run entirely offline after initial download

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For issues, questions, or contributions:
1. Check the existing issues
2. Create a new issue with detailed description
3. Include sample images and error messages if applicable

## 🔮 Future Enhancements

- [ ] Integration with interior design APIs
- [ ] Before/after image generation
- [ ] Cost estimation for suggested improvements
- [ ] Multi-language support
- [ ] Mobile app interface
- [ ] Batch processing capabilities

---

**Note**: This AI agent specializes in photorealistic enhancements while preserving structural elements like windows, doors, and room layout. All suggestions focus on achievable improvements using furniture, decor, lighting, and organization.