import * as clack from '@clack/prompts';
import boxen from 'boxen';

import { isClackEnabled } from '../prompts/prompt-config';
import { currentTaskLog } from '../prompts/prompt-provider-clack';
import { wrapTextForClack } from '../wrap-utils';
import { CLI_COLORS } from './colors';
import { logTracker } from './log-tracker';

const createLogFunction =
  (clackFn: (message: string) => void, consoleFn: (...args: any[]) => void) => () =>
    isClackEnabled()
      ? (message: string) => {
          if (currentTaskLog) {
            currentTaskLog.message(message);
          } else {
            clackFn(wrapTextForClack(message));
          }
        }
      : consoleFn;

const LOG_FUNCTIONS = {
  log: createLogFunction(clack.log.message, console.log),
  info: createLogFunction(clack.log.info, console.log),
  warn: createLogFunction(clack.log.warn, console.warn),
  error: createLogFunction(clack.log.error, console.error),
  intro: createLogFunction(clack.intro, console.log),
  outro: createLogFunction(clack.outro, console.log),
  step: createLogFunction(clack.log.step, console.log),
};

// Log level types and state
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LOG_LEVELS: Record<LogLevel, number> = {
  trace: 1,
  debug: 2,
  info: 3,
  warn: 4,
  error: 5,
  silent: 10,
};

let currentLogLevel: LogLevel = 'info';

export const setLogLevel = (level: LogLevel): void => {
  currentLogLevel = level;
};

export const getLogLevel = (): LogLevel => {
  return currentLogLevel;
};

export const shouldLog = (level: LogLevel): boolean => {
  return LOG_LEVELS[currentLogLevel] <= LOG_LEVELS[level];
};

function getMinimalTrace() {
  // eslint-disable-next-line local-rules/no-uncategorized-errors
  const stack = new Error().stack;

  if (!stack) {
    return;
  }

  // remove the first line ("Error")
  const lines = stack.split('\n').slice(1);

  // Clean up stack: remove this own file utilities from the stack
  const userStackLines = lines.filter(
    (line) => !['getMinimalTrace', 'createLogger', 'logFunction'].some((fn) => line.includes(fn))
  );

  if (userStackLines.length === 0) {
    return;
  }

  const callStack = '\n' + userStackLines.slice(0, 2).join('\n');

  return callStack;
}

const formatLogMessage = (args: any[]): string => {
  return args
    .map((arg) => {
      if (typeof arg === 'string') {
        return arg;
      }

      if (typeof arg === 'object') {
        return JSON.stringify(arg, null, 2);
      }
      return String(arg);
    })
    .join(' ');
};

// Higher-level abstraction for creating logging functions
function createLogger(
  level: LogLevel | 'prompt',
  logFn: (message: string) => void,
  prefix?: string
) {
  return function logFunction(...args: any[]) {
    const message = formatLogMessage(args);
    logTracker.addLog(level, message);

    if (level === 'prompt') {
      level = 'info';
    }
    if (shouldLog(level)) {
      const formattedMessage = prefix ? `${prefix} ${message}` : message;
      logFn(formattedMessage);
    }
  };
}

// Create all logging functions using the factory
export const debug = createLogger(
  'debug',
  function logFunction(message) {
    if (shouldLog('trace')) {
      message += getMinimalTrace();
    }
    LOG_FUNCTIONS.log()(message);
  },
  '[DEBUG]'
);

export const log = createLogger('info', (...args) => {
  return LOG_FUNCTIONS.log()(...args);
});
export const info = createLogger('info', (...args) => {
  return LOG_FUNCTIONS.info()(...args);
});
export const warn = createLogger('warn', (...args) => {
  return LOG_FUNCTIONS.warn()(...args);
});
export const error = createLogger('error', (...args) => {
  return LOG_FUNCTIONS.error()(...args);
});

type BoxenOptions = {
  borderStyle?: 'round' | 'none';
  padding?: number;
  title?: string;
  titleAlignment?: 'left' | 'center' | 'right';
  borderColor?: string;
  backgroundColor?: string;
};

export const logBox = (message: string, options?: BoxenOptions) => {
  if (shouldLog('info')) {
    logTracker.addLog('info', message);
    if (isClackEnabled()) {
      if (options?.title) {
        log(options.title);
      }
      log(message);
    } else {
      console.log(
        boxen(message, {
          borderStyle: 'round',
          padding: 1,
          borderColor: '#F1618C', // pink
          ...options,
        })
      );
    }
  }
};

export const intro = (message: string) => {
  logTracker.addLog('info', message);
  console.log('\n');
  LOG_FUNCTIONS.intro()(message);
};

export const outro = (message: string) => {
  logTracker.addLog('info', message);
  LOG_FUNCTIONS.outro()(message);
  console.log('\n');
};

export const step = (message: string) => {
  logTracker.addLog('info', message);
  LOG_FUNCTIONS.step()(message);
};

export const SYMBOLS = {
  success: CLI_COLORS.success('✔'),
  error: CLI_COLORS.error('✕'),
};

// Export the text wrapping utility for external use
export { wrapTextForClack };
