<script>
  import SlotDecorator from './SlotDecorator.svelte';
  import { dedent } from 'ts-dedent';

  export let name;
  export let title;
  export let storyFn;
  export let showError;
  export let storyContext;

  let {
    /** @type {SvelteComponent} */
    Component,
    /** @type {any} */
    props = {},
    /** @type {{[string]: () => {}}} Attach svelte event handlers */
    on,
  } = storyFn();

  let firstTime = true;

  // the first time we don't want to call storyFn two times so we just return the values
  // we already have from the previous call. If storyFn changes this function will run
  // again but this time firstTime will be false
  function getStoryFnValue(storyFn) {
    if (firstTime) {
      firstTime = false;
      return {
        Component,
        props,
        on,
      };
    }
    return storyFn();
  }

  // reactive, re-render on storyFn change
  $: ({ Component, props = {}, on } = getStoryFnValue(storyFn));

  const eventsFromArgTypes = Object.fromEntries(
    Object.entries(storyContext.argTypes)
      .filter(([k, v]) => v.action && props[k] != null)
      .map(([k, v]) => [v.action, props[k]])
  );

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
</script>

<SlotDecorator {Component} {props} on={{ ...eventsFromArgTypes, ...on }} />
