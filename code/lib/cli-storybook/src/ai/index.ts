import type { PackageManagerName } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';

import { getStorybookData } from '../automigrate/helpers/mainConfigFile';
import { generateJsonOutput, generateMarkdownOutput } from './prompt';
import type { ProjectInfo, AiInitOptions } from './types';

export async function aiInit(options: AiInitOptions): Promise<void> {
  const {
    configDir: userConfigDir,
    packageManager: packageManagerName,
    format = 'markdown',
  } = options;

  let projectInfo: ProjectInfo;

  try {
    const data = await getStorybookData({
      configDir: userConfigDir,
      packageManagerName: packageManagerName as PackageManagerName | undefined,
    });
    const majorVersion = data.versionInstalled
      ? parseMajorVersion(data.versionInstalled)
      : undefined;

    projectInfo = {
      storybookVersion: data.versionInstalled,
      majorVersion,
      framework: data.frameworkPackage ?? 'unknown',
      renderer: data.rendererPackage ?? 'unknown',
      builder: data.builderPackage ?? 'unknown',
      addons: data.addons ?? [],
      configDir: data.configDir,
      storiesPaths: data.storiesPaths,
      hasCsfFactoryPreview: data.hasCsfFactoryPreview,
    };
  } catch (err: unknown) {
    logger.error(
      `Failed to read Storybook configuration: ${err instanceof Error ? err.message : String(err)}`
    );
    logger.log(
      'Make sure you are running this command from your project root, or specify --config-dir.'
    );
    process.exit(1);
  }

  if (projectInfo.framework !== '@storybook/react-vite') {
    return;
  }

  if (format === 'json') {
    // JSON output goes directly to stdout for machine consumption
    console.log(JSON.stringify(generateJsonOutput(projectInfo), null, 2));
  } else {
    console.log(generateMarkdownOutput(projectInfo));
  }
}

function parseMajorVersion(version: string): number | undefined {
  const match = version.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : undefined;
}
