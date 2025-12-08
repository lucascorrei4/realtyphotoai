import { R2Service, R2Config } from './r2Service';
import { config } from '../config';
import { logger } from '../utils/logger';
import { FileUtils } from '../utils/fileUtils';
import path from 'path';
import { promises as fs } from 'fs';

export interface StorageResult {
  key: string;
  url: string;
  size: number;
  contentType: string;
  storageType: 'local' | 'r2';
}

export class HybridStorageService {
  private r2Service?: R2Service;
  private useR2: boolean;

  constructor() {
    this.useR2 = config.useR2Storage && this.validateR2Config();
    
    if (this.useR2) {
      const r2Config: R2Config = {
        accountId: config.r2AccountId,
        accessKeyId: config.r2AccessKeyId,
        secretAccessKey: config.r2SecretAccessKey,
        bucketName: config.r2BucketName,
        publicUrl: config.r2PublicUrl,
      };
      
      this.r2Service = new R2Service(r2Config);
    } else {
      logger.error('HybridStorageService initialized with local storage only');
    }
  }

  /**
   * Upload a file to storage (R2 or local)
   */
  public async uploadFile(
    filePath: string,
    key?: string,
    contentType?: string,
    metadata?: Record<string, string>
  ): Promise<StorageResult> {
    try {
      const finalKey = key || this.generateKey(path.basename(filePath));
      
      if (this.useR2 && this.r2Service) {
        logger.info('Uploading to R2', { filePath, key: finalKey });
        
        const result = await this.r2Service.uploadFile(filePath, finalKey, contentType, metadata);
        
        return {
          key: result.key,
          url: result.url,
          size: result.size,
          contentType: result.contentType,
          storageType: 'r2',
        };
      } else {
        logger.info('Uploading to local storage', { filePath, key: finalKey });
        
        // Copy file to local storage
        const localPath = path.join(config.uploadDir, finalKey);
        await FileUtils.ensureDirectoryExists(path.dirname(localPath));
        await fs.copyFile(filePath, localPath);
        
        const stats = await fs.stat(localPath);
        
        return {
          key: finalKey,
          url: `/uploads/${finalKey}`,
          size: stats.size,
          contentType: contentType || this.getContentTypeFromExtension(finalKey),
          storageType: 'local',
        };
      }
    } catch (error) {
      logger.error('File upload failed', {
        error: error instanceof Error ? error.message : String(error),
        filePath,
        key,
        useR2: this.useR2,
      });
      throw error;
    }
  }

  /**
   * Upload buffer directly to storage
   */
  public async uploadBuffer(
    buffer: Buffer,
    key: string,
    contentType?: string,
    metadata?: Record<string, string>
  ): Promise<StorageResult> {
    try {
      if (this.useR2 && this.r2Service) {
        logger.info('Uploading buffer to R2', { key, size: buffer.length });
        
        const result = await this.r2Service.uploadBuffer(buffer, key, contentType, metadata);
        
        return {
          key: result.key,
          url: result.url,
          size: result.size,
          contentType: result.contentType,
          storageType: 'r2',
        };
      } else {
        logger.info('Uploading buffer to local storage', { key, size: buffer.length });
        
        const localPath = path.join(config.uploadDir, key);
        await FileUtils.ensureDirectoryExists(path.dirname(localPath));
        await fs.writeFile(localPath, buffer);
        
        return {
          key,
          url: `/uploads/${key}`,
          size: buffer.length,
          contentType: contentType || this.getContentTypeFromExtension(key),
          storageType: 'local',
        };
      }
    } catch (error) {
      logger.error('Buffer upload failed', {
        error: error instanceof Error ? error.message : String(error),
        key,
        useR2: this.useR2,
      });
      throw error;
    }
  }

