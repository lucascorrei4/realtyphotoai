#!/usr/bin/env node

/**
 * Simple R2 Test Script
 * 
 * This script tests the R2 integration without requiring compilation
 */

const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

async function testR2Integration() {
  console.log('🚀 Testing R2 Integration...\n');

  // Check configuration
  console.log('📋 Configuration Check:');
  console.log(`- R2 Enabled: ${process.env.USE_R2_STORAGE}`);
  console.log(`- Account ID: ${process.env.R2_ACCOUNT_ID ? '✅ Set' : '❌ Missing'}`);
  console.log(`- Access Key: ${process.env.R2_ACCESS_KEY_ID ? '✅ Set' : '❌ Missing'}`);
  console.log(`- Secret Key: ${process.env.R2_SECRET_ACCESS_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`- Bucket Name: ${process.env.R2_BUCKET_NAME || 'realvisionai'}`);
  console.log(`- Public URL: ${process.env.R2_PUBLIC_URL || 'Not configured'}\n`);

  if (process.env.USE_R2_STORAGE !== 'true') {
    console.log('⚠️  R2 storage is disabled. Set USE_R2_STORAGE=true in your .env file to enable.\n');
    return;
  }

  if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
    console.log('❌ R2 configuration is incomplete. Please check your .env file.\n');
    return;
  }

  try {
    // Test AWS SDK import
    console.log('📦 Testing AWS SDK import...');
    const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
    console.log('✅ AWS SDK imported successfully\n');

    // Initialize S3 client for R2
    console.log('🔗 Initializing R2 client...');
    const s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
    console.log('✅ R2 client initialized\n');

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
    const bucketName = process.env.R2_BUCKET_NAME || 'realvisionai';
    
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: testKey,
      Body: testImageBuffer,
      ContentType: 'image/png',
      Metadata: {
        testUpload: 'true',
        uploadedAt: new Date().toISOString(),
      },
    });

    const result = await s3Client.send(command);

    console.log('✅ Upload successful!');
    console.log(`- Key: ${testKey}`);
    console.log(`- ETag: ${result.ETag}`);
    console.log(`- Size: ${testImageBuffer.length} bytes\n`);

    // Test public URL
    if (process.env.R2_PUBLIC_URL) {
      const publicUrl = `${process.env.R2_PUBLIC_URL}/${testKey}`;
      console.log(`🌐 Public URL: ${publicUrl}`);
      console.log('✅ Public URL configured\n');
    } else {
      console.log('⚠️  No public URL configured. Images will not be publicly accessible.\n');
    }

    // Clean up test file
    console.log('🧹 Cleaning up test file...');
    const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
    const deleteCommand = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: testKey,
    });
    await s3Client.send(deleteCommand);
    console.log('✅ Cleanup complete!\n');

    console.log('🎉 R2 integration test completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Configure your R2 bucket for public access');
    console.log('2. Set R2_PUBLIC_URL in your .env file');
    console.log('3. Test image uploads through your API endpoints');
    console.log('4. Monitor your R2 usage in the Cloudflare dashboard\n');

  } catch (error) {
    console.error('❌ R2 integration test failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Verify your R2 credentials are correct');
    console.log('2. Check that your R2 bucket exists');
    console.log('3. Ensure your R2 API token has the necessary permissions');
    console.log('4. Check your network connection\n');
  }
}

// Run the test
testR2Integration().catch(console.error);
