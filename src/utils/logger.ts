import winston from 'winston';
import { config } from '../config';
import { LogLevel } from '../types';

class Logger {
  private logger: winston.Logger;

  constructor() {
    this.logger = winston.createLogger({
      level: config.logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
        winston.format.colorize({ all: true })
      ),
      defaultMeta: { service: config.appName },
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              let logMessage = `${timestamp} [${level.toUpperCase()}]: ${message}`;
              if (Object.keys(meta).length > 0) {
                logMessage += ` ${JSON.stringify(meta)}`;
              }
              return logMessage;
            })
          ),
        }),
      ],
    });

    if (config.nodeEnv === 'production') {
      this.logger.add(
        new winston.transports.File({
          filename: 'logs/error.log',
          level: LogLevel.ERROR,
        })
      );
      this.logger.add(
        new winston.transports.File({
          filename: 'logs/combined.log',
        })
      );
    }
  }

  public info(message: string, meta?: Record<string, unknown>): void {
    this.logger.info(message, meta);
  }

  public error(message: string, error?: Error | Record<string, unknown>): void {
    this.logger.error(message, error);
  }

  public warn(message: string, meta?: Record<string, unknown>): void {
    this.logger.warn(message, meta);
  }

  public debug(message: string, meta?: Record<string, unknown>): void {
    this.logger.debug(message, meta);
  }

  public getWinstonLogger(): winston.Logger {
    return this.logger;
  }
}

export const logger = new Logger(); 