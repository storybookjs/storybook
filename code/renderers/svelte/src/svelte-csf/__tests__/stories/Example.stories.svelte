<script module lang="ts">
  import { action } from '@storybook/addon-actions';
  import {
    defineMeta,
    type Args,
    type StoryContext,
  } from '@storybook/addon-svelte-csf';

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
      onclick: action('onclick'),
      onmouseenter: action('onmouseenter'),
      onmouseleave: action('onmouseleave'),
    },
  });
</script>

<script lang="ts">
  let count = $state(0);

  function handleClick() {
    count += 1;
  }
</script>

<!--
  FIXME: Temporary workaround.
  Need to find a way on how to convert children type from `Snippet | Primitive` to `Snippet | undefined`
-->
{#snippet template({ children: _, ...args }: Args<typeof Story>, context: StoryContext<typeof Story>)}
  <Example {...args} onclick={handleClick}>
    <p>{args.id}</p>
    <p>{context.name}</p>
    You clicked: {count}<br />
  </Example>
{/snippet}

<!-- Description for the default story -->
<Story name="Default" {template} />

<!-- Description for the rounded story -->
<Story name="Rounded" args={{ rounded: true }} {template} />

<!-- Description for the squared story -->
<Story name="Square" args={{ rounded: false }} {template} />

<Story name="As child" asChild>
  <Example>Label</Example>
</Story>

<Story name="Children forwared">Forwarded label</Story>
