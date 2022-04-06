<script>
  import { Meta, Story } from '../src/index';
  import Button from './Button.svelte';
</script>

<Meta title="StoryContext" component={Button} />

<Story name="StoryContext" let:context>
  <div>StoryContext.name = {context.name}</div>
  <div>StoryContext.id = {context.id}</div>
</Story>
