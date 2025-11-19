import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import path from 'path';
import fs from 'fs';
import { ReplicateService } from '../services/replicateService';
import { InteriorDesignService } from '../services/interiorDesignService';
import { AddFurnitureService } from '../services/addFurnitureService';
import { ExteriorDesignService } from '../services/exteriorDesignService';
import { SmartEffectsService, EffectType } from '../services/smartEffectsService';
import { VideoMotionService, VideoMotionType } from '../services/videoMotionService';
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
  private smartEffectsService: SmartEffectsService;
  private videoMotionService: VideoMotionService;
  private userStatsService: UserStatisticsService;
  private storageService: HybridStorageService;

  constructor() {
    this.replicateService = new ReplicateService();
    this.interiorDesignService = new InteriorDesignService();
    this.addFurnitureService = new AddFurnitureService();
    this.exteriorDesignService = new ExteriorDesignService();
    this.smartEffectsService = new SmartEffectsService();
    this.videoMotionService = new VideoMotionService();
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
        // Ensure filename matches MIME type (fix for HEIC conversion)
        let storageFilename = req.file.originalname;
        if (req.file.mimetype === 'image/webp' && !storageFilename.endsWith('.webp')) {
          storageFilename = storageFilename.replace(/\.[^.]+$/, '.webp');
        }
        
        // Debug: Log file info before storage
        logger.info('Uploading buffer to storage', {
          originalName: req.file.originalname,
          storageFilename: storageFilename,
          mimetype: req.file.mimetype,
          bufferSize: req.file.buffer.length,
          generatedKey: this.storageService.generateKey(storageFilename)
        });
        
        processImageOriginalStorageResult = await this.storageService.uploadBuffer(
          req.file.buffer,
          this.storageService.generateKey(storageFilename),
          req.file.mimetype,
          {
            originalName: storageFilename,
            uploadedAt: new Date().toISOString(),
            userId: req.user?.id || 'anonymous',
          }
        );
        
        // Debug: Log storage result
        logger.info('Storage upload completed', {
          url: processImageOriginalStorageResult.url,
          key: processImageOriginalStorageResult.key
        });
        
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
        // Ensure filename matches MIME type (fix for HEIC conversion)
        let storageFilename = req.file.originalname;
        if (req.file.mimetype === 'image/webp' && !storageFilename.endsWith('.webp')) {
          storageFilename = storageFilename.replace(/\.[^.]+$/, '.webp');
        }
        
        interiorDesignOriginalStorageResult = await this.storageService.uploadBuffer(
          req.file.buffer,
          this.storageService.generateKey(storageFilename),
          req.file.mimetype,
          {
            originalName: storageFilename,
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
        // Ensure filename matches MIME type (fix for HEIC conversion)
        let storageFilename = req.file.originalname;
        if (req.file.mimetype === 'image/webp' && !storageFilename.endsWith('.webp')) {
          storageFilename = storageFilename.replace(/\.[^.]+$/, '.webp');
        }
        
        storageResult = await this.storageService.uploadBuffer(
          req.file.buffer,
          this.storageService.generateKey(storageFilename),
          req.file.mimetype,
          {
            originalName: storageFilename,
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

      // Add disk-based files to temp files for cleanup (buffer files don't need cleanup)
      imageFiles.forEach(file => {
        if (file.path && !file.buffer) {
          tempFiles.push(file.path);
        }
      });

      // If reference image is provided, add it to temp files (only if it's disk-based)
      if (referenceFile && referenceFile.path && !referenceFile.buffer) {
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
          let imageProcessingPath: string | Buffer = imageFile.path; // Default to disk path
          
          if (imageFile.buffer) {
            // File is in memory (R2 mode)
            // Ensure filename matches MIME type (fix for HEIC conversion)
            let storageFilename = imageFile.originalname;
            if (imageFile.mimetype === 'image/webp' && !storageFilename.endsWith('.webp')) {
              storageFilename = storageFilename.replace(/\.[^.]+$/, '.webp');
            }
            
            imageStorageResult = await this.storageService.uploadBuffer(
              imageFile.buffer,
              this.storageService.generateKey(storageFilename),
              imageFile.mimetype,
              {
                originalName: storageFilename,
                uploadedAt: new Date().toISOString(),
                userId: req.user?.id || 'anonymous',
              }
            );
            
            // Use buffer directly for processing - no temp file needed
            imageProcessingPath = imageFile.buffer;
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
          const referenceProcessingPath = referenceFile?.buffer || referenceFile?.path || null;
          const enhancedImageUrl = await this.replicateService.enhanceImage(
            imageProcessingPath,
            referenceProcessingPath,
            req.body.enhancementType || 'luminosity',
            req.body.enhancementStrength || 'moderate'
          );

          logger.info(`📥 Enhanced image ${index + 1} URL received`, { enhancedImageUrl });

          // Persist enhanced result to hybrid storage (R2/local)
          const enhancedStorageResult = await this.replicateService.downloadAndSaveToHybridStorage(
            enhancedImageUrl,
            `${path.parse(imageFile.originalname || imageFile.filename || 'image').name}_enhanced.png`,
            {
              userId,
              generationId,
              originalFile: imageFile.originalname || imageFile.filename || 'unknown',
              enhancementType: req.body.enhancementType || 'luminosity',
              enhancementStrength: req.body.enhancementStrength || 'moderate',
            }
          );

          // Update generation record with success
          await this.userStatsService.updateGenerationStatus(
            generationId,
            'completed',
            enhancedStorageResult.url,
            undefined,
            Date.now() - startTime
          );

          return {
            originalImage: imageStorageResult.url,
            enhancedImage: enhancedStorageResult.url,
            enhancedStorageKey: enhancedStorageResult.storageKey,
            enhancedStorageType: enhancedStorageResult.storageType,
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

      // Verify all enhanced files exist in storage before returning paths
      const verifiedResults = await Promise.all(results.map(async result => {
        if (result.enhancedStorageKey) {
          const enhancedExists = await this.storageService.fileExists(result.enhancedStorageKey);

          if (!enhancedExists) {
            logger.error('❌ Enhanced image file not found in storage', { 
              storageKey: result.enhancedStorageKey
            });
            throw new Error(`Enhanced image file not found: ${result.enhancedStorageKey}`);
          }
        }

        return result;
      }));

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

      // Add disk-based files to temp files for cleanup (buffer files don't need cleanup)
      if (imageFile.path && !imageFile.buffer) {
        tempFiles.push(imageFile.path);
      }

      logger.info('🎨 Starting element replacement', {
        imageFile: imageFile.filename,
        prompt: req.body.prompt,
        outputFormat: req.body.outputFormat || 'jpg',
        userId,
      });

      // Upload original image to hybrid storage first
      let imageStorageResult;
      let imageProcessingPath: string | Buffer = imageFile.path; // Default to disk path
      
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
        
        // Use buffer directly for processing - no temp file needed
        imageProcessingPath = imageFile.buffer;
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

      const requestedOutputFormat = (req.body.outputFormat || 'jpg').toLowerCase();
      const normalizedExtension = requestedOutputFormat.startsWith('.') ? requestedOutputFormat : `.${requestedOutputFormat}`;
      const baseFilename = path.parse(imageFile.originalname || imageFile.filename || 'image').name;

      // Persist replaced result to hybrid storage (R2/local)
      const replacedStorageResult = await this.replicateService.downloadAndSaveToHybridStorage(
        replacedImageUrl,
        `${baseFilename}_replaced${normalizedExtension}`,
        {
          userId,
          generationId,
          originalFile: imageFile.originalname || imageFile.filename || 'unknown',
          prompt: req.body.prompt,
          outputFormat: requestedOutputFormat,
        }
      );

      const processingTime = Date.now() - startTime;

      // Update generation record with success
      await this.userStatsService.updateGenerationStatus(
        generationId,
        'completed',
        replacedStorageResult.url,
        undefined,
        processingTime
      );

      logger.info('✅ Element replacement completed successfully', {
        processingTime,
        replacedImageUrl: replacedStorageResult.url,
        prompt: req.body.prompt,
        generationId,
        storageType: replacedStorageResult.storageType,
      });

      const originalImageUrl = imageStorageResult.url;
      const replacedImagePublicUrl = replacedStorageResult.url;

      // Verify replaced image exists in storage
      if (replacedStorageResult.storageKey) {
        const replacedExists = await this.storageService.fileExists(replacedStorageResult.storageKey);

        if (!replacedExists) {
          logger.error('❌ Replaced image file not found in storage', { 
            storageKey: replacedStorageResult.storageKey
          });
          throw new Error(`Replaced image file not found: ${replacedStorageResult.storageKey}`);
        }
      }

      logger.info('✅ File validation passed', {
        originalImage: originalImageUrl,
        replacedImage: replacedImagePublicUrl,
        storageKey: replacedStorageResult.storageKey
      });

      res.json({
        success: true,
        message: 'Elements replaced successfully',
        data: {
          originalImage: originalImageUrl,
          replacedImage: replacedImagePublicUrl,
          processingTime,
          prompt: req.body.prompt,
          outputFormat: requestedOutputFormat,
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
    let responseSent = false;

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
        // Ensure filename matches MIME type (fix for HEIC conversion)
        let roomStorageFilename = roomImageFile.originalname;
        if (roomImageFile.mimetype === 'image/webp' && !roomStorageFilename.endsWith('.webp')) {
          roomStorageFilename = roomStorageFilename.replace(/\.[^.]+$/, '.webp');
        }
        
        roomImageStorageResult = await this.storageService.uploadBuffer(
          roomImageFile.buffer,
          this.storageService.generateKey(roomStorageFilename),
          roomImageFile.mimetype,
          {
            originalName: roomStorageFilename,
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
          // Ensure filename matches MIME type (fix for HEIC conversion)
          let furnitureStorageFilename = furnitureImageFile.originalname;
          if (furnitureImageFile.mimetype === 'image/webp' && !furnitureStorageFilename.endsWith('.webp')) {
            furnitureStorageFilename = furnitureStorageFilename.replace(/\.[^.]+$/, '.webp');
          }
          
          furnitureImageStorageResult = await this.storageService.uploadBuffer(
            furnitureImageFile.buffer,
            this.storageService.generateKey(furnitureStorageFilename),
            furnitureImageFile.mimetype,
            {
              originalName: furnitureStorageFilename,
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
        const baseFilename = path.parse(roomImageFile.originalname || roomImageFile.filename || 'room_image').name;
        const outputExtension = '.jpg';

        const resultStorage = await this.replicateService.downloadAndSaveToHybridStorage(
          result.outputUrl,
          `${baseFilename}_furnished${outputExtension}`,
          {
            userId,
            generationId: dbGenerationId,
            prompt: req.body.prompt,
            furnitureType: req.body.furnitureType || 'general',
          }
        );

        // Generate public URLs
        const roomImageUrl = roomImageStorageResult.url;
        const furnitureImageUrl = furnitureImageStorageResult?.url || null;
        const resultImageUrl = resultStorage.url;

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

        if (resultStorage.storageKey) {
          const resultExists = await this.storageService.fileExists(resultStorage.storageKey);
          
          if (!resultExists) {
            logger.error('❌ Furniture result not found in storage', {
              storageKey: resultStorage.storageKey
            });
            throw new Error(`Furniture result not found: ${resultStorage.storageKey}`);
          }
        }

        logger.info('✅ Furniture addition completed successfully', {
          processingTime,
          resultImageUrl,
          prompt: req.body.prompt,
          generationId: dbGenerationId,
          storageType: resultStorage.storageType,
          storageKey: resultStorage.storageKey
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
        responseSent = true;
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
        responseSent = true;
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

      if (!responseSent) {
        res.status(500).json({
          success: false,
          message: 'Internal server error during furniture addition',
          error: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
          timestamp: new Date().toISOString(),
        } as ApiResponse);
      }
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
        buildingImageOriginalName: buildingImageFile.originalname,
        buildingImageMimetype: buildingImageFile.mimetype,
        buildingImageSize: buildingImageFile.size,
        hasBuffer: !!buildingImageFile.buffer,
        bufferSize: buildingImageFile.buffer ? buildingImageFile.buffer.length : 0,
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
        // Ensure filename matches MIME type (fix for HEIC conversion)
        let buildingStorageFilename = buildingImageFile.originalname;
        if (buildingImageFile.mimetype === 'image/webp' && !buildingStorageFilename.endsWith('.webp')) {
          buildingStorageFilename = buildingStorageFilename.replace(/\.[^.]+$/, '.webp');
        }
        
        logger.info('📤 Uploading building image buffer to storage', {
          bufferSize: buildingImageFile.buffer.length,
          filename: buildingStorageFilename,
          mimetype: buildingImageFile.mimetype
        });
        
        buildingImageStorageResult = await this.storageService.uploadBuffer(
          buildingImageFile.buffer,
          this.storageService.generateKey(buildingStorageFilename),
          buildingImageFile.mimetype,
          {
            originalName: buildingStorageFilename,
            uploadedAt: new Date().toISOString(),
            userId: req.user?.id || 'anonymous',
          }
        );
        
        logger.info('✅ Building image uploaded to storage successfully', {
          storageUrl: buildingImageStorageResult.url,
          key: buildingImageStorageResult.key
        });
        
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

      logger.info('🚀 Calling exterior design service', {
        processingPathType: typeof buildingImageProcessingPath,
        processingPathIsBuffer: Buffer.isBuffer(buildingImageProcessingPath),
        processingPathSize: Buffer.isBuffer(buildingImageProcessingPath) ? buildingImageProcessingPath.length : 'N/A',
        designPrompt: req.body.designPrompt,
        designType: req.body.designType || 'modern',
        style: req.body.style || 'architectural'
      });

      // Process the exterior design
      const result = await this.exteriorDesignService.generateExteriorDesign(
        buildingImageProcessingPath,
        req.body.designPrompt,
        req.body.designType || 'modern',
        req.body.style || 'architectural'
      );

      if (result.outputUrl) {
        // Generate filename for the output (consistent with other services)
        const baseFilename = path.parse(buildingImageFile.originalname || buildingImageFile.filename || 'building_image').name;
        const outputExtension = '.jpg';

        // Download and save processed image to hybrid storage (R2/local) - unified approach
        const resultStorage = await this.replicateService.downloadAndSaveToHybridStorage(
          result.outputUrl,
          `${baseFilename}_exterior${outputExtension}`,
          {
            requestId: result.metadata?.requestId,
            userId: req.user?.id || 'anonymous',
            generationId: dbGenerationId,
            originalFile: buildingImageFile.originalname || buildingImageFile.filename || 'unknown',
            designPrompt: req.body.designPrompt,
            designType: req.body.designType || 'modern',
            style: req.body.style || 'architectural',
          }
        );

        const processingTime = Date.now() - startTime;

        // Update generation record with success using R2 URL
        await this.userStatsService.updateGenerationStatus(
          dbGenerationId,
          'completed',
          resultStorage.url,
          undefined,
          processingTime
        );

        // Verify result image exists in storage (consistent with other services)
        if (resultStorage.storageKey) {
          const resultExists = await this.storageService.fileExists(resultStorage.storageKey);
          
          if (!resultExists) {
            logger.error('❌ Exterior design result not found in storage', {
              storageKey: resultStorage.storageKey
            });
            throw new Error(`Exterior design result not found: ${resultStorage.storageKey}`);
          }
        }

        logger.info('✅ Exterior design generation completed successfully', {
          processingTime,
          resultImageUrl: resultStorage.url,
          designPrompt: req.body.designPrompt,
          generationId: dbGenerationId,
          storageType: resultStorage.storageType,
        });

        // Use storage URLs (consistent with other services)
        const buildingImageUrl = buildingImageStorageResult.url;
        const resultImageUrl = resultStorage.url;

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

  /**
   * Generate smart effects for houses
   */
  public smartEffects = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const startTime = Date.now();
    const tempFiles: string[] = [];
    let generationId: string | undefined;

    try {
      const houseImageFile = req.file;
      
      if (!houseImageFile) {
        res.status(400).json({
          success: false,
          message: 'House image file is required',
          error: 'NO_HOUSE_IMAGE_FILE',
          timestamp: new Date().toISOString(),
        } as ApiResponse);
        return;
      }

      if (!req.body?.effectType) {
        res.status(400).json({
          success: false,
          message: 'Effect type is required for smart effects',
          error: 'MISSING_EFFECT_TYPE',
          timestamp: new Date().toISOString(),
        } as ApiResponse);
        return;
      }

      // Validate effect type
      const validEffectTypes: EffectType[] = ['dusk', 'balloons', 'helicopter', 'gift_bow', 'fireworks', 'confetti', 'holiday_lights', 'snow', 'sunrise'];
      const effectType = req.body.effectType as string;
      if (!validEffectTypes.includes(effectType as EffectType)) {
        res.status(400).json({
          success: false,
          message: `Invalid effect type: ${effectType}. Valid types are: ${validEffectTypes.join(', ')}`,
          error: 'INVALID_EFFECT_TYPE',
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

      logger.info('✨ Starting smart effect generation', {
        houseImageFile: houseImageFile.filename,
        houseImageOriginalName: houseImageFile.originalname,
        houseImageMimetype: houseImageFile.mimetype,
        houseImageSize: houseImageFile.size,
        hasBuffer: !!houseImageFile.buffer,
        bufferSize: houseImageFile.buffer ? houseImageFile.buffer.length : 0,
        effectType: effectType,
        customPrompt: req.body.customPrompt || undefined,
        userId
      });

      // Upload original house image to hybrid storage first
      let houseImageStorageResult;
      let houseImageProcessingPath: string | Buffer = houseImageFile.path; // Default to disk path
      
      if (houseImageFile.buffer) {
        // File is in memory (R2 mode)
        // Ensure filename matches MIME type (fix for HEIC conversion)
        let houseStorageFilename = houseImageFile.originalname;
        if (houseImageFile.mimetype === 'image/webp' && !houseStorageFilename.endsWith('.webp')) {
          houseStorageFilename = houseStorageFilename.replace(/\.[^.]+$/, '.webp');
        }
        
        logger.info('📤 Uploading house image buffer to storage', {
          bufferSize: houseImageFile.buffer.length,
          filename: houseStorageFilename,
          mimetype: houseImageFile.mimetype
        });
        
        houseImageStorageResult = await this.storageService.uploadBuffer(
          houseImageFile.buffer,
          this.storageService.generateKey(houseStorageFilename),
          houseImageFile.mimetype,
          {
            originalName: houseStorageFilename,
            uploadedAt: new Date().toISOString(),
            userId: req.user?.id || 'anonymous',
          }
        );
        
        logger.info('✅ House image uploaded to storage successfully', {
          storageUrl: houseImageStorageResult.url,
          key: houseImageStorageResult.key
        });
        
        // Use buffer directly for processing - no temp file needed
        houseImageProcessingPath = houseImageFile.buffer;
      } else {
        // File is on disk (local mode)
        houseImageStorageResult = await this.storageService.uploadFile(
          houseImageFile.path,
          undefined, // Let storage service generate key
          houseImageFile.mimetype,
          {
            originalName: houseImageFile.originalname,
            uploadedAt: new Date().toISOString(),
            userId: req.user?.id || 'anonymous',
          }
        );
      }

      // Create generation record in database with actual image URL
      const dbGenerationId = await this.userStatsService.createGenerationRecord({
        user_id: userId,
        model_type: 'smart_effects',
        status: 'processing',
        input_image_url: houseImageStorageResult.url,
        prompt: effectType + (req.body.customPrompt ? `: ${req.body.customPrompt}` : '')
      });
      generationId = dbGenerationId;

      logger.info('🚀 Calling smart effects service', {
        processingPathType: typeof houseImageProcessingPath,
        processingPathIsBuffer: Buffer.isBuffer(houseImageProcessingPath),
        processingPathSize: Buffer.isBuffer(houseImageProcessingPath) ? houseImageProcessingPath.length : 'N/A',
        effectType: effectType,
        customPrompt: req.body.customPrompt || undefined
      });

      // Process the smart effect
      const result = await this.smartEffectsService.generateSmartEffect(
        houseImageProcessingPath,
        effectType as EffectType,
        req.body.customPrompt || undefined
      );

      if (result.outputUrl) {
        // Generate filename for the output (consistent with other services)
        const baseFilename = path.parse(houseImageFile.originalname || houseImageFile.filename || 'house_image').name;
        const outputExtension = '.jpg';

        // Download and save processed image to hybrid storage (R2/local) - unified approach
        const resultStorage = await this.replicateService.downloadAndSaveToHybridStorage(
          result.outputUrl,
          `${baseFilename}_effect_${effectType}${outputExtension}`,
          {
            requestId: result.metadata?.requestId,
            userId: req.user?.id || 'anonymous',
            generationId: dbGenerationId,
            originalFile: houseImageFile.originalname || houseImageFile.filename || 'unknown',
            effectType: effectType,
            customPrompt: req.body.customPrompt || undefined,
          }
        );

        const processingTime = Date.now() - startTime;

        // Update generation record with success using R2 URL
        await this.userStatsService.updateGenerationStatus(
          dbGenerationId,
          'completed',
          resultStorage.url,
          undefined,
          processingTime
        );

        // Verify result image exists in storage (consistent with other services)
        if (resultStorage.storageKey) {
          const resultExists = await this.storageService.fileExists(resultStorage.storageKey);
          
          if (!resultExists) {
            logger.error('❌ Smart effect result not found in storage', {
              storageKey: resultStorage.storageKey
            });
            throw new Error(`Smart effect result not found: ${resultStorage.storageKey}`);
          }
        }

        logger.info('✅ Smart effect generation completed successfully', {
          processingTime,
          resultImageUrl: resultStorage.url,
          effectType: req.body.effectType,
          generationId: dbGenerationId,
          storageType: resultStorage.storageType,
        });

        // Use storage URLs (consistent with other services)
        const houseImageUrl = houseImageStorageResult.url;
        const resultImageUrl = resultStorage.url;

        res.json({
          success: true,
          message: 'Smart effect applied successfully',
          data: {
            originalHouseImage: houseImageUrl,
            resultImage: resultImageUrl,
            effectType: effectType,
            customPrompt: req.body.customPrompt || undefined,
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

        logger.error('❌ Smart effect generation failed', {
          error: 'No output URL received from model',
          processingTime: Date.now() - startTime
        });

        res.status(500).json({
          success: false,
          message: 'Smart effect generation failed',
          error: 'NO_OUTPUT_URL',
          timestamp: new Date().toISOString(),
        } as ApiResponse);
      }
    } catch (error) {
      logger.error('🚨 Error in smartEffects:', error as Error);
      
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
        message: 'Internal server error during smart effect generation',
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
   * Generate video motion from an image
   */
  public generateVideoMotion = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const startTime = Date.now();
    const tempFiles: string[] = [];
    let generationId: string | undefined;

    try {
      const { imageUrl, motionType, options } = req.body;

      if (!imageUrl) {
        res.status(400).json({
          success: false,
          message: 'Image URL is required for video generation',
          error: 'MISSING_IMAGE_URL',
          timestamp: new Date().toISOString(),
        } as ApiResponse);
        return;
      }

      if (!motionType || motionType !== 'veo3_fast') {
        res.status(400).json({
          success: false,
          message: 'Only veo3_fast motion type is supported',
          error: 'INVALID_MOTION_TYPE',
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

      logger.info('🎬 Starting video motion generation', {
        imageUrl,
        motionType,
        options,
        userId
      });

      // Create generation record in database first
      const dbGenerationId = await this.userStatsService.createGenerationRecord({
        user_id: userId,
        model_type: `video_${motionType}`,
        status: 'processing',
        input_image_url: imageUrl,
        prompt: options?.prompt || 'Add a impressive ultrarealistic movement to this image'
      });
      generationId = dbGenerationId;

      // Generate video using veo3_fast
      // Pass the URL directly to Replicate (it accepts URLs for images)
      // This avoids unnecessary download/upload cycles
      const result = await this.videoMotionService.generateVideo(
        motionType as VideoMotionType,
        imageUrl, // Pass URL directly - Replicate accepts URLs
        options || {}
      );

      if (result.outputUrl) {
        // Generate filename for the output video
        // Remove model names from filename for compliance
        const baseFilename = path.parse(imageUrl.split('/').pop() || 'image').name;
        const outputExtension = '.mp4';
        
        // Remove any existing model type suffixes from base filename
        const cleanBaseFilename = baseFilename
          .replace(/_veo3_fast$/, '')
          .replace(/_video$/, '');

        // Download and save processed video to hybrid storage (R2/local)
        const resultStorage = await this.replicateService.downloadAndSaveVideoToHybridStorage(
          result.outputUrl,
          `${cleanBaseFilename}_video${outputExtension}`,
          {
            requestId: result.metadata?.requestId,
            userId: req.user?.id || 'anonymous',
            generationId: dbGenerationId,
            originalImageUrl: imageUrl,
            motionType,
            ...options,
          }
        );

        const processingTime = Date.now() - startTime;

        // Update generation record with success using R2 URL
        // Use output_image_url for video URL to keep compatibility
        await this.userStatsService.updateGenerationStatus(
          dbGenerationId,
          'completed',
          resultStorage.url, // Video URL stored in output_image_url field
          undefined,
          processingTime
        );

        // Verify result video exists in storage
        if (resultStorage.storageKey) {
          const resultExists = await this.storageService.fileExists(resultStorage.storageKey);
          
          if (!resultExists) {
            logger.error('❌ Video result not found in storage', {
              storageKey: resultStorage.storageKey
            });
            throw new Error(`Video result not found: ${resultStorage.storageKey}`);
          }
        }

        logger.info('✅ Video motion generation completed successfully', {
          processingTime,
          resultVideoUrl: resultStorage.url,
          motionType,
          generationId: dbGenerationId,
          storageType: resultStorage.storageType,
        });

        res.json({
          success: true,
          message: 'Video generated successfully',
          data: {
            originalImageUrl: imageUrl,
            resultVideoUrl: resultStorage.url,
            motionType,
            options: options || {},
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

        logger.error('❌ Video motion generation failed', {
          error: 'No output URL received from model',
          processingTime: Date.now() - startTime
        });

        res.status(500).json({
          success: false,
          message: 'Video generation failed',
          error: 'NO_OUTPUT_URL',
          timestamp: new Date().toISOString(),
        } as ApiResponse);
      }
    } catch (error) {
      logger.error('🚨 Error in generateVideoMotion:', error as Error);
      
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
        message: 'Internal server error during video generation',
        error: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
        ...(generationId && { data: { generationId } }), // Include generationId if available so frontend can track it
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
   * Convert HEIC file to WebP for preview
   */
  public convertHeic = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          message: 'No image file provided',
          error: 'NO_FILE'
        });
        return;
      }

      logger.info('Converting HEIC file for preview', {
        filename: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      });

      let convertedBuffer: Buffer;

      if (req.file.buffer) {
        // Memory storage - convert buffer directly
        convertedBuffer = await FileUtils.convertHeicBufferToWebP(req.file.buffer);
      } else if (req.file.path) {
        // Disk storage - convert file
        const tempOutputPath = path.join(config.tempDir, `preview_${Date.now()}.webp`);
        await FileUtils.convertHeicToWebP(req.file.path, tempOutputPath);
        convertedBuffer = await fs.promises.readFile(tempOutputPath);
        await fs.promises.unlink(tempOutputPath);
      } else {
        res.status(400).json({
          success: false,
          message: 'Invalid file data',
          error: 'INVALID_FILE'
        });
        return;
      }

      // Set response headers
      res.set({
        'Content-Type': 'image/webp',
        'Content-Length': convertedBuffer.length.toString(),
        'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
      });

      // Send the converted image
      res.send(convertedBuffer);

      logger.info('HEIC conversion successful', {
        originalSize: req.file.size,
        convertedSize: convertedBuffer.length
      });

    } catch (error) {
      logger.error('HEIC conversion failed', {
        error: error instanceof Error ? error.message : String(error),
        filename: req.file?.originalname
      });

      res.status(500).json({
        success: false,
        message: 'HEIC conversion failed',
        error: 'CONVERSION_FAILED'
      });
    }
  };

  /**
   * Proxy image download from R2 to bypass CORS
   * This endpoint allows the frontend to download images without CORS issues
   */
  public proxyImageDownload = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { url } = req.query;

      if (!url || typeof url !== 'string') {
        res.status(400).json({
          success: false,
          message: 'Image URL is required',
          error: 'MISSING_URL',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      logger.info('📥 Proxying image download', { url });

      // Check if it's an R2 URL
      const isR2Url = url.includes('r2.dev') || url.includes(config.r2PublicUrl || '');
      
      if (isR2Url && this.storageService) {
        // Extract key from R2 URL
        const r2PublicUrl = config.r2PublicUrl || '';
        let key = '';
        
        if (url.includes(r2PublicUrl)) {
          key = url.replace(r2PublicUrl + '/', '');
        } else {
          // Try to extract key from full R2 URL
          const urlParts = url.split('/');
          const keyIndex = urlParts.findIndex(part => part.includes('processed') || part.includes('uploads'));
          if (keyIndex >= 0) {
            key = urlParts.slice(keyIndex).join('/');
          } else {
            // Fallback: use last part of URL
            key = urlParts[urlParts.length - 1];
          }
        }

        logger.info('📦 Extracted R2 key', { key, originalUrl: url });

        try {
          // Get file from R2 via HybridStorageService
          // Check if storage service has R2 enabled
          const storageServiceAny = this.storageService as any;
          if (storageServiceAny.useR2 && storageServiceAny.r2Service) {
            const { buffer, contentType } = await storageServiceAny.r2Service.getFileBuffer(key);
            
            // Set CORS headers
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET');
            res.setHeader('Content-Type', contentType);
            res.setHeader('Content-Length', buffer.length);
            res.setHeader('Content-Disposition', `attachment; filename="${key.split('/').pop() || 'image.jpg'}"`);
            
            res.send(buffer);
            return;
          }
        } catch (r2Error) {
          logger.warn('Failed to get from R2, falling back to direct fetch', {
            error: r2Error instanceof Error ? r2Error.message : String(r2Error),
            key
          });
        }
      }

      // Fallback: fetch from URL directly (for local files or if R2 fails)
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const contentType = response.headers.get('content-type') || 'image/jpeg';

        // Set CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET');
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Length', buffer.length);
        res.setHeader('Content-Disposition', `attachment; filename="image-${Date.now()}.jpg"`);

        res.send(buffer);
      } catch (fetchError) {
        logger.error('Failed to proxy image download', {
          error: fetchError instanceof Error ? fetchError.message : String(fetchError),
          url
        });
        res.status(500).json({
          success: false,
          message: 'Failed to download image',
          error: 'DOWNLOAD_FAILED',
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      logger.error('Error in proxyImageDownload', {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: 'INTERNAL_ERROR',
        timestamp: new Date().toISOString(),
      });
    }
  };
} 