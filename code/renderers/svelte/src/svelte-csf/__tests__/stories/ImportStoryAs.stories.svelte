<script context="module">
  export const meta = {
    title: 'Import Story As',
    args: {
      message: "Hello from Storybook for Svelte using CSF!",
    },
    argTypes: {
      text: { control: "text" },
    },
  };
</script>

<script>
  import { Story as S } from "../src/index";
</script>

<S>
  {#snippet children({ args })}
    <p>You can import <code style="font-weight: bolder;">Story</code> component as whatever name you want to - we've got it covered.</p>
    <p>{args.message}</p>
  {/snippet}
</S>
