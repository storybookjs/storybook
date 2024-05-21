<script context="module" lang="ts">
  import { defineMeta, type TArgs } from '../src/index.js';

  import Text from './Text.svelte';

  /**
   * Demonstration on how to use multiple templates in one stories file,
   * powered by Svelte's **snippets**.
   */
  const { Story, meta } = defineMeta({
    title: 'Templates',
    component: Text,
    tags: ['autodocs'],
    args: { text: "" },
    argsTypes: {
      text: { control: "text" },
    },
  });
</script>

{#snippet template1(args: TArgs<typeof meta>)}
  <h2 style="color: lightgreen">Template 1</h2>
  <p>{args?.text}</p>
{/snippet}

{#snippet template2(args: TArgs<typeof meta>)}
  <h2 style="color: fuchsia">Template 2</h2>
  <hr>
  <p>{args?.text}</p>
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

<Story name="Static template">
  <h2 style="color: aqua">Static template</h2>
  <hr>
  <p>{"Static template."}</p>
</Story>

<Story
  name="Custom template"
  args={{ text: 'This story uses custom template passed as children' }}
>
  {#snippet children(args)}
    <h2 style="color: orange;font-weight: 700;">Custom template</h2>
    <hr style="border-style: dashed">
    <p>{args?.text}</p>
    <hr>
  {/snippet}
</Story>
