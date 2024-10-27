<script lang="ts">
  /**
   * This component is to support deprecated legacy component - `Story`,
   * and this component functionality is just a "mock".
   * E.g. to allow user still have typing experience.
   * Vite pre-transform hook does codemod where this component gets transformed into new `Story` component destrucutred from `defineMeta`.
   */
  import type { Component, ComponentProps } from 'svelte';

  import type Story from './Story.svelte';

  import { type StoryRendererContext } from './contexts/renderer.svelte';

  type $$Props = ComponentProps<Story<Component>> & {
    /**
     * Which one of `<Template>` id should be used for rendering this story children?
     * @deprecated use Svelte [snippets]() instead.
     * @see
     */
    template?: string | null;
  };

  let args: $$Props['args'];
  let context: StoryRendererContext['storyContext'];
</script>

<slot {context} {args} />
