import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { PackageManagerName } from 'storybook/internal/common';
import { cache } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import { telemetry } from 'storybook/internal/telemetry';

import { getSetupMarkdownOutput } from '../skills/content/setup-prompts/index.ts';
import { getProjectInfo } from '../skills/project-info.ts';
import type { AiSetupOptions } from './types.ts';

export async function aiSetup(options: AiSetupOptions): Promise<void> {
  const { configDir: userConfigDir, packageManager, output } = options;

  // logger.warn renders through clack by default, which writes to stdout — that would
  // contaminate the markdown output this command prints to stdout. Write directly to
  // stderr instead so piping `storybook ai setup` still yields clean markdown.
  process.stderr.write(
    '`storybook ai setup` is deprecated and will be removed in a future release. Use `npx storybook skills setup` instead.\n'
  );

  const result = await getProjectInfo({
    configDir: userConfigDir,
    packageManager: packageManager as PackageManagerName | undefined,
  });

  if (!result.ok) {
    const [firstLine, ...rest] = result.message.split('\n');
    logger.error(firstLine);
    if (rest.length > 0) {
      logger.log(rest.join('\n'));
    }
    return;
  }

  const { projectInfo } = result;

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

  const { markdown: markdownOutput, prompt } = await getSetupMarkdownOutput(projectInfo);

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
      prompt,
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
