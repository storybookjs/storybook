<script lang="ts" generics="Component extends SvelteComponent">
  /**
   * @component
   * @wrapper
   */
  import type { Args, StoryContext } from '@storybook/svelte';
  import type { ComponentProps, SvelteComponent } from 'svelte';

  import { useStoryRendererContext } from './context.svelte.js';

  type Props = {
    templateId: string | undefined;
    name: string;
    Stories: Component;
    args: Args;
    storyContext: StoryContext<ComponentProps<Component>>;
  };

  let { name, Stories, storyContext, templateId, args }: Props = $props();

  $inspect({ name, Stories, storyContext, templateId, args }).with(console.error);

  const contextRenderer = useStoryRendererContext<Component>();

  // FIXME: Figure the purpose of this one
  // events are static and don't need to be reactive
  // const events = storyContext?.argTypes
  //   ? Object.fromEntries(
  //       Object.entries(storyContext?.argTypes)
  //         .filter(([k, v]) => v.action && args?.[k] != null)
  //         .map(([k, v]) => [v.action, args?.[k]])
  //     )
  //   : {};

  $effect.pre(() => {
    contextRenderer.set({
      componentAnnotations: { args },
      storyContext,
      templateId,
      storyName: name,
    });
  });

  // FIXME:
  // This is a temporary workaround,
  // `<svelte:component>` requires to pass the props,
  // but we're passing the props via Svelte's context
  const p = {} as ComponentProps<typeof Stories>;
</script>

<!-- FIXME: Possibly upstream issue (`svelte`), needs inspection -->
<svelte:component this={Stories} {...p} />
