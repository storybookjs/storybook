import picocolors from 'picocolors';

export const CLI_COLORS = {
  success: picocolors.green,
  error: picocolors.red,
  warning: picocolors.yellow,
  info: picocolors.blue,
  debug: picocolors.gray,
  // Only color a link if it is the primary call to action, otherwise links shouldn't be colored
  cta: picocolors.cyan,
  dimmed: picocolors.dim,
  storybook: (text: string) => `\x1b[38;2;255;71;133m${text}\x1b[39m`,
};
