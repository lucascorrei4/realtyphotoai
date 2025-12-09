import Replicate from 'replicate';
import { config } from '../config';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export class ImageEnhancementService {
  private replicate: Replicate;
  private readonly modelId = 'bria/increase-resolution:9ccbba9d7165d73c331075144c562dd84c750bb4267d84b3f1f675a156570c99';

  constructor() {
    this.replicate = new Replicate({
      auth: config.replicateApiToken,
    });
  }

  /**
   * Enhance image using bria/increase-resolution model for image enhancement
   * 
   * ⚠️ CRITICAL: Parameters are fixed and tested - DO NOT CHANGE
   */
  public async enhanceImage(
    imagePath: string | Buffer,
    referenceImagePath: string | Buffer | null = null,
    enhancementType: string = 'luminosity',
    enhancementStrength: string = 'moderate'
  ): Promise<string> {
    const startTime = Date.now();
    const requestId = uuidv4();
    
    try {
      logger.info('🚀 Starting image enhancement with bria/increase-resolution model', {
        requestId,
        imagePath,
        enhancementType,
        enhancementStrength,
        hasReferenceImage: !!referenceImagePath,
        model: this.modelId
      });

      // Handle both buffer and file path inputs
      let imageBuffer: Buffer;
      
      if (Buffer.isBuffer(imagePath)) {
        // Input is already a buffer
        imageBuffer = imagePath;
        logger.info('📁 Image buffer details', {
          requestId,
          bufferSize: imageBuffer.length,
          isBuffer: true
        });
      } else {
        // Input is a file path
        const fs = require('fs');
        if (!fs.existsSync(imagePath)) {
          throw new Error(`Input image file not found: ${imagePath}`);
        }
        
        logger.info('📁 Image file details', {
          requestId,
          imagePath,
          fileExists: true
        });
        
        // Read file into buffer
        imageBuffer = fs.readFileSync(imagePath);
      }
      
      // Convert image to base64
      logger.info('🔄 Converting image to base64', { requestId });
      const imageBase64 = imageBuffer.toString('base64');
      
      logger.info('✅ Base64 conversion completed', { 
        requestId, 
        base64Length: imageBase64.length 
      });

      // ⚠️ CRITICAL: These strength mappings are fixed and tested - DO NOT CHANGE
      const strengthMap: Record<string, number> = {
        subtle: 2,
        moderate: 4,
        strong: 6
      };
      
      const desiredIncrease = strengthMap[enhancementStrength] || 4;
      logger.info('⚙️ Enhancement parameters', { 
        requestId, 
        enhancementType, 
        enhancementStrength, 
        desiredIncrease 
      });

      // ⚠️ CRITICAL: These parameters are fixed and tested - DO NOT CHANGE
      const input: any = {
        image: `data:image/jpeg;base64,${imageBase64}`, // Must be data URL format
        desired_increase: desiredIncrease
      };

      logger.info('📤 Calling bria/increase-resolution model', { 
        requestId, 
        model: this.modelId,
        inputKeys: Object.keys(input),
        imageLength: imageBase64.length
      });

      // Run the bria/increase-resolution model
      const output = await this.replicate.run(this.modelId, { input });

      // Handle the output - it might be a URL or a file object
      let outputUrl: string;
      if (typeof output === 'string') {
        outputUrl = output;
        logger.info('✅ Output is string URL', { requestId, outputUrl });
      } else if (output && typeof output === 'object' && 'url' in output) {
        if (typeof output.url === 'function') {
          outputUrl = output.url();
          logger.info('✅ Output URL from function', { requestId, outputUrl });
        } else if (typeof output.url === 'string') {
          outputUrl = output.url;
          logger.info('✅ Output URL from object', { requestId, outputUrl });
        } else {
          logger.error('❌ Unexpected URL format', { requestId, outputUrlType: typeof output.url });
          throw new Error('Unexpected output format from bria/increase-resolution model');
        }
      } else {
        logger.error('❌ Unexpected output format', { requestId, outputType: typeof output, isArray: Array.isArray(output), isObject: output && typeof output === 'object' });
        throw new Error('Unexpected output format from bria/increase-resolution model');
      }

      // Validate the output URL
      if (!outputUrl || typeof outputUrl !== 'string') {
        throw new Error('Invalid output URL received from model');
      }

      const processingTime = Date.now() - startTime;
      logger.info('✅ Image enhancement completed successfully', {
        requestId,
        processingTime,
        enhancementType,
        enhancementStrength,
        desiredIncrease,
        outputUrl
      });

      return outputUrl;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error('❌ Image enhancement failed', { 
        requestId,
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        processingTime,
        enhancementType,
        enhancementStrength
      });
      throw new Error(`Image enhancement failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get model information
   */
  public async getModelInfo(): Promise<Record<string, unknown>> {
    try {
      const model = await this.replicate.models.get('bria', 'increase-resolution');
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
