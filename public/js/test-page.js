// Tab switching functionality
document.querySelectorAll('.tab-btn').forEach(button => {
    button.addEventListener('click', () => {
        // Remove active class from all tabs and buttons
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        // Add active class to clicked button and corresponding content
        button.classList.add('active');
        const tabId = button.getAttribute('data-tab') + '-tab';
        document.getElementById(tabId).classList.add('active');
        
        // Reset forms when switching tabs
        document.getElementById('uploadForm').reset();
        document.getElementById('enhancementForm').reset();
        document.getElementById('replaceElementsForm').reset();
        document.getElementById('result').style.display = 'none';
        
        // Reset file counter
        const fileCounter = document.getElementById('fileCounter');
        if (fileCounter) {
            fileCounter.classList.remove('show');
            document.getElementById('selectedFileCount').textContent = '0';
            const fileDetails = document.getElementById('fileDetails');
            if (fileDetails) {
                fileDetails.textContent = '';
            }
        }
    });
});

// Interior Design Form
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
        
        // Choose endpoint based on user preference
        const useInteriorDesign = document.getElementById('useInteriorDesign').checked;
        const endpoint = useInteriorDesign ? '/api/v1/interior-design' : '/api/v1/process-image';
        
        // For interior design endpoint, we need a prompt
        if (useInteriorDesign && !document.getElementById('prompt').value.trim()) {
            // Generate a prompt from the selected style
            const style = document.getElementById('style').value;
            const roomType = document.getElementById('roomType').value;
            const customPrompt = document.getElementById('prompt').value;
            const prompt = customPrompt.trim() || 'A ' + style + ' ' + roomType + ' with beautiful furniture, modern decor, and elegant lighting. The space should feel welcoming and professionally designed.';
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
            const modelUsed = useInteriorDesign ? 'Interior Design Model' : 'Standard AI Model';
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
                        '<h4>✨ AI-Decorated Room</h4>' +
                        '<img src="' + result.processedImage + '" alt="Decorated Room" loading="lazy">' +
                    '</div>' +
                '</div>' +
                '<div style="margin-top: 20px; padding: 15px; background: #e8f4fd; border-radius: 8px;">' +
                    '<strong>💡 Pro Tip:</strong> Right-click on images to save them to your computer!' +
                '</div>';
            successDiv.style.display = 'block';
        } else {
            errorDiv.querySelector('.result-content').innerHTML = `
                <h3 style="color: #721c24; margin-top: 0;">❌ Processing Failed</h3>
                <p><strong>Error:</strong> ${result.message || result.error}</p>
                <p>Please try again with a different image or adjust the settings.</p>
                <div style="margin-top: 15px; padding: 10px; background: #fff3cd; border-radius: 5px;">
                    <strong>💡 Tips:</strong>
                    <ul style="margin: 10px 0; padding-left: 20px;">
                        <li>Use clear, well-lit room photos</li>
                        <li>Try reducing the number of processing steps</li>
                        <li>Make sure your image is under 10MB</li>
                    </ul>
                </div>
            `;
            errorDiv.style.display = 'block';
        }
    } catch (error) {
        loadingDiv.style.display = 'none';
        errorDiv.querySelector('.result-content').innerHTML = `
            <h3 style="color: #721c24; margin-top: 0;">❌ Connection Error</h3>
            <p><strong>Error:</strong> ${error.message}</p>
            <p>Please make sure the server is running and try again.</p>
        `;
        errorDiv.style.display = 'block';
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '🚀 Transform Room with AI';
    }
});

// File upload preview
document.getElementById('image').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            // Could add image preview here if needed
        };
        reader.readAsDataURL(file);
    }
});

// Add event listener for room type selection to auto-generate prompts
document.getElementById('roomType').addEventListener('change', function() {
  generateRoomSpecificPrompt();
});

// Add event listener for style selection to auto-generate prompts
document.getElementById('style').addEventListener('change', function() {
  generateRoomSpecificPrompt();
});

// Add event listener for interior design checkbox to auto-generate prompt when checked
document.getElementById('useInteriorDesign').addEventListener('change', function() {
  if (document.getElementById('useInteriorDesign').checked) {
    generateRoomSpecificPrompt();
  }
});

