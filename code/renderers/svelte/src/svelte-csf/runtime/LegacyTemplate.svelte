<script lang="ts">
  /**
   * This component is to support deprecated legacy component - `Template`,
   * and this component functionality is just a "mock".
   * E.g. to allow user still have typing experience.
   * Vite pre-transform hook does codemod where this component gets transformed into Svelte v5 SnippetBlock.
   */
  import { LegacyTemplateNotEnabledError } from '#utils/error/codemod/index';

  import { type StoryRendererContext } from './contexts/renderer.svelte';

  export let id: string = 'default';

  let args: StoryRendererContext['storyContext'];
  let context: StoryRendererContext['args'];

  throw new LegacyTemplateNotEnabledError('Template');
</script>

<slot {context} {args} />
