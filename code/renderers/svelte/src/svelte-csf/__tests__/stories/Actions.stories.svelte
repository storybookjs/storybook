<script context="module">
  import { action } from '@storybook/addon-actions';
  import { defineMeta } from '@storybook/addon-svelte-csf';

  const { Story } = defineMeta({
    title: 'Addon/Actions',
    parameters: {
      controls: { disable: true },
      interactions: { disable: true },
    },
  });
</script>

<Story name="Default">
  <button onclick={action('I am logging in the actions tab')}>
    Click me to see an a log in the <strong>Actions</strong> tab
  </button>
</Story>
