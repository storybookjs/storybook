import type { ComponentProps } from 'svelte';

import StoryComponent from './runtime/Story.svelte';
// TODO: Remove in next major release
import LegacyMetaComponent from './runtime/LegacyMeta.svelte';
// TODO: Remove in next major release
import LegacyStoryComponent from './runtime/LegacyStory.svelte';
// TODO: Remove in next major release
import LegacyTemplateComponent from './runtime/LegacyTemplate.svelte';

export { setTemplate } from './runtime/contexts/template.svelte';
import type {
  Meta as MetaType,
  StoryContext as BaseStoryContext,
  StoryAnnotations,
  Cmp,
} from './types';

export function defineMeta<const TCmp extends Cmp>(meta: MetaType<TCmp>) {
  return {
    Story: StoryComponent as typeof StoryComponent<TCmp>,
    meta,
  };
}

export type Args<TStoryCmp> = TStoryCmp extends typeof StoryComponent<infer TCmp extends Cmp>
  ? NonNullable<StoryAnnotations<TCmp>['args']>
  : never;

export type StoryContext<TStoryCmp> = TStoryCmp extends typeof StoryComponent<
  infer TCmp extends Cmp
>
  ? BaseStoryContext<TCmp>
  : never;

// TODO: Remove in next major release
export {
  /**
   * @deprecated Use `defineMeta` instead
   * @see {@link https://github.com/storybookjs/addon-svelte-csf/blob/main/MIGRATION.md#meta-component-removed-in-favor-of-definemeta}
   */
  LegacyMetaComponent as Meta,
  /**
   * @deprecated Use `Story` component returned from `defineMeta` instead
   * @see {@link https://github.com/storybookjs/addon-svelte-csf/blob/main/MIGRATION.md#export-meta-removed-in-favor-of-definemeta}
   */
  LegacyStoryComponent as Story,
  /**
   * @deprecated Use snippets instead
   * @see {@link https://github.com/storybookjs/addon-svelte-csf/blob/main/MIGRATION.md#template-component-removed}
   */
  LegacyTemplateComponent as Template,
};

// TODO: Remove in next major release
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
export type StoryProps = ComponentProps<LegacyStoryComponent>;
