// eslint-disable-next-line depend/ban-dependencies
import { type Options, type ResultPromise, execa } from 'execa';
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
  stepOptions: StepOptions = {},
  captureOutput?: boolean
): Promise<string | void> => {
  const { startMessage, errorMessage, dryRun, debug, signal } = stepOptions;
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
    stdout: captureOutput || debug ? (captureOutput ? 'pipe' : 'inherit') : 'pipe',
    stderr: captureOutput || debug ? (captureOutput ? 'pipe' : 'inherit') : 'pipe',
    stdin: 'inherit',
    ...(captureOutput && { all: true }),
    ...(signal && { cancelSignal: signal }),
  };
  let currentChild: ResultPromise;

  try {
    if (typeof command === 'string') {
      logger.debug(`> ${command}`);
      currentChild = execa(command, { ...defaultOptions, ...options });
      const result = await currentChild;
      if (captureOutput) {
        return result.all ?? '';
      }
    } else {
      for (const subcommand of command) {
        logger.debug(`> ${subcommand}`);
        currentChild = execa(subcommand, { ...defaultOptions, ...options });
        const result = await currentChild;
        if (captureOutput && subcommand === command[command.length - 1]) {
          return result.all ?? '';
        }
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
