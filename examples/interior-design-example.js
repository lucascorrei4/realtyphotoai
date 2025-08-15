const fs = require('fs');
const FormData = require('form-data');
const fetch = require('node-fetch');

/**
 * Example: Process an image with the Interior Design model
 * This demonstrates how to use the new /interior-design endpoint
 */

async function processImageWithInteriorDesign() {
  try {
    // Configuration
    const API_BASE_URL = 'http://localhost:8000/api/v1';
    const IMAGE_PATH = './before_image.jpg'; // Update this path to your image
    const PROMPT = "A bedroom with a bohemian spirit centered around a relaxed canopy bed complemented by a large macrame wall hanging. An eclectic dresser serves as a unique storage solution while an array of potted plants brings life and color to the room";
    
    // Check if image exists
    if (!fs.existsSync(IMAGE_PATH)) {
      console.error(`❌ Image not found: ${IMAGE_PATH}`);
      console.log('Please update IMAGE_PATH to point to an existing image file');
      return;
    }

    console.log('🚀 Starting Interior Design processing...');
    console.log(`📁 Image: ${IMAGE_PATH}`);
    console.log(`✏️ Prompt: ${PROMPT}`);
    console.log('');

    // Create form data
    const form = new FormData();
    form.append('image', fs.createReadStream(IMAGE_PATH));
    form.append('prompt', PROMPT);
    
    // Optional parameters
    form.append('promptStrength', '0.8');        // How strongly to apply the prompt (0.0 - 1.0)
    form.append('numInferenceSteps', '25');     // Number of inference steps (higher = better quality, slower)
    form.append('guidanceScale', '7.5');        // How closely to follow the prompt (1.0 - 20.0)
    // form.append('seed', '42');               // Uncomment to set a specific seed for reproducible results

    console.log('📤 Sending request to Interior Design API...');
    
    // Make API request
    const response = await fetch(`${API_BASE_URL}/interior-design`, {
      method: 'POST',
      body: form,
      headers: {
        ...form.getHeaders(),
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} ${response.statusText}\n${errorText}`);
    }

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Interior Design processing completed successfully!');
      console.log(`⏱️ Processing time: ${result.processingTime}ms`);
      console.log(`🖼️ Original image: ${result.originalImage}`);
      console.log(`🎨 Processed image: ${result.processedImage}`);
      console.log('');
      console.log('🌐 You can view the processed image at:');
      console.log(`   http://localhost:8000${result.processedImage}`);
    } else {
      console.error('❌ Processing failed:', result.message);
      if (result.error) {
        console.error('Error details:', result.error);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

/**
 * Example: Test the Interior Design model with different prompts
 */
async function testDifferentPrompts() {
  const prompts = [
    {
      name: "Modern Minimalist",
      prompt: "A modern minimalist living room with clean lines, neutral colors, and Scandinavian furniture. Large windows with natural light, a comfortable sofa, and a coffee table with a vase of fresh flowers."
    },
    {
      name: "Cozy Farmhouse",
      prompt: "A cozy farmhouse-style kitchen with warm wooden cabinets, a farmhouse sink, vintage lighting fixtures, and rustic decor. Open shelving with mason jars and fresh herbs, a large wooden dining table."
    },
    {
      name: "Luxury Master Bedroom",
      prompt: "A luxurious master bedroom with a king-size canopy bed, silk bedding, elegant lighting, and premium furniture. Large windows with floor-to-ceiling curtains, a seating area with plush armchairs."
    },
    {
      name: "Home Office",
      prompt: "A productive home office with a large desk, ergonomic chair, and organized storage. Natural lighting, plants for air quality, and motivational artwork. Modern technology integrated seamlessly."
    }
  ];

  console.log('🧪 Testing different interior design prompts...\n');

  for (const promptData of prompts) {
    console.log(`🎨 Testing: ${promptData.name}`);
    console.log(`Prompt: ${promptData.prompt}`);
    console.log('---');
    
    // You can call processImageWithInteriorDesign here with different prompts
    // For now, just display the prompts
  }
}

// Main execution
if (require.main === module) {
  console.log('🏠 Interior Design Model Example');
  console.log('================================\n');
  
  // Run the main example
  processImageWithInteriorDesign();
  
  console.log('\n');
  
  // Show different prompt examples
  testDifferentPrompts();
  
  console.log('\n💡 Tips:');
  console.log('- Make sure your backend server is running on port 8000');
  console.log('- Update IMAGE_PATH to point to an existing image file');
  console.log('- Adjust prompt parameters for different results');
  console.log('- Use specific seeds for reproducible results');
}

module.exports = {
  processImageWithInteriorDesign,
  testDifferentPrompts
};
