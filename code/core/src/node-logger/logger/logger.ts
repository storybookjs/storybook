import * as clack from '@clack/prompts';

import { isClackEnabled } from '../prompts/prompt-config';
import { getCurrentTaskLog } from '../prompts/prompt-provider-clack';
import { wrapTextForClack } from '../wrap-utils';
import { CLI_COLORS } from './colors';
import { logTracker } from './log-tracker';

const createLogFunction =
  <T extends (...args: any[]) => any>(
    clackFn: T,
    consoleFn: (...args: Parameters<T>) => void,
    cliColors?: (typeof CLI_COLORS)[keyof typeof CLI_COLORS]
  ) =>
  () =>
    isClackEnabled()
      ? (...args: Parameters<T>) => {
          const [message, ...rest] = args;
          const currentTaskLog = getCurrentTaskLog();
          if (currentTaskLog) {
            currentTaskLog.message(
              cliColors && typeof message === 'string' ? cliColors(message) : message
            );
          } else {
            // If first parameter is a string, wrap; otherwise pass as-is
            if (typeof message === 'string') {
              (clackFn as T)(wrapTextForClack(message), ...rest);
            } else {
              (clackFn as T)(message, ...rest);
            }
          }
        }
      : consoleFn;

const LOG_FUNCTIONS = {
  log: createLogFunction(clack.log.message, console.log),
  info: createLogFunction(clack.log.info, console.log),
  warn: createLogFunction(clack.log.warn, console.warn, CLI_COLORS.warning),
  error: createLogFunction(clack.log.error, console.error, CLI_COLORS.error),
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
function createLogger<T extends (...args: any[]) => void>(
  level: LogLevel | 'prompt',
  logFn: T,
  prefix?: string
) {
  return function logFunction(...args: Parameters<T>) {
    const [message, ...rest] = args;
    const msg = formatLogMessage([message]);
    logTracker.addLog(level, msg);

    if (level === 'prompt') {
      level = 'info';
    }
    if (shouldLog(level)) {
      const formattedMessage = prefix ? `${prefix} ${msg}` : message;
      logFn(formattedMessage, ...rest); // in practice, logFn typically expects a string
    }
  };
}

/**
 * For detailed information useful for debugging, which is hidden by default and only appears in log
 * files or when the log level is set to debug
 */
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

/** For general information that should always be visible to the user */
export const log = createLogger('info', LOG_FUNCTIONS.log());
/** For general information that should catch the user's attention */
export const info = createLogger('info', LOG_FUNCTIONS.info());
export const warn = createLogger('warn', LOG_FUNCTIONS.warn());
export const error = createLogger('error', LOG_FUNCTIONS.error());

type BoxOptions = {
  borderStyle?: 'round' | 'none';
  contentPadding?: number;
  title?: string;
  titleAlign?: 'left' | 'center' | 'right';
  borderColor?: string;
  backgroundColor?: string;
  width?: number | 'auto';
};

export const logBox = (message: string, { title, ...options }: BoxOptions = {}) => {
  if (shouldLog('info')) {
    logTracker.addLog('info', message);
    if (isClackEnabled()) {
      clack.box(message, title, {
        ...options,
        width: options.width ?? 'auto',
      });
    } else {
      console.log(message);
    }
  }
};

export const intro = (message: string) => {
  logTracker.addLog('info', message);
  if (shouldLog('info')) {
    console.log('\n');
    LOG_FUNCTIONS.intro()(message);
  }
};

export const outro = (message: string) => {
  logTracker.addLog('info', message);
  if (shouldLog('info')) {
    LOG_FUNCTIONS.outro()(message);
  }
};

export const step = (message: string) => {
  logTracker.addLog('info', message);
  if (shouldLog('info')) {
    LOG_FUNCTIONS.step()(message);
  }
};

export const SYMBOLS = {
  success: CLI_COLORS.success('✔'),
  error: CLI_COLORS.error('✕'),
};

// Export the text wrapping utility for external use
export { wrapTextForClack };
