import type { ExecaChildProcess, Options } from 'execa';
import { execa } from 'execa';
import picocolors from 'picocolors';

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

  if (startMessage) {
    logger.info(startMessage);
  }

  if (dryRun) {
    logger.info(`\n> ${command}\n`);
    return undefined;
  }

  const defaultOptions: Options = {
    shell: true,
    stdout: debug ? 'inherit' : 'pipe',
    stderr: debug ? 'inherit' : 'pipe',
    signal,
  };
  let currentChild: ExecaChildProcess<string>;

  try {
    if (typeof command === 'string') {
      logger.debug(`> ${command}`);
      currentChild = execa(command, { ...defaultOptions, ...options });
      await currentChild;
    } else {
      for (const subcommand of command) {
        logger.debug(`> ${subcommand}`);
        currentChild = execa(subcommand, { ...defaultOptions, ...options });
        await currentChild;
      }
    }
  } catch (err) {
    if (!(typeof err === 'object' && 'killed' in err && err.killed)) {
      logger.error(picocolors.red(`An error occurred while executing: \`${command}\``));
      logger.log(`${errorMessage}\n`);
    }

    throw err;
  }

  return undefined;
};
