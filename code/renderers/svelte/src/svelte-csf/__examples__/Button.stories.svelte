<script context="module" lang="ts">
  import {
    defineMeta,
    setTemplate,
    type Args,
    type StoryContext,
  } from '@storybook/addon-svelte-csf';

  import Button from './components/Button.svelte';

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
      children: { control: 'text' },
    },
  });
</script>

<script lang="ts">
  setTemplate(template);
</script>

{#snippet template({children, ...args}: Args<typeof Story>, context: StoryContext<typeof Story>)}
  <Button {...args}>{children}</Button>
{/snippet}

<!-- More on writing stories with args: https://storybook.js.org/docs/writing-stories/args -->
<Story name="Primary" args={{ primary: true }} />

<Story name="Secondary" />

<Story name="Large" args={{ size: 'large' }} />

<Story name="Small" args={{ size: 'small' }} />

<Story name="Long content">
  <Button>The content</Button>
</Story>
