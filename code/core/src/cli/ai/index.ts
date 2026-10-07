import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { PackageManagerName } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import { telemetry } from 'storybook/internal/telemetry';

import { writeProjectScopedFlag } from '../../shared/utils/ai-checklist-flags.ts';
import { getSetupMarkdownOutput } from '../skills/content/setup-prompts/index.ts';
import { getProjectInfo } from '../skills/project-info.ts';
import { getSetupSupportError } from '../skills/setup-support.ts';
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
  const supportError = getSetupSupportError(projectInfo);
  if (supportError) {
    logger.error(supportError);
    return;
  }

  const { markdown: markdownOutput, prompt } = await getSetupMarkdownOutput(projectInfo);

  await writeProjectScopedFlag('ai-setup-ran', projectInfo.configDir, {
    runId: options.runId,
  }).catch(() => {});

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
