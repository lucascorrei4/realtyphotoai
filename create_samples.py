#!/usr/bin/env python3
"""
Create sample room images for testing the Real Estate Graphic Designer
"""

from PIL import Image, ImageDraw
import os

def create_sample_image(filename, room_type, style='modern'):
    """Create a simple sample room image"""
    width, height = 800, 600
    image = Image.new('RGB', (width, height), color='white')
    draw = ImageDraw.Draw(image)
    
    if 'kitchen' in room_type:
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
        # Add some clutter if cluttered
        if 'cluttered' in filename:
            draw.rectangle([450, height-175, 500, height-155], fill='#FF6347')  # Dishes
            draw.rectangle([520, height-175, 570, height-155], fill='#32CD32')  # Items
            
    elif 'bedroom' in room_type:
        # Floor
        draw.rectangle([0, height-100, width, height], fill='#DEB887')  # Burlywood floor
        # Walls
        draw.rectangle([0, 0, width, height-100], fill='#F0F8FF')  # Alice blue walls
        # Bed
        draw.rectangle([200, height-250, 600, height-120], fill='#8B4513')  # Brown bed
        # Nightstand
        draw.rectangle([150, height-180, 200, height-140], fill='#654321')  # Dark brown nightstand
        # Window
        draw.rectangle([width-150, 50, width-50, 200], fill='#87CEEB')  # Sky blue window
        
    elif 'bathroom' in room_type:
        # Floor
        draw.rectangle([0, height-100, width, height], fill='#E6E6FA')  # Lavender floor
        # Walls
        draw.rectangle([0, 0, width, height-100], fill='#F5F5F5')  # White smoke walls
        # Vanity
        draw.rectangle([100, height-200, 400, height-140], fill='#8B4513')  # Brown vanity
        # Mirror
        draw.rectangle([150, 100, 350, 300], fill='#87CEEB')  # Sky blue mirror
        # Toilet
        draw.rectangle([500, height-180, 600, height-140], fill='#FFFFFF')  # White toilet
        
    else:  # living room
        # Floor
        draw.rectangle([0, height-100, width, height], fill='#8B4513')  # Brown floor
        # Walls
        draw.rectangle([0, 0, width, height-100], fill='#F5F5DC')  # Beige walls
        # Window
        draw.rectangle([width-200, 50, width-50, 250], fill='#87CEEB')  # Sky blue window
        # Sofa
        draw.rectangle([100, height-200, 400, height-120], fill='#696969')  # Gray sofa
        # Coffee table
        draw.rectangle([200, height-150, 350, height-130], fill='#8B4513')  # Brown table
        # Add clutter if specified
        if 'cluttered' in filename:
            draw.rectangle([450, height-160, 500, height-140], fill='#FF6347')  # Clutter items
            draw.rectangle([520, height-170, 570, height-150], fill='#32CD32')  # More items
    
    image.save(filename)
    print(f'✓ Created {filename}')

def main():
    """Create all sample images"""
    print("Creating sample room images for testing...")
    print("=" * 50)
    
    # Create different room types and styles
    samples = [
        ('modern_kitchen.jpg', 'kitchen', 'modern'),
        ('traditional_bedroom.jpg', 'bedroom', 'traditional'),
        ('cluttered_living_room.jpg', 'living_room', 'modern'),
        ('empty_bathroom.jpg', 'bathroom', 'modern'),
        ('sample_living_room.jpg', 'living_room', 'modern'),
        ('rustic_kitchen.jpg', 'kitchen', 'rustic'),
        ('contemporary_bedroom.jpg', 'bedroom', 'contemporary'),
        ('minimalist_bathroom.jpg', 'bathroom', 'minimalist'),
    ]
    
    for filename, room_type, style in samples:
        create_sample_image(filename, room_type, style)
    
    print("\n✅ All sample images created successfully!")
    print("\nYou can now test the agent with these images:")
    print("- Command line: python3 demo_agent.py modern_kitchen.jpg --verbose")
    print("- Web interface: python3 demo_web.py (then upload images)")
    print("- Or use your own room photos!")

if __name__ == "__main__":
    main()