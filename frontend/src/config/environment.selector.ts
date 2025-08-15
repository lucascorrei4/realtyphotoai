// Environment Selector
// This file automatically selects the appropriate environment configuration

import { ENV_CONFIG as DEV_CONFIG } from './environment';
import { ENV_CONFIG as PROD_CONFIG } from './environment.prod';

// Determine the current environment
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

// Select the appropriate configuration
export const ENV_CONFIG = isProduction ? PROD_CONFIG : DEV_CONFIG;

// Export the selected configuration
export * from './environment';

// Helper function to get the current environment name
export const getCurrentEnvironment = (): string => {
  return ENV_CONFIG.ENVIRONMENT;
};

// Helper function to check if we're in production
export const isProductionEnvironment = (): boolean => {
  return isProduction;
};

// Helper function to check if we're in development
export const isDevelopmentEnvironment = (): boolean => {
  return isDevelopment;
};

// Helper function to get environment-specific configuration
export const getEnvironmentConfig = () => {
  return {
    isProduction,
    isDevelopment,
    environment: ENV_CONFIG.ENVIRONMENT,
    backendUrl: ENV_CONFIG.BACKEND_URL,
    apiTimeout: ENV_CONFIG.API_TIMEOUT,
    maxFileSize: ENV_CONFIG.MAX_FILE_SIZE,
    maxFileCount: ENV_CONFIG.MAX_FILE_COUNT,
    debugMode: ENV_CONFIG.DEBUG_MODE,
    enableLogging: ENV_CONFIG.ENABLE_LOGGING,
    enableAnalytics: ENV_CONFIG.ENABLE_ANALYTICS,
  };
};

// Log the current environment configuration (only in development)
if (isDevelopment) {
  console.log('🌍 Environment Configuration:', {
    environment: ENV_CONFIG.ENVIRONMENT,
    backendUrl: ENV_CONFIG.BACKEND_URL,
    apiTimeout: ENV_CONFIG.API_TIMEOUT,
    maxFileSize: `${ENV_CONFIG.MAX_FILE_SIZE / 1024 / 1024}MB`,
    maxFileCount: ENV_CONFIG.MAX_FILE_COUNT,
    debugMode: ENV_CONFIG.DEBUG_MODE,
  });
}
