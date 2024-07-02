import type { ExecaChildProcess, Options } from 'execa';
import chalk from 'chalk';
import { execa, execaNode } from 'execa';

const logger = console;

type StepOptions = {
  startMessage?: string;
  errorMessage?: string;
  dryRun?: boolean;
  debug?: boolean;
  signal?: AbortSignal;
};

export const exec = async (
  command: string | string[],
  options: Options = {},
  { startMessage, errorMessage, dryRun, debug, signal }: StepOptions = {}
): Promise<void> => {
  logger.info();
  if (startMessage) logger.info(startMessage);

  if (dryRun) {
    logger.info(`\n> ${command}\n`);
    return undefined;
  }

  const defaultOptions: Options = {
    shell: true,
    stdout: debug ? 'pipe' : 'ignore',
    stderr: debug ? 'pipe' : 'ignore',
    signal,
  };
  try {
    if (typeof command === 'string') {
      if (debug) {
        logger.debug(`> ${command}`);
      }
      const [file, ...args] = command.split(' ');
      const currentChild = execa(file, args, { ...defaultOptions, ...options });

      if (debug) {
        currentChild.stdout?.pipe(process.stdout);
        currentChild.stderr?.pipe(process.stderr);
      }

      await currentChild;
    } else {
      for (const subcommand of command) {
        if (debug) {
          logger.debug(`> ${subcommand}`);
        }
        const [file, ...args] = subcommand.split(' ');

        let currentChild: ExecaChildProcess;

        if (file === 'node') {
          const [path, ...pathArgs] = args;
          currentChild = execaNode(path, pathArgs, { ...defaultOptions, ...options });
        } else {
          currentChild = execa(file, args, { ...defaultOptions, ...options });
        }

        if (debug) {
          currentChild.stdout?.pipe(process.stdout);
          currentChild.stderr?.pipe(process.stderr);
        }

        await currentChild;
      }
    }
  } catch (err) {
    if (!(typeof err === 'object' && 'killed' in err && err.killed)) {
      logger.error(chalk.red(`An error occurred while executing: \`${command}\``));
      logger.log(`${errorMessage}\n`);
    }

    throw err;
  }

  return undefined;
};
