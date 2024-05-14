<script lang="ts" context="module">
  import type { Meta } from '@storybook/svelte';

  import ArgsTableView from './ArgsTableView.svelte';

  export const meta = {
    title: 'Args Table',
    component: ArgsTableView,
  } satisfies Meta<ArgsTableView>;
</script>

<script>
  // eslint-disable-next-line
  import srcArgsTableView from './ArgsTableView.svelte?raw';

  import { Story } from '../src/index.js';
</script>

{#snippet actions({ required, value })}
  <span>{required}</span><br>
  <span>{value}</span>
{/snippet}

<Story {meta} name="ArgsTable" source={srcArgsTableView} args={{ required: true, value: "test" }}>
  {#snippet children({ args })}
      <ArgsTableView {...args} {actions} />
  {/snippet}
</Story>

