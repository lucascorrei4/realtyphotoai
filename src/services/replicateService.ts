import Replicate from 'replicate';
import { config } from '../config';
import { logger } from '../utils/logger';
import { FileUtils } from '../utils/fileUtils';
import { ProcessImageRequest, ReplicateInput, ProcessingMetadata, QualityPreset } from '../types';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import sharp from 'sharp';
import { PromptingUtils } from '../utils/promptingUtils';
import { InteriorDesignService } from './interiorDesignService';
import { ElementReplacementService } from './elementReplacementService';
import { ImageEnhancementService } from './imageEnhancementService';
import { HybridStorageService } from './hybridStorageService';

export class ReplicateService {
  private replicate: Replicate;
  private readonly defaultModel: string;
  private readonly qualityPresets: Record<string, QualityPreset>;
  private readonly storageService: HybridStorageService;
  
  // Specialized services for each model type
  private readonly interiorDesignService: InteriorDesignService;
  private readonly elementReplacementService: ElementReplacementService;
  private readonly imageEnhancementService: ImageEnhancementService;

  constructor() {
    this.replicate = new Replicate({
      auth: config.replicateApiToken,
    });
    this.defaultModel = config.stableDiffusionModel;
    this.qualityPresets = this.initializeQualityPresets();
    this.storageService = new HybridStorageService();
    
    // Initialize specialized services
    this.interiorDesignService = new InteriorDesignService();
    this.elementReplacementService = new ElementReplacementService();
    this.imageEnhancementService = new ImageEnhancementService();
  }

  private initializeQualityPresets(): Record<string, QualityPreset> {
    return {
      fast: {
        name: 'Fast',
        steps: 15,
        guidance: 7.0,
        strength: 0.4,
        scheduler: 'DPMSolverMultistep',
        description: 'Quick processing with good quality'
      },
      balanced: {
        name: 'Balanced',
        steps: 25,
        guidance: 7.5,
        strength: 0.3,
        scheduler: 'DPMSolverMultistep',
        description: 'Best balance of quality and speed'
      },
      high: {
        name: 'High Quality',
        steps: 35,
        guidance: 8.0,
        strength: 0.25,
        scheduler: 'UniPCMultistep',
        description: 'High quality with longer processing time'
      },
      ultra: {
        name: 'Ultra Quality',
        steps: 50,
        guidance: 8.5,
        strength: 0.2,
        scheduler: 'UniPCMultistep',
        description: 'Maximum quality for professional use'
      }
    };
  }

