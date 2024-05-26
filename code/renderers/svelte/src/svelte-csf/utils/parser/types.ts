import type { Meta } from '@storybook/svelte';
import type { Identifier, ImportSpecifier, VariableDeclaration } from 'estree';
import type { ComponentProps } from 'svelte';

import type Story from '../../renderer/Story.svelte';

/**
 * Data extracted from the static analytic of a single stories file - `*.stories.svelte`.
 */
export interface StoriesFileMeta {
  defineMeta: DefineMeta;
  stories: Record<StoryMeta['id'], StoryMeta>;
}

export const ADDON_AST_NODES = {
  defineMeta: 'defineMeta',
  Story: 'Story',
} as const;

/**
 * AST nodes extracted from the AST compile `(svelte.compile)` needed for further code transformation.
 */
export interface AddonASTNodes {
  /**
   * Import specifier for `defineMeta` imported from this addon package.
   * Could be renamed - e.g. `import { defineMeta } from "@storybook/addon-svelte-csf"`
   */
  defineMetaImport: ImportSpecifier;
  /**
   * Variable declarator called by `defineMeta({})` function call.
   * Could be destructured with rename - e.g. `const { Story: S} = defineMeta({ ... })`
   */
  defineMetaVar: VariableDeclaration;
  /**
   * A `<Story />` component, could be destructured with rename - e.g. `const { Story: S} = defineMeta({ ... })`
   */
  Story: Identifier;
}

/**
 * Meta extracted from static analysis of the module tag _(`<script context="module">`)_
 * from the single stories file - `*.stories.svelte`.
 */
export interface ModuleMeta extends Pick<Meta, 'tags'> {
  /**
   * Description for the stories file, extracted from above `defineMeta` function call.
   */
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
 * Meta extracted from static analysis of the `defineMeta` function call
 * inside the module tag _(`script context="module">`)_ in the stories file - `*.stories.svelte`.
 * NOTE: Properties from Meta are needed for `StoriesIndexer`
 */
export interface DefineMeta extends Pick<Meta, 'id' | 'title' | 'tags'> {
  /**
   * Description for the stories file.
   * Extracted from the leading comment above `defineMeta` function call.
   */
  description?: string;
}

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
  /**
   * Description of the story, will display above the sample in docs mode.
   */
  description?: string;
  source?: ComponentProps<Story<Meta>>['source'];
  /** Raw source for children _(what is inside the `<Story>...</Story>` tags)_ */
  rawSource?: string;
}
