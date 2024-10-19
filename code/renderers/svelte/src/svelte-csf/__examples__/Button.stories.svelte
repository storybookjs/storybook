<script module lang="ts">
  import {
    defineMeta,
    setTemplate,
    type Args,
    type StoryContext,
  } from '@storybook/addon-svelte-csf';
  import { fn } from '@storybook/test';

  import Button from './components/Button.svelte';

  const onclickFn = fn().mockName('onclick');

  /**
   * These are the stories for the `Button` component.
   * It's the default button we use throughout our application.
   */
  const { Story } = defineMeta({
    component: Button,
    tags: ['autodocs'],
    args: {
      children: 'Click me',
      onclick: onclickFn,
    },
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

{#snippet template({ children, ...args }: Args<typeof Story>, context: StoryContext<typeof Story>)}
  <Button {...args}>{children}</Button>
{/snippet}

<!-- Only use this sparingly as the main CTA. -->
<Story name="Primary" args={{ primary: true }} />

<Story name="Secondary" />

<Story name="Large" args={{ size: 'large' }} />

<!-- This is _tiny_ 🤏 -->
<Story name="Small" args={{ size: 'small' }} />

<Story name="Long content">
  <Button onclick={onclickFn}>The very long content</Button>
</Story>
