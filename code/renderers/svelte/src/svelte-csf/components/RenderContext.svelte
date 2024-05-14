<script lang="ts" generics="Component extends SvelteComponent">
  /**
   * @component
   * @wrapper
   */
  import type { StoryContext } from '@storybook/svelte';
  import type { ComponentProps, SvelteComponent, ComponentType } from 'svelte';

  import { createRenderContext, setRenderContext, type AddonStoryObj } from './context.js';

  type Props = AddonStoryObj<Component> & {
    Stories: ComponentType<SvelteComponent<ComponentProps<Component>>>;
    storyContext: StoryContext<ComponentProps<Component>>;
  };

  let { Stories, args, name, templateId, storyContext, ...restProps }: Props = $props();

  $inspect({ Stories, storyContext, rest: Object.entries(restProps) }).with(console.trace);

  createRenderContext<Component>({ render: true });

  // events are static and don't need to be reactive
  // const events = storyContext?.argTypes
  //   ? Object.fromEntries(
  //       Object.entries(storyContext?.argTypes)
  //         .filter(([k, v]) => v.action && args?.[k] != null)
  //         .map(([k, v]) => [v.action, args?.[k]])
  //     )
  //   : {};

  $effect(() => {
    console.log('RenderContext', { Stories, args, templateId, name, storyContext });
    setRenderContext<Component>({
      args,
      storyContext,
      currentTemplateId: templateId,
      currentStoryName: name,
    });
  });
</script>

<svelte:component this={Stories} />
