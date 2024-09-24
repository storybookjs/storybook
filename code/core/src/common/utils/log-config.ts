import chalk from 'chalk';

export function logConfig(caption: unknown, config: unknown) {
  console.log(chalk.cyan(caption));
  console.dir(config, { depth: null });
}
