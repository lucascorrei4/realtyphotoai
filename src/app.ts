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
import webhookRoutes from './routes/webhooks';

class App {
  public app: express.Application;

  constructor() {
    this.app = express();
    this.initializeDirectories().catch(error => {
      logger.error('Failed to initialize directories in constructor', { error });
    });
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

    // Trust the reverse proxy
    this.app.set('trust proxy', 1);

    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'", "'unsafe-inline'"], // Allow inline scripts for web interface
          imgSrc: ["'self'", "data:", "https:", "http:", "*"],
          connectSrc: ["'self'", "http:", "https:"],
        },
      },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }));

    // CORS configuration
    this.app.use(cors({
      origin: '*',
      credentials: false,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Requested-With'],
      exposedHeaders: ['Content-Length', 'Content-Type'],
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

    // Static file serving with CORS headers
    this.app.use('/uploads', (_req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
      res.header('Access-Control-Expose-Headers', 'Content-Length, Content-Type');
      res.header('Cross-Origin-Resource-Policy', 'cross-origin');
      res.header('Cross-Origin-Embedder-Policy', 'unsafe-none');
      next();
    }, express.static(path.join(process.cwd(), config.uploadDir)));

    this.app.use('/outputs', (_req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
      res.header('Access-Control-Expose-Headers', 'Content-Length, Content-Type');
      res.header('Cross-Origin-Resource-Policy', 'cross-origin');
      res.header('Cross-Origin-Embedder-Policy', 'unsafe-none');
      next();
    }, express.static(path.join(process.cwd(), config.outputDir)));

    this.app.use('/js', express.static(path.join(process.cwd(), 'public/js')));
    this.app.use('/css', express.static(path.join(process.cwd(), 'public/css')));

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

    // Handle image requests with proper CORS
    this.app.get('/uploads/*', (_req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
      res.header('Access-Control-Expose-Headers', 'Content-Length, Content-Type');
      res.header('Cross-Origin-Resource-Policy', 'cross-origin');
      res.header('Cross-Origin-Embedder-Policy', 'unsafe-none');
      next();
    });

    this.app.get('/outputs/*', (_req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
      res.header('Access-Control-Expose-Headers', 'Content-Length, Content-Type');
      res.header('Cross-Origin-Resource-Policy', 'cross-origin');
      res.header('Cross-Origin-Embedder-Policy', 'unsafe-none');
      next();
    });

    logger.info('Middleware initialized successfully');
  }

  private initializeRoutes(): void {

    // Home page - main application interface
    this.app.get('/', (_, res) => {
      res.sendFile(path.join(process.cwd(), 'public/home.html'));
    });

    // Alternative home route
    this.app.get('/home', (_, res) => {
      res.sendFile(path.join(process.cwd(), 'public/home.html'));
    });

    // Enhanced test interface
    this.app.get('/test-enhanced', (_, res) => {
      res.sendFile(path.join(process.cwd(), 'test-enhanced.html'));
    });

    // New separated test page
    this.app.get('/lab', (_, res) => {
      res.sendFile(path.join(process.cwd(), 'public/test-page.html'));
    });

    // API routes
    this.app.use(config.apiPrefix, routes);
    
    // Webhook routes (no auth required)
    this.app.use('/webhooks', webhookRoutes);

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

      const server = this.app.listen(config.port, '0.0.0.0', () => {
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