  /**
   * Generate ControlNet conditioning image for structure preservation
   */
  private async generateControlNetImage(
    imagePath: string,
    controlType: 'canny' | 'depth' | 'pose' | 'segmentation' = 'canny'
  ): Promise<string> {
    try {
      logger.info('Generating ControlNet conditioning image', { controlType });
      
      const image = sharp(imagePath);
      const metadata = await image.metadata();
      
      if (!metadata.width || !metadata.height) {
        throw new Error('Unable to get image dimensions');
      }

      // Handle different ControlNet types
      if (controlType === 'canny') {
        // For FLUX ControlNet models, we need proper Canny edge detection
        const cannyImage = await image
          .greyscale()
          .blur(0.5) // Light blur to reduce noise
          .normalise() // Normalize contrast
          .png()
          .toBuffer();
          
        // Convert to base64
        return `data:image/png;base64,${cannyImage.toString('base64')}`;
      } else if (controlType === 'depth') {
        // For depth ControlNet, generate a depth map
        // This is a simplified depth estimation - for production, use proper depth models
        const depthImage = await image
          .greyscale()
          .blur(2) // More blur for depth effect
          .gamma(0.8) // Adjust gamma for depth appearance
          .normalise()
          .png()
          .toBuffer();
          
        // Convert to base64
        return `data:image/png;base64,${depthImage.toString('base64')}`;
      }
      
      // For other control types, return the original image
      const buffer = await image.png().toBuffer();
      return `data:image/png;base64,${buffer.toString('base64')}`;
      
    } catch (error) {
      logger.error('Failed to generate ControlNet image', { error, controlType });
      throw new Error(`ControlNet image generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check if the current model supports ControlNet
   */
  private isControlNetModel(): boolean {
    const controlNetModels = [
      'black-forest-labs/flux-canny-pro:latest',
      'xlabs-ai/flux-dev-controlnet:latest'
      // Note: lucataco/juggernaut-xl-v9 is a pure text-to-image model, not ControlNet
      // Note: fofr/controlnet-depth and jagilley/controlnet-canny don't exist on Replicate
    ];
    
    return controlNetModels.some(model => this.defaultModel.includes(model.split(':')[0]));
  }



  /**
   * Process image with AI decoration using proper ControlNet models
   * Supports both single-pass and two-pass (depth + inpainting) workflows
   */
  public async processImage(
    imagePath: string,
    request: ProcessImageRequest = {}
  ): Promise<{ outputUrl: string; metadata: ProcessingMetadata }> {
    // For now, use single-pass workflow for all models
    // TODO: Implement proper ControlNet + Juggernaut workflow later
    return this.processImageSinglePass(imagePath, request);
  }

  /**
   * Process image specifically with the Interior Design model
   * This method delegates to the specialized InteriorDesignService
   * 
   * ⚠️ CRITICAL: Parameters are fixed and tested - DO NOT CHANGE
   */
  public async processImageWithInteriorDesign(
    imagePath: string,
    prompt: string,
    _options: {
      promptStrength?: number;
      numInferenceSteps?: number;
      guidanceScale?: number;
      seed?: number;
      negativePrompt?: string;
    } = {}
  ): Promise<{ outputUrl: string; metadata: any }> {
    // Delegate to specialized service
    return this.interiorDesignService.generateInteriorDesign(
      imagePath, 
      prompt, 
      'modern', // default design type
      'realistic' // default style
    );
  }

  // TODO: Implement two-pass depth + inpainting workflow when ControlNet models are available */

  /**
   * Single-pass workflow (original implementation)
   */
  private async processImageSinglePass(
    imagePath: string,
    request: ProcessImageRequest = {}
  ): Promise<{ outputUrl: string; metadata: ProcessingMetadata }> {
    const startTime = Date.now();
    const requestId = uuidv4();
    
    try {
      logger.info('🚀 Starting image processing', { 
        requestId, 
        imagePath,
        model: this.defaultModel,
        isControlNetModel: this.isControlNetModel(),
        useControlNet: config.useControlNet,
        requestUseControlNet: request.useControlNet,
        controlNetModel: config.controlNetModel
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
        
        // Try to validate the HEIC file can be processed
        try {
          const sharp = require('sharp');
          await sharp(imagePath).metadata();
          logger.info('✅ HEIC file validation successful', { requestId });
        } catch (heicError) {
          logger.error('❌ HEIC file validation failed', {
            requestId,
            error: heicError instanceof Error ? heicError.message : String(heicError)
          });
          
          throw new Error(`HEIC file appears to be corrupted or unsupported. Please try converting it to JPEG or PNG format first. Error: ${heicError instanceof Error ? heicError.message : String(heicError)}`);
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
          throw new Error(`Failed to convert image to base64: ${base64Error instanceof Error ? base64Error.message : String(base64Error)}`);
        }
      }
      
      // Generate ControlNet image for proper ControlNet models
      let controlImage: string | undefined;
      if ((config.useControlNet || request.useControlNet) && this.isControlNetModel()) {
        const controlType = request.controlNetType || config.controlNetModel as any;
        logger.info('🎯 Generating ControlNet conditioning image', { 
          requestId, 
          controlType 
        });
        controlImage = await this.generateControlNetImage(imagePath, controlType);
        logger.info('✅ ControlNet conditioning image generated successfully', { 
          requestId,
          controlImageLength: controlImage.length 
        });
      } else if (config.useControlNet || request.useControlNet) {
        logger.warn('⚠️ ControlNet requested but model does not support it', { 
          model: this.defaultModel,
          requestId 
        });
      } else {
        logger.info('ℹ️ ControlNet not requested or not supported', { 
          requestId,
          useControlNet: config.useControlNet,
          isControlNetModel: this.isControlNetModel()
        });
      }
      
      // Prepare input for Replicate with proper ControlNet parameters
      logger.info('🔧 Preparing Replicate input parameters', { requestId });
      const replicateInput = this.prepareReplicateInput(base64Image, request, controlImage);
      
      logger.info('📤 Calling Replicate API', { 
        requestId, 
        model: this.defaultModel,
        hasControlImage: !!controlImage,
        inputKeys: Object.keys(replicateInput),
        promptLength: replicateInput.prompt?.length || 0
      });
      
      // Call Replicate API
      logger.info('🌐 Making Replicate API call', { 
        requestId,
        model: this.defaultModel,
        inputSize: JSON.stringify(replicateInput).length
      });
      
      const output = await this.replicate.run(this.defaultModel as any, {
        input: replicateInput,
      }) as string[];

      // Safely extract output info for logging (avoid logging binary data)
      let outputInfo: Record<string, unknown>;
      if (Array.isArray(output)) {
        const firstItem = output[0];
        const firstItemStr = typeof firstItem === 'string' ? firstItem : String(firstItem);
        outputInfo = {
          isArray: true,
          length: output.length,
          firstItemType: typeof firstItem,
          firstItemPreview: firstItemStr.length > 100 
            ? `${firstItemStr.substring(0, 100)}...` 
            : firstItemStr
        };
      } else {
        const outputStr = typeof output === 'string' ? output : String(output);
        outputInfo = {
          isArray: false,
          type: typeof output,
          preview: outputStr.length > 100 
            ? `${outputStr.substring(0, 100)}...` 
            : outputStr
        };
      }
      
      logger.info('📥 Replicate API response received', { 
        requestId,
        outputType: typeof output,
        outputLength: Array.isArray(output) ? output.length : 'not array',
        ...outputInfo
      });

      if (!output || output.length === 0) {
        throw new Error('No output received from Replicate API');
      }

      const outputUrl = Array.isArray(output) ? output[0] : output;
      const endTime = Date.now();
      
      logger.info('✅ Image processing completed successfully', {
        requestId,
        processingTime: endTime - startTime,
        outputUrl,
        modelUsed: this.defaultModel
      });

      const metadata: ProcessingMetadata = {
        requestId,
        processingStartTime: startTime,
        processingEndTime: endTime,
        modelUsed: this.defaultModel,
        parametersUsed: replicateInput,
      };

      return { outputUrl, metadata };
      
    } catch (error) {
      const endTime = Date.now();
      logger.error('❌ Image processing failed', {
        requestId,
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        processingTime: endTime - startTime,
        model: this.defaultModel,
        imagePath
      });
      
      throw new Error(`Image processing failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Download processed image from URL and save locally
   */
  public async downloadAndSaveImage(
    imageUrl: string,
    outputDir: string,
    filename?: string
  ): Promise<string> {
    try {
      const finalFilename = filename || `processed_${uuidv4()}.png`;
      const outputPath = path.join(outputDir, finalFilename);
      
      logger.info('Downloading processed image', { imageUrl, outputPath });
      
      // Ensure output directory exists
      await FileUtils.ensureDirectoryExists(outputDir);
      
      // Download image using fetch
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.statusText}`);
      }
      
      const buffer = await response.arrayBuffer();
      const nodeBuffer = Buffer.from(buffer);
      
      // Save to file
      await require('fs/promises').writeFile(outputPath, nodeBuffer);
      
      logger.info('Image downloaded and saved successfully', { outputPath });
      return outputPath;
      
    } catch (error) {
      logger.error('Failed to download and save image', { 
        error: error instanceof Error ? error.message : String(error),
        imageUrl 
      });
      throw new Error(`Failed to download image: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Download processed image from URL and save to hybrid storage (R2 or local)
   */
  public async downloadAndSaveToHybridStorage(
    imageUrl: string,
    filename?: string,
    metadata?: Record<string, string>
  ): Promise<{ storageKey: string; url: string; storageType: 'local' | 'r2' }> {
    try {
      const finalFilename = filename || `processed_${uuidv4()}.png`;
      
      logger.info('Downloading processed image to hybrid storage', { imageUrl, filename: finalFilename });
      
      // Download image using fetch
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.statusText}`);
      }
      
      const buffer = await response.arrayBuffer();
      const nodeBuffer = Buffer.from(buffer);
      
      // Generate storage key
      const storageKey = this.storageService.generateProcessedKey(finalFilename);
      
      // Upload to hybrid storage
      const storageResult = await this.storageService.uploadBuffer(
        nodeBuffer,
        storageKey,
        'image/png',
        {
          ...metadata,
          originalUrl: imageUrl,
          processedAt: new Date().toISOString(),
        }
      );
      
      logger.info('Image downloaded and saved to hybrid storage successfully', { 
        storageKey: storageResult.key,
        url: storageResult.url,
        storageType: storageResult.storageType,
        size: storageResult.size
      });
      
      return {
        storageKey: storageResult.key,
        url: storageResult.url,
        storageType: storageResult.storageType,
      };
      
    } catch (error) {
      logger.error('Failed to download and save image to hybrid storage', { 
        error: error instanceof Error ? error.message : String(error),
        imageUrl 
      });
      throw new Error(`Failed to download image to hybrid storage: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Download video from URL and save to hybrid storage (R2/local)
   */
  public async downloadAndSaveVideoToHybridStorage(
    videoUrl: string,
    filename?: string,
    metadata?: Record<string, string>
  ): Promise<{ storageKey: string; url: string; storageType: 'local' | 'r2' }> {
    try {
      const finalFilename = filename || `video_${uuidv4()}.mp4`;
      
      logger.info('Downloading video to hybrid storage', { videoUrl, filename: finalFilename });
      
      // Download video using fetch
      const response = await fetch(videoUrl);
      if (!response.ok) {
        throw new Error(`Failed to download video: ${response.statusText}`);
      }
      
      const buffer = await response.arrayBuffer();
      const nodeBuffer = Buffer.from(buffer);
      
      // Determine MIME type from response or filename
      const contentType = response.headers.get('content-type') || 'video/mp4';
      
      // Generate storage key
      const storageKey = this.storageService.generateProcessedKey(finalFilename);
      
      // Upload to hybrid storage
      const storageResult = await this.storageService.uploadBuffer(
        nodeBuffer,
        storageKey,
        contentType,
        {
          ...metadata,
          originalUrl: videoUrl,
          processedAt: new Date().toISOString(),
        }
      );
      
      logger.info('Video downloaded and saved to hybrid storage successfully', { 
        storageKey: storageResult.key,
        url: storageResult.url,
        storageType: storageResult.storageType,
        size: storageResult.size
      });
      
      return {
        storageKey: storageResult.key,
        url: storageResult.url,
        storageType: storageResult.storageType,
      };
      
    } catch (error) {
      logger.error('Failed to download and save video to hybrid storage', { 
        error: error instanceof Error ? error.message : String(error),
        videoUrl 
      });
      throw new Error(`Failed to download video to hybrid storage: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Prepare input parameters for Replicate API with proper ControlNet support
   */
  private prepareReplicateInput(
    base64Image: string,
    request: ProcessImageRequest,
    controlImage?: string
  ): ReplicateInput {
    logger.info('🔧 Starting input preparation', {
      model: this.defaultModel,
      hasControlImage: !!controlImage,
      requestKeys: Object.keys(request)
    });

    // Get quality preset if specified
    const preset = request.qualityPreset ? this.qualityPresets[request.qualityPreset] : this.qualityPresets.balanced;
    const qualityPrompt = PromptingUtils.getQualityPrompt(request.qualityPreset || 'balanced');
    
    logger.info('📋 Quality preset selected', {
      preset: request.qualityPreset || 'balanced',
      steps: preset.steps,
      guidance: preset.guidance,
      strength: preset.strength
    });
    
    // Create optimized prompt
    let prompt = config.defaultPrompt;
    
    if (request.prompt) {
      prompt = PromptingUtils.enhanceCustomPrompt(request.prompt, request.style || 'modern');
      logger.info('✏️ Using custom prompt', { promptLength: prompt.length });
    } else if (request.style) {
      prompt = PromptingUtils.generateInteriorDesignPrompt(request.style, 'living_room');
      logger.info('🎨 Using style-based prompt', { style: request.style, promptLength: prompt.length });
    } else {
      logger.info('📝 Using default prompt', { promptLength: prompt.length });
    }
    
    // Add quality-specific enhancements
    prompt = `${qualityPrompt.prefix}, ${prompt}, ${qualityPrompt.suffix}`;
    logger.info('✨ Final prompt prepared', { 
      finalPromptLength: prompt.length,
      prefix: qualityPrompt.prefix,
      suffix: qualityPrompt.suffix
    });

    // Base input parameters
    const input: ReplicateInput = {
      prompt,
      num_inference_steps: request.steps || preset.steps,
      guidance_scale: request.guidance || preset.guidance,
      // Use strength for transformation control
      strength: request.strength || config.defaultTransformationStrength,
    };

    logger.info('📊 Base parameters set', {
      steps: input.num_inference_steps,
      guidance: input.guidance_scale,
      strength: input.strength
    });

    // Model-specific parameter mapping
    logger.info('🎯 Applying model-specific parameters', { model: this.defaultModel });
    
    if (this.defaultModel.includes('black-forest-labs/flux-canny-pro')) {
      logger.info('🔧 Using FLUX Canny Pro parameters');
      // FLUX Canny Pro parameters
      input.image = base64Image;
      input.control_image = controlImage || base64Image; // Use original as control if no ControlNet image
      input.control_strength = request.controlNetStrength || config.controlNetStrength;
      input.output_format = 'png';
      input.output_quality = 95;
      
    } else if (this.defaultModel.includes('xlabs-ai/flux-dev-controlnet')) {
      logger.info('🔧 Using XLabs FLUX ControlNet parameters');
      // XLabs FLUX ControlNet parameters
      input.image = base64Image;
      input.control_image = controlImage || base64Image;
      input.controlnet_conditioning_scale = request.controlNetStrength || config.controlNetStrength;
      input.control_type = request.controlNetType || config.controlNetModel;
      
    } else if (this.defaultModel.includes('juggernaut-xl')) {
      logger.info('🔧 Using Juggernaut XL parameters');
      // Juggernaut XL specific parameters (supports both text-to-image and img2img)
      input.scheduler = 'K_EULER_ANCESTRAL'; // Default scheduler from model schema
      input.num_inference_steps = Math.min(input.num_inference_steps || 40, 500); // Model supports 1-500, default 40
      input.guidance_scale = Math.min(input.guidance_scale || 7, 50); // Model supports 1-50, default 7
      input.width = 1024; // Standard SDXL resolution
      input.height = 1024;
      
      // For img2img with Juggernaut XL, include the image parameter
      input.image = base64Image;
      
      // Remove ControlNet parameters as this model doesn't support them
      delete input.control_image;
      delete input.controlnet_conditioning_scale;
      delete input.control_strength;
      delete input.control_type;
      delete input.apply_watermark;
      
      logger.info('✅ Juggernaut XL parameters applied', {
        scheduler: input.scheduler,
        steps: input.num_inference_steps,
        guidance: input.guidance_scale,
        width: input.width,
        height: input.height,
        hasImage: !!input.image
      });
      
    } else {
      logger.info('🔧 Using fallback model parameters');
      // Fallback for basic models
      input.image = base64Image;
      if (input.strength !== undefined) {
        input.prompt_strength = input.strength;
      }
    }

    // Add negative prompt if available
    const negativePrompt = PromptingUtils.generateNegativePrompt(request.negativePrompt);
    if (negativePrompt) {
      input.negative_prompt = negativePrompt;
      logger.info('🚫 Added negative prompt', { negativePromptLength: negativePrompt.length });
    }

    logger.info('✅ Final input prepared', { 
      model: this.defaultModel,
      promptLength: input.prompt?.length || 0,
      negativePromptLength: input.negative_prompt?.length || 0,
      num_inference_steps: input.num_inference_steps,
      guidance_scale: input.guidance_scale,
      strength: input.strength,
      hasControlImage: !!controlImage,
      controlStrength: input.control_strength || input.controlnet_conditioning_scale,
      inputKeys: Object.keys(input)
    });

    return input;
  }

  /**
   * Validate Replicate configuration
   */
  public async validateConfiguration(): Promise<boolean> {
    try {
      await this.replicate.models.list();
      return true;
    } catch (error) {
      logger.error('Replicate configuration validation failed', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      return false;
    }
  }

  /**
   * Get available quality presets
   */
  public getQualityPresets(): Record<string, QualityPreset> {
    return { ...this.qualityPresets };
  }

  // TODO: Implement inpainting workflow when ControlNet models are available

  /**
   * Get recommended models for different use cases
   */
  public getRecommendedModels(): Record<string, { model: string; description: string; bestFor: string[] }> {
    return {
      'juggernaut-xl': {
        model: 'lucataco/juggernaut-xl-v9:latest',
        description: 'Latest Juggernaut XL model with photorealistic results, supports depth + inpainting workflow',
        bestFor: ['Photorealistic interiors', 'Room transformation', 'Two-pass depth workflow', 'High-quality results']
      },
      'interior-design': {
        model: 'adirik/interior-design:76604baddc85b1b4616e1c6475eca080da339c8875bd4996705440484a6eac38',
        description: 'Specialized model for interior design and furniture placement',
        bestFor: ['Living rooms', 'Bedrooms', 'Office spaces', 'Furniture arrangement']
      },
      'controlnet-canny': {
        model: 'black-forest-labs/flux-canny-pro:latest',
        description: 'ControlNet with Canny edge detection for structure preservation',
        bestFor: ['Architectural preservation', 'Edge-based control', 'Structure maintaining']
      },
      'controlnet-depth': {
        model: 'xlabs-ai/flux-dev-controlnet',
        description: 'ControlNet with depth estimation for 3D-aware generation',
        bestFor: ['Depth preservation', '3D understanding', 'Realistic proportions']
      },
      'sdxl-architectural': {
        model: 'stability-ai/sdxl',
        description: 'High-resolution architectural photography model',
        bestFor: ['High-resolution output', 'Professional photography', 'Detailed textures']
      }
    };
  }

  /**
   * Get model information
   */
  public async getModelInfo(): Promise<Record<string, unknown>> {
    try {
      const model = await this.replicate.models.get(this.defaultModel.split('/')[0], this.defaultModel.split('/')[1]);
      return {
        name: model.name,
        description: model.description,
        visibility: model.visibility,
        github_url: model.github_url,
        cover_image_url: model.cover_image_url,
      };
    } catch (error) {
      logger.error('Failed to get model info', { 
        error: error instanceof Error ? error.message : String(error),
        model: this.defaultModel 
      });
      throw new Error(`Failed to get model info: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Enhance image using bria/increase-resolution model for image enhancement
   * This method delegates to the specialized ImageEnhancementService
   * 
   * ⚠️ CRITICAL: Parameters are fixed and tested - DO NOT CHANGE
   */
  public async enhanceImage(
    imagePath: string | Buffer,
    referenceImagePath: string | Buffer | null = null,
    enhancementType: string = 'luminosity',
    enhancementStrength: string = 'moderate'
  ): Promise<string> {
    // Delegate to specialized service
    return this.imageEnhancementService.enhanceImage(imagePath, referenceImagePath, enhancementType, enhancementStrength);
  }

  /**
   * Replace elements in image using flux-kontext-pro model
   * This method delegates to the specialized ElementReplacementService
   * 
   * ⚠️ CRITICAL: Parameters are fixed and tested - DO NOT CHANGE
   */
  public async replaceElements(
    imagePath: string | Buffer,
    prompt: string,
    outputFormat: string = 'jpg'
  ): Promise<string> {
    // Delegate to specialized service
    return this.elementReplacementService.replaceElements(imagePath, prompt, outputFormat);
  }
}