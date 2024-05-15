<script context="module">
  import { action } from '@storybook/addon-actions';

  export const meta = {
    title: 'Addon/Actions',
    parameters: {
      controls: { disable: true },
      interactions: { disable: true },
    },
  };
</script>

<script>
  import { Story } from '../src/index';
</script>

<Story>
  <button onclick={action('I am logging in the actions tab')}>
    Click me to see an a log in the <strong>Actions</strong> tab
  </button>
</Story>
