<script context="module" lang="ts">
  import { Template, defineMeta } from '@storybook/addon-svelte-csf';

  import LegacyTemplate from './LegacyTemplate.svelte';

  /**
   * Description set explicitly in the comment above `defineMeta`.
   *
   * Multiline supported. And also Markdown syntax:
   *
   * * **Bold**,
   * * _Italic_,
   * * `Code`.
   */
  const { Story } = defineMeta({
    title: 'LegacyTemplate',
    component: LegacyTemplate,
    tags: ['autodocs'],
  });
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

<Template id="rounded" let:args>
  <p>Using rounded template</p>
  <LegacyTemplate {...args} onclick={handleClick} rounded />
</Template>

<!-- TODO: Need to restore legacy Story first -->
<Story name="Default" {children} />

<!-- TODO: Need to restore legacy Story first -->
<Story name="Rounded" children={rounded} />
