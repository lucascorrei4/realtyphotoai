#!/bin/bash

# Complete deployment commands for realtyphotoai.com
# Run this script on your VPS: ssh root@31.97.147.23

echo "🚀 Starting deployment for realtyphotoai.com..."

# Step 1: Run the VPS setup script
echo "📦 Setting up VPS environment..."
chmod +x vps_deploy.sh
./vps_deploy.sh

# Step 2: Navigate to app directory
cd /var/www/realestate-ai

# Step 3: Copy application files (you'll need to upload them first)
echo "📁 Setting up application files..."

# Step 4: Install Python dependencies
echo "🐍 Installing Python dependencies..."
source venv/bin/activate
pip install -r requirements_vps.txt

# Step 5: Update systemd service for the correct app file
echo "⚙️ Configuring systemd service..."
sudo tee /etc/systemd/system/realestate-ai.service > /dev/null <<EOF
[Unit]
Description=Real Estate AI Application
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/realestate-ai
Environment=PATH=/var/www/realestate-ai/venv/bin
ExecStart=/var/www/realestate-ai/venv/bin/gunicorn --bind 0.0.0.0:8000 --workers 2 --timeout 300 app_wsgi:app
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

# Step 6: Start services
echo "🚀 Starting services..."
sudo systemctl daemon-reload
sudo systemctl enable realestate-ai
sudo systemctl start realestate-ai
sudo systemctl restart nginx

# Step 7: Check status
echo "🔍 Checking service status..."
sudo systemctl status realestate-ai --no-pager
sudo systemctl status nginx --no-pager

# Step 8: Check if app is running
echo "🌐 Checking if application is accessible..."
sleep 5
curl -I http://localhost:8000 || echo "App not responding on port 8000"

echo "✅ Deployment completed!"
echo ""
echo "🌍 Your application should be accessible at:"
echo "   http://realtyphotoai.com"
echo "   http://31.97.147.23"
echo ""
echo "📊 To monitor logs:"
echo "   sudo journalctl -u realestate-ai -f"
echo ""
echo "🔧 To restart the app:"
echo "   sudo systemctl restart realestate-ai"