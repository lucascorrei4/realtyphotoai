import sharp from 'sharp';
import { logger } from './logger';

export class MaskingUtils {
  /**
   * Generate a mask to preserve architectural elements (walls, windows, doors, built-ins)
   * This is a simplified implementation - in production, you'd use ML models for semantic segmentation
   */
  static async generateArchitecturalMask(imagePath: string): Promise<Buffer> {
    try {
      logger.info('Generating architectural preservation mask', { imagePath });
      
      const image = sharp(imagePath);
      const { width, height } = await image.metadata();
      
      if (!width || !height) {
        throw new Error('Unable to get image dimensions for masking');
      }

      // Create a basic mask that preserves edges (architectural elements)
      // In production, replace this with ML-based semantic segmentation
      const maskBuffer = await image
        .greyscale()
        // Detect edges using a simple gradient method
        .convolve({
          width: 3,
          height: 3,
          kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1], // Edge detection kernel
        })
        .threshold(30) // Adjust threshold to preserve architectural features
        .blur(2) // Smooth the mask
        .png()
        .toBuffer();

      logger.info('Architectural mask generated successfully');
      return maskBuffer;

    } catch (error) {
      logger.error('Failed to generate architectural mask', { error, imagePath });
      throw new Error(`Mask generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Create an inpainting mask for specific areas to be modified
   * White areas = modify, Black areas = preserve
   */
  static async generateInpaintingMask(
    imagePath: string,
    preserveWalls: boolean = true,
    preserveWindows: boolean = true,
    preserveBuiltIns: boolean = true
  ): Promise<Buffer> {
    try {
      logger.info('Generating inpainting mask', { 
        imagePath, 
        preserveWalls, 
        preserveWindows, 
        preserveBuiltIns 
      });

      const image = sharp(imagePath);
      const { width, height } = await image.metadata();
      
      if (!width || !height) {
        throw new Error('Unable to get image dimensions for inpainting mask');
      }

      // Create a white canvas (everything modifiable by default)
      let mask = sharp({
        create: {
          width,
          height,
          channels: 3,
          background: { r: 255, g: 255, b: 255 } // White = modify
        }
      });

      if (preserveWalls || preserveWindows || preserveBuiltIns) {
        // Detect structural elements using edge detection
        const structuralMask = await image
          .greyscale()
          .convolve({
            width: 3,
            height: 3,
            kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1],
          })
          .threshold(25)
          .png()
          .toBuffer();

        // Combine with the base mask
        mask = mask.composite([{
          input: structuralMask,
          blend: 'multiply' // Black areas from structural mask will preserve
        }]);
      }

      const result = await mask.png().toBuffer();
      logger.info('Inpainting mask generated successfully');
      return result;

    } catch (error) {
      logger.error('Failed to generate inpainting mask', { error, imagePath });
      throw new Error(`Inpainting mask generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Apply mask to preserve specific image areas during processing
   */
  static async applyPreservationMask(
    originalImagePath: string,
    processedImageBuffer: Buffer,
    maskBuffer: Buffer
  ): Promise<Buffer> {
    try {
      logger.info('Applying preservation mask');

      const original = sharp(originalImagePath);
      const processed = sharp(processedImageBuffer);
      
      // Use the maskBuffer to composite the images
      const mask = sharp(maskBuffer);
      
      // Composite original and processed images using the mask
      const result = await processed
        .composite([
          {
            input: await original.png().toBuffer(),
            blend: 'over'
          },
          {
            input: await mask.png().toBuffer(),
            blend: 'multiply'
          }
        ])
        .png()
        .toBuffer();

      logger.info('Preservation mask applied successfully');
      return result;

    } catch (error) {
      logger.error('Failed to apply preservation mask', { error });
      throw new Error(`Mask application failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Create a floor-only mask for furniture placement
   * This helps focus decoration on appropriate areas
   */
  static async generateFloorMask(imagePath: string): Promise<Buffer> {
    try {
      logger.info('Generating floor area mask', { imagePath });

      const image = sharp(imagePath);
      const { width, height } = await image.metadata();
      
      if (!width || !height) {
        throw new Error('Unable to get image dimensions for floor mask');
      }

      // Simple heuristic: floor is typically in lower 2/3 of image and has horizontal lines
      const floorMask = await image
        .extract({ 
          left: 0, 
          top: Math.floor(height * 0.3), // Focus on lower 70% of image
          width, 
          height: Math.floor(height * 0.7) 
        })
        .greyscale()
        .blur(1)
        .threshold(128)
        .extend({
          top: Math.floor(height * 0.3),
          bottom: 0,
          left: 0,
          right: 0,
          background: { r: 0, g: 0, b: 0 } // Black for non-floor areas
        })
        .png()
        .toBuffer();

      logger.info('Floor mask generated successfully');
      return floorMask;

    } catch (error) {
      logger.error('Failed to generate floor mask', { error, imagePath });
      throw new Error(`Floor mask generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
} 