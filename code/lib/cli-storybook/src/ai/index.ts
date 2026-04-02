import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { PackageManagerName } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import { SupportedLanguage } from 'storybook/internal/types';

import { ProjectTypeService } from '../../../create-storybook/src/services/ProjectTypeService.ts';

import { getStorybookData } from '../automigrate/helpers/mainConfigFile.ts';
import { generateMarkdownOutput } from './prompt.ts';
import type { ProjectInfo, AiPrepareOptions } from './types.ts';

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

    const projectTypeService = new ProjectTypeService(data.packageManager);
    const detectedLanguage = await projectTypeService.detectLanguage();
    const language = detectedLanguage === SupportedLanguage.TYPESCRIPT ? 'ts' : 'js';

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
      hasCsfFactoryPreview: data.hasCsfFactoryPreview,
      language,
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
    projectInfo.rendererPackage !== '@storybook/react' &&
    projectInfo.builderPackage !== '@storybook/builder-vite'
  ) {
    logger.log(
      'AI-assisted setup is currently only available for projects using the React renderer with Vite builder. Detected renderer: ' +
        projectInfo.rendererPackage +
        ', builder: ' +
        projectInfo.builderPackage
    );
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
