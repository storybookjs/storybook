<script lang="ts">
  import type { Snippet } from 'svelte';

  import { useStoryRenderer, type StoryRendererContext } from './contexts/renderer.svelte';

  interface Props {
    /**
     * The content of template to be rendered inside the `<Story />`
     */
    children: Snippet<
      [
        //
        StoryRendererContext['args'],
        StoryRendererContext['storyContext'],
      ]
    >;
    /**
     * Unique id of template - to be used in `<Story templateId={id} />`
     * @default id
     */
    id?: string;
  }

  const renderer = useStoryRenderer();

  let { children, id = 'default' }: Props = $props();
</script>

{@render children(renderer.args, renderer.storyContext)}
