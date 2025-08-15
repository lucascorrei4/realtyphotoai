# Deployment Guide - RealtyPhotoAI

This guide will walk you through setting up CI/CD deployment from GitHub to your Hostinger machine.

## Prerequisites

- GitHub repository with your code
- Hostinger VPS with root access
- SSH key pair for secure authentication

## Step 1: Server Setup

### 1.1 Connect to your Hostinger machine
```bash
ssh root@31.97.147.23
```

### 1.2 Run the server setup script
```bash
# Upload the setup script to your server
scp scripts/server-setup.sh root@31.97.147.23:/root/

# Make it executable and run
chmod +x server-setup.sh
./server-setup.sh
```

### 1.3 Configure environment variables
```bash
cd /var/www/realtyphotoai
cp .env.example .env
nano .env
```

**Required environment variables:**
```env
NODE_ENV=production
PORT=3000
REPLICATE_API_TOKEN=your_replicate_api_token
UPLOAD_PATH=./uploads
OUTPUT_PATH=./outputs
TEMP_PATH=./temp
LOG_LEVEL=info
```

## Step 2: GitHub Repository Setup

### 2.1 Add GitHub Actions secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions, and add:

- **SSH_HOST**: `31.97.147.23`
- **SSH_USER**: `root`
- **SSH_PRIVATE_KEY**: Your private SSH key content
- **SSH_PORT**: `22` (or your custom SSH port)

### 2.2 Generate SSH key pair (if you don't have one)

```bash
# On your local machine
ssh-keygen -t rsa -b 4096 -C "your_email@example.com"

# Copy public key to server
ssh-copy-id root@31.97.147.23

# Copy private key content to GitHub secret
cat ~/.ssh/id_rsa
```

## Step 3: Deployment Process

### 3.1 Automatic deployment
- Push to `main` or `master` branch
- GitHub Actions will automatically:
  - Run tests
  - Build the application
  - Deploy to your Hostinger machine

### 3.2 Manual deployment (if needed)
```bash
# On your local machine
git push origin main

# Or trigger manually from GitHub Actions tab
```

## Step 4: Verification

### 4.1 Check application status
```bash
# Check PM2 status
pm2 status

# Check PM2 logs
pm2 logs realtyphotoai

# Check nginx status
systemctl status nginx

# Check nginx logs
tail -f /var/log/nginx/realtyphotoai_access.log
tail -f /var/log/nginx/realtyphotoai_error.log
```

### 4.2 Test endpoints
```bash
# Health check
curl http://31.97.147.23/health

# Frontend
curl http://31.97.147.23/

# API endpoint
curl http://31.97.147.23/api/
```

## Step 5: Monitoring and Maintenance

### 5.1 PM2 commands
```bash
# View all processes
pm2 list

# Monitor processes
pm2 monit

# View logs
pm2 logs

# Restart application
pm2 restart realtyphotoai

# Stop application
pm2 stop realtyphotoai

# Delete application
pm2 delete realtyphotoai
```

### 5.2 Nginx commands
```bash
# Test configuration
nginx -t

# Reload configuration
nginx -s reload

# Restart nginx
systemctl restart nginx

# Check nginx status
systemctl status nginx
```

### 5.3 Log management
```bash
# Application logs
tail -f /var/www/realtyphotoai/logs/*.log

# Nginx logs
tail -f /var/log/nginx/realtyphotoai_*.log

# System logs
journalctl -u nginx -f
journalctl -u pm2-root -f
```

## Troubleshooting

### Common Issues

#### 1. Permission denied errors
```bash
# Fix permissions
chown -R www-data:www-data /var/www/realtyphotoai
chmod -R 755 /var/www/realtyphotoai
```

#### 2. Port already in use
```bash
# Check what's using the port
netstat -tulpn | grep :3000

# Kill the process
kill -9 <PID>
```

#### 3. Nginx configuration errors
```bash
# Test configuration
nginx -t

# Check nginx error log
tail -f /var/log/nginx/error.log
```

#### 4. PM2 process not starting
```bash
# Check PM2 logs
pm2 logs realtyphotoai

# Check application logs
tail -f /var/www/realtyphotoai/logs/*.log
```

### Rollback Procedure

If deployment fails, you can rollback:

```bash
# Stop current deployment
pm2 stop realtyphotoai

# Restore from backup
cd /var/www
rm -rf realtyphotoai
cp -r realtyphotoai.backup.<timestamp> realtyphotoai

# Restart application
cd realtyphotoai
pm2 start ecosystem.config.js --env production
```

## Security Considerations

1. **Firewall**: Configure UFW to only allow necessary ports
2. **SSH**: Use key-based authentication only
3. **Environment variables**: Never commit sensitive data to Git
4. **Updates**: Regularly update system packages
5. **Monitoring**: Set up log monitoring and alerting

## Performance Optimization

1. **PM2 clustering**: Uses all CPU cores
2. **Nginx caching**: Static assets are cached
3. **Gzip compression**: Reduces bandwidth usage
4. **Rate limiting**: Prevents abuse

## Support

If you encounter issues:

1. Check the logs first
2. Verify environment variables
3. Ensure all services are running
4. Check GitHub Actions logs for deployment errors

## Next Steps

After successful deployment:

1. Set up SSL certificate with Let's Encrypt
2. Configure domain name
3. Set up monitoring and alerting
4. Implement backup strategy
5. Set up staging environment
