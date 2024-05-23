<script context="module" lang="ts">
  import { action } from '@storybook/addon-actions';

  import { defineMeta, setTemplate, type TArgs, type TContext } from "../src/index.js";

  import Example from './Example.svelte';

  // Description set explicitly in the comment above `defineMeta`
  const { Story, meta: m } = defineMeta({
    title: 'Example',
    component: Example,
    tags: ['autodocs'],
    args: {
      onclick: action("onclick"),
      onmouseenter: action("onmouseenter"),
      onmouseleave: action("onmouseleave"),
    },
  });
</script>

<script lang="ts">

  let count = $state(0);

  function handleClick() {
    count += 1;
  }

  setTemplate(render);
</script>

{#snippet render(args: TArgs<typeof m>, context: TContext<typeof m>)}
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
