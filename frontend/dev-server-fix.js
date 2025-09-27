// Development server fix script
// This script helps resolve common React development server issues

const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing development server issues...');

// Clear various cache directories
const cacheDirs = [
  'node_modules/.cache',
  '.eslintcache',
  'build'
];

cacheDirs.forEach(dir => {
  const fullPath = path.join(__dirname, dir);
  if (fs.existsSync(fullPath)) {
    console.log(`🗑️ Clearing cache: ${dir}`);
    fs.rmSync(fullPath, { recursive: true, force: true });
  }
});

// Ensure manifest files exist and are properly formatted
const manifestPath = path.join(__dirname, 'public', 'manifest.webmanifest');
const manifestJsonPath = path.join(__dirname, 'public', 'manifest.json');

const manifestContent = {
  "short_name": "RealVision AI",
  "name": "RealVision AI - AI Image Enhancement for Real Estate",
  "icons": [
    {
      "src": "favicon.ico",
      "sizes": "64x64 32x32 24x24 16x16",
      "type": "image/x-icon"
    },
    {
      "src": "logo192.png",
      "type": "image/png",
      "sizes": "192x192"
    },
    {
      "src": "logo512.png",
      "type": "image/png",
      "sizes": "512x512"
    }
  ],
  "start_url": ".",
  "display": "standalone",
  "theme_color": "#2563eb",
  "background_color": "#ffffff"
};

// Write manifest files
fs.writeFileSync(manifestPath, JSON.stringify(manifestContent, null, 2));
fs.writeFileSync(manifestJsonPath, JSON.stringify(manifestContent, null, 2));

console.log('✅ Manifest files updated');
console.log('🚀 Development server should now work properly');
console.log('💡 If issues persist, try:');
console.log('   1. Hard refresh (Ctrl+Shift+R)');
console.log('   2. Clear browser cache');
console.log('   3. Restart the development server');
