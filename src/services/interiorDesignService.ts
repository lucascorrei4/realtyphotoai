import Replicate from 'replicate';
import { config } from '../config';
import { logger } from '../utils/logger';
import { FileUtils } from '../utils/fileUtils';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

export class InteriorDesignService {
  private replicate: Replicate;
  private readonly modelId = 'adirik/interior-design:76604baddc85b1b4616e1c6475eca080da339c8875bd4996705440484a6eac38';

  constructor() {
    this.replicate = new Replicate({
      auth: config.replicateApiToken,
    });
  }

  /**
   * Process image specifically with the Interior Design model
   * This is a specialized method for the adirik/interior-design model
   * 
   * ⚠️ CRITICAL: Parameters are fixed and tested - DO NOT CHANGE
   */
  public async processImage(
    imagePath: string,
    prompt: string,
    options: {
      promptStrength?: number;
      numInferenceSteps?: number;
      guidanceScale?: number;
      seed?: number;
      negativePrompt?: string;
    } = {}
  ): Promise<{ outputUrl: string; metadata: any }> {
    const requestId = uuidv4();
    const startTime = Date.now();

    try {
      logger.info('🏠 Starting interior design processing', {
        requestId,
        imagePath,
        model: this.modelId,
        prompt
      });

      // Validate image file exists
      const fs = require('fs');
      if (!fs.existsSync(imagePath)) {
        throw new Error(`Image file not found: ${imagePath}`);
      }
      
      const imageStats = fs.statSync(imagePath);
      logger.info('📁 Image file details', {
        requestId,
        fileSize: imageStats.size,
        fileExists: true,
        imagePath
      });

      // Check if file is HEIC and provide better error handling
      const fileExtension = path.extname(imagePath).toLowerCase();
      const isHeic = fileExtension === '.heic' || fileExtension === '.heif';
      
      if (isHeic) {
        logger.warn('⚠️ HEIC file detected - this may cause processing issues', {
          requestId,
          imagePath,
          fileExtension
        });
        
        // Validate HEIC file can be processed
        try {
          const sharp = require('sharp');
          const metadata = await sharp(imagePath).metadata();
          if (metadata.width && metadata.height) {
            logger.info('✅ HEIC file validation successful', { requestId });
          } else {
            throw new Error('Invalid HEIC dimensions');
          }
        } catch (heicValidationError) {
          throw new Error(`HEIC file validation failed: ${heicValidationError instanceof Error ? heicValidationError.message : String(heicValidationError)}`);
        }
      }

      // Convert image to base64
      logger.info('🔄 Converting image to base64', { requestId });
      let base64Image: string;
      
      try {
        base64Image = await FileUtils.imageToBase64(imagePath);
        logger.info('✅ Base64 conversion completed', { 
          requestId, 
          base64Length: base64Image.length 
        });
      } catch (base64Error) {
        logger.error('❌ Base64 conversion failed', {
          requestId,
          error: base64Error instanceof Error ? base64Error.message : String(base64Error),
          imagePath,
          isHeic
        });
        
        if (isHeic) {
          throw new Error(`Failed to process HEIC file. The file may be corrupted or in an unsupported format. Please try converting it to JPEG or PNG first. Technical error: ${base64Error instanceof Error ? base64Error.message : String(base64Error)}`);
        } else {
          throw new Error(`Base64 conversion failed: ${base64Error instanceof Error ? base64Error.message : String(base64Error)}`);
        }
      }

      // ⚠️ CRITICAL: These parameters are fixed and tested - DO NOT CHANGE
      const modelInputs = {
        image: base64Image, // Send raw base64 without data URL prefix
        prompt: prompt,
        negative_prompt: options.negativePrompt || "lowres, watermark, banner, logo, watermark, contactinfo, text, deformed, blurry, blur, out of focus, out of frame, surreal, extra, ugly, upholstered walls, fabric walls, plush walls, mirror, mirrored, functional, realistic",
        prompt_strength: options.promptStrength || 0.8,
        num_inference_steps: options.numInferenceSteps || 50,
        guidance_scale: options.guidanceScale || 15,
        ...(options.seed && { seed: options.seed })
      };

      logger.info('📤 Calling Interior Design model', {
        requestId,
        model: this.modelId,
        inputKeys: Object.keys(modelInputs),
        promptLength: prompt.length,
        imageFormat: isHeic ? 'HEIC' : 'JPEG',
        base64Length: base64Image.length,
        imageInputType: typeof modelInputs.image
      });

      // Call Replicate API
      try {
        const prediction = await this.replicate.run(this.modelId, {
          input: modelInputs
        });

        const processingTime = Date.now() - startTime;
        logger.info('✅ Interior design processing completed successfully', {
          requestId,
          processingTime,
          model: this.modelId,
          outputUrl: prediction
        });

        // Handle the output - it might be a URL or a file object
        let outputUrl: string;
        if (typeof prediction === 'string') {
          outputUrl = prediction;
        } else if (prediction && typeof prediction === 'object' && 'url' in prediction) {
          if (typeof prediction.url === 'function') {
            outputUrl = prediction.url();
          } else if (typeof prediction.url === 'string') {
            outputUrl = prediction.url;
          } else {
            throw new Error('Unexpected output format from Interior Design model');
          }
        } else {
          throw new Error('Unexpected output format from Interior Design model');
        }

        return {
          outputUrl,
          metadata: {
            requestId,
            processingTime,
            model: this.modelId,
            prompt,
            options
          }
        };

      } catch (replicateError) {
        const processingTime = Date.now() - startTime;
        
        logger.error('❌ Interior design processing failed', {
          requestId,
          error: replicateError instanceof Error ? replicateError.message : String(replicateError),
          errorStack: replicateError instanceof Error ? replicateError.stack : undefined,
          processingTime,
          model: this.modelId,
          imagePath
        });

        throw new Error(`Interior design processing failed: ${replicateError instanceof Error ? replicateError.message : String(replicateError)}`);
      }

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      logger.error('❌ Interior design processing failed', {
        requestId,
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        processingTime,
        model: this.modelId,
        imagePath
      });

      throw error;
    }
  }

  /**
   * Get model information
   */
  public async getModelInfo(): Promise<Record<string, unknown>> {
    try {
      const model = await this.replicate.models.get('adirik', 'interior-design');
      return {
        name: model.name,
        description: model.description,
        visibility: model.visibility,
        github_url: model.github_url,
        cover_image_url: model.cover_image_url,
        modelId: this.modelId
      };
    } catch (error) {
      logger.error('Failed to get model info', { 
        error: error instanceof Error ? error.message : String(error),
        model: this.modelId 
      });
      throw new Error(`Failed to get model info: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
