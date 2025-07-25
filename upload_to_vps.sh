#!/bin/bash

# Script to upload Real Estate AI app to VPS
# Run this from your local machine where the project files are located

VPS_IP="31.97.147.23"
VPS_USER="root"
APP_DIR="/var/www/realestate-ai"

echo "📤 Uploading Real Estate AI app to VPS..."

# Create the app directory on VPS
echo "📁 Creating application directory on VPS..."
ssh $VPS_USER@$VPS_IP "mkdir -p $APP_DIR"

# Upload essential Python files
echo "🐍 Uploading Python application files..."
scp real_estate_agent.py $VPS_USER@$VPS_IP:$APP_DIR/
scp app_wsgi.py $VPS_USER@$VPS_IP:$APP_DIR/
scp requirements_vps.txt $VPS_USER@$VPS_IP:$APP_DIR/requirements.txt

# Upload deployment scripts
echo "🚀 Uploading deployment scripts..."
scp vps_deploy.sh $VPS_USER@$VPS_IP:$APP_DIR/
scp deploy_commands.sh $VPS_USER@$VPS_IP:$APP_DIR/

# Upload sample images (optional, for testing)
echo "🖼️ Uploading sample images..."
scp *.jpg $VPS_USER@$VPS_IP:$APP_DIR/ 2>/dev/null || echo "No .jpg files found, skipping..."

# Upload any additional Python files
echo "📄 Uploading additional files..."
scp image_generator.py $VPS_USER@$VPS_IP:$APP_DIR/ 2>/dev/null || echo "image_generator.py not found, skipping..."
scp *.py $VPS_USER@$VPS_IP:$APP_DIR/ 2>/dev/null || echo "No additional .py files"

# Set permissions
echo "🔐 Setting file permissions..."
ssh $VPS_USER@$VPS_IP "chmod +x $APP_DIR/*.sh"
ssh $VPS_USER@$VPS_IP "chown -R $VPS_USER:$VPS_USER $APP_DIR"

echo "✅ Upload completed!"
echo ""
echo "🔗 Next steps:"
echo "1. SSH into your VPS: ssh $VPS_USER@$VPS_IP"
echo "2. Navigate to app directory: cd $APP_DIR"
echo "3. Run deployment: ./deploy_commands.sh"
echo ""
echo "🌍 Your app will be available at:"
echo "   http://realtyphotoai.com"
echo "   http://$VPS_IP"