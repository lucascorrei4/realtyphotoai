#!/bin/bash

# Server setup script for Hostinger deployment
# Run this script on your Hostinger machine as root

set -e

echo "🚀 Setting up Hostinger server for RealVisionAI deployment..."

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
mkdir -p /var/www/RealVisionai
mkdir -p /var/www/RealVisionai/logs
mkdir -p /var/www/RealVisionai/uploads
mkdir -p /var/www/RealVisionai/outputs
mkdir -p /var/www/RealVisionai/temp

# Set proper permissions
echo "🔐 Setting permissions..."
chown -R www-data:www-data /var/www/RealVisionai
chmod -R 755 /var/www/RealVisionai

# Configure nginx
echo "🌐 Configuring nginx..."
cp nginx.conf /etc/nginx/sites-available/RealVisionai
ln -sf /etc/nginx/sites-available/RealVisionai /etc/nginx/sites-enabled/

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
echo "1. Create the nginx.conf for your sites (see recommended config)."
echo "2. Deploy your code to /var/www/RealVisionai/"
echo "3. Build the frontend: cd frontend && npm install && npm run build"
echo "4. Start the backend with PM2: pm2 start your-api-file.js --name RealVisionai-api"
echo "5. Save the PM2 process: pm2 save"
echo "6. Reload Nginx: sudo systemctl reload nginx"
echo "7. Set up SSL with Certbot: sudo certbot --nginx -d api.realvisionaire.com -d app.realvisionaire.com"
echo ""
echo "🔍 To monitor your application:"
echo "   - PM2 status: pm2 status"
echo "   - Backend logs: pm2 logs RealVisionai-api"
echo "   - Nginx status: systemctl status nginx"
echo "   - Nginx API logs: tail -f /var/log/nginx/api_RealVisionai_*.log"
echo "   - Nginx App logs: tail -f /var/log/nginx/app_RealVisionai_*.log"