// File counter functionality for enhancement form
document.getElementById('enhancementImage').addEventListener('change', function(e) {
    const files = e.target.files;
    const fileCounter = document.getElementById('fileCounter');
    const selectedFileCount = document.getElementById('selectedFileCount');
    const submitBtn = document.getElementById('enhancementSubmitBtn');
    
    if (files.length > 0) {
        // Validate file count
        if (files.length > 20) {
            alert('⚠️ Maximum 20 files allowed. Please select fewer files.');
            e.target.value = '';
            fileCounter.style.display = 'none';
            submitBtn.disabled = true;
            return;
        }
        
        // Validate file types and sizes
        const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
        const maxSize = 10 * 1024 * 1024; // 10MB
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            
            if (!validTypes.includes(file.type)) {
                alert(`⚠️ Invalid file type: ${file.name}. Please select only JPG, PNG, WebP, or HEIC files.`);
                e.target.value = '';
                fileCounter.style.display = 'none';
                submitBtn.disabled = true;
                return;
            }
            
            if (file.size > maxSize) {
                alert(`⚠️ File too large: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 10MB.`);
                e.target.value = '';
                fileCounter.style.display = 'none';
                submitBtn.disabled = true;
                return;
            }
        }
        
        // Show file counter and enable submit button
        selectedFileCount.textContent = files.length;
        
        // Show file details
        const fileDetails = document.getElementById('fileDetails');
        if (fileDetails) {
            let detailsText = '';
            if (files.length === 1) {
                detailsText = `${files[0].name} (${(files[0].size / 1024 / 1024).toFixed(1)}MB)`;
            } else {
                const totalSize = Array.from(files).reduce((sum, file) => sum + file.size, 0);
                detailsText = `${files.length} files, ${(totalSize / 1024 / 1024).toFixed(1)}MB total`;
            }
            fileDetails.textContent = detailsText;
        }
        
        fileCounter.classList.add('show');
        submitBtn.disabled = false;
        
        // Update button text to show file count
        submitBtn.textContent = `✨ Enhance ${files.length} Image${files.length > 1 ? 's' : ''}`;
    } else {
        fileCounter.classList.remove('show');
        submitBtn.disabled = true;
        submitBtn.textContent = '✨ Enhance Images';
    }
});

