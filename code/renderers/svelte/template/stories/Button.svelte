<script>
  const Button = globalThis.__TEMPLATE_COMPONENTS__?.Button;

  const { text = 'You clicked' } = $props();

  let count = $state(0);
</script>

<Button onClick={() => (count += 1)} label="{text}: {count}" />

<p>A little text to show this is a view.</p>
<p>If we need to test components in a Svelte environment, for instance to test slot behaviour,</p>
<p>then wrapping the component up in a view</p>
<p>made just for the story is the simplest way to achieve this.</p>
