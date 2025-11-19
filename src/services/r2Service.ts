import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { logger } from '../utils/logger';
import { Readable } from 'stream';
import { promises as fs } from 'fs';
import path from 'path';

export interface R2UploadResult {
  key: string;
  url: string;
  size: number;
  contentType: string;
}

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl?: string;
}

export class R2Service {
  private s3Client: S3Client;
  private bucketName: string;
  private publicUrl?: string;

  constructor(r2Config: R2Config) {
    this.bucketName = r2Config.bucketName;
    if (r2Config.publicUrl) {
      this.publicUrl = r2Config.publicUrl;
    }

    // Initialize S3 client for R2
    this.s3Client = new S3Client({
      region: 'auto', // R2 uses 'auto' region
      endpoint: `https://${r2Config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: r2Config.accessKeyId,
        secretAccessKey: r2Config.secretAccessKey,
      },
    });

    logger.info('R2Service initialized', {
      bucketName: this.bucketName,
      endpoint: `https://${r2Config.accountId}.r2.cloudflarestorage.com`,
      hasPublicUrl: !!this.publicUrl,
    });
  }

  /**
   * Upload a file to R2
   */
  public async uploadFile(
    filePath: string,
    key: string,
    contentType?: string,
    metadata?: Record<string, string>
  ): Promise<R2UploadResult> {
    try {
      logger.info('Starting R2 upload', { filePath, key, contentType });

      // Read file
      const fileBuffer = await fs.readFile(filePath);
      
      // Determine content type if not provided
      const finalContentType = contentType || this.getContentTypeFromExtension(key);

      // Sanitize metadata - AWS SDK requires all metadata values to be strings
      const sanitizedMetadata: Record<string, string> | undefined = metadata
        ? Object.entries(metadata).reduce((acc, [key, value]) => {
            // Only include metadata with string values
            // Skip undefined, null, and non-string values
            if (value !== undefined && value !== null) {
              // Convert to string: handle objects/arrays by stringifying, numbers/bools to string
              const stringValue = typeof value === 'object' 
                ? JSON.stringify(value) 
                : String(value);
              acc[key] = stringValue;
            }
            return acc;
          }, {} as Record<string, string>)
        : undefined;

      // Upload to R2
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: fileBuffer,
        ContentType: finalContentType,
        ...(sanitizedMetadata && Object.keys(sanitizedMetadata).length > 0 && { Metadata: sanitizedMetadata }),
      });

      const result = await this.s3Client.send(command);
      
      logger.info('R2 upload completed', {
        key,
        contentType: finalContentType,
        size: fileBuffer.length,
        etag: result.ETag,
      });

