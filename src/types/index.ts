export interface ProcessImageRequest {
  style?: string;
  prompt?: string;
  negativePrompt?: string;
  guidance?: number;
  steps?: number;
  strength?: number;
  // ControlNet options
  useControlNet?: boolean;
  controlNetType?: 'canny' | 'depth' | 'pose' | 'segmentation';
  controlNetStrength?: number;
  // Quality presets
  qualityPreset?: 'fast' | 'balanced' | 'high' | 'ultra';
}

export interface ProcessImageResponse {
  success: boolean;
  message: string;
  originalImage: string;
  processedImage?: string;
  processingTime: number;
  timestamp: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface AppConfig {
  port: number;
  nodeEnv: string;
  appName: string;
  appVersion: string;
  apiPrefix: string;
  maxFileSize: number;
  allowedFileTypes: string[];
  replicateApiToken: string;
  stableDiffusionModel: string;
  defaultPrompt: string;
  defaultNegativePrompt: string;
  useControlNet: boolean;
  controlNetModel: string;
  enableInpaintingWorkflow: boolean;
  controlNetStrength: number;
  structurePreservationStrength: number;
  defaultTransformationStrength: number;
  apiKey?: string | undefined;
  corsOrigins: string[];
  logLevel: string;
  logFormat: string;
  uploadDir: string;
  outputDir: string;
  tempDir: string;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  n8nWebhookUrl: string;
  // R2 Configuration
  r2AccountId: string;
  r2AccessKeyId: string;
  r2SecretAccessKey: string;
  r2BucketName: string;
  r2PublicUrl: string;
  useR2Storage: boolean;
}

export interface ReplicateInput {
  image?: string;
  prompt: string;
  negative_prompt?: string;
  num_inference_steps?: number;
  guidance_scale?: number;
  prompt_strength?: number; // Interior design model uses prompt_strength
  strength?: number; // FLUX models use strength
  seed?: number;
  // ControlNet support - Standard SD ControlNet
  control_image?: string;
  controlnet_conditioning_scale?: number;
  control_guidance_start?: number;
  control_guidance_end?: number;
  // FLUX ControlNet specific
  control_strength?: number;
  control_type?: string;
  output_format?: string;
  output_quality?: number;
  apply_watermark?: boolean;
  width?: number;
  height?: number;
  // Quality settings
  scheduler?: string;
  safety_checker?: boolean;
}

export interface FileUploadInfo {
  originalName: string;
  filename: string;
  path: string;
  size: number;
  mimetype: string;
  uploadTime: string;
}

export interface ProcessingMetadata {
  requestId: string;
  userId?: string;
  processingStartTime: number;
  processingEndTime?: number;
  modelUsed: string;
  parametersUsed: ReplicateInput;
}

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
}

export interface CustomError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export interface ControlNetOptions {
  type: 'canny' | 'depth' | 'pose' | 'segmentation';
  strength: number;
  startStep: number;
  endStep: number;
  model: string;
}

export interface QualityPreset {
  name: string;
  steps: number;
  guidance: number;
  strength: number;
  scheduler: string;
  description: string;
} 