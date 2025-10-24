import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { FileUploadInfo } from '../types';
import { logger } from './logger';

// Import heic-convert for better HEIC support
let heicConvert: any;
try {
  heicConvert = require('heic-convert');
} catch (error) {
  logger.warn('heic-convert package not available, falling back to Sharp-only conversion');
}

export class FileUtils {
  /**
   * Ensure directory exists, create if it doesn't
   */
  public static async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
      logger.info(`Created directory: ${dirPath}`);
    }
  }

  /**
   * Generate unique filename
   */
  public static generateUniqueFilename(originalName: string): string {
    const ext = path.extname(originalName);
    const name = path.basename(originalName, ext);
    const uuid = uuidv4();
    return `${name}_${uuid}${ext}`;
  }

  /**
   * Convert image to base64 string
   */
  public static async imageToBase64(imagePath: string): Promise<string> {
    try {
      const imageBuffer = await fs.readFile(imagePath);
      const base64 = imageBuffer.toString('base64');
      const mimeType = await this.getMimeType(imagePath);
      return `data:${mimeType};base64,${base64}`;
    } catch (error) {
      logger.error('Failed to convert image to base64', { error, imagePath });
      throw new Error(`Failed to convert image to base64: ${error}`);
    }
  }

  /**
   * Save base64 image to file
   */
  public static async saveBase64Image(
    base64Data: string,
    outputPath: string
  ): Promise<void> {
    try {
      // Remove data:image/...;base64, prefix if present
      const base64String = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
      const imageBuffer = Buffer.from(base64String, 'base64');
      
      await this.ensureDirectoryExists(path.dirname(outputPath));
      await fs.writeFile(outputPath, imageBuffer);
      
      logger.info(`Saved base64 image to: ${outputPath}`);
    } catch (error) {
      logger.error('Failed to save base64 image', { error, outputPath });
      throw new Error(`Failed to save base64 image: ${error}`);
    }
  }

  /**
   * Get image mime type using sharp
   */
  public static async getMimeType(imagePath: string): Promise<string> {
    try {
      const metadata = await sharp(imagePath).metadata();
      const format = metadata.format;
      
      const mimeTypes: Record<string, string> = {
        jpeg: 'image/jpeg',
        jpg: 'image/jpeg',
        png: 'image/png',
        webp: 'image/webp',
        heic: 'image/heic',
        heif: 'image/heif',
        gif: 'image/gif',
        bmp: 'image/bmp',
        tiff: 'image/tiff',
      };
      
      return mimeTypes[format || 'jpeg'] || 'image/jpeg';
    } catch (error) {
      logger.error('Failed to get mime type', { error, imagePath });
      return 'image/jpeg'; // Default fallback
    }
  }

  /**
   * Validate image file
   */
  public static async validateImageFile(filePath: string): Promise<boolean> {
    try {
      const metadata = await sharp(filePath).metadata();
      return !!(metadata.width && metadata.height);
    } catch {
      return false;
    }
  }

  /**
   * Resize image if needed
   */
  public static async resizeImageIfNeeded(
    inputPath: string,
    outputPath: string,
    maxWidth: number = 1024,
    maxHeight: number = 1024
  ): Promise<void> {
    try {
      const image = sharp(inputPath);
      const metadata = await image.metadata();
      
      if (metadata.width! > maxWidth || metadata.height! > maxHeight) {
        await image
          .resize(maxWidth, maxHeight, { fit: 'inside', withoutEnlargement: true })
          .toFile(outputPath);
        
        logger.info(`Resized image from ${metadata.width}x${metadata.height} to fit ${maxWidth}x${maxHeight}`);
      } else {
        // Copy original if no resize needed
        await fs.copyFile(inputPath, outputPath);
        logger.info('Image size is within limits, no resize needed');
      }
    } catch (error) {
      logger.error('Failed to resize image', { error, inputPath, outputPath });
      throw new Error(`Failed to resize image: ${error}`);
    }
  }

  /**
   * Clean up temporary files
   */
  public static async cleanupTempFiles(filePaths: string[]): Promise<void> {
    for (const filePath of filePaths) {
      try {
        await fs.unlink(filePath);
        logger.debug(`Cleaned up temp file: ${filePath}`);
      } catch (error) {
        logger.warn(`Failed to cleanup temp file: ${filePath}`, { error });
      }
    }
  }

  /**
   * Convert HEIC/HEIF files to JPEG format as a fallback option
   * This is more widely supported than WebP and can be used when WebP conversion fails
   */
  public static async convertHeicToJpeg(inputPath: string, outputPath: string): Promise<void> {
    try {
      logger.debug('Attempting HEIC to JPEG conversion with Sharp', { inputPath, outputPath });
      
      // Try direct conversion to JPEG
      await sharp(inputPath)
        .jpeg({ quality: 90 })
        .toFile(outputPath);
      
      logger.info(`Successfully converted HEIC/HEIF to JPEG: ${inputPath} -> ${outputPath}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('HEIC to JPEG conversion failed', { 
        error: errorMessage, 
        inputPath, 
        outputPath,
        stack: error instanceof Error ? error.stack : undefined
      });
      
      throw new Error(`HEIC to JPEG conversion failed: ${inputPath}: ${errorMessage}`);
    }
  }

  /**
   * Convert HEIC/HEIF files to JPEG format using heic-convert plugin
   * This handles HEIC formats that Sharp cannot process
   */
  public static async convertHeicWithPlugin(inputPath: string, outputPath: string): Promise<void> {
    if (!heicConvert) {
      throw new Error('heic-convert plugin not available');
    }

    try {
      logger.debug('Attempting HEIC conversion with heic-convert plugin', { inputPath, outputPath });
      
      // Read the HEIC file
      const inputBuffer = await fs.readFile(inputPath);
      
      // Convert using heic-convert plugin
      const outputBuffer = await heicConvert({
        buffer: inputBuffer,
        format: 'JPEG',
        quality: 0.9
      });
      
      // Write the converted JPEG
      await fs.writeFile(outputPath, outputBuffer);
      
      logger.info(`Successfully converted HEIC/HEIF to JPEG using heic-convert: ${inputPath} -> ${outputPath}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('HEIC to JPEG conversion with plugin failed', { 
        error: errorMessage, 
        inputPath, 
        outputPath 
      });
      throw new Error(`HEIC to JPEG conversion with plugin failed: ${errorMessage}`);
    }
  }

  /**
   * Convert HEIC/HEIF files to WebP format for better AI processing compatibility
   * Enhanced with multiple fallback methods and better error handling
   */
  public static async convertHeicToWebP(inputPath: string, outputPath: string): Promise<void> {
    try {
      logger.debug('Attempting HEIC to WebP conversion with Sharp', { inputPath, outputPath });
      
      // Method 1: Try Sharp with WebP output
      try {
        await sharp(inputPath)
          .webp({ 
            quality: 95,           // Higher quality (90 → 95)
            lossless: false,       // Better compression
            effort: 6,            // Maximum compression effort (0-6)
            smartSubsample: true   // Better color handling
          })
          .toFile(outputPath);
        
        logger.info(`Successfully converted HEIC/HEIF to WebP using Sharp: ${inputPath} -> ${outputPath}`);
        return;
      } catch (sharpError) {
        logger.warn('Sharp WebP conversion failed, trying JPEG fallback', { 
          error: sharpError instanceof Error ? sharpError.message : String(sharpError),
          inputPath,
          outputPath
        });
        
        // Method 2: Try HEIC → JPEG → WebP (more compatible)
        try {
          const tempJpegPath = outputPath.replace('.webp', '_temp.jpg');
          await sharp(inputPath)
            .jpeg({ quality: 95 })
            .toFile(tempJpegPath);
          
          await sharp(tempJpegPath)
            .webp({ 
              quality: 95,           // Higher quality (90 → 95)
              lossless: false,       // Better compression
              effort: 6,            // Maximum compression effort (0-6)
              smartSubsample: true   // Better color handling
            })
            .toFile(outputPath);
          
          // Clean up temp JPEG file
          await this.cleanupTempFiles([tempJpegPath]);
          
          logger.info(`Successfully converted HEIC/HEIF to WebP using JPEG fallback: ${inputPath} -> ${outputPath}`);
          return;
        } catch (jpegFallbackError) {
          logger.warn('JPEG fallback conversion failed, trying PNG fallback', { 
            error: jpegFallbackError instanceof Error ? jpegFallbackError.message : String(jpegFallbackError),
            inputPath,
            outputPath
          });
          
          // Method 3: Try HEIC → PNG → WebP (alternative approach)
          try {
            const tempPngPath = outputPath.replace('.webp', '_temp.png');
            await sharp(inputPath)
              .png()
              .toFile(tempPngPath);
            
            await sharp(tempPngPath)
              .webp({ quality: 90 })
              .toFile(outputPath);
            
            // Clean up temp PNG file
            await this.cleanupTempFiles([tempPngPath]);
            
            logger.info(`Successfully converted HEIC/HEIF to WebP using PNG fallback: ${inputPath} -> ${outputPath}`);
            return;
          } catch (pngFallbackError) {
            logger.error('PNG fallback conversion failed', { 
              error: pngFallbackError instanceof Error ? pngFallbackError.message : String(pngFallbackError),
              inputPath,
              outputPath
            });
            
            // Method 4: Try heic-convert plugin as final fallback
            if (heicConvert) {
              try {
                logger.debug('Trying heic-convert plugin as final fallback', { inputPath, outputPath });
                
                // Convert to JPEG first using the plugin
                const jpegPath = outputPath.replace('.webp', '_plugin.jpg');
                await this.convertHeicWithPlugin(inputPath, jpegPath);
                
                // Then convert JPEG to WebP
                await sharp(jpegPath)
                  .webp({ quality: 90 })
                  .toFile(outputPath);
                
                // Clean up intermediate JPEG
                await this.cleanupTempFiles([jpegPath]);
                
                logger.info(`Successfully converted HEIC/HEIF to WebP using heic-convert plugin: ${inputPath} -> ${outputPath}`);
                return;
              } catch (pluginError) {
                logger.warn('heic-convert plugin fallback also failed', { 
                  error: pluginError instanceof Error ? pluginError.message : String(pluginError), 
                  inputPath, 
                  outputPath 
                });
              }
            }
            
            // All methods failed
            throw new Error(`All HEIC conversion methods failed. Sharp may not have proper HEIC support on this system.`);
          }
        }
      }
    } catch (error) {
      logger.error('All HEIC to WebP conversion methods failed', { 
        error: error instanceof Error ? error.message : String(error),
        inputPath,
        outputPath,
        stack: error instanceof Error ? error.stack : undefined
      });
      
      throw error;
    }
  }

  /**
   * Check if file is HEIC/HEIF format
   */
  public static async isHeicFormat(filePath: string): Promise<boolean> {
    try {
      // Method 1: Try to get metadata using Sharp
      const metadata = await sharp(filePath).metadata();
      // Use type assertion since sharp supports heic/heif but TypeScript types don't include them
      const format = metadata.format as string;
      if (format === 'heic' || format === 'heif') {
        return true;
      }
      
      // Method 2: Check file extension as fallback
      const fileExtension = path.extname(filePath).toLowerCase();
      if (fileExtension === '.heic' || fileExtension === '.heif') {
        logger.debug('HEIC format detected by file extension', { filePath, format });
        return true;
      }
      
      return false;
    } catch (error) {
      // If Sharp fails, fall back to file extension check
      try {
        const fileExtension = path.extname(filePath).toLowerCase();
        if (fileExtension === '.heic' || fileExtension === '.heif') {
          logger.debug('HEIC format detected by file extension (Sharp failed)', { filePath, error });
          return true;
        }
      } catch (extensionError) {
        logger.debug('Failed to check file extension', { filePath, error, extensionError });
      }
      return false;
    }
  }

  /**
   * Get file info
   */
  public static async getFileInfo(filePath: string): Promise<FileUploadInfo> {
    try {
      const stats = await fs.stat(filePath);
      const filename = path.basename(filePath);
      const mimeType = await this.getMimeType(filePath);
      
      return {
        originalName: filename,
        filename,
        path: filePath,
        size: stats.size,
        mimetype: mimeType,
        uploadTime: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Failed to get file info', { error, filePath });
      throw new Error(`Failed to get file info: ${error}`);
    }
  }

  /**
   * Read file as buffer
   */
  public static async readFileAsBuffer(filePath: string): Promise<Buffer> {
    try {
      const buffer = await fs.readFile(filePath);
      logger.debug(`Read file as buffer: ${filePath}`);
      return buffer;
    } catch (error) {
      logger.error('Failed to read file as buffer', { error, filePath });
      throw new Error(`Failed to read file as buffer: ${error}`);
    }
  }

  /**
   * Download image from URL and save to local directory
   */
  public static async downloadImage(imageUrl: string, outputDir: string): Promise<string> {
    try {
      logger.info('📥 Starting image download', { imageUrl, outputDir });
      
      // Ensure output directory exists
      await this.ensureDirectoryExists(outputDir);
      
      // Generate unique filename
      const urlParts = imageUrl.split('/');
      const originalName = urlParts[urlParts.length - 1] || 'downloaded_image.jpg';
      const filename = this.generateUniqueFilename(originalName);
      const outputPath = path.join(outputDir, filename);
      
      logger.info('📁 Download details', { 
        originalName, 
        filename, 
        outputPath 
      });
      
      // Download the image
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      logger.info('📊 Download completed', { 
        size: buffer.length, 
        contentType: response.headers.get('content-type') 
      });
      
      // Save to file
      await fs.writeFile(outputPath, buffer);
      
      // Verify file was saved correctly
      const savedStats = await fs.stat(outputPath);
      if (savedStats.size === 0) {
        throw new Error('Downloaded file is empty');
      }
      
      logger.info('✅ Image downloaded and saved successfully', { 
        imageUrl, 
        outputPath, 
        fileSize: savedStats.size 
      });
      
      return outputPath;
    } catch (error) {
      logger.error('❌ Failed to download image', { 
        error: error instanceof Error ? error.message : String(error),
        imageUrl, 
        outputDir 
      });
      throw new Error(`Failed to download image: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Convert HEIC buffer to WebP buffer for preview
   */
  public static async convertHeicBufferToWebP(inputBuffer: Buffer): Promise<Buffer> {
    try {
      logger.debug('Converting HEIC buffer to WebP buffer', { 
        inputSize: inputBuffer.length 
      });
      
      // Method 1: Try Sharp with WebP output
      try {
        const sharp = require('sharp');
        const webpBuffer = await sharp(inputBuffer)
          .webp({ 
            quality: 95,           // Higher quality
            lossless: false,       // Better compression
            effort: 6,            // Maximum compression effort (0-6)
            smartSubsample: true   // Better color handling
          })
          .toBuffer();
        
        logger.info('Successfully converted HEIC buffer to WebP using Sharp', { 
          inputSize: inputBuffer.length,
          outputSize: webpBuffer.length
        });
        return webpBuffer;
      } catch (sharpError) {
        logger.warn('Sharp WebP conversion failed, trying JPEG fallback', { 
          error: sharpError instanceof Error ? sharpError.message : String(sharpError)
        });
        
        // Method 2: Try HEIC → JPEG → WebP (more compatible)
        try {
          const sharp = require('sharp');
          const jpegBuffer = await sharp(inputBuffer)
            .jpeg({ quality: 95 })
            .toBuffer();
          
          const webpBuffer = await sharp(jpegBuffer)
            .webp({ 
              quality: 95,           // Higher quality
              lossless: false,       // Better compression
              effort: 6,            // Maximum compression effort (0-6)
              smartSubsample: true   // Better color handling
            })
            .toBuffer();
          
          logger.info('Successfully converted HEIC buffer to WebP using JPEG fallback', { 
            inputSize: inputBuffer.length,
            outputSize: webpBuffer.length
          });
          return webpBuffer;
        } catch (jpegFallbackError) {
          logger.warn('JPEG fallback conversion failed, trying heic-convert', { 
            error: jpegFallbackError instanceof Error ? jpegFallbackError.message : String(jpegFallbackError)
          });
          
          // Method 3: Try heic-convert plugin
          try {
            const heicConvert = require('heic-convert');
            const jpegBuffer = await heicConvert({
              buffer: inputBuffer,
              format: 'JPEG',
              quality: 0.95
            });
            
            const sharp = require('sharp');
            const webpBuffer = await sharp(jpegBuffer)
              .webp({ 
                quality: 95,           // Higher quality
                lossless: false,       // Better compression
                effort: 6,            // Maximum compression effort (0-6)
                smartSubsample: true   // Better color handling
              })
              .toBuffer();
            
            logger.info('Successfully converted HEIC buffer to WebP using heic-convert', { 
              inputSize: inputBuffer.length,
              outputSize: webpBuffer.length
            });
            return webpBuffer;
          } catch (heicConvertError) {
            logger.error('All HEIC conversion methods failed', { 
              sharpError: sharpError instanceof Error ? sharpError.message : String(sharpError),
              jpegFallbackError: jpegFallbackError instanceof Error ? jpegFallbackError.message : String(jpegFallbackError),
              heicConvertError: heicConvertError instanceof Error ? heicConvertError.message : String(heicConvertError)
            });
            throw new Error(`All HEIC conversion methods failed. Last error: ${heicConvertError instanceof Error ? heicConvertError.message : String(heicConvertError)}`);
          }
        }
      }
    } catch (error) {
      logger.error('Failed to convert HEIC buffer to WebP', { 
        error: error instanceof Error ? error.message : String(error),
        inputSize: inputBuffer.length
      });
      throw error;
    }
  }
} 