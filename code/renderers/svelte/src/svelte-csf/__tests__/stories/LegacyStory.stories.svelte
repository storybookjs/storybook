<script context="module" lang="ts">
  import { Story, Template } from '@storybook/addon-svelte-csf';
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
  } satisfies Meta<typeof LegacyStory>;

  let count = 0;

  function handleClick() {
    count += 1;
  }
</script>

<Template let:args>
  <LegacyStory {...args} on:click={handleClick} on:click>
    You clicked: {count}
  </LegacyStory>
</Template>

<Story name="Default" autodocs />

<Story name="Rounded" args={{ rounded: true }} />

<Story name="Square" source args={{ rounded: false }} />

<!-- Dynamic snippet should be disabled for this story -->
<Story name="No Args">
  <LegacyStory>Label</LegacyStory>
</Story>
