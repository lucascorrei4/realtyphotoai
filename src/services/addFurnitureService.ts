import Replicate from 'replicate';
import { config } from '../config';
import { logger } from '../utils/logger';
import { FileUtils } from '../utils/fileUtils';
import { v4 as uuidv4 } from 'uuid';

export class AddFurnitureService {
  private replicate: Replicate;
  private readonly modelId = 'google/nano-banana:1b7b945e8f7edf7a034eba6cb2c20f2ab5dc7d090eea1c616e96da947be76aee';

  constructor() {
    this.replicate = new Replicate({
      auth: config.replicateApiToken,
    });
  }

  /**
   * Add furniture to room using google/nano-banana model
   * 
   * ⚠️ CRITICAL: Parameters are fixed and tested - DO NOT CHANGE
   */
  public async addFurniture(
    roomImagePath: string,
    furnitureImagePath: string | null = null,
    prompt: string,
    furnitureType: string = 'general'
  ): Promise<{ outputUrl: string; metadata: any }> {
    const startTime = Date.now();
    const requestId = uuidv4();

    try {
      logger.info('🪑 Starting furniture addition', {
        requestId,
        roomImagePath,
        furnitureImagePath,
        prompt,
        furnitureType,
        model: this.modelId
      });

      // Validate room image file exists
      const fs = require('fs');
      if (!fs.existsSync(roomImagePath)) {
        throw new Error(`Room image file not found: ${roomImagePath}`);
      }
      
      const roomImageStats = fs.statSync(roomImagePath);
      logger.info('📁 Room image file details', {
        requestId,
        fileSize: roomImageStats.size,
        fileExists: true,
        roomImagePath
      });

      // Validate furniture image file if provided
      if (furnitureImagePath && !fs.existsSync(furnitureImagePath)) {
        throw new Error(`Furniture image file not found: ${furnitureImagePath}`);
      }

      // Convert images to base64
      logger.info('🔄 Converting images to base64', { requestId });
      
      try {
        const roomImageBase64 = await FileUtils.imageToBase64(roomImagePath);
        logger.info('✅ Room image base64 conversion completed', { 
          requestId, 
          roomImageBase64Length: roomImageBase64.length 
        });

        let furnitureImageBase64: string | null = null;
        if (furnitureImagePath) {
          furnitureImageBase64 = await FileUtils.imageToBase64(furnitureImagePath);
          logger.info('✅ Furniture image base64 conversion completed', { 
            requestId, 
            furnitureImageBase64Length: furnitureImageBase64.length 
          });
        }

        // Prepare input based on whether we have a specific furniture image
        let input: any;
        
        if (furnitureImageBase64) {
          // Specific furniture addition - use furniture image as style reference
          input = {
            prompt: `${prompt}. Use the style and design of the furniture in the second image as inspiration to add similar furniture to the room. Do not copy the exact furniture, but create furniture that matches the style, color, and design aesthetic.`,
            image_input: [`data:image/jpeg;base64,${roomImageBase64}`, `data:image/jpeg;base64,${furnitureImageBase64}`]
          };
          logger.info('🚀 Using specific furniture addition mode (style reference)', {
            requestId,
            prompt: input.prompt,
            imageCount: 2
          });
        } else {
          // General furniture addition
          input = {
            prompt: `${prompt}. Add modern furniture to this room.`,
            image_input: [`data:image/jpeg;base64,${roomImageBase64}`]
          };
          logger.info('🚀 Using general furniture addition mode', {
            requestId,
            prompt: input.prompt,
            imageCount: 1
          });
        }

        logger.info('📤 Calling nano-banana model', {
          requestId,
          model: this.modelId,
          inputKeys: Object.keys(input),
          promptLength: input.prompt.length,
          imageInputLength: input.image_input.length
        });

        // Call Replicate API
        const output = await this.replicate.run(this.modelId, { input });

        const processingTime = Date.now() - startTime;
        logger.info('✅ Furniture addition model completed', {
          requestId,
          processingTime,
          model: this.modelId,
          outputType: typeof output,
          output: output
        });

        // Handle the output - it might be a URL or a file object
        let outputUrl: string;
        if (typeof output === 'string') {
          outputUrl = output;
        } else if (output && typeof output === 'object' && 'url' in output) {
          if (typeof output.url === 'function') {
            outputUrl = output.url();
          } else if (typeof output.url === 'string') {
            outputUrl = output.url;
          } else {
            throw new Error('Unexpected output format from nano-banana model');
          }
        } else {
          throw new Error('Unexpected output format from nano-banana model');
        }

        return {
          outputUrl,
          metadata: {
            requestId,
            processingTime,
            model: this.modelId,
            prompt,
            furnitureType,
            hasSpecificFurniture: !!furnitureImageBase64
          }
        };

      } catch (base64Error) {
        logger.error('❌ Base64 conversion failed', {
          requestId,
          error: base64Error instanceof Error ? base64Error.message : String(base64Error),
          roomImagePath,
          furnitureImagePath
        });
        throw new Error(`Image conversion failed: ${base64Error instanceof Error ? base64Error.message : String(base64Error)}`);
      }

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      logger.error('❌ Furniture addition failed', {
        requestId,
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        processingTime,
        model: this.modelId,
        roomImagePath,
        furnitureImagePath
      });

      throw error;
    }
  }

  /**
   * Get model information
   */
  public async getModelInfo(): Promise<Record<string, unknown>> {
    try {
      const model = await this.replicate.models.get('google', 'nano-banana');
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
