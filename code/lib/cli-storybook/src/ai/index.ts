import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { PackageManagerName } from 'storybook/internal/common';
import { cache } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import { getSessionId, telemetry } from 'storybook/internal/telemetry';
import { SupportedLanguage } from 'storybook/internal/types';

import { ProjectTypeService } from '../../../create-storybook/src/services/ProjectTypeService.ts';

import { getStorybookData } from '../automigrate/helpers/mainConfigFile.ts';
import { generateMarkdownOutput } from './prompt.ts';
import { snapshotPreviewFile } from './setup-requirements.ts';
import type { AiSetupPendingRecord } from './setup-requirements.ts';
import type { ProjectInfo, AiPrepareOptions, AiPrepareTraits } from './types.ts';

export async function aiPrepare(options: AiPrepareOptions): Promise<void> {
  const {
    configDir: userConfigDir,
    packageManager: packageManagerName,
    output,
    frontmatter,
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

  // Fire start event with project context
  await telemetry('ai-prepare', {
    cliOptions: {
      output: output ? 'file' : undefined,
      configDir: projectInfo.configDir,
      packageManager: packageManagerName,
    },
    project: {
      framework: projectInfo.framework,
      renderer: projectInfo.rendererPackage,
      builder: projectInfo.builderPackage,
      language: projectInfo.language,
      hasCsfFactoryPreview: projectInfo.hasCsfFactoryPreview,
    },
  });

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

  const result = generateMarkdownOutput(projectInfo);
  const markdownOutput = result.markdown;
  const traits = result.traits;

  // Snapshot the preview file baseline and cache the pending setup record.
  // Subsequent CLI entry points (dev, build, doctor, etc.) read this to
  // collect evidence of what the agent accomplished.
  const resolvedConfigDir = resolve(projectInfo.configDir);
  const previewSnapshot = await snapshotPreviewFile(resolvedConfigDir);
  const sessionId = await getSessionId();
  const pendingRecord: AiSetupPendingRecord = {
    timestamp: Date.now(),
    sessionId,
    configDir: resolvedConfigDir,
    previewFile: previewSnapshot.previewFile,
    previewHash: previewSnapshot.previewHash,
    traits,
  };
  await cache.set('ai-setup-pending', pendingRecord);

  let finalOutput = markdownOutput;
  if (frontmatter && output) {
    const frontmatterBlock = buildFrontmatter(projectInfo, traits);
    finalOutput = frontmatterBlock + markdownOutput;
  }

  if (output) {
    const outputPath = resolve(output);
    await writeFile(outputPath, finalOutput, 'utf-8');
    logger.log(`Prompt written to ${outputPath}`);
  } else {
    logger.log(finalOutput);
  }
}

function buildFrontmatter(projectInfo: ProjectInfo, traits: AiPrepareTraits): string {
  const lines = [
    '---',
    `storybook: ${projectInfo.storybookVersion || 'unknown'}`,
    `framework: '${projectInfo.framework || 'unknown'}'`,
    `renderer: '${projectInfo.rendererPackage || 'unknown'}'`,
    `builder: '${projectInfo.builderPackage || 'unknown'}'`,
    `language: ${projectInfo.language}`,
    `hasCsfFactoryPreview: ${projectInfo.hasCsfFactoryPreview}`,
    'traits:',
  ];
  for (const [key, value] of Object.entries(traits)) {
    lines.push(`  ${key}: ${value}`);
  }
  lines.push('---', '');
  return lines.join('\n');
}

function parseMajorVersion(version: string): number | undefined {
  const match = version.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : undefined;
}
