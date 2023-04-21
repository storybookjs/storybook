<script>
  import { useContext, getStoryRenderContext } from './context';

  const context = useContext();

  export let id = 'default';

  context.register({ id, isTemplate: true });

  $: render = context.render && context.templateId === id;
  const ctx = getStoryRenderContext();
  const args = ctx.argsStore;
  const storyContext = ctx.storyContextStore;
</script>

{#if render}
  <slot {...$args} context={$storyContext} args={$args} />
{/if}
