<script lang="ts">
  /**
   * This component is to support deprecated legacy component - `Template`,
   * and this component functionality is just a "mock".
   * E.g. to allow user still have typing experience.
   * Vite pre-transform hook does codemod where this component gets transformed into Svelte v5 SnippetBlock.
   */

  import { type StoryRendererContext } from './contexts/renderer.svelte';

  export let id: string = 'default';
  // silents the Svelte warning about 'id' being unused. It's only here for typing purposes.
  const silentWarningAboutId = id;

  let args: StoryRendererContext['storyContext'];
  let context: StoryRendererContext['args'];
</script>

<slot {context} {args} />
