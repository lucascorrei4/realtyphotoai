const http = require('http');
const fs = require('fs');
const path = require('path');

console.log('🏠 Testing Real Estate Photo AI - Image Processing\n');

// Function to create form data for file upload
function createFormData(filePath, fields = {}) {
  const boundary = '----formdata-boundary-' + Math.random().toString(16);
  const CRLF = '\r\n';
  let body = '';

  // Add text fields
  for (const [key, value] of Object.entries(fields)) {
    body += `--${boundary}${CRLF}`;
    body += `Content-Disposition: form-data; name="${key}"${CRLF}${CRLF}`;
    body += `${value}${CRLF}`;
  }

  // Add file field
  if (filePath && fs.existsSync(filePath)) {
    const fileName = path.basename(filePath);
    const fileData = fs.readFileSync(filePath);
    const mimeType = fileName.endsWith('.jpg') || fileName.endsWith('.jpeg') ? 'image/jpeg' : 
                     fileName.endsWith('.png') ? 'image/png' : 'image/jpeg';

    body += `--${boundary}${CRLF}`;
    body += `Content-Disposition: form-data; name="image"; filename="${fileName}"${CRLF}`;
    body += `Content-Type: ${mimeType}${CRLF}${CRLF}`;
  }

  const bodyBuffer = Buffer.concat([
    Buffer.from(body, 'utf8'),
    filePath && fs.existsSync(filePath) ? fs.readFileSync(filePath) : Buffer.alloc(0),
    Buffer.from(`${CRLF}--${boundary}--${CRLF}`, 'utf8')
  ]);

  return {
    body: bodyBuffer,
    contentType: `multipart/form-data; boundary=${boundary}`
  };
}

// Test function
async function testImageProcessing() {
  console.log('🔍 Checking for sample images...');
  
  // Look for any image files in the current directory
  const imageFiles = fs.readdirSync('.').filter(file => 
    file.match(/\.(jpg|jpeg|png)$/i)
  );

  if (imageFiles.length === 0) {
    console.log('📝 No image files found. Here\'s how to test image processing:');
    console.log('\n🖼️  To test image processing:');
    console.log('1. Place an image file (JPG/PNG) in this directory');
    console.log('2. Run this test script again');
    console.log('\n📋 Example curl command for testing:');
    console.log('curl -X POST http://localhost:8000/api/v1/process-image \\');
    console.log('  -F "image=@your-room-photo.jpg" \\');
    console.log('  -F "style=modern minimalist" \\');
    console.log('  -F "prompt=a beautifully decorated living room"');
    return;
  }

  const testImage = imageFiles[0];
  console.log(`📸 Found image: ${testImage}`);
  console.log('🚀 Testing image processing...\n');

  try {
    const formData = createFormData(testImage, {
      style: 'modern minimalist',
      prompt: 'a beautifully decorated and furnished room with modern furniture and good lighting',
      guidance: '7.5',
      steps: '20'
    });

    const options = {
      hostname: 'localhost',
      port: 8000,
      path: '/api/v1/process-image',
      method: 'POST',
      headers: {
        'Content-Type': formData.contentType,
        'Content-Length': formData.body.length
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log(`✅ Processing Response (Status: ${res.statusCode})`);
          console.log(JSON.stringify(response, null, 2));
          
          if (response.success) {
            console.log('\n🎉 Image processing successful!');
            console.log(`📥 Original: ${response.originalImage}`);
            console.log(`📤 Processed: ${response.processedImage}`);
            console.log(`⏱️  Processing time: ${response.processingTime}ms`);
          }
        } catch (error) {
          console.log(`❌ JSON parse error: ${error.message}`);
          console.log(`Raw response: ${data}`);
        }
      });
    });

    req.on('error', (error) => {
      console.log(`❌ Request error: ${error.message}`);
    });

    req.setTimeout(120000, () => { // 2 minute timeout for AI processing
      console.log('⏰ Request timeout (this is normal for AI processing)');
      req.destroy();
    });

    req.write(formData.body);
    req.end();

  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}

testImageProcessing(); 