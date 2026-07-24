import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { cache } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import { telemetry } from 'storybook/internal/telemetry';

import { resolveProjectInfo } from './project-info.ts';
import { getAiSetupMarkdownOutput } from './setup-prompts/index.ts';
import type { AiSetupOptions } from './types.ts';

export async function aiSetup(options: AiSetupOptions): Promise<void> {
  const { configDir, packageManager, output } = options;

  const projectInfo = await resolveProjectInfo({
    configDir,
    packageManager,
    needsUserOnboarding: () => cache.get<boolean>('onboarding-pending', false),
  });

  if (!projectInfo) {
    return;
  }

  const result = await getAiSetupMarkdownOutput(projectInfo);
  const markdownOutput = result.markdown;

  // Persist the fact that `storybook ai setup` ran in this project, scoped to
  // the resolved configDir. The dev server reads this together with the story
  // index to decide whether the agent actually produced work — never to
  // unconditionally hide the copy-prompt button. This is a tiny local file
  // with no PII, so it is written even when telemetry is disabled.
  await cache
    .set('ai-setup-ran', {
      timestamp: Date.now(),
      runId: options.runId,
      configDir: resolve(projectInfo.configDir),
    })
    .catch(() => {});

  await telemetry('ai-setup', {
    cliOptions: {
      output: output ? 'file' : undefined,
      configDir: projectInfo.configDir,
      packageManager: projectInfo.packageManager.type,
      prompt: result.prompt,
    },
    project: {
      framework: projectInfo.framework,
      renderer: projectInfo.rendererPackage,
      builder: projectInfo.builderPackage,
      language: projectInfo.language,
    },
    runId: options.runId,
  });

  if (output) {
    const outputPath = resolve(output);
    await writeFile(outputPath, markdownOutput, 'utf-8');
    logger.log(`Prompt written to ${outputPath}`);
  } else {
    process.stdout.write(`${markdownOutput}\n`);
  }
}
