<script lang="ts" generics="TMeta extends Meta">
  import { storyNameToExportName } from '../utils/identifier-utils.js';

  import type { Meta, StoryObj, StoryContext } from '@storybook/svelte';
  import type { Snippet } from 'svelte';

  import { useStoriesExtractor } from './contexts/extractor.svelte.js';
  import { useStoryRenderer } from './contexts/renderer.svelte.js';
  import { useStoriesTemplate } from './contexts/template.svelte.js';

  type Props = {
    /**
     * The content to render in the story, either as:
     * 1. A snippet taking args and storyContext as parameters
     * 2. Static markup
     * Can be omitted if a default template is set with setTemplate() 
     * 
     */
    children?: Snippet<[StoryObj<TMeta>["args"], StoryContext<TMeta["args"]>]>;
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
     * Is recommended to use `parameters={{ docs: { source: { code: "..." } } }}` instead, to follow Regular CSF.
     * WARNING: This is under consideration to be revamped.
     * Ref: https://github.com/storybookjs/addon-svelte-csf/pull/181#issuecomment-2130744977
     *
     * Specify which sources should be shown.
     *
     * By default, sources for an args story are auto-generated.
     *
     * TODO:
     * I am still confused on what is exactly supposed to happen/output when it's a boolean?
     * For now this is not implemented, and I've created a warning when it happens.
     *
     * If source is true, then the source of the story will be used instead.
     * If source is a string, it replaces the source of the story.
     */
    source?: boolean | string;
  } & StoryObj<TMeta>;

  const { children, name, exportName: exportNameProp, play, ...restProps }: Props = $props();
  const exportName = exportNameProp ?? storyNameToExportName(name!)

  const extractor = useStoriesExtractor<TMeta>();
  const renderer = useStoryRenderer<TMeta>();
  const template = useStoriesTemplate<TMeta>();
  

  const isCurrentlyViewed = $derived(!extractor.isExtracting && renderer.currentStoryExportName === exportName);

  if (extractor.isExtracting) {
    extractor.register({ ...restProps, exportName, play } as unknown as  StoryObj<TMeta> & { exportName: string });
  }

  function injectIntoPlayFunction(storyContext: typeof renderer.storyContext, playToInject: typeof play) {
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
    <!-- TODO: there's a risk here that this discards decorators -->
    <svelte:component this={renderer.storyContext.component} {...renderer.args} />
  {:else}
    <p>Warning: no story rendered. improve this message</p>
  {/if}
{/if}
