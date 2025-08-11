module.exports = {
  apps: [
    {
      name: 'realestate-photo-ai',
      script: 'dist/app.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'development',
        PORT: 8000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 8000,
        MAX_MEMORY_RESTART: '1G',
      },
      // Logging
      log_file: './logs/pm2-combined.log',
      out_file: './logs/pm2-out.log',
      error_file: './logs/pm2-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Auto restart settings
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      
      // Graceful shutdown
      kill_timeout: 5000,
      
      // Health monitoring
      min_uptime: '10s',
      max_restarts: 10,
      
      // Source control
      ref: 'origin/main',
      repo: 'https://github.com/your-username/realestate-photo-ai.git',
      path: '/var/www/realestate-photo-ai',
      
      // Post-deploy hooks
      'post-deploy': 'npm ci && npm run build && pm2 reload ecosystem.config.js --env production',
      
      // Environment variables
      env_file: '.env',
    }
  ],
  
  deploy: {
    production: {
      user: 'ubuntu',
      host: ['your-server-ip'],
      ref: 'origin/main',
      repo: 'https://github.com/your-username/realestate-photo-ai.git',
      path: '/var/www/realestate-photo-ai',
      'pre-deploy-local': '',
      'post-deploy': 'npm ci && npm run build && pm2 reload ecosystem.config.js --env production && pm2 save',
      'pre-setup': 'sudo apt-get update && sudo apt-get install -y nodejs npm nginx'
    }
  }
}; 