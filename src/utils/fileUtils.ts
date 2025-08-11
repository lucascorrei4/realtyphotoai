import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { FileUploadInfo } from '../types';
import { logger } from './logger';

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
} 