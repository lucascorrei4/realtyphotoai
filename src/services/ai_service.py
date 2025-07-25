"""
AI Service for Real Estate Photo Enhancement
Refactored with proper design patterns and dependency injection
"""
import cv2
import numpy as np
from PIL import Image
import torch
from transformers import BlipProcessor, BlipForConditionalGeneration
from transformers import CLIPProcessor, CLIPModel
import os
import time
from typing import Dict, List, Tuple, Optional
from pathlib import Path

from ..core.config import get_settings
from ..core.logging import get_logger
from ..core.exceptions import (
    ModelLoadingError,
    ImageProcessingError,
    FileProcessingError
)
from ..models.schemas import (
    ImageAnalysisResult,
    ClutterAnalysis,
    RoomType,
    StyleType,
    ClutterLevel,
    SpaceUtilization,
    EnhancementSuggestion
)

logger = get_logger(__name__)


class ModelManager:
    """Manages AI model loading and caching"""
    
    def __init__(self):
        self.settings = get_settings()
        self.device = torch.device("cuda" if torch.cuda.is_available() and self.settings.device == "cuda" else "cpu")
        logger.info(f"Using device: {self.device}")
        
        # Model instances
        self.blip_processor = None
        self.blip_model = None
        self.clip_processor = None
        self.clip_model = None
        
        self._models_loaded = False
    
    def load_models(self) -> None:
        """Load all required AI models"""
        try:
            logger.info("Loading AI models...")
            start_time = time.time()
            
            # Load BLIP model for image captioning
            logger.info("Loading BLIP model...")
            self.blip_processor = BlipProcessor.from_pretrained(
                "Salesforce/blip-image-captioning-base",
                cache_dir=self.settings.models_cache_dir
            )
            self.blip_model = BlipForConditionalGeneration.from_pretrained(
                "Salesforce/blip-image-captioning-base",
                cache_dir=self.settings.models_cache_dir
            )
            self.blip_model.to(self.device)
            
            # Load CLIP model for classification
            logger.info("Loading CLIP model...")
            self.clip_processor = CLIPProcessor.from_pretrained(
                "openai/clip-vit-base-patch32",
                cache_dir=self.settings.models_cache_dir
            )
            self.clip_model = CLIPModel.from_pretrained(
                "openai/clip-vit-base-patch32",
                cache_dir=self.settings.models_cache_dir
            )
            self.clip_model.to(self.device)
            
            self._models_loaded = True
            load_time = time.time() - start_time
            logger.info(f"Models loaded successfully in {load_time:.2f} seconds")
            
        except Exception as e:
            logger.error(f"Failed to load models: {str(e)}")
            raise ModelLoadingError(f"Failed to load AI models: {str(e)}")
    
    @property
    def models_loaded(self) -> bool:
        """Check if models are loaded"""
        return self._models_loaded
    
    def ensure_models_loaded(self) -> None:
        """Ensure models are loaded, load them if not"""
        if not self._models_loaded:
            self.load_models()


