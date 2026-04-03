import { detectPnp } from 'storybook/internal/cli';
import {
  type JsPackageManager,
  JsPackageManagerFactory,
  MIN_SUPPORTED_NODE_DESCRIPTION,
  MIN_SUPPORTED_NODE_VERSIONS,
  PackageManagerName,
  detectDeclaredNodeVersions,
  formatMinVersion,
  invalidateProjectRootCache,
  isNodeVersionSupported,
  parseNodeVersionString,
  updateEnginesNode,
  updateNvmrc,
} from 'storybook/internal/common';
import { CLI_COLORS, deprecate, logger, prompt } from 'storybook/internal/node-logger';

import { minVersion } from 'semver';
import { dedent } from 'ts-dedent';

import type { CommandOptions } from '../generators/types.ts';
import { currentDirectoryIsEmpty, scaffoldNewProject } from '../scaffold-new-project.ts';
import { VersionService } from '../services/index.ts';

export interface PreflightCheckResult {
  packageManager: JsPackageManager;
  isEmptyProject: boolean;
}

/**
 * Command for running preflight checks before Storybook initialization
 *
 * Responsibilities:
 *
 * - Handle empty directory detection and scaffolding
 * - Initialize package manager
 * - Install base dependencies if needed
 * - Check declared Node.js version and offer to bump if below minimum
 */
export class PreflightCheckCommand {
  /** Execute preflight checks */
  constructor(private readonly versionService = new VersionService()) {}
  async execute(options: CommandOptions): Promise<PreflightCheckResult> {
    const isEmptyDirProject = options.force !== true && currentDirectoryIsEmpty();
    let packageManagerType = JsPackageManagerFactory.getPackageManagerType();

    // Check if the current directory is empty
    if (isEmptyDirProject) {
      // Initializing Storybook in an empty directory with yarn1
      // will very likely fail due to different kinds of hoisting issues
      // which doesn't get fixed anymore in yarn1.
      // We will fallback to npm in this case.
      if (
        options.packageManager
          ? options.packageManager === PackageManagerName.YARN1
          : packageManagerType === PackageManagerName.YARN1
      ) {
        logger.warn('Empty directory with yarn1 is unsupported. Falling back to npm.');
        packageManagerType = PackageManagerName.NPM;
        options.packageManager = packageManagerType;
      }

      // Prompt the user to create a new project from our list
      logger.intro(CLI_COLORS.info(`Initializing a new project`));
      await scaffoldNewProject(packageManagerType, options);
      logger.outro(CLI_COLORS.info(`Project created successfully`));
      invalidateProjectRootCache();
    }

    logger.intro(CLI_COLORS.info(`Initializing Storybook`));

    const packageManager = JsPackageManagerFactory.getPackageManager({
      force: options.packageManager,
    });

    // Install base project dependencies if we scaffolded a new project
    if (isEmptyDirProject && !options.skipInstall) {
      await packageManager.installDependencies();
    }

    const pnp = await detectPnp();
    if (pnp) {
      deprecate(dedent`
        As of Storybook 10.0, PnP is deprecated. 
        If you are using PnP, you can continue to use Storybook 10.0, but we recommend migrating to a different package manager or linker-mode. In future versions, PnP compatibility will be removed.
    `);
    }

    this.checkPackageNameConflict(packageManager);

    await this.displayVersionInfo(packageManager);

    await this.checkDeclaredNodeVersion();

    return { packageManager, isEmptyProject: isEmptyDirProject };
  }

  /**
   * Warn when the project's package.json "name" is "storybook", which shadows
   * the real storybook package in workspaces.
   *
   * See: https://github.com/storybookjs/storybook/issues/28725
   */
  private checkPackageNameConflict(packageManager: JsPackageManager): void {
    const packageName = packageManager.primaryPackageJson.packageJson.name;

    if (packageName === 'storybook') {
      logger.warn(dedent`
        Your package.json "name" field is set to "storybook".

        In npm, pnpm, or yarn workspaces this creates a symlink at
        node_modules/storybook that shadows the real Storybook package,
        causing "Cannot find module storybook/internal/..." errors.

        Please rename the "name" field in your package.json to something
        other than "storybook" (e.g. "my-storybook", "docs", "@myorg/storybook").
      `);
    }
  }

  /** Display version information and warnings */
  private async displayVersionInfo(packageManager: JsPackageManager): Promise<void> {
    const { currentVersion, latestVersion, isPrerelease, isOutdated } =
      await this.versionService.getVersionInfo(packageManager);

    if (isOutdated && !isPrerelease) {
      logger.warn(dedent`
          This version is behind the latest release, which is: ${latestVersion}!
          You likely ran the init command through npx, which can use a locally cached version.
          
          To get the latest, please run: ${CLI_COLORS.cta('npx storybook@latest init')}
          You may want to ${CLI_COLORS.cta('CTRL+C')} to stop, and run with the latest version instead.
        `);
    } else if (isPrerelease) {
      logger.warn(`This is a pre-release version: ${currentVersion}`);
    } else {
      logger.info(`Adding Storybook version ${currentVersion} to your project`);
    }
  }

  /** Check declared Node.js versions (.nvmrc, engines.node) and offer to bump if below minimum */
  private async checkDeclaredNodeVersion(): Promise<void> {
    const declared = detectDeclaredNodeVersions();

    // Check .nvmrc
    if (declared.nvmrcPath && declared.nvmrcVersion) {
      const parsed = parseNodeVersionString(declared.nvmrcVersion);
      if (parsed && !isNodeVersionSupported(parsed.major, parsed.minor, parsed.patch)) {
        await this.promptVersionBump('nvmrc', declared.nvmrcPath, declared.nvmrcVersion);
      }
    }

    // Check engines.node
    if (declared.enginesNode && declared.packageJsonPath) {
      const min = minVersion(declared.enginesNode);
      if (min && !isNodeVersionSupported(min.major, min.minor, min.patch)) {
        await this.promptVersionBump('engines', declared.packageJsonPath, declared.enginesNode);
      }
    }
  }

  private async promptVersionBump(
    type: 'nvmrc' | 'engines',
    filePath: string,
    currentValue: string
  ): Promise<void> {
    const [runtimeMajor, runtimeMinor, runtimePatch] = process.versions.node.split('.').map(Number);
    const runtimeVersion = `${runtimeMajor}.${runtimeMinor}.${runtimePatch}`;

    if (type === 'nvmrc') {
      logger.warn(dedent`
        Your .nvmrc specifies Node.js ${currentValue}, which is below Storybook's
        minimum supported version (${MIN_SUPPORTED_NODE_DESCRIPTION}).
      `);
    } else {
      const min = minVersion(currentValue);
      logger.warn(dedent`
        Your package.json engines.node ("${currentValue}") resolves to a minimum of
        Node.js ${min?.version ?? currentValue}, which is below Storybook's minimum supported version
        (${MIN_SUPPORTED_NODE_DESCRIPTION}).
      `);
    }

    // Skip the interactive prompt in non-interactive/CI environments
    const isInteractive =
      process.stdout.isTTY && process.stdin.isTTY && !process.env.CI && !process.env.STORYBOOK_CI;
    if (!isInteractive) {
      return;
    }

    const options: Array<{ value: string; label: string }> = MIN_SUPPORTED_NODE_VERSIONS.map(
      (v) => ({
        value: type === 'nvmrc' ? `${v.major}.${v.minor}.${v.patch}` : `>=${v.major}.${v.minor}`,
        label: formatMinVersion(v).replace('+', ''),
      })
    );

    if (isNodeVersionSupported(runtimeMajor, runtimeMinor, runtimePatch)) {
      options.push({
        value: type === 'nvmrc' ? runtimeVersion : `>=${runtimeMajor}.${runtimeMinor}`,
        label: `${runtimeVersion}  (your current runtime)`,
      });
    }

    options.push({ value: 'skip', label: "Don't change" });

    const message =
      type === 'nvmrc'
        ? 'Update your .nvmrc to a supported version?'
        : 'Update your package.json engines.node to a supported version?';

    const selected = await prompt.select<string>({ message, options });

    if (selected !== 'skip') {
      try {
        if (type === 'nvmrc') {
          updateNvmrc(filePath, selected);
        } else {
          updateEnginesNode(filePath, selected);
        }
      } catch (error) {
        logger.warn(
          dedent`
            Could not update ${type === 'nvmrc' ? '.nvmrc' : 'package.json engines.node'} at ${filePath}.
            Storybook initialization will continue without applying the Node.js version bump.
            ${error instanceof Error ? error.message : String(error)}
          `
        );
      }
    }
  }
}

export const executePreflightCheck = async (
  options: CommandOptions
): Promise<PreflightCheckResult> => {
  const command = new PreflightCheckCommand();
  return command.execute(options);
};
