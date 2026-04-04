<!--
@component
This component is to support deprecated legacy component - `Template`,
and this component functionality is just a "mock".
E.g. to allow user still have typing experience.
Vite pre-transform hook does codemod where this component gets transformed into Svelte v5 snippet block.

@deprecated
@see {@link https://github.com/storybookjs/addon-svelte-csf/blob/main/MIGRATION.md#template-component-removed}
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { TemplateProps } from '../legacy-types.d.ts';
  import type { StoryContext } from 'storybook/internal/types';

  interface Props extends TemplateProps {
    children?: Snippet<[{ args: any; context: StoryContext }]>;
  }
  const { id = 'default', children }: Props = $props();
  void id;
</script>

{@render children?.({ args: {} as any, context: {} as StoryContext })}
