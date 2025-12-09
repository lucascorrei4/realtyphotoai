import Replicate from 'replicate';
import { config } from '../config';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export class ElementReplacementService {
  private replicate: Replicate;
  private readonly modelId = 'black-forest-labs/flux-kontext-pro:aa776ca45ce7f7d185418f700df8ec6ca6cb367bfd88e9cd225666c4c179d1d7';

  constructor() {
    this.replicate = new Replicate({
      auth: config.replicateApiToken,
    });
  }

  /**
   * Replace elements in image using flux-kontext-pro model
   * 
   * ⚠️ CRITICAL: Parameters are fixed and tested - DO NOT CHANGE
   */
  public async replaceElements(
    imagePath: string | Buffer,
    prompt: string,
    outputFormat: string = 'jpg'
  ): Promise<string> {
    const startTime = Date.now();
    const requestId = uuidv4();
    
    try {
      logger.info('🎨 Starting element replacement with flux-kontext-pro model', {
        requestId,
        imagePath,
        prompt,
        outputFormat
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
        // Input is a file path - validate it exists first
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
      
      // Convert image to base64 for Replicate API
      const base64Image = imageBuffer.toString('base64');
      
      // ⚠️ CRITICAL: This model requires data URL format - DO NOT CHANGE
      const dataUrl = `data:image/jpeg;base64,${base64Image}`;

      logger.info('🔄 Converting image to base64 for API', {
        requestId,
        originalSize: imageBuffer.length,
        base64Length: base64Image.length
      });

      // ⚠️ CRITICAL: These parameters are fixed and tested - DO NOT CHANGE
      const input = {
        prompt: prompt,
        input_image: dataUrl, // Must be data URL format
        output_format: outputFormat
      };

      logger.info('🚀 Running flux-kontext-pro model', {
        requestId,
        prompt,
        outputFormat,
        model: this.modelId
      });

      // Run the flux-kontext-pro model directly using replicate.run()
      const output = await this.replicate.run(this.modelId, { input });
      
      logger.info('✅ Element replacement completed successfully', {
        requestId,
        processingTime: Date.now() - startTime,
        outputType: typeof output,
        output: output
      });

      // Handle the output - it might be a URL or a file object
      let outputUrl: string;
      
      if (typeof output === 'string') {
        // Direct URL string
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
          throw new Error('Unexpected output format from flux-kontext-pro model');
        }
      } else {
        logger.error('❌ Unexpected output format', { requestId, outputType: typeof output, isArray: Array.isArray(output), isObject: output && typeof output === 'object' });
        throw new Error(`Unexpected output format from flux-kontext-pro model`);
      }

      logger.info('📥 Output URL extracted', {
        requestId,
        outputUrl,
        urlLength: outputUrl.length
      });

      return outputUrl;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error('❌ Element replacement failed', {
        requestId,
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        processingTime,
        imagePath,
        prompt
      });
      throw error;
    }
  }

  /**
   * Get model information
   */
  public async getModelInfo(): Promise<Record<string, unknown>> {
    try {
      const model = await this.replicate.models.get('black-forest-labs', 'flux-kontext-pro');
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
