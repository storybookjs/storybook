<script context="module" lang="ts">
  import { Story, Template } from '@storybook/addon-svelte-csf';
  import type { Meta } from '@storybook/svelte-vite';

  import LegacyTemplate from './LegacyTemplate.svelte';

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
    title: 'LegacyTemplate',
    component: LegacyTemplate,
    tags: ['autodocs'],
  } satisfies Meta<typeof LegacyTemplate>;
</script>

<script lang="ts">
  let count = $state(0);

  function handleClick() {
    count += 1;
  }
</script>

<Template let:args let:context>
  <p>Using default template</p>
  <LegacyTemplate {...args} onclick={handleClick} />
</Template>

<Story name="Default" />

<Template id="rounded" let:args>
  <p>Using rounded template</p>
  <LegacyTemplate {...args} onclick={handleClick} rounded />
</Template>

<Story name="Rounded" template="rounded" />
