<script>
  import { useContext } from './context';

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

</script>

{#if render}
  <slot {...context.args} context={context.storyContext} args={context.args}/>
{/if}
