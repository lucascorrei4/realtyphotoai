# Deployment Checklist - RealtyPhotoAI

## ✅ Pre-deployment Setup

- [ ] Hostinger VPS is accessible via SSH
- [ ] SSH key pair generated and configured
- [ ] GitHub repository is set up
- [ ] Environment variables documented

## 🚀 Server Setup (Run on Hostinger machine)

- [ ] Connect to server: `ssh root@31.97.147.23`
- [ ] Upload and run setup script: `./server-setup.sh`
- [ ] Verify Node.js 18.x installed: `node --version`
- [ ] Verify PM2 installed: `pm2 --version`
- [ ] Verify nginx installed: `nginx -v`
- [ ] Check application directory: `ls -la /var/www/realtyphotoai`

## 🔐 GitHub Configuration

- [ ] Add repository secrets:
  - [ ] `SSH_HOST`: `31.97.147.23`
  - [ ] `SSH_USER`: `root`
  - [ ] `SSH_PRIVATE_KEY`: Your private key content
  - [ ] `SSH_PORT`: `22`
- [ ] Verify secrets are accessible in Actions

## 🌍 Environment Configuration

- [ ] Create `.env` file on server
- [ ] Set `NODE_ENV=production`
- [ ] Set `PORT=3000`
- [ ] Configure `REPLICATE_API_TOKEN`
- [ ] Set file paths for uploads/outputs
- [ ] Verify file permissions: `chown -R www-data:www-data /var/www/realtyphotoai`

## 🚀 First Deployment

- [ ] Push to main/master branch
- [ ] Monitor GitHub Actions workflow
- [ ] Check deployment logs
- [ ] Verify application is running: `pm2 status`
- [ ] Test health endpoint: `curl http://31.97.147.23/health`
- [ ] Test frontend: `curl http://31.97.147.23/`

## 🔍 Post-deployment Verification

- [ ] Application responds on port 3000
- [ ] Frontend loads correctly
- [ ] API endpoints accessible
- [ ] File uploads work
- [ ] Logs are being generated
- [ ] Nginx is serving static files
- [ ] PM2 process is stable

## 📊 Monitoring Setup

- [ ] PM2 monitoring: `pm2 monit`
- [ ] Nginx status: `systemctl status nginx`
- [ ] Log monitoring: `tail -f /var/www/realtyphotoai/logs/*.log`
- [ ] System resource monitoring
- [ ] Error alerting configured

## 🔒 Security Verification

- [ ] SSH key authentication only
- [ ] Firewall configured (if applicable)
- [ ] Sensitive files not accessible via web
- [ ] Environment variables secured
- [ ] Rate limiting active

## 📝 Documentation

- [ ] Deployment guide updated
- [ ] Environment variables documented
- [ ] Troubleshooting steps documented
- [ ] Team access documented
- [ ] Rollback procedures documented

## 🎯 Next Steps

- [ ] SSL certificate setup
- [ ] Domain configuration
- [ ] Backup strategy implementation
- [ ] Staging environment setup
- [ ] Performance monitoring
- [ ] Alert system configuration

---

**Quick Commands Reference:**

```bash
# Check application status
pm2 status
pm2 logs realtyphotoai

# Check nginx
systemctl status nginx
nginx -t

# View logs
tail -f /var/www/realtyphotoai/logs/*.log
tail -f /var/log/nginx/realtyphotoai_*.log

# Restart services
pm2 restart realtyphotoai
systemctl restart nginx

# Health check
curl http://31.97.147.23/health
```
