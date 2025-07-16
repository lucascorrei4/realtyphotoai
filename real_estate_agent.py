import cv2
import numpy as np
from PIL import Image
import torch
from transformers import BlipProcessor, BlipForConditionalGeneration
from transformers import CLIPProcessor, CLIPModel
import os
import json
from typing import Dict, List, Tuple, Optional
import re

class RealEstateGraphicDesigner:
    """
    Ultra-Realistic Real Estate Graphic Designer Agent
    Specializes in analyzing home photos and suggesting photorealistic enhancements
    """
    
    def __init__(self):
        """Initialize the agent with necessary models and configurations"""
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        
        # Load BLIP model for image captioning and analysis
        self.blip_processor = BlipProcessor.from_pretrained("Salesforce/blip-image-captioning-base")
        self.blip_model = BlipForConditionalGeneration.from_pretrained("Salesforce/blip-image-captioning-base")
        self.blip_model.to(self.device)
        
        # Load CLIP model for style and content analysis
        self.clip_processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
        self.clip_model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
        self.clip_model.to(self.device)
        
        # Room type classifications
        self.room_types = [
            "living room", "bedroom", "kitchen", "bathroom", "dining room",
            "balcony", "garden", "pool area", "bungalow", "office", "basement"
        ]
        
        # Style classifications
        self.style_types = [
            "modern", "contemporary", "traditional", "rustic", "industrial",
            "minimalist", "vintage", "scandinavian", "mediterranean", "colonial"
        ]
        
        # Enhancement suggestions database
        self.enhancement_suggestions = self._load_enhancement_database()
    
    def _load_enhancement_database(self) -> Dict:
        """Load enhancement suggestions database for different room types and styles"""
        return {
            "living_room": {
                "modern": [
                    "Add a sleek sectional sofa in neutral tones, remove outdated furniture",
                    "Install contemporary lighting fixtures, enhance natural light",
                    "Add modern coffee table with clean lines, declutter surfaces",
                    "Enhance walls with modern art pieces, remove personal items"
                ],
                "traditional": [
                    "Add classic leather armchair in rich brown, remove clutter",
                    "Enhance fireplace with elegant mantelpiece decor, organize books",
                    "Add traditional area rug with warm patterns, remove worn items",
                    "Install classic table lamps, improve ambient lighting"
                ],
                "rustic": [
                    "Add reclaimed wood coffee table, remove modern elements",
                    "Enhance with cozy throw blankets and pillows, declutter",
                    "Add vintage wooden accents, remove plastic items",
                    "Install wrought iron lighting fixtures, create warm ambiance"
                ]
            },
            "kitchen": {
                "modern": [
                    "Enhance countertops with quartz surfaces, remove clutter including dishes",
                    "Add stainless steel appliances, remove outdated equipment",
                    "Install pendant lighting over island, improve task lighting",
                    "Add modern bar stools, remove mismatched seating"
                ],
                "traditional": [
                    "Enhance with granite countertops, organize cooking utensils",
                    "Add wooden cutting boards and copper accents, remove clutter",
                    "Install classic cabinet hardware, update drawer pulls",
                    "Add traditional ceramic backsplash, remove worn tiles"
                ]
            },
            "bedroom": {
                "modern": [
                    "Add platform bed with clean lines, remove personal items",
                    "Enhance with minimalist nightstands, declutter surfaces",
                    "Install contemporary lighting, improve ambient mood",
                    "Add modern dresser with sleek handles, organize clothing"
                ],
                "traditional": [
                    "Add classic wooden bed frame, remove modern elements",
                    "Enhance with traditional bedding and pillows, organize linens",
                    "Install elegant table lamps, create warm lighting",
                    "Add antique dresser with ornate details, declutter"
                ]
            },
            "bathroom": {
                "modern": [
                    "Enhance vanity with modern vessel sink, remove personal toiletries",
                    "Add frameless glass shower doors, update outdated fixtures",
                    "Install contemporary faucets and hardware, remove rust stains",
                    "Add modern mirror with LED lighting, improve visibility"
                ],
                "traditional": [
                    "Enhance with classic pedestal sink, organize bathroom items",
                    "Add traditional shower curtain, remove worn fixtures",
                    "Install vintage-style faucets, update hardware",
                    "Add ornate mirror frame, improve lighting"
                ]
            },
            "balcony": {
                "modern": [
                    "Add contemporary outdoor furniture, remove weathered items",
                    "Enhance with modern planters and greenery, organize space",
                    "Install sleek outdoor lighting, improve ambiance",
                    "Add weather-resistant cushions, remove faded textiles"
                ],
                "traditional": [
                    "Add classic outdoor dining set, remove clutter",
                    "Enhance with traditional planters and flowers, organize garden tools",
                    "Install lantern-style lighting, create cozy atmosphere",
                    "Add comfortable outdoor cushions, remove worn furniture"
                ]
            },
            "garden": {
                "modern": [
                    "Add geometric planters with structured landscaping, remove weeds",
                    "Enhance pathways with modern stone tiles, clear debris",
                    "Install contemporary outdoor lighting, improve visibility",
                    "Add minimalist water feature, remove overgrown plants"
                ],
                "traditional": [
                    "Add classic garden borders with colorful flowers, remove dead plants",
                    "Enhance with traditional garden furniture, organize tools",
                    "Install vintage-style garden lights, create warm ambiance",
                    "Add ornate planters with seasonal blooms, clear weeds"
                ]
            },
            "pool": {
                "modern": [
                    "Add contemporary pool furniture, remove outdated equipment",
                    "Enhance deck with modern tiles, clean and organize",
                    "Install sleek pool lighting, improve safety and ambiance",
                    "Add modern umbrellas and loungers, remove worn items"
                ],
                "traditional": [
                    "Add classic pool furniture with cushions, remove clutter",
                    "Enhance with traditional deck materials, organize pool equipment",
                    "Install elegant outdoor lighting, improve atmosphere",
                    "Add decorative planters around pool area, remove debris"
                ]
            }
        }
    
    def analyze_image(self, image_path: str) -> Dict:
        """
        Analyze the provided image to identify room type, style, and key areas
        
        Args:
            image_path: Path to the image file
            
        Returns:
            Dictionary containing analysis results
        """
        # Load and preprocess image
        image = Image.open(image_path).convert("RGB")
        
        # Generate image caption
        caption = self._generate_caption(image)
        
        # Identify room type
        room_type = self._identify_room_type(image, caption)
        
        # Identify style
        style = self._identify_style(image, caption)
        
        # Detect key editable areas
        editable_areas = self._detect_editable_areas(image, caption)
        
        # Analyze clutter and empty spaces
        clutter_analysis = self._analyze_clutter_and_spaces(image, caption)
        
        return {
            "caption": caption,
            "room_type": room_type,
            "style": style,
            "editable_areas": editable_areas,
            "clutter_analysis": clutter_analysis
        }
    
    def _generate_caption(self, image: Image.Image) -> str:
        """Generate detailed caption for the image"""
        inputs = self.blip_processor(image, return_tensors="pt").to(self.device)
        
        with torch.no_grad():
            out = self.blip_model.generate(**inputs, max_length=100, num_beams=5)
        
        caption = self.blip_processor.decode(out[0], skip_special_tokens=True)
        return caption
    
    def _identify_room_type(self, image: Image.Image, caption: str) -> str:
        """Identify the type of room from image and caption"""
        # Use CLIP to compare image with room type descriptions
        room_descriptions = [f"a {room_type} in a house" for room_type in self.room_types]
        
        inputs = self.clip_processor(
            text=room_descriptions,
            images=image,
            return_tensors="pt",
            padding=True
        ).to(self.device)
        
        with torch.no_grad():
            outputs = self.clip_model(**inputs)
            probs = outputs.logits_per_image.softmax(dim=-1)
        
        # Get the most likely room type
        room_idx = probs.argmax().item()
        confidence = probs[0][room_idx].item()
        
        # Also check caption for room type keywords
        caption_lower = caption.lower()
        for room_type in self.room_types:
            if room_type.replace(" ", "") in caption_lower.replace(" ", ""):
                return room_type
        
        return self.room_types[room_idx] if confidence > 0.3 else "living room"
    
    def _identify_style(self, image: Image.Image, caption: str) -> str:
        """Identify the style of the room"""
        # Use CLIP to compare image with style descriptions
        style_descriptions = [f"a {style} style interior" for style in self.style_types]
        
        inputs = self.clip_processor(
            text=style_descriptions,
            images=image,
            return_tensors="pt",
            padding=True
        ).to(self.device)
        
        with torch.no_grad():
            outputs = self.clip_model(**inputs)
            probs = outputs.logits_per_image.softmax(dim=-1)
        
        # Get the most likely style
        style_idx = probs.argmax().item()
        confidence = probs[0][style_idx].item()
        
        # Check caption for style keywords
        caption_lower = caption.lower()
        style_keywords = {
            "modern": ["modern", "contemporary", "sleek", "minimalist"],
            "traditional": ["traditional", "classic", "vintage", "antique"],
            "rustic": ["rustic", "wooden", "natural", "country"],
            "industrial": ["industrial", "metal", "concrete", "exposed"]
        }
        
        for style, keywords in style_keywords.items():
            if any(keyword in caption_lower for keyword in keywords):
                return style
        
        return self.style_types[style_idx] if confidence > 0.25 else "modern"
    
    def _detect_editable_areas(self, image: Image.Image, caption: str) -> List[str]:
        """Detect key editable areas in the image"""
        editable_areas = []
        caption_lower = caption.lower()
        
        # Common editable elements
        editable_elements = {
            "furniture": ["chair", "sofa", "table", "bed", "dresser", "cabinet"],
            "lighting": ["lamp", "light", "chandelier", "fixture"],
            "decor": ["pillow", "cushion", "artwork", "plant", "vase"],
            "surfaces": ["counter", "countertop", "floor", "wall"],
            "appliances": ["refrigerator", "stove", "microwave", "dishwasher"],
            "fixtures": ["sink", "faucet", "shower", "bathtub"]
        }
        
        for category, elements in editable_elements.items():
            for element in elements:
                if element in caption_lower:
                    editable_areas.append(f"{category}: {element}")
        
        return editable_areas
    
    def _analyze_clutter_and_spaces(self, image: Image.Image, caption: str) -> Dict:
        """Analyze clutter and empty spaces in the image"""
        caption_lower = caption.lower()
        
        # Clutter indicators
        clutter_keywords = [
            "messy", "cluttered", "disorganized", "scattered", "pile", "stack",
            "dishes", "papers", "clothes", "items", "stuff", "things"
        ]
        
        # Empty space indicators
        empty_keywords = [
            "empty", "bare", "vacant", "spacious", "open", "minimal", "clean"
        ]
        
        has_clutter = any(keyword in caption_lower for keyword in clutter_keywords)
        has_empty_spaces = any(keyword in caption_lower for keyword in empty_keywords)
        
        return {
            "has_clutter": has_clutter,
            "has_empty_spaces": has_empty_spaces,
            "clutter_level": "high" if has_clutter else "low",
            "space_utilization": "underutilized" if has_empty_spaces else "well-utilized"
        }
    
    def suggest_enhancement(self, image_path: str) -> str:
        """
        Main method to analyze image and suggest a single detailed enhancement
        
        Args:
            image_path: Path to the image file
            
        Returns:
            Single enhancement suggestion as a string
        """
        # Analyze the image
        analysis = self.analyze_image(image_path)
        
        room_type = analysis["room_type"].replace(" ", "_")
        style = analysis["style"]
        caption = analysis["caption"]
        clutter_analysis = analysis["clutter_analysis"]
        
        # Get base suggestions for room type and style
        base_suggestions = []
        if room_type in self.enhancement_suggestions:
            if style in self.enhancement_suggestions[room_type]:
                base_suggestions = self.enhancement_suggestions[room_type][style]
            else:
                # Fallback to modern style if specific style not found
                base_suggestions = self.enhancement_suggestions[room_type].get("modern", [])
        
        # If no specific suggestions, use general ones
        if not base_suggestions:
            base_suggestions = [
                "Add modern furniture pieces, remove clutter and personal items",
                "Enhance lighting and ambiance, organize existing elements",
                "Add decorative elements matching the style, declutter surfaces"
            ]
        
        # Customize suggestion based on analysis
        selected_suggestion = self._customize_suggestion(
            base_suggestions, analysis, caption
        )
        
        return selected_suggestion
    
    def _customize_suggestion(self, base_suggestions: List[str], analysis: Dict, caption: str) -> str:
        """Customize the enhancement suggestion based on specific image analysis"""
        caption_lower = caption.lower()
        clutter_analysis = analysis["clutter_analysis"]
        
        # Priority-based selection
        priority_keywords = {
            "kitchen": ["counter", "sink", "cabinet", "appliance"],
            "living": ["sofa", "chair", "table", "fireplace"],
            "bedroom": ["bed", "nightstand", "dresser", "closet"],
            "bathroom": ["sink", "shower", "bathtub", "vanity"],
            "outdoor": ["furniture", "plant", "deck", "patio"]
        }
        
        # Find the most relevant suggestion
        best_suggestion = base_suggestions[0]  # Default
        
        for suggestion in base_suggestions:
            suggestion_lower = suggestion.lower()
            
            # Check if suggestion matches elements found in caption
            relevance_score = 0
            for room_key, keywords in priority_keywords.items():
                if room_key in analysis["room_type"]:
                    for keyword in keywords:
                        if keyword in caption_lower and keyword in suggestion_lower:
                            relevance_score += 2
                        elif keyword in caption_lower:
                            relevance_score += 1
            
            # Boost score if suggestion addresses clutter
            if clutter_analysis["has_clutter"] and "remove" in suggestion_lower:
                relevance_score += 3
            
            # Boost score if suggestion addresses empty spaces
            if clutter_analysis["has_empty_spaces"] and "add" in suggestion_lower:
                relevance_score += 2
            
            # Select suggestion with highest relevance
            if relevance_score > 0:
                best_suggestion = suggestion
                break
        
        # Add specific clutter removal if detected
        if clutter_analysis["has_clutter"] and "remove clutter" not in best_suggestion.lower():
            if "remove" in best_suggestion:
                best_suggestion = best_suggestion.replace("remove", "remove clutter and")
            else:
                best_suggestion += ", remove clutter and personal items"
        
        return best_suggestion
    
    def process_image(self, image_path: str) -> str:
        """
        Process an image and return enhancement suggestion
        
        Args:
            image_path: Path to the image file
            
        Returns:
            Enhancement suggestion as a simple string
        """
        try:
            if not os.path.exists(image_path):
                return "Error: Image file not found"
            
            suggestion = self.suggest_enhancement(image_path)
            return suggestion
            
        except Exception as e:
            return f"Error processing image: {str(e)}"

# Example usage and testing
if __name__ == "__main__":
    # Initialize the agent
    agent = RealEstateGraphicDesigner()
    
    # Test with a sample image (you would replace this with actual image path)
    sample_image_path = "sample_room.jpg"
    
    if os.path.exists(sample_image_path):
        result = agent.process_image(sample_image_path)
        print("Enhancement Suggestion:")
        print(result)
    else:
        print("Real Estate Graphic Designer Agent initialized successfully!")
        print("Usage: agent.process_image('path_to_your_image.jpg')")