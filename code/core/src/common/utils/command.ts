import { logger, prompt } from 'storybook/internal/node-logger';

// eslint-disable-next-line depend/ban-dependencies
import { type CommonOptions, type ExecaChildProcess, execa, execaCommandSync } from 'execa';

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
  const execaProcess = execa(resolveCommand(command), args, getExecaOptions(options));

  if (ignoreError) {
    execaProcess.catch(() => {
      // Silently ignore errors when ignoreError is true
    });
  }

  return execaProcess;
}

export function executeCommandSync(options: ExecuteCommandOptions): string {
  const { command, args = [], ignoreError = false } = options;
  try {
    const commandResult = execaCommandSync(
      [resolveCommand(command), ...args].join(' '),
      getExecaOptions(options)
    );
    return commandResult.stdout ?? '';
  } catch (err) {
    if (!ignoreError) {
      throw err;
    }
    return '';
  }
}

/**
 * Resolve the actual executable name for a given command on the current platform.
 *
 * Why this exists:
 *
 * - Many Node-based CLIs (npm, npx, pnpm, yarn, vite, eslint, anything in node_modules/.bin) do NOT
 *   ship as real executables on Windows.
 * - Instead, they install *.cmd and *.ps1 “shim” files.
 * - When using execa/child_process with `shell: false` (our default), Node WILL NOT resolve these
 *   shims. -> calling execa("npx") throws ENOENT on Windows.
 *
 * This helper normalizes command names so they can be spawned cross-platform without using `shell:
 * true`.
 *
 * Rules:
 *
 * - If on Windows:
 *
 *   - For known shim-based commands, append `.cmd` (e.g., "npx" → "npx.cmd").
 *   - For everything else, return the name unchanged.
 * - On non-Windows, return command unchanged.
 *
 * Open for extension:
 *
 * - Add new commands to `WINDOWS_SHIM_COMMANDS` as needed.
 * - If Storybook adds new internal commands later, extend the list.
 *
 * @param {string} command - The executable name passed into executeCommand.
 * @returns {string} - The normalized executable name safe for passing to execa.
 */
function resolveCommand(command: string): string {
  // Commands known to require .cmd on Windows (node-based & shim-installed)
  const WINDOWS_SHIM_COMMANDS = new Set([
    'npm',
    'npx',
    'pnpm',
    'yarn',
    // Anything installed via node_modules/.bin (vite, eslint, prettier, etc)
    // can be added here as needed. Do NOT list native executables.
  ]);

  // If not Windows → return as-is

  // If not Windows → return as-is
  if (process.platform !== 'win32') {
    return command;
  }

  // If the command is in our shim list → append .cmd

  // If the command is in our shim list → append .cmd
  if (WINDOWS_SHIM_COMMANDS.has(command)) {
    return `${command}.cmd`;
  }

  // Default: return as-is (covers git, node, bun, bunx, etc)
  return command;
}
