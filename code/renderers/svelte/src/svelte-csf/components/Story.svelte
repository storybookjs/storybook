<script>
  import { getStoryRenderContext, useContext } from './context';

  const context = useContext();

  export let name;
  export let template = null;
  export let play = null;

  if (!name) {
    throw new Error('Missing Story name');
  }

  context.register({
    name,
    ...$$restProps,
    play,
    template: template != null ? template : !$$slots.default ? 'default' : null,
  });

  $: render = context.render && !context.templateName && context.storyName == name;
  const ctx = getStoryRenderContext();
  const args = ctx.argsStore;
  const storyContext = ctx.storyContextStore;

  function injectIntoPlayFunction(ctxt, play) {
    if (play && ctxt.playFunction) {
      ctxt.playFunction.__play = play;
    }
  }

  $: if (render) {
    injectIntoPlayFunction($storyContext, play);
  }
</script>

{#if render}
  <slot {...$args} context={$storyContext} args={$args} />
{/if}
