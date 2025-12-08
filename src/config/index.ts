import dotenv from 'dotenv';
import { AppConfig } from '../types';

// Load environment variables
dotenv.config();



class ConfigManager {
  private config: AppConfig;

  constructor() {
    this.config = this.loadConfig();
    this.validateConfig();
  }

  private loadConfig(): AppConfig {
    return {
      port: parseInt(process.env.PORT || '8000', 10),
      nodeEnv: process.env.NODE_ENV || 'development',
      appName: process.env.APP_NAME || 'RealVisionAI Lab Backend',
      appVersion: process.env.APP_VERSION || '1.0.0',
      apiPrefix: process.env.API_PREFIX || '/api/v1',
      maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10), // 10MB
      allowedFileTypes: (process.env.ALLOWED_FILE_TYPES || 'image/jpeg,image/png,image/webp,image/heic').split(','),
      replicateApiToken: process.env.REPLICATE_API_TOKEN || (process.env.NODE_ENV === 'development' ? 'dev-token-placeholder' : ''),
      // ⚠️  IMPORTANT: Always specify a version (e.g., :latest, :v1.0.0, or specific hash)
      //    - :latest = Most recent version (good for development, may change behavior)
      //    - :v1.0.0 = Semantic version (stable, if supported by model)
      //    - :hash = Specific version hash (most stable, never changes)
      stableDiffusionModel: process.env.STABLE_DIFFUSION_MODEL || 'asiryan/juggernaut-xl-v7:latest',
      defaultPrompt: process.env.PROMPT_DEFAULT || process.env.DEFAULT_PROMPT || 'modern furnished living room, stylish furniture, warm lighting, professional interior design, photorealistic',
      defaultNegativePrompt: process.env.PROMPT_DEFAULT_NEGATIVE || process.env.NEGATIVE_PROMPT || 'blurry, low quality, distorted, cluttered, messy, dark, poor lighting, oversaturated, unrealistic',
      useControlNet: process.env.USE_CONTROLNET === 'true',
      controlNetModel: process.env.CONTROLNET_MODEL || 'depth',
      enableInpaintingWorkflow: process.env.ENABLE_INPAINTING_WORKFLOW === 'true',
      controlNetStrength: parseFloat(process.env.CONTROLNET_STRENGTH || '0.8'),  
      structurePreservationStrength: parseFloat(process.env.STRUCTURE_PRESERVATION_STRENGTH || '0.4'),
      defaultTransformationStrength: parseFloat(process.env.DEFAULT_TRANSFORMATION_STRENGTH || '0.2'),
      apiKey: process.env.API_KEY,
      corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000').split(','),
      logLevel: process.env.LOG_LEVEL || 'info',
      logFormat: process.env.LOG_FORMAT || 'combined',
      uploadDir: process.env.UPLOAD_DIR || 'uploads',
      outputDir: process.env.OUTPUT_DIR || 'outputs',
      tempDir: process.env.TEMP_DIR || 'temp',
      rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
      rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
      n8nWebhookUrl: process.env.N8N_WEBHOOK_URL || 'https://agents.n8n.bizaigpt.com/webhook/b408defb-315d-4676-b4c4-1dcebe81ffc0',
      // R2 Configuration
      r2AccountId: process.env.R2_ACCOUNT_ID || '',
      r2AccessKeyId: process.env.R2_ACCESS_KEY_ID || '',
      r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
      r2BucketName: process.env.R2_BUCKET_NAME || 'realvisionai',
      r2PublicUrl: process.env.R2_PUBLIC_URL || '',
      useR2Storage: process.env.USE_R2_STORAGE === 'true',
      frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
    };
  }

  private validateConfig(): void {
    // Only require replicateApiToken in production
    if (this.config.nodeEnv === 'production') {
      const requiredFields: Array<keyof AppConfig> = ['replicateApiToken'];
      
      for (const field of requiredFields) {
        if (!this.config[field]) {
          throw new Error(`Missing required configuration: ${field}`);
        }
      }
    }

    if (this.config.port < 1 || this.config.port > 65535) {
      throw new Error('Port must be between 1 and 65535');
    }

    if (this.config.maxFileSize < 1) {
      throw new Error('Max file size must be greater than 0');
    }
  }

  public getConfig(): AppConfig {
    return { ...this.config };
  }

  public isDevelopment(): boolean {
    return this.config.nodeEnv === 'development';
  }

  public isProduction(): boolean {
    return this.config.nodeEnv === 'production';
  }

  public isTest(): boolean {
    return this.config.nodeEnv === 'test';
  }
}

export const configManager = new ConfigManager();
export const config = configManager.getConfig(); 