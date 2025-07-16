#!/usr/bin/env python3
"""
Command Line Interface for Ultra-Realistic Real Estate Graphic Designer
"""

import argparse
import os
import sys
from real_estate_agent import RealEstateGraphicDesigner

def main():
    """Main CLI function"""
    parser = argparse.ArgumentParser(
        description="Ultra-Realistic Real Estate Graphic Designer - Generate enhancement suggestions for home photos",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python cli.py image.jpg
  python cli.py /path/to/living_room.png
  python cli.py bedroom.jpg --verbose
        """
    )
    
    parser.add_argument(
        "image_path",
        help="Path to the room image file"
    )
    
    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="Show detailed analysis information"
    )
    
    parser.add_argument(
        "--format",
        choices=["simple", "detailed"],
        default="simple",
        help="Output format (default: simple)"
    )
    
    args = parser.parse_args()
    
    # Check if image file exists
    if not os.path.exists(args.image_path):
        print(f"Error: Image file '{args.image_path}' not found.")
        sys.exit(1)
    
    # Check if file is an image
    valid_extensions = {'.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.webp'}
    file_ext = os.path.splitext(args.image_path)[1].lower()
    if file_ext not in valid_extensions:
        print(f"Error: '{args.image_path}' is not a valid image file.")
        print(f"Supported formats: {', '.join(valid_extensions)}")
        sys.exit(1)
    
    try:
        print("🏠 Ultra-Realistic Real Estate Graphic Designer")
        print("=" * 50)
        print(f"Processing: {args.image_path}")
        print()
        
        # Initialize the agent
        print("Initializing AI models...")
        agent = RealEstateGraphicDesigner()
        print("✓ Agent initialized successfully!")
        print()
        
        if args.verbose or args.format == "detailed":
            # Get detailed analysis
            print("Analyzing image...")
            analysis = agent.analyze_image(args.image_path)
            
            print("📊 Analysis Results:")
            print(f"  Room Type: {analysis['room_type']}")
            print(f"  Style: {analysis['style']}")
            print(f"  Caption: {analysis['caption']}")
            print(f"  Clutter Level: {analysis['clutter_analysis']['clutter_level']}")
            print(f"  Space Utilization: {analysis['clutter_analysis']['space_utilization']}")
            
            if analysis['editable_areas']:
                print("  Editable Areas:")
                for area in analysis['editable_areas']:
                    print(f"    - {area}")
            print()
        
        # Get enhancement suggestion
        print("Generating enhancement suggestion...")
        suggestion = agent.suggest_enhancement(args.image_path)
        
        print("🎨 Enhancement Suggestion:")
        print("-" * 30)
        print(suggestion)
        print()
        
        print("✓ Analysis complete!")
        
    except KeyboardInterrupt:
        print("\nOperation cancelled by user.")
        sys.exit(1)
    except Exception as e:
        print(f"Error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()