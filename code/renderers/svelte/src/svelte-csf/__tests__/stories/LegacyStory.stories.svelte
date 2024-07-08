<script context="module" lang="ts">
  import { Story } from '@storybook/addon-svelte-csf';
  import type { Meta } from '@storybook/svelte';

  import LegacyStory from './LegacyTemplate.svelte';

  /**
   * Description set explicitly in the comment above export const meta.
   *
   * Multiline supported. And also Markdown syntax:
   *
   * * **Bold**,
   * * _Italic_,
   * * `Code`.
   */
  export const meta = {
    title: 'LegacyStory',
    component: LegacyStory,
    tags: ['autodocs'],
  } satisfies Meta<LegacyStory>;
</script>

<Story name="With args only" let:args>
  <LegacyStory {...args}>{'With args only'}</LegacyStory>
</Story>

<Story name="With context only" let:context>
  <p>{context.id}</p>
</Story>

<Story name="With both args and context" let:args let:context>
  <p>{context.id}</p>
  <LegacyStory {...args} />
</Story>

<Story name="With autodocs" autodocs />

<Story name="With source as shorthand" source />

<Story name="With source as text" source="<LegacyStory>{'Hi'}</LegacyStory>">
  <LegacyStory>{'Hi'}</LegacyStory>
</Story>
