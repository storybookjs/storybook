<script context="module">
  import { action } from '@storybook/addon-actions';

  import Button from './Button.svelte';

  // Description set explicitly in the comment above meta export
  /** @type {import("@storybook/svelte").Meta<Button>} */
  export const meta = {
    title: 'Button',
    component: Button,
    tags: ['autodocs'],
    args: {
      rounded: false,
      text: "Text from export meta",
      onclick: action("onclick"),
      onmouseenter: action("onmouseenter"),
      onmouseleave: action("onmouseleave"),
    },
    argTypes: {
      text: { control: "text" },
    },
  };
</script>

<script>
  import Story from "../src/components/Story.svelte";
  import Template from "../src/components/Template.svelte";


  let count = $state(0);

  function handleClick() {
    count += 1;
  }
</script>

<Template
  {meta}
  argTypes={{ rounded: { control: "select", options: ["no", "yes"] }}}
>
  {#snippet children({ args })}
    <Button {...args} />
  {/snippet}
</Template>

<Template id="1" {meta} args={{ text: "Text from template 1 args | " }}>
  {#snippet children({ args })}
    <Button {...args} onclick={handleClick}>
      You clicked: {count}
    </Button>
  {/snippet}
</Template>

<!-- Description for the default story -->
<Story {meta} args={{ rounded: true,text: "hello" }} argTypes={{ text: { control: "radio", options: ["Yes", "No"] } }} />

<!-- Description for the rounded story -->
<Story {meta} name="Rounded" args={{ rounded: true }} />

<!-- Description for the squared story -->
<Story {meta} name="Square" args={{ rounded: false, text: "Text overriden in story args" }} />

<!-- Description for the other story -->
<Story {meta} name="Other" template="1" args={{ rounded: true }} />

<!-- Dynamic snippet should be disabled for this story -->
<Story {meta} name="Button No Args">
  <Button>Label</Button>
</Story>
