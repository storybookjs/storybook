import * as clack from '@clack/prompts';
import boxen from 'boxen';

import { logTracker } from './log-tracker';
import { wrapTextForClack } from './wrap-utils';

const USE_CLACK = process.env.USE_CLACK === 'false' ? false : true;

const LOG_FUNCTIONS = {
  log: USE_CLACK ? (message: string) => clack.log.message(wrapTextForClack(message)) : console.log,
  warn: USE_CLACK ? (message: string) => clack.log.warn(wrapTextForClack(message)) : console.warn,
  error: USE_CLACK
    ? (message: string) => clack.log.error(wrapTextForClack(message))
    : console.error,
  intro: USE_CLACK ? (message: string) => clack.intro(wrapTextForClack(message)) : console.log,
  outro: USE_CLACK ? (message: string) => clack.outro(wrapTextForClack(message)) : console.log,
  step: USE_CLACK ? (message: string) => clack.log.step(wrapTextForClack(message)) : console.log,
};

// Log level types and state
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LOG_LEVELS: Record<LogLevel, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  silent: 5,
};

let currentLogLevel: LogLevel = 'info';

export const setLogLevel = (level: LogLevel): void => {
  currentLogLevel = level;
};

export const getLogLevel = (): LogLevel => {
  return currentLogLevel;
};

export const shouldLog = (level: LogLevel): boolean => {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLogLevel];
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

// Higher-level abstraction for creating logging functions
function createLogger(
  level: LogLevel | 'prompt',
  logFn: (message: string) => void,
  prefix?: string
) {
  return function logFunction(message: string) {
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
    LOG_FUNCTIONS.log(message);
  },
  '[DEBUG]'
);

export const log = createLogger('info', LOG_FUNCTIONS.log);
export const warn = createLogger('warn', LOG_FUNCTIONS.warn);
export const error = createLogger('error', LOG_FUNCTIONS.error);

type BoxenOptions = {
  borderStyle?: 'round' | 'none';
  padding?: number;
  title?: string;
  titleAlignment?: 'left' | 'center' | 'right';
  borderColor?: string;
  backgroundColor?: string;
};

export const logBox = (message: string, style?: BoxenOptions) => {
  if (shouldLog('info')) {
    logTracker.addLog('info', message);
    if (USE_CLACK) {
      log('');
      console.log(
        boxen(message, {
          borderStyle: 'round',
          padding: 1,
          borderColor: '#5c5c63', // gray
          ...style,
        })
          .replace(/╭/, '├')
          .replace(/╰/, '├')
      );
    } else {
      console.log(
        boxen(message, {
          borderStyle: 'round',
          padding: 1,
          borderColor: '#F1618C', // pink
          ...style,
        })
      );
    }
  }
};

export const intro = (message: string) => {
  logTracker.addLog('info', message);
  LOG_FUNCTIONS.intro(message);
};

export const outro = (message: string) => {
  logTracker.addLog('info', message);
  LOG_FUNCTIONS.outro(message);
};

export const step = (message: string) => {
  logTracker.addLog('info', message);
  LOG_FUNCTIONS.step(message);
};

// Export the text wrapping utility for external use
export { wrapTextForClack };
