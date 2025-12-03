import Replicate from 'replicate';
import { config } from '../config';
import { logger } from '../utils/logger';
import { FileUtils } from '../utils/fileUtils';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

export class InteriorDesignService {
  private replicate: Replicate;
  private readonly modelId = 'google/nano-banana:1b7b945e8f7edf7a034eba6cb2c20f2ab5dc7d090eea1c616e96da947be76aee';

  constructor() {
    this.replicate = new Replicate({
      auth: config.replicateApiToken,
    });
  }

  /**
   * Generate interior design using google/nano-banana model
   * 
   * ⚠️ CRITICAL: Parameters are fixed and tested - DO NOT CHANGE
   */
  public async generateInteriorDesign(
    roomImagePath: string,
    designPrompt: string,
    designType: 'modern' | 'traditional' | 'minimalist' | 'scandinavian' | 'industrial' | 'bohemian' | 'custom' = 'modern',
    style: 'realistic' | 'architectural' | 'lifestyle' = 'realistic'
  ): Promise<{ outputUrl: string; metadata: any }> {
    const requestId = uuidv4();
    const startTime = Date.now();

    try {
      logger.info('🏠 Starting interior design generation', {
        requestId,
        roomImagePath,
        designPrompt,
        designType,
        style,
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

      // Check if file is HEIC and provide better error handling
      const fileExtension = path.extname(roomImagePath).toLowerCase();
      const isHeic = fileExtension === '.heic' || fileExtension === '.heif';
      
      if (isHeic) {
        logger.warn('⚠️ HEIC file detected - this may cause processing issues', {
          requestId,
          roomImagePath,
          fileExtension
        });
        
        // Validate HEIC file can be processed
        try {
          const sharp = require('sharp');
          const metadata = await sharp(roomImagePath).metadata();
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
      logger.info('🔄 Converting room image to base64', { requestId });
      
      try {
        const roomImageBase64 = await FileUtils.imageToBase64(roomImagePath);
        logger.info('✅ Room image base64 conversion completed', { 
          requestId, 
          roomImageBase64Length: roomImageBase64.length 
        });

        // Generate design-specific prompt based on type and style
        const enhancedPrompt = this.generateInteriorPrompt(designPrompt, designType, style);
        
        const input = {
          prompt: enhancedPrompt,
          image_input: [`data:image/jpeg;base64,${roomImageBase64}`]
        };

        logger.info('🚀 Running interior design generation', {
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
        logger.info('✅ Interior design generation completed', {
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
          roomImagePath
        });
        throw new Error(`Image conversion failed: ${base64Error instanceof Error ? base64Error.message : String(base64Error)}`);
      }

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      logger.error('❌ Interior design generation failed', {
        requestId,
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        processingTime,
        model: this.modelId,
        roomImagePath,
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
  private generateInteriorPrompt(
    originalPrompt: string,
    designType: string,
    style: string
  ): string {
    // Style-specific prefixes from environment variables
    const stylePrefixes: Record<string, string> = {
      realistic: process.env.PROMPT_INTERIOR_STYLE_REALISTIC_PREFIX || 'Create a photorealistic interior design of ',
      architectural: process.env.PROMPT_INTERIOR_STYLE_ARCHITECTURAL_PREFIX || 'Create an architectural interior visualization of ',
      lifestyle: process.env.PROMPT_INTERIOR_STYLE_LIFESTYLE_PREFIX || 'Create a lifestyle interior design of '
    };

    const styleSuffixes: Record<string, string> = {
      realistic: process.env.PROMPT_INTERIOR_STYLE_REALISTIC_SUFFIX || '. Include realistic lighting, shadows, textures, and materials',
      architectural: process.env.PROMPT_INTERIOR_STYLE_ARCHITECTURAL_SUFFIX || '. Focus on structural elements, spatial design, and architectural details',
      lifestyle: process.env.PROMPT_INTERIOR_STYLE_LIFESTYLE_SUFFIX || '. Show the space as lived-in with warm, inviting atmosphere'
    };

    let stylePrefix = stylePrefixes[style] || process.env.PROMPT_INTERIOR_STYLE_DEFAULT_PREFIX || 'Create an interior design of ';
    let designSuffix = styleSuffixes[style] || '';

    // Design type-specific enhancements from environment variables
    const designTypeEnhancements: Record<string, string> = {
      modern: process.env.PROMPT_INTERIOR_TYPE_MODERN || '. Modern contemporary style with clean lines, neutral colors, and minimalist furniture',
      traditional: process.env.PROMPT_INTERIOR_TYPE_TRADITIONAL || '. Traditional style with classic furniture, rich textures, and warm color palette',
      minimalist: process.env.PROMPT_INTERIOR_TYPE_MINIMALIST || '. Minimalist design with simple forms, neutral colors, and uncluttered spaces',
      scandinavian: process.env.PROMPT_INTERIOR_TYPE_SCANDINAVIAN || '. Scandinavian style with light woods, white walls, cozy textiles, and hygge elements',
      industrial: process.env.PROMPT_INTERIOR_TYPE_INDUSTRIAL || '. Industrial style with exposed brick, metal elements, concrete surfaces, and urban aesthetic',
      bohemian: process.env.PROMPT_INTERIOR_TYPE_BOHEMIAN || '. Bohemian style with eclectic furniture, vibrant colors, patterns, and artistic elements'
    };

    if (designType !== 'custom' && designTypeEnhancements[designType]) {
      designSuffix += designTypeEnhancements[designType];
    }

    return `${stylePrefix}${originalPrompt}${designSuffix}. Transform the existing room with this interior design concept.`;
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
