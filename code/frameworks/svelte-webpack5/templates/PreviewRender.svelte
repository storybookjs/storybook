<script>
  import SlotDecorator from './SlotDecorator.svelte';
  import { dedent } from 'ts-dedent';

  const { name, kind, storyFn, showError } = $props();

  const {
    /** @type {SvelteComponent} */
    Component,
    /** @type {any} */
    props: componentProps = {},
    /** @type {{[string]: () => {}}} Svelte event handlers are now properties */
    on,
    Wrapper,
    WrapperData = {},
  } = storyFn();

  if (!Component) {
    showError({
      title: `Expecting a Svelte component from the story: "${name}" of "${kind}".`,
      description: dedent`
        Did you forget to return the Svelte component configuration from the story?
        Use "() => ({ Component: YourComponent, data: {} })"
        when defining the story.
      `,
    });
  }
</script>
<SlotDecorator
  decorator={Wrapper}
  decoratorProps={WrapperData}
  component={Component}
  props={{...componentProps, ...on}} />