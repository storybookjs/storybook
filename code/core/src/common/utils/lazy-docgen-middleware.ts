import type {
  DocgenMiddleware,
  DocgenPayload,
  DocgenProvider,
  DocgenProviderInput,
} from '../../shared/open-service/services/docgen/types.ts';
import { STORY_FILE_TEST_REGEXP, getStoryImportPathFromEntry } from './select-component-entry.ts';

export interface LazyDocgenMiddlewareOptions<TManager> {
  /**
   * Story file paths this middleware extracts from; any other path passes through.
   * Defaults to CSF story files, so a renderer with its own story format (e.g. `.stories.svelte`)
   * must widen it.
   */
  storyFileTest?: RegExp;
  /**
   * Builds the renderer's extraction manager.
   * Called once, lazily, on the first eligible request and memoized for the worker's lifetime.
   * Return `undefined` to permanently pass through to the rest of the chain.
   */
  createManager: () => Promise<TManager | undefined>;
  /**
   * Extracts one payload
   * Returns `undefined` to delegate the request downstream
   */
  extract: (manager: TManager, input: DocgenProviderInput) => Promise<DocgenPayload | undefined>;
}

export function createLazyDocgenMiddleware<TManager>({
  storyFileTest = STORY_FILE_TEST_REGEXP,
  createManager,
  extract,
}: LazyDocgenMiddlewareOptions<TManager>): DocgenMiddleware {
  let managerPromise: Promise<TManager | undefined> | undefined;
  const getManager = () => (managerPromise ??= createManager());

  return (nextDocgen: DocgenProvider): DocgenProvider =>
    async (input) => {
      const storyImportPath = getStoryImportPathFromEntry(input.entry);
      if (!storyImportPath || !storyFileTest.test(storyImportPath)) {
        return nextDocgen(input);
      }

      const manager = await getManager();
      if (!manager) {
        return nextDocgen(input);
      }

      const ours = await extract(manager, input);
      if (!ours) {
        return nextDocgen(input);
      }

      const downstream = await nextDocgen(input);
      return { ...downstream, ...ours };
    };
}
