/// <reference types="node" />
import npmLog from 'npmlog';
import prettyTime from 'pretty-hrtime';

// The default is stderr, which can cause some tools (like rush.js) to think
// there are issues with the build: https://github.com/storybookjs/storybook/issues/14621
npmLog.stream = process.stdout;

function hex(hexColor: string) {
  // Ensure the hex color is 6 characters long and starts with '#'
  if (!/^#?[0-9A-Fa-f]{6}$/.test(hexColor)) {
    throw new Error('Invalid hex color. It must be a 6-character hex code.');
  }

  // Remove the leading '#' if it exists
  if (hexColor.startsWith('#')) {
    hexColor = hexColor.slice(1);
  }

  // Convert hex to RGB
  const r = parseInt(hexColor.slice(0, 2), 16);
  const g = parseInt(hexColor.slice(2, 4), 16);
  const b = parseInt(hexColor.slice(4, 6), 16);

  // Return the ANSI escape sequence for the given RGB color
  return (text: string) => `\x1b[38;2;${r};${g};${b}m${text}\x1b[39m`;
}

export const colors = {
  pink: hex('#F1618C'),
  purple: hex('#B57EE5'),
  orange: hex('#F3AD38'),
  green: hex('#A2E05E'),
  blue: hex('#6DABF5'),
  red: hex('#F16161'),
  gray: hex('#B8C2CC'),
};

export const logger = {
  verbose: (message: string): void => npmLog.verbose('', message),
  info: (message: string): void => npmLog.info('', message),
  plain: (message: string): void => console.log(message),
  line: (count = 1): void => console.log(`${Array(count - 1).fill('\n')}`),
  warn: (message: string): void => npmLog.warn('', message),
  trace: ({ message, time }: { message: string; time: [number, number] }): void =>
    npmLog.info('', `${message} (${colors.purple(prettyTime(time))})`),
  setLevel: (level = 'info'): void => {
    npmLog.level = level;
  },
  error: (message: Error | string): void => {
    if (npmLog.levels[npmLog.level] < npmLog.levels.error) {
      let msg: string;

      if (message instanceof Error && message.stack) {
        msg = message.stack.toString();
      } else {
        msg = message.toString();
      }

      console.log(
        msg
          .replace(message.toString(), colors.red(message.toString()))
          .replaceAll(process.cwd(), '.')
      );
    }
  },
};

export { npmLog as instance };

const logged = new Set();
export const once = (type: 'verbose' | 'info' | 'warn' | 'error') => (message: string) => {
  if (logged.has(message)) {
    return undefined;
  }
  logged.add(message);
  return logger[type](message);
};

once.clear = () => logged.clear();
once.verbose = once('verbose');
once.info = once('info');
once.warn = once('warn');
once.error = once('error');

export const deprecate = once('warn');
