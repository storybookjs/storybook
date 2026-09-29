<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';

  /**
   * Demonstration of how to use the `name` and `exportName` props for `<Story>`
   */
  const { Story } = defineMeta({
    tags: ['autodocs'],
  });
</script>

<!-- This story just has `<Story name="Simple name">` -->
<Story name="Simple name">Simple name</Story>

<!-- This story has `exportName="NameFromExportName"`, from which the name is derived. -->
<Story exportName="NameFromExportName">Name from export name</Story>

<!-- This story has `name="Nice Name" exportName="CustomExportName"` -->
<Story name="Nice Name" exportName="CustomExportName">Name and export name</Story>
