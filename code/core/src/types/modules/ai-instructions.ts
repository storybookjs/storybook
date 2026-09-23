import type { Options } from './core-common.ts';

/** Markdown examples contributed by renderers and frameworks to Storybook's AI instructions. */
export interface AIInstructionSnippets {
  story?: string;
  preview?: string;
  additionalGuidance?: string;
}

/** Project context for generating framework-specific examples. */
export interface AIInstructionContext {
  framework: string;
  language: 'ts' | 'js';
  configDir: string;
  hasCsfFactoryPreview: boolean;
}

/** Override selected snippets, preserving the other contributions from earlier presets. */
export type AIInstructionsPreset = (
  existing: AIInstructionSnippets,
  options: Options & { aiContext: AIInstructionContext }
) => AIInstructionSnippets | Promise<AIInstructionSnippets>;