  /**
   * Download a file from storage
   */
  public async downloadFile(key: string, outputPath: string): Promise<void> {
    try {
      if (this.useR2 && this.r2Service) {
        logger.info('Downloading from R2', { key, outputPath });
        await this.r2Service.downloadFile(key, outputPath);
      } else {
        logger.info('Downloading from local storage', { key, outputPath });
        
        const localPath = path.join(config.uploadDir, key);
        await FileUtils.ensureDirectoryExists(path.dirname(outputPath));
        await fs.copyFile(localPath, outputPath);
      }
    } catch (error) {
      logger.error('File download failed', {
        error: error instanceof Error ? error.message : String(error),
        key,
        outputPath,
        useR2: this.useR2,
      });
      throw error;
    }
  }

  /**
   * Delete a file from storage
   */
  public async deleteFile(key: string): Promise<void> {
    try {
      if (this.useR2 && this.r2Service) {
        logger.info('Deleting from R2', { key });
        await this.r2Service.deleteFile(key);
      } else {
        logger.info('Deleting from local storage', { key });
        
        const localPath = path.join(config.uploadDir, key);
        await fs.unlink(localPath);
      }
    } catch (error) {
      logger.error('File deletion failed', {
        error: error instanceof Error ? error.message : String(error),
        key,
        useR2: this.useR2,
      });
      throw error;
    }
  }

  /**
   * Check if a file exists in storage
   */
  public async fileExists(key: string): Promise<boolean> {
    try {
      if (this.useR2 && this.r2Service) {
        return await this.r2Service.fileExists(key);
      } else {
        const localPath = path.join(config.uploadDir, key);
        try {
          await fs.access(localPath);
          return true;
        } catch {
          return false;
        }
      }
    } catch (error) {
      logger.error('File exists check failed', {
        error: error instanceof Error ? error.message : String(error),
        key,
        useR2: this.useR2,
      });
      throw error;
    }
  }

  /**
   * Get public URL for a file
   */
  public getPublicUrl(key: string): string {
    if (this.useR2 && this.r2Service) {
      // For R2, we need to construct the public URL
      if (config.r2PublicUrl) {
        return `${config.r2PublicUrl}/${key}`;
      }
      // Fallback to signed URL (not ideal for public access)
      logger.warn('No R2 public URL configured, using local fallback', { key });
      return `/uploads/${key}`;
    } else {
      return `/uploads/${key}`;
    }
  }

  /**
   * Generate a unique key for uploaded files
   */
  public generateKey(originalName: string, prefix?: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const extension = path.extname(originalName);
    const baseName = path.basename(originalName, extension);
    
    return `${prefix || 'uploads'}/${timestamp}_${random}_${baseName}${extension}`;
  }

  /**
   * Generate a key for processed images
   */
  public generateProcessedKey(originalKey: string, suffix?: string): string {
    const parsed = path.parse(originalKey);
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    
    return `processed/${parsed.name}_${suffix || 'processed'}_${timestamp}_${random}${parsed.ext}`;
  }

  /**
   * Get storage type being used
   */
  public getStorageType(): 'local' | 'r2' {
    return this.useR2 ? 'r2' : 'local';
  }

  /**
   * Check if R2 is enabled and configured
   */
  public isR2Enabled(): boolean {
    return this.useR2;
  }

  /**
   * Validate R2 configuration
   */
  private validateR2Config(): boolean {
    const required = [
      config.r2AccountId,
      config.r2AccessKeyId,
      config.r2SecretAccessKey,
      config.r2BucketName,
    ];

    const isValid = required.every(value => value && value.trim() !== '');
    
    if (!isValid) {
      logger.warn('R2 configuration incomplete, falling back to local storage', {
        hasAccountId: !!config.r2AccountId,
        hasAccessKey: !!config.r2AccessKeyId,
        hasSecretKey: !!config.r2SecretAccessKey,
        hasBucketName: !!config.r2BucketName,
      });
    }

    return isValid;
  }

  /**
   * Determine content type from file extension
   */
  private getContentTypeFromExtension(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    
    const contentTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.bmp': 'image/bmp',
      '.tiff': 'image/tiff',
      '.heic': 'image/heic',
      '.heif': 'image/heif',
    };

    return contentTypes[ext] || 'application/octet-stream';
  }
}
