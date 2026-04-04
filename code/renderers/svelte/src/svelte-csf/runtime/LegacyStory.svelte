<!--
@component
This component is to support deprecated legacy component - `Story`,
and this component functionality is just a "mock".
E.g. to allow user still have typing experience.
Vite pre-transform hook does codemod where this component gets transformed into new `Story` component destrucutred from `defineMeta`.

@deprecated
@see {@link https://github.com/storybookjs/addon-svelte-csf/blob/main/MIGRATION.md#export-meta-removed-in-favor-of-definemeta}
-->

<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { StoryProps } from '../legacy-types.d.ts';
  import type { StoryContext } from 'storybook/internal/types';

  interface Props extends StoryProps {
    children?: Snippet<[{ args: any; context: StoryContext }]>;
  }
  const { children }: Props = $props();
</script>

{@render children?.({ args: {} as any, context: {} as StoryContext })}
