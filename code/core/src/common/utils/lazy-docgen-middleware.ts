import type {
  DocgenMiddleware,
  DocgenPayload,
  DocgenProvider,
  DocgenProviderInput,
} from '../../shared/open-service/services/docgen/types.ts';
import { STORY_FILE_TEST_REGEXP, getStoryImportPathFromEntry } from './select-component-entry.ts';

interface BaseOptions<TManager> {
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
}

interface ExtractOption<TManager> {
  /**
   * Extracts one payload
   * Returns `undefined` to delegate the request downstream
   */
  extract: (manager: TManager, input: DocgenProviderInput) => Promise<DocgenPayload | undefined>;
  extractBatch?: undefined;
}

interface ExtractBatchOption<TManager> {
  extract?: undefined;
  /**
   * Extracts the requests that arrived close together in one call. Settles one result per input,
   * in the same order; a fulfilled `undefined` delegates that request downstream. For a renderer
   * with setup that the components of a static build or an extract-all share.
   */
  extractBatch: (manager: TManager, inputs: DocgenProviderInput[]) => Promise<DocgenResult[]>;
}

export type LazyDocgenMiddlewareOptions<TManager> = BaseOptions<TManager> &
  (ExtractOption<TManager> | ExtractBatchOption<TManager>);

export type DocgenResult = PromiseSettledResult<DocgenPayload | undefined>;

interface Queued {
  input: DocgenProviderInput;
  resolve: (payload: DocgenPayload | undefined) => void;
  reject: (reason: unknown) => void;
}

const startAfterThisEventLoopTurn = (start: () => void) => setImmediate(start);

function createBatcher(extractBatch: (inputs: DocgenProviderInput[]) => Promise<DocgenResult[]>) {
  let queue: Queued[] = [];
  let running = false;

  const runBatchesUntilQueueIsEmpty = async () => {
    while (queue.length > 0) {
      const batch = queue;
      queue = [];
      try {
        const results = await extractBatch(batch.map(({ input }) => input));
        batch.forEach(({ resolve, reject }, index) => {
          const result = results[index];
          if (result.status === 'fulfilled') {
            resolve(result.value);
          } else {
            reject(result.reason);
          }
        });
      } catch (error) {
        batch.forEach(({ reject }) => reject(error));
      }
    }
    running = false;
  };

  return (input: DocgenProviderInput) =>
    new Promise<DocgenPayload | undefined>((resolve, reject) => {
      queue.push({ input, resolve, reject });
      if (!running) {
        running = true;
        startAfterThisEventLoopTurn(runBatchesUntilQueueIsEmpty);
      }
    });
}

export function createLazyDocgenMiddleware<TManager>({
  storyFileTest = STORY_FILE_TEST_REGEXP,
  createManager,
  extract,
  extractBatch,
}: LazyDocgenMiddlewareOptions<TManager>): DocgenMiddleware {
  let managerPromise: Promise<TManager | undefined> | undefined;
  const getManager = () => (managerPromise ??= createManager());
  let batcher: ReturnType<typeof createBatcher> | undefined;

  const extractOne = (manager: TManager, input: DocgenProviderInput) => {
    if (extract) {
      return extract(manager, input);
    }
    batcher ??= createBatcher((inputs) => extractBatch(manager, inputs));
    return batcher(input);
  };

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

      const ours = await extractOne(manager, input);
      if (!ours) {
        return nextDocgen(input);
      }

      const downstream = await nextDocgen(input);
      return { ...downstream, ...ours };
    };
}