class EnhancementDatabase:
    """Database of enhancement suggestions"""
    
    def __init__(self):
        self.suggestions = self._load_suggestions()
    
    def _load_suggestions(self) -> Dict:
        """Load enhancement suggestions database"""
        return {
            "living_room": {
                "modern": [
                    {
                        "suggestion": "Add a sleek sectional sofa in neutral tones, remove outdated furniture",
                        "priority": "high",
                        "category": "furniture",
                        "estimated_impact": "high"
                    },
                    {
                        "suggestion": "Install contemporary lighting fixtures, enhance natural light",
                        "priority": "medium",
                        "category": "lighting",
                        "estimated_impact": "medium"
                    },
                    {
                        "suggestion": "Add modern coffee table with clean lines, declutter surfaces",
                        "priority": "medium",
                        "category": "furniture",
                        "estimated_impact": "medium"
                    },
                    {
                        "suggestion": "Enhance walls with modern art pieces, remove personal items",
                        "priority": "low",
                        "category": "decor",
                        "estimated_impact": "low"
                    }
                ],
                "traditional": [
                    {
                        "suggestion": "Add classic leather armchair in rich brown, remove clutter",
                        "priority": "high",
                        "category": "furniture",
                        "estimated_impact": "high"
                    },
                    {
                        "suggestion": "Enhance fireplace with elegant mantelpiece decor, organize books",
                        "priority": "medium",
                        "category": "decor",
                        "estimated_impact": "medium"
                    },
                    {
                        "suggestion": "Add traditional area rug with warm patterns, remove worn items",
                        "priority": "medium",
                        "category": "decor",
                        "estimated_impact": "medium"
                    },
                    {
                        "suggestion": "Install classic table lamps, improve ambient lighting",
                        "priority": "low",
                        "category": "lighting",
                        "estimated_impact": "low"
                    }
                ],
                "rustic": [
                    {
                        "suggestion": "Add reclaimed wood coffee table, remove modern elements",
                        "priority": "high",
                        "category": "furniture",
                        "estimated_impact": "high"
                    },
                    {
                        "suggestion": "Enhance with cozy throw blankets and pillows, declutter",
                        "priority": "medium",
                        "category": "decor",
                        "estimated_impact": "medium"
                    },
                    {
                        "suggestion": "Add vintage wooden accents, remove plastic items",
                        "priority": "medium",
                        "category": "decor",
                        "estimated_impact": "medium"
                    },
                    {
                        "suggestion": "Install wrought iron lighting fixtures, create warm ambiance",
                        "priority": "low",
                        "category": "lighting",
                        "estimated_impact": "low"
                    }
                ]
            },
            "kitchen": {
                "modern": [
                    {
                        "suggestion": "Enhance countertops with quartz surfaces, remove clutter including dishes",
                        "priority": "high",
                        "category": "surfaces",
                        "estimated_impact": "high"
                    },
                    {
                        "suggestion": "Add stainless steel appliances, remove outdated equipment",
                        "priority": "high",
                        "category": "appliances",
                        "estimated_impact": "high"
                    },
                    {
                        "suggestion": "Install pendant lighting over island, improve task lighting",
                        "priority": "medium",
                        "category": "lighting",
                        "estimated_impact": "medium"
                    },
                    {
                        "suggestion": "Add modern bar stools, remove mismatched seating",
                        "priority": "low",
                        "category": "furniture",
                        "estimated_impact": "low"
                    }
                ],
                "traditional": [
                    {
                        "suggestion": "Enhance with granite countertops, organize cooking utensils",
                        "priority": "high",
                        "category": "surfaces",
                        "estimated_impact": "high"
                    },
                    {
                        "suggestion": "Add wooden cutting boards and copper accents, remove clutter",
                        "priority": "medium",
                        "category": "decor",
                        "estimated_impact": "medium"
                    },
                    {
                        "suggestion": "Install classic cabinet hardware, update drawer pulls",
                        "priority": "medium",
                        "category": "fixtures",
                        "estimated_impact": "medium"
                    },
                    {
                        "suggestion": "Add traditional ceramic backsplash, remove worn tiles",
                        "priority": "low",
                        "category": "surfaces",
                        "estimated_impact": "low"
                    }
                ]
            },
            "bedroom": {
                "modern": [
                    {
                        "suggestion": "Add platform bed with clean lines, remove personal items",
                        "priority": "high",
                        "category": "furniture",
                        "estimated_impact": "high"
                    },
                    {
                        "suggestion": "Enhance with minimalist nightstands, declutter surfaces",
                        "priority": "medium",
                        "category": "furniture",
                        "estimated_impact": "medium"
                    },
                    {
                        "suggestion": "Install contemporary lighting, improve ambient mood",
                        "priority": "medium",
                        "category": "lighting",
                        "estimated_impact": "medium"
                    },
                    {
                        "suggestion": "Add modern dresser with sleek handles, organize clothing",
                        "priority": "low",
                        "category": "furniture",
                        "estimated_impact": "low"
                    }
                ],
                "traditional": [
                    {
                        "suggestion": "Add classic wooden bed frame, remove modern elements",
                        "priority": "high",
                        "category": "furniture",
                        "estimated_impact": "high"
                    },
                    {
                        "suggestion": "Enhance with traditional bedding and pillows, organize linens",
                        "priority": "medium",
                        "category": "decor",
                        "estimated_impact": "medium"
                    },
                    {
                        "suggestion": "Install elegant table lamps, create warm lighting",
                        "priority": "medium",
                        "category": "lighting",
                        "estimated_impact": "medium"
                    },
                    {
                        "suggestion": "Add antique dresser with ornate details, declutter",
                        "priority": "low",
                        "category": "furniture",
                        "estimated_impact": "low"
                    }
                ]
            },
            "bathroom": {
                "modern": [
                    {
                        "suggestion": "Enhance vanity with modern vessel sink, remove personal toiletries",
                        "priority": "high",
                        "category": "fixtures",
                        "estimated_impact": "high"
                    },
                    {
                        "suggestion": "Add frameless glass shower doors, update outdated fixtures",
                        "priority": "medium",
                        "category": "fixtures",
                        "estimated_impact": "medium"
                    },
                    {
                        "suggestion": "Install contemporary faucets and hardware, remove rust stains",
                        "priority": "medium",
                        "category": "fixtures",
                        "estimated_impact": "medium"
                    },
                    {
                        "suggestion": "Add modern mirror with LED lighting, improve visibility",
                        "priority": "low",
                        "category": "lighting",
                        "estimated_impact": "low"
                    }
                ],
                "traditional": [
                    {
                        "suggestion": "Enhance with classic pedestal sink, organize bathroom items",
                        "priority": "high",
                        "category": "fixtures",
                        "estimated_impact": "high"
                    },
                    {
                        "suggestion": "Add traditional shower curtain, remove worn fixtures",
                        "priority": "medium",
                        "category": "fixtures",
                        "estimated_impact": "medium"
                    },
                    {
                        "suggestion": "Install vintage-style faucets, update hardware",
                        "priority": "medium",
                        "category": "fixtures",
                        "estimated_impact": "medium"
                    },
                    {
                        "suggestion": "Add ornate mirror frame, improve lighting",
                        "priority": "low",
                        "category": "lighting",
                        "estimated_impact": "low"
                    }
                ]
            }
        }
    
    def get_suggestions(self, room_type: str, style: str) -> List[Dict]:
        """Get suggestions for specific room type and style"""
        room_key = room_type.replace(" ", "_").lower()
        style_key = style.lower()
        
        if room_key in self.suggestions:
            if style_key in self.suggestions[room_key]:
                return self.suggestions[room_key][style_key]
            else:
                # Fallback to modern style
                return self.suggestions[room_key].get("modern", [])
        
        # Default suggestions
        return [
            {
                "suggestion": "Add modern furniture pieces, remove clutter and personal items",
                "priority": "high",
                "category": "general",
                "estimated_impact": "high"
            }
        ]


