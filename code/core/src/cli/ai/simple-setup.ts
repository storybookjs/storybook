import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { logger } from 'storybook/internal/node-logger';

import { resolveProjectInfo } from './project-info.ts';
import { getAiSimpleSetupMarkdownOutput } from './setup-prompts/simple-setup.ts';

interface AiSimpleSetupOptions {
  /** Location of the Storybook configuration directory. */
  configDir?: string;
  /** Package manager to use (npm, yarn1, yarn2, pnpm, bun). */
  packageManager?: string;
  /** If provided, the generated instructions will be written to this file instead of the console. */
  output?: string;
}

/**
 * Experimental sibling of `aiSetup` for the agent plugins/skills: prints instructions to write a
 * first story for one simple component. Unlike `aiSetup` it sends no telemetry and writes no
 * `ai-setup-ran` cache entry — it is not part of the in-app onboarding funnel.
 */
export async function aiSimpleSetup(options: AiSimpleSetupOptions): Promise<void> {
  const { configDir, packageManager, output } = options;

  const projectInfo = await resolveProjectInfo({ configDir, packageManager });

  if (!projectInfo) {
    return;
  }

  const markdownOutput = getAiSimpleSetupMarkdownOutput(projectInfo);

  if (output) {
    const outputPath = resolve(output);
    await writeFile(outputPath, markdownOutput, 'utf-8');
    logger.log(`Prompt written to ${outputPath}`);
  } else {
    process.stdout.write(`${markdownOutput}\n`);
  }
}