      return {
        key,
        url: this.getPublicUrl(key),
        size: fileBuffer.length,
        contentType: finalContentType,
      };

    } catch (error) {
      logger.error('R2 upload failed', {
        error: error instanceof Error ? error.message : String(error),
        filePath,
        key,
      });
      throw new Error(`R2 upload failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Upload buffer directly to R2
   */
  public async uploadBuffer(
    buffer: Buffer,
    key: string,
    contentType?: string,
    metadata?: Record<string, string>
  ): Promise<R2UploadResult> {
    try {
      logger.info('Starting R2 buffer upload', { key, contentType, size: buffer.length });

      const finalContentType = contentType || this.getContentTypeFromExtension(key);

      // Sanitize metadata - AWS SDK requires all metadata values to be strings
      const sanitizedMetadata: Record<string, string> | undefined = metadata
        ? Object.entries(metadata).reduce((acc, [key, value]) => {
            // Only include metadata with string values
            // Skip undefined, null, and non-string values
            if (value !== undefined && value !== null) {
              // Convert to string: handle objects/arrays by stringifying, numbers/bools to string
              const stringValue = typeof value === 'object' 
                ? JSON.stringify(value) 
                : String(value);
              acc[key] = stringValue;
            }
            return acc;
          }, {} as Record<string, string>)
        : undefined;

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: finalContentType,
        ...(sanitizedMetadata && Object.keys(sanitizedMetadata).length > 0 && { Metadata: sanitizedMetadata }),
      });

      const result = await this.s3Client.send(command);
      
      logger.info('R2 buffer upload completed', {
        key,
        contentType: finalContentType,
        size: buffer.length,
        etag: result.ETag,
      });

      return {
        key,
        url: this.getPublicUrl(key),
        size: buffer.length,
        contentType: finalContentType,
      };

    } catch (error) {
      logger.error('R2 buffer upload failed', {
        error: error instanceof Error ? error.message : String(error),
        key,
      });
      throw new Error(`R2 buffer upload failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Download a file from R2
   */
  public async downloadFile(key: string, outputPath: string): Promise<void> {
    try {
      logger.info('Starting R2 download', { key, outputPath });

      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const result = await this.s3Client.send(command);
      
      if (!result.Body) {
        throw new Error('No body returned from R2');
      }

      // Convert stream to buffer
      const chunks: Uint8Array[] = [];
      const stream = result.Body as Readable;
      
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      
      const buffer = Buffer.concat(chunks);
      
      // Ensure output directory exists
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      
      // Write file
      await fs.writeFile(outputPath, buffer);
      
      logger.info('R2 download completed', {
        key,
        outputPath,
        size: buffer.length,
      });

    } catch (error) {
      logger.error('R2 download failed', {
        error: error instanceof Error ? error.message : String(error),
        key,
        outputPath,
      });
      throw new Error(`R2 download failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get a file buffer from R2 (for proxying/serving)
   */
  public async getFileBuffer(key: string): Promise<{ buffer: Buffer; contentType: string }> {
    try {
      logger.info('Getting file buffer from R2', { key });

      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const result = await this.s3Client.send(command);
      
      if (!result.Body) {
        throw new Error('No body returned from R2');
      }

      // Convert stream to buffer
      const chunks: Uint8Array[] = [];
      const stream = result.Body as Readable;
      
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      
      const buffer = Buffer.concat(chunks);
      const contentType = result.ContentType || this.getContentTypeFromExtension(key);

      logger.info('File buffer retrieved from R2', {
        key,
        size: buffer.length,
        contentType,
      });

      return { buffer, contentType };

    } catch (error) {
      logger.error('Failed to get file buffer from R2', {
        error: error instanceof Error ? error.message : String(error),
        key,
      });
      throw new Error(`Failed to get file buffer: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get a signed URL for private access
   */
  public async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const signedUrl = await getSignedUrl(this.s3Client, command, { expiresIn });
      
      logger.debug('Generated signed URL', { key, expiresIn });
      
      return signedUrl;

    } catch (error) {
      logger.error('Failed to generate signed URL', {
        error: error instanceof Error ? error.message : String(error),
        key,
      });
      throw new Error(`Failed to generate signed URL: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Delete a file from R2
   */
  public async deleteFile(key: string): Promise<void> {
    try {
      logger.info('Starting R2 delete', { key });

      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      
      logger.info('R2 delete completed', { key });

    } catch (error) {
      logger.error('R2 delete failed', {
        error: error instanceof Error ? error.message : String(error),
        key,
      });
      throw new Error(`R2 delete failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check if a file exists in R2
   */
  public async fileExists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      return true;

    } catch (error) {
      // If the error is 404, the file doesn't exist
      if (error && typeof error === 'object' && 'name' in error && error.name === 'NotFound') {
        return false;
      }
      
      logger.error('R2 file exists check failed', {
        error: error instanceof Error ? error.message : String(error),
        key,
      });
      throw new Error(`R2 file exists check failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get public URL for a file
   */
  private getPublicUrl(key: string): string {
    if (this.publicUrl) {
      return `${this.publicUrl}/${key}`;
    }
    
    // Fallback to signed URL (not ideal for public access)
    logger.warn('No public URL configured, using signed URL fallback', { key });
    return `r2://${this.bucketName}/${key}`;
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

  /**
   * Generate a unique key for uploaded files
   */
  public generateKey(originalName: string, prefix?: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const extension = path.extname(originalName);
    const baseName = path.basename(originalName, extension);
    
    const key = `${prefix || 'uploads'}/${timestamp}_${random}_${baseName}${extension}`;
    
    logger.debug('Generated R2 key', { originalName, key });
    
    return key;
  }

  /**
   * Generate a key for processed images
   */
  public generateProcessedKey(originalKey: string, suffix?: string): string {
    const parsed = path.parse(originalKey);
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    
    const key = `processed/${parsed.name}_${suffix || 'processed'}_${timestamp}_${random}${parsed.ext}`;
    
    logger.debug('Generated processed R2 key', { originalKey, key });
    
    return key;
  }
}