class RealEstateAIService:
    """
    Refactored Real Estate AI Service with proper architecture
    """
    
    def __init__(self, model_manager: ModelManager, enhancement_db: EnhancementDatabase):
        self.model_manager = model_manager
        self.enhancement_db = enhancement_db
        self.settings = get_settings()
        
        # Room type and style classifications
        self.room_types = [
            "living room", "bedroom", "kitchen", "bathroom", "dining room",
            "balcony", "garden", "pool area", "bungalow", "office", "basement"
        ]
        
        self.style_types = [
            "modern", "contemporary", "traditional", "rustic", "industrial",
            "minimalist", "vintage", "scandinavian", "mediterranean", "colonial"
        ]
    
    def analyze_image(self, image_path: str) -> ImageAnalysisResult:
        """
        Analyze the provided image to identify room type, style, and key areas
        
        Args:
            image_path: Path to the image file
            
        Returns:
            ImageAnalysisResult with complete analysis
        """
        self.model_manager.ensure_models_loaded()
        
        try:
            # Load and validate image
            if not os.path.exists(image_path):
                raise FileProcessingError(f"Image file not found: {image_path}")
            
            image = Image.open(image_path).convert("RGB")
            
            # Generate image caption
            caption = self._generate_caption(image)
            
            # Identify room type with confidence
            room_type, room_confidence = self._identify_room_type(image, caption)
            
            # Identify style with confidence
            style, style_confidence = self._identify_style(image, caption)
            
            # Detect key editable areas
            editable_areas = self._detect_editable_areas(image, caption)
            
            # Analyze clutter and empty spaces
            clutter_analysis = self._analyze_clutter_and_spaces(image, caption)
            
            return ImageAnalysisResult(
                caption=caption,
                room_type=RoomType(room_type.replace(" ", "_")),
                style=StyleType(style),
                confidence_scores={
                    "room_type": room_confidence,
                    "style": style_confidence
                },
                editable_areas=editable_areas,
                clutter_analysis=clutter_analysis
            )
            
        except Exception as e:
            logger.error(f"Error analyzing image {image_path}: {str(e)}")
            raise ImageProcessingError(f"Failed to analyze image: {str(e)}")
    
    def _generate_caption(self, image: Image.Image) -> str:
        """Generate detailed caption for the image"""
        try:
            inputs = self.model_manager.blip_processor(image, return_tensors="pt").to(self.model_manager.device)
            
            with torch.no_grad():
                out = self.model_manager.blip_model.generate(**inputs, max_length=100, num_beams=5)
            
            caption = self.model_manager.blip_processor.decode(out[0], skip_special_tokens=True)
            return caption
        except Exception as e:
            logger.error(f"Error generating caption: {str(e)}")
            return "A room interior"
    
    def _identify_room_type(self, image: Image.Image, caption: str) -> Tuple[str, float]:
        """Identify the type of room from image and caption"""
        try:
            # Use CLIP to compare image with room type descriptions
            room_descriptions = [f"a {room_type} in a house" for room_type in self.room_types]
            
            inputs = self.model_manager.clip_processor(
                text=room_descriptions,
                images=image,
                return_tensors="pt",
                padding=True
            ).to(self.model_manager.device)
            
            with torch.no_grad():
                outputs = self.model_manager.clip_model(**inputs)
                probs = outputs.logits_per_image.softmax(dim=-1)
            
            # Get the most likely room type
            room_idx = probs.argmax().item()
            confidence = probs[0][room_idx].item()
            
            # Also check caption for room type keywords
            caption_lower = caption.lower()
            for room_type in self.room_types:
                if room_type.replace(" ", "") in caption_lower.replace(" ", ""):
                    return room_type, 0.9  # High confidence for caption match
            
            return self.room_types[room_idx] if confidence > 0.3 else "living room", confidence
        except Exception as e:
            logger.error(f"Error identifying room type: {str(e)}")
            return "living room", 0.5
    
    def _identify_style(self, image: Image.Image, caption: str) -> Tuple[str, float]:
        """Identify the style of the room"""
        try:
            # Use CLIP to compare image with style descriptions
            style_descriptions = [f"a {style} style interior" for style in self.style_types]
            
            inputs = self.model_manager.clip_processor(
                text=style_descriptions,
                images=image,
                return_tensors="pt",
                padding=True
            ).to(self.model_manager.device)
            
            with torch.no_grad():
                outputs = self.model_manager.clip_model(**inputs)
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
                    return style, 0.9  # High confidence for caption match
            
            return self.style_types[style_idx] if confidence > 0.25 else "modern", confidence
        except Exception as e:
            logger.error(f"Error identifying style: {str(e)}")
            return "modern", 0.5
    
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
    
    def _analyze_clutter_and_spaces(self, image: Image.Image, caption: str) -> ClutterAnalysis:
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
        
        # Determine clutter level
        clutter_count = sum(1 for keyword in clutter_keywords if keyword in caption_lower)
        if clutter_count >= 3:
            clutter_level = ClutterLevel.HIGH
        elif clutter_count >= 1:
            clutter_level = ClutterLevel.MEDIUM
        else:
            clutter_level = ClutterLevel.LOW
        
        # Determine space utilization
        if has_empty_spaces:
            space_utilization = SpaceUtilization.UNDERUTILIZED
        elif has_clutter:
            space_utilization = SpaceUtilization.OVERCROWDED
        else:
            space_utilization = SpaceUtilization.WELL_UTILIZED
        
        return ClutterAnalysis(
            has_clutter=has_clutter,
            has_empty_spaces=has_empty_spaces,
            clutter_level=clutter_level,
            space_utilization=space_utilization
        )
    
    def get_enhancement_suggestions(self, analysis: ImageAnalysisResult) -> List[EnhancementSuggestion]:
        """Get detailed enhancement suggestions based on analysis"""
        room_type = analysis.room_type.value.replace("_", " ")
        style = analysis.style.value
        
        suggestions_data = self.enhancement_db.get_suggestions(room_type, style)
        
        suggestions = []
        for suggestion_data in suggestions_data:
            # Customize suggestion based on analysis
            customized_suggestion = self._customize_suggestion(suggestion_data, analysis)
            suggestions.append(EnhancementSuggestion(**customized_suggestion))
        
        return suggestions
    
    def _customize_suggestion(self, suggestion_data: Dict, analysis: ImageAnalysisResult) -> Dict:
        """Customize suggestion based on specific image analysis"""
        suggestion = suggestion_data.copy()
        
        # Adjust priority based on clutter analysis
        if analysis.clutter_analysis.has_clutter and "remove" in suggestion["suggestion"].lower():
            if suggestion["priority"] == "low":
                suggestion["priority"] = "medium"
            elif suggestion["priority"] == "medium":
                suggestion["priority"] = "high"
        
        # Adjust suggestion text for specific issues
        if analysis.clutter_analysis.clutter_level == ClutterLevel.HIGH:
            if "remove clutter" not in suggestion["suggestion"].lower():
                suggestion["suggestion"] += ", prioritize decluttering"
        
        return suggestion
    
    def get_primary_suggestion(self, analysis: ImageAnalysisResult) -> str:
        """Get the primary enhancement suggestion"""
        suggestions = self.get_enhancement_suggestions(analysis)
        
        # Find the highest priority suggestion
        high_priority = [s for s in suggestions if s.priority == "high"]
        if high_priority:
            return high_priority[0].suggestion
        
        medium_priority = [s for s in suggestions if s.priority == "medium"]
        if medium_priority:
            return medium_priority[0].suggestion
        
        if suggestions:
            return suggestions[0].suggestion
        
        return "Add modern furniture pieces, remove clutter and personal items" 