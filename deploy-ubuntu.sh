#!/bin/bash

# Real Estate Photo AI - Ubuntu VPS Deployment Script
# This script sets up the complete production environment

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="realestate-photo-ai"
APP_DIR="/var/www/$APP_NAME"
NGINX_CONF="/etc/nginx/sites-available/$APP_NAME"
DOMAIN="your-domain.com"  # Change this to your actual domain

echo -e "${BLUE}🚀 Starting deployment of Real Estate Photo AI Backend${NC}"

# Function to print status
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root. Run as ubuntu user."
   exit 1
fi

print_status "Updating system packages..."
sudo apt-get update
sudo apt-get upgrade -y

print_status "Installing Node.js 20.x..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

print_status "Installing system dependencies..."
sudo apt-get install -y nginx git build-essential python3-dev

print_status "Installing PM2 globally..."
sudo npm install -g pm2

print_status "Setting up application directory..."
sudo mkdir -p $APP_DIR
sudo chown -R $USER:$USER $APP_DIR

print_status "Cloning repository..."
if [ -d "$APP_DIR/.git" ]; then
    cd $APP_DIR
    git pull origin main
else
    git clone https://github.com/your-username/$APP_NAME.git $APP_DIR
    cd $APP_DIR
fi

print_status "Installing Node.js dependencies..."
npm ci --only=production

print_status "Building TypeScript application..."
npm run build

print_status "Creating environment file..."
if [ ! -f .env ]; then
    cp env.example .env
    print_warning "Please edit .env file with your actual configuration:"
    print_warning "- Set your REPLICATE_API_TOKEN"
    print_warning "- Configure other environment variables as needed"
    read -p "Press Enter after you've configured the .env file..."
fi

print_status "Creating required directories..."
mkdir -p uploads outputs temp logs

print_status "Setting up Nginx configuration..."
sudo tee $NGINX_CONF > /dev/null <<EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    
    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        client_max_body_size 50M;
    }
    
    location /uploads/ {
        alias $APP_DIR/uploads/;
        expires 7d;
        add_header Cache-Control "public, no-transform";
    }
    
    location /outputs/ {
        alias $APP_DIR/outputs/;
        expires 1d;
        add_header Cache-Control "public, no-transform";
    }
    
    access_log /var/log/nginx/$APP_NAME-access.log;
    error_log /var/log/nginx/$APP_NAME-error.log;
}
EOF

print_status "Enabling Nginx site..."
sudo ln -sf $NGINX_CONF /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

print_status "Starting application with PM2..."
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup

print_status "Setting up PM2 startup script..."
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u $USER --hp /home/$USER

print_status "Setting up log rotation..."
sudo tee /etc/logrotate.d/$APP_NAME > /dev/null <<EOF
$APP_DIR/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    notifempty
    create 0640 $USER $USER
    postrotate
        pm2 reloadLogs
    endscript
}
EOF

print_status "Setting up firewall..."
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw --force enable

print_status "Creating SSL certificate setup script..."
tee setup-ssl.sh > /dev/null <<EOF
#!/bin/bash
# Run this after pointing your domain to this server

sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN
sudo systemctl reload nginx
EOF
chmod +x setup-ssl.sh

print_status "Creating update script..."
tee update.sh > /dev/null <<EOF
#!/bin/bash
cd $APP_DIR
git pull origin main
npm ci --only=production
npm run build
pm2 reload ecosystem.config.js --env production
EOF
chmod +x update.sh

print_status "Setting up monitoring script..."
tee monitor.sh > /dev/null <<EOF
#!/bin/bash
echo "=== PM2 Status ==="
pm2 status

echo -e "\n=== Application Logs (last 20 lines) ==="
pm2 logs --lines 20

echo -e "\n=== System Resources ==="
free -h
df -h

echo -e "\n=== Nginx Status ==="
sudo systemctl status nginx

echo -e "\n=== Network Connections ==="
sudo netstat -tulpn | grep :8000
EOF
chmod +x monitor.sh

print_status "Deployment completed successfully! 🎉"

echo -e "\n${BLUE}📋 Next Steps:${NC}"
echo "1. Edit .env file with your Replicate API token and other settings"
echo "2. Point your domain ($DOMAIN) to this server's IP address"
echo "3. Run ./setup-ssl.sh to set up SSL certificates"
echo "4. Use ./update.sh to deploy updates"
echo "5. Use ./monitor.sh to check application status"

echo -e "\n${BLUE}🔧 Useful Commands:${NC}"
echo "pm2 status                 - Check PM2 processes"
echo "pm2 logs                   - View application logs"
echo "pm2 reload all             - Reload application"
echo "sudo systemctl status nginx - Check Nginx status"
echo "sudo nginx -t              - Test Nginx configuration"

echo -e "\n${BLUE}📊 Application URLs:${NC}"
echo "Health Check: http://your-server-ip:8000/api/v1/health"
echo "API Documentation: http://your-server-ip:8000/api/v1/test"
echo "Domain: http://$DOMAIN (after DNS setup)"

print_warning "Remember to:"
print_warning "- Configure your .env file with the Replicate API token"
print_warning "- Set up your domain's DNS records"
print_warning "- Run SSL setup after DNS propagation"
print_warning "- Monitor logs for any issues"

echo -e "\n${GREEN}✨ Real Estate Photo AI Backend is now ready for production!${NC}" 