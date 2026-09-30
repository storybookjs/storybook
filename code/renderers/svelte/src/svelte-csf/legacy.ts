// TODO: Remove with the legacy syntax.
// The `@storybook/svelte/csf` entry. Legacy stories files import these components from it.
import LegacyMetaComponent from '@storybook/svelte/internal/svelte-csf/LegacyMeta.svelte';
import LegacyStoryComponent from '@storybook/svelte/internal/svelte-csf/LegacyStory.svelte';
import LegacyTemplateComponent from '@storybook/svelte/internal/svelte-csf/LegacyTemplate.svelte';

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

export type * from './legacy-types.d.ts';