// Image Enhancement Form
document.getElementById('enhancementForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const resultDiv = document.getElementById('result');
    const loadingDiv = document.getElementById('loading');
    const successDiv = document.getElementById('success');
    const errorDiv = document.getElementById('error');
    const submitBtn = document.getElementById('enhancementSubmitBtn');
    
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
        // Prepare form data for multiple images
        const formData = new FormData();
        const files = document.getElementById('enhancementImage').files;
        
        // Append all selected images - use 'image' field name to match backend API
        for (let i = 0; i < files.length; i++) {
            formData.append('image', files[i]);
        }
        
        const referenceImage = document.getElementById('referenceImage').files[0];
        if (referenceImage) {
            formData.append('referenceImage', referenceImage);
        }
        
        formData.append('enhancementType', document.getElementById('enhancementType').value);
        formData.append('enhancementStrength', document.getElementById('enhancementStrength').value);
        
        const startTime = Date.now();
        
        // Update loading message to show progress
        const loadingMessage = document.querySelector('#loading h3');
        if (loadingMessage) {
            if (files.length === 1) {
                loadingMessage.textContent = '🤖 AI is processing your image...';
            } else {
                loadingMessage.textContent = `🤖 AI is processing ${files.length} images in parallel...`;
            }
        }
        
        const response = await fetch('/api/v1/image-enhancement', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        const endTime = Date.now();
        
        // Debug logging
        console.log('🔍 Image Enhancement Response:', result);
        
        loadingDiv.style.display = 'none';
        
        if (result.success) {
            // Handle multiple image results
            let imagesHTML = '';
            let isMultipleImages = false;
            
            if (result.data.enhancedImages && result.data.enhancedImages.length > 0) {
                // Multiple images were processed
                isMultipleImages = true;
                for (let i = 0; i < result.data.enhancedImages.length; i++) {
                    const originalImage = result.data.originalImages ? result.data.originalImages[i] : '';
                    const enhancedImage = result.data.enhancedImages[i];
                    const fileName = files[i] ? files[i].name : `Image ${i + 1}`;
                    
                    imagesHTML += `
                        <div class="image-container multiple">
                            <h4>📸 ${fileName}</h4>
                            <div class="before-after-container">
                                ${originalImage ? `<div class="before-after-item"><span class="label">Before</span><img src="${originalImage}" alt="Original ${fileName}" loading="lazy"></div>` : ''}
                                <div class="before-after-item"><span class="label">After</span><img src="${enhancedImage}" alt="Enhanced ${fileName}" loading="lazy"></div>
                            </div>
                        </div>
                    `;
                }
            } else if (result.data.enhancedImage) {
                // Single image result (fallback for backward compatibility)
                imagesHTML = `
                    <div class="image-container">
                        <h4>📸 Image Enhancement</h4>
                        <div class="before-after-container">
                            ${result.data.originalImage ? `<div class="before-after-item"><span class="label">Before</span><img src="${result.data.originalImage}" alt="Original Image" loading="lazy"></div>` : ''}
                            <div class="before-after-item"><span class="label">After</span><img src="${result.data.enhancedImage}" alt="Enhanced Image" loading="lazy"></div>
                        </div>
                    </div>
                `;
            }
            
            successDiv.querySelector('.result-content').innerHTML = 
                '<h3 style="color: #155724; margin-top: 0;">🎉 Image Enhancement Complete!</h3>' +
                '<div class="stats">' +
                    '<div class="stat">' +
                        '<div class="stat-value">' + (result.data.processingTime / 1000).toFixed(1) + 's</div>' +
                        '<div class="stat-label">Total Time</div>' +
                    '</div>' +
                    '<div class="stat">' +
                        '<div class="stat-value">' + files.length + '</div>' +
                        '<div class="stat-label">Images Processed</div>' +
                    '</div>' +
                    '<div class="stat">' +
                        '<div class="stat-value">' + (result.data.processingTime / files.length / 1000).toFixed(1) + 's</div>' +
                        '<div class="stat-label">Avg/Image</div>' +
                    '</div>' +
                '</div>' +
                '<div class="images' + (isMultipleImages ? ' multiple' : '') + '">' + imagesHTML + '</div>' +
                '<div style="margin-top: 20px; padding: 15px; background: #e8f4fd; border-radius: 8px;">' +
                    '<strong>💡 Pro Tip:</strong> Right-click on images to save them to your computer!' +
                '</div>';
            successDiv.style.display = 'block';
        } else {
            errorDiv.querySelector('.result-content').innerHTML = 
                '<h3 style="color: #721c24; margin-top: 0;">❌ Enhancement Failed</h3>' +
                '<p><strong>Error:</strong> ' + (result.message || result.error) + '</p>' +
                '<p>Please try again with a different image or adjust the settings.</p>' +
                '<div style="margin-top: 15px; padding: 10px; background: #fff3cd; border-radius: 5px;">' +
                    '<strong>💡 Tips:</strong>' +
                    '<ul style="margin: 10px 0; padding-left: 20px;">' +
                        '<li>Use clear, well-lit images</li>' +
                        '<li>Reference image should have good lighting/colors</li>' +
                        '<li>Make sure your image is under 10MB</li>' +
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
        const files = document.getElementById('enhancementImage').files;
        if (files.length > 0) {
            submitBtn.textContent = `✨ Enhance ${files.length} Image${files.length > 1 ? 's' : ''}`;
        } else {
            submitBtn.textContent = '✨ Enhance Images';
        }
    }
});

