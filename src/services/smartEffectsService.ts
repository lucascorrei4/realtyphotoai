import Replicate from 'replicate';
import { config } from '../config';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export type EffectType = 
  | 'dusk'
  | 'balloons'
  | 'helicopter'
  | 'gift_bow'
  | 'fireworks'
  | 'confetti'
  | 'holiday_lights'
  | 'snow'
  | 'sunrise';

export class SmartEffectsService {
  private replicate: Replicate;
  private readonly modelId = 'google/nano-banana:1b7b945e8f7edf7a034eba6cb2c20f2ab5dc7d090eea1c616e96da947be76aee';

  constructor() {
    this.replicate = new Replicate({
      auth: config.replicateApiToken,
    });
  }

  /**
   * Generate smart effect using google/nano-banana model
   * Uses the same model as exterior design but with effect-specific prompts
   * 
   * ⚠️ CRITICAL: Parameters are fixed and tested - DO NOT CHANGE
   */
  public async generateSmartEffect(
    houseImagePath: string | Buffer,
    effectType: EffectType,
    customPrompt?: string
  ): Promise<{ outputUrl: string; metadata: any }> {
    const startTime = Date.now();
    const requestId = uuidv4();

    try {
      logger.info('✨ Starting smart effect generation', {
        requestId,
        houseImagePath,
        effectType,
        customPrompt,
        model: this.modelId
      });

      // Handle both buffer and file path inputs
      let houseImageBuffer: Buffer;
      let fileSize: number;
      
      if (Buffer.isBuffer(houseImagePath)) {
        // Input is already a buffer
        houseImageBuffer = houseImagePath;
        fileSize = houseImageBuffer.length;
        logger.info('📁 House image buffer details', {
          requestId,
          fileSize,
          isBuffer: true
        });
      } else {
        // Input is a file path
        const fs = require('fs');
        if (!fs.existsSync(houseImagePath)) {
          throw new Error(`House image file not found: ${houseImagePath}`);
        }
        
        const houseImageStats = fs.statSync(houseImagePath);
        fileSize = houseImageStats.size;
        logger.info('📁 House image file details', {
          requestId,
          fileSize,
          fileExists: true,
          houseImagePath
        });
        
        // Read file into buffer
        houseImageBuffer = fs.readFileSync(houseImagePath);
      }

      // Convert image to base64
      logger.info('🔄 Converting house image to base64', { requestId });
      
      try {
        const houseImageBase64 = houseImageBuffer.toString('base64');
        logger.info('✅ House image base64 conversion completed', { 
          requestId, 
          houseImageBase64Length: houseImageBase64.length 
        });

        // Generate effect-specific prompt
        const enhancedPrompt = this.generateEffectPrompt(effectType, customPrompt);
        
        const input = {
          prompt: enhancedPrompt,
          image_input: [`data:image/jpeg;base64,${houseImageBase64}`]
        };

        logger.info('🚀 Running smart effect generation', {
          requestId,
          model: this.modelId,
          effectType,
          customPrompt,
          enhancedPrompt: enhancedPrompt,
          imageInputLength: input.image_input.length
        });

        // Call Replicate API
        const output = await this.replicate.run(this.modelId, { input });

        const processingTime = Date.now() - startTime;
        logger.info('✅ Smart effect generation completed', {
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
            effectType,
            customPrompt,
            enhancedPrompt
          }
        };

      } catch (base64Error) {
        logger.error('❌ Base64 conversion failed', {
          requestId,
          error: base64Error instanceof Error ? base64Error.message : String(base64Error),
          houseImagePath
        });
        throw new Error(`Image conversion failed: ${base64Error instanceof Error ? base64Error.message : String(base64Error)}`);
      }

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      logger.error('❌ Smart effect generation failed', {
        requestId,
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        processingTime,
        model: this.modelId,
        houseImagePath,
        effectType,
        customPrompt
      });

      throw error;
    }
  }

