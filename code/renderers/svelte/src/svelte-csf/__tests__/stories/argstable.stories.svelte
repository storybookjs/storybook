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

<Story name="ArgsTable" source={srcArgsTableView} let:args>
  <ArgsTableView {...args} />
</Story>

