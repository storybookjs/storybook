<script lang="ts" generics="Component extends SvelteComponent">
  /**
   * @component
   * @wrapper
   */
  import type { StoryContext } from '@storybook/svelte';
  import type { ComponentProps, SvelteComponent, ComponentType } from 'svelte';

  import { type AddonStoryObj, useStoryRenderContext } from './context.svelte.js';

  type Props = AddonStoryObj<Component> & {
    Stories: ComponentType<SvelteComponent<ComponentProps<Component>>>;
    storyContext: StoryContext<ComponentProps<Component>>;
  };

  let { Stories, args, name, templateId, storyContext }: Props = $props();

  $inspect({ Stories, storyContext, args, name, templateId }).with(console.trace);

  const context = useStoryRenderContext<Component>();

  // TODO: Figure the purpose of this one
  // events are static and don't need to be reactive
  const events = storyContext?.argTypes
    ? Object.fromEntries(
        Object.entries(storyContext?.argTypes)
          .filter(([k, v]) => v.action && args?.[k] != null)
          .map(([k, v]) => [v.action, args?.[k]])
      )
    : {};

  $effect(() => {
    context.set({
      // FIXME: Figure this one out
      args,
      storyContext,
      templateId,
      storyName: name,
    });
  });
</script>

<svelte:component this={Stories} {...events} />
