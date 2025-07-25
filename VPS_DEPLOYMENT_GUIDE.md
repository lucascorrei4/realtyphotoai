# 🚀 VPS Deployment Guide for Real Estate AI App

This guide will help you deploy your Real Estate AI application on your Hostinger VPS instead of Heroku, avoiding the 500MB size limit.

## 📋 Prerequisites

Before starting, please provide me with the following information:

1. **VPS Details:**
   - Your VPS IP address
   - Domain name (if you have one)
   - SSH access credentials (username)
   - Operating system (Ubuntu/Debian recommended)

2. **Server Specifications:**
   - RAM (minimum 2GB recommended for AI models)
   - Storage space available
   - CPU cores

## 🛠️ Step 1: Prepare Your VPS

### Connect to your VPS
```bash
ssh your_username@your_vps_ip
```

### Run the deployment script
```bash
# Upload and run the deployment script
chmod +x vps_deploy.sh
./vps_deploy.sh
```

## 📁 Step 2: Upload Your Application

### Option A: Using Git (Recommended)
```bash
cd /var/www/realestate-ai
git clone https://github.com/your-username/your-repo.git .
```

### Option B: Using SCP/SFTP
```bash
# From your local machine
scp -r /path/to/your/project/* your_username@your_vps_ip:/var/www/realestate-ai/
```

### Option C: Using rsync
```bash
# From your local machine
rsync -avz --exclude '__pycache__' --exclude '*.pyc' /path/to/your/project/ your_username@your_vps_ip:/var/www/realestate-ai/
```

## ⚙️ Step 3: Configure the Application

### Update the systemd service
```bash
# Edit the service file to use the correct app file
sudo nano /etc/systemd/system/realestate-ai.service
```

Change the ExecStart line to:
```
ExecStart=/var/www/realestate-ai/venv/bin/gunicorn --bind 0.0.0.0:8000 --workers 2 --timeout 300 app_wsgi:app
```

### Update Nginx configuration
```bash
sudo nano /etc/nginx/sites-available/realestate-ai
```

Replace `YOUR_DOMAIN_OR_IP` with your actual domain or IP address.

### Install Python dependencies
```bash
cd /var/www/realestate-ai
source venv/bin/activate
pip install -r requirements.txt
```

## 🚀 Step 4: Start the Services

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable and start the application service
sudo systemctl enable realestate-ai
sudo systemctl start realestate-ai

# Restart Nginx
sudo systemctl restart nginx

# Check status
sudo systemctl status realestate-ai
sudo systemctl status nginx
```

## 🔍 Step 5: Verify Deployment

### Check if the application is running
```bash
# Check if the app is listening on port 8000
sudo netstat -tlnp | grep :8000

# Check application logs
sudo journalctl -u realestate-ai -f

# Check Nginx logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

### Test the application
Open your browser and go to:
- `http://your_domain` (if you have a domain)
- `http://your_vps_ip` (using IP address)

## 🔒 Step 6: Security & SSL (Optional but Recommended)

### Install Certbot for free SSL
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your_domain.com
```

### Configure firewall
```bash
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

## 📊 Step 7: Monitoring & Maintenance

### Monitor resource usage
```bash
# Check memory usage
free -h

# Check disk usage
df -h

# Monitor CPU usage
top
```

### Log rotation (optional)
```bash
sudo nano /etc/logrotate.d/realestate-ai
```

Add:
```
/var/log/realestate-ai/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 your_username your_username
}
```

## 🔧 Troubleshooting

### Common Issues and Solutions

1. **Service won't start:**
   ```bash
   sudo journalctl -u realestate-ai -n 50
   ```

2. **Nginx 502 Bad Gateway:**
   - Check if the app is running on port 8000
   - Verify the proxy_pass configuration

3. **Out of memory:**
   - Reduce the number of Gunicorn workers
   - Add swap space if needed

4. **AI models taking too long to load:**
   - Consider using model caching
   - Implement lazy loading

### Useful Commands
```bash
# Restart the application
sudo systemctl restart realestate-ai

# View real-time logs
sudo journalctl -u realestate-ai -f

# Check Nginx configuration
sudo nginx -t

# Reload Nginx configuration
sudo systemctl reload nginx
```

## 📈 Performance Optimization

### For better performance on VPS:
1. **Use CPU-only PyTorch** (already configured in deployment script)
2. **Implement model caching** to avoid reloading
3. **Use Gunicorn with appropriate worker count** (2 workers for 2GB RAM)
4. **Enable Nginx gzip compression**
5. **Set up proper caching headers**

### Nginx optimization (add to server block):
```nginx
# Enable gzip compression
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

# Set cache headers for static files
location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

## 💡 Next Steps

After successful deployment:

1. **Test all functionality** with sample images
2. **Monitor resource usage** during peak times
3. **Set up automated backups** of your application
4. **Configure monitoring alerts** (optional)
5. **Document your specific configuration** for future reference

---

**Need Help?** If you encounter any issues during deployment, please share:
- Error messages from logs
- Your VPS specifications
- The specific step where the issue occurred