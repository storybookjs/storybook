import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { PackageManagerName } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';

import { getStorybookData } from '../automigrate/helpers/mainConfigFile';
import { generateMarkdownOutput } from './prompt';
import type { ProjectInfo, AiPrepareOptions } from './types';

export async function aiPrepare(options: AiPrepareOptions): Promise<void> {
  const { configDir: userConfigDir, packageManager: packageManagerName, output } = options;

  let projectInfo: ProjectInfo;

  try {
    const data = await getStorybookData({
      configDir: userConfigDir,
      packageManagerName: packageManagerName as PackageManagerName | undefined,
    });
    const majorVersion = data.versionInstalled
      ? parseMajorVersion(data.versionInstalled)
      : undefined;

    if (!data.frameworkPackage || !data.rendererPackage || !data.builderPackage) {
      logger.error(
        'Could not detect framework, renderer, or builder from your Storybook config. Make sure you are running this command from your project root, or specify --config-dir.'
      );
      return;
    }

    projectInfo = {
      storybookVersion: data.versionInstalled,
      majorVersion,
      framework: data.frameworkPackage,
      renderer: data.rendererPackage,
      builder: data.builderPackage,
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
    return;
  }

  if (
    projectInfo.renderer !== '@storybook/react' &&
    projectInfo.builder !== '@storybook/builder-vite'
  ) {
    return;
  }

  const markdownOutput = generateMarkdownOutput(projectInfo);

  if (output) {
    const outputPath = resolve(output);
    await writeFile(outputPath, markdownOutput, 'utf-8');
    logger.log(`Prompt written to ${outputPath}`);
  } else {
    logger.log(markdownOutput);
  }
}

function parseMajorVersion(version: string): number | undefined {
  const match = version.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : undefined;
}
