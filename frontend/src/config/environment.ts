// Environment Configuration
// Update this file to change backend URL and other settings

export const ENV_CONFIG = {
  // Backend Configuration
  BACKEND_URL: process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000', // Development backend URL
  
  // API Configuration
  API_TIMEOUT: 300000, // 5 minutes in milliseconds
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_FILE_COUNT: 20,
  
  // Development Configuration
  ENVIRONMENT: 'development',
  DEBUG_MODE: true,
  
  // Feature Flags
  ENABLE_LOGGING: true,
  ENABLE_ANALYTICS: false,
};

// Helper function to get backend URL
export const getBackendUrl = (): string => {
  return ENV_CONFIG.BACKEND_URL;
};

// Helper function to get API timeout
export const getApiTimeout = (): number => {
  return ENV_CONFIG.API_TIMEOUT;
};

// Helper function to check if debug mode is enabled
export const isDebugMode = (): boolean => {
  return ENV_CONFIG.DEBUG_MODE;
};
