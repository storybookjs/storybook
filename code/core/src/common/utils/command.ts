import { logger, prompt } from 'storybook/internal/node-logger';

// eslint-disable-next-line depend/ban-dependencies
import {
  type Options,
  type ResultPromise,
  type SyncOptions,
  execa,
  execaCommandSync,
  execaNode,
} from 'execa';

const COMMON_ENV_VARS = {
  COREPACK_ENABLE_STRICT: '0',
  COREPACK_ENABLE_AUTO_PIN: '0',
  NO_UPDATE_NOTIFIER: 'true',
};

export type ExecuteCommandOptions = Omit<Options, 'cancelSignal'> & {
  command: string;
  args?: string[];
  cwd?: string;
  ignoreError?: boolean;
  env?: Record<string, string>;
  signal?: AbortSignal; // Alias for cancelSignal (execa v9 uses cancelSignal)
};

function getExecaOptions({
  stdio,
  cwd,
  env,
  signal,
  ...execaOptions
}: ExecuteCommandOptions): Options {
  return {
    cwd,
    stdio: stdio ?? prompt.getPreferredStdio(),
    encoding: 'utf8' as const,
    cleanup: true,
    env: {
      ...COMMON_ENV_VARS,
      ...env,
    },
    ...(signal && { cancelSignal: signal }), // Map signal to cancelSignal for execa v9
    ...execaOptions,
  };
}

export function executeCommand(options: ExecuteCommandOptions): ResultPromise {
  const { command, args = [], ignoreError = false } = options;
  logger.debug(`Executing command: ${command} ${args.join(' ')}`);

  const commandVariations = resolveCommand(command);
  const execaProcess = tryCommandVariations(commandVariations, args, getExecaOptions(options));

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
    const commandVariations = resolveCommand(command);
    return tryCommandVariationsSync(
      commandVariations,
      args,
      getExecaOptions(options) as SyncOptions
    );
  } catch (err) {
    if (!ignoreError) {
      throw err;
    }
    return '';
  }
}

export function executeNodeCommand({
  scriptPath,
  args,
  options,
}: {
  scriptPath: string;
  args?: string[];
  options?: Options;
}): ResultPromise {
  return execaNode(scriptPath, args, {
    ...options,
  });
}

/**
 * Check if an error is a "command not found" error on Windows. This happens when trying to execute
 * a command that doesn't exist.
 *
 * @param error - The error to check
 * @returns True if the error is a "command not found" error
 */
function isCommandNotFoundError(error: any): boolean {
  if (!error) {
    return false;
  }

  // Check for Windows-specific "command not recognized" error
  const stderr = error.stderr || '';
  const message = error.message || '';

  return (
    stderr.includes('is not recognized as an internal or external command') ||
    message.includes('is not recognized as an internal or external command')
  );
}

/**
 * Try executing a command with multiple variations until one succeeds. This is needed on Windows
 * where package managers can be installed in different ways.
 *
 * @param commandVariations - Array of command variations to try
 * @param args - Command arguments
 * @param options - Execa options
 * @returns Promise from execa
 */
function tryCommandVariations(
  commandVariations: string[],
  args: string[],
  options: Options
): ResultPromise {
  let lastError: any;

  const tryNext = async (index: number): Promise<any> => {
    if (index >= commandVariations.length) {
      throw lastError;
    }

    const cmd = commandVariations[index];
    try {
      return await execa(cmd, args, options);
    } catch (error: any) {
      lastError = error;

      // If this is not a "command not found" error, or we're on the last variation, re-throw
      if (!isCommandNotFoundError(error) || index === commandVariations.length - 1) {
        throw error;
      }

      // Otherwise, try the next variation
      logger.debug(`Command "${cmd}" not found, trying next variation...`);
      return tryNext(index + 1);
    }
  };

  return tryNext(0) as ResultPromise;
}

/**
 * Synchronously try executing a command with multiple variations until one succeeds.
 *
 * @param commandVariations - Array of command variations to try
 * @param args - Command arguments
 * @param options - Execa sync options
 * @returns Stdout from the successful command
 */
function tryCommandVariationsSync(
  commandVariations: string[],
  args: string[],
  options: SyncOptions
): string {
  let lastError: any;

  for (let i = 0; i < commandVariations.length; i++) {
    const cmd = commandVariations[i];
    try {
      const commandResult = execaCommandSync([cmd, ...args].join(' '), options);
      return typeof commandResult.stdout === 'string' ? commandResult.stdout : '';
    } catch (error: any) {
      lastError = error;

      // If this is not a "command not found" error, or we're on the last variation, re-throw
      if (!isCommandNotFoundError(error) || i === commandVariations.length - 1) {
        throw error;
      }

      // Otherwise, try the next variation
      logger.debug(`Command "${cmd}" not found, trying next variation...`);
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError;
}

/**
 * Resolve the actual executable name for a given command on the current platform.
 *
 * Why this exists:
 *
 * - Many Node-based CLIs (npm, npx, pnpm, yarn, vite, eslint, anything in node_modules/.bin) do NOT
 *   ship as real executables on Windows.
 * - Instead, they install *.cmd and *.ps1 "shim" files.
 * - When using execa/child_process with `shell: false` (our default), Node WILL NOT resolve these
 *   shims. -> calling execa("npx") throws ENOENT on Windows.
 * - HOWEVER, package managers like pnpm can be installed via system tools (Mise, Scoop) as native
 *   executables (.exe), not as Node packages. In these cases, the .cmd shim doesn't exist.
 *
 * This helper normalizes command names so they can be spawned cross-platform without using `shell:
 * true`.
 *
 * Rules:
 *
 * - If on Windows:
 *
 *   - For known shim-based commands, return an array of variations to try in order: [command.exe,
 *       command.cmd, command.ps1, command]
 *   - For everything else, return the name unchanged.
 * - On non-Windows, return command unchanged.
 *
 * Open for extension:
 *
 * - Add new commands to `WINDOWS_SHIM_COMMANDS` as needed.
 * - If Storybook adds new internal commands later, extend the list.
 *
 * @param {string} command - The executable name passed into executeCommand.
 * @returns {string[]} - Array of command variations to try (most specific first).
 */
function resolveCommand(command: string): string[] {
  // Commands known to require .cmd on Windows (node-based & shim-installed)
  const WINDOWS_SHIM_COMMANDS = new Set([
    'npm',
    'npx',
    'pnpm',
    'yarn',
    'ng',
    // Anything installed via node_modules/.bin (vite, eslint, prettier, etc)
    // can be added here as needed. Do NOT list native executables.
  ]);

  if (process.platform !== 'win32') {
    return [command];
  }

  if (WINDOWS_SHIM_COMMANDS.has(command)) {
    // On Windows, try multiple variations in order of likelihood:
    // 1. .exe - native executable (e.g., pnpm installed via Scoop/Mise)
    // 2. .cmd - CMD shim (most common for npm-installed packages)
    // 3. .ps1 - PowerShell shim (less common but possible)
    // 4. bare command - fallback
    return [`${command}.exe`, `${command}.cmd`, `${command}.ps1`, command];
  }

  return [command];
}
