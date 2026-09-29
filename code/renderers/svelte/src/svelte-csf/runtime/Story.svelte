<script
  lang="ts"
  generics="TArgs extends Record<string, any>, TCmp extends Cmp, TChildren extends Snippet = Snippet"
>
  import type { Snippet } from 'svelte';

  import { useStoriesExtractor } from './contexts/extractor.svelte.js';
  import { useStoryRenderer } from './contexts/renderer.svelte.js';

  import { storyNameToExportName } from '../utils/identifier-utils.js';
  import type { Cmp, StoryAnnotations, StoryContext } from '../types.js';
  import { SVELTE_CSF_V4_TAG } from '../constants.js';

  type Props = Partial<StoryAnnotations<TArgs, TCmp>> & {
    /**
     * @deprecated
     * Use `exportName` instead.
     */
    id?: never;
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
    ) &
    (
      | {
          /**
           * Children to pass to the story's component
           * Or if `asChild` is true, the content to render in the story as **static** markup.
           */
          children?: TChildren;
          /**
           * Make the children the actual story content. This is useful when you want to create a **static story**.
           */
          asChild?: boolean;
          template?: never;
        }
      | {
          children?: never;
          asChild?: never;
          /**
           * The content to render in the story with a snippet taking `args` and `storyContext` as parameters
           *
           * NOTE: Can be omitted if a default template is set with [`render`](https://github.com/storybookjs/addon-svelte-csf/blob/main/README.md#default-snippet)
           */
          template?: Snippet<[TArgs, StoryContext<TArgs>]>;
        }
    );
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

  const isLegacyStory = $derived(
    renderer.storyContext.tags?.some((tag) => tag === SVELTE_CSF_V4_TAG) ?? false
  );
</script>

{#if isCurrentlyViewed}
  {#if isSnippet(template)}
    {@render template(renderer.args as TArgs, renderer.storyContext as any)}
  {:else if isSnippet(children)}
    {#if asChild || isLegacyStory}
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
      <a href="https://github.com/storybookjs/addon-svelte-csf#defining-stories" target="_blank"
        >the docs</a
      > on how to define stories.
    </p>
  {/if}
{/if}
