import { dedent } from 'ts-dedent';
import type { ProjectInfo } from '../types.ts';

import { getProjectOverview } from '../utils/project-overview.ts';

/**
 * The single prompt variant that ships to real users. Running
 * `npx storybook ai setup` without any overrides always produces this prompt.
 */
import * as currentlyUsedPrompt from './optimized-tests.ts';
export const DEFAULT_PROMPT_NAME: PromptName = 'optimized-tests';

/**
 * Main prompt used currently in `npx storybook ai setup` command. If you promote a new prompt to be default, move this to the FORMERLY_USED_PROMPTS object below.
 */
const CURRENTLY_USED_PROMPT: Record<string, (projectInfo: ProjectInfo) => string> = {
  [DEFAULT_PROMPT_NAME]: currentlyUsedPrompt.instructions,
};

/**
 * Names of variants registered behind `EVAL_SETUP_PROMPT`. Loaded on demand
 * from sibling files so the bundler can code|-split them away from the
 * default-only path that real users hit.
 */
const FORMERLY_USED_PROMPTS: Record<string, () => Promise<(projectInfo: ProjectInfo) => string>> = {
  monorepo: async () => (await import('./monorepo.ts')).instructions,
  'optimized-tests': async () => (await import('./optimized-tests.ts')).instructions,
  'relaxed-limits': async () => (await import('./relaxed-limits.ts')).instructions,
  setup: async () => (await import('./setup.ts')).instructions,
  'pattern-copy-play': async () => (await import('./pattern-copy-play.ts')).instructions,
  'monorepo-optimized-tests-relaxed-limits-no-story-deletion': async () =>
    (await import('./monorepo-optimized-tests-relaxed-limits-no-story-deletion.ts')).instructions,
};

export type PromptName = string;

/** Names available to the eval harness — defaults plus experimental variants. */
export const PROMPT_NAMES: PromptName[] = [
  ...Object.keys(CURRENTLY_USED_PROMPT),
  ...Object.keys(FORMERLY_USED_PROMPTS),
];

/**
 * Internal env var read only by `getPrompts`. The eval harness sets this
 * before spawning `ai setup` to select a non-default prompt variant for A/B
 * comparison. Unknown values fall back to the default so a typo never breaks
 * the CLI for real users.
 */
const EVAL_SETUP_PROMPT_ENV = 'EVAL_SETUP_PROMPT';

function resolvePromptName(): PromptName {
  const requested = process.env[EVAL_SETUP_PROMPT_ENV]?.trim();
  if (
    requested &&
    (Object.hasOwn(CURRENTLY_USED_PROMPT, requested) ||
      Object.hasOwn(FORMERLY_USED_PROMPTS, requested))
  ) {
    return requested;
  }
  return DEFAULT_PROMPT_NAME;
}

export async function getAiSetupPrompt(
  projectInfo: ProjectInfo
): Promise<{ content: string; name: PromptName }> {
  const name = resolvePromptName();
  const builder = CURRENTLY_USED_PROMPT[name] ?? (await FORMERLY_USED_PROMPTS[name]());

  return { content: builder(projectInfo), name };
}

export async function getAiSetupMarkdownOutput(projectInfo: ProjectInfo): Promise<{
  markdown: string;
  prompt: PromptName;
}> {
  const { content, name } = await getAiSetupPrompt(projectInfo);

  return {
    markdown: dedent`
    # Storybook Setup

    ${getProjectOverview(projectInfo)}

    ${content}
  `,
    prompt: name,
  };
}
