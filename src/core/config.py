"""
Configuration management for the Real Estate Photo AI Backend
"""
import os
from typing import Optional
from pydantic import Field
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings with environment variable support"""
    
    # Application
    app_name: str = Field(default="Real Estate Photo AI Backend", env="APP_NAME")
    app_version: str = Field(default="1.0.0", env="APP_VERSION")
    debug: bool = Field(default=False, env="DEBUG")
    
    # Server
    host: str = Field(default="0.0.0.0", env="HOST")
    port: int = Field(default=8000, env="PORT")
    workers: int = Field(default=2, env="WORKERS")
    
    # Security
    secret_key: str = Field(default="your-secret-key-change-in-production", env="SECRET_KEY")
    api_key: Optional[str] = Field(default=None, env="API_KEY")
    allowed_origins: list = Field(default=["*"], env="ALLOWED_ORIGINS")
    
    # File Upload
    max_file_size: int = Field(default=10 * 1024 * 1024, env="MAX_FILE_SIZE")  # 10MB
    upload_dir: str = Field(default="uploads", env="UPLOAD_DIR")
    temp_dir: str = Field(default="temp", env="TEMP_DIR")
    
    # AI Models
    models_cache_dir: str = Field(default="models_cache", env="MODELS_CACHE_DIR")
    device: str = Field(default="cpu", env="DEVICE")  # cpu or cuda
    
    # Logging
    log_level: str = Field(default="INFO", env="LOG_LEVEL")
    log_file: Optional[str] = Field(default=None, env="LOG_FILE")
    
    # Database (if needed in future)
    database_url: Optional[str] = Field(default=None, env="DATABASE_URL")
    
    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()


def ensure_directories():
    """Ensure required directories exist"""
    settings = get_settings()
    directories = [
        settings.upload_dir,
        settings.temp_dir,
        settings.models_cache_dir
    ]
    
    for directory in directories:
        os.makedirs(directory, exist_ok=True) 