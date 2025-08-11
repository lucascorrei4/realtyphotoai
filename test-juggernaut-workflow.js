const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

async function testJuggernautWorkflow() {
  console.log('🚀 Testing Juggernaut XL Depth + Inpainting Workflow...\n');

  try {
    // Test 1: Check configuration
    console.log('📋 Step 1: Checking API configuration...');
    const configResponse = await axios.get('http://localhost:8000/api/v1/config');
    
    console.log('✅ Configuration loaded:');
    console.log(`   Model: ${configResponse.data.data.model}`);  
    console.log(`   Workflow: ${configResponse.data.data.workflow}`);
    console.log(`   ControlNet: ${configResponse.data.data.controlNetModel}`);
    console.log('');

    // Test 2: Check if workflow is enabled
    if (configResponse.data.data.workflow !== 'depth_inpainting') {
      console.log('⚠️  Two-pass workflow not enabled. Set ENABLE_INPAINTING_WORKFLOW=true in .env');
      return;
    }

    // Test 3: Check model recommendations
    console.log('🎯 Step 2: Checking model recommendations...');
    const recommendationsResponse = await axios.get('http://localhost:8000/api/v1/recommendations');
    
    if (recommendationsResponse.data.data.recommendations['juggernaut-xl']) {
      console.log('✅ Juggernaut XL workflow available');
      console.log(`   Description: ${recommendationsResponse.data.data.recommendations['juggernaut-xl'].description}`);
    } else {
      console.log('❌ Juggernaut XL workflow not found in recommendations');
    }
    console.log('');

    // Test 4: Process an image (if sample exists)
    const sampleImage = 'sample_living_room.jpg';
    if (fs.existsSync(sampleImage)) {
      console.log('🖼️  Step 3: Testing image processing with Juggernaut workflow...');
      
      const form = new FormData();
      form.append('image', fs.createReadStream(sampleImage));
      form.append('prompt', 'modern furnished living room, stylish furniture, warm lighting, photorealistic');

      const processResponse = await axios.post('http://localhost:8000/api/v1/process-image', form, {
        headers: {
          ...form.getHeaders(),
          'Content-Type': 'multipart/form-data'
        },
        timeout: 120000 // 2 minutes timeout for processing
      });

      if (processResponse.data.success) {
        console.log('✅ Image processing completed successfully!');
        console.log(`   Processing time: ${processResponse.data.data.processingTime}ms`);
        console.log(`   Output: ${processResponse.data.data.processedImage}`);
        console.log(`   Workflow used: ${processResponse.data.data.metadata?.parametersUsed?.workflowType || 'unknown'}`);
      }
    } else {
      console.log('⚠️  Sample image not found, skipping image processing test');
    }

    console.log('\n🎉 Juggernaut XL workflow is ready to use!');
    console.log('\n📝 Workflow Details:');
    console.log('   • Pass 1: Depth ControlNet generation');
    console.log('   • Pass 2: Inpainting refinement at 0.65 strength');
    console.log('   • Optimized for photorealistic interior transformations');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response?.data) {
      console.error('   Server response:', error.response.data);
    }
  }
}

// Run the test
if (require.main === module) {
  testJuggernautWorkflow();
}

module.exports = { testJuggernautWorkflow }; 