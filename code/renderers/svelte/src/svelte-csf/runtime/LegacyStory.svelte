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
  import type { Component, ComponentProps } from 'svelte';

  import type Story from './Story.svelte';

  import { type StoryRendererContext } from './contexts/renderer.svelte';

  type $$Props = Omit<ComponentProps<Story<Component>>, 'autodocs' | 'source'> & {
    /**
     * Which one of `<Template>` id should be used for rendering this story children?
     * @deprecated use Svelte [snippets]() instead.
     * @see
     */
    template?: string | null;
    /**
     * @deprecrated
     * Use `tags={['autodocs']}` instead.
     * @see {@link https://github.com/storybookjs/addon-svelte-csf/blob/main/MIGRATION.md#story-prop-autodocs-has-been-removed}
     */
    autodocs?: boolean;
    /**
     * @deprecated
     * Use `parameters={{ docs: { source: { code: "..." } } }}` instead.
     * @see {@link https://github.com/storybookjs/addon-svelte-csf/blob/next/MIGRATION.md#story-prop-source-has-been-removed}
     */
    source?: boolean | string;
  };

  let args: $$Props['args'];
  let context: StoryRendererContext['storyContext'];
</script>

<slot {context} {args} />
