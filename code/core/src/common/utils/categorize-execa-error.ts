import { StorybookError } from '../../storybook-error.ts';
import {
  AutomigrateAddonA11yTestError,
  ExecaCommandFailedError,
  NuxtModuleAddFailedError,
  PackageInstallDependencyConflictError,
  PackageInstallFailedError,
  PackageInstallMissingManifestError,
  PackageManagerBinaryNotFoundError,
  PlaywrightInstallFailedError,
  PnpmIgnoredBuildsError,
  PnpmNoTtyModulesDirError,
  type ExecaCommandErrorData,
} from '../../server-errors.ts';
import { getErrorLogs } from '../js-package-manager/util.ts';

export type ExecaErrorContext = {
  command: string;
  args?: string[];
};

type ExecaErrorLike = {
  exitCode?: number;
  code?: number | string;
  signal?: string;
  shortMessage?: string;
  command?: string;
};

const PACKAGE_MANAGER_COMMANDS = new Set(['npm', 'pnpm', 'yarn', 'bun']);
const PACKAGE_INSTALL_ARGS = new Set(['install', 'add', 'ci', 'i']);

export function extractExecaCommandErrorData(
  error: unknown,
  context: ExecaErrorContext
): ExecaCommandErrorData {
  const structured = error as ExecaErrorLike;
  const args = context.args ?? [];
  let logs = getErrorLogs(error);

  if (logs === '[object Object]') {
    logs = '';
  }

  return {
    command: context.command,
    args,
    exitCode: structured.exitCode ?? structured.code,
    signal: structured.signal,
    logs,
    packageManagerErrorCode: extractPackageManagerErrorCode(logs),
  };
}

export function extractPackageManagerErrorCode(logs: string): string | undefined {
  const npmMatch = logs.match(/npm\s+(?:ERR!|error)\s+code\s+([A-Z0-9_]+)/i);
  if (npmMatch) {
    return npmMatch[1];
  }

  const pnpmMatch = logs.match(/(ERR_PNPM_[A-Z0-9_]+)/);
  if (pnpmMatch) {
    return pnpmMatch[1];
  }

  return undefined;
}

function isAutomigrateAddonA11yTest(args: string[]) {
  const joined = args.join(' ');
  return joined.includes('automigrate') && joined.includes('addon-a11y-addon-test');
}

function isNuxtModuleAdd(args: string[]) {
  const joined = args.join(' ');
  return joined.includes('nuxi') && joined.includes('module add') && joined.includes('storybook');
}

function isPlaywrightInstall(args: string[]) {
  const joined = args.join(' ');
  return joined.includes('playwright') && joined.includes('install');
}

function isPackageManagerCommand(command: string) {
  const normalizedCommand = command.replace(/\.(cmd|exe|ps1)$/i, '');

  return PACKAGE_MANAGER_COMMANDS.has(normalizedCommand);
}

function isPackageInstall(command: string, args: string[]) {
  if (!isPackageManagerCommand(command)) {
    return false;
  }

  return args.some((arg) => PACKAGE_INSTALL_ARGS.has(arg));
}

function isBinaryNotFound(data: ExecaCommandErrorData) {
  const logs = data.logs.toLowerCase();

  return (
    data.exitCode === 127 ||
    (logs.includes('enoent') && logs.includes('spawn')) ||
    logs.includes('command not found') ||
    logs.includes("couldn't find the binary") ||
    logs.includes('is not recognized as an internal or external command') ||
    logs.includes('err_pnpm_recursive_exec_first_fail')
  );
}

function isMissingPackageManifest(data: ExecaCommandErrorData) {
  const logs = data.logs;

  return (
    (data.packageManagerErrorCode === 'ENOENT' && logs.includes('package.json')) ||
    logs.includes('ERR_PNPM_NO_PKG_MANIFEST')
  );
}

function isDependencyConflict(data: ExecaCommandErrorData) {
  return data.packageManagerErrorCode === 'ERESOLVE';
}

function isPnpmIgnoredBuilds(data: ExecaCommandErrorData) {
  return (
    data.packageManagerErrorCode === 'ERR_PNPM_IGNORED_BUILDS' ||
    data.logs.includes('Ignored build scripts')
  );
}

function isPnpmNoTtyModulesDir(data: ExecaCommandErrorData) {
  return data.packageManagerErrorCode === 'ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY';
}

export function categorizeExecaError(error: unknown, context: ExecaErrorContext): StorybookError {
  if (error instanceof StorybookError) {
    return error;
  }

  const data = extractExecaCommandErrorData(error, context);
  const { command, args } = data;

  if (isAutomigrateAddonA11yTest(args)) {
    return new AutomigrateAddonA11yTestError({ ...data, cause: error });
  }

  if (isNuxtModuleAdd(args)) {
    return new NuxtModuleAddFailedError({ ...data, cause: error });
  }

  if (isPlaywrightInstall(args)) {
    return new PlaywrightInstallFailedError({ ...data, cause: error });
  }

  if (isBinaryNotFound(data) && isPackageManagerCommand(command)) {
    return new PackageManagerBinaryNotFoundError({ ...data, cause: error });
  }

  if (isPackageInstall(command, args)) {
    if (isDependencyConflict(data)) {
      return new PackageInstallDependencyConflictError({ ...data, cause: error });
    }

    if (isMissingPackageManifest(data)) {
      return new PackageInstallMissingManifestError({ ...data, cause: error });
    }

    if (isPnpmIgnoredBuilds(data)) {
      return new PnpmIgnoredBuildsError({ ...data, cause: error });
    }

    if (isPnpmNoTtyModulesDir(data)) {
      return new PnpmNoTtyModulesDirError({ ...data, cause: error });
    }

    return new PackageInstallFailedError({ ...data, cause: error });
  }

  return new ExecaCommandFailedError({ ...data, cause: error });
}
