import { isCI } from 'storybook/internal/common';
import { colors, logger } from 'storybook/internal/node-logger';

import picocolors from 'picocolors';

const fancy = process.platform !== 'win32' || isCI() || process.env.TERM === 'xterm-256color';

export const step = colors.gray('›');
export const info = colors.blue(fancy ? 'ℹ' : 'i');
export const success = colors.green(fancy ? '✔' : '√');
export const warning = colors.orange(fancy ? '⚠' : '‼');
export const error = colors.red(fancy ? '✖' : '×');

type Options = Parameters<typeof logger.logBox>[2];

const baseOptions: Options = {
  rounded: true,
  contentPadding: 1,
};

export const print = (message: string, title: string | undefined, options: Options) => {
  logger.line(1);
  logger.logBox(message, title, { ...baseOptions, ...options });
};

export const printInfo = (title: string, message: string, options?: Options) =>
  print(message, title, { formatBorder: picocolors.blue, ...options });

export const printWarning = (title: string, message: string, options?: Options) =>
  print(message, title, { formatBorder: picocolors.yellow, ...options });

export const printError = (title: string, message: string, options?: Options) =>
  print(message, title, { formatBorder: picocolors.red, ...options });

export const printSuccess = (title: string, message: string, options?: Options) =>
  print(message, title, { formatBorder: picocolors.green, ...options });
