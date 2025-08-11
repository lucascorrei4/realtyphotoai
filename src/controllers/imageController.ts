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
    let tempFiles: string[] = [];
    
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
      await FileUtils.resizeImageIfNeeded(req.file.path, resizedImagePath, 1024, 1024);
      tempFiles.push(resizedImagePath);

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
      message: 'Real Estate Photo AI Backend is running!',
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
        },
        features: {
          controlNet: 'Enhanced structure preservation using ControlNet',
          qualityPresets: 'Multiple quality levels (fast, balanced, high, ultra)',
          interiorDesign: 'Specialized model for interior design and furniture placement',
        juggernautWorkflow: 'Latest Juggernaut XL with two-pass depth + inpainting workflow for photorealistic results',
          smartPrompting: 'Optimized prompts for real estate photography'
        }
      },
      timestamp: new Date().toISOString(),
    } as ApiResponse);
  };
} 