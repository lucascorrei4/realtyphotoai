import Replicate from 'replicate';
import { config } from '../config';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export class ExteriorDesignService {
  private replicate: Replicate;
  private readonly modelId = 'google/nano-banana:1b7b945e8f7edf7a034eba6cb2c20f2ab5dc7d090eea1c616e96da947be76aee';

  constructor() {
    this.replicate = new Replicate({
      auth: config.replicateApiToken,
    });
  }

  /**
   * Generate exterior design using google/nano-banana model
   * 
   * ⚠️ CRITICAL: Parameters are fixed and tested - DO NOT CHANGE
   */
  public async generateExteriorDesign(
    buildingImagePath: string | Buffer,
    designPrompt: string,
    designType: 'modern' | 'traditional' | 'minimalist' | 'industrial' | 'custom' = 'modern',
    style: 'isometric' | 'realistic' | 'architectural' = 'architectural'
  ): Promise<{ outputUrl: string; metadata: any }> {
    const startTime = Date.now();
    const requestId = uuidv4();

    try {
      logger.info('🏢 Starting exterior design generation', {
        requestId,
        buildingImagePath,
        designPrompt,
        designType,
        style,
        model: this.modelId
      });

      // Handle both buffer and file path inputs
      let buildingImageBuffer: Buffer;
      let fileSize: number;
      
      if (Buffer.isBuffer(buildingImagePath)) {
        // Input is already a buffer
        buildingImageBuffer = buildingImagePath;
        fileSize = buildingImageBuffer.length;
        logger.info('📁 Building image buffer details', {
          requestId,
          fileSize,
          isBuffer: true
        });
      } else {
        // Input is a file path
        const fs = require('fs');
        if (!fs.existsSync(buildingImagePath)) {
          throw new Error(`Building image file not found: ${buildingImagePath}`);
        }
        
        const buildingImageStats = fs.statSync(buildingImagePath);
        fileSize = buildingImageStats.size;
        logger.info('📁 Building image file details', {
          requestId,
          fileSize,
          fileExists: true,
          buildingImagePath
        });
        
        // Read file into buffer
        buildingImageBuffer = fs.readFileSync(buildingImagePath);
      }

      // Convert image to base64
      logger.info('🔄 Converting building image to base64', { requestId });
      
      try {
        const buildingImageBase64 = buildingImageBuffer.toString('base64');
        logger.info('✅ Building image base64 conversion completed', { 
          requestId, 
          buildingImageBase64Length: buildingImageBase64.length 
        });

        // Generate design-specific prompt based on type and style
        const enhancedPrompt = this.generateExteriorPrompt(designPrompt, designType, style);
        
        const input = {
          prompt: enhancedPrompt,
          image_input: [`data:image/jpeg;base64,${buildingImageBase64}`]
        };

        logger.info('🚀 Running exterior design generation', {
          requestId,
          model: this.modelId,
          originalPrompt: designPrompt,
          enhancedPrompt: enhancedPrompt,
          designType,
          style,
          imageInputLength: input.image_input.length
        });

        // Call Replicate API
        const output = await this.replicate.run(this.modelId, { input });

        const processingTime = Date.now() - startTime;
        logger.info('✅ Exterior design generation completed', {
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
            originalPrompt: designPrompt,
            enhancedPrompt,
            designType,
            style
          }
        };

      } catch (base64Error) {
        logger.error('❌ Base64 conversion failed', {
          requestId,
          error: base64Error instanceof Error ? base64Error.message : String(base64Error),
          buildingImagePath
        });
        throw new Error(`Image conversion failed: ${base64Error instanceof Error ? base64Error.message : String(base64Error)}`);
      }

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      logger.error('❌ Exterior design generation failed', {
        requestId,
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        processingTime,
        model: this.modelId,
        buildingImagePath,
        designPrompt,
        designType,
        style
      });

      throw error;
    }
  }

  /**
   * Generate enhanced prompt based on design type and style
   */
  private generateExteriorPrompt(
    originalPrompt: string,
    designType: string,
    style: string
  ): string {
    let stylePrefix = '';
    let designSuffix = '';

    // Style-specific prefixes
    switch (style) {
      case 'isometric':
        stylePrefix = 'Create an isometric architectural view of ';
        designSuffix = '. Show clean geometric lines and technical drawing style';
        break;
      case 'realistic':
        stylePrefix = 'Create a photorealistic exterior design of ';
        designSuffix = '. Include realistic lighting, shadows, and materials';
        break;
      case 'architectural':
        stylePrefix = 'Create an architectural exterior visualization of ';
        designSuffix = '. Focus on structural elements and building form';
        break;
      default:
        stylePrefix = 'Create an exterior design of ';
    }

    // Design type-specific enhancements
    switch (designType) {
      case 'modern':
        designSuffix += '. Modern contemporary style with clean lines, large windows, and minimalist facade';
        break;
      case 'traditional':
        designSuffix += '. Traditional architectural style with classical elements and detailed facade';
        break;
      case 'minimalist':
        designSuffix += '. Minimalist design with simple forms, neutral colors, and clean surfaces';
        break;
      case 'industrial':
        designSuffix += '. Industrial style with exposed materials, metal elements, and urban aesthetic';
        break;
      case 'custom':
        // Keep original prompt as-is for custom designs
        break;
    }

    return `${stylePrefix}${originalPrompt}${designSuffix}. Transform the existing building with this exterior design concept.`;
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
