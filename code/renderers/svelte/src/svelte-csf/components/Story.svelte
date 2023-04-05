<script>
  import { getStoryRenderContext, useContext } from './context';

  const context = useContext();

  export let name;
  export let template = null;

  if (!name) {
    throw new Error('Missing Story name');
  }

  context.register({
    name,
    ...$$restProps,
    template: template != null ? template : !$$slots.default ? 'default' : null,
  });

  $: render = context.render && !context.templateName && context.storyName == name;
  const ctx = getStoryRenderContext();
  const args = ctx.argsStore;
  const storyContext = ctx.storyContextStore;
</script>

{#if render}
  <slot {...$args} context={$storyContext} args={$args} />
{/if}
