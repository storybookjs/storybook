<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Comparison from './Comparison.svelte';

  /**
   * A quick overview on how to write a stories file using **Svelte CSF** format.
   *
   * ```svelte
   * <script module>
   *   import { defineMeta } from "@storybook/addon-svelte-csf";
   *
   *   import Comparison from "./Comparison.svelte";
   *
   *   const { Story } = defineMeta({
   *     title: "Comparison/Svelte CSF",
   *     component: Comparison,
   * });
   * <\/script>
   *
   * <Story name="Default" args={{ csf: "svelte" }} />
   * ```
   */
  const { Story } = defineMeta({
    title: 'Comparison/Svelte CSF',
    component: Comparison,
    argTypes: {
      csf: { table: { disable: true } },
      system: { table: { disable: true } },
    },
    parameters: {
      controls: { disable: true },
      interactions: { disable: true },
    },
    tags: ['autodocs', '!dev'],
  });
</script>

<Story name="Default" args={{ csf: 'svelte' }} tags={['!dev']} />
