/**
 * Sistema de Logging Centralizado
 * 
 * Níveis de log:
 * - DEBUG: Informações detalhadas para debugging
 * - INFO: Informações gerais sobre operações
 * - WARN: Avisos que não impedem funcionamento
 * - ERROR: Erros que afetam funcionalidade
 * 
 * Em produção, logs DEBUG são suprimidos por padrão.
 * Configure LOG_LEVEL=debug para ver todos os logs.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  data?: unknown;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function getLogLevel(): LogLevel {
  const envLevel = process.env.LOG_LEVEL?.toLowerCase() as LogLevel;
  if (envLevel && LOG_LEVELS[envLevel] !== undefined) {
    return envLevel;
  }
  // Em produção, padrão é 'info'; em desenvolvimento, 'debug'
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
}

function shouldLog(level: LogLevel): boolean {
  const currentLevel = getLogLevel();
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function formatTimestamp(): string {
  return new Date().toISOString();
}

function formatLogEntry(entry: LogEntry): string {
  const parts = [
    `[${entry.timestamp}]`,
    `[${entry.level.toUpperCase()}]`,
    `[${entry.module}]`,
    entry.message,
  ];

  if (entry.data !== undefined) {
    try {
      parts.push(`| Data: ${JSON.stringify(entry.data, null, 2)}`);
    } catch {
      parts.push(`| Data: [Não serializável]`);
    }
  }

  if (entry.error) {
    parts.push(`| Error: ${entry.error.name}: ${entry.error.message}`);
    if (entry.error.stack) {
      parts.push(`\n${entry.error.stack}`);
    }
  }

  return parts.join(' ');
}

function log(level: LogLevel, module: string, message: string, data?: unknown, error?: Error): void {
  if (!shouldLog(level)) return;

  const entry: LogEntry = {
    timestamp: formatTimestamp(),
    level,
    module,
    message,
  };

  if (data !== undefined) {
    entry.data = data;
  }

  if (error) {
    entry.error = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  const formatted = formatLogEntry(entry);

  switch (level) {
    case 'debug':
    case 'info':
      console.log(formatted);
      break;
    case 'warn':
      console.warn(formatted);
      break;
    case 'error':
      console.error(formatted);
      break;
  }
}

/**
 * Cria um logger para um módulo específico
 */
export function createLogger(module: string) {
  return {
    debug: (message: string, data?: unknown) => log('debug', module, message, data),
    info: (message: string, data?: unknown) => log('info', module, message, data),
    warn: (message: string, data?: unknown, error?: Error) => log('warn', module, message, data, error),
    error: (message: string, data?: unknown, error?: Error) => log('error', module, message, data, error),
  };
}

/**
 * Logger para queries do banco de dados
 * Formata queries de forma legível
 */
export function logQuery(query: string, params?: unknown[], duration?: number): void {
  if (!shouldLog('debug')) return;

  const logger = createLogger('Database');
  
  let message = `Query: ${query}`;
  if (params && params.length > 0) {
    message += ` | Params: ${JSON.stringify(params)}`;
  }
  if (duration !== undefined) {
    message += ` | Duration: ${duration}ms`;
  }

  logger.debug(message);
}

/**
 * Logger para erros de query
 */
export function logQueryError(query: string, params: unknown[] | undefined, error: Error): void {
  const logger = createLogger('Database');
  
  logger.error(
    `Failed query: ${query}`,
    { params, errorCode: (error as any).code, errorDetail: (error as any).detail },
    error
  );
}

/**
 * Logger para conexão do banco
 */
export function logDbConnection(status: 'connecting' | 'connected' | 'error' | 'disconnected', details?: unknown): void {
  const logger = createLogger('Database');
  
  switch (status) {
    case 'connecting':
      logger.info('Tentando conectar ao banco de dados...', details);
      break;
    case 'connected':
      logger.info('Conexão com banco de dados estabelecida', details);
      break;
    case 'error':
      logger.error('Erro na conexão com banco de dados', details);
      break;
    case 'disconnected':
      logger.warn('Desconectado do banco de dados', details);
      break;
  }
}

/**
 * Logger para requisições HTTP
 */
export function logRequest(method: string, path: string, statusCode?: number, duration?: number): void {
  const logger = createLogger('HTTP');
  
  let message = `${method} ${path}`;
  if (statusCode !== undefined) {
    message += ` | Status: ${statusCode}`;
  }
  if (duration !== undefined) {
    message += ` | Duration: ${duration}ms`;
  }

  if (statusCode && statusCode >= 400) {
    logger.warn(message);
  } else {
    logger.info(message);
  }
}

export default createLogger;
