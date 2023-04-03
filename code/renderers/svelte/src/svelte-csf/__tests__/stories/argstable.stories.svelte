<script>
  import { Meta, Story } from '../src/index';

  import ArgsTableView from './ArgsTableView.svelte';
  // eslint-disable-next-line
  import srcArgsTableView from './ArgsTableView.svelte?raw';
</script>

<Meta title="Args Table" component={ArgsTableView}/>

<Story name="ArgsTable" let:args source={srcArgsTableView}>
  <ArgsTableView {...args}/>
</Story>