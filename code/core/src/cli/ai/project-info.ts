import type { PackageManagerName } from 'storybook/internal/common';
import { getPrettyPackageManagerName } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import { SupportedLanguage } from 'storybook/internal/types';

import { detectLanguage } from '../detectLanguage.ts';
import { getStorybookData } from '../getStorybookData.ts';
import type { ProjectInfo } from './types.ts';

interface ResolveProjectInfoOptions {
  /** Location of the Storybook configuration directory. */
  configDir?: string;
  /** Package manager to use (npm, yarn1, yarn2, pnpm, bun). */
  packageManager?: string;
  /**
   * Resolves whether the user has requested to be onboarded into Storybook. Called while the
   * project is being inspected so that failures are reported like any other configuration error.
   * Defaults to `false` when omitted.
   */
  needsUserOnboarding?: () => Promise<boolean>;
}

/**
 * Inspects the user's project and assembles the {@link ProjectInfo} shared by the `storybook ai`
 * prompt commands. Logs the failure reason and returns `undefined` when the project cannot be
 * inspected or is not supported (currently React + Vite only).
 */
export async function resolveProjectInfo(
  options: ResolveProjectInfoOptions
): Promise<ProjectInfo | undefined> {
  let projectInfo: ProjectInfo;

  try {
    const data = await getStorybookData({
      configDir: options.configDir,
      packageManagerName: options.packageManager as PackageManagerName | undefined,
    });

    if (!data.frameworkPackage || !data.rendererPackage || !data.builderPackage) {
      logger.error(
        'Could not detect framework, renderer, or builder from your Storybook config. Make sure you are running this command from your project root, or specify --config-dir.'
      );
      return undefined;
    }

    const majorVersion = data.versionInstalled
      ? parseMajorVersion(data.versionInstalled)
      : undefined;

    const detectedLanguage = await detectLanguage(data.packageManager, data.workingDir);
    const language = detectedLanguage === SupportedLanguage.TYPESCRIPT ? 'ts' : 'js';

    const needsUserOnboarding = (await options.needsUserOnboarding?.()) ?? false;

    projectInfo = {
      storybookVersion: data.versionInstalled,
      majorVersion,
      framework: data.frameworkPackage,
      rendererPackage: data.rendererPackage,
      renderer: data.renderer,
      builderPackage: data.builderPackage,
      addons: data.addons ?? [],
      configDir: data.configDir,
      storiesPaths: data.storiesPaths,
      packageManager: data.packageManager,
      packageManagerName: getPrettyPackageManagerName(data.packageManager.type),
      language,
      hasCsfFactoryPreview: data.hasCsfFactoryPreview,
      needsUserOnboarding,
    };
  } catch (err) {
    logger.error(
      `Failed to read Storybook configuration: ${err instanceof Error ? err.message : String(err)}`
    );
    logger.log(
      'Make sure you are running this command from your project root, or specify --config-dir.'
    );
    return undefined;
  }

  if (
    projectInfo.rendererPackage !== '@storybook/react' ||
    projectInfo.builderPackage !== '@storybook/builder-vite'
  ) {
    logger.log(
      'AI-assisted setup is currently only available for projects using the React renderer with Vite builder. Detected renderer: ' +
        projectInfo.rendererPackage +
        ', builder: ' +
        projectInfo.builderPackage
    );
    return undefined;
  }

  return projectInfo;
}

function parseMajorVersion(version: string): number | undefined {
  const match = version.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : undefined;
}
