import { isCI } from 'storybook/internal/common';
import { colors, logger } from 'storybook/internal/node-logger';

const fancy = process.platform !== 'win32' || isCI() || process.env.TERM === 'xterm-256color';

export const step = colors.gray('›');
export const info = colors.blue(fancy ? 'ℹ' : 'i');
export const success = colors.green(fancy ? '✔' : '√');
export const warning = colors.orange(fancy ? '⚠' : '‼');
export const error = colors.red(fancy ? '✖' : '×');

type Options = Parameters<typeof logger.logBox>[1];

const baseOptions: Options = {
  borderStyle: 'round',
  padding: 1,
};

export const print = (message: string, options: Options) => {
  logger.line(1);
  logger.logBox(message, { ...baseOptions, ...options });
};

export const printInfo = (title: string, message: string, options?: Options) =>
  print(message, { borderColor: 'blue', title, ...options });

export const printWarning = (title: string, message: string, options?: Options) =>
  print(message, { borderColor: 'yellow', title, ...options });

export const printError = (title: string, message: string, options?: Options) =>
  print(message, { borderColor: 'red', title, ...options });

export const printSuccess = (title: string, message: string, options?: Options) =>
  print(message, { borderColor: 'green', title, ...options });
