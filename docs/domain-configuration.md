# Domain Configuration - RealVisionAI

## 🌐 Domain Structure

Your application is now configured to run on two separate domains with different ports:

### 1. **Backend API Server**
- **Domain**: `api.RealVisionai.com`
- **Port**: `8000`
- **Purpose**: Handles all API requests, image processing, AI operations
- **Process**: `RealVisionai-backend` (PM2)

### 2. **Frontend Application**
- **Domain**: `app.RealVisionai.com`
- **Port**: `3000`
- **Purpose**: Serves the React frontend application
- **Process**: `RealVisionai-frontend` (PM2)

### 3. **IP Fallback**
- **IP**: `31.97.147.23`
- **Behavior**: Redirects to `app.RealVisionai.com`

## 🔧 Configuration Files Updated

### Nginx Configuration (`nginx.conf`)
- **Upstream definitions** for backend (port 8000) and frontend (port 3000)
- **Separate server blocks** for each domain
- **Different rate limiting** (API: 10 req/s, Frontend: 20 req/s)
- **Separate log files** for each domain

### PM2 Configuration (`ecosystem.config.js`)
- **Backend process**: Runs on port 8000 with clustering
- **Frontend process**: Runs on port 3000 with single instance
- **Separate log files** for each process

### GitHub Actions (`deploy.yml`)
- **Health checks** for both ports
- **Installation** of `serve` package for frontend
- **Process management** for both backend and frontend

## 🚀 Deployment Process

1. **Backend deployment**:
   - Builds TypeScript to `dist/` folder
   - Runs on port 8000
   - Handles API requests

2. **Frontend deployment**:
   - Builds React app to `frontend/build/`
   - Serves static files on port 3000
   - Uses `serve` package for production serving

## 📊 Monitoring

### PM2 Commands
```bash
# View all processes
pm2 status

# Backend logs
pm2 logs RealVisionai-backend

# Frontend logs
pm2 logs RealVisionai-frontend

# Monitor processes
pm2 monit
```

### Nginx Logs
```bash
# API logs
tail -f /var/log/nginx/api_RealVisionai_access.log
tail -f /var/log/nginx/api_RealVisionai_error.log

# Frontend logs
tail -f /var/log/nginx/app_RealVisionai_access.log
tail -f /var/log/nginx/app_RealVisionai_error.log
```

## 🔍 Health Checks

### Backend Health
```bash
curl http://api.RealVisionai.com/health
# or
curl http://31.97.147.23:8000/health
```

### Frontend Health
```bash
curl http://app.RealVisionai.com/
# or
curl http://31.97.147.23:3000/
```

## 🌍 DNS Configuration Required

To use the domains, you need to configure DNS records:

### A Records
- `api.RealVisionai.com` → `31.97.147.23`
- `app.RealVisionai.com` → `31.97.147.23`

### CNAME Records (if using subdomain)
- `api` → `RealVisionai.com`
- `app` → `RealVisionai.com`

## 🔒 Security Features

- **Rate limiting**: API (10 req/s), Frontend (20 req/s)
- **Security headers**: XSS protection, frame options, content type options
- **File access control**: Denies access to sensitive files
- **Gzip compression**: Reduces bandwidth usage
- **Separate log files**: Easy monitoring and debugging

## 📝 Environment Variables

Make sure your `.env` file includes:
```env
NODE_ENV=production
PORT=8000  # Backend port
REPLICATE_API_TOKEN=your_token
UPLOAD_PATH=./uploads
OUTPUT_PATH=./outputs
TEMP_PATH=./temp
LOG_LEVEL=info
```

## 🚨 Troubleshooting

### Port Conflicts
```bash
# Check what's using the ports
netstat -tulpn | grep :8000
netstat -tulpn | grep :3000
```

### Process Issues
```bash
# Restart specific process
pm2 restart RealVisionai-backend
pm2 restart RealVisionai-frontend

# View process details
pm2 show RealVisionai-backend
pm2 show RealVisionai-frontend
```

### Nginx Issues
```bash
# Test configuration
nginx -t

# Reload configuration
nginx -s reload

# Check nginx status
systemctl status nginx
```

## 🎯 Benefits of This Configuration

1. **Separation of concerns**: API and frontend are independent
2. **Scalability**: Backend can be scaled independently
3. **Security**: Different rate limits and configurations
4. **Monitoring**: Separate logs and health checks
5. **Maintenance**: Can update frontend without affecting API
6. **Performance**: Optimized settings for each service type
