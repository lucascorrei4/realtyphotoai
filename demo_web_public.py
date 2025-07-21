#!/usr/bin/env python3
"""
Public web demo for Real Estate Graphic Designer
Accessible from external connections
"""

import os
import tempfile
import base64
from http.server import HTTPServer, BaseHTTPRequestHandler
import urllib.parse
import json
from demo_agent import DemoRealEstateGraphicDesigner

class ImageUploadHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        """Serve the upload form"""
        if self.path == '/':
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            
            html = '''
            <!DOCTYPE html>
            <html>
            <head>
                <title>🏠 Real Estate Graphic Designer Demo</title>
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <style>
                    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background: #f8f9fa; }
                    .container { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                    .header { text-align: center; margin-bottom: 30px; }
                    .upload-area { border: 2px dashed #007bff; padding: 40px; text-align: center; margin: 20px 0; border-radius: 10px; transition: all 0.3s; }
                    .upload-area:hover { border-color: #0056b3; background: #f8f9ff; }
                    .upload-area.dragover { border-color: #0056b3; background: #e3f2fd; }
                    input[type="file"] { margin: 10px 0; padding: 10px; }
                    button { background: #007bff; color: white; padding: 12px 24px; border: none; border-radius: 5px; cursor: pointer; font-size: 16px; }
                    button:hover { background: #0056b3; }
                    button:disabled { background: #ccc; cursor: not-allowed; }
                    .result { margin-top: 20px; padding: 20px; background: #f8f9fa; border-radius: 5px; border-left: 4px solid #007bff; }
                    .error { color: #dc3545; background: #f8d7da; border-color: #dc3545; }
                    .success { color: #155724; background: #d4edda; border-color: #28a745; }
                    .loading { color: #856404; background: #fff3cd; border-color: #ffc107; }
                    .feature-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
                    .feature-item { padding: 15px; background: #f8f9fa; border-radius: 5px; text-align: center; }
                    .examples { margin-top: 30px; }
                    .example-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; }
                    .example-item { padding: 10px; background: #e9ecef; border-radius: 5px; font-size: 14px; }
                    @media (max-width: 600px) { .container { padding: 15px; } }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🏠 Ultra-Realistic Real Estate Graphic Designer</h1>
                        <p>Upload a photo of any room to get professional enhancement suggestions!</p>
                    </div>
                    
                    <div class="feature-list">
                        <div class="feature-item">
                            <h4>🎯 Room Detection</h4>
                            <p>Identifies room types automatically</p>
                        </div>
                        <div class="feature-item">
                            <h4>🎨 Style Analysis</h4>
                            <p>Recognizes interior design styles</p>
                        </div>
                        <div class="feature-item">
                            <h4>🧹 Clutter Detection</h4>
                            <p>Suggests organization improvements</p>
                        </div>
                        <div class="feature-item">
                            <h4>💡 Smart Suggestions</h4>
                            <p>Provides actionable enhancements</p>
                        </div>
                    </div>
                    
                    <form id="uploadForm" enctype="multipart/form-data" method="post">
                        <div class="upload-area" id="uploadArea">
                            <h3>📸 Upload Room Photo</h3>
                            <p>Drag and drop an image here, or click to browse</p>
                            <input type="file" id="imageFile" name="image" accept="image/*" required>
                            <br><br>
                            <button type="submit" id="submitBtn">🎨 Generate Enhancement Suggestion</button>
                        </div>
                    </form>
                    
                    <div id="result" class="result" style="display: none;"></div>
                    
                    <div class="examples">
                        <h3>💡 How it works:</h3>
                        <ol>
                            <li><strong>Upload</strong> a photo of any room (living room, kitchen, bedroom, etc.)</li>
                            <li><strong>AI Analysis</strong> identifies room type, style, and improvement areas</li>
                            <li><strong>Get Suggestion</strong> receives a detailed enhancement recommendation</li>
                        </ol>
                        
                        <h3>📋 Example Enhancement Suggestions:</h3>
                        <div class="example-grid">
                            <div class="example-item">
                                <strong>Modern Kitchen:</strong><br>
                                "Enhance countertops with quartz surfaces, remove clutter including dishes"
                            </div>
                            <div class="example-item">
                                <strong>Traditional Bedroom:</strong><br>
                                "Add classic wooden bed frame, remove modern elements"
                            </div>
                            <div class="example-item">
                                <strong>Cluttered Living Room:</strong><br>
                                "Add modern coffee table with clean lines, declutter surfaces, remove clutter"
                            </div>
                            <div class="example-item">
                                <strong>Empty Bathroom:</strong><br>
                                "Enhance vanity with modern vessel sink, remove personal toiletries"
                            </div>
                        </div>
                        
                        <h3>🎯 Pro Tips:</h3>
                        <ul>
                            <li>Name your files descriptively (e.g., "modern_kitchen.jpg", "cluttered_bedroom.jpg")</li>
                            <li>Use good lighting and clear photos for best results</li>
                            <li>Include main furniture and room layout in the shot</li>
                            <li>Supports JPG, PNG, GIF, WebP, and BMP formats</li>
                        </ul>
                    </div>
                </div>
                
                <script>
                    // Drag and drop functionality
                    const uploadArea = document.getElementById('uploadArea');
                    const fileInput = document.getElementById('imageFile');
                    
                    uploadArea.addEventListener('dragover', (e) => {
                        e.preventDefault();
                        uploadArea.classList.add('dragover');
                    });
                    
                    uploadArea.addEventListener('dragleave', () => {
                        uploadArea.classList.remove('dragover');
                    });
                    
                    uploadArea.addEventListener('drop', (e) => {
                        e.preventDefault();
                        uploadArea.classList.remove('dragover');
                        
                        const files = e.dataTransfer.files;
                        if (files.length > 0) {
                            fileInput.files = files;
                        }
                    });
                    
                    // Form submission
                    document.getElementById('uploadForm').addEventListener('submit', function(e) {
                        e.preventDefault();
                        
                        const formData = new FormData();
                        const imageFile = document.getElementById('imageFile').files[0];
                        const submitBtn = document.getElementById('submitBtn');
                        
                        if (!imageFile) {
                            alert('Please select an image file');
                            return;
                        }
                        
                        formData.append('image', imageFile);
                        
                        // Show loading
                        const resultDiv = document.getElementById('result');
                        resultDiv.style.display = 'block';
                        resultDiv.className = 'result loading';
                        resultDiv.innerHTML = '<p>🔄 Analyzing image and generating enhancement suggestion...</p>';
                        
                        submitBtn.disabled = true;
                        submitBtn.textContent = 'Processing...';
                        
                        fetch('/', {
                            method: 'POST',
                            body: formData
                        })
                        .then(response => response.json())
                        .then(data => {
                            if (data.error) {
                                resultDiv.className = 'result error';
                                resultDiv.innerHTML = '<p>❌ Error: ' + data.error + '</p>';
                            } else {
                                resultDiv.className = 'result success';
                                resultDiv.innerHTML = `
                                    <h3>📊 Analysis Results:</h3>
                                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 15px 0;">
                                        <div><strong>Room Type:</strong> ${data.room_type}</div>
                                        <div><strong>Style:</strong> ${data.style}</div>
                                        <div><strong>Image Size:</strong> ${data.width}x${data.height}</div>
                                        <div><strong>Filename:</strong> ${data.filename}</div>
                                    </div>
                                    <hr>
                                    <h3>🎨 Enhancement Suggestion:</h3>
                                    <p style="font-size: 18px; font-weight: bold; color: #155724; padding: 15px; background: white; border-radius: 5px; margin: 10px 0;">
                                        ${data.suggestion}
                                    </p>
                                    <p style="font-size: 14px; color: #666; margin-top: 15px;">
                                        💡 This suggestion focuses on photorealistic enhancements while preserving structural elements like windows, doors, and room layout.
                                    </p>
                                `;
                            }
                        })
                        .catch(error => {
                            resultDiv.className = 'result error';
                            resultDiv.innerHTML = '<p>❌ Error: ' + error.message + '</p>';
                        })
                        .finally(() => {
                            submitBtn.disabled = false;
                            submitBtn.textContent = '🎨 Generate Enhancement Suggestion';
                        });
                    });
                </script>
            </body>
            </html>
            '''
            self.wfile.write(html.encode())
        else:
            self.send_error(404)
    
    def do_POST(self):
        """Handle image upload and processing"""
        try:
            # Parse the form data
            content_type = self.headers.get('Content-Type', '')
            if not content_type.startswith('multipart/form-data'):
                self.send_error(400, "Bad Request")
                return
            
            # Get content length
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length == 0:
                self.send_json_response({"error": "No data received"})
                return
            
            # Read the form data
            form_data = self.rfile.read(content_length)
            
            # Parse multipart form data (simplified)
            boundary = content_type.split('boundary=')[1].encode()
            parts = form_data.split(b'--' + boundary)
            
            image_data = None
            filename = "uploaded_image.jpg"
            
            for part in parts:
                if b'Content-Disposition: form-data; name="image"' in part:
                    # Extract filename if present
                    if b'filename=' in part:
                        filename_start = part.find(b'filename="') + len(b'filename="')
                        filename_end = part.find(b'"', filename_start)
                        filename = part[filename_start:filename_end].decode()
                    
                    # Find the start of image data
                    data_start = part.find(b'\r\n\r\n') + 4
                    if data_start > 3:
                        image_data = part[data_start:]
                        # Remove trailing boundary data
                        if image_data.endswith(b'\r\n'):
                            image_data = image_data[:-2]
                        break
            
            if not image_data:
                self.send_json_response({"error": "No image data received"})
                return
            
            # Save image to temporary file
            with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as tmp_file:
                tmp_file.write(image_data)
                temp_path = tmp_file.name
            
            try:
                # Process with demo agent
                agent = DemoRealEstateGraphicDesigner()
                analysis = agent.analyze_image(temp_path)
                suggestion = agent.suggest_enhancement(temp_path)
                
                # Return results
                self.send_json_response({
                    "room_type": analysis["room_type"],
                    "style": analysis["style"],
                    "suggestion": suggestion,
                    "width": analysis["image_properties"]["width"],
                    "height": analysis["image_properties"]["height"],
                    "filename": filename
                })
                
            finally:
                # Clean up temporary file
                os.unlink(temp_path)
                
        except Exception as e:
            self.send_json_response({"error": str(e)})
    
    def send_json_response(self, data):
        """Send JSON response"""
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())
    
    def log_message(self, format, *args):
        """Custom logging"""
        print(f"[{self.address_string()}] {format % args}")

def main():
    """Start the public demo web server"""
    port = 8080
    server = HTTPServer(('0.0.0.0', port), ImageUploadHandler)
    
    print("🏠 Real Estate Graphic Designer - Public Demo Server")
    print("=" * 60)
    print(f"Server starting on all interfaces, port {port}")
    print(f"Local access: http://localhost:{port}")
    print(f"Network access: http://[YOUR_IP]:{port}")
    print("Press Ctrl+C to stop the server")
    print()
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
        server.shutdown()

if __name__ == "__main__":
    main()