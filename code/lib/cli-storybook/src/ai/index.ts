import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { PackageManagerName } from 'storybook/internal/common';
import { getPrettyPackageManagerName } from 'storybook/internal/common';
import { cache } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import {
  getSessionId,
  isTelemetryModuleEnabled,
  snapshotPreviewFile,
  telemetry,
  type AiSetupPendingRecord,
} from 'storybook/internal/telemetry';
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

    const needsUserOnboarding = await cache.get('onboarding-pending');

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

  // Snapshot the preview file baseline and cache the pending setup record.
  // Subsequent CLI entry points (dev, build, doctor, etc.) read this to
  // collect evidence of what the agent accomplished — but only via telemetry
  // (the `ai-setup-evidence` event). Skip the snapshot + cache write when
  // telemetry is disabled so there's nobody to read it.
  if (isTelemetryModuleEnabled()) {
    const resolvedConfigDir = resolve(projectInfo.configDir);
    const previewSnapshot = await snapshotPreviewFile(resolvedConfigDir);
    const sessionId = await getSessionId();
    const pendingRecord: AiSetupPendingRecord = {
      timestamp: Date.now(),
      sessionId,
      configDir: resolvedConfigDir,
      ...previewSnapshot,
    };
    await cache.set('ai-setup-pending', pendingRecord);
  }

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
