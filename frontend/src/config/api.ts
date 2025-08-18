import { ENV_CONFIG } from './environment.selector';

// API Configuration
export const API_CONFIG = {
  // Backend base URL - from environment config
  BASE_URL: ENV_CONFIG.BACKEND_URL,
  
  // API endpoints
  ENDPOINTS: {
    // Image Enhancement
    IMAGE_ENHANCEMENT: '/api/v1/image-enhancement',
    
    // Interior Design
    INTERIOR_DESIGN: '/api/v1/interior-design',
    PROCESS_IMAGE: '/api/v1/process-image',
    
    // Element Replacement
    REPLACE_ELEMENTS: '/api/v1/replace-elements',
    
    // User Management
    USER_STATS: '/api/v1/user/stats',
    USER_GENERATIONS: '/api/v1/user/generations',
    
    // Health and Info
    HEALTH: '/api/v1/health',
    MODEL_INFO: '/api/v1/model-info',
    CONFIG: '/api/v1/config',
  },
  
  // Request timeout (in milliseconds) - from environment config
  TIMEOUT: ENV_CONFIG.API_TIMEOUT,
  
  // File upload limits - from environment config
  MAX_FILE_SIZE: ENV_CONFIG.MAX_FILE_SIZE,
  MAX_FILE_COUNT: ENV_CONFIG.MAX_FILE_COUNT,
  
  // Supported file types
  SUPPORTED_FORMATS: ['image/jpeg', 'image/png', 'image/webp', 'image/heic'],
};

// Helper function to build full API URLs
export const buildApiUrl = (endpoint: string): string => {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
};

// Helper function to get endpoint URL
export const getEndpointUrl = (endpointKey: keyof typeof API_CONFIG.ENDPOINTS): string => {
  return buildApiUrl(API_CONFIG.ENDPOINTS[endpointKey]);
};

// Helper function to get the current backend URL
export const getBackendUrl = (): string => {
  return API_CONFIG.BASE_URL;
};

// Helper function to get current environment info
export const getEnvironmentInfo = () => {
  return {
    backendUrl: API_CONFIG.BASE_URL,
    apiTimeout: API_CONFIG.TIMEOUT,
    maxFileSize: API_CONFIG.MAX_FILE_SIZE,
    maxFileCount: API_CONFIG.MAX_FILE_COUNT,
  };
};
