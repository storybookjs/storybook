import type { PromptVariant } from './types';

export const PROMPT_VARIANTS: PromptVariant[] = [
  {
    id: 'baseline',
    label: 'Baseline setup prompt',
    description: 'The default setup prompt with provider/style/story guidance and a verification loop.',
    promptFiles: ['base.md'],
  },
  {
    id: 'strict-self-heal',
    label: 'Strict self-heal loop',
    description: 'Adds a stricter fix-verify-repeat loop for experiments around self-healing behavior.',
    promptFiles: ['base.md', 'strict-self-heal.md'],
  },
  {
    id: 'doctor-hints',
    label: 'Doctor-first diagnostics',
    description: 'Encourages Storybook diagnostic commands before the first config edit.',
    promptFiles: ['base.md', 'doctor-hints.md'],
  },
];

export function getVariantById(id: string) {
  const variant = PROMPT_VARIANTS.find((entry) => entry.id === id);
  if (!variant) {
    throw new Error(`Unknown prompt variant "${id}".`);
  }

  return variant;
}
