# Cloudflare R2 Integration Guide

This guide will help you integrate Cloudflare R2 storage into your RealVisionAI project without breaking existing functionality.

## 🚀 Quick Setup

### 1. Install Dependencies
The required dependencies are already installed:
- `@aws-sdk/client-s3` - AWS S3 SDK for R2 compatibility
- `@aws-sdk/s3-request-presigner` - For signed URLs

### 2. Configure Environment Variables

Add these variables to your `.env` file:

```bash
# R2 Storage Configuration
USE_R2_STORAGE=true
R2_ACCOUNT_ID=220f71c44c36a29743efe7f8e93eabeb
R2_ACCESS_KEY_ID=your_r2_access_key_id_here
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key_here
R2_BUCKET_NAME=realvisionai
R2_PUBLIC_URL=https://pub-1234567890abcdef.r2.dev
```

### 3. Get Your R2 Credentials

1. **Account ID**: Already provided (`220f71c44c36a29743efe7f8e93eabeb`)
2. **API Token**: 
   - Go to Cloudflare Dashboard → R2 Object Storage → Manage API tokens
   - Click "Create API token"
   - Select "R2:Edit" permissions
   - Copy the Access Key ID and Secret Access Key

### 4. Configure R2 Bucket for Public Access

**Option A: Public Development URL (Recommended for testing)**
1. Go to your R2 bucket settings
2. Enable "Public Development URL"
3. Copy the generated URL to `R2_PUBLIC_URL`

**Option B: Custom Domain (Recommended for production)**
1. Go to your R2 bucket settings
2. Add a custom domain (e.g., `images.yourdomain.com`)
3. Configure DNS records as instructed
4. Use the custom domain URL in `R2_PUBLIC_URL`

## 🧪 Testing the Integration

### Run the Test Script
```bash
npx ts-node scripts/test-r2-integration.ts
```

This will:
- ✅ Verify your R2 configuration
- ✅ Test file upload to R2
- ✅ Test file download from R2
- ✅ Test file deletion
- ✅ Clean up test files

### Test via API Endpoints

1. **Upload Test**:
   ```bash
   curl -X POST http://localhost:8000/api/v1/upload \
     -F "image=@path/to/test-image.jpg"
   ```

2. **Process Image Test**:
   ```bash
   curl -X POST http://localhost:8000/api/v1/process \
     -F "image=@path/to/test-image.jpg" \
     -F "prompt=modern living room"
   ```

## 🔄 How It Works

### Hybrid Storage System
The integration uses a **HybridStorageService** that automatically chooses between:
- **R2 Storage**: When `USE_R2_STORAGE=true` and credentials are configured
- **Local Storage**: When R2 is disabled or misconfigured (fallback)

### Image Flow
1. **Upload**: Images are uploaded to R2 bucket with unique keys
2. **Processing**: AI processes the image and generates a new one
3. **Storage**: Processed images are stored in R2 with metadata
4. **Access**: Images are served via public URLs or signed URLs

### Storage Structure
```
realvisionai/
├── uploads/
│   ├── 1703123456789_abc123_original.jpg
│   └── 1703123456790_def456_photo.png
├── processed/
│   ├── original_processed_1703123456789_xyz789.jpg
│   └── photo_interior_design_1703123456790_uvw012.png
└── temp/
    └── (temporary files during processing)
```

## 🛠️ Configuration Options

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `USE_R2_STORAGE` | Enable R2 storage | `false` | No |
| `R2_ACCOUNT_ID` | Cloudflare account ID | - | Yes (if R2 enabled) |
| `R2_ACCESS_KEY_ID` | R2 API access key | - | Yes (if R2 enabled) |
| `R2_SECRET_ACCESS_KEY` | R2 API secret key | - | Yes (if R2 enabled) |
| `R2_BUCKET_NAME` | R2 bucket name | `realvisionai` | No |
| `R2_PUBLIC_URL` | Public URL for images | - | Recommended |

### Fallback Behavior
- If R2 is disabled → Uses local storage (`uploads/`, `outputs/`)
- If R2 credentials are missing → Falls back to local storage
- If R2 upload fails → Throws error (no automatic fallback)

## 🔒 Security Considerations

### Public Access
- **Development**: Use Public Development URL
- **Production**: Use custom domain with proper DNS configuration
- **Private**: Use signed URLs for sensitive images

### API Permissions
- Create R2 API tokens with minimal required permissions
- Use separate tokens for different environments
- Rotate tokens regularly

## 📊 Monitoring

### Cloudflare Dashboard
- Monitor storage usage
- Track API requests
- View bandwidth usage
- Check error rates

### Application Logs
The integration logs all operations:
```bash
# Upload logs
[INFO] File uploaded successfully { storageType: 'r2', storageKey: 'uploads/...' }

# Processing logs  
[INFO] Image processing completed successfully { storageType: 'r2', ... }

# Error logs
[ERROR] R2 upload failed { error: '...', filePath: '...' }
```

## 🚨 Troubleshooting

### Common Issues

1. **"R2 configuration incomplete"**
   - Check all R2 environment variables are set
   - Verify credentials are correct

2. **"Failed to upload to R2"**
   - Check network connectivity
   - Verify R2 API token permissions
   - Ensure bucket exists

3. **"No public URL configured"**
   - Set `R2_PUBLIC_URL` environment variable
   - Configure public access in R2 bucket settings

4. **Images not loading**
   - Check CORS configuration
   - Verify public URL is correct
   - Test URL accessibility

### Debug Mode
Enable debug logging:
```bash
LOG_LEVEL=debug npm run dev
```

## 🔄 Migration Strategy

### Gradual Migration
1. **Phase 1**: Deploy with `USE_R2_STORAGE=false` (local storage)
2. **Phase 2**: Test R2 integration with `USE_R2_STORAGE=true`
3. **Phase 3**: Migrate existing images to R2
4. **Phase 4**: Remove local storage dependencies

### Existing Images
To migrate existing images to R2:
1. Use the migration script (to be created)
2. Update database records with new URLs
3. Verify all images are accessible

## 📈 Performance Benefits

### R2 Advantages
- **Zero egress fees** for public access
- **Global CDN** distribution
- **Unlimited bandwidth**
- **99.9% availability**
- **Automatic scaling**

### Cost Savings
- No bandwidth charges for image serving
- Reduced server storage costs
- Lower server resource usage
- Improved application performance

## 🎯 Next Steps

1. **Configure R2 credentials** in your `.env` file
2. **Run the test script** to verify integration
3. **Test API endpoints** with real images
4. **Configure public access** for your R2 bucket
5. **Monitor usage** in Cloudflare dashboard
6. **Deploy to production** when ready

## 📞 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review application logs for error details
3. Verify R2 configuration in Cloudflare dashboard
4. Test with the provided test script

---

**Note**: This integration is designed to be non-breaking. If R2 is not configured or fails, the application will continue to work with local storage.
