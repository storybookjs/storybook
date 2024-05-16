import type { Meta } from '@storybook/svelte';

export const ADDON_COMPONENT_NAME = 'Story';

/**
 * Data extracted from the static analytic of a single stories file - `*.stories.svelte`.
 */
export interface StoriesFileMeta {
  module: ModuleMeta;
  instance: InstanceMeta;
  fragment: FragmentMeta;
}

/**
 * Meta extracted from static analysis of the instance tag _(`<script>`)_
 * from the single stories file - `*.stories.svelte`.
 */
export interface InstanceMeta extends Pick<Meta, 'id' | 'title' | 'tags'> {
  // Can be overriden with `import { Story as S } ...`
  addonComponentName: typeof ADDON_COMPONENT_NAME | (string & {});
}

/**
 * Meta extracted from static analysis of the module tag _(`<script context="module">`)_
 * from the single stories file - `*.stories.svelte`.
 */
export interface ModuleMeta extends Pick<Meta, 'id' | 'title' | 'tags'> {
  description?: string;
}

/**
 * Meta extracted from static analysis of the `Fragment` _(html-like code)_
 * from the single stories file - `*.stories.svelte`.
 */
export interface FragmentMeta {
  stories: Record<StoryMeta['id'], StoryMeta>;
}

/**
 * Meta extracted from static analysis of the single <Story /> component
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
  /**
   * Description of the story, will display above the sample in docs mode.
   */
  description?: string;
  /** Raw source for children _(what is inside the <Story>...</Story> tags)_ */
  rawSource?: string;
}
