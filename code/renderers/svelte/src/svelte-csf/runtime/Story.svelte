<script lang="ts" generics="const TCmp extends Cmp">
  import type { Snippet } from 'svelte';

  import { useStoriesExtractor } from './contexts/extractor.svelte';
  import { useStoryRenderer, type StoryRendererContext } from './contexts/renderer.svelte';
  import { useStoriesTemplate } from './contexts/template.svelte';

  import { storyNameToExportName } from '../utils/identifier-utils';
  import type { Cmp, StoryAnnotations } from '../types';

  type Props = Partial<StoryAnnotations<TCmp>> & {
    /**
     * @deprecated
     * Use `exportName` instead.
     */
    id?: never;
    /**
     * The content to render in the story, either as:
     * 1. A snippet taking args and storyContext as parameters
     * 2. Static markup
     *
     * Can be omitted if a default template is set with [`setTemplate()`](https://github.com/storybookjs/addon-svelte-csf/blob/main/README.md#default-snippet)
     */
    children?: Snippet<
      /* prettier ignore */
      [StoryRendererContext<TCmp>['args'], StoryRendererContext<TCmp>['storyContext']]
    >;
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
     * @see {@link https://github.com/storybookjs/addon-svelte-csf/blob/main/MIGRATION.md#story-prop-autodocs-has-been-removed}
     */
    autodocs?: never;
    /**
     * @deprecated
     * Use `parameters={{ docs: { source: { code: "..." } } }}` instead.
     * @see {@link https://github.com/storybookjs/addon-svelte-csf/blob/next/MIGRATION.md#story-prop-source-has-been-removed}
     */
    source?: never;
  } & (
      | {
          /**
           * exportName of the story.
           * If not provided, it will be generated from the 'name', by converting it to a valid, PascalCased JS variable name.
           * eg. 'My story!' -> 'MyStory'
           *
           * Use this prop to explicitly set the export name of the story. This is useful if you have multiple stories with the names
           * that result in duplicate export names like "My story" and "My story!".
           * It's also useful for explicitly defining the export that can be imported in MDX docs.
           */
          exportName: string;
        }
      | {
          /**
           * Name of the story. Can be omitted if `exportName` is provided.
           */
          name: string;
        }
    );

  const { children, name, exportName: exportNameProp, play, ...restProps }: Props = $props();
  const exportName = exportNameProp ?? storyNameToExportName(name!);

  const extractor = useStoriesExtractor<TCmp>();
  const renderer = useStoryRenderer<TCmp>();
  const template = useStoriesTemplate<TCmp>();

  const isCurrentlyViewed = $derived(
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
    <renderer.storyContext.component {...renderer.args} />
  {:else}
    <p>
      No story rendered. See <a
        href="https://github.com/storybookjs/addon-svelte-csf#defining-stories"
        target="_blank">the docs</a
      > on how to define stories.
    </p>
  {/if}
{/if}
