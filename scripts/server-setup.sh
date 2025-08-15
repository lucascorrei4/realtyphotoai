#!/bin/bash

# Server setup script for Hostinger deployment
# Run this script on your Hostinger machine as root

set -e

echo "🚀 Setting up Hostinger server for RealtyPhotoAI deployment..."

# Update system packages
echo "📦 Updating system packages..."
apt update && apt upgrade -y

# Install Node.js 18.x
echo "📦 Installing Node.js 18.x..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Install PM2 globally
echo "📦 Installing PM2..."
npm install -g pm2

# Install nginx
echo "📦 Installing nginx..."
apt install -y nginx

# Install additional dependencies
echo "📦 Installing additional dependencies..."
apt install -y curl wget git unzip build-essential

# Create application directory
echo "📁 Creating application directory..."
mkdir -p /var/www/realtyphotoai
mkdir -p /var/www/realtyphotoai/logs
mkdir -p /var/www/realtyphotoai/uploads
mkdir -p /var/www/realtyphotoai/outputs
mkdir -p /var/www/realtyphotoai/temp

# Set proper permissions
echo "🔐 Setting permissions..."
chown -R www-data:www-data /var/www/realtyphotoai
chmod -R 755 /var/www/realtyphotoai

# Configure nginx
echo "🌐 Configuring nginx..."
cp nginx.conf /etc/nginx/sites-available/realtyphotoai
ln -sf /etc/nginx/sites-available/realtyphotoai /etc/nginx/sites-enabled/

# Remove default nginx site
rm -f /etc/nginx/sites-enabled/default

# Test nginx configuration
echo "🧪 Testing nginx configuration..."
nginx -t

# Start nginx
echo "🚀 Starting nginx..."
systemctl enable nginx
systemctl start nginx

# Create systemd service for PM2
echo "⚙️ Setting up PM2 systemd service..."
pm2 startup systemd -u root --hp /root

# Install PM2 startup script
pm2 startup

echo "✅ Server setup completed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Configure your .env file in /var/www/realtyphotoai/"
echo "2. Set up GitHub Actions secrets:"
echo "   - SSH_HOST: 31.97.147.23"
echo "   - SSH_USER: root"
echo "   - SSH_PRIVATE_KEY: Your private SSH key"
echo "   - SSH_PORT: 22 (or your custom port)"
echo "3. Push to main/master branch to trigger deployment"
echo ""
echo "🔍 To monitor your application:"
echo "   - PM2 status: pm2 status"
echo "   - PM2 logs: pm2 logs realtyphotoai"
echo "   - Nginx status: systemctl status nginx"
echo "   - Nginx logs: tail -f /var/log/nginx/realtyphotoai_*.log"
