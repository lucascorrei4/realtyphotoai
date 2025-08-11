#!/bin/bash

# Real Estate Photo AI Backend - VPS Deployment Script
# Deploys from: /home/ubuntu/apps/realtyphotoai/ (git repo)
# Runs from: /home/ubuntu/apps/server/ (application directory)

set -e

echo "🚀 Deploying Real Estate Photo AI Backend to VPS..."

# Configuration
GIT_DIR="/home/ubuntu/apps/realtyphotoai"
APP_DIR="/home/ubuntu/apps/server"
SERVICE_NAME="realestate-ai-backend"
DOMAIN="your-domain.com"  # Update with your actual domain

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root for security reasons"
   print_warning "Please run as ubuntu user with sudo privileges"
   exit 1
fi

# Verify git repository exists
if [ ! -d "$GIT_DIR" ]; then
    print_error "Git repository not found at $GIT_DIR"
    exit 1
fi

print_status "Found git repository at $GIT_DIR"

# Update system packages
print_status "Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install required system packages
print_status "Installing system dependencies..."
sudo apt install -y \
    python3 \
    python3-pip \
    python3-venv \
    python3-dev \
    nginx \
    supervisor \
    git \
    curl \
    htop \
    unzip \
    software-properties-common \
    build-essential

# Install system dependencies for AI processing (Ubuntu 22.04+ compatible)
print_status "Installing AI processing libraries..."
sudo apt install -y \
    libgl1-mesa-dev \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    libgfortran5 \
    libjpeg-dev \
    libpng-dev \
    libtiff-dev \
    libwebp-dev \
    zlib1g-dev \
    libfontconfig1-dev \
    libfreetype6-dev

# Install additional OpenCV dependencies
print_status "Installing OpenCV dependencies..."
sudo apt install -y \
    libopencv-dev \
    python3-opencv \
    libgtk-3-dev \
    libavcodec-dev \
    libavformat-dev \
    libswscale-dev \
    libv4l-dev \
    libxvidcore-dev \
    libx264-dev || print_warning "Some optional packages were not available"

# Create application directory
print_status "Setting up application directory at $APP_DIR..."
sudo mkdir -p $APP_DIR
sudo chown ubuntu:ubuntu $APP_DIR

# Copy files from git repository to application directory
print_status "Copying files from git repository..."
cd $GIT_DIR
cp -r src/ $APP_DIR/
cp main.py $APP_DIR/
cp requirements.txt $APP_DIR/
cp gunicorn.conf.py $APP_DIR/
cp env.example $APP_DIR/
cp README.md INSOMNIA_TESTING_GUIDE.md $APP_DIR/

# Navigate to application directory
cd $APP_DIR

# Create Python virtual environment
print_status "Creating Python virtual environment..."
python3 -m venv venv
source venv/bin/activate

# Upgrade pip
print_status "Upgrading pip..."
pip install --upgrade pip setuptools wheel

# Install Python dependencies
print_status "Installing Python packages..."
pip install -r requirements.txt

# Create environment file
print_status "Creating environment configuration..."
if [ ! -f .env ]; then
    cp env.example .env
    print_warning "Please edit .env file with your production settings"
fi

# Create directory structure
print_status "Creating directory structure..."
mkdir -p uploads temp models_cache logs

# Set proper permissions
sudo chown -R ubuntu:ubuntu $APP_DIR
chmod -R 755 $APP_DIR
chmod -R 777 $APP_DIR/uploads $APP_DIR/temp $APP_DIR/logs

# Create systemd service file
print_status "Creating systemd service..."
sudo tee /etc/systemd/system/$SERVICE_NAME.service > /dev/null <<EOF
[Unit]
Description=Real Estate AI Backend FastAPI Application
After=network.target

[Service]
Type=notify
User=ubuntu
Group=ubuntu
WorkingDirectory=$APP_DIR
Environment=PATH=$APP_DIR/venv/bin
Environment=PYTHONPATH=$APP_DIR
ExecStart=$APP_DIR/venv/bin/gunicorn -c gunicorn.conf.py main:app
ExecReload=/bin/kill -s HUP \$MAINPID
Restart=always
RestartSec=5
StartLimitInterval=60
StartLimitBurst=3
TimeoutStartSec=0
NotifyAccess=all

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=$APP_DIR
ProtectHome=true
PrivateDevices=true

[Install]
WantedBy=multi-user.target
EOF

