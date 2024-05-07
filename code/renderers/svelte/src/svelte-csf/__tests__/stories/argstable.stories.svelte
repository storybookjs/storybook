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

<Story name="ArgsTable" source={srcArgsTableView} args={{ required: true, value: "test" }}>
  {#snippet children(args)}
      <ArgsTableView {...args}>
        {#snippet actions({ required, value })}
        <!-- FIXME: I don't understand what resulets were tried to be achieved there -->
        {/snippet}
      </ArgsTableView>
  {/snippet}
</Story>