// Replace Elements Form
document.getElementById('replaceElementsForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const resultDiv = document.getElementById('result');
    const loadingDiv = document.getElementById('loading');
    const successDiv = document.getElementById('success');
    const errorDiv = document.getElementById('error');
    const submitBtn = document.getElementById('replaceElementsSubmitBtn');
    
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
        formData.append('image', document.getElementById('replaceElementsImage').files[0]);
        formData.append('prompt', document.getElementById('replacePrompt').value);
        formData.append('outputFormat', document.getElementById('outputFormat').value);
        
        const startTime = Date.now();
        
        const response = await fetch('/api/v1/replace-elements', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        const endTime = Date.now();
        
        // Debug logging
        console.log('🔍 Replace Elements Response:', result);
        
        loadingDiv.style.display = 'none';
        
        if (result.success) {
            successDiv.querySelector('.result-content').innerHTML = 
                '<h3 style="color: #155724; margin-top: 0;">🎉 Element Replacement Complete!</h3>' +
                '<div class="stats">' +
                    '<div class="stat">' +
                        '<div class="stat-value">' + (result.data.processingTime / 1000).toFixed(1) + 's</div>' +
                        '<div class="stat-label">Processing Time</div>' +
                    '</div>' +
                    '<div class="stat">' +
                        '<div class="stat-value">' + document.getElementById('replacePrompt').value.substring(0, 20) + '...</div>' +
                        '<div class="stat-label">Transformation</div>' +
                    '</div>' +
                    '<div class="stat">' +
                        '<div class="stat-value">' + document.getElementById('outputFormat').value.toUpperCase() + '</div>' +
                        '<div class="stat-label">Output Format</div>' +
                    '</div>' +
                '</div>' +
                '<div class="images">' +
                    '<div class="image-container">' +
                        '<h4>📸 Original Image</h4>' +
                        '<img src="' + result.data.originalImage + '" alt="Original Image" loading="lazy">' +
                    '</div>' +
                    '<div class="image-container">' +
                        '<h4>🎨 Transformed Image</h4>' +
                        '<img src="' + result.data.replacedImage + '" alt="Transformed Image" loading="lazy">' +
                    '</div>' +
                '</div>' +
                '<div style="margin-top: 20px; padding: 15px; background: #e8f4fd; border-radius: 8px;">' +
                    '<strong>💡 Pro Tip:</strong> Right-click on images to save them to your computer!<br>' +
                    '<strong>🎨 Creative Ideas:</strong> Try prompts like "cyberpunk style", "watercolor painting", "vintage film", "anime style"'
                '</div>';
            successDiv.style.display = 'block';
        } else {
            errorDiv.querySelector('.result-content').innerHTML = 
                '<h3 style="color: #721c24; margin-top: 0;">❌ Element Replacement Failed</h3>' +
                '<p><strong>Error:</strong> ' + (result.message || result.error) + '</p>' +
                '<p>Please try again with a different image or adjust the prompt.</p>' +
                '<div style="margin-top: 15px; padding: 10px; background: #fff3cd; border-radius: 5px;">' +
                    '<strong>💡 Tips:</strong>' +
                    '<ul style="margin: 10px 0; padding-left: 20px;">' +
                        '<li>Use clear, descriptive prompts</li>' +
                        '<li>Try different artistic styles and themes</li>' +
                        '<li>Make sure your image is under 10MB</li>' +
                        '<li>Experiment with creative transformations</li>' +
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
        submitBtn.textContent = '🎨 Transform Image';
    }
});

