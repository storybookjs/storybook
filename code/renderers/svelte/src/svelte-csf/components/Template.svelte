<script>
  import { useContext, getStoryRenderContext } from './context';

  const context = useContext();

  const { children, id = 'default' } = $props();

  context.register({ id, isTemplate: true });

  const render = $derived(context.render && context.templateId === id);

  const ctx = getStoryRenderContext();
  const args = ctx.argsStore;
  const storyContext = ctx.storyContextStore;
</script>

{#if render}
  {@render children({ ...$args, context: $storyContext })}
{/if}
