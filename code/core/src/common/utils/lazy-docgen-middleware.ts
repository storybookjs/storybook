import type {
  DocgenMiddleware,
  DocgenPayload,
  DocgenProvider,
  DocgenProviderInput,
} from '../../shared/open-service/services/docgen/types.ts';
import { STORY_FILE_TEST_REGEXP, getStoryImportPathFromEntry } from './select-component-entry.ts';

export interface LazyDocgenMiddlewareOptions<TManager> {
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
  createManager,
  extract,
}: LazyDocgenMiddlewareOptions<TManager>): DocgenMiddleware {
  let managerPromise: Promise<TManager | undefined> | undefined;
  const getManager = () => (managerPromise ??= createManager());

  return (nextDocgen: DocgenProvider): DocgenProvider =>
    async (input) => {
      const storyImportPath = getStoryImportPathFromEntry(input.entry);
      if (!storyImportPath || !STORY_FILE_TEST_REGEXP.test(storyImportPath)) {
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
