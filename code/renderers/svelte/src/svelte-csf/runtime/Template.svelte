<script lang="ts">
  /**
   * This is a legacy template, this functionality is just a "mock".
   * To allow user still have typing experience
   * Vite pre-transform hook does codemod where this component gets transformed into Svelte v5 SnippetBlock.
   */

  import { type StoryRendererContext } from './contexts/renderer.svelte';

  let id: string = 'default';
  let args: StoryRendererContext['storyContext'];
  let context: StoryRendererContext['args'];
</script>

<slot {context} {args} />
