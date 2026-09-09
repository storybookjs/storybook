<script module lang="ts">
  import {
    defineMeta,
    type Args,
    type StoryContext,
  } from '@storybook/addon-svelte-csf';

  import GradioButton from './GradioButton.svelte';

  const { Story } = defineMeta({
    title: 'SvelteFixtures/GradioButton',
    component: GradioButton,
    render: template,
    argTypes: {
      variant: {
        control: 'select',
        options: ['primary', 'secondary', 'stop'],
      },
    },
  });
</script>

{#snippet template(
  { _children, ...args }: Args<typeof Story>,
  _context: StoryContext<typeof Story>
)}
  <GradioButton {...args} />
{/snippet}

<Story name="Default" args={{ value: null, scale: 0.5 }} />

<Story name="Hidden" args={{ visible: 'hidden' }} />
