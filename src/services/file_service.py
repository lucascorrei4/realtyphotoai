"""
File processing service for handling image uploads and validation
"""
import os
import uuid
import shutil
from pathlib import Path
from typing import Tuple, Optional
from PIL import Image
import tempfile

from ..core.config import get_settings
from ..core.logging import get_logger
from ..core.exceptions import FileProcessingError, ValidationError

logger = get_logger(__name__)


class FileService:
    """Service for handling file operations"""
    
    def __init__(self):
        self.settings = get_settings()
        self._ensure_directories()
        
        # Supported image formats
        self.supported_formats = {'.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.webp'}
        self.max_dimension = 4096  # Max width/height in pixels
        self.min_dimension = 32    # Min width/height in pixels
    
    def _ensure_directories(self):
        """Ensure required directories exist"""
        directories = [
            self.settings.upload_dir,
            self.settings.temp_dir
        ]
        
        for directory in directories:
            Path(directory).mkdir(parents=True, exist_ok=True)
    
    def validate_image_file(self, file_path: str) -> Tuple[bool, Optional[str]]:
        """
        Validate uploaded image file
        
        Args:
            file_path: Path to the uploaded file
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        try:
            # Check if file exists
            if not os.path.exists(file_path):
                return False, "File does not exist"
            
            # Check file size
            file_size = os.path.getsize(file_path)
            if file_size > self.settings.max_file_size:
                max_mb = self.settings.max_file_size / (1024 * 1024)
                return False, f"File size exceeds {max_mb:.1f}MB limit"
            
            if file_size == 0:
                return False, "File is empty"
            
            # Check file extension
            file_extension = Path(file_path).suffix.lower()
            if file_extension not in self.supported_formats:
                return False, f"Unsupported file format. Supported: {', '.join(self.supported_formats)}"
            
            # Try to open and validate image
            try:
                with Image.open(file_path) as img:
                    # Check image dimensions
                    width, height = img.size
                    
                    if width < self.min_dimension or height < self.min_dimension:
                        return False, f"Image too small. Minimum size: {self.min_dimension}x{self.min_dimension}"
                    
                    if width > self.max_dimension or height > self.max_dimension:
                        return False, f"Image too large. Maximum size: {self.max_dimension}x{self.max_dimension}"
                    
                    # Verify image can be loaded
                    img.verify()
                    
            except Exception as e:
                return False, f"Invalid image file: {str(e)}"
            
            return True, None
            
        except Exception as e:
            logger.error(f"Error validating file {file_path}: {str(e)}")
            return False, f"Validation error: {str(e)}"
    
    def save_uploaded_file(self, file_content: bytes, filename: str, content_type: str) -> str:
        """
        Save uploaded file to temporary directory
        
        Args:
            file_content: Raw file content
            filename: Original filename
            content_type: MIME type
            
        Returns:
            Path to saved file
        """
        try:
            # Generate unique filename
            file_extension = Path(filename).suffix.lower()
            unique_filename = f"{uuid.uuid4()}{file_extension}"
            file_path = os.path.join(self.settings.temp_dir, unique_filename)
            
            # Write file content
            with open(file_path, 'wb') as f:
                f.write(file_content)
            
            # Validate the saved file
            is_valid, error_message = self.validate_image_file(file_path)
            if not is_valid:
                self.cleanup_file(file_path)
                raise ValidationError(f"Invalid image file: {error_message}")
            
            logger.info(f"File saved successfully: {file_path}")
            return file_path
            
        except Exception as e:
            logger.error(f"Error saving file: {str(e)}")
            raise FileProcessingError(f"Failed to save file: {str(e)}")
    
    def create_temp_file_from_upload(self, upload_file) -> str:
        """
        Create temporary file from FastAPI UploadFile
        
        Args:
            upload_file: FastAPI UploadFile object
            
        Returns:
            Path to temporary file
        """
        try:
            # Read file content
            content = upload_file.file.read()
            
            # Save to temporary file
            file_path = self.save_uploaded_file(
                content,
                upload_file.filename or "uploaded_image.jpg",
                upload_file.content_type or "image/jpeg"
            )
            
            return file_path
            
        except Exception as e:
            logger.error(f"Error creating temp file from upload: {str(e)}")
            raise FileProcessingError(f"Failed to process uploaded file: {str(e)}")
    
    def cleanup_file(self, file_path: str) -> bool:
        """
        Clean up temporary file
        
        Args:
            file_path: Path to file to delete
            
        Returns:
            True if successfully deleted, False otherwise
        """
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
                logger.debug(f"Cleaned up file: {file_path}")
                return True
            return False
        except Exception as e:
            logger.error(f"Error cleaning up file {file_path}: {str(e)}")
            return False
    
    def get_image_info(self, file_path: str) -> dict:
        """
        Get information about an image file
        
        Args:
            file_path: Path to image file
            
        Returns:
            Dictionary with image information
        """
        try:
            with Image.open(file_path) as img:
                return {
                    "filename": Path(file_path).name,
                    "size": os.path.getsize(file_path),
                    "width": img.width,
                    "height": img.height,
                    "format": img.format,
                    "mode": img.mode
                }
        except Exception as e:
            logger.error(f"Error getting image info for {file_path}: {str(e)}")
            raise FileProcessingError(f"Failed to get image information: {str(e)}")
    
    def optimize_image_for_processing(self, file_path: str) -> str:
        """
        Optimize image for AI processing (resize if needed, convert format)
        
        Args:
            file_path: Path to original image
            
        Returns:
            Path to optimized image
        """
        try:
            optimized_path = file_path.replace(Path(file_path).suffix, '_optimized.jpg')
            
            with Image.open(file_path) as img:
                # Convert to RGB if needed
                if img.mode not in ('RGB', 'L'):
                    img = img.convert('RGB')
                
                # Resize if too large (keeping aspect ratio)
                max_size = 1024  # Max dimension for processing
                if max(img.size) > max_size:
                    img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
                
                # Save optimized version
                img.save(optimized_path, 'JPEG', quality=85, optimize=True)
            
            logger.debug(f"Image optimized: {file_path} -> {optimized_path}")
            return optimized_path
            
        except Exception as e:
            logger.error(f"Error optimizing image {file_path}: {str(e)}")
            # Return original path if optimization fails
            return file_path 