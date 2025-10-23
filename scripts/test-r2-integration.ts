#!/usr/bin/env node

/**
 * R2 Setup and Test Script
 * 
 * This script helps you:
 * 1. Test R2 connection
 * 2. Upload a test image
 * 3. Verify the integration is working
 */

import { config } from '../dist/config';
import { HybridStorageService } from '../dist/services/hybridStorageService';
import path from 'path';
import fs from 'fs';

async function testR2Integration() {
  console.log('🚀 Testing R2 Integration...\n');

  // Check configuration
  console.log('📋 Configuration Check:');
  console.log(`- R2 Enabled: ${config.useR2Storage}`);
  console.log(`- Account ID: ${config.r2AccountId ? '✅ Set' : '❌ Missing'}`);
  console.log(`- Access Key: ${config.r2AccessKeyId ? '✅ Set' : '❌ Missing'}`);
  console.log(`- Secret Key: ${config.r2SecretAccessKey ? '✅ Set' : '❌ Missing'}`);
  console.log(`- Bucket Name: ${config.r2BucketName}`);
  console.log(`- Public URL: ${config.r2PublicUrl || 'Not configured'}\n`);

  if (!config.useR2Storage) {
    console.log('⚠️  R2 storage is disabled. Set USE_R2_STORAGE=true in your .env file to enable.\n');
    return;
  }

  if (!config.r2AccountId || !config.r2AccessKeyId || !config.r2SecretAccessKey) {
    console.log('❌ R2 configuration is incomplete. Please check your .env file.\n');
    return;
  }

  try {
    // Initialize storage service
    const storageService = new HybridStorageService();
    
    console.log(`📦 Storage Type: ${storageService.getStorageType()}`);
    console.log(`🔗 R2 Enabled: ${storageService.isR2Enabled()}\n`);

    // Test file upload
    console.log('🧪 Testing file upload...');
    
    // Create a test image buffer (1x1 PNG)
    const testImageBuffer = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
      0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0xF8, 0x0F, 0x00, 0x00,
      0x01, 0x00, 0x01, 0x00, 0x18, 0xDD, 0x8D, 0xB4, 0x00, 0x00, 0x00, 0x00,
      0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
    ]);

    const testKey = `test/test-image-${Date.now()}.png`;
    
    const uploadResult = await storageService.uploadBuffer(
      testImageBuffer,
      testKey,
      'image/png',
      {
        testUpload: 'true',
        uploadedAt: new Date().toISOString(),
      }
    );

    console.log('✅ Upload successful!');
    console.log(`- Key: ${uploadResult.key}`);
    console.log(`- URL: ${uploadResult.url}`);
    console.log(`- Size: ${uploadResult.size} bytes`);
    console.log(`- Storage Type: ${uploadResult.storageType}\n`);

    // Test file existence check
    console.log('🔍 Testing file existence check...');
    const exists = await storageService.fileExists(uploadResult.key);
    console.log(`✅ File exists: ${exists}\n`);

    // Test file download
    console.log('⬇️  Testing file download...');
    const tempPath = path.join(config.tempDir, `downloaded-${Date.now()}.png`);
    await storageService.downloadFile(uploadResult.key, tempPath);
    
    const downloadedStats = await fs.promises.stat(tempPath);
    console.log(`✅ Download successful!`);
    console.log(`- Downloaded to: ${tempPath}`);
    console.log(`- Size: ${downloadedStats.size} bytes\n`);

    // Clean up test file
    console.log('🧹 Cleaning up test files...');
    await storageService.deleteFile(uploadResult.key);
    await fs.promises.unlink(tempPath);
    console.log('✅ Cleanup complete!\n');

    console.log('🎉 R2 integration test completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Configure your R2 bucket for public access');
    console.log('2. Set R2_PUBLIC_URL in your .env file');
    console.log('3. Test image uploads through your API endpoints');
    console.log('4. Monitor your R2 usage in the Cloudflare dashboard\n');

  } catch (error) {
    console.error('❌ R2 integration test failed:', error);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Verify your R2 credentials are correct');
    console.log('2. Check that your R2 bucket exists');
    console.log('3. Ensure your R2 API token has the necessary permissions');
    console.log('4. Check your network connection\n');
  }
}

// Run the test
testR2Integration().catch(console.error);
