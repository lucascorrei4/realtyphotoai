#!/usr/bin/env python3
"""
Test script for Ultra-Realistic Real Estate Graphic Designer
"""

import os
import sys
import numpy as np
from PIL import Image, ImageDraw
from real_estate_agent import RealEstateGraphicDesigner

def create_sample_room_image(room_type="living_room", style="modern"):
    """Create a sample room image for testing"""
    # Create a simple room image
    width, height = 800, 600
    image = Image.new('RGB', (width, height), color='white')
    draw = ImageDraw.Draw(image)
    
    if room_type == "living_room":
        # Draw a simple living room
        # Floor
        draw.rectangle([0, height-100, width, height], fill='#8B4513')  # Brown floor
        
        # Walls
        draw.rectangle([0, 0, width, height-100], fill='#F5F5DC')  # Beige walls
        
        # Window
        draw.rectangle([width-200, 50, width-50, 250], fill='#87CEEB')  # Sky blue window
        
        # Sofa (simple rectangle)
        draw.rectangle([100, height-200, 400, height-120], fill='#696969')  # Gray sofa
        
        # Coffee table
        draw.rectangle([200, height-150, 350, height-130], fill='#8B4513')  # Brown table
        
    elif room_type == "kitchen":
        # Draw a simple kitchen
        # Floor
        draw.rectangle([0, height-100, width, height], fill='#D2B48C')  # Tan floor
        
        # Walls
        draw.rectangle([0, 0, width, height-100], fill='#FFFFFF')  # White walls
        
        # Counter
        draw.rectangle([50, height-180, 600, height-140], fill='#A0A0A0')  # Gray counter
        
        # Cabinets
        draw.rectangle([50, height-300, 600, height-180], fill='#8B4513')  # Brown cabinets
        
        # Sink
        draw.rectangle([300, height-170, 400, height-150], fill='#C0C0C0')  # Silver sink
    
    return image

def test_agent_initialization():
    """Test agent initialization"""
    print("Testing agent initialization...")
    try:
        agent = RealEstateGraphicDesigner()
        print("✓ Agent initialized successfully")
        return agent
    except Exception as e:
        print(f"✗ Agent initialization failed: {e}")
        return None

def test_image_analysis(agent, image_path):
    """Test image analysis functionality"""
    print(f"\nTesting image analysis with: {image_path}")
    try:
        analysis = agent.analyze_image(image_path)
        print("✓ Image analysis completed")
        print(f"  Room Type: {analysis['room_type']}")
        print(f"  Style: {analysis['style']}")
        print(f"  Caption: {analysis['caption']}")
        print(f"  Clutter Level: {analysis['clutter_analysis']['clutter_level']}")
        print(f"  Editable Areas: {len(analysis['editable_areas'])} found")
        return True
    except Exception as e:
        print(f"✗ Image analysis failed: {e}")
        return False

def test_enhancement_suggestion(agent, image_path):
    """Test enhancement suggestion generation"""
    print(f"\nTesting enhancement suggestion with: {image_path}")
    try:
        suggestion = agent.suggest_enhancement(image_path)
        print("✓ Enhancement suggestion generated")
        print(f"  Suggestion: {suggestion}")
        return True
    except Exception as e:
        print(f"✗ Enhancement suggestion failed: {e}")
        return False

def test_process_image(agent, image_path):
    """Test the main process_image method"""
    print(f"\nTesting process_image with: {image_path}")
    try:
        result = agent.process_image(image_path)
        print("✓ Process image completed")
        print(f"  Result: {result}")
        return True
    except Exception as e:
        print(f"✗ Process image failed: {e}")
        return False

def main():
    """Main test function"""
    print("🏠 Ultra-Realistic Real Estate Graphic Designer - Test Suite")
    print("=" * 60)
    
    # Test 1: Agent initialization
    agent = test_agent_initialization()
    if not agent:
        print("Cannot proceed with tests - agent initialization failed")
        sys.exit(1)
    
    # Create sample images for testing
    sample_images = []
    
    # Create sample living room image
    living_room_img = create_sample_room_image("living_room", "modern")
    living_room_path = "test_living_room.jpg"
    living_room_img.save(living_room_path)
    sample_images.append(living_room_path)
    
    # Create sample kitchen image
    kitchen_img = create_sample_room_image("kitchen", "modern")
    kitchen_path = "test_kitchen.jpg"
    kitchen_img.save(kitchen_path)
    sample_images.append(kitchen_path)
    
    print(f"\nCreated {len(sample_images)} sample images for testing")
    
    # Test each sample image
    test_results = []
    for image_path in sample_images:
        print(f"\n{'='*40}")
        print(f"Testing with: {image_path}")
        print(f"{'='*40}")
        
        # Test image analysis
        analysis_result = test_image_analysis(agent, image_path)
        test_results.append(analysis_result)
        
        # Test enhancement suggestion
        suggestion_result = test_enhancement_suggestion(agent, image_path)
        test_results.append(suggestion_result)
        
        # Test process image
        process_result = test_process_image(agent, image_path)
        test_results.append(process_result)
    
    # Clean up test images
    for image_path in sample_images:
        if os.path.exists(image_path):
            os.remove(image_path)
    
    # Print test summary
    print(f"\n{'='*60}")
    print("Test Summary")
    print(f"{'='*60}")
    
    passed_tests = sum(test_results)
    total_tests = len(test_results)
    
    print(f"Passed: {passed_tests}/{total_tests} tests")
    
    if passed_tests == total_tests:
        print("🎉 All tests passed! The agent is working correctly.")
        return 0
    else:
        print("⚠️  Some tests failed. Please check the output above.")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)