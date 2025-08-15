module.exports = {
  apps: [
    {
      name: 'realtyphotoai-backend',
      script: 'dist/app.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'development',
        PORT: 8000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 8000
      },
      error_file: './logs/backend_err.log',
      out_file: './logs/backend_out.log',
      log_file: './logs/backend_combined.log',
      time: true,
      max_memory_restart: '1G',
      restart_delay: 4000,
      max_restarts: 10,
      min_uptime: '10s',
      watch: false,
      ignore_watch: ['node_modules', 'logs', 'uploads', 'outputs', 'temp'],
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    },
    {
      name: 'realtyphotoai-frontend',
      script: 'node_modules/.bin/serve',
      args: '-s public -l 3000',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: './logs/frontend_err.log',
      out_file: './logs/frontend_out.log',
      log_file: './logs/frontend_combined.log',
      time: true,
      max_memory_restart: '512M',
      restart_delay: 2000,
      max_restarts: 5,
      min_uptime: '10s',
      watch: false,
      ignore_watch: ['node_modules', 'logs', 'uploads', 'outputs', 'temp'],
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ]
}; 