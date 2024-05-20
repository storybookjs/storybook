<script context="module">
  import { action } from '@storybook/addon-actions';

  import { defineMeta } from '../src/index';

  const { Story, meta } = defineMeta({
    title: 'Addon/Actions',
    parameters: {
      controls: { disable: true },
      interactions: { disable: true },
    },
  });
</script>

<Story>
  <button onclick={action('I am logging in the actions tab')}>
    Click me to see an a log in the <strong>Actions</strong> tab
  </button>
</Story>
