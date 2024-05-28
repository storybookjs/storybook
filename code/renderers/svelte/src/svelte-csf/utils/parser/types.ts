import type { Meta } from '@storybook/svelte';
import type { ComponentProps } from 'svelte';

import type Story from '../../renderer/Story.svelte';

/**
 * Data extracted from the static analytic of a single stories file - `*.stories.svelte`.
 */
export interface StoriesFileMeta {
  defineMeta: DefineMeta;
  stories: Record<StoryMeta['id'], StoryMeta>;
}

/**
 * Meta extracted from static analysis of the `Fragment` _(html-like code)_
 * from the single stories file - `*.stories.svelte`.
 */
export interface FragmentMeta {
  stories: Record<StoryMeta['id'], StoryMeta>;
}

/**
 * Meta extracted from static analysis of the `defineMeta` function call
 * inside the module tag _(`script context="module">`)_ in the stories file - `*.stories.svelte`.
 * NOTE: Properties from Meta are needed for `StoriesIndexer`
 */
export interface DefineMeta extends Pick<Meta, 'id' | 'title' | 'tags'> {}

/**
 * Meta extracted from static analysis of the single `<Story />` component
 * in the stories file - `*.stories.svelte`.
 */
export interface StoryMeta {
  /**
   * Id of the story. By default is hashed, otherwise can be overriden.
   */
  id: string;
  /**
   * Name of the story.
   * @default "Default"
   */
  name: string;
  source?: ComponentProps<Story<Meta>>['source'];
  /** Raw source for children _(what is inside the `<Story>...</Story>` tags)_ */
  rawSource?: string;
}
