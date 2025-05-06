<script module lang="ts">
  import { defineMeta, type StoryContext } from '@storybook/addon-svelte-csf';
  import { fn } from '@storybook/test';

  import Button from './components/Button.svelte';
  import type { ComponentProps } from 'svelte';

  const onclickFn = fn().mockName('onclick');

  /**
   * These are the stories for the `Button` component.
   * It's the default button we use throughout our application.
   */
  const { Story } = defineMeta({
    component: Button,
    tags: ['autodocs'],
    args: {
      onclick: onclickFn,
      children: 'Click me' as any,
    },
    argTypes: {
      backgroundColor: { control: 'color' },
      size: {
        control: { type: 'select' },
        options: ['small', 'medium', 'large'],
      },
      children: { control: 'text' },
    },
    render: template,
  });
</script>

{#snippet template(args, context)}
  <Button {...args}>{args.children}</Button>
{/snippet}

<!-- Only use this sparingly as the main CTA. -->
<Story name="Primary" args={{ primary: true }} />

<Story name="Secondary" />

<Story name="Large" args={{ size: 'large' }} />

<!-- This is _tiny_ 🤏 -->
<Story name="Small" args={{ size: 'small' }} />

<Story name="Long content">The very long content</Story>

<Story name="Custom template">
  {#snippet template(args, context)}
    <Button {...args}>🩷 Storybook</Button>
    <Button {...args}>🧡 Svelte</Button>
  {/snippet}
</Story>

<!--
Input values from the controls tab will **not** be passed down to story.
Neither the `args` from meta.
-->
<Story name="Static story" parameters={{ controls: { disable: true } }} asChild>
  <h1>This is a static story</h1>
  <Button>Static button</Button>
</Story>
