// Production Environment Configuration
// This file contains production-specific settings

export const ENV_CONFIG = {
  // Backend Configuration
  BACKEND_URL: process.env.REACT_APP_API_BASE_URL || 'https://api.realvisionai.com', // Production backend URL
  
  // API Configuration
  API_TIMEOUT: 600000, // 10 minutes in milliseconds (longer for production)
  MAX_FILE_SIZE: 20 * 1024 * 1024, // 20MB for production
  MAX_FILE_COUNT: 50, // More files for production
  
  // Production Configuration
  ENVIRONMENT: 'production',
  DEBUG_MODE: false, // Disable debug in production
  
  // Feature Flags
  ENABLE_LOGGING: false, // Disable console logging in production
  ENABLE_ANALYTICS: true, // Enable analytics in production
  ENABLE_ERROR_TRACKING: true, // Enable error tracking in production
  ENABLE_PERFORMANCE_MONITORING: true, // Enable performance monitoring
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

// Helper function to check if analytics is enabled
export const isAnalyticsEnabled = (): boolean => {
  return ENV_CONFIG.ENABLE_ANALYTICS;
};

// Helper function to check if error tracking is enabled
export const isErrorTrackingEnabled = (): boolean => {
  return ENV_CONFIG.ENABLE_ERROR_TRACKING;
};

// Helper function to check if performance monitoring is enabled
export const isPerformanceMonitoringEnabled = (): boolean => {
  return ENV_CONFIG.ENABLE_PERFORMANCE_MONITORING;
};
