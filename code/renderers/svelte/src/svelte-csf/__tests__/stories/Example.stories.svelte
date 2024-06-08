<script context="module" lang="ts">
  import { action } from '@storybook/addon-actions';
  import { defineMeta, setTemplate, type Args, type StoryContext } from '@storybook/addon-svelte-csf';

  import Example from './Example.svelte';

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

{#snippet render(args: Args<typeof Story>, context: StoryContext<typeof Story>)}
    <Example {...args} onclick={handleClick}>
      <p>{args?.id}</p>
      <p>{context.name}</p>
      You clicked: {count}<br>
    </Example>
{/snippet}

<!-- Description for the default story -->
<Story name="Default" />

<!-- Description for the rounded story -->
<Story name="Rounded" args={{ rounded: true }} />

<!-- Description for the squared story -->
<Story name="Square" args={{ rounded: false }} />

<Story name="Without template">
  <Example>Label</Example>
</Story>
