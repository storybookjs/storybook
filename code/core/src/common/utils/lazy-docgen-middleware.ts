import type {
  DocgenMiddleware,
  DocgenPayload,
  DocgenProvider,
  DocgenProviderInput,
  DocgenResult,
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
   * Extracts every input whose story file matched, settling one result per input in the same
   * order. A fulfilled `undefined` delegates that input downstream. Setup that the inputs share
   * goes at the start of this one call.
   */
  extract: (manager: TManager, inputs: DocgenProviderInput[]) => Promise<DocgenResult[]>;
  /**
   * Combines this middleware's payload with the payload of the rest of the chain.
   * Defaults to `{ ...downstream, ...own }`.
   */
  merge?: (own: DocgenPayload, downstream: DocgenPayload | undefined) => DocgenPayload;
}

/** Extract the inputs one after another, settling each on its own. */
export async function extractEach<TInput>(
  inputs: TInput[],
  extractOne: (input: TInput) => Promise<DocgenPayload | undefined>
): Promise<DocgenResult[]> {
  const results: DocgenResult[] = [];
  for (const input of inputs) {
    try {
      results.push({ status: 'fulfilled', value: await extractOne(input) });
    } catch (reason) {
      results.push({ status: 'rejected', reason });
    }
  }
  return results;
}

export function createLazyDocgenMiddleware<TManager>({
  storyFileTest = STORY_FILE_TEST_REGEXP,
  createManager,
  extract,
  merge = (own, downstream) => ({ ...downstream, ...own }),
}: LazyDocgenMiddlewareOptions<TManager>): DocgenMiddleware {
  let managerPromise: Promise<TManager | undefined> | undefined;
  const getManager = () => (managerPromise ??= createManager());

  return (nextDocgen: DocgenProvider): DocgenProvider =>
    async (inputs) => {
      const matched = inputs.filter((input) => {
        const storyImportPath = getStoryImportPathFromEntry(input.entry);
        return !!storyImportPath && storyFileTest.test(storyImportPath);
      });
      const manager = matched.length > 0 ? await getManager() : undefined;
      const ourResults = manager ? await extract(manager, matched) : [];
      const ours = new Map(matched.map((input, index) => [input, ourResults[index]]));

      const downstream = await nextDocgen(inputs);
      return inputs.map((input, index): DocgenResult => {
        const own = ours.get(input);
        const next = downstream[index];
        if (own?.status === 'rejected') {
          return own;
        }
        const payload = own?.value;
        if (!payload || next.status === 'rejected') {
          return next;
        }
        return { status: 'fulfilled', value: merge(payload, next.value) };
      });
    };
}
