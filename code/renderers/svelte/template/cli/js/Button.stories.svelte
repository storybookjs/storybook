<script context="module">
  import { Story, Template } from '@storybook/addon-svelte-csf';
  import Button from './Button.svelte';

  // More on how to set up stories at: https://storybook.js.org/docs/writing-stories
  export const meta = {
    title: 'Example/Button',
    component: Button,
    tags: ['autodocs'],
    argTypes: {
      backgroundColor: { control: 'color' },
      size: {
        control: { type: 'select' },
        options: ['small', 'medium', 'large'],
      },
    },
  };
</script>

<Template let:args>
  <Button {...args} />
</Template>

<!-- More on writing stories with args: https://storybook.js.org/docs/writing-stories/args -->
<Story name="Primary" args={{ primary: true, label: 'Button' }} />

<Story name="Secondary" args={{ label: 'Button' }} />

<Story name="Large" args={{ size: 'large', label: 'Button' }} />

<Story name="Small" args={{ size: 'small', label: 'Button' }} />
