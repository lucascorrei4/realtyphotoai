#!/bin/bash
# Quick setup script for Real Estate Graphic Designer Demo

echo "🏠 Real Estate Graphic Designer - Quick Setup"
echo "============================================="

# Check Python version
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required but not installed."
    echo "Please install Python 3.8+ from https://python.org"
    exit 1
fi

PYTHON_VERSION=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
echo "✅ Python $PYTHON_VERSION found"

# Install Pillow
echo "📦 Installing Pillow..."
pip3 install Pillow

# Create sample images
echo "🖼️ Creating sample images..."
python3 create_samples.py

echo ""
echo "🎉 Setup complete! You can now:"
echo ""
echo "1. Web Interface:"
echo "   python3 demo_web.py"
echo "   Then open: http://localhost:8000"
echo ""
echo "2. Command Line:"
echo "   python3 demo_agent.py modern_kitchen.jpg --verbose"
echo ""
echo "3. Test with your own images:"
echo "   python3 demo_agent.py /path/to/your/room_photo.jpg"
echo ""
echo "📋 Sample images created for testing:"
echo "   - modern_kitchen.jpg"
echo "   - traditional_bedroom.jpg" 
echo "   - cluttered_living_room.jpg"
echo "   - empty_bathroom.jpg"
echo ""
echo "Happy testing! 🚀"