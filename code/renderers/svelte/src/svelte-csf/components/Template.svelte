<script>
  import { useContext } from './context';

  const context = useContext();

  export let id = 'default';

  context.register({id, isTemplate: true});

  $: render = context.render && context.templateId === id;
</script>

{#if render}
  <slot {...context.args} context={context.storyContext} args={context.args}/>
{/if}
