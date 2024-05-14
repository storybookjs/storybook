<script lang="ts" generics="Component extends SvelteComponent">
  /**
   * @component
   * @wrapper
   */
  import type { Args, StoryContext } from '@storybook/svelte';
  import type { StoryName } from '@storybook/types';
  import type { ComponentProps, ComponentType, SvelteComponent } from 'svelte';

  import { useStoryRendererContext } from './context.svelte.js';

  type Props = {
    Stories: Component extends SvelteComponent ? ComponentType<SvelteComponent> : never;
    storyName: StoryName;
    templateId: string | undefined;
    args: Args;
    storyContext: StoryContext<ComponentProps<Component>>;
  };

  let { Stories, storyName, templateId, storyContext, args }: Props = $props();

  const context = useStoryRendererContext<Component>();

  // FIXME: Figure the purpose of this one
  // events are static and don't need to be reactive
  // const events = storyContext?.argTypes
  //   ? Object.fromEntries(
  //       Object.entries(storyContext?.argTypes)
  //         .filter(([k, v]) => v.action && args?.[k] != null)
  //         .map(([k, v]) => [v.action, args?.[k]])
  //     )
  //   : {};

  $effect(() => {
    context.set({
      currentStoryName: storyName,
      currentTemplateId: templateId,
      componentAnnotations: { args },
      storyContext,
    });
  });
</script>

<svelte:component this={Stories} />
