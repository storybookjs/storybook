<script>
  import SlotDecorator from './SlotDecorator.svelte';
  import { dedent } from 'ts-dedent';

  const { name, title, storyFn, showError } = $props();

  let Component = $state();
  let componentnProps = $state({});
  let on = $state();
  let argTypes = $state();
  let firstTime = $state(true);

  // Initial load
  const initialResult = storyFn();
  Component = initialResult.Component;
  componentnProps = initialResult.props || {};
  on = initialResult.on;
  argTypes = initialResult.argTypes;

  // Re-evaluate when storyFn changes
  $effect(() => {
    if (firstTime) {
      firstTime = false;
      return;
    }
    
    const result = storyFn();
    Component = result.Component;
    componentnProps = result.props || {};
    on = result.on;
    argTypes = result.argTypes;
  });

  // set the argTypes context, read by the last SlotDecorator that renders the original story
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

<SlotDecorator {Component} props={componentnProps} {on} {argTypes} />
