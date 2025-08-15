import { Request, Response } from 'express';
import path from 'path';
import { ReplicateService } from '../services/replicateService';
import { FileUtils } from '../utils/fileUtils';
import { logger } from '../utils/logger';
import { config } from '../config';
import { ProcessImageRequest, ProcessImageResponse, ApiResponse } from '../types';

export class ImageController {
  private replicateService: ReplicateService;

  constructor() {
    this.replicateService = new ReplicateService();
  }

  /**
   * Health check endpoint
   */
  public health = async (_: Request, res: Response): Promise<void> => {
    try {
      const isReplicateConfigValid = await this.replicateService.validateConfiguration();
      
      res.json({
        success: true,
        message: 'Service is healthy',
        data: {
          status: 'operational',
          version: config.appVersion,
          timestamp: new Date().toISOString(),
          replicate_connection: isReplicateConfigValid,
          model: config.stableDiffusionModel,
        },
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    } catch (error) {
      logger.error('Health check failed', { error });
      res.status(503).json({
        success: false,
        message: 'Service unhealthy',
        error: 'SERVICE_UNHEALTHY',
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    }
  };

  /**
   * Get available quality presets
   */
  public getQualityPresets = async (_: Request, res: Response): Promise<void> => {
    try {
      const presets = this.replicateService.getQualityPresets();
      
      res.json({
        success: true,
        message: 'Quality presets retrieved successfully',
        data: presets,
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    } catch (error) {
      logger.error('Failed to get quality presets', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve quality presets',
        error: 'PRESETS_FAILED',
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    }
  };

  /**
   * Get current configuration
   */
  public getConfig = async (_: Request, res: Response): Promise<void> => {
    try {
      res.json({
        success: true,
        message: 'Configuration retrieved successfully',
        data: {
          model: config.stableDiffusionModel,
          workflow: config.enableInpaintingWorkflow ? 'depth_inpainting' : 'single_pass',
          useControlNet: config.useControlNet,
          controlNetModel: config.controlNetModel,
          controlNetStrength: config.controlNetStrength,
          structurePreservationStrength: config.structurePreservationStrength,
          defaultTransformationStrength: config.defaultTransformationStrength,
          defaultPrompt: config.defaultPrompt,
          defaultNegativePrompt: config.defaultNegativePrompt
        },
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    } catch (error) {
      logger.error('Failed to get configuration', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve configuration',
        error: 'CONFIG_FAILED',
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    }
  };

  /**
   * Get model recommendations
   */
  public getRecommendations = async (_: Request, res: Response): Promise<void> => {
    try {
      const recommendations = this.replicateService.getRecommendedModels();
      
      res.json({
        success: true,
        message: 'Model recommendations retrieved successfully',
        data: { recommendations },
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    } catch (error) {
      logger.error('Failed to get recommendations', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve recommendations',
        error: 'RECOMMENDATIONS_FAILED',
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    }
  };

  /**
   * Get model information
   */
  public getModelInfo = async (_: Request, res: Response): Promise<void> => {
    try {
      const modelInfo = await this.replicateService.getModelInfo();
      
      res.json({
        success: true,
        message: 'Model information retrieved successfully',
        data: modelInfo,
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    } catch (error) {
      logger.error('Failed to get model info', { error });
      res.status(503).json({
        success: false,
        message: 'Failed to retrieve model information',
        error: 'MODEL_INFO_FAILED',
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    }
  };

  /**
   * Process uploaded image with AI decoration
   */
  public processImage = async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    const tempFiles: string[] = [];
    
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          message: 'No image file uploaded',
          error: 'NO_FILE',
          timestamp: new Date().toISOString(),
        } as ApiResponse);
        return;
      }

      tempFiles.push(req.file.path);
      
      logger.info('Starting image processing', {
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
      });

      // Parse request parameters
      const processRequest: ProcessImageRequest = {};
      if (req.body?.style) processRequest.style = req.body.style;
      if (req.body?.prompt) processRequest.prompt = req.body.prompt;
      if (req.body?.negativePrompt) processRequest.negativePrompt = req.body.negativePrompt;
      if (req.body?.guidance) processRequest.guidance = parseFloat(req.body.guidance);
      if (req.body?.steps) processRequest.steps = parseInt(req.body.steps, 10);
      if (req.body?.strength) processRequest.strength = parseFloat(req.body.strength);
      
      // Enhanced parameters for structure preservation
      if (req.body?.useControlNet !== undefined) processRequest.useControlNet = req.body.useControlNet === 'true';
      if (req.body?.controlNetType) processRequest.controlNetType = req.body.controlNetType;
      if (req.body?.controlNetStrength) processRequest.controlNetStrength = parseFloat(req.body.controlNetStrength);
      if (req.body?.qualityPreset) processRequest.qualityPreset = req.body.qualityPreset;

      // Resize image if needed to optimize processing
      const resizedImagePath = path.join(config.tempDir, `resized_${req.file.filename}`);
      
      try {
        await FileUtils.resizeImageIfNeeded(req.file.path, resizedImagePath, 1024, 1024);
        tempFiles.push(resizedImagePath);
      } catch (resizeError) {
        const resizeErr = resizeError as Error;
        logger.warn('Image resize failed, checking if it\'s a HEIC file that can be processed directly', {
          error: resizeErr.message,
          filename: req.file.filename,
          originalPath: req.file.path
        });
        
        // Check if this is a HEIC file that failed to resize
        const fileExtension = path.extname(req.file.path).toLowerCase();
        const isHeic = fileExtension === '.heic' || fileExtension === '.heif';
        
        if (isHeic) {
          try {
            // Try to validate the HEIC file can be processed
            const sharp = require('sharp');
            const metadata = await sharp(req.file.path).metadata();
            
            if (metadata.width && metadata.height) {
              logger.info('HEIC file is valid, proceeding without resize', {
                filename: req.file.filename,
                dimensions: `${metadata.width}x${metadata.height}`,
                format: metadata.format
              });
              
              // Use the original file path for processing
              // The AI model may be able to handle HEIC files directly
            } else {
              throw new Error('HEIC file has invalid dimensions');
            }
          } catch (heicError) {
            const heicErr = heicError as Error;
            logger.error('HEIC file validation failed during resize fallback', {
              error: heicErr.message,
              filename: req.file.filename
            });
            
            // If we can't even validate the HEIC file, throw a user-friendly error
            throw new Error(`HEIC file cannot be processed. The file may be corrupted or in an unsupported format. Please try converting it to JPEG or PNG using another tool first. Technical error: ${heicErr.message}`);
          }
        } else {
          // For non-HEIC files, re-throw the resize error
          throw resizeError;
        }
      }

      // Process image with Replicate
      const { outputUrl, metadata } = await this.replicateService.processImage(
        resizedImagePath,
        processRequest
      );

      // Download and save processed image
      const processedImagePath = await this.replicateService.downloadAndSaveImage(
        outputUrl,
        config.outputDir,
        `processed_${req.file.filename}`
      );

      const processingTime = Date.now() - startTime;
      
      logger.info('Image processing completed successfully', {
        originalFile: req.file.filename,
        processedFile: path.basename(processedImagePath),
        processingTime,
        requestId: metadata.requestId,
      });

      // Get file info for response (not currently used but available for future enhancements)

      const response: ProcessImageResponse = {
        success: true,
        message: 'Image processed successfully',
        originalImage: `/uploads/${req.file.filename}`,
        processedImage: `/outputs/${path.basename(processedImagePath)}`,
        processingTime,
        timestamp: new Date().toISOString(),
      };

      res.json(response);

      // Clean up temp files (keep original and processed)
      const filesToCleanup = tempFiles.filter(f => f !== req.file!.path);
      await FileUtils.cleanupTempFiles(filesToCleanup);

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      logger.error('Image processing failed', {
        error: error instanceof Error ? error.message : String(error),
        filename: req.file?.filename,
        processingTime,
      });

      // Clean up all temp files on error
      await FileUtils.cleanupTempFiles(tempFiles);

      res.status(500).json({
        success: false,
        message: 'Image processing failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    }
  };

  /**
   * Process uploaded image specifically with Interior Design model
   */
  public processImageWithInteriorDesign = async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    const tempFiles: string[] = [];
    
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          message: 'No image file uploaded',
          error: 'NO_FILE',
          timestamp: new Date().toISOString(),
        } as ApiResponse);
        return;
      }

      if (!req.body?.prompt) {
        res.status(400).json({
          success: false,
          message: 'Prompt is required for interior design processing',
          error: 'MISSING_PROMPT',
          timestamp: new Date().toISOString(),
        } as ApiResponse);
        return;
      }

      tempFiles.push(req.file.path);
      
      logger.info('Starting interior design processing', {
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        prompt: req.body.prompt,
      });

      // Parse interior design specific parameters
      const options: {
        promptStrength?: number;
        numInferenceSteps?: number;
        guidanceScale?: number;
        seed?: number;
        negativePrompt?: string;
      } = {};
      
      if (req.body?.promptStrength) options.promptStrength = parseFloat(req.body.promptStrength);
      if (req.body?.numInferenceSteps) options.numInferenceSteps = parseInt(req.body.numInferenceSteps, 10);
      if (req.body?.guidanceScale) options.guidanceScale = parseFloat(req.body.guidanceScale);
      if (req.body?.seed) options.seed = parseInt(req.body.seed, 10);
      if (req.body?.negativePrompt) options.negativePrompt = req.body.negativePrompt;

      // Resize image if needed to optimize processing
      const resizedImagePath = path.join(config.tempDir, `resized_${req.file.filename}`);
      let finalImagePath = resizedImagePath;
      
      try {
        await FileUtils.resizeImageIfNeeded(req.file.path, resizedImagePath, 1024, 1024);
        tempFiles.push(resizedImagePath);
      } catch (resizeError) {
        console.log('❌ [IMAGE CONTROLLER] Image resize failed:', resizeError);
        const resizeErr = resizeError as Error;
        logger.warn('Image resize failed, checking if it\'s a HEIC file that can be processed directly', {
          error: resizeErr.message,
          filename: req.file.filename,
          originalPath: req.file.path
        });
        
        // Check if this is a HEIC file that failed to resize
        const fileExtension = path.extname(req.file.path).toLowerCase();
        if (fileExtension === '.heic' || fileExtension === '.heif') {
          // This is a HEIC file that couldn't be resized - likely incompatible format
          const errorMessage = resizeErr.message;
          if (errorMessage.includes('No decoding plugin installed') || 
              errorMessage.includes('bad seek') ||
              errorMessage.includes('compression format')) {
            
            // Clean up any temp files
            await FileUtils.cleanupTempFiles(tempFiles);
            
            // Set response and return early
            res.status(400).json({
              success: false,
              message: 'This HEIC file uses an unsupported compression format that cannot be processed. Please convert it to JPEG or PNG using another tool first, then upload the converted file.',
              error: 'INCOMPATIBLE_HEIC_FORMAT',
              suggestion: 'Try using online HEIC converters like CloudConvert, or use your phone\'s built-in conversion feature to save as JPEG.'
            });
            return;
          }
        }
        
        // For other resize errors, try to use the original file
        logger.info('Using original file for processing due to resize failure', {
          originalPath: req.file.path,
          error: resizeErr.message
        });
        finalImagePath = req.file.path;
      }

      // Process image with Interior Design model
      try {
        const { outputUrl, metadata } = await this.replicateService.processImageWithInteriorDesign(
          finalImagePath,
          req.body.prompt,
          options
        );

        // Download and save processed image
        const processedImagePath = await this.replicateService.downloadAndSaveImage(
          outputUrl,
          config.outputDir,
          `interior_design_${req.file.filename}`
        );

        const processingTime = Date.now() - startTime;
        
        logger.info('Interior design processing completed successfully', {
          originalFile: req.file.filename,
          processedFile: path.basename(processedImagePath),
          processingTime,
          requestId: metadata.requestId,
          prompt: req.body.prompt,
        });

        const response: ProcessImageResponse = {
          success: true,
          message: 'Interior design processing completed successfully',
          originalImage: `/uploads/${req.file.filename}`,
          processedImage: `/outputs/${path.basename(processedImagePath)}`,
          processingTime,
          timestamp: new Date().toISOString(),
        };

        res.json(response);

        // Clean up temp files (keep original and processed)
        const filesToCleanup = tempFiles.filter(f => f !== req.file!.path);
        await FileUtils.cleanupTempFiles(filesToCleanup);

      } catch (processingError) {
        console.log('❌ [IMAGE CONTROLLER] Interior design processing failed:', processingError);
        const processingTime = Date.now() - startTime;
        
        logger.error('Interior design processing failed', {
          error: processingError instanceof Error ? processingError.message : String(processingError),
          filename: req.file.filename,
          processingTime,
          prompt: req.body.prompt,
        });

        // Clean up all temp files on error
        await FileUtils.cleanupTempFiles(tempFiles);

        res.status(500).json({
          success: false,
          message: 'Interior design processing failed',
          error: processingError instanceof Error ? processingError.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        } as ApiResponse);
      }

    } catch (error) {
      console.log('❌ [IMAGE CONTROLLER] Overall interior design processing failed:', error);
      const processingTime = Date.now() - startTime;
      
      logger.error('Interior design processing failed', {
        error: error instanceof Error ? error.message : String(error),
        filename: req.file?.filename,
        processingTime,
        prompt: req.body?.prompt,
      });

      // Clean up all temp files on error
      await FileUtils.cleanupTempFiles(tempFiles);

      res.status(500).json({
        success: false,
        message: 'Interior design processing failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    }
  };

  /**
   * Upload file endpoint (for testing)
   */
  public uploadFile = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          message: 'No file uploaded',
          error: 'NO_FILE',
          timestamp: new Date().toISOString(),
        } as ApiResponse);
        return;
      }

      const fileInfo = await FileUtils.getFileInfo(req.file.path);
      
      logger.info('File uploaded successfully', {
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
      });

              res.json({
          success: true,
          message: 'File uploaded successfully',
          data: {
            uploadPath: `/uploads/${req.file.filename}`,
            ...fileInfo,
          },
          timestamp: new Date().toISOString(),
        } as ApiResponse);
      
    } catch (error) {
      logger.error('File upload failed', { error });
      
      // Clean up file on error
      if (req.file?.path) {
        await FileUtils.cleanupTempFiles([req.file.path]);
      }
      
      res.status(500).json({
        success: false,
        message: 'File upload failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    }
  };

  /**
   * Test endpoint
   */
  public test = async (_: Request, res: Response): Promise<void> => {
    res.json({
      success: true,
      message: 'RealtyPhotoAI Lab Backend is running!',
      data: {
        version: config.appVersion,
        model: config.stableDiffusionModel,
        defaultPrompt: config.defaultPrompt,
        useControlNet: config.useControlNet,
        controlNetModel: config.controlNetModel,
        structurePreservationStrength: config.structurePreservationStrength,
        endpoints: {
          health: '/health',
          model_info: '/model-info',
          quality_presets: '/quality-presets',
          upload: '/upload',
          process: '/process-image',
          interior_design: '/interior-design',
          image_enhancement: '/image-enhancement',
          replace_elements: '/replace-elements',
        },
        features: {
          controlNet: 'Enhanced structure preservation using ControlNet',
          qualityPresets: 'Multiple quality levels (fast, balanced, high, ultra)',
          interiorDesign: 'Specialized model for interior design and furniture placement',
          imageEnhancement: 'Image resolution enhancement using bria/increase-resolution model',
          elementReplacement: 'Replace elements in images using flux-kontext-pro model',
          juggernautWorkflow: 'Latest Juggernaut XL with two-pass depth + inpainting workflow for photorealistic results',
          smartPrompting: 'Optimized prompts for real estate photography'
        }
      },
      timestamp: new Date().toISOString(),
    } as ApiResponse);
  };

  /**
   * Image enhancement endpoint using bria/increase-resolution model
   */
  public enhanceImage = async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    const tempFiles: string[] = [];

    try {
      // Debug logging
      console.log('🔍 [DEBUG] Request body:', req.body);
      console.log('🔍 [DEBUG] Request files:', req.files);
      console.log('🔍 [DEBUG] Request headers:', req.headers);
      
      // Check if files were uploaded - use type assertion for req.files
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      console.log('🔍 [DEBUG] Files after type assertion:', files);
      
      if (!files || !files.image || !files.image[0]) {
        console.log('❌ [DEBUG] No image file found in request');
        res.status(400).json({
          success: false,
          message: 'No image file uploaded',
          error: 'NO_IMAGE_FILE',
          timestamp: new Date().toISOString(),
        } as ApiResponse);
        return;
      }

      const imageFiles = files.image;
      const referenceFile = files.referenceImage ? files.referenceImage[0] : null;

      // Validate that we have at least one image file
      if (imageFiles.length === 0) {
        res.status(400).json({
          success: false,
          message: 'No image files uploaded',
          error: 'NO_IMAGE_FILES',
          timestamp: new Date().toISOString(),
        } as ApiResponse);
        return;
      }

      // Add all image files to temp files for cleanup
      imageFiles.forEach(file => tempFiles.push(file.path));

      // If reference image is provided, add it to temp files
      if (referenceFile) {
        tempFiles.push(referenceFile.path);
      }

      logger.info('🚀 Starting batch image enhancement', {
        imageCount: imageFiles.length,
        imageFiles: imageFiles.map(f => f.filename),
        referenceFile: referenceFile?.filename || 'none',
        enhancementType: req.body.enhancementType,
        enhancementStrength: req.body.enhancementStrength,
      });

      // Process all images in parallel
      const enhancementPromises = imageFiles.map(async (imageFile, index) => {
        try {
          logger.info(`🔄 Processing image ${index + 1}/${imageFiles.length}: ${imageFile.filename}`);
          
          // Process image enhancement using Replicate
          const enhancedImageUrl = await this.replicateService.enhanceImage(
            imageFile.path,
            referenceFile?.path || null,
            req.body.enhancementType || 'luminosity',
            req.body.enhancementStrength || 'moderate'
          );

          logger.info(`📥 Enhanced image ${index + 1} URL received`, { enhancedImageUrl });

          // Download the enhanced image
          const enhancedImagePath = await FileUtils.downloadImage(enhancedImageUrl, config.outputDir);
          tempFiles.push(enhancedImagePath);

          return {
            originalImage: `/uploads/${imageFile.filename}`,
            enhancedImage: `/outputs/${path.basename(enhancedImagePath)}`,
            filename: imageFile.filename
          };
        } catch (error) {
          logger.error(`❌ Failed to enhance image ${index + 1}: ${imageFile.filename}`, { error });
          throw error;
        }
      });

      // Wait for all enhancements to complete
      const results = await Promise.all(enhancementPromises);

      const processingTime = Date.now() - startTime;

      logger.info('✅ Batch image enhancement completed successfully', {
        processingTime,
        processedCount: results.length,
        enhancementType: req.body.enhancementType,
      });

      // Verify all files exist before returning paths
      const fs = require('fs');
      const verifiedResults = results.map(result => {
        const originalExists = fs.existsSync(path.join(process.cwd(), 'uploads', path.basename(result.originalImage)));
        const enhancedExists = fs.existsSync(path.join(process.cwd(), 'outputs', path.basename(result.enhancedImage)));

        if (!originalExists) {
          logger.error('❌ Original image file not found in uploads directory', { 
            filename: path.basename(result.originalImage),
            path: result.originalImage 
          });
          throw new Error(`Original image file not found: ${path.basename(result.originalImage)}`);
        }

        if (!enhancedExists) {
          logger.error('❌ Enhanced image file not found in outputs directory', { 
            path: result.enhancedImage
          });
          throw new Error(`Enhanced image file not found: ${path.basename(result.enhancedImage)}`);
        }

        return result;
      });

      logger.info('✅ All file validations passed', {
        processedCount: verifiedResults.length
      });

      res.json({
        success: true,
        message: `Successfully enhanced ${verifiedResults.length} image${verifiedResults.length > 1 ? 's' : ''}`,
        data: {
          originalImages: verifiedResults.map(r => r.originalImage),
          enhancedImages: verifiedResults.map(r => r.enhancedImage),
          processingTime,
          enhancementType: req.body.enhancementType || 'luminosity',
          enhancementStrength: req.body.enhancementStrength || 'moderate',
          modelUsed: 'Bria Increase Resolution Model (bria/increase-resolution)',
          processedCount: verifiedResults.length
        },
        timestamp: new Date().toISOString(),
      } as ApiResponse);

    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error('❌ Batch image enhancement failed', { 
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        processingTime
      });

      // Clean up temp files on error
      await FileUtils.cleanupTempFiles(tempFiles);

      res.status(500).json({
        success: false,
        message: 'Batch image enhancement failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime,
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    }
  };

  /**
   * Replace elements in image using flux-kontext-pro model
   */
  public replaceElements = async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    const tempFiles: string[] = [];

    try {
      // Debug logging
      console.log('🔍 [DEBUG] Replace Elements Request body:', req.body);
      console.log('🔍 [DEBUG] Replace Elements Request files:', req.files);
      
      // Check if files were uploaded - use type assertion for req.files
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      console.log('🔍 [DEBUG] Replace Elements Files after type assertion:', files);
      
      if (!files || !files.image || !files.image[0]) {
        console.log('❌ [DEBUG] No image file found in replace elements request');
        res.status(400).json({
          success: false,
          message: 'No image file uploaded',
          error: 'NO_IMAGE_FILE',
          timestamp: new Date().toISOString(),
        } as ApiResponse);
        return;
      }

      if (!req.body?.prompt) {
        res.status(400).json({
          success: false,
          message: 'Prompt is required for element replacement',
          error: 'MISSING_PROMPT',
          timestamp: new Date().toISOString(),
        } as ApiResponse);
        return;
      }

      const imageFile = files.image[0];

      // Validate image file
      if (!imageFile) {
        res.status(400).json({
          success: false,
          message: 'Invalid image file',
          error: 'INVALID_IMAGE_FILE',
          timestamp: new Date().toISOString(),
        } as ApiResponse);
        return;
      }

      // Add image file to temp files for cleanup
      tempFiles.push(imageFile.path);

      logger.info('🎨 Starting element replacement', {
        imageFile: imageFile.filename,
        prompt: req.body.prompt,
        outputFormat: req.body.outputFormat || 'jpg'
      });

      // Process element replacement using Replicate
      const replacedImageUrl = await this.replicateService.replaceElements(
        imageFile.path,
        req.body.prompt,
        req.body.outputFormat || 'jpg'
      );

      logger.info('📥 Replaced image URL received', { replacedImageUrl });

      // Download the replaced image
      const replacedImagePath = await FileUtils.downloadImage(replacedImageUrl, config.outputDir);
      tempFiles.push(replacedImagePath);

      const processingTime = Date.now() - startTime;

      logger.info('✅ Element replacement completed successfully', {
        processingTime,
        replacedImagePath,
        prompt: req.body.prompt,
      });

      // Ensure the image paths are accessible
      const originalImagePath = `/uploads/${imageFile.filename}`;
      const replacedImagePathUrl = `/outputs/${path.basename(replacedImagePath)}`;

      // Verify files exist before returning paths
      const fs = require('fs');
      const originalExists = fs.existsSync(path.join(process.cwd(), 'uploads', imageFile.filename));
      const replacedExists = fs.existsSync(replacedImagePath);

      if (!originalExists) {
        logger.error('❌ Original image file not found in uploads directory', { 
          filename: imageFile.filename,
          path: originalImagePath 
        });
        throw new Error(`Original image file not found: ${imageFile.filename}`);
      }

      if (!replacedExists) {
        logger.error('❌ Replaced image file not found in outputs directory', { 
          path: replacedImagePath,
          url: replacedImagePathUrl 
        });
        throw new Error(`Replaced image file not found: ${path.basename(replacedImagePath)}`);
      }

      logger.info('✅ File validation passed', {
        originalImage: originalImagePath,
        replacedImage: replacedImagePathUrl,
        originalExists,
        replacedExists
      });

      res.json({
        success: true,
        message: 'Elements replaced successfully',
        data: {
          originalImage: originalImagePath,
          replacedImage: replacedImagePathUrl,
          processingTime,
          prompt: req.body.prompt,
          outputFormat: req.body.outputFormat || 'jpg',
          modelUsed: 'Flux Kontext Pro Model (black-forest-labs/flux-kontext-pro)',
        },
        timestamp: new Date().toISOString(),
      } as ApiResponse);

    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error('❌ Element replacement failed', { 
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        processingTime
      });

      // Clean up temp files on error
      await FileUtils.cleanupTempFiles(tempFiles);

      res.status(500).json({
        success: false,
        message: 'Element replacement failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime,
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    }
  };
} 