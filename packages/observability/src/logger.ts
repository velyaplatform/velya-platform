/**
 * Structured JSON logger for the Velya platform.
 *
 * All logs are emitted as structured JSON to support OpenTelemetry
 * collection and correlation across distributed services.
 */

/**
 * Log severity levels aligned with OpenTelemetry severity.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * Numeric severity values for filtering and comparison.
 */
const LOG_LEVEL_SEVERITY: Readonly<Record<LogLevel, number>> = {
  debug: 5,
  info: 9,
  warn: 13,
  error: 17,
  fatal: 21,
};

/**
 * Structured log entry emitted by the logger.
 */
export interface LogEntry {
  readonly timestamp: string;
  readonly level: LogLevel;
  readonly severity: number;
  readonly message: string;
  readonly service: string;
  readonly correlationId?: string;
  readonly spanId?: string;
  readonly traceId?: string;
  readonly attributes?: Readonly<Record<string, unknown>>;
  readonly error?: LogError;
}

/**
 * Structured error information for log entries.
 */
export interface LogError {
  readonly name: string;
  readonly message: string;
  readonly stack?: string;
}

/**
 * Configuration for the structured logger.
 */
export interface LoggerConfig {
  /** Service name included in every log entry. */
  readonly service: string;

  /** Minimum log level to emit. */
  readonly minLevel: LogLevel;

  /** Output target -- defaults to stdout. */
  readonly output?: LogOutput;
}

/**
 * Pluggable log output interface for testing and custom transports.
 */
export interface LogOutput {
  write(entry: LogEntry): void;
}

/**
 * Default stdout output that writes JSON lines.
 */
class StdoutOutput implements LogOutput {
  write(entry: LogEntry): void {
    process.stdout.write(JSON.stringify(entry) + '\n');
  }
}

/**
 * Context object passed through request lifecycle for correlation.
 */
export interface LogContext {
  readonly correlationId?: string;
  readonly spanId?: string;
  readonly traceId?: string;
  readonly attributes?: Readonly<Record<string, unknown>>;
}

/**
 * Structured logger that emits JSON log entries with OpenTelemetry
 * correlation IDs and service identification.
 */
export class Logger {
  private readonly service: string;
  private readonly minSeverity: number;
  private readonly output: LogOutput;

  constructor(config: LoggerConfig) {
    this.service = config.service;
    this.minSeverity = LOG_LEVEL_SEVERITY[config.minLevel];
    this.output = config.output ?? new StdoutOutput();
  }

  /**
   * Create a child logger with additional default context.
   */
  child(context: LogContext): ChildLogger {
    return new ChildLogger(this, context);
  }

  /**
   * Log a debug message.
   */
  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  /**
   * Log an informational message.
   */
  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  /**
   * Log a warning message.
   */
  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  /**
   * Log an error message with optional Error object.
   */
  error(message: string, error?: Error, context?: LogContext): void {
    const logError: LogError | undefined = error
      ? { name: error.name, message: error.message, stack: error.stack }
      : undefined;

    this.log('error', message, context, logError);
  }

  /**
   * Log a fatal error. The process is expected to exit after this.
   */
  fatal(message: string, error?: Error, context?: LogContext): void {
    const logError: LogError | undefined = error
      ? { name: error.name, message: error.message, stack: error.stack }
      : undefined;

    this.log('fatal', message, context, logError);
  }

  /**
   * Internal log method that checks severity and emits the entry.
   */
  private log(level: LogLevel, message: string, context?: LogContext, error?: LogError): void {
    const severity = LOG_LEVEL_SEVERITY[level];
    if (severity < this.minSeverity) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      severity,
      message,
      service: this.service,
      correlationId: context?.correlationId,
      spanId: context?.spanId,
      traceId: context?.traceId,
      attributes: context?.attributes,
      error,
    };

    this.output.write(entry);
  }
}

/**
 * Child logger that inherits context from a parent logger.
 */
export class ChildLogger {
  constructor(
    private readonly parent: Logger,
    private readonly context: LogContext,
  ) {}

  debug(message: string, extra?: LogContext): void {
    this.parent.debug(message, this.merge(extra));
  }

  info(message: string, extra?: LogContext): void {
    this.parent.info(message, this.merge(extra));
  }

  warn(message: string, extra?: LogContext): void {
    this.parent.warn(message, this.merge(extra));
  }

  error(message: string, error?: Error, extra?: LogContext): void {
    this.parent.error(message, error, this.merge(extra));
  }

  fatal(message: string, error?: Error, extra?: LogContext): void {
    this.parent.fatal(message, error, this.merge(extra));
  }

  private merge(extra?: LogContext): LogContext {
    if (!extra) return this.context;
    return {
      correlationId: extra.correlationId ?? this.context.correlationId,
      spanId: extra.spanId ?? this.context.spanId,
      traceId: extra.traceId ?? this.context.traceId,
      attributes: {
        ...this.context.attributes,
        ...extra.attributes,
      },
    };
  }
}

/**
 * Create a logger for a service with sensible defaults.
 */
export function createLogger(service: string, minLevel?: LogLevel): Logger {
  const level = minLevel ?? (process.env['LOG_LEVEL'] as LogLevel | undefined) ?? 'info';
  return new Logger({ service, minLevel: level });
}
