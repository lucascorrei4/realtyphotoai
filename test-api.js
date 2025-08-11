const http = require('http');

console.log('🧪 Testing Real Estate Photo AI Backend...\n');

// Test health endpoint
const testEndpoint = (path, description) => {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://localhost:8000${path}`, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log(`✅ ${description}`);
          console.log(`   Status: ${res.statusCode}`);
          console.log(`   Response: ${JSON.stringify(response, null, 2)}\n`);
          resolve(response);
        } catch (error) {
          console.log(`❌ ${description} - JSON parse error`);
          console.log(`   Raw response: ${data}\n`);
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      console.log(`❌ ${description} - Connection error: ${error.message}\n`);
      reject(error);
    });

    req.setTimeout(5000, () => {
      console.log(`❌ ${description} - Timeout\n`);
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
};

async function runTests() {
  try {
    await testEndpoint('/api/v1/health', 'Health Check');
    await testEndpoint('/api/v1/test', 'API Test Endpoint');
    await testEndpoint('/', 'Root Endpoint');
    
    console.log('🎉 All tests completed successfully!');
    console.log('\n📋 Your API is ready to use:');
    console.log('   Health: http://localhost:8000/api/v1/health');
    console.log('   Test: http://localhost:8000/api/v1/test');
    console.log('   Upload: http://localhost:8000/api/v1/upload (POST)');
    console.log('   Process: http://localhost:8000/api/v1/process-image (POST)');
    
  } catch (error) {
    console.error('❌ Tests failed:', error.message);
    console.log('\n💡 Make sure the server is running with: npm start');
  }
}

runTests(); 