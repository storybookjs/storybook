<script>
  import { useContext } from './context';

  const context = useContext();

  export let id = 'default';

  context.register({id, isTemplate: true});

  $: render = context.render && context.templateId === id;
</script>

{#if render}
  <slot args={context.args} {...context.args}/>
{/if}
