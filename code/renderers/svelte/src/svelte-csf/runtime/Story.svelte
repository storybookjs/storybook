<script lang="ts" generics="TOverrideArgs = unknown, const TMeta extends Meta = Meta">
  import type { StoryObj } from '@storybook/svelte';
  import type { ComponentType, Snippet } from 'svelte';

  import type { Meta } from '#types';

  import { useStoriesExtractor } from '#runtime/contexts/extractor.svelte';
  import { useStoryRenderer, type StoryRendererContext } from '#runtime/contexts/renderer.svelte';
  import { useStoriesTemplate } from '#runtime/contexts/template.svelte';

  import { storyNameToExportName } from '#utils/identifier-utils';

  type SnippetSchildrenArgs = [
    StoryRendererContext<TMeta>['args'],
    StoryRendererContext<TMeta>['storyContext'],
  ];

  type Props = {
    /**
     * The content to render in the story, either as:
     * 1. A snippet taking args and storyContext as parameters
     * 2. Static markup
     * Can be omitted if a default template is set with setTemplate()
     *
     */
    children?: Snippet<SnippetSchildrenArgs>;
    /**
     * Name of the story. Can be omitted if `exportName` is provided.
     */
    name?: string;
    /**
     * exportName of the story.
     * If not provided, it will be generated from the 'name', by converting it to a valid, PascalCased JS variable name.
     * eg. 'My story!' -> 'MyStory'
     *
     * Use this prop to explicitly set the export name of the story. This is useful if you have multiple stories with the names
     * that result in duplicate export names like "My story" and "My story!".
     * It's also useful for explicitly defining the export that can be imported in MDX docs.
     */
    exportName?: string;
    /**
     * @deprecrated
     * Use `tags={['autodocs']}` instead.
     */
    autodocs?: never;
    /**
     * @deprecated
     * Use `parameters={{ docs: { source: { code: "..." } } }}` instead.
     */
    source?: never;
    /**
     * The args for the story
     */
    // args?: SnippetsToPrimitives<Omit<StoryObj<TMeta>['args'], keyof TOverrideArgs> & TOverrideArgs>;
  } & StoryObj<TMeta>;

  const { children, name, exportName: exportNameProp, play, ...restProps }: Props = $props();
  const exportName = exportNameProp ?? storyNameToExportName(name!);

  const extractor = useStoriesExtractor<TMeta>();
  const renderer = useStoryRenderer<TMeta>();
  const template = useStoriesTemplate<TMeta>();

  const isCurrentlyViewed = $derived(
    !extractor.isExtracting && renderer.currentStoryExportName === exportName
  );

  if (extractor.isExtracting) {
    extractor.register({ ...restProps, exportName, play } as unknown as StoryObj<TMeta> & {
      exportName: string;
    });
  }

  function injectIntoPlayFunction(
    storyContext: typeof renderer.storyContext,
    playToInject: typeof play
  ) {
    if (playToInject && storyContext.playFunction) {
      storyContext.playFunction.__play = playToInject;
    }
  }

  $effect(() => {
    if (isCurrentlyViewed) {
      injectIntoPlayFunction(renderer.storyContext, play);
    }
  });
</script>

{#if isCurrentlyViewed}
  {#if children}
    {@render children(renderer.args, renderer.storyContext)}
  {:else if template}
    {@render template(renderer.args, renderer.storyContext)}
  {:else if renderer.storyContext.component}
    <svelte:component this={renderer.storyContext.component as ComponentType} {...renderer.args} />
  {:else}
    <p>Warning: no story rendered. improve this message</p>
  {/if}
{/if}
