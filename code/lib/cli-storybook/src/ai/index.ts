import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { PackageManagerName } from 'storybook/internal/common';
import { getPrettyPackageManagerName } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import { telemetry } from 'storybook/internal/telemetry';
import { SupportedLanguage } from 'storybook/internal/types';

import { ProjectTypeService } from '../../../create-storybook/src/services/ProjectTypeService.ts';

import { getStorybookData } from '../automigrate/helpers/mainConfigFile.ts';
import { getAiSetupMarkdownOutput } from './setup-prompts/index.ts';
import type { ProjectInfo, AiSetupOptions } from './types.ts';

export async function aiSetup(options: AiSetupOptions): Promise<void> {
  const { configDir: userConfigDir, packageManager, output } = options;

  let projectInfo: ProjectInfo;

  try {
    const data = await getStorybookData({
      configDir: userConfigDir,
      packageManagerName: packageManager as PackageManagerName | undefined,
    });

    if (!data.frameworkPackage || !data.rendererPackage || !data.builderPackage) {
      logger.error(
        'Could not detect framework, renderer, or builder from your Storybook config. Make sure you are running this command from your project root, or specify --config-dir.'
      );
      return;
    }

    const majorVersion = data.versionInstalled
      ? parseMajorVersion(data.versionInstalled)
      : undefined;

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
      packageManager: data.packageManager,
      packageManagerName: getPrettyPackageManagerName(data.packageManager.type),
      language,
      hasCsfFactoryPreview: data.hasCsfFactoryPreview,
    };
  } catch (err) {
    logger.error(
      `Failed to read Storybook configuration: ${err instanceof Error ? err.message : String(err)}`
    );
    logger.log(
      'Make sure you are running this command from your project root, or specify --config-dir.'
    );
    return;
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
    return;
  }

  const result = await getAiSetupMarkdownOutput(projectInfo);
  const markdownOutput = result.markdown;

  await telemetry('ai-setup', {
    cliOptions: {
      output: output ? 'file' : undefined,
      configDir: projectInfo.configDir,
      packageManager: projectInfo.packageManager.type,
    },
    project: {
      framework: projectInfo.framework,
      renderer: projectInfo.rendererPackage,
      builder: projectInfo.builderPackage,
      language: projectInfo.language,
    },
  });

  if (output) {
    const outputPath = resolve(output);
    await writeFile(outputPath, markdownOutput, 'utf-8');
    logger.log(`Prompt written to ${outputPath}`);
  } else {
    process.stdout.write(`${markdownOutput}\n`);
  }
}

function parseMajorVersion(version: string): number | undefined {
  const match = version.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : undefined;
}
