/**
 * Worker-thread entry point for docgen extraction.
 *
 * Spawned once by {@link ./docgen-worker-client.ts} and kept alive for the dev server's lifetime so
 * the TypeScript program(s) each provider builds stay warm across requests. On `init` it imports
 * every {@link DocgenProviderDescriptor}'s module and folds them into a single provider chain; on
 * `extract` it runs that chain for one component and posts the resulting payload back; on
 * `summarize` it asks the modules' summary providers for every listed component. Running here
 * keeps the synchronous, CPU-bound TypeScript work off the main event loop so it never starves the
 * Vite dev server during first render.
 */
import { parentPort } from 'node:worker_threads';
import { pathToFileURL } from 'node:url';

import { logger } from 'storybook/internal/node-logger';

import type { IndexEntry } from '../../../../../types/modules/indexer.ts';
import { errorToErrorLike } from '../../module-graph/types.ts';
import type {
  DocgenMiddleware,
  DocgenProvider,
  DocgenProviderDescriptor,
  DocgenSummaryProvider,
  DocgenWorkerModule,
} from '../types.ts';
import type {
  DocgenWorkerInitRequest,
  DocgenWorkerRequest,
  DocgenWorkerResponse,
} from './protocol.ts';
import { createSummarizer } from './summarize.ts';

if (!parentPort) {
  throw new Error('docgen worker must be run as a worker thread');
}

// Capture into a const so TypeScript keeps the non-null narrowing inside the async handlers and the
// message listener below (it won't narrow the mutable `parentPort` binding across those closures).
const port = parentPort;

/** Identity provider that seeds the chain; the bottom of the stack has no docgen to contribute. */
const seedProvider: DocgenProvider = async () => undefined;

type Chain = { provider: DocgenProvider; summarize: ReturnType<typeof createSummarizer> };

/** Resolved once per worker on `init`; every `extract` and `summarize` awaits it. */
let chainPromise: Promise<Chain> | undefined;

async function composeChain(descriptors: DocgenProviderDescriptor[]): Promise<Chain> {
  let provider = seedProvider;
  const summaryProviders: (DocgenSummaryProvider | undefined)[] = [];
  for (const descriptor of descriptors) {
    const moduleUrl = pathToFileURL(descriptor.moduleSpecifier).href;
    const mod = (await import(moduleUrl)) as Partial<DocgenWorkerModule>;
    if (typeof mod.createDocgenProvider !== 'function') {
      throw new Error(
        `docgen worker module "${descriptor.moduleSpecifier}" does not export createDocgenProvider`
      );
    }
    const middleware: DocgenMiddleware = await mod.createDocgenProvider(descriptor.options);
    provider = middleware(provider);
    try {
      summaryProviders.push(await mod.createSummaryProvider?.(descriptor.options));
    } catch (error) {
      // The module still extracts docgen, and a listing without summaries reads them from that.
      logger.warn(
        `docgen worker module "${descriptor.moduleSpecifier}" cannot summarize components: ${error}`
      );
      summaryProviders.push(undefined);
    }
  }
  return { provider, summarize: createSummarizer(summaryProviders) };
}

async function handleInit({ descriptors, logLevel }: DocgenWorkerInitRequest): Promise<void> {
  try {
    // Provider modules share this logger instance, so set the forwarded level before importing them.
    logger.setLogLevel(logLevel);
    chainPromise = composeChain(descriptors);
    await chainPromise;
    port.postMessage({ type: 'init' } satisfies DocgenWorkerResponse);
  } catch (error) {
    chainPromise = undefined;
    port.postMessage({
      type: 'init',
      error: errorToErrorLike(error),
    } satisfies DocgenWorkerResponse);
  }
}

async function handleExtract(id: number, entry: IndexEntry): Promise<void> {
  try {
    if (!chainPromise) {
      throw new Error('docgen worker received an extract request before init');
    }
    const { provider } = await chainPromise;
    const payload = await provider({ entry });
    port.postMessage({ type: 'extract', id, payload } satisfies DocgenWorkerResponse);
  } catch (error) {
    port.postMessage({
      type: 'extract',
      id,
      error: errorToErrorLike(error),
    } satisfies DocgenWorkerResponse);
  }
}

async function handleSummarize(id: number, entries: IndexEntry[]): Promise<void> {
  try {
    if (!chainPromise) {
      throw new Error('docgen worker received a summarize request before init');
    }
    const { summarize } = await chainPromise;
    const summaries = await summarize?.(entries);
    port.postMessage({ type: 'summarize', id, summaries } satisfies DocgenWorkerResponse);
  } catch (error) {
    port.postMessage({
      type: 'summarize',
      id,
      error: errorToErrorLike(error),
    } satisfies DocgenWorkerResponse);
  }
}

port.on('message', (msg: DocgenWorkerRequest) => {
  switch (msg.type) {
    case 'init':
      void handleInit(msg);
      return;
    case 'extract':
      void handleExtract(msg.id, msg.entry);
      return;
    case 'summarize':
      void handleSummarize(msg.id, msg.entries);
      return;
    default: {
      const _exhaustive: never = msg;
      throw new Error(`docgen worker received unknown message: ${JSON.stringify(_exhaustive)}`);
    }
  }
});
