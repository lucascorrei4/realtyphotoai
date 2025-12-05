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
   * CRITICAL: Must preserve original building structure, shape, size, and layout
   */
  public generateExteriorPrompt(
    originalPrompt: string,
    designType: string,
    style: string
  ): string {
    // Style-specific prefixes from environment variables
    const stylePrefixes: Record<string, string> = {
      isometric: process.env.PROMPT_EXTERIOR_STYLE_ISOMETRIC_PREFIX || 'Create an isometric architectural view of ',
      realistic: process.env.PROMPT_EXTERIOR_STYLE_REALISTIC_PREFIX || 'Create a photorealistic exterior design of ',
      architectural: process.env.PROMPT_EXTERIOR_STYLE_ARCHITECTURAL_PREFIX || 'Create an architectural exterior visualization of '
    };

    const styleSuffixes: Record<string, string> = {
      isometric: process.env.PROMPT_EXTERIOR_STYLE_ISOMETRIC_SUFFIX || '. Show clean geometric lines and technical drawing style',
      realistic: process.env.PROMPT_EXTERIOR_STYLE_REALISTIC_SUFFIX || '. Include realistic lighting, shadows, and materials',
      architectural: process.env.PROMPT_EXTERIOR_STYLE_ARCHITECTURAL_SUFFIX || '. Focus on structural elements and building form'
    };

    let stylePrefix = stylePrefixes[style] || process.env.PROMPT_EXTERIOR_STYLE_DEFAULT_PREFIX || 'Create an exterior design of ';
    let designSuffix = styleSuffixes[style] || '';

    // Design type-specific enhancements from environment variables
    const designTypeEnhancements: Record<string, string> = {
      modern: process.env.PROMPT_EXTERIOR_TYPE_MODERN || '. Modern contemporary style with clean lines, large windows, and minimalist facade',
      traditional: process.env.PROMPT_EXTERIOR_TYPE_TRADITIONAL || '. Traditional architectural style with classical elements and detailed facade',
      minimalist: process.env.PROMPT_EXTERIOR_TYPE_MINIMALIST || '. Minimalist design with simple forms, neutral colors, and clean surfaces',
      industrial: process.env.PROMPT_EXTERIOR_TYPE_INDUSTRIAL || '. Industrial style with exposed materials, metal elements, and urban aesthetic'
    };

    if (designType !== 'custom' && designTypeEnhancements[designType]) {
      designSuffix += designTypeEnhancements[designType];
    }

    // CRITICAL: Add preservation instructions to maintain original building structure
    const preservationInstructions = process.env.PROMPT_EXTERIOR_PRESERVATION || 
      ' PRESERVE the exact original building structure, shape, size, dimensions, roof lines, window positions, door locations, and overall architectural layout. ' +
      'ONLY modify exterior materials, colors, textures, finishes, and design elements. ' +
      'Maintain the same camera angle, perspective, and building footprint. ' +
      'Keep all structural elements (walls, roof shape, foundation) identical to the original. ' +
      'Apply the design transformation while keeping the building structure completely unchanged.';

    return `${stylePrefix}${originalPrompt}${designSuffix}. Transform the existing building with this exterior design concept.${preservationInstructions}`;
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
