const fs = require('fs');
const path = require('path');

async function testApiEndpoint() {
  console.log('🔍 Testing the actual API endpoint...');
  
  // Check if we have a test image
  const testImagePath = path.join(__dirname, 'before_image.jpg');
  
  if (!fs.existsSync(testImagePath)) {
    console.log('❌ Test image not found:', testImagePath);
    console.log('Please make sure before_image.jpg exists in the project root');
    return;
  }
  
  console.log('✅ Found test image:', testImagePath);
  
  try {
    // Read the image file
    const imageBuffer = fs.readFileSync(testImagePath);
    const base64Image = imageBuffer.toString('base64');
    const dataUrl = `data:image/jpeg;base64,${base64Image}`;
    
    console.log('📤 Sending request to API...');
    
    // Create form data
    const formData = new FormData();
    formData.append('image', dataUrl);
    formData.append('prompt', 'modern furnished living room');
    formData.append('steps', '25');
    formData.append('guidance', '7.5');
    formData.append('strength', '0.65');
    formData.append('useControlNet', 'true');
    formData.append('controlNetType', 'canny');
    formData.append('controlNetStrength', '0.8');
    
    // Make the API call
    const response = await fetch('http://localhost:8000/api/v1/process-image', {
      method: 'POST',
      body: formData
    });
    
    console.log('📥 Response received');
    console.log('Status:', response.status);
    console.log('Status Text:', response.statusText);
    
    const responseText = await response.text();
    console.log('Response Body:', responseText);
    
    if (response.ok) {
      console.log('✅ API call successful!');
    } else {
      console.log('❌ API call failed');
    }
    
  } catch (error) {
    console.log('❌ Request failed:', error.message);
  }
  
  console.log('\n🎯 API endpoint test completed!');
}

testApiEndpoint().catch(console.error); 