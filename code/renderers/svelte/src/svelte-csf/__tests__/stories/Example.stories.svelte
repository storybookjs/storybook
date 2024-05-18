<script context="module" lang="ts">
  import { action } from '@storybook/addon-actions';
  import type { Meta } from "@storybook/svelte";

  import Example from './Example.svelte';

  // Description set explicitly in the comment above `export const meta`
  export const meta: Meta<Example> = {
    title: 'Example',
    component: Example,
    tags: ['autodocs'],
    args: {
      rounded: false,
      onclick: action("onclick"),
      onmouseenter: action("onmouseenter"),
      onmouseleave: action("onmouseleave"),
    },
  };
</script>

<script lang="ts">
  import { defineComponent, setTemplate } from "../src/index.js";

  let count = $state(0);

  function handleClick() {
    count += 1;
  }

  const { Story } = defineComponent(meta);

  setTemplate(render);
</script>

{#snippet render({ args, context })}
    <Example {...args} onclick={handleClick}>
      <p>{context.name}</p>
      You clicked: {count}<br>
    </Example>
{/snippet}

<!-- Description for the default story -->
<Story />

<!-- Description for the rounded story -->
<Story name="Rounded" args={{ rounded: true }} />

<!-- Description for the squared story -->
<Story name="Square" args={{ rounded: false }} />

<Story name="Without template">
  <Example>Label</Example>
</Story>
