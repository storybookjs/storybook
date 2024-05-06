import type { Meta } from '@storybook/svelte';

/**
 * Story extracted from static analysis.
 */
export interface StoryDef {
  name: string;
  template: boolean;
  source: string;
  description?: string;
  hasArgs: boolean;
}

/**
 * Informations extracted from static analysis.
 */
export interface StoriesDef {
  meta: Meta;
  stories: Record<string, StoryDef>;
  /**
   * All allocated ids in the svelte script section.
   */
  allocatedIds: string[];
}

/**
 * Story extracted from executing the Stories component.
 */
export interface Story {
  id: string;
  name: string;
  template: string;
  component: any;
  isTemplate: boolean;
  source: boolean;
  play?: (playStoryContext: object) => any;
}
