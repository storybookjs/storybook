import { global } from '@storybook/global';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const { LOGLEVEL } = global;

type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'silent';

const levels: Record<LogLevel, number> = {
  trace: 1,
  debug: 2,
  info: 3,
  warn: 4,
  error: 5,
  silent: 10,
};

const currentLogLevelString: LogLevel = LOGLEVEL as LogLevel;
const currentLogLevelNumber: number = levels[currentLogLevelString] || levels.info;

type LoggingFn = (message: any, ...args: any[]) => void;

export const logger = {
  trace: (message: any, ...rest: any[]): void => {
    if (currentLogLevelNumber <= levels.trace) {
      console.trace(message, ...rest);
    }
  },
  debug: (message: any, ...rest: any[]): void => {
    if (currentLogLevelNumber <= levels.debug) {
      console.debug(message, ...rest);
    }
  },
  info: (message: any, ...rest: any[]): void => {
    if (currentLogLevelNumber <= levels.info) {
      console.info(message, ...rest);
    }
  },
  warn: (message: any, ...rest: any[]): void => {
    if (currentLogLevelNumber <= levels.warn) {
      console.warn(message, ...rest);
    }
  },
  error: (message: any, ...rest: any[]): void => {
    if (currentLogLevelNumber <= levels.error) {
      console.error(message, ...rest);
    }
  },
  log: (message: any, ...rest: any[]): void => {
    if (currentLogLevelNumber < levels.silent) {
      console.log(message, ...rest);
    }
  },
} as const;

const logged = new Set();
export const once =
  (type: keyof typeof logger) =>
  (message: any, ...rest: any[]) => {
    if (logged.has(message)) {
      return undefined;
    }
    logged.add(message);
    return logger[type](message, ...rest);
  };

once.clear = () => logged.clear();
once.trace = once('trace');
once.debug = once('debug');
once.info = once('info');
once.warn = once('warn');
once.error = once('error');
once.log = once('log');

export const deprecate = once('warn');

export const pretty =
  (type: keyof typeof logger) =>
  (...args: Parameters<LoggingFn>) => {
    const argArray: Parameters<LoggingFn> = [] as any;

    if (args.length) {
      const startTagRe = /<span\s+style=(['"])([^'"]*)\1\s*>/gi;
      const endTagRe = /<\/span>/gi;

      let reResultArray;
      argArray.push(args[0].replace(startTagRe, '%c').replace(endTagRe, '%c'));

      while ((reResultArray = startTagRe.exec(args[0]))) {
        argArray.push(reResultArray[2]);
        argArray.push('');
      }

      // pass through subsequent args since chrome dev tools does not (yet) support console.log styling of the following form: console.log('%cBlue!', 'color: blue;', '%cRed!', 'color: red;');

      for (let j = 1; j < args.length; j++) {
        argArray.push(args[j]);
      }
    }

    // eslint-disable-next-line prefer-spread
    logger[type].apply(logger, argArray);
  };

pretty.trace = pretty('trace');
pretty.debug = pretty('debug');
pretty.info = pretty('info');
pretty.warn = pretty('warn');
pretty.error = pretty('error');
