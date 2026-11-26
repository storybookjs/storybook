import picocolors from 'picocolors';

export const CLI_COLORS = {
  success: picocolors.green,
  error: picocolors.red,
  warning: picocolors.yellow,
  // Improve contrast on dark terminals by using cyan for info on all platforms
  info: picocolors.cyan,
  debug: picocolors.gray,
  // Only color a link if it is the primary call to action, otherwise links shouldn't be colored
  cta: picocolors.cyan,
  muted: picocolors.dim,
  // Color to highlight, during a dry run, which file paths, package names or commands
  // would be impacted by a real run.
  dryRunChange: picocolors.yellow,
  // Color of the lines that say a command is a dry run: its intro, and the heading of what an
  // actual run would change.
  dryRun: (text: string) => picocolors.bold(picocolors.yellow(text)),
  storybook: (text: string) => `\x1b[38;2;255;71;133m${text}\x1b[39m`,
};
