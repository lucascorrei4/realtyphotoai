#!/bin/bash

# VPS Deployment Script for Real Estate AI App
# Run this script on your Hostinger VPS

set -e

echo "🚀 Starting VPS deployment for Real Estate AI App..."

# Update system packages
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Python 3.10+ and pip
echo "🐍 Installing Python and dependencies..."
sudo apt install -y python3 python3-pip python3-venv nginx supervisor git

# Install system dependencies for OpenCV and PyTorch
sudo apt install -y libgl1-mesa-glx libglib2.0-0 libsm6 libxext6 libxrender-dev libgomp1

# Create application directory
APP_DIR="/var/www/realestate-ai"
sudo mkdir -p $APP_DIR
sudo chown $USER:$USER $APP_DIR

# Navigate to app directory
cd $APP_DIR

# Create virtual environment
echo "🔧 Setting up virtual environment..."
python3 -m venv venv
source venv/bin/activate

# Install Python dependencies
echo "📚 Installing Python packages..."
pip install --upgrade pip

# Install PyTorch CPU version (smaller size)
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu

# Install other requirements
pip install opencv-python-headless pillow numpy transformers diffusers accelerate scikit-image matplotlib requests python-dotenv gradio gunicorn

# Create systemd service file
echo "⚙️ Creating systemd service..."
sudo tee /etc/systemd/system/realestate-ai.service > /dev/null <<EOF
[Unit]
Description=Real Estate AI Application
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$APP_DIR
Environment=PATH=$APP_DIR/venv/bin
ExecStart=$APP_DIR/venv/bin/gunicorn --bind 0.0.0.0:8000 --workers 2 --timeout 300 app:app
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

# Create Nginx configuration
echo "🌐 Configuring Nginx..."
sudo tee /etc/nginx/sites-available/realestate-ai > /dev/null <<EOF
server {
    listen 80;
    server_name YOUR_DOMAIN_OR_IP;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
    }
}
EOF

# Enable the site
sudo ln -sf /etc/nginx/sites-available/realestate-ai /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
sudo nginx -t

echo "✅ Deployment script completed!"
echo ""
echo "📋 Next steps:"
echo "1. Upload your application files to $APP_DIR"
echo "2. Update the Nginx configuration with your domain/IP"
echo "3. Start the services"
echo ""
echo "Commands to run after uploading files:"
echo "sudo systemctl daemon-reload"
echo "sudo systemctl enable realestate-ai"
echo "sudo systemctl start realestate-ai"
echo "sudo systemctl restart nginx"
echo ""
echo "Check status with:"
echo "sudo systemctl status realestate-ai"
echo "sudo systemctl status nginx"