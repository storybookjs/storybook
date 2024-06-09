<script context="module">
  import { defineMeta } from "@storybook/addon-svelte-csf";

  const { Story } = defineMeta({
    title: "Testing/Identifiers",
    parameters: {
      actions: { disable: true },
      controls: { disable: true },
      interactions: { disable: true },
    },
  });
</script>

<Story name="Only name">
  <p>Story with only a <code>name</code> prop.</p>
</Story>

<Story exportName="OnlyExportName">
  <p>Story with only an <code>exportName</code> prop.</p>
</Story>

<Story exportName="BothExportNameAndName" name="Both export name and name">
  <p>
    Story with both an <code>exportName</code> and a <code>name</code> prop, "matching"
    each other.
  </p>
</Story>

<Story
  exportName="DifferentExportName"
  name="ExportName and name, but different"
>
  <p>
    Story with both an <code>exportName</code> and a <code>name</code> prop, not
    matching each other.
  </p>
</Story>
