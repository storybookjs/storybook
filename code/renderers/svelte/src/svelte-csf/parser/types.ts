import type { Meta, StoryObj } from '@storybook/svelte';

export const ADDON_COMPONENT_NAMES = ['Story', 'Template'] as const;
export type AddonComponentName = (typeof ADDON_COMPONENT_NAMES)[number];

export interface StoriesFileMeta {
  module: ModuleMeta;
  fragment: FragmentMeta;
}

/**
 * Meta extracted from static analysis of the module tag _(`<script context="module">`)_ from the stories file.
 */
export interface ModuleMeta extends Pick<Meta, 'id' | 'title' | 'tags'> {
  description?: string;
}

/**
 * Meta extracted from static analysis of the `Fragment` _(html-like code)_ from the stories file.
 */
export interface FragmentMeta {
  templates: Record<TemplateMeta['id'], TemplateMeta>;
  stories: Record<StoryMeta['id'], StoryMeta>;
}

export interface TemplateMeta {
  /**
   * Template id, which is used by `<Story>` - addon component
   * @default "default"
   */
  id: string;
  /** Raw source for children _(what is inside the <Template>...</Template> tags)_ */
  rawSource?: string;
}

export interface StoryMeta extends Omit<StoryObj, 'render'> {
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
   * Template id to use.
   * @default "default"
   */
  templateId?: string;
  /**
   * Description of the story, will display above the sample in docs mode.
   */
  description?: string;
  /** Raw source for children _(what is inside the <Story>...</Story> tags)_ */
  rawSource?: string;
}
