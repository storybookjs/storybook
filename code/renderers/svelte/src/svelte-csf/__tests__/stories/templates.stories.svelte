<script context="module">
  /**
   * Demonstration on how to use multiple templates in one stories file,
   * powered by Svelte's **snippets**.
   * @type {import("@storybook/svelte").Meta}
   */
  export const meta = {
    title: 'Templates',
    tags: ['autodocs'],
  };
</script>

<script>
  import { Story } from '../src/index';
</script>


{#snippet template1({ args: { text } })}
  <h2 style="color: lightgreen">Template 1</h2>
  <p>{text}</p>
{/snippet}

{#snippet template2({ args: { text } })}
  <h2 style="color: fuchsia">Template 2</h2>
  <hr>
  <p>{text}</p>
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
  {#snippet children({ args: { text} })}
    <h2 style="color: orange;font-weight: 700;">Custom template</h2>
    <hr>
    <p>{text}</p>
    <hr>
  {/snippet}
</Story>
