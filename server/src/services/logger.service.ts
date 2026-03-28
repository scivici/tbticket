const isProduction = process.env.NODE_ENV === 'production';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const LEVEL_COLORS: Record<LogLevel, string> = { debug: '\x1b[36m', info: '\x1b[32m', warn: '\x1b[33m', error: '\x1b[31m' };
const RESET = '\x1b[0m';

interface Logger {
  debug(message: string, data?: Record<string, any>): void;
  info(message: string, data?: Record<string, any>): void;
  warn(message: string, data?: Record<string, any>): void;
  error(message: string, data?: Record<string, any>): void;
}

function formatPretty(level: LogLevel, module: string, message: string, data?: Record<string, any>): string {
  const ts = new Date().toISOString().replace('T', ' ').replace('Z', '');
  const color = LEVEL_COLORS[level];
  const lvl = level.toUpperCase().padEnd(5);
  let line = `${ts} ${color}${lvl}${RESET} [${module}] ${message}`;
  if (data && Object.keys(data).length > 0) {
    line += ' ' + JSON.stringify(data);
  }
  return line;
}

function formatJson(level: LogLevel, module: string, message: string, data?: Record<string, any>): string {
  const entry: Record<string, any> = {
    timestamp: new Date().toISOString(),
    level,
    module,
    message,
  };
  if (data && Object.keys(data).length > 0) {
    entry.data = data;
  }
  return JSON.stringify(entry);
}

export function createLogger(module: string): Logger {
  const log = (level: LogLevel, message: string, data?: Record<string, any>) => {
    const minLevel = isProduction ? 'info' : 'debug';
    if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[minLevel]) return;

    const line = isProduction
      ? formatJson(level, module, message, data)
      : formatPretty(level, module, message, data);

    if (level === 'error') {
      console.error(line);
    } else if (level === 'warn') {
      console.warn(line);
    } else {
      console.log(line);
    }
  };

  return {
    debug: (message, data?) => log('debug', message, data),
    info: (message, data?) => log('info', message, data),
    warn: (message, data?) => log('warn', message, data),
    error: (message, data?) => log('error', message, data),
  };
}
