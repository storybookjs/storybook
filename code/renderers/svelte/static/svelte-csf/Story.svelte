<script
  lang="ts"
  generics="TArgs extends Record<string, any>, TCmp extends Cmp, TChildren extends Snippet = Snippet"
>
  import type { Snippet } from 'svelte';

  import { useStoriesExtractor } from '@storybook/svelte/internal/svelte-csf/contexts/extractor';
  import { useStoryRenderer } from '@storybook/svelte/internal/svelte-csf/contexts/renderer';

  import { storyNameToExportName } from '@storybook/svelte/internal/svelte-csf/component-helpers';
  import type { Cmp, StoryProps } from '@storybook/svelte/internal/svelte-csf/component-helpers';

  type Props = StoryProps<TArgs, TCmp, TChildren>;
  let {
    children,
    name,
    exportName: exportNameProp,
    play,
    template,
    asChild = false,
    ...restProps
  }: Props = $props();
  const exportName = exportNameProp ?? storyNameToExportName(name!);

  let extractor = useStoriesExtractor<TCmp>();
  let renderer = useStoryRenderer<TCmp>();

  let isCurrentlyViewed = $derived(
    !extractor.isExtracting && renderer.currentStoryExportName === exportName
  );

  if (extractor.isExtracting) {
    extractor.register({ children, name, exportName, play, ...restProps } as Parameters<
      (typeof extractor)['register']
    >[0]);
  }

  function injectIntoPlayFunction(
    storyContext: typeof renderer.storyContext,
    playToInject: typeof play
  ) {
    if (playToInject && storyContext.playFunction) {
      storyContext.playFunction.__play = playToInject;
    }
  }

  // TODO: Svelte maintainers is still discussing internally if they want to implement official typeguard function.
  // Keep a pulse on this case and then this can be replaced.
  function isSnippet<T extends unknown[]>(value: unknown): value is Snippet<T> {
    return typeof value === 'function';
  }

  $effect(() => {
    if (isCurrentlyViewed) {
      injectIntoPlayFunction(renderer.storyContext, play);
    }
  });
</script>

{#if isCurrentlyViewed}
  {#if isSnippet(template)}
    {@render template(renderer.args as TArgs, renderer.storyContext as any)}
  {:else if isSnippet(children)}
    {#if asChild}
      {@render children()}
    {:else if renderer.storyContext.component}
      {/* @ts-ignore */ null}
      <renderer.storyContext.component {...renderer.args} {children} />
    {:else}
      {@render children()}
    {/if}
  {:else if renderer.metaRenderSnippet}
    {@render renderer.metaRenderSnippet(renderer.args, renderer.storyContext)}
  {:else if renderer.storyContext.component}
    {/* @ts-ignore */ null}
    <renderer.storyContext.component {...renderer.args} />
  {:else}
    <p>
      No story rendered. See
      <a href="https://storybook.js.org/docs/writing-stories?renderer=svelte" target="_blank"
        >the docs</a
      > on how to define stories.
    </p>
  {/if}
{/if}