# Create Nginx configuration
print_status "Configuring Nginx..."
sudo tee /etc/nginx/sites-available/$SERVICE_NAME > /dev/null <<EOF
# Real Estate AI Backend Nginx Configuration
upstream realestate_ai {
    server 127.0.0.1:8000 fail_timeout=0;
}

server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN _;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy "strict-origin-when-cross-origin";
    
    # Gzip compression
    gzip on;
    gzip_comp_level 6;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript;
    
    # Client body size (for file uploads)
    client_max_body_size 12M;
    client_body_timeout 60s;
    client_header_timeout 60s;
    
    # Main application
    location / {
        proxy_pass http://realestate_ai;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # Timeouts for AI processing
        proxy_connect_timeout 60s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
        
        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
    
    # Health check endpoint
    location /health {
        proxy_pass http://realestate_ai/health;
        access_log off;
    }
    
    # Deny access to sensitive files
    location ~ /\\.env {
        deny all;
        return 404;
    }
    
    location ~ /\\.git {
        deny all;
        return 404;
    }
}
EOF

# Enable the site
sudo ln -sf /etc/nginx/sites-available/$SERVICE_NAME /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
print_status "Testing Nginx configuration..."
sudo nginx -t

# Create log rotation configuration
print_status "Setting up log rotation..."
sudo tee /etc/logrotate.d/$SERVICE_NAME > /dev/null <<EOF
$APP_DIR/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 ubuntu ubuntu
    postrotate
        systemctl reload $SERVICE_NAME
    endscript
}
EOF

# Create monitoring script
print_status "Creating monitoring script..."
tee $APP_DIR/monitor.sh > /dev/null <<'EOF'
#!/bin/bash
# Monitoring script for Real Estate AI Backend

SERVICE_NAME="realestate-ai-backend"
APP_DIR="/home/ubuntu/apps/server"
LOG_FILE="$APP_DIR/logs/monitor.log"

# Ensure log directory exists
mkdir -p "$APP_DIR/logs"

# Function to log with timestamp
log_message() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> "$LOG_FILE"
}

# Check if service is running
if ! systemctl is-active --quiet $SERVICE_NAME; then
    log_message "ERROR: $SERVICE_NAME service is not running. Attempting restart..."
    sudo systemctl restart $SERVICE_NAME
    sleep 10
    if systemctl is-active --quiet $SERVICE_NAME; then
        log_message "SUCCESS: $SERVICE_NAME service restarted successfully"
    else
        log_message "CRITICAL: Failed to restart $SERVICE_NAME service"
    fi
else
    log_message "INFO: $SERVICE_NAME service is running normally"
fi

# Check API health
health_check=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/health 2>/dev/null || echo "000")
if [ "$health_check" = "200" ]; then
    log_message "INFO: API health check passed"
else
    log_message "WARNING: API health check failed (HTTP $health_check)"
fi
EOF

chmod +x $APP_DIR/monitor.sh

# Add monitoring to crontab
print_status "Setting up monitoring cron job..."
(crontab -l 2>/dev/null | grep -v monitor.sh; echo "*/5 * * * * $APP_DIR/monitor.sh") | crontab -

# Set up firewall
if command -v ufw > /dev/null; then
    print_status "Configuring firewall..."
    sudo ufw allow 22/tcp
    sudo ufw allow 80/tcp
    sudo ufw allow 443/tcp
    sudo ufw --force enable
fi

print_status "Deployment completed successfully!"

echo ""
echo "📋 Next Steps:"
echo "1. Edit environment configuration:"
echo "   nano $APP_DIR/.env"
echo ""
echo "2. Update domain in Nginx config (optional):"
echo "   sudo nano /etc/nginx/sites-available/$SERVICE_NAME"
echo ""
echo "3. Start services:"
echo "   sudo systemctl daemon-reload"
echo "   sudo systemctl enable $SERVICE_NAME"
echo "   sudo systemctl start $SERVICE_NAME"
echo "   sudo systemctl restart nginx"
echo ""
echo "4. Check status:"
echo "   sudo systemctl status $SERVICE_NAME"
echo "   curl http://localhost:8000/health"
echo ""
echo "5. View logs:"
echo "   sudo journalctl -u $SERVICE_NAME -f"
echo "   tail -f $APP_DIR/logs/*.log"
echo ""
echo "🔧 Files deployed to: $APP_DIR"
echo "🌐 Service name: $SERVICE_NAME"
echo "📊 Monitoring: Every 5 minutes via cron"
echo ""
print_status "Your Real Estate AI Backend is ready for production!" 