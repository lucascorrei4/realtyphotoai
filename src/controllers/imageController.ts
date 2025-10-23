import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import path from 'path';
import { ReplicateService } from '../services/replicateService';
import { InteriorDesignService } from '../services/interiorDesignService';
import { AddFurnitureService } from '../services/addFurnitureService';
import { ExteriorDesignService } from '../services/exteriorDesignService';
import { HybridStorageService } from '../services/hybridStorageService';
import { FileUtils } from '../utils/fileUtils';
import { logger } from '../utils/logger';
import { config } from '../config';
import { ProcessImageRequest, ProcessImageResponse, ApiResponse } from '../types';
import { UserStatisticsService } from '../services/userStatisticsService';

export class ImageController {
  private replicateService: ReplicateService;
  private interiorDesignService: InteriorDesignService;
  private addFurnitureService: AddFurnitureService;
  private exteriorDesignService: ExteriorDesignService;
  private userStatsService: UserStatisticsService;
  private storageService: HybridStorageService;

  constructor() {
    this.replicateService = new ReplicateService();
    this.interiorDesignService = new InteriorDesignService();
    this.addFurnitureService = new AddFurnitureService();
    this.exteriorDesignService = new ExteriorDesignService();
    this.userStatsService = new UserStatisticsService();
    this.storageService = new HybridStorageService();
  }

  /**
   * Helper method to clean up temp files including validation temp files (disk storage only)
   */
  private async cleanupTempFiles(req: AuthenticatedRequest, tempFiles: string[]): Promise<void> {
    const allTempFiles = [...tempFiles];
    // Only add validation temp file if it exists (disk storage mode)
    if ((req as any).validationTempFile) {
      allTempFiles.push((req as any).validationTempFile);
    }
    await FileUtils.cleanupTempFiles(allTempFiles);
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
  public processImage = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const startTime = Date.now();
    const tempFiles: string[] = [];
    let generationId: string | undefined;
    
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

      // Get user ID from authenticated request
      const userId = req.user?.id;
      
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User authentication required',
          error: 'UNAUTHORIZED'
        });
        return;
      }

      tempFiles.push(req.file.path);
      
      logger.info('Starting image processing', {
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        userId,
      });

      // Upload original image to hybrid storage first
      let processImageOriginalStorageResult;
      let processImageProcessingImagePath = req.file.path; // Default to disk path
      
      if (req.file.buffer) {
        // File is in memory (R2 mode)
        processImageOriginalStorageResult = await this.storageService.uploadBuffer(
          req.file.buffer,
          this.storageService.generateKey(req.file.originalname),
          req.file.mimetype,
          {
            originalName: req.file.originalname,
            uploadedAt: new Date().toISOString(),
            userId: req.user?.id || 'anonymous',
          }
        );
        
        // Save buffer to temporary file for processing
        const tempFilename = req.file.filename || req.file.originalname || `temp_${Date.now()}.jpg`;
        const tempPath = path.join(config.tempDir, `temp_${tempFilename}`);
        await FileUtils.ensureDirectoryExists(config.tempDir);
        await require('fs/promises').writeFile(tempPath, req.file.buffer);
        processImageProcessingImagePath = tempPath;
        tempFiles.push(tempPath);
      } else {
        // File is on disk (local mode)
        processImageOriginalStorageResult = await this.storageService.uploadFile(
          req.file.path,
          undefined, // Let storage service generate key
          req.file.mimetype,
          {
            originalName: req.file.originalname,
            uploadedAt: new Date().toISOString(),
            userId: req.user?.id || 'anonymous',
          }
        );
      }

      // Create generation record in database with actual image URL
      generationId = await this.userStatsService.createGenerationRecord({
        user_id: userId,
        model_type: 'interior_design', // This method is used for general decoration, so we'll use interior_design
        status: 'processing',
        input_image_url: processImageOriginalStorageResult.url,
        prompt: req.body?.prompt || 'General AI decoration'
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

      // Duplicate section removed - upload logic is handled above

      // Resize image if needed to optimize processing
      const resizedImagePath = path.join(config.tempDir, `resized_${req.file.filename}`);
      
      try {
        await FileUtils.resizeImageIfNeeded(processImageProcessingImagePath, resizedImagePath, 1024, 1024);
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

      // Download and save processed image to hybrid storage
      const storageResult = await this.replicateService.downloadAndSaveToHybridStorage(
        outputUrl,
        `processed_${req.file.filename}`,
        {
          requestId: metadata.requestId,
          userId: req.user?.id || 'anonymous',
          generationId,
          originalFile: req.file.filename,
        }
      );

      const processingTime = Date.now() - startTime;
      
      // Update generation record with success
      await this.userStatsService.updateGenerationStatus(
        generationId,
        'completed',
        storageResult.url,
        undefined,
        processingTime
      );
      
      logger.info('Image processing completed successfully', {
        originalFile: req.file.filename,
        processedFile: storageResult.storageKey,
        processingTime,
        requestId: metadata.requestId,
        generationId,
        storageType: storageResult.storageType,
      });

      const response: ProcessImageResponse = {
        success: true,
        message: 'Image processed successfully',
        originalImage: processImageOriginalStorageResult.url,
        processedImage: storageResult.url,
        processingTime,
        timestamp: new Date().toISOString(),
      };

      res.json(response);

      // Clean up temp files (keep original and processed) including validation temp file
      const filesToCleanup = tempFiles.filter(f => f !== req.file!.path);
      await this.cleanupTempFiles(req, filesToCleanup);

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      // Update generation record with failure if we have a generationId
      if (generationId) {
        try {
          await this.userStatsService.updateGenerationStatus(
            generationId,
            'failed',
            undefined,
            error instanceof Error ? error.message : 'Unknown error',
            processingTime
          );
        } catch (updateError) {
          logger.error('Failed to update generation record status:', updateError as Error);
        }
      }
      
      logger.error('Image processing failed', {
        error: error instanceof Error ? error.message : String(error),
        filename: req.file?.filename,
        processingTime,
        generationId,
      });

      // Clean up all temp files on error
      await this.cleanupTempFiles(req, tempFiles);

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
  public processImageWithInteriorDesign = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const startTime = Date.now();
    const tempFiles: string[] = [];
    let generationId: string | undefined;
    
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

      // Get user ID from authenticated request
      const userId = req.user?.id;
      
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User authentication required',
          error: 'UNAUTHORIZED'
        });
        return;
      }

      tempFiles.push(req.file.path);
      
      logger.info('Starting interior design processing', {
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        prompt: req.body.prompt,
        userId,
      });

      // Upload original image to hybrid storage first
      let interiorDesignOriginalStorageResult;
      let interiorDesignProcessingImagePath = req.file.path; // Default to disk path
      
      if (req.file.buffer) {
        // File is in memory (R2 mode)
        interiorDesignOriginalStorageResult = await this.storageService.uploadBuffer(
          req.file.buffer,
          this.storageService.generateKey(req.file.originalname),
          req.file.mimetype,
          {
            originalName: req.file.originalname,
            uploadedAt: new Date().toISOString(),
            userId: req.user?.id || 'anonymous',
          }
        );
        
        // Save buffer to temporary file for processing
        const tempFilename = req.file.filename || req.file.originalname || `temp_${Date.now()}.jpg`;
        const tempPath = path.join(config.tempDir, `temp_${tempFilename}`);
        await FileUtils.ensureDirectoryExists(config.tempDir);
        await require('fs/promises').writeFile(tempPath, req.file.buffer);
        interiorDesignProcessingImagePath = tempPath;
        tempFiles.push(tempPath);
      } else {
        // File is on disk (local mode)
        interiorDesignOriginalStorageResult = await this.storageService.uploadFile(
          req.file.path,
          undefined, // Let storage service generate key
          req.file.mimetype,
          {
            originalName: req.file.originalname,
            uploadedAt: new Date().toISOString(),
            userId: req.user?.id || 'anonymous',
          }
        );
      }

      // Create generation record in database with actual image URL
      generationId = await this.userStatsService.createGenerationRecord({
        user_id: userId,
        model_type: 'interior_design',
        status: 'processing',
        input_image_url: interiorDesignOriginalStorageResult.url,
        prompt: req.body.prompt
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
        await FileUtils.resizeImageIfNeeded(interiorDesignProcessingImagePath, resizedImagePath, 1024, 1024);
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
        if (fileExtension === '.heic' || fileExtension === '.heif') {
          // This is a HEIC file that couldn't be resized - likely incompatible format
          const errorMessage = resizeErr.message;
          if (errorMessage.includes('No decoding plugin installed') || 
              errorMessage.includes('bad seek') ||
              errorMessage.includes('compression format')) {
            
            // Clean up any temp files
            await this.cleanupTempFiles(req, tempFiles);
            
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

      // Upload original image to hybrid storage first
      // let interiorOriginalStorageResult;
      if (req.file.buffer) {
        // File is in memory (R2 mode)
        // Upload logic handled above
      } else {
        // Upload logic handled above
      }

      // Process image with Interior Design service
      try {
        const { outputUrl, metadata } = await this.interiorDesignService.generateInteriorDesign(
          finalImagePath,
          req.body.prompt,
          req.body.designType || 'modern',
          req.body.style || 'realistic'
        );

        // Download and save processed image to hybrid storage
        const storageResult = await this.replicateService.downloadAndSaveToHybridStorage(
          outputUrl,
          `interior_design_${req.file.filename}`,
          {
            requestId: metadata.requestId,
            userId: req.user?.id || 'anonymous',
            generationId,
            originalFile: req.file.filename,
            designType: req.body.designType,
            prompt: req.body.prompt,
          }
        );

        const processingTime = Date.now() - startTime;
        
        // Update generation record with success
        await this.userStatsService.updateGenerationStatus(
          generationId,
          'completed',
          storageResult.url,
          undefined,
          processingTime
        );
        
        logger.info('Interior design processing completed successfully', {
          originalFile: req.file.filename,
          processedFile: storageResult.storageKey,
          processingTime,
          requestId: metadata.requestId,
          prompt: req.body.prompt,
          generationId,
          storageType: storageResult.storageType,
        });

        const response: ProcessImageResponse = {
          success: true,
          message: 'Interior design processing completed successfully',
          originalImage: interiorDesignOriginalStorageResult.url,
          processedImage: storageResult.url,
          processingTime,
          timestamp: new Date().toISOString(),
        };

        res.json(response);

        // Clean up temp files (keep original and processed)
        const filesToCleanup = tempFiles.filter(f => f !== req.file!.path);
        await FileUtils.cleanupTempFiles(filesToCleanup);

      } catch (processingError) {
        const processingTime = Date.now() - startTime;
        
        // Update generation record with failure
        await this.userStatsService.updateGenerationStatus(
          generationId,
          'failed',
          undefined,
          processingError instanceof Error ? processingError.message : 'Unknown error',
          processingTime
        );
        
        logger.error('Interior design processing failed', {
          error: processingError instanceof Error ? processingError.message : String(processingError),
          filename: req.file.filename,
          processingTime,
          prompt: req.body.prompt,
          generationId,
        });

        // Clean up all temp files on error
        await this.cleanupTempFiles(req, tempFiles);

        res.status(500).json({
          success: false,
          message: 'Interior design processing failed',
          error: processingError instanceof Error ? processingError.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        } as ApiResponse);
      }

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      logger.error('Interior design processing failed', {
        error: error instanceof Error ? error.message : String(error),
        filename: req.file?.filename,
        processingTime,
        prompt: req.body?.prompt,
      });

      // Clean up all temp files on error
      await this.cleanupTempFiles(req, tempFiles);

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

      // Upload to hybrid storage (R2 or local)
      let storageResult;
      if (req.file.buffer) {
        // File is in memory (R2 mode)
        storageResult = await this.storageService.uploadBuffer(
          req.file.buffer,
          this.storageService.generateKey(req.file.originalname),
          req.file.mimetype,
          {
            originalName: req.file.originalname,
            uploadedAt: new Date().toISOString(),
          }
        );
      } else {
        // File is on disk (local mode)
        storageResult = await this.storageService.uploadFile(
          req.file.path,
          undefined, // Let storage service generate key
          req.file.mimetype,
          {
            originalName: req.file.originalname,
            uploadedAt: new Date().toISOString(),
          }
        );
      }

      const fileInfo = await FileUtils.getFileInfo(req.file.path || 'memory');
      
      logger.info('File uploaded successfully', {
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        storageType: storageResult.storageType,
        storageKey: storageResult.key,
      });

      res.json({
        success: true,
        message: 'File uploaded successfully',
        data: {
          uploadPath: storageResult.url,
          storageKey: storageResult.key,
          storageType: storageResult.storageType,
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
      message: 'RealVisionAI Lab Backend is running!',
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
          add_furnitures: '/add-furnitures',
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
  public enhanceImage = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const startTime = Date.now();
    const tempFiles: string[] = [];

    try {
      // Check if files were uploaded - use type assertion for req.files
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      
      if (!files || !files.image || !files.image[0]) {
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

      // Get user ID from authenticated request
      const userId = (req as AuthenticatedRequest).user?.id;
      
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User authentication required',
          error: 'UNAUTHORIZED'
        });
        return;
      }
      
      // Process all images in parallel
      const enhancementPromises = imageFiles.map(async (imageFile, index) => {
        try {
          logger.info(`🔄 Processing image ${index + 1}/${imageFiles.length}: ${imageFile.filename}`);
          
          // Upload original image to hybrid storage first
          let imageStorageResult;
          let imageProcessingPath = imageFile.path; // Default to disk path
          
          if (imageFile.buffer) {
            // File is in memory (R2 mode)
            imageStorageResult = await this.storageService.uploadBuffer(
              imageFile.buffer,
              this.storageService.generateKey(imageFile.originalname),
              imageFile.mimetype,
              {
                originalName: imageFile.originalname,
                uploadedAt: new Date().toISOString(),
                userId: req.user?.id || 'anonymous',
              }
            );
            
            // Save buffer to temporary file for processing
            const tempFilename = imageFile.filename || imageFile.originalname || `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;
            const tempPath = path.join(config.tempDir, `temp_${tempFilename}`);
            await FileUtils.ensureDirectoryExists(config.tempDir);
            await require('fs/promises').writeFile(tempPath, imageFile.buffer);
            imageProcessingPath = tempPath;
            tempFiles.push(tempPath);
          } else {
            // File is on disk (local mode)
            imageStorageResult = await this.storageService.uploadFile(
              imageFile.path,
              undefined, // Let storage service generate key
              imageFile.mimetype,
              {
                originalName: imageFile.originalname,
                uploadedAt: new Date().toISOString(),
                userId: req.user?.id || 'anonymous',
              }
            );
          }
          
          // Create generation record in database with actual image URL
          const generationId = await this.userStatsService.createGenerationRecord({
            user_id: userId,
            model_type: 'image_enhancement',
            status: 'processing',
            input_image_url: imageStorageResult.url,
            prompt: `Enhancement: ${req.body.enhancementType || 'luminosity'} with ${req.body.enhancementStrength || 'moderate'} strength`
          });
          
          // Process image enhancement using Replicate
          const enhancedImageUrl = await this.replicateService.enhanceImage(
            imageProcessingPath,
            referenceFile?.path || null,
            req.body.enhancementType || 'luminosity',
            req.body.enhancementStrength || 'moderate'
          );

          logger.info(`📥 Enhanced image ${index + 1} URL received`, { enhancedImageUrl });

          // Download the enhanced image
          const enhancedImagePath = await FileUtils.downloadImage(enhancedImageUrl, config.outputDir);
          tempFiles.push(enhancedImagePath);

          // Update generation record with success
          await this.userStatsService.updateGenerationStatus(
            generationId,
            'completed',
            `/outputs/${path.basename(enhancedImagePath)}`,
            undefined,
            Date.now() - startTime
          );

          return {
            originalImage: imageStorageResult.url,
            enhancedImage: `/outputs/${path.basename(enhancedImagePath)}`,
            filename: imageFile.filename,
            generationId
          };
        } catch (error) {
          logger.error(`❌ Failed to enhance image ${index + 1}: ${imageFile.filename}`, { error });
          
          // Update generation record with failure if we have a generationId
          if (error && typeof error === 'object' && 'generationId' in error) {
            await this.userStatsService.updateGenerationStatus(
              (error as any).generationId,
              'failed',
              undefined,
              error instanceof Error ? error.message : 'Unknown error'
            );
          }
          
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
      await this.cleanupTempFiles(req, tempFiles);

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
   * Get image enhancement information and configuration
   */
  public getImageEnhancementInfo = async (_: Request, res: Response): Promise<void> => {
    try {
      res.json({
        success: true,
        message: 'Image enhancement information retrieved successfully',
        data: {
          endpoint: '/api/v1/image-enhancement',
          method: 'POST',
          description: 'Enhance multiple images with AI-powered luminosity and color improvements',
          features: {
            batchProcessing: 'Process up to 20 images simultaneously',
            enhancementTypes: ['luminosity', 'color', 'resolution'],
            enhancementStrengths: ['subtle', 'moderate', 'strong'],
            supportedFormats: ['JPG', 'PNG', 'WebP', 'HEIC'],
            maxFileSize: '10MB per image',
            referenceImage: 'Optional reference image for color matching'
          },
          model: 'Bria Increase Resolution Model (bria/increase-resolution)',
          authentication: 'Required (Bearer token)',
          rateLimit: '10 requests per 15 minutes'
        },
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    } catch (error) {
      logger.error('Failed to get image enhancement info', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve image enhancement information',
        error: 'INFO_FAILED',
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    }
  };

  /**
   * Replace elements in image using flux-kontext-pro model
   */
  public replaceElements = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const startTime = Date.now();
    const tempFiles: string[] = [];
    let generationId: string | undefined;

    try {
      // Check if files were uploaded - use type assertion for req.files
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      
      if (!files || !files.image || !files.image[0]) {
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

      // Get user ID from authenticated request
      const userId = req.user?.id;
      
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User authentication required',
          error: 'UNAUTHORIZED'
        });
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
        outputFormat: req.body.outputFormat || 'jpg',
        userId,
      });

      // Upload original image to hybrid storage first
      let imageStorageResult;
      let imageProcessingPath = imageFile.path; // Default to disk path
      
      if (imageFile.buffer) {
        // File is in memory (R2 mode)
        imageStorageResult = await this.storageService.uploadBuffer(
          imageFile.buffer,
          this.storageService.generateKey(imageFile.originalname),
          imageFile.mimetype,
          {
            originalName: imageFile.originalname,
            uploadedAt: new Date().toISOString(),
            userId: req.user?.id || 'anonymous',
          }
        );
        
        // Save buffer to temporary file for processing
        const tempFilename = imageFile.filename || imageFile.originalname || `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;
        const tempPath = path.join(config.tempDir, `temp_${tempFilename}`);
        await FileUtils.ensureDirectoryExists(config.tempDir);
        await require('fs/promises').writeFile(tempPath, imageFile.buffer);
        imageProcessingPath = tempPath;
        tempFiles.push(tempPath);
      } else {
        // File is on disk (local mode)
        imageStorageResult = await this.storageService.uploadFile(
          imageFile.path,
          undefined, // Let storage service generate key
          imageFile.mimetype,
          {
            originalName: imageFile.originalname,
            uploadedAt: new Date().toISOString(),
            userId: req.user?.id || 'anonymous',
          }
        );
      }

      // Create generation record in database with actual image URL
      generationId = await this.userStatsService.createGenerationRecord({
        user_id: userId,
        model_type: 'element_replacement',
        status: 'processing',
        input_image_url: imageStorageResult.url,
        prompt: req.body.prompt
      });

      // Process element replacement using Replicate
      const replacedImageUrl = await this.replicateService.replaceElements(
        imageProcessingPath,
        req.body.prompt,
        req.body.outputFormat || 'jpg'
      );

      logger.info('📥 Replaced image URL received', { replacedImageUrl });

      // Download the replaced image
      const replacedImagePath = await FileUtils.downloadImage(replacedImageUrl, config.outputDir);
      tempFiles.push(replacedImagePath);

      const processingTime = Date.now() - startTime;

      // Update generation record with success
      await this.userStatsService.updateGenerationStatus(
        generationId,
        'completed',
        `/outputs/${path.basename(replacedImagePath)}`,
        undefined,
        processingTime
      );

      logger.info('✅ Element replacement completed successfully', {
        processingTime,
        replacedImagePath,
        prompt: req.body.prompt,
        generationId,
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
      
      // Update generation record with failure if we have a generationId
      if (generationId) {
        try {
          await this.userStatsService.updateGenerationStatus(
            generationId,
            'failed',
            undefined,
            error instanceof Error ? error.message : 'Unknown error',
            processingTime
          );
        } catch (updateError) {
          logger.error('Failed to update generation record status:', updateError as Error);
        }
      }
      
      logger.error('❌ Element replacement failed', { 
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        processingTime,
        generationId,
      });

      // Clean up temp files on error
      await this.cleanupTempFiles(req, tempFiles);

      res.status(500).json({
        success: false,
        message: 'Element replacement failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime,
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    }
  };

  /**
   * Add furnitures to room images
   */
  public addFurnitures = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const startTime = Date.now();
    const tempFiles: string[] = [];
    let generationId: string | undefined;

    try {
      // Check if files were uploaded
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      
      if (!files || !files.roomImage || !files.roomImage[0]) {
        res.status(400).json({
          success: false,
          message: 'Room image file is required',
          error: 'NO_ROOM_IMAGE_FILE',
          timestamp: new Date().toISOString(),
        } as ApiResponse);
        return;
      }

      if (!req.body?.prompt) {
        res.status(400).json({
          success: false,
          message: 'Prompt is required for furniture addition',
          error: 'MISSING_PROMPT',
          timestamp: new Date().toISOString(),
        } as ApiResponse);
        return;
      }

      // Get user ID from authenticated request
      const userId = req.user?.id;
      
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User authentication required',
          error: 'UNAUTHORIZED'
        });
        return;
      }

      const roomImageFile = files.roomImage[0];
      const furnitureImageFile = files.furnitureImage?.[0]; // Optional

      // Validate room image file
      if (!roomImageFile) {
        res.status(400).json({
          success: false,
          message: 'Invalid room image file',
          error: 'INVALID_ROOM_IMAGE_FILE',
          timestamp: new Date().toISOString(),
        } as ApiResponse);
        return;
      }

      logger.info('🪑 Starting furniture addition', {
        roomImageFile: roomImageFile.filename,
        furnitureImageFile: furnitureImageFile?.filename || 'none',
        prompt: req.body.prompt,
        furnitureType: req.body.furnitureType || 'general',
        userId
      });

      // Upload original room image to hybrid storage first
      let roomImageStorageResult;
      let roomImageProcessingPath = roomImageFile.path; // Default to disk path
      
      if (roomImageFile.buffer) {
        // File is in memory (R2 mode)
        roomImageStorageResult = await this.storageService.uploadBuffer(
          roomImageFile.buffer,
          this.storageService.generateKey(roomImageFile.originalname),
          roomImageFile.mimetype,
          {
            originalName: roomImageFile.originalname,
            uploadedAt: new Date().toISOString(),
            userId: req.user?.id || 'anonymous',
          }
        );
        
        // Save buffer to temporary file for processing
        const tempFilename = roomImageFile.filename || roomImageFile.originalname || `temp_${Date.now()}.jpg`;
        const tempPath = path.join(config.tempDir, `temp_${tempFilename}`);
        await FileUtils.ensureDirectoryExists(config.tempDir);
        await require('fs/promises').writeFile(tempPath, roomImageFile.buffer);
        roomImageProcessingPath = tempPath;
        tempFiles.push(tempPath);
      } else {
        // File is on disk (local mode)
        roomImageStorageResult = await this.storageService.uploadFile(
          roomImageFile.path,
          undefined, // Let storage service generate key
          roomImageFile.mimetype,
          {
            originalName: roomImageFile.originalname,
            uploadedAt: new Date().toISOString(),
            userId: req.user?.id || 'anonymous',
          }
        );
      }

      // Upload furniture image to hybrid storage if provided
      let furnitureImageStorageResult = null;
      let furnitureImageProcessingPath = furnitureImageFile?.path;
      
      if (furnitureImageFile) {
        if (furnitureImageFile.buffer) {
          // File is in memory (R2 mode)
          furnitureImageStorageResult = await this.storageService.uploadBuffer(
            furnitureImageFile.buffer,
            this.storageService.generateKey(furnitureImageFile.originalname),
            furnitureImageFile.mimetype,
            {
              originalName: furnitureImageFile.originalname,
              uploadedAt: new Date().toISOString(),
              userId: req.user?.id || 'anonymous',
            }
          );
          
          // Save buffer to temporary file for processing
          const tempFilename = furnitureImageFile.filename || furnitureImageFile.originalname || `temp_${Date.now()}.jpg`;
          const tempPath = path.join(config.tempDir, `temp_${tempFilename}`);
          await FileUtils.ensureDirectoryExists(config.tempDir);
          await require('fs/promises').writeFile(tempPath, furnitureImageFile.buffer);
          furnitureImageProcessingPath = tempPath;
          tempFiles.push(tempPath);
        } else {
          // File is on disk (local mode)
          furnitureImageStorageResult = await this.storageService.uploadFile(
            furnitureImageFile.path,
            undefined, // Let storage service generate key
            furnitureImageFile.mimetype,
            {
              originalName: furnitureImageFile.originalname,
              uploadedAt: new Date().toISOString(),
              userId: req.user?.id || 'anonymous',
            }
          );
        }
      }

      // Create generation record in database with actual image URL
      const dbGenerationId = await this.userStatsService.createGenerationRecord({
        user_id: userId,
        model_type: 'add_furnitures',
        status: 'processing',
        input_image_url: roomImageStorageResult.url,
        prompt: req.body.prompt
      });

      // Process the furniture addition
      const result = await this.addFurnitureService.addFurniture(
        roomImageProcessingPath,
        furnitureImageProcessingPath || null,
        req.body.prompt,
        req.body.furnitureType || 'general'
      );

      if (result.outputUrl) {
        // Generate unique filename for the output
        const outputFilename = `furniture_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;
        const finalOutputPath = path.join(config.outputDir, outputFilename);
        
        // Download the result from URL
        logger.info('📥 Downloading furniture result from URL', {
          url: result.outputUrl,
          outputPath: finalOutputPath
        });
        const fs = require('fs');
        const downloadedPath = await FileUtils.downloadImage(result.outputUrl, config.outputDir);
        fs.renameSync(downloadedPath, finalOutputPath);
        const finalImagePath = finalOutputPath;
        
        // Generate public URLs
        const roomImageUrl = roomImageStorageResult.url;
        const furnitureImageUrl = furnitureImageStorageResult?.url || null;
        const resultImageUrl = `/outputs/${outputFilename}`;

        const processingTime = Date.now() - startTime;
        
        // Update generation record with success
        await this.userStatsService.updateGenerationStatus(
          dbGenerationId,
          'completed',
          resultImageUrl,
          undefined,
          processingTime
        );

        generationId = dbGenerationId;

        logger.info('✅ Furniture addition completed successfully', {
          processingTime,
          resultImagePath: finalImagePath,
          prompt: req.body.prompt,
          generationId: dbGenerationId
        });

        res.json({
          success: true,
          message: 'Furniture added successfully',
          data: {
            originalRoomImage: roomImageUrl,
            originalFurnitureImage: furnitureImageUrl,
            resultImage: resultImageUrl,
            prompt: req.body.prompt,
            furnitureType: req.body.furnitureType || 'general',
            processingTime,
            generationId: dbGenerationId
          },
          timestamp: new Date().toISOString(),
        });
      } else {
        // Update generation record with failure
        await this.userStatsService.updateGenerationStatus(
          dbGenerationId,
          'failed',
          undefined,
          'No output URL received from model',
          Date.now() - startTime
        );

        logger.error('❌ Furniture addition failed', {
          error: 'No output URL received from model',
          processingTime: Date.now() - startTime
        });

        res.status(500).json({
          success: false,
          message: 'Furniture addition failed',
          error: 'NO_OUTPUT_URL',
          timestamp: new Date().toISOString(),
        } as ApiResponse);
      }
    } catch (error) {
      logger.error('🚨 Error in addFurnitures:', error as Error);
      
      // Update generation record with failure if we have a generation ID
      if (generationId) {
        try {
          await this.userStatsService.updateGenerationStatus(
            generationId,
            'failed',
            undefined,
            error instanceof Error ? error.message : 'Unknown error',
            Date.now() - startTime
          );
        } catch (updateError) {
          logger.error('Failed to update generation status:', updateError as Error);
        }
      }

      res.status(500).json({
        success: false,
        message: 'Internal server error during furniture addition',
        error: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    } finally {
      // Clean up temporary files
      for (const tempFile of tempFiles) {
        try {
          const fs = require('fs');
          fs.unlinkSync(tempFile);
        } catch (error) {
          logger.warn('Failed to clean up temp file:', { tempFile });
        }
      }
    }
  };

  /**
   * Generate exterior design for buildings
   */
  public exteriorDesign = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const startTime = Date.now();
    const tempFiles: string[] = [];
    let generationId: string | undefined;

    try {
      const buildingImageFile = req.file;
      
      if (!buildingImageFile) {
        res.status(400).json({
          success: false,
          message: 'Building image file is required',
          error: 'NO_BUILDING_IMAGE_FILE',
          timestamp: new Date().toISOString(),
        } as ApiResponse);
        return;
      }

      if (!req.body?.designPrompt) {
        res.status(400).json({
          success: false,
          message: 'Design prompt is required for exterior design',
          error: 'MISSING_DESIGN_PROMPT',
          timestamp: new Date().toISOString(),
        } as ApiResponse);
        return;
      }

      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User authentication required',
          error: 'UNAUTHORIZED'
        });
        return;
      }

      logger.info('🏢 Starting exterior design generation', {
        buildingImageFile: buildingImageFile.filename,
        designPrompt: req.body.designPrompt,
        designType: req.body.designType || 'modern',
        style: req.body.style || 'architectural',
        userId
      });

      // Upload original building image to hybrid storage first
      let buildingImageStorageResult;
      let buildingImageProcessingPath: string | Buffer = buildingImageFile.path; // Default to disk path
      
      if (buildingImageFile.buffer) {
        // File is in memory (R2 mode)
        buildingImageStorageResult = await this.storageService.uploadBuffer(
          buildingImageFile.buffer,
          this.storageService.generateKey(buildingImageFile.originalname),
          buildingImageFile.mimetype,
          {
            originalName: buildingImageFile.originalname,
            uploadedAt: new Date().toISOString(),
            userId: req.user?.id || 'anonymous',
          }
        );
        
        // Use buffer directly for processing - no temp file needed
        buildingImageProcessingPath = buildingImageFile.buffer;
      } else {
        // File is on disk (local mode)
        buildingImageStorageResult = await this.storageService.uploadFile(
          buildingImageFile.path,
          undefined, // Let storage service generate key
          buildingImageFile.mimetype,
          {
            originalName: buildingImageFile.originalname,
            uploadedAt: new Date().toISOString(),
            userId: req.user?.id || 'anonymous',
          }
        );
      }

      // Create generation record in database with actual image URL
      const dbGenerationId = await this.userStatsService.createGenerationRecord({
        user_id: userId,
        model_type: 'exterior_design',
        status: 'processing',
        input_image_url: buildingImageStorageResult.url,
        prompt: req.body.designPrompt
      });
      generationId = dbGenerationId;

      // Process the exterior design
      const result = await this.exteriorDesignService.generateExteriorDesign(
        buildingImageProcessingPath,
        req.body.designPrompt,
        req.body.designType || 'modern',
        req.body.style || 'architectural'
      );

      if (result.outputUrl) {
        // Generate unique filename for the output
        const outputFilename = `exterior_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;
        const finalOutputPath = path.join(config.outputDir, outputFilename);
        
        // Download the result from URL
        logger.info('📥 Downloading exterior design result from URL', {
          url: result.outputUrl,
          outputPath: finalOutputPath
        });
        const fs = require('fs');
        const downloadedPath = await FileUtils.downloadImage(result.outputUrl, config.outputDir);
        fs.renameSync(downloadedPath, finalOutputPath);
        const finalImagePath = finalOutputPath;
        
        // Generate public URLs
        const buildingImageUrl = `/uploads/${buildingImageFile.filename}`;
        const resultImageUrl = `/outputs/${outputFilename}`;

        const processingTime = Date.now() - startTime;
        
        // Update generation record with success
        await this.userStatsService.updateGenerationStatus(
          dbGenerationId,
          'completed',
          resultImageUrl,
          undefined,
          processingTime
        );

        logger.info('✅ Exterior design generation completed successfully', {
          processingTime,
          resultImagePath: finalImagePath,
          designPrompt: req.body.designPrompt,
          generationId: dbGenerationId
        });

        res.json({
          success: true,
          message: 'Exterior design generated successfully',
          data: {
            originalBuildingImage: buildingImageUrl,
            resultImage: resultImageUrl,
            designPrompt: req.body.designPrompt,
            designType: req.body.designType || 'modern',
            style: req.body.style || 'architectural',
            processingTime,
            generationId: dbGenerationId
          },
          timestamp: new Date().toISOString(),
        });
      } else {
        // Update generation record with failure
        await this.userStatsService.updateGenerationStatus(
          dbGenerationId,
          'failed',
          undefined,
          'No output URL received from model',
          Date.now() - startTime
        );

        logger.error('❌ Exterior design generation failed', {
          error: 'No output URL received from model',
          processingTime: Date.now() - startTime
        });

        res.status(500).json({
          success: false,
          message: 'Exterior design generation failed',
          error: 'NO_OUTPUT_URL',
          timestamp: new Date().toISOString(),
        } as ApiResponse);
      }
    } catch (error) {
      logger.error('🚨 Error in exteriorDesign:', error as Error);
      
      // Update generation record with failure if we have a generation ID
      if (generationId) {
        try {
          await this.userStatsService.updateGenerationStatus(
            generationId,
            'failed',
            undefined,
            error instanceof Error ? error.message : 'Unknown error',
            Date.now() - startTime
          );
        } catch (updateError) {
          logger.error('Failed to update generation status:', updateError as Error);
        }
      }

      res.status(500).json({
        success: false,
        message: 'Internal server error during exterior design generation',
        error: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    } finally {
      // Clean up temporary files
      for (const tempFile of tempFiles) {
        try {
          const fs = require('fs');
          fs.unlinkSync(tempFile);
        } catch (error) {
          logger.warn('Failed to clean up temp file:', { tempFile });
        }
      }
    }
  };
} 