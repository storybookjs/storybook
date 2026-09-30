<script module lang="ts">
  import { defineMeta, type StoryContext } from '@storybook/svelte';
  import { fn } from 'storybook/test';
  import type { ComponentProps } from 'svelte';

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
      onclick: onclickFn,
      children: 'Click me',
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

  // `children` is a text control here, not the component's snippet prop
  type Args = Omit<ComponentProps<typeof Button>, 'children'> & { children?: string };
</script>

{#snippet template({ children, ...args }: Args, context: StoryContext<Args>)}
  <Button {...args}>{children}</Button>
{/snippet}

<!-- Only use this sparingly as the main CTA. -->
<Story name="Primary" args={{ primary: true }} />

<Story name="Secondary" />

<Story name="Large" args={{ size: 'large' }} />

<!-- This is _tiny_ 🤏 -->
<Story name="Small" args={{ size: 'small' }} />

<Story name="Long content">The very long content</Story>

<Story name="Custom template">
  {#snippet template({ children: _children, ...args }, context)}
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
