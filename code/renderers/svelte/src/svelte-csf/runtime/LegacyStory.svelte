<script lang="ts">
  /**
   * This component is to support deprecated legacy component - `Story`,
   * and this component functionality is just a "mock".
   * E.g. to allow user still have typing experience.
   * Vite pre-transform hook does codemod where this component gets transformed into new `Story` component destrucutred from `defineMeta`.
   */
  import type { Component, ComponentProps } from 'svelte';
  import type { EmptyObject } from 'type-fest';

  import type Story from './Story.svelte';

  import { type StoryRendererContext } from '#runtime/contexts/renderer.svelte';
  import type { Meta } from '#types';
  import { LegacyTemplateNotEnabledError } from '#utils/error/codemod/index';

  type Props = ComponentProps<Story<EmptyObject, Component, Meta<Component>>> & {
    /**
     * Which one of `<Template>` id should be used for rendering this story children?
     */
    template?: string | null;
  };

  let { args }: Props = $props();

  let context: StoryRendererContext['storyContext'];

  throw new LegacyTemplateNotEnabledError('Story');
</script>

<slot {context} {args} />
