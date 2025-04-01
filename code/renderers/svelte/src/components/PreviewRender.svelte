<script>
  import DecoratorHandler from './DecoratorHandler.svelte';
  import { dedent } from 'ts-dedent';

  const { name, title, storyFn, showError } = $props();

  let {
    /** @type {import('svelte').SvelteComponent} */
    Component,
    props = {},
  } = $derived.by(() => {
    return storyFn();
  });

  $effect(() => {
    if (!Component) {
      showError({
        title: `Expecting a Svelte component from the story: "${name}" of "${title}".`,
        description: dedent`
        Did you forget to return the Svelte component configuration from the story?
        Use "() => ({ Component: YourComponent, props: {} })"
        when defining the story.
      `,
      });
    }
  });
</script>

<DecoratorHandler {Component} {props} />
