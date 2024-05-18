<script context="module" lang="ts">
  import type { Meta } from '@storybook/svelte';

  import Text from './Text.svelte';

  /**
   * Demonstration on how to use multiple templates in one stories file,
   * powered by Svelte's **snippets**.
   */
  export const meta: Meta<Text> = {
    title: 'Templates',
    tags: ['autodocs'],
  };
</script>

<script lang="ts">
  import { defineComponent, type Template } from '../src/index.js';

  const { Story } = defineComponent(meta);
</script>


{#snippet template1({ args }: Template<Text>)}
  <h2 style="color: lightgreen">Template 1</h2>
  <p>{args.text}</p>
{/snippet}

{#snippet template2({ args }: Template<Text>)}
  <h2 style="color: fuchsia">Template 2</h2>
  <hr>
  <p>{args.text}</p>
{/snippet}

<Story
  name="Story with template 1"
  children={template1}
  args={{ text: 'This story uses the first template' }}
/>

<Story
  name="Story with template 2"
  children={template2}
  args={{ text: 'This story uses second template' }}
/>

<Story
  name="Custom template"
  args={{ text: 'This story uses custom template passed as children' }}
>
  {#snippet children({ args })}
    <h2 style="color: orange;font-weight: 700;">Custom template</h2>
    <hr style="border-style: dashed">
    <p>{args.text}</p>
    <hr>
  {/snippet}
</Story>