  /**
   * Generate effect-specific prompt based on effect type
   * CRITICAL: Must preserve original house structure, shape, size, and layout
   */
  public generateEffectPrompt(
    effectType: EffectType,
    customPrompt?: string
  ): string {
    // Get effect description from environment variable or use default
    const effectPrompts: Record<EffectType, string> = {
      dusk: process.env.PROMPT_EFFECT_DUSK || 'Transform the house with beautiful evening dusk lighting, warm golden hour colors, dramatic sky with purple and orange hues, soft ambient lighting from windows, creating a cozy and magical evening atmosphere',
      balloons: process.env.PROMPT_EFFECT_BALLOONS || 'Add a thousand colorful balloons floating over and around the house like a gift celebration, vibrant balloons in various colors and sizes, festive atmosphere, balloons rising from the ground and floating in the sky, making the house look like a special gift',
      helicopter: process.env.PROMPT_EFFECT_HELICOPTER || 'A dynamic image of this house unveiling ceremony on a sunny day with a clear blue sky and scattered white clouds. A sleek black helicopter hovers above it.  The house is initially covered by a massive black fabric drape. The helicopter, attached to the drape via a central cable and hook, slowly ascends and pulls the fabric upward from the center, causing it to split and peel away symmetrically like curtains opening, gradually revealing the house from top to bottom over 10 seconds. Start with a wide establishing shot from ground level looking up, then transition to a smooth tracking camera that circles slightly around the scene as the reveal happens, emphasizing the fabric billowing in the wind and the sunlight glinting off the helicopter rotors. Realistic style, high detail, cinematic lighting with lens flare from the sun, no text or people visible.',
      gift_bow: process.env.PROMPT_EFFECT_GIFT_BOW || 'A big decorative red ribbon bow elegantly placed over the house making it look like a giant gift, festive gift wrapping, elegant bow with flowing ribbons, celebration aesthetic, the house wrapped like a present',
      fireworks: process.env.PROMPT_EFFECT_FIREWORKS || 'Spectacular fireworks display exploding over the house, colorful fireworks bursting in the night sky, celebration atmosphere, brilliant colors and light trails, festive celebration scene, nighttime setting',
      confetti: process.env.PROMPT_EFFECT_CONFETTI || 'Colorful confetti raining down around the house in celebration, vibrant confetti particles floating in the air, festive atmosphere, party celebration, colorful paper confetti scattered everywhere, joyful scene',
      holiday_lights: process.env.PROMPT_EFFECT_HOLIDAY_LIGHTS || 'Beautiful holiday lights decorating the entire house, colorful Christmas lights, festive illumination, warm glowing lights on roof and windows, holiday decoration, magical evening atmosphere',
      snow: process.env.PROMPT_EFFECT_SNOW || 'Gentle snow falling on the house creating a winter wonderland, soft snowflakes drifting down, snow accumulation on roof and ground, cozy winter scene, peaceful atmosphere, beautiful winter lighting',
      sunrise: process.env.PROMPT_EFFECT_SUNRISE || 'Stunning sunrise lighting illuminating the house, beautiful golden morning light, warm sunrise colors in sky, peaceful morning atmosphere, soft radiant lighting, dramatic sky with pink and orange hues'
    };

    let effectDescription = effectPrompts[effectType] || 'Apply a magical visual effect to transform the house';

    // Combine with custom prompt if provided
    let finalPrompt = effectDescription;
    if (customPrompt && customPrompt.trim()) {
      finalPrompt = `${effectDescription}. ${customPrompt.trim()}`;
    }

    // CRITICAL: Add strong preservation instructions to maintain original house structure
    // This is essential for video generation fidelity - the house must remain identical
    const preservationInstructions = process.env.PROMPT_EFFECT_PRESERVATION || 
      ' CRITICAL PRESERVATION REQUIREMENTS: The house structure, shape, size, dimensions, roof lines, window positions, door locations, architectural layout, walls, foundation, and all structural elements MUST remain EXACTLY identical to the original image. ' +
      'DO NOT modify, change, alter, resize, reshape, or transform the house in any way. ' +
      'ONLY add visual effects around, over, or in the environment surrounding the house. ' +
      'Maintain the exact same camera angle, perspective, house footprint, and architectural proportions. ' +
      'The house must be pixel-perfect identical to preserve video generation fidelity. ' +
      'The effect should ONLY enhance and decorate the scene, NEVER alter the house architecture or structure.';

    // Place preservation instructions at both the beginning (for emphasis) and end (as reinforcement)
    return `CRITICAL: ${preservationInstructions} Create a photorealistic image showing ${finalPrompt}. ${preservationInstructions}`;
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

