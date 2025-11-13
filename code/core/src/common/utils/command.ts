import { logger, prompt } from 'storybook/internal/node-logger';

// eslint-disable-next-line depend/ban-dependencies
import { type CommonOptions, type ExecaChildProcess, execa } from 'execa';

const COMMON_ENV_VARS = {
  COREPACK_ENABLE_STRICT: '0',
  COREPACK_ENABLE_AUTO_PIN: '0',
  NO_UPDATE_NOTIFIER: 'true',
};

export type ExecuteCommandOptions = CommonOptions<'utf8'> & {
  command: string;
  args?: string[];
  cwd?: string;
  ignoreError?: boolean;
  env?: Record<string, any>;
};

function getExecaOptions({ stdio, cwd, env, ...execaOptions }: ExecuteCommandOptions) {
  return {
    cwd,
    stdio: stdio ?? prompt.getPreferredStdio(),
    encoding: 'utf8' as const,
    shell: true,
    cleanup: true,
    env: {
      ...COMMON_ENV_VARS,
      ...env,
    },
    ...execaOptions,
  };
}

export function executeCommand(options: ExecuteCommandOptions): ExecaChildProcess {
  const { command, args = [], ignoreError = false } = options;
  logger.debug(`Executing command: ${command} ${args.join(' ')}`);
  const execaProcess = execa(command, args, getExecaOptions(options));

  if (ignoreError) {
    execaProcess.catch(() => {
      // Silently ignore errors when ignoreError is true
    });
  }

  return execaProcess;
}
