# Configuration Guide

## Environment Configuration

The application automatically selects the appropriate configuration based on the current environment:

- **Development**: `src/config/environment.ts` (localhost:8000)
- **Production**: `src/config/environment.prod.ts` (api.realtyphotoai.com)

### Automatic Environment Selection

The `environment.selector.ts` file automatically chooses the right configuration:

```typescript
// Automatically selected based on NODE_ENV
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

export const ENV_CONFIG = isProduction ? PROD_CONFIG : DEV_CONFIG;
```

## Backend URL Configuration

### Development Environment
Edit `src/config/environment.ts`:
```typescript
export const ENV_CONFIG = {
  // Backend Configuration
  BACKEND_URL: 'http://localhost:8000', // Development backend
  // ... other config
};
```

### Production Environment
Edit `src/config/environment.prod.ts`:
```typescript
export const ENV_CONFIG = {
  // Backend Configuration
  BACKEND_URL: 'https://api.realtyphotoai.com', // Production backend
  // ... other config
};
```

### Quick Configuration

1. **Development**: Update `BACKEND_URL` in `environment.ts`
2. **Production**: Update `BACKEND_URL` in `environment.prod.ts`
3. **Custom**: Create new environment files as needed

### Common Backend URLs

- **Local Development**: `http://localhost:8000`
- **Production**: `https://api.realtyphotoai.com`
- **Staging**: `https://staging-api.realtyphotoai.com`
- **Docker**: `http://localhost:3000` (if using different port)

## Environment-Specific Settings

### Development (`environment.ts`)
```typescript
export const ENV_CONFIG = {
  BACKEND_URL: 'http://localhost:8000',
  API_TIMEOUT: 300000,        // 5 minutes
  MAX_FILE_SIZE: 10485760,    // 10MB
  MAX_FILE_COUNT: 20,         // 20 files
  ENVIRONMENT: 'development',
  DEBUG_MODE: true,           // Enable debug
  ENABLE_LOGGING: true,       // Enable logging
  ENABLE_ANALYTICS: false,    // Disable analytics
};
```

### Production (`environment.prod.ts`)
```typescript
export const ENV_CONFIG = {
  BACKEND_URL: 'https://api.realtyphotoai.com',
  API_TIMEOUT: 600000,        // 10 minutes
  MAX_FILE_SIZE: 20971520,    // 20MB
  MAX_FILE_COUNT: 50,         // 50 files
  ENVIRONMENT: 'production',
  DEBUG_MODE: false,          // Disable debug
  ENABLE_LOGGING: false,      // Disable logging
  ENABLE_ANALYTICS: true,     // Enable analytics
  ENABLE_ERROR_TRACKING: true, // Enable error tracking
  ENABLE_PERFORMANCE_MONITORING: true, // Enable performance monitoring
};
```

## API Endpoints

The following endpoints are automatically configured based on your environment:

- **Image Enhancement**: `{BACKEND_URL}/api/v1/image-enhancement`
- **Interior Design**: `{BACKEND_URL}/api/v1/interior-design`
- **Process Image**: `{BACKEND_URL}/api/v1/process-image`
- **Replace Elements**: `{BACKEND_URL}/api/v1/replace-elements`
- **Health Check**: `{BACKEND_URL}/api/v1/health`
- **Model Info**: `{BACKEND_URL}/api/v1/model-info`
- **Configuration**: `{BACKEND_URL}/api/v1/config`

## File Upload Limits

### Development
- **Maximum File Size**: 10MB per file
- **Maximum File Count**: 20 files per upload

### Production
- **Maximum File Size**: 20MB per file
- **Maximum File Count**: 50 files per upload

### Supported Formats
- JPG, PNG, WebP, HEIC

## Environment Detection

### Helper Functions
```typescript
import { 
  getCurrentEnvironment, 
  isProductionEnvironment, 
  isDevelopmentEnvironment,
  getEnvironmentConfig 
} from './config/environment.selector';

// Get current environment
const env = getCurrentEnvironment(); // 'development' or 'production'

// Check environment type
const isProd = isProductionEnvironment(); // true/false
const isDev = isDevelopmentEnvironment(); // true/false

// Get full environment config
const config = getEnvironmentConfig();
```

### Console Logging
In development mode, the current configuration is automatically logged to the console:
```
🌍 Environment Configuration: {
  environment: "development",
  backendUrl: "http://localhost:8000",
  apiTimeout: 300000,
  maxFileSize: "10MB",
  maxFileCount: 20,
  debugMode: true
}
```

## After Making Changes

1. **Save** the configuration file
2. **Restart** the React development server:
   ```bash
   npm start
   ```
3. **Verify** the configuration in the browser console (development mode)

## Build and Deployment

### Development Build
```bash
npm start
# Uses environment.ts (localhost:8000)
```

### Production Build
```bash
npm run build
# Uses environment.prod.ts (api.realtyphotoai.com)
```

### Environment Variables
You can also override settings using environment variables:
```bash
# Set environment
export NODE_ENV=production

# Override backend URL
export REACT_APP_BACKEND_URL=https://custom-api.com

# Build
npm run build
```

## Troubleshooting

### CORS Issues
- **Development**: Ensure backend allows requests from `http://localhost:3000`
- **Production**: Ensure backend allows requests from your frontend domain

### Connection Refused
- **Development**: Verify backend is running on port 8000
- **Production**: Verify `api.realtyphotoai.com` is accessible

### API Timeout
- **Development**: 5 minutes (300000ms)
- **Production**: 10 minutes (600000ms)

### File Upload Limits
- **Development**: 10MB, 20 files
- **Production**: 20MB, 50 files

## Creating Custom Environments

### Example: Staging Environment
Create `src/config/environment.staging.ts`:
```typescript
export const ENV_CONFIG = {
  BACKEND_URL: 'https://staging-api.realtyphotoai.com',
  API_TIMEOUT: 450000,        // 7.5 minutes
  MAX_FILE_SIZE: 15728640,    // 15MB
  MAX_FILE_COUNT: 35,         // 35 files
  ENVIRONMENT: 'staging',
  DEBUG_MODE: true,           // Enable debug for staging
  ENABLE_LOGGING: true,       // Enable logging for staging
  ENABLE_ANALYTICS: false,    // Disable analytics for staging
};
```

Then update `environment.selector.ts` to include staging:
```typescript
const isStaging = process.env.NODE_ENV === 'staging';
export const ENV_CONFIG = isProduction ? PROD_CONFIG : 
                         isStaging ? STAGING_CONFIG : DEV_CONFIG;
```
