import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import path from 'path';
import { config } from './config';
import { logger } from './utils/logger';
import { FileUtils } from './utils/fileUtils';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import routes from './routes';

class App {
  public app: express.Application;

  constructor() {
    this.app = express();
    this.initializeDirectories();
    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private async initializeDirectories(): Promise<void> {
    try {
      // Ensure required directories exist
      await FileUtils.ensureDirectoryExists(config.uploadDir);
      await FileUtils.ensureDirectoryExists(config.outputDir);
      await FileUtils.ensureDirectoryExists(config.tempDir);
      await FileUtils.ensureDirectoryExists('logs');
      
      logger.info('Required directories initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize directories', { error });
      throw error;
    }
  }

  private initializeMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'", "'unsafe-inline'"], // Allow inline scripts for web interface
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }));

    // CORS configuration
    this.app.use(cors({
      origin: config.corsOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
    }));

    // Compression
    this.app.use(compression());

    // Logging
    this.app.use(morgan(config.logFormat, {
      stream: {
        write: (message: string) => {
          logger.info(message.trim());
        },
      },
    }));

    // Body parsing
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));

    // Static file serving
    this.app.use('/uploads', express.static(path.join(process.cwd(), config.uploadDir)));
    this.app.use('/outputs', express.static(path.join(process.cwd(), config.outputDir)));

    // API key authentication middleware (disabled for testing)
    // if (config.apiKey) {
    //   this.app.use((req, res, next) => {
    //     // Skip auth for health check and test endpoints
    //     if (req.path === '/health' || req.path.startsWith('/api/v1/test')) {
    //       return next();
    //     }

    //     const apiKey = req.headers['x-api-key'] as string;
    //     if (!apiKey || apiKey !== config.apiKey) {
    //       return res.status(401).json({
    //         success: false,
    //         message: 'Invalid or missing API key',
    //         error: 'UNAUTHORIZED',
    //         timestamp: new Date().toISOString(),
    //       });
    //     }
    //     next();
    //   });
    // }

    logger.info('Middleware initialized successfully');
  }

  private initializeRoutes(): void {
    // Root endpoint
    this.app.get('/', (_, res) => {
      res.json({
        success: true,
        message: 'Real Estate Photo AI Backend',
        data: {
          name: config.appName,
          version: config.appVersion,
          status: 'operational',
          documentation: '/api/v1/test',
          webInterface: '/test',
          endpoints: {
            health: '/api/v1/health',
            test: '/api/v1/test',
            upload: '/api/v1/upload',
            process: '/api/v1/process-image',
            modelInfo: '/api/v1/model-info',
          },
        },
        timestamp: new Date().toISOString(),
      });
    });

    // Enhanced test interface
    this.app.get('/test-enhanced', (_, res) => {
      res.sendFile(path.join(process.cwd(), 'test-enhanced.html'));
    });

    // Web interface for testing
    this.app.get('/test', (_, res) => {
      const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <title>Real Estate Photo AI - Web Interface</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            padding: 0; margin: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            min-height: 100vh;
        }
        .container { 
            max-width: 800px; margin: 0 auto; background: white; 
            border-radius: 15px; box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            margin-top: 20px; margin-bottom: 20px;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white; padding: 30px; border-radius: 15px 15px 0 0; text-align: center;
        }
        .content { padding: 30px; }
        .form-group { margin-bottom: 20px; }
        label { display: block; margin-bottom: 8px; font-weight: 600; color: #333; }
        input, textarea, select { 
            width: 100%; padding: 12px; border: 2px solid #e1e5e9; 
            border-radius: 8px; font-size: 14px; transition: border-color 0.3s;
            box-sizing: border-box;
        }
        input:focus, textarea:focus, select:focus {
            outline: none; border-color: #667eea; box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
        button { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white; padding: 15px 30px; border: none; border-radius: 8px; 
            cursor: pointer; font-size: 16px; font-weight: 600; width: 100%;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        button:hover { 
            transform: translateY(-2px); 
            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
        }
        button:disabled {
            background: #ccc; cursor: not-allowed; transform: none; box-shadow: none;
        }
        .result { margin-top: 30px; border-radius: 8px; overflow: hidden; }
        .success { background: #d4edda; border: 2px solid #c3e6cb; }
        .error { background: #f8d7da; border: 2px solid #f5c6cb; }
        .loading { 
            text-align: center; color: #667eea; font-weight: bold;
            padding: 40px; background: #f8f9ff; border: 2px solid #e6ecff;
        }
        .result-content { padding: 20px; }
        .images { display: flex; gap: 20px; margin-top: 20px; flex-wrap: wrap; }
        .image-container { flex: 1; text-align: center; min-width: 300px; }
        .image-container h4 { margin: 0 0 10px 0; color: #495057; }
        .image-container img { 
            max-width: 100%; border-radius: 8px; 
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            transition: transform 0.3s;
        }
        .image-container img:hover { transform: scale(1.02); }
        .spinner { 
            border: 4px solid #f3f3f3; border-top: 4px solid #667eea; 
            border-radius: 50%; width: 40px; height: 40px; 
            animation: spin 1s linear infinite; margin: 0 auto;
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .stats { 
            display: flex; justify-content: space-between; margin-top: 15px;
            padding: 15px; background: #f8f9fa; border-radius: 8px;
        }
        .stat { text-align: center; }
        .stat-value { font-size: 18px; font-weight: bold; color: #667eea; }
        .stat-label { font-size: 12px; color: #6c757d; text-transform: uppercase; }
        @media (max-width: 768px) {
            .images { flex-direction: column; }
            .container { margin: 10px; border-radius: 10px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏠 Real Estate Photo AI</h1>
            <p>Transform empty rooms into beautifully decorated spaces using AI!</p>
        </div>
        
        <div class="content">
            <form id="uploadForm">
                <div class="form-group">
                    <label for="image">📸 Room Image (JPG/PNG/WebP)</label>
                    <input type="file" id="image" accept="image/*" required>
                    <small style="color: #6c757d;">Upload a photo of an empty or cluttered room</small>
                </div>
                
                <div class="form-group">
                    <label for="style">🎨 Decoration Style</label>
                    <select id="style">
                        <option value="modern minimalist">Modern Minimalist</option>
                        <option value="contemporary">Contemporary</option>
                        <option value="traditional">Traditional</option>
                        <option value="rustic">Rustic</option>
                        <option value="scandinavian">Scandinavian</option>
                        <option value="industrial">Industrial</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label for="prompt">✨ Custom Description (Optional)</label>
                                                 <textarea id="prompt" rows="3" placeholder="Describe the furniture and decor to add...">modern living room with comfortable seating, coffee table, plants, and warm lighting</textarea>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div class="form-group">
                        <label for="guidance">🎯 AI Guidance (1-20)</label>
                        <input type="number" id="guidance" value="7.5" step="0.1" min="1" max="20">
                        <small style="color: #6c757d;">Higher = follows prompt more closely</small>
                    </div>
                    
                                         <div class="form-group">
                         <label for="steps">⚡ Processing Steps (10-50)</label>
                         <input type="number" id="steps" value="20" min="10" max="50">
                         <small style="color: #6c757d;">Higher = better quality, slower</small>
                     </div>
                 </div>
                 
                 <div class="form-group">
                     <label for="strength">🎨 Prompt Strength (0.1-1.0)</label>
                     <input type="number" id="strength" value="0.3" step="0.05" min="0.1" max="1.0">
                     <small style="color: #6c757d;">Lower = preserves original layout better (recommended: 0.2-0.4)</small>
                 </div>
                
                <button type="submit" id="submitBtn">🚀 Transform Room with AI</button>
            </form>
            
            <div id="result" style="display: none;">
                <div id="loading" class="loading result" style="display: none;">
                    <div class="spinner"></div>
                    <h3 style="margin-top: 20px;">🤖 AI is decorating your room...</h3>
                    <p>This process typically takes 20-60 seconds.<br>Please be patient while we create magic! ✨</p>
                </div>
                
                <div id="success" class="success result" style="display: none;">
                    <div class="result-content"></div>
                </div>
                
                <div id="error" class="error result" style="display: none;">
                    <div class="result-content"></div>
                </div>
            </div>
        </div>
    </div>

    <script>
        document.getElementById('uploadForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const resultDiv = document.getElementById('result');
            const loadingDiv = document.getElementById('loading');
            const successDiv = document.getElementById('success');
            const errorDiv = document.getElementById('error');
            const submitBtn = document.getElementById('submitBtn');
            
            // Show loading
            resultDiv.style.display = 'block';
            loadingDiv.style.display = 'block';
            successDiv.style.display = 'none';
            errorDiv.style.display = 'none';
            submitBtn.disabled = true;
            submitBtn.textContent = 'Processing...';
            
            // Scroll to results
            resultDiv.scrollIntoView({ behavior: 'smooth' });
            
            try {
                // Prepare form data
                const formData = new FormData();
                formData.append('image', document.getElementById('image').files[0]);
                formData.append('style', document.getElementById('style').value);
                                 formData.append('prompt', document.getElementById('prompt').value);
                 formData.append('guidance', document.getElementById('guidance').value);
                 formData.append('steps', document.getElementById('steps').value);
                 formData.append('strength', document.getElementById('strength').value);
                
                const startTime = Date.now();
                const response = await fetch('/api/v1/process-image', {
                    method: 'POST',
                    body: formData
                });
                
                const result = await response.json();
                const endTime = Date.now();
                
                loadingDiv.style.display = 'none';
                
                if (result.success) {
                    successDiv.querySelector('.result-content').innerHTML = \`
                        <h3 style="color: #155724; margin-top: 0;">🎉 Room Transformation Complete!</h3>
                        <div class="stats">
                            <div class="stat">
                                <div class="stat-value">\${(result.processingTime / 1000).toFixed(1)}s</div>
                                <div class="stat-label">Processing Time</div>
                            </div>
                            <div class="stat">
                                <div class="stat-value">\${document.getElementById('steps').value}</div>
                                <div class="stat-label">AI Steps</div>
                            </div>
                            <div class="stat">
                                <div class="stat-value">\${document.getElementById('guidance').value}</div>
                                <div class="stat-label">Guidance</div>
                            </div>
                        </div>
                        <div class="images">
                            <div class="image-container">
                                <h4>📸 Original Room</h4>
                                <img src="\${result.originalImage}" alt="Original Room" loading="lazy">
                            </div>
                            <div class="image-container">
                                <h4>✨ AI-Decorated Room</h4>
                                <img src="\${result.processedImage}" alt="Decorated Room" loading="lazy">
                            </div>
                        </div>
                        <div style="margin-top: 20px; padding: 15px; background: #e8f4fd; border-radius: 8px;">
                            <strong>💡 Pro Tip:</strong> Right-click on images to save them to your computer!
                        </div>
                    \`;
                    successDiv.style.display = 'block';
                } else {
                    errorDiv.querySelector('.result-content').innerHTML = \`
                        <h3 style="color: #721c24; margin-top: 0;">❌ Processing Failed</h3>
                        <p><strong>Error:</strong> \${result.message || result.error}</p>
                        <p>Please try again with a different image or adjust the settings.</p>
                        <div style="margin-top: 15px; padding: 10px; background: #fff3cd; border-radius: 5px;">
                            <strong>💡 Tips:</strong>
                            <ul style="margin: 10px 0; padding-left: 20px;">
                                <li>Use clear, well-lit room photos</li>
                                <li>Try reducing the number of processing steps</li>
                                <li>Make sure your image is under 10MB</li>
                            </ul>
                        </div>
                    \`;
                    errorDiv.style.display = 'block';
                }
            } catch (error) {
                loadingDiv.style.display = 'none';
                errorDiv.querySelector('.result-content').innerHTML = \`
                    <h3 style="color: #721c24; margin-top: 0;">❌ Connection Error</h3>
                    <p><strong>Error:</strong> \${error.message}</p>
                    <p>Please make sure the server is running and try again.</p>
                \`;
                errorDiv.style.display = 'block';
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = '🚀 Transform Room with AI';
            }
        });

        // File upload preview
        document.getElementById('image').addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    // Could add image preview here if needed
                };
                reader.readAsDataURL(file);
            }
        });
    </script>
</body>
</html>`;
      
      res.setHeader('Content-Type', 'text/html');
      res.send(htmlContent);
    });

    // API routes
    this.app.use(config.apiPrefix, routes);

    logger.info('Routes initialized successfully');
  }

  private initializeErrorHandling(): void {
    // 404 handler
    this.app.use(notFoundHandler);

    // Global error handler
    this.app.use(errorHandler);

    logger.info('Error handling initialized successfully');
  }

  public async start(): Promise<void> {
    try {
      // Initialize directories first
      await this.initializeDirectories();

      const server = this.app.listen(config.port, () => {
        logger.info(`🚀 ${config.appName} started successfully!`, {
          port: config.port,
          nodeEnv: config.nodeEnv,
          apiPrefix: config.apiPrefix,
          model: config.stableDiffusionModel,
        workflow: config.enableInpaintingWorkflow ? 'depth_inpainting' : 'single_pass',
        });

        logger.info('📖 API Endpoints:', {
          root: `http://localhost:${config.port}/`,
          health: `http://localhost:${config.port}${config.apiPrefix}/health`,
          test: `http://localhost:${config.port}${config.apiPrefix}/test`,
          upload: `http://localhost:${config.port}${config.apiPrefix}/upload`,
          process: `http://localhost:${config.port}${config.apiPrefix}/process-image`,
          modelInfo: `http://localhost:${config.port}${config.apiPrefix}/model-info`,
        });
      });

      // Graceful shutdown
      process.on('SIGTERM', () => {
        logger.info('SIGTERM received, shutting down gracefully...');
        server.close(() => {
          logger.info('Process terminated');
          process.exit(0);
        });
      });

      process.on('SIGINT', () => {
        logger.info('SIGINT received, shutting down gracefully...');
        server.close(() => {
          logger.info('Process terminated');
          process.exit(0);
        });
      });

    } catch (error) {
      logger.error('Failed to start application', { error });
      process.exit(1);
    }
  }
}

// Create and start the application
const app = new App();

// Start the server
app.start().catch((error) => {
  logger.error('Failed to start server', { error });
  process.exit(1);
});

export default app; 