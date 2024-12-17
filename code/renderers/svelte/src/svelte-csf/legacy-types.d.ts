// TODO: Remove this file in next major release

import type { SvelteComponent } from 'svelte';
import type {
  Addon_BaseMeta as BaseMeta,
  Addon_BaseAnnotations as BaseAnnotations,
  StoryContext,
  WebRenderer,
} from '@storybook/types';

type DecoratorReturnType =
  | void
  | SvelteComponent
  | {
      Component: any;
      props?: any;
    };

/**
 * @deprecated
 * Use `Story` component returned from `defineMeta` instead together with {@link ComponentProps}.
 *
 * ```svelte
 * <script lang="ts">
 *   import type { ComponentProps } from 'svelte';
 *
 *   const { Story } = defineMeta({ ... });
 *
 *   type StoryProps = ComponentProps<typeof Story>;
 * </script>
 * ```
 */
interface StoryProps extends BaseAnnotations<any, DecoratorReturnType, WebRenderer> {
  /**
   * Id of the story.
   *
   * Optional, auto-generated from name if not specified.
   *
   * @deprecated
   * From the version `v5` of this addon use `exportName` if needed.
   */
  id?: string;
  /**
   * Name of the story.
   */
  name: string;
  /**
   * Id of the template used by this story.
   *
   * Optional. Used if the story has no body.
   * If not specified, use the 'default' template.
   *
   * @deprecated
   * Use Svelte [snippet block](https://svelte.dev/docs/svelte/snippet) instead.
   * @see {@link https://github.com/storybookjs/addon-svelte-csf/blob/next/MIGRATION.md#template-component-removed}
   */
  template?: string;
  /**
   * Specify which sources should be shown.
   *
   * By default, sources for an args story are auto-generated.
   * If source is true, then the source of the story will be used instead.
   * If source is a string, it replaces the source of the story.
   *
   * @deprecated
   * Use `parameters={{ docs: { source: { code: "..." } } }}` instead.
   * @see {@link https://github.com/storybookjs/addon-svelte-csf/blob/next/MIGRATION.md#story-prop-source-has-been-removed}
   */
  source?: boolean | string;
  /**
   * List of tags to add to the story.
   *
   * It must be a static array of strings.
   *
   * @example tags={['!dev', 'autodocs']}
   */
  tags?: string[];
  /**
   * Enable the tag 'autodocs'.
   *
   * @see [Automatic documentation](https://storybook.js.org/docs/svelte/writing-docs/autodocs)
   * @deprecrated
   * Use `tags={['autodocs']}` instead.
   * @see {@link https://github.com/storybookjs/addon-svelte-csf/blob/main/MIGRATION.md#story-prop-autodocs-has-been-removed}
   */
  autodocs?: boolean;
}

/**
 * @deprecated
 * Use Svelte v5 snippet blocks instead.
 * @see {@link https://github.com/storybookjs/addon-svelte-csf/blob/main/MIGRATION.md#template-component-removed}
 */
interface TemplateProps extends BaseAnnotations<any, DecoratorReturnType> {
  /**
   * Id of the template.
   *
   * Optional. Use 'default' if not specified.
   */
  id?: string;
}

/**
 * @deprecated
 * Use `defineMeta()` inside the module script tag instead.
 * @see {@link https://github.com/storybookjs/addon-svelte-csf/blob/main/MIGRATION.md#meta-component-removed-in-favor-of-definemeta}
 */
interface MetaProps extends BaseMeta<any>, BaseAnnotations<any, DecoratorReturnType> {
  /**
   * Enable the tag 'autodocs'.
   *
   * @see [Automatic documentation](https://storybook.js.org/docs/svelte/writing-docs/autodocs)
   */
  autodocs?: boolean;
  /**
   * List of tags to add to the stories.
   *
   * It must be a static array of strings.
   *
   * @example tags={['!dev', 'autodocs']}
   */
  tags?: string[];
}

export interface Slots {
  default: {
    args: any;
    context: StoryContext;
    [key: string]: any;
  };
}
