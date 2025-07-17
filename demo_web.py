#!/usr/bin/env python3
"""
Simple web demo for Real Estate Graphic Designer
Uses basic Python libraries for demonstration
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
                <style>
                    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
                    .container { background: #f5f5f5; padding: 30px; border-radius: 10px; }
                    .upload-area { border: 2px dashed #ccc; padding: 40px; text-align: center; margin: 20px 0; }
                    .upload-area:hover { border-color: #007bff; }
                    input[type="file"] { margin: 10px 0; }
                    button { background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; }
                    button:hover { background: #0056b3; }
                    .result { margin-top: 20px; padding: 20px; background: white; border-radius: 5px; }
                    .error { color: red; }
                    .success { color: green; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>🏠 Ultra-Realistic Real Estate Graphic Designer</h1>
                    <p>Upload a photo of any room to get professional enhancement suggestions!</p>
                    
                    <form id="uploadForm" enctype="multipart/form-data" method="post">
                        <div class="upload-area">
                            <h3>📸 Upload Room Photo</h3>
                            <input type="file" id="imageFile" name="image" accept="image/*" required>
                            <br><br>
                            <button type="submit">🎨 Generate Enhancement Suggestion</button>
                        </div>
                    </form>
                    
                    <div id="result" class="result" style="display: none;"></div>
                    
                    <div style="margin-top: 30px;">
                        <h3>💡 How it works:</h3>
                        <ol>
                            <li><strong>Upload</strong> a photo of any room (living room, kitchen, bedroom, etc.)</li>
                            <li><strong>AI Analysis</strong> identifies room type, style, and improvement areas</li>
                            <li><strong>Get Suggestion</strong> receives a detailed enhancement recommendation</li>
                        </ol>
                        
                        <h3>📋 Example filenames for testing:</h3>
                        <ul>
                            <li><code>modern_kitchen.jpg</code> - Modern kitchen suggestions</li>
                            <li><code>traditional_bedroom.jpg</code> - Traditional bedroom ideas</li>
                            <li><code>cluttered_living_room.jpg</code> - Includes clutter removal</li>
                            <li><code>empty_bathroom.jpg</code> - Focuses on adding elements</li>
                        </ul>
                    </div>
                </div>
                
                <script>
                    document.getElementById('uploadForm').addEventListener('submit', function(e) {
                        e.preventDefault();
                        
                        const formData = new FormData();
                        const imageFile = document.getElementById('imageFile').files[0];
                        
                        if (!imageFile) {
                            alert('Please select an image file');
                            return;
                        }
                        
                        formData.append('image', imageFile);
                        
                        // Show loading
                        const resultDiv = document.getElementById('result');
                        resultDiv.style.display = 'block';
                        resultDiv.innerHTML = '<p>🔄 Analyzing image and generating suggestion...</p>';
                        
                        fetch('/', {
                            method: 'POST',
                            body: formData
                        })
                        .then(response => response.json())
                        .then(data => {
                            if (data.error) {
                                resultDiv.innerHTML = '<p class="error">❌ Error: ' + data.error + '</p>';
                            } else {
                                resultDiv.innerHTML = `
                                    <h3>📊 Analysis Results:</h3>
                                    <p><strong>Room Type:</strong> ${data.room_type}</p>
                                    <p><strong>Style:</strong> ${data.style}</p>
                                    <p><strong>Image Size:</strong> ${data.width}x${data.height}</p>
                                    <hr>
                                    <h3>🎨 Enhancement Suggestion:</h3>
                                    <p class="success"><strong>${data.suggestion}</strong></p>
                                `;
                            }
                        })
                        .catch(error => {
                            resultDiv.innerHTML = '<p class="error">❌ Error: ' + error.message + '</p>';
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
                self.send_error(400, "No data received")
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
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())
    
    def log_message(self, format, *args):
        """Suppress default logging"""
        pass

def main():
    """Start the demo web server"""
    port = 8000
    server = HTTPServer(('localhost', port), ImageUploadHandler)
    
    print("🏠 Real Estate Graphic Designer Demo Server")
    print("=" * 50)
    print(f"Server starting on http://localhost:{port}")
    print("Open your browser and go to the URL above")
    print("Press Ctrl+C to stop the server")
    print()
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
        server.shutdown()

if __name__ == "__main__":
    main()