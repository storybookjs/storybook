<script>
  import { getStoryRenderContext, useContext } from './context';

  const context = useContext();

  const { children, name, template = null, play = null, ...restProps } = $props();

  if (!name) {
    throw new Error('Missing Story name');
  }

  context.register({
    name,
    ...restProps,
    play,
    template: template != null ? template : !children ? 'default' : null,
  });

  const render = $derived(context.render && !context.templateName && context.storyName === name);

  const ctx = getStoryRenderContext();
  const args = ctx.argsStore;
  const storyContext = ctx.storyContextStore;

  function injectIntoPlayFunction(ctxt, play) {
    if (play && ctxt.playFunction) {
      ctxt.playFunction.__play = play;
    }
  }

  $effect(() => {
    if (render) {
      injectIntoPlayFunction($storyContext, play);
    }
  });
</script>

{#if render}
  {@render children({ ...$args, context: $storyContext })}
{/if}
