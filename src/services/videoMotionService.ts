import Replicate from 'replicate';
import { config } from '../config';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';

export type VideoMotionType = 'veo3_fast';

export interface VideoMotionOptions {
  prompt?: string;
  aspectRatio?: '16:9' | '9:16';
  duration?: 4 | 6 | 8;
  resolution?: '1080p';
  generateAudio?: boolean;
  cameraMovement?: string; // For camera movement: e.g., "[Pan left, Zoom in]"
  negativePrompt?: string;
}

/**
 * Calculate aspect ratio from image dimensions
 * Veo-3.1-Fast only supports 16:9 and 9:16, so square images default to 16:9
 */
function calculateAspectRatio(width: number, height: number): '16:9' | '9:16' {
  // More explicit logic:
  // - If height > width (portrait), use 9:16
  // - If width >= height (landscape or square), use 16:9
  // This ensures proper aspect ratio matching
  
  if (height > width) {
    // Portrait image - use 9:16
    return '9:16';
  } else {
    // Landscape or square image - use 16:9
    return '16:9';
  }
}

/**
 * Get the correct displayed dimensions accounting for EXIF orientation
 * EXIF orientations 5, 6, 7, 8 require swapping width and height
 */
function getOrientedDimensions(width: number, height: number, orientation?: number): { width: number; height: number } {
  // EXIF orientations that require swapping dimensions:
  // 5 = Rotate 90° CCW and flip horizontal
  // 6 = Rotate 90° CW
  // 7 = Rotate 90° CCW and flip vertical
  // 8 = Rotate 90° CCW
  if (orientation && [5, 6, 7, 8].includes(orientation)) {
    return { width: height, height: width };
  }
  return { width, height };
}

/**
 * Get image dimensions from URL or buffer and calculate aspect ratio
 * Returns only '16:9' or '9:16' as those are the only values supported by Veo-3.1-Fast
 * CRITICAL: Accounts for EXIF orientation to ensure correct aspect ratio detection
 */
async function getImageAspectRatio(imagePath: string | Buffer): Promise<'16:9' | '9:16'> {
  try {
    let metadata: sharp.Metadata;
    
    if (Buffer.isBuffer(imagePath)) {
      metadata = await sharp(imagePath).metadata();
    } else if (typeof imagePath === 'string' && (imagePath.startsWith('http://') || imagePath.startsWith('https://'))) {
      // Download image to get metadata
      const response = await fetch(imagePath);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      metadata = await sharp(buffer).metadata();
    } else {
      // File path
      metadata = await sharp(imagePath).metadata();
    }
    
    if (!metadata.width || !metadata.height) {
      logger.warn('Could not determine image dimensions, defaulting to 16:9');
      return '16:9';
    }
    
    // Get correct dimensions accounting for EXIF orientation
    // This is critical for smartphone photos which often have orientation metadata
    const orientedDims = getOrientedDimensions(metadata.width, metadata.height, metadata.orientation);
    const aspectRatio = calculateAspectRatio(orientedDims.width, orientedDims.height);
    const imageRatio = orientedDims.width / orientedDims.height;
    
    logger.info('📐 Calculated aspect ratio from image dimensions', {
      rawWidth: metadata.width,
      rawHeight: metadata.height,
      orientedWidth: orientedDims.width,
      orientedHeight: orientedDims.height,
      exifOrientation: metadata.orientation,
      imageRatio: imageRatio.toFixed(3),
      aspectRatio,
      isPortrait: orientedDims.height > orientedDims.width,
      isLandscape: orientedDims.width > orientedDims.height,
      isSquare: orientedDims.width === orientedDims.height
    });
    
    return aspectRatio;
  } catch (error) {
    logger.warn('Failed to detect image dimensions, defaulting to 16:9', {
      error: error instanceof Error ? error.message : String(error)
    });
    return '16:9'; // Default fallback
  }
}

export class VideoMotionService {
  private replicate: Replicate;
  private readonly veo3FastModelId = 'google/veo-3.1-fast:af87cbb0ee4dfffefb483e206251676fe21107fdec31aeb1f8855b55acea4fda';

  constructor() {
    this.replicate = new Replicate({
      auth: config.replicateApiToken,
    });
  }

  /**
   * Check if a URL is a localhost URL (not publicly accessible by Replicate servers)
   */
  private isLocalhostUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();
      
      // Check for localhost variants
      return (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '0.0.0.0' ||
        hostname === '::1' ||
        hostname.startsWith('127.') ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('172.16.') ||
        hostname.startsWith('172.17.') ||
        hostname.startsWith('172.18.') ||
        hostname.startsWith('172.19.') ||
        hostname.startsWith('172.20.') ||
        hostname.startsWith('172.21.') ||
        hostname.startsWith('172.22.') ||
        hostname.startsWith('172.23.') ||
        hostname.startsWith('172.24.') ||
        hostname.startsWith('172.25.') ||
        hostname.startsWith('172.26.') ||
        hostname.startsWith('172.27.') ||
        hostname.startsWith('172.28.') ||
        hostname.startsWith('172.29.') ||
        hostname.startsWith('172.30.') ||
        hostname.startsWith('172.31.')
      );
    } catch {
      return false;
    }
  }

  /**
   * Download image from URL and convert to base64
   */
  private async downloadImageAsBase64(url: string, requestId: string): Promise<string> {
    try {
      logger.info('⬇️ Downloading image from URL for base64 conversion', { requestId, url });
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64 = buffer.toString('base64');
      
      logger.info('✅ Image downloaded and converted to base64', { 
        requestId, 
        originalSize: buffer.length,
        base64Length: base64.length 
      });
      
      return `data:image/jpeg;base64,${base64}`;
    } catch (error) {
      logger.error('❌ Failed to download image for base64 conversion', {
        requestId,
        url,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Detect effect type from smart effects prompt by matching keywords
   */
  private detectEffectTypeFromPrompt(prompt: string): string | null {
    const promptLower = prompt.toLowerCase();
    
    if (promptLower.includes('helicopter') || promptLower.includes('drape') || promptLower.includes('unveiling')) {
      return 'helicopter';
    } else if (promptLower.includes('balloon')) {
      return 'balloons';
    } else if (promptLower.includes('dusk') || promptLower.includes('evening') || promptLower.includes('golden hour')) {
      return 'dusk';
    } else if (promptLower.includes('firework')) {
      return 'fireworks';
    } else if (promptLower.includes('confetti')) {
      return 'confetti';
    } else if (promptLower.includes('holiday') || promptLower.includes('christmas') || promptLower.includes('light')) {
      return 'holiday_lights';
    } else if (promptLower.includes('snow') || promptLower.includes('winter')) {
      return 'snow';
    } else if (promptLower.includes('sunrise') || promptLower.includes('morning light')) {
      return 'sunrise';
    } else if (promptLower.includes('gift') || promptLower.includes('bow') || promptLower.includes('ribbon')) {
      return 'gift_bow';
    }
    
    return null;
  }

  /**
   * Generate effect-specific video prompt with complete movement sequence optimized for 6 seconds
   */
  private generateEffectSpecificVideoPrompt(effectType: string | null): string | null {
    if (!effectType) {
      return null;
    }

    // Effect-specific video prompts that describe the complete movement sequence in 6 seconds
    const effectVideoPrompts: Record<string, string> = {
      helicopter: process.env.PROMPT_VIDEO_HELICOPTER || 
        `Create a dynamic 6-second video: The sleek black helicopter rapidly ascends, pulling the massive black fabric drape upward from the center. The fabric splits and peels away symmetrically like curtains opening, completely revealing the entire house from top to bottom in the first 3 seconds. The helicopter then flies away at high speed, pulling the fabric behind it like a banner, exiting the scene in the remaining 3 seconds. Fast, cinematic movement with fabric billowing in the wind, sunlight glinting off helicopter rotors, and smooth camera tracking. The entire sequence completes in exactly 6 seconds with dynamic, fast-paced motion.`,
      
      balloons: process.env.PROMPT_VIDEO_BALLOONS ||
        `Create a dynamic 6-second video: Colorful balloons float and rise around the house, ascending into the sky with gentle but noticeable movement. The balloons drift upward and away from the house, creating a festive celebration scene. Smooth, floating motion throughout the 6-second sequence.`,
      
      fireworks: process.env.PROMPT_VIDEO_FIREWORKS ||
        `Create a dynamic 6-second video: Spectacular fireworks explode and burst in sequence over the house in the night sky. Multiple colorful fireworks launch, explode, and create brilliant light trails across the sky. Fast, explosive movements with colorful bursts filling the scene throughout the 6-second sequence.`,
      
      confetti: process.env.PROMPT_VIDEO_CONFETTI ||
        `Create a dynamic 6-second video: Colorful confetti rains down and swirls around the house. Confetti particles float, drift, and dance in the air with dynamic movement, creating a festive celebration atmosphere. Continuous motion throughout the 6-second sequence.`,
      
      snow: process.env.PROMPT_VIDEO_SNOW ||
        `Create a dynamic 6-second video: Gentle snowflakes fall continuously from the sky, drifting down and accumulating around the house. Snow particles float and swirl with natural wind movement, creating a peaceful winter scene. Smooth, continuous snowfall motion throughout the 6-second sequence.`,
      
      dusk: process.env.PROMPT_VIDEO_DUSK ||
        `Create a dynamic 6-second video: The sky transitions with dramatic dusk lighting, warm golden hour colors, and purple-orange hues. Clouds move slowly, lighting shifts subtly, and the scene shows the beautiful evening atmosphere with natural, gentle movement throughout the 6-second sequence.`,
      
      sunrise: process.env.PROMPT_VIDEO_SUNRISE ||
        `Create a dynamic 6-second video: The sky shows stunning sunrise lighting with beautiful golden morning light. Warm sunrise colors transition in the sky, clouds move gently, and the scene illuminates with soft radiant lighting. Natural, gentle movement throughout the 6-second sequence.`,
      
      holiday_lights: process.env.PROMPT_VIDEO_HOLIDAY_LIGHTS ||
        `Create a dynamic 6-second video: Holiday lights twinkle and glow on the house. Lights pulse gently, creating a festive illumination that shifts subtly. Warm glowing lights create a magical evening atmosphere with gentle, twinkling motion throughout the 6-second sequence.`,
      
      gift_bow: process.env.PROMPT_VIDEO_GIFT_BOW ||
        `Create a dynamic 6-second video: The big decorative red ribbon bow elegantly placed over the house begins to untie and unwrap. The ribbons loosen and unfurl, gracefully falling away from the house in the first 3 seconds, completely revealing the house underneath. The bow and ribbons then drift away or fall off, leaving the house fully revealed in the remaining 3 seconds. Fast, elegant unwrapping motion with ribbons flowing and billowing as they come undone, creating a festive gift-unwrapping reveal. The entire sequence completes in exactly 6 seconds with dynamic, cinematic movement.`
    };

    if (effectVideoPrompts[effectType]) {
      return effectVideoPrompts[effectType];
    }

    return null;
  }

  /**
   * Generate the full video prompt with environment variables and camera movement
   * This method can be called before creating generation records to get the complete prompt
   * @param options - Video motion options including prompt and camera movement
   * @param originalPrompt - Optional original prompt from the source image generation (e.g., from smart effects)
   * @param originalModelType - Optional original model type to understand the context (e.g., 'smart_effects')
   */
  public generateVideoPrompt(options: VideoMotionOptions = {}, originalPrompt?: string, originalModelType?: string): string {
    const defaultVideoMotionPrompt = process.env.PROMPT_VIDEO_MOTION_DEFAULT || 'Add a impressive ultrarealistic movement to this image';
    
    // If we have an original prompt (especially from smart effects), enhance the video prompt with context
    let basePrompt = options.prompt || defaultVideoMotionPrompt;
    
    if (originalPrompt && originalModelType === 'smart_effects') {
      // For smart effects, create effect-specific video prompts that describe the complete movement sequence
      // Extract effect type from prompt or detect it
      const effectType = this.detectEffectTypeFromPrompt(originalPrompt);
      
      // Generate effect-specific video prompt that describes the complete movement sequence in 6 seconds
      const effectVideoPrompt = this.generateEffectSpecificVideoPrompt(effectType);
      
      if (effectVideoPrompt) {
        basePrompt = effectVideoPrompt;
        logger.info('🎬 Enhanced video prompt with effect-specific movement sequence', {
          effectType,
          originalPromptLength: originalPrompt.length,
          enhancedPromptLength: basePrompt.length
        });
      } else {
        // Fallback: extract core intent and enhance
        let effectIntent = originalPrompt
          .replace(/^Create a photorealistic image showing\s*/i, '')
          .replace(/\s*PRESERVE.*$/is, '')
          .trim();
        
        basePrompt = `${defaultVideoMotionPrompt} The scene shows ${effectIntent}. Bring this effect to life with realistic, dynamic movement that completes the full sequence within 6 seconds.`;
      }
    } else if (originalPrompt) {
      // For other generation types, still include the original prompt context
      basePrompt = `${defaultVideoMotionPrompt} Based on the original scene: ${originalPrompt.substring(0, 200)}... Bring this scene to life with realistic movement.`;
    }
    
    if (options.cameraMovement) {
      // If camera movement is provided, create a prompt that emphasizes camera movement
      // Remove brackets if present (legacy format)
      const cleanCameraMovement = options.cameraMovement.replace(/[\[\]]/g, '');
      
      if (options.prompt && !originalPrompt) {
        // If custom prompt is provided and no original context, append camera movement to it
        return `${options.prompt} with smooth ${cleanCameraMovement} camera movement.`;
      } else {
        // Use enhanced base prompt with camera movement from environment variable
        return `${basePrompt} Use smooth ${cleanCameraMovement} camera movement. The scene should come to life with natural motion while maintaining the camera perspective.`;
      }
    } else {
      return basePrompt;
    }
  }

  /**
   * Generate video using Veo-3.1-Fast model
   * General video generation with movement
   */
  public async generateVeo3Fast(
    imagePath: string | Buffer,
    options: VideoMotionOptions = {}
  ): Promise<{ outputUrl: string; metadata: any }> {
    const startTime = Date.now();
    const requestId = uuidv4();

    try {
      logger.info('🎬 Starting Veo-3.1-Fast video generation', {
        requestId,
        imagePath,
        options,
        model: this.veo3FastModelId
      });

      // Detect aspect ratio from image if not provided
      // IMPORTANT: We need to detect BEFORE processing the image to ensure proper aspect ratio
      let aspectRatio = options.aspectRatio;
      if (!aspectRatio) {
        aspectRatio = await getImageAspectRatio(imagePath);
        logger.info('📐 Detected aspect ratio from image', { requestId, aspectRatio });
      }

      // Handle URL, buffer, and file path inputs
      let imageInput: string;
      let imageMetadata: sharp.Metadata | null = null;
      
      if (typeof imagePath === 'string' && (imagePath.startsWith('http://') || imagePath.startsWith('https://'))) {
        // Check if it's a localhost URL - Replicate servers can't access localhost
        if (this.isLocalhostUrl(imagePath)) {
          // Download and convert to base64 for localhost URLs
          imageInput = await this.downloadImageAsBase64(imagePath, requestId);
          logger.info('🔄 Converted localhost URL to base64', { requestId, originalUrl: imagePath });
          
          // Get metadata for resizing
          try {
            const response = await fetch(imagePath);
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            imageMetadata = await sharp(buffer).metadata();
          } catch (err) {
            logger.warn('Could not get image metadata for resizing', { requestId });
          }
        } else {
          // For public URLs, download to resize and ensure proper aspect ratio
          // This ensures the image matches the target aspect ratio before sending to Veo-3.1-Fast
          try {
            logger.info('⬇️ Downloading public URL for aspect ratio optimization', { requestId, url: imagePath });
            const response = await fetch(imagePath);
            if (!response.ok) {
              throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            imageMetadata = await sharp(buffer).metadata();
            
            // Convert to base64 so we can resize it
            const imageBase64 = buffer.toString('base64');
            imageInput = `data:image/jpeg;base64,${imageBase64}`;
            logger.info('📎 Downloaded and converted public URL to base64 for resizing', { 
              requestId, 
              originalUrl: imagePath,
              dimensions: `${imageMetadata.width}x${imageMetadata.height}`
            });
          } catch (err) {
            logger.warn('⚠️ Failed to download URL for resizing, using URL directly', { 
              requestId,
              error: err instanceof Error ? err.message : String(err)
            });
            // Fallback to using URL directly if download fails
            imageInput = imagePath;
            // Try to get metadata anyway for logging
            try {
              const response = await fetch(imagePath);
              const arrayBuffer = await response.arrayBuffer();
              const buffer = Buffer.from(arrayBuffer);
              imageMetadata = await sharp(buffer).metadata();
            } catch (metadataErr) {
              // Ignore metadata error
            }
          }
        }
      } else {
        // Handle buffer or file path - convert to base64 data URI
        let imageBuffer: Buffer;
        
        if (Buffer.isBuffer(imagePath)) {
          imageBuffer = imagePath;
          imageMetadata = await sharp(imageBuffer).metadata();
        } else {
          const fs = require('fs');
          if (!fs.existsSync(imagePath)) {
            throw new Error(`Image file not found: ${imagePath}`);
          }
          imageBuffer = fs.readFileSync(imagePath);
          imageMetadata = await sharp(imageBuffer).metadata();
        }

        // Convert image to base64
        logger.info('🔄 Converting image to base64', { requestId });
        const imageBase64 = imageBuffer.toString('base64');
        imageInput = `data:image/jpeg;base64,${imageBase64}`;
      }
      
      // Resize image to match target aspect ratio and ensure minimum 1080p quality
      // This ensures Veo-3.1-Fast receives an image that matches the output aspect ratio
      if (imageMetadata && imageMetadata.width && imageMetadata.height) {
        const targetWidth = aspectRatio === '16:9' ? 1920 : 1080;
        const targetHeight = aspectRatio === '16:9' ? 1080 : 1920;
        
        // Check if image needs resizing to match aspect ratio or increase resolution
        const currentRatio = imageMetadata.width / imageMetadata.height;
        const targetRatio = aspectRatio === '16:9' ? 16/9 : 9/16;
        const ratioDiff = Math.abs(currentRatio - targetRatio);
        
        const needsResize = 
          imageMetadata.width < targetWidth || 
          imageMetadata.height < targetHeight || 
          ratioDiff > 0.1; // More than 10% difference in aspect ratio
        
        if (needsResize && typeof imageInput === 'string' && imageInput.startsWith('data:image')) {
          // Only resize if we have a base64 image (buffer or converted)
          try {
            logger.info('🔄 Resizing image to match target aspect ratio and resolution', {
              requestId,
              originalDimensions: `${imageMetadata.width}x${imageMetadata.height}`,
              targetDimensions: `${targetWidth}x${targetHeight}`,
              targetAspectRatio: aspectRatio,
              currentRatio: currentRatio.toFixed(3),
              targetRatio: targetRatio.toFixed(3)
            });
            
            // Extract base64 data from data URI
            const base64Data = imageInput.replace(/^data:image\/[a-z]+;base64,/, '');
            const imageBuffer = Buffer.from(base64Data, 'base64');
            
            // CRITICAL: Auto-orient image to apply EXIF orientation before resizing
            // This ensures the image is correctly oriented and respects the original photo structure
            // Resize to target dimensions with proper aspect ratio fit
            // Use 'cover' to fill the entire target size, or 'contain' to fit inside
            const resizedBuffer = await sharp(imageBuffer)
              .rotate() // Auto-apply EXIF orientation - this is critical for smartphone photos
              .resize(targetWidth, targetHeight, {
                fit: 'cover', // Cover ensures full target size, may crop
                position: 'center' // Center the crop
              })
              .jpeg({ quality: 95 }) // High quality JPEG
              .toBuffer();
            
            // Convert back to base64 data URI
            const resizedBase64 = resizedBuffer.toString('base64');
            imageInput = `data:image/jpeg;base64,${resizedBase64}`;
            
            // Get new metadata
            const newMetadata = await sharp(resizedBuffer).metadata();
            logger.info('✅ Image resized successfully', {
              requestId,
              newDimensions: `${newMetadata.width}x${newMetadata.height}`,
              newAspectRatio: aspectRatio
            });
          } catch (resizeError) {
            logger.warn('⚠️ Failed to resize image, using original', {
              requestId,
              error: resizeError instanceof Error ? resizeError.message : String(resizeError)
            });
            // Continue with original image if resize fails
          }
        } else if (needsResize) {
          // For URL inputs, we can't resize easily, so just log a warning
          logger.warn('⚠️ Image may need resizing but using URL directly', {
            requestId,
            originalDimensions: `${imageMetadata.width}x${imageMetadata.height}`,
            targetAspectRatio: aspectRatio,
            note: 'Consider preprocessing image to match target aspect ratio for best results'
          });
        }
      }
      
      // Log final image dimensions
      if (imageMetadata) {
        logger.info('📏 Final image input dimensions', {
          requestId,
          width: imageMetadata.width,
          height: imageMetadata.height,
          format: imageMetadata.format,
          targetAspectRatio: aspectRatio,
          imageInputType: typeof imageInput === 'string' && imageInput.startsWith('http') ? 'URL' : 'base64'
        });
      }

      // Build prompt - include camera movement if provided
      // For Veo-3.1-Fast, camera movement should be integrated into the prompt naturally
      const prompt = this.generateVideoPrompt(options);

      // Prepare input for Veo-3.1-Fast
      // Duration must be 4, 6, or 8 seconds (default to 6)
      // Aspect ratio must be '16:9' or '9:16' (never '1:1')
      // Resolution should be '1080p' to ensure high quality output
      const input = {
        prompt,
        image: imageInput,
        aspect_ratio: aspectRatio,
        duration: options.duration || 6,
        resolution: options.resolution || '1080p',
        generate_audio: options.generateAudio !== false, // Default true
        ...(options.negativePrompt && { negative_prompt: options.negativePrompt })
      };

      logger.info('🚀 Running Veo-3.1-Fast video generation', {
        requestId,
        model: this.veo3FastModelId,
        aspectRatio,
        duration: input.duration,
        resolution: input.resolution,
        imageInputType: typeof imageInput === 'string' && imageInput.startsWith('http') ? 'URL' : 'base64',
        promptLength: prompt.length,
        input: {
          ...input,
          image: typeof imageInput === 'string' && imageInput.length > 100 ? `${imageInput.substring(0, 100)}...` : imageInput
        }
      });

      // Call Replicate API
      const output = await this.replicate.run(this.veo3FastModelId, { input });

      const processingTime = Date.now() - startTime;
      logger.info('✅ Veo-3.1-Fast video generation completed', {
        requestId,
        processingTime,
        model: this.veo3FastModelId,
        outputType: typeof output,
        output: output
      });

      // Handle the output - it might be a URL or an array of URLs
      let outputUrl: string;
      if (typeof output === 'string') {
        outputUrl = output;
      } else if (Array.isArray(output) && output.length > 0) {
        outputUrl = typeof output[0] === 'string' ? output[0] : (output[0] as any).url || (output[0] as any).url();
      } else if (output && typeof output === 'object' && 'url' in output) {
        if (typeof output.url === 'function') {
          outputUrl = output.url();
        } else if (typeof output.url === 'string') {
          outputUrl = output.url;
        } else {
          throw new Error('Unexpected output format from Veo-3.1-Fast model');
        }
      } else {
        throw new Error('Unexpected output format from Veo-3.1-Fast model');
      }

      return {
        outputUrl,
        metadata: {
          requestId,
          processingTime,
          model: this.veo3FastModelId,
          options,
          videoType: 'veo3_fast'
        }
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      logger.error('❌ Veo-3.1-Fast video generation failed', {
        requestId,
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        processingTime,
        model: this.veo3FastModelId
      });

      throw error;
    }
  }

  /**
   * Generate video using Veo-3.1-Fast model
   * This is the only supported video generation method
   */
  public async generateVideo(
    motionType: VideoMotionType,
    imagePath: string | Buffer,
    options: VideoMotionOptions = {}
  ): Promise<{ outputUrl: string; metadata: any }> {
    // Only veo3_fast is supported
    if (motionType !== 'veo3_fast') {
      throw new Error(`Only veo3_fast is supported. Received: ${motionType}`);
    }

    return this.generateVeo3Fast(imagePath, options);
  }
}

