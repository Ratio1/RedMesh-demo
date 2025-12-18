type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerOptions {
  prefix?: string;
  enabled?: boolean;
}

class Logger {
  private prefix: string;
  private enabled: boolean;

  constructor(options: LoggerOptions = {}) {
    this.prefix = options.prefix ?? 'App';
    this.enabled = options.enabled ?? this.isDebugEnabled();
  }

  private isDebugEnabled(): boolean {
    return process.env.REDMESH_DEBUG === '1' || process.env.REDMESH_DEBUG === 'true';
  }

  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${this.prefix}] [${level.toUpperCase()}] ${message}`;
  }

  private log(level: LogLevel, message: string, data?: unknown): void {
    if (!this.enabled && level === 'debug') return;

    const formattedMessage = this.formatMessage(level, message);
    const logFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;

    if (data !== undefined) {
      const dataStr = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
      logFn(formattedMessage, dataStr);
    } else {
      logFn(formattedMessage);
    }
  }

  debug(message: string, data?: unknown): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: unknown): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: unknown): void {
    this.log('warn', message, data);
  }

  error(message: string, data?: unknown): void {
    this.log('error', message, data);
  }

  /** Create a child logger with a different prefix */
  child(prefix: string): Logger {
    return new Logger({ prefix, enabled: this.enabled });
  }
}

// Pre-configured loggers for different modules
export const logger = new Logger({ prefix: 'App' });
export const apiLogger = new Logger({ prefix: 'API' });
export const redmeshLogger = new Logger({ prefix: 'RedMesh API' });
export const jobsLogger = new Logger({ prefix: 'Jobs Route' });

// Factory function to create custom loggers
export function createLogger(prefix: string): Logger {
  return new Logger({ prefix });
}

export default Logger;
