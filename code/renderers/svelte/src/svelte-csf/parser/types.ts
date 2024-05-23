import type { Meta } from '@storybook/svelte';
import type { VariableDeclarator } from 'estree';

import type { defineMeta } from '../index.js';

export const ADDON_FN_NAME = 'defineMeta';
export const ADDON_COMPONENT_NAME = 'Story';
export const ADDON_META_VAR_NAME = 'meta';

/**
 * Data extracted from the static analytic of a single stories file - `*.stories.svelte`.
 */
export interface StoriesFileMeta {
  module: ModuleMeta;
  fragment: FragmentMeta;
}

/**
 * Meta extracted from static analysis of the module tag _(`<script context="module">`)_
 * from the single stories file - `*.stories.svelte`.
 */
export interface ModuleMeta extends Pick<Meta, 'tags'> {
  description?: string;
  // NOTE: Why? It could be overriden with `import { defineMeta as d } ...`
  addonFnName: typeof defineMeta.name | (string & {});
  // NOTE: Why? It could be overriden with `const { Story: S } ...`
  addonComponentName: typeof ADDON_COMPONENT_NAME | (string & {});
  // NOTE: Why? It could be optionally used, and overriden with `const { meta: m } ...`
  addonMetaVarName?: typeof ADDON_META_VAR_NAME | (string & {}) | undefined;
  defineMetaVariableDeclarator: VariableDeclarator;
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
