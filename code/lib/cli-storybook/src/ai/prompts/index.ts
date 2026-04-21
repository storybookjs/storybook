import type { AiPrompt, ProjectInfo } from '../types.ts';

import * as patternCopyPlay from './pattern-copy-play.ts';
import * as setup from './setup.ts';

/**
 * Registry of all prompt builders. Each key is a prompt identifier used only
 * internally (by the eval harness via `EVAL_SETUP_PROMPT`); users never see
 * these names. Each variant file exports an `instructions(projectInfo)`
 * function; namespace imports keep the registry self-describing and make the
 * convention uniform.
 */
const PROMPT_BUILDERS = {
  'pattern-copy-play': patternCopyPlay.instructions,
  setup: setup.instructions,
} satisfies Record<string, (projectInfo: ProjectInfo) => string>;

export type PromptName = keyof typeof PROMPT_BUILDERS;

export const PROMPT_NAMES = Object.keys(PROMPT_BUILDERS) as PromptName[];

/**
 * The single prompt variant that ships to real users. Running
 * `npx storybook ai setup` without any overrides always produces this prompt.
 */
export const DEFAULT_PROMPT_NAME: PromptName = 'pattern-copy-play';

/**
 * Internal env var read only by `getPrompts`. The eval harness sets this
 * before spawning `ai setup` to select a non-default prompt variant for A/B
 * comparison. Unknown values fall back to the default so a typo never breaks
 * the CLI for real users.
 */
const EVAL_SETUP_PROMPT_ENV = 'EVAL_SETUP_PROMPT';

function resolvePromptName(): PromptName {
  const requested = process.env[EVAL_SETUP_PROMPT_ENV]?.trim();
  if (requested && requested in PROMPT_BUILDERS) {
    return requested as PromptName;
  }
  return DEFAULT_PROMPT_NAME;
}

export function getPrompts(projectInfo: ProjectInfo): { prompts: AiPrompt[] } {
  const name = resolvePromptName();
  return {
    prompts: [
      {
        name,
        description: 'Set up Storybook for success',
        instructions: PROMPT_BUILDERS[name](projectInfo),
      },
    ],
  };
}
