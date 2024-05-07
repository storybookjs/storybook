<script lang="ts" context="module">
  import type { Meta } from '@storybook/svelte';

  import Button from './Button.svelte';

  export const meta = {
    title: 'StoryContext',
    component: Button,
  } satisfies Meta<Button>;
</script>

<script>
  import { Story } from '../src/index.js';
</script>

<Story name="StoryContext">
  {#snippet children({ context })}
    <div>StoryContext.name = {context.name}</div>
    <div>StoryContext.id = {context.id}</div>
  {/snippet}
</Story>
