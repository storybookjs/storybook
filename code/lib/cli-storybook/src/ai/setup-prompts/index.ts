import { dedent } from 'ts-dedent';
import type { ProjectInfo } from '../types.ts';

import { getProjectOverview } from '../utils/project-overview.ts';

/**
 * The prompt variants that ship to real users. Running `npx storybook ai setup`
 * without environment variable overrides uses either of these prompts.
 */
import * as currentlyUsedPrompt from './optimized-tests.ts';
export const DEFAULT_PROMPT_NAME: PromptName = 'optimized-tests';

import * as extensivePrompt from './pattern-copy-play.ts';
export const EXTENSIVE_PROMPT_NAME: PromptName = 'pattern-copy-play';

/**
 * Main prompt used currently in `npx storybook ai setup` command. If you promote a new prompt to be default, move this to the FORMERLY_USED_PROMPTS object below.
 */
const BUNDLED_PROMPTS: Record<string, (projectInfo: ProjectInfo) => string> = {
  [DEFAULT_PROMPT_NAME]: currentlyUsedPrompt.instructions,
  [EXTENSIVE_PROMPT_NAME]: extensivePrompt.instructions,
};

/**
 * Names of variants registered behind `EVAL_SETUP_PROMPT`. Loaded on demand
 * from sibling files so the bundler can code|-split them away from the
 * default-only path that real users hit.
 */
const DYNAMICALLY_IMPORTED_PROMPTS: Record<
  string,
  () => Promise<(projectInfo: ProjectInfo) => string>
> = {
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
  ...Object.keys(BUNDLED_PROMPTS),
  ...Object.keys(DYNAMICALLY_IMPORTED_PROMPTS),
];

/**
 * Internal env var read only by `getPrompts`. The eval harness sets this
 * before spawning `ai setup` to select a non-default prompt variant for A/B
 * comparison. Unknown values fall back to the default so a typo never breaks
 * the CLI for real users.
 */
const EVAL_SETUP_PROMPT_ENV = 'EVAL_SETUP_PROMPT';

function resolvePromptName(extensive?: boolean): PromptName {
  const requested = process.env[EVAL_SETUP_PROMPT_ENV]?.trim();
  if (
    requested &&
    (Object.hasOwn(BUNDLED_PROMPTS, requested) ||
      Object.hasOwn(DYNAMICALLY_IMPORTED_PROMPTS, requested))
  ) {
    return requested;
  }
  return extensive ? EXTENSIVE_PROMPT_NAME : DEFAULT_PROMPT_NAME;
}

export async function getAiSetupPrompt(
  projectInfo: ProjectInfo,
  extensive?: boolean
): Promise<{ content: string; name: PromptName }> {
  const name = resolvePromptName(extensive);
  const builder = BUNDLED_PROMPTS[name] ?? (await DYNAMICALLY_IMPORTED_PROMPTS[name]());

  return { content: builder(projectInfo), name };
}

export async function getAiSetupMarkdownOutput(
  projectInfo: ProjectInfo,
  extensive?: boolean
): Promise<{
  markdown: string;
  prompt: PromptName;
}> {
  const { content, name } = await getAiSetupPrompt(projectInfo, extensive);

  return {
    markdown: dedent`
    # Storybook Setup

    ${getProjectOverview(projectInfo)}

    ${content}
  `,
    prompt: name,
  };
}
