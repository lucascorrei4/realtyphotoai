/**
 * Image preview utilities for frontend components
 * Handles HEIC/HEIF preview conversion since browsers cannot display them directly
 */

/**
 * Create a preview URL for an image file, converting HEIC/HEIF to WebP for display
 */
export async function createImagePreview(file: File): Promise<string> {
  // Check if it's a HEIC/HEIF file
  const fileExtension = file.name.toLowerCase().split('.').pop();
  const isHeicFile = fileExtension === 'heic' || fileExtension === 'heif';
  
  if (!isHeicFile) {
    // For non-HEIC files, use the standard URL.createObjectURL
    const url = URL.createObjectURL(file);
    return url;
  }
  
  // For HEIC files, try server-side conversion
  try {
    const convertedUrl = await convertHeicOnServer(file);
    if (convertedUrl) {
      return convertedUrl;
    }
  } catch (error) {
    console.warn('Server-side HEIC conversion failed:', error);
  }
  
  // Try direct browser loading as fallback
  try {
    const directUrl = URL.createObjectURL(file);
    
    // Test if the browser can load it
    const testImg = new Image();
    await new Promise((resolve, reject) => {
      testImg.onload = () => {
        resolve(directUrl);
      };
      testImg.onerror = () => {
        reject(new Error('Browser cannot load HEIC'));
      };
      testImg.src = directUrl;
    });
    
    return directUrl;
  } catch (error) {
    // Direct browser loading failed, continue to fallback
  }
  
  // Final fallback: enhanced placeholder
  try {
    const preview = await createEnhancedHeicPlaceholder(file);
    return preview;
  } catch (error) {
    console.error('Error creating HEIC preview:', error);
    // Ultimate fallback to a simple data URL
    const fallback = createSimpleDataUrl(file);
    return fallback;
  }
}

/**
 * Convert HEIC file on the server
 */
async function convertHeicOnServer(file: File): Promise<string | null> {
  try {
    const formData = new FormData();
    formData.append('image', file);
    
    const response = await fetch('http://localhost:8000/api/v1/convert-heic', {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error(`Server conversion failed: ${response.status}`);
    }
    
    const blob = await response.blob();
    if (blob && blob.size > 0) {
      return URL.createObjectURL(blob);
    }
    
    return null;
  } catch (error) {
    console.error('Server-side HEIC conversion error:', error);
    return null;
  }
}

/**
 * Create an enhanced visual placeholder for HEIC files
 */
async function createEnhancedHeicPlaceholder(file: File): Promise<string> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    return createSimpleDataUrl(file);
  }
  
  // Set canvas size
  canvas.width = 400;
  canvas.height = 300;
  
  // Draw background with gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#f8fafc');
  gradient.addColorStop(1, '#e2e8f0');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Draw border
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
  
  // Draw icon background circle
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2 - 30;
  const iconRadius = 50;
  
  // Outer circle
  ctx.fillStyle = '#3b82f6';
  ctx.beginPath();
  ctx.arc(centerX, centerY, iconRadius, 0, 2 * Math.PI);
  ctx.fill();
  
  // Inner circle
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(centerX, centerY, iconRadius - 10, 0, 2 * Math.PI);
  ctx.fill();
  
  // Draw camera icon
  ctx.fillStyle = '#3b82f6';
  ctx.font = '32px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('📷', centerX, centerY);
  
  // Draw file type text
  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 20px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('HEIC Image', centerX, centerY + 70);
  
  // Draw filename
  ctx.fillStyle = '#475569';
  ctx.font = '16px Arial';
  const maxWidth = canvas.width - 40;
  const filename = file.name.length > 25 ? file.name.substring(0, 25) + '...' : file.name;
  ctx.fillText(filename, centerX, centerY + 95);
  
  // Draw file size
  ctx.fillStyle = '#64748b';
  ctx.font = '14px Arial';
  ctx.fillText(`${(file.size / 1024 / 1024).toFixed(1)}MB`, centerX, centerY + 115);
  
  // Draw conversion status
  ctx.fillStyle = '#f59e0b';
  ctx.font = '12px Arial';
  ctx.fillText('Conversion in progress...', centerX, centerY + 135);
  
  // Convert canvas to blob and create URL
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(URL.createObjectURL(blob));
      } else {
        reject(new Error('Failed to create blob from canvas'));
      }
    }, 'image/png', 0.9);
  });
}

/**
 * Create a visual placeholder for HEIC files
 */
async function createHeicPlaceholder(file: File): Promise<string> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    return createSimpleDataUrl(file);
  }
  
  // Set canvas size
  canvas.width = 400;
  canvas.height = 300;
  
  // Draw background
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Draw border
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
  
  // Draw icon background circle
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2 - 20;
  const iconRadius = 40;
  
  ctx.fillStyle = '#3b82f6';
  ctx.beginPath();
  ctx.arc(centerX, centerY, iconRadius, 0, 2 * Math.PI);
  ctx.fill();
  
  // Draw camera icon
  ctx.fillStyle = 'white';
  ctx.font = '24px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('📷', centerX, centerY);
  
  // Draw file type text
  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 18px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('HEIC Image', centerX, centerY + 60);
  
  // Draw filename
  ctx.fillStyle = '#475569';
  ctx.font = '14px Arial';
  const maxWidth = canvas.width - 40;
  const filename = file.name.length > 30 ? file.name.substring(0, 30) + '...' : file.name;
  ctx.fillText(filename, centerX, centerY + 85);
  
  // Draw file size
  ctx.fillStyle = '#64748b';
  ctx.font = '12px Arial';
  ctx.fillText(`${(file.size / 1024 / 1024).toFixed(1)}MB`, centerX, centerY + 105);
  
  // Convert canvas to blob and create URL
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(URL.createObjectURL(blob));
      } else {
        reject(new Error('Failed to create blob from canvas'));
      }
    }, 'image/png', 0.9);
  });
}

/**
 * Create a simple data URL fallback
 */
function createSimpleDataUrl(file: File): string {
  const svg = `
    <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
      <rect width="400" height="300" fill="#f8fafc" stroke="#e2e8f0" stroke-width="2"/>
      <circle cx="200" cy="120" r="40" fill="#3b82f6"/>
      <text x="200" y="125" text-anchor="middle" font-family="Arial" font-size="24" fill="white">📷</text>
      <text x="200" y="180" text-anchor="middle" font-family="Arial" font-size="18" font-weight="bold" fill="#1e293b">HEIC Image</text>
      <text x="200" y="205" text-anchor="middle" font-family="Arial" font-size="14" fill="#475569">${file.name}</text>
      <text x="200" y="225" text-anchor="middle" font-family="Arial" font-size="12" fill="#64748b">${(file.size / 1024 / 1024).toFixed(1)}MB</text>
    </svg>
  `;
  
  return 'data:image/svg+xml;base64,' + btoa(svg);
}

/**
 * Clean up preview URLs to prevent memory leaks
 */
export function revokeImagePreview(url: string): void {
  if (url && url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}
