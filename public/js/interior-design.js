// Interior Design Form Handler
document.getElementById('uploadForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const resultDiv = document.getElementById('result');
    const loadingDiv = document.getElementById('loading');
    const successDiv = document.getElementById('success');
    const errorDiv = document.getElementById('error');
    const submitBtn = document.getElementById('submitBtn');
    
    // Show loading
    resultDiv.style.display = 'block';
    loadingDiv.style.display = 'block';
    successDiv.style.display = 'none';
    errorDiv.style.display = 'none';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Processing...';
    
    // Scroll to results
    resultDiv.scrollIntoView({ behavior: 'smooth' });
    
    try {
        // Prepare form data
        const formData = new FormData();
        formData.append('image', document.getElementById('image').files[0]);
        formData.append('roomType', document.getElementById('roomType').value);
        formData.append('style', document.getElementById('style').value);
        formData.append('prompt', document.getElementById('prompt').value);
        formData.append('negativePrompt', document.getElementById('negativePrompt').value);
        formData.append('guidance', document.getElementById('guidance').value);
        formData.append('steps', document.getElementById('steps').value);
        formData.append('strength', document.getElementById('strength').value);
        
        const startTime = Date.now();
        
        // Always use interior design endpoint
        const endpoint = '/api/v1/interior-design';
        
        // Generate a prompt if none provided
        if (!document.getElementById('prompt').value.trim()) {
            const style = document.getElementById('style').value;
            const roomType = document.getElementById('roomType').value;
            const prompt = 'A ' + style + ' ' + roomType + ' with beautiful furniture, modern decor, and elegant lighting. The space should feel welcoming and professionally designed.';
            formData.set('prompt', prompt);
        }
        
        const response = await fetch(endpoint, {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        const endTime = Date.now();
        
        loadingDiv.style.display = 'none';
        
        if (result.success) {
            successDiv.querySelector('.result-content').innerHTML = 
                '<h3 style="color: #155724; margin-top: 0;">🎉 Room Transformation Complete!</h3>' +
                '<div class="stats">' +
                    '<div class="stat">' +
                        '<div class="stat-value">' + (result.processingTime / 1000).toFixed(1) + 's</div>' +
                        '<div class="stat-label">Processing Time</div>' +
                    '</div>' +
                    '<div class="stat">' +
                        '<div class="stat-value">' + document.getElementById('steps').value + '</div>' +
                        '<div class="stat-label">AI Steps</div>' +
                    '</div>' +
                    '<div class="stat">' +
                        '<div class="stat-value">' + document.getElementById('guidance').value + '</div>' +
                        '<div class="stat-label">Guidance</div>' +
                    '</div>' +
                '</div>' +
                '<div class="images">' +
                    '<div class="image-container">' +
                        '<h4>📸 Original Room</h4>' +
                        '<img src="' + result.originalImage + '" alt="Original Room" loading="lazy">' +
                    '</div>' +
                    '<div class="image-container">' +
                        '<h4>🏠 Transformed Room</h4>' +
                        '<img src="' + result.processedImage + '" alt="Transformed Room" loading="lazy">' +
                    '</div>' +
                '</div>' +
                '<div style="margin-top: 20px; padding: 15px; background: #e8f4fd; border-radius: 8px;">' +
                    '<strong>💡 Pro Tip:</strong> Right-click on images to save them to your computer!<br>' +
                    '<strong>🎨 Room Ideas:</strong> Try different styles like "modern minimalist", "cozy rustic", or "scandinavian" for varied results' +
                '</div>';
            successDiv.style.display = 'block';
        } else {
            errorDiv.querySelector('.result-content').innerHTML = 
                '<h3 style="color: #721c24; margin-top: 0;">❌ Room Transformation Failed</h3>' +
                '<p><strong>Error:</strong> ' + (result.message || result.error) + '</p>' +
                '<p>Please try again with a different image or adjust your description.</p>' +
                '<div style="margin-top: 15px; padding: 10px; background: #fff3cd; border-radius: 5px;">' +
                    '<strong>💡 Tips:</strong>' +
                    '<ul style="margin: 10px 0; padding-left: 20px;">' +
                        '<li>Use clear, descriptive room descriptions</li>' +
                        '<li>Try different decoration styles</li>' +
                        '<li>Make sure your image is under 10MB</li>' +
                        '<li>Upload clear, well-lit room photos</li>' +
                    '</ul>' +
                '</div>';
            errorDiv.style.display = 'block';
        }
    } catch (error) {
        loadingDiv.style.display = 'none';
        errorDiv.querySelector('.result-content').innerHTML = 
            '<h3 style="color: #721c24; margin-top: 0;">❌ Connection Error</h3>' +
            '<p><strong>Error:</strong> ' + error.message + '</p>' +
            '<p>Please make sure the server is running and try again.</p>';
        errorDiv.style.display = 'block';
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '🚀 Transform Room with AI';
    }
});

// Auto-generate prompts based on room type and style
document.getElementById('roomType').addEventListener('change', function() {
    generateRoomSpecificPrompt();
});

document.getElementById('style').addEventListener('change', function() {
    generateRoomSpecificPrompt();
});

// Function to generate room-specific prompts
function generateRoomSpecificPrompt() {
    const roomTypeSelect = document.getElementById('roomType');
    const styleSelect = document.getElementById('style');
    const promptField = document.getElementById('prompt');
    
    if (roomTypeSelect.value && styleSelect.value) {
        const roomType = roomTypeSelect.options[roomTypeSelect.selectedIndex].text;
        const style = styleSelect.options[styleSelect.selectedIndex].text;
        
        // Only update if user hasn't written their own prompt
        if (!promptField.value.trim()) {
            const prompt = `A ${style.toLowerCase()} ${roomType.toLowerCase()} with beautiful furniture, modern decor, and elegant lighting. The space should feel welcoming and professionally designed.`;
            promptField.value = prompt;
        }
    }
}

// Initialize with a default prompt
document.addEventListener('DOMContentLoaded', function() {
    generateRoomSpecificPrompt();
});
