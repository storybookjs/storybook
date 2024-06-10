<script context="module" lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Button from './components/Button.svelte';
  import { setTemplate } from '#index';

  /**
   * These are the stories for the `Button` component.
   * It's the default button we use throughout our application.
   */
  const { Story } = defineMeta({
    component: Button,
    tags: ['autodocs'],
    argTypes: {
      backgroundColor: { control: 'color' },
      size: {
        control: { type: 'select' },
        options: ['small', 'medium', 'large'],
      },
      content: { control: 'text' },
    },
    args: {
      content: 'Content',
    },
  });
</script>

<script>
  setTemplate(template);
</script>

{#snippet template({ ...args })}
  <Button {...args}>{args.content}</Button>
{/snippet}

<!-- More on writing stories with args: https://storybook.js.org/docs/writing-stories/args -->
<Story name="Primary" args={{ primary: true }} />

<Story name="Secondary" />

<Story name="Large" args={{ size: 'large' }} />

<Story name="Small" args={{ size: 'small' }} />

<Story name="Long content" args={{ content: 'this is a lot of text for a button' }} />