// Function to generate room-specific prompts
function generateRoomSpecificPrompt() {
  const roomTypeSelect = document.getElementById('roomType');
  const styleSelect = document.getElementById('style');
  const promptField = document.getElementById('prompt');
  const useInteriorDesignCheckbox = document.getElementById('useInteriorDesign');
  
  // Only auto-generate prompt if interior design model is selected
  if (useInteriorDesignCheckbox.checked) {
    const selectedRoomType = roomTypeSelect.value;
    const selectedStyle = styleSelect.value;
    
    // Generate room-specific prompts
    const roomSpecificPrompts = {
      'living-room': {
        'modern-minimalist': 'Modern minimalist living room with clean lines, comfortable seating arrangement, coffee table, area rug, ambient lighting and table lamps, wall art and plants. The space should feel welcoming and social space perfect for entertaining and relaxation. Professionally staged, perfect lighting, high-end photography, realistic proportions.',
        'traditional-elegant': 'Traditional elegant living room with classic furniture, rich textures, fireplace, comfortable seating arrangement, coffee table, area rug, ambient lighting and table lamps, wall art and decorative pillows. The space should feel welcoming and social space perfect for entertaining and relaxation. Professionally staged, perfect lighting, high-end photography, realistic proportions.',
        'contemporary-luxury': 'Contemporary luxury living room with premium materials, statement lighting, comfortable seating arrangement, coffee table, area rug, ambient lighting and floor lamps, wall art and throw blankets. The space should feel welcoming and social space perfect for entertaining and relaxation. Professionally staged, perfect lighting, high-end photography, realistic proportions.',
        'cozy-rustic': 'Cozy rustic living room with natural wood elements, stone fireplace, comfortable seating arrangement, coffee table, area rug, ambient lighting and table lamps, wall art and plants. The space should feel welcoming and social space perfect for entertaining and relaxation. Professionally staged, perfect lighting, high-end photography, realistic proportions.',
        'scandinavian': 'Scandinavian living room with light wood, neutral colors, comfortable seating arrangement, coffee table, area rug, natural light and ambient lighting, plants and throw blankets. The space should feel welcoming and social space perfect for entertaining and relaxation. Professionally staged, perfect lighting, high-end photography, realistic proportions.',
        'industrial-chic': 'Industrial chic living room with exposed brick, metal accents, comfortable seating arrangement, coffee table, area rug, ambient lighting and floor lamps, wall art and accent chairs. The space should feel welcoming and social space perfect for entertaining and relaxation. Professionally staged, perfect lighting, high-end photography, realistic proportions.',
        'coastal-calm': 'Coastal calm living room with light blues, natural textures, comfortable seating arrangement, coffee table, area rug, ambient lighting and table lamps, plants and throw blankets. The space should feel welcoming and social space perfect for entertaining and relaxation. Professionally staged, perfect lighting, high-end photography, realistic proportions.',
        'bohemian-eclectic': 'Bohemian eclectic living room with mixed patterns, vibrant colors, comfortable seating arrangement, coffee table, area rug, ambient lighting and floor lamps, wall art and decorative pillows. The space should feel welcoming and social space perfect for entertaining and relaxation. Professionally staged, perfect lighting, high-end photography, realistic proportions.',
        'mid-century-modern': 'Mid-century modern living room with retro furniture, clean geometry, comfortable seating arrangement, coffee table, area rug, ambient lighting and table lamps, wall art and accent chairs. The space should feel welcoming and social space perfect for entertaining and relaxation. Professionally staged, perfect lighting, high-end photography, realistic proportions.',
        'french-country': 'French country living room with elegant antiques, soft colors, comfortable seating arrangement, coffee table, area rug, ambient lighting and table lamps, wall art and decorative pillows. The space should feel welcoming and social space perfect for entertaining and relaxation. Professionally staged, perfect lighting, high-end photography, realistic proportions.',
        'asian-zen': 'Asian zen living room with natural materials, balanced proportions, comfortable seating arrangement, coffee table, area rug, ambient lighting and natural light, plants and wall art. The space should feel welcoming and social space perfect for entertaining and relaxation. Professionally staged, perfect lighting, high-end photography, realistic proportions.',
        'mediterranean': 'Mediterranean living room with warm colors, arched elements, comfortable seating arrangement, coffee table, area rug, ambient lighting and table lamps, wall art and decorative pillows. The space should feel welcoming and social space perfect for entertaining and relaxation. Professionally staged, perfect lighting, high-end photography, realistic proportions.'
      },
      'bedroom': {
        'modern-minimalist': 'Modern minimalist bedroom with clean lines, bed with quality bedding, nightstands, dresser, bedside lamps and ambient lighting, decorative pillows and window treatments. The space should feel peaceful and restful sanctuary for sleep and relaxation. Professionally staged, perfect lighting, high-end photography, realistic proportions.',
        'traditional-elegant': 'Traditional elegant bedroom with classic furniture, warm wood tones, bed with quality bedding, nightstands, dresser, bedside lamps and ambient lighting, decorative pillows and area rug. The space should feel peaceful and restful sanctuary for sleep and relaxation. Professionally staged, perfect lighting, high-end photography, realistic proportions.',
        'contemporary-luxury': 'Contemporary luxury bedroom with premium materials, sophisticated design, bed with quality bedding, nightstands, dresser, bedside lamps and dimmable fixtures, decorative pillows and personal touches. The space should feel peaceful and restful sanctuary for sleep and relaxation. Professionally staged, perfect lighting, high-end photography, realistic proportions.',
        'cozy-rustic': 'Cozy rustic bedroom with natural wood elements, warm textures, bed with quality bedding, nightstands, dresser, bedside lamps and ambient lighting, decorative pillows and area rug. The space should feel peaceful and restful sanctuary for sleep and relaxation. Professionally staged, perfect lighting, high-end photography, realistic proportions.',
        'scandinavian': 'Scandinavian bedroom with light wood, neutral colors, bed with quality bedding, nightstands, dresser, natural light and ambient lighting, decorative pillows and window treatments. The space should feel peaceful and restful sanctuary for sleep and relaxation. Professionally staged, perfect lighting, high-end photography, realistic proportions.',
        'industrial-chic': 'Industrial chic bedroom with exposed elements, metal fixtures, bed with quality bedding, nightstands, dresser, bedside lamps and ambient lighting, decorative pillows and area rug. The space should feel peaceful and restful sanctuary for sleep and relaxation. Professionally staged, perfect lighting, high-end photography, realistic proportions.',
        'coastal-calm': 'Coastal calm bedroom with light blues, natural textures, bed with quality bedding, nightstands, dresser, bedside lamps and ambient lighting, decorative pillows and window treatments. The space should feel peaceful and restful sanctuary for sleep and relaxation. Professionally staged, perfect lighting, high-end photography, realistic proportions.',
        'bohemian-eclectic': 'Bohemian eclectic bedroom with mixed patterns, vibrant colors, bed with quality bedding, nightstands, dresser, bedside lamps and ambient lighting, decorative pillows and personal touches. The space should feel peaceful and restful sanctuary for sleep and relaxation. Professionally staged, perfect lighting, high-end photography, realistic proportions.',
        'mid-century-modern': 'Mid-century modern bedroom with retro furniture, clean geometry, bed with quality bedding, nightstands, dresser, bedside lamps and ambient lighting, decorative pillows and area rug. The space should feel peaceful and restful sanctuary for sleep and relaxation. Professionally staged, perfect lighting, high-end photography, realistic proportions.',
        'french-country': 'French country bedroom with elegant antiques, soft colors, bed with quality bedding, nightstands, dresser, bedside lamps and ambient lighting, decorative pillows and window treatments. The space should feel peaceful and restful sanctuary for sleep and relaxation. Professionally staged, perfect lighting, high-end photography, realistic proportions.',
        'asian-zen': 'Asian zen bedroom with natural materials, balanced proportions, bed with quality bedding, nightstands, dresser, bedside lamps and natural light, decorative pillows and area rug. The space should feel peaceful and restful sanctuary for sleep and relaxation. Professionally staged, perfect lighting, high-end photography, realistic proportions.',
        'mediterranean': 'Mediterranean bedroom with warm colors, arched elements, bed with quality bedding, nightstands, dresser, bedside lamps and ambient lighting, decorative pillows and personal touches. The space should feel peaceful and restful sanctuary for sleep and relaxation. Professionally staged, perfect lighting, high-end photography, realistic proportions.'
      },
      'kitchen': {
        'modern-minimalist': 'Modern minimalist kitchen with clean lines, modern appliances, clean countertops, stylish backsplash, pendant lighting and under-cabinet lighting, decorative bowls and fresh flowers. The space should feel functional and beautiful space perfect for cooking and gathering. Professionally staged, perfect lighting, high-end photography, realistic proportions.',
        'traditional-elegant': 'Traditional elegant kitchen with classic design, modern appliances, clean countertops, stylish backsplash, pendant lighting and natural light, decorative bowls and herb garden. The space should feel functional and beautiful space perfect for cooking and gathering. Professionally staged, perfect lighting, high-end photography, realistic proportions.',
        'contemporary-luxury': 'Contemporary luxury kitchen with premium materials, modern appliances, clean countertops, stylish backsplash, pendant lighting and under-cabinet lighting, decorative bowls and artwork. The space should feel functional and beautiful space perfect for cooking and gathering. Professionally staged, perfect lighting, high-end photography, realistic proportions.',
        'cozy-rustic': 'Cozy rustic kitchen with natural wood elements, modern appliances, clean countertops, stylish backsplash, pendant lighting and natural light, fresh flowers and herb garden. The space should feel functional and beautiful space perfect for cooking and gathering. Professionally staged, perfect lighting, high-end photography, realistic proportions.',
        'scandinavian': 'Scandinavian kitchen with light wood, neutral colors, modern appliances, clean countertops, stylish backsplash, natural light and pendant lighting, fresh flowers and decorative bowls. The space should feel functional and beautiful space perfect for cooking and gathering. Professionally staged, perfect lighting, high-end photography, realistic proportions.',
        'industrial-chic': 'Industrial chic kitchen with exposed elements, metal fixtures, modern appliances, clean countertops, stylish backsplash, pendant lighting and under-cabinet lighting, artwork and decorative bowls. The space should feel functional and beautiful space perfect for cooking and gathering. Professionally staged, perfect lighting, high-end photography, realistic proportions.',
        'coastal-calm': 'Coastal calm kitchen with light blues, natural textures, modern appliances, clean countertops, stylish backsplash, pendant lighting and natural light, fresh flowers and herb garden. The space should feel functional and beautiful space perfect for cooking and gathering. Professionally staged, perfect lighting, high-end photography, realistic proportions.',
        'bohemian-eclectic': 'Bohemian eclectic kitchen with mixed patterns, vibrant colors, modern appliances, clean countertops, stylish backsplash, pendant lighting and natural light, fresh flowers and artwork. The space should feel functional and beautiful space perfect for cooking and gathering. Professionally staged, perfect lighting, high-end photography, realistic proportions.',
        'mid-century-modern': 'Mid-century modern kitchen with retro design, modern appliances, clean countertops, stylish backsplash, pendant lighting and under-cabinet lighting, decorative bowls and fresh flowers. The space should feel functional and beautiful space perfect for cooking and gathering. Professionally staged, perfect lighting, high-end photography, realistic proportions.',
        'french-country': 'French country kitchen with elegant design, modern appliances, clean countertops, stylish backsplash, pendant lighting and natural light, fresh flowers and herb garden. The space should feel functional and beautiful space perfect for cooking and gathering. Professionally staged, perfect lighting, high-end photography, realistic proportions.',
        'asian-zen': 'Asian zen kitchen with natural materials, balanced proportions, modern appliances, clean countertops, stylish backsplash, natural light and pendant lighting, fresh flowers and decorative bowls. The space should feel functional and beautiful space perfect for cooking and gathering. Professionally staged, perfect lighting, high-end photography, realistic proportions.',
        'mediterranean': 'Mediterranean kitchen with warm colors, arched elements, modern appliances, clean countertops, stylish backsplash, pendant lighting and natural light, fresh flowers and herb garden. The space should feel functional and beautiful space perfect for cooking and gathering. Professionally staged, perfect lighting, high-end photography, realistic proportions.'
      }
    };
    
    // Get the prompt for the selected room type and style
    const roomPrompts = roomSpecificPrompts[selectedRoomType];
    if (roomPrompts && roomPrompts[selectedStyle]) {
      // Replace the current prompt content with the new room-specific prompt
      promptField.value = roomPrompts[selectedStyle];
      // Focus on the prompt field so user can edit it
      promptField.focus();
      // Select all text for easy editing
      promptField.select();
    } else {
      // Fallback prompt if specific combination not found
      const fallbackPrompt = selectedStyle.replace('-', ' ') + ' ' + selectedRoomType.replace('-', ' ') + ' with beautiful furniture, modern decor, and elegant lighting. The space should feel welcoming and professionally designed.';
      promptField.value = fallbackPrompt;
      promptField.focus();
      promptField.select();
    }
  }
}
