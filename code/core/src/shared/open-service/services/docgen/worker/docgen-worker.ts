/**
 * Worker-thread entry point for docgen extraction.
 *
 * Spawned once by {@link ./docgen-worker-client.ts} and kept alive for the dev server's lifetime so
 * the TypeScript program(s) each provider builds stay warm across requests. On `init` it imports
 * every {@link DocgenProviderDescriptor}'s module and folds them into a single provider chain; on
 * `extract` it runs that chain for one component and posts the resulting payload back. Running here
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
  DocgenWorkerModule,
} from '../types.ts';
import type {
  DocgenWorkerInitRequest,
  DocgenWorkerRequest,
  DocgenWorkerResponse,
} from './protocol.ts';

if (!parentPort) {
  throw new Error('docgen worker must be run as a worker thread');
}

// Capture into a const so TypeScript keeps the non-null narrowing inside the async handlers and the
// message listener below (it won't narrow the mutable `parentPort` binding across those closures).
const port = parentPort;

/** Identity provider that seeds the chain; the bottom of the stack has no docgen to contribute. */
const seedProvider: DocgenProvider = async () => undefined;

/** Resolved once per worker on `init`; every `extract` awaits it. */
let providerPromise: Promise<DocgenProvider> | undefined;

async function composeProvider(descriptors: DocgenProviderDescriptor[]): Promise<DocgenProvider> {
  let provider = seedProvider;
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
  }
  return provider;
}

async function handleInit({ descriptors, logLevel }: DocgenWorkerInitRequest): Promise<void> {
  try {
    // Provider modules share this logger instance, so set the forwarded level before importing them.
    logger.setLogLevel(logLevel);
    providerPromise = composeProvider(descriptors);
    await providerPromise;
    port.postMessage({ type: 'init' } satisfies DocgenWorkerResponse);
  } catch (error) {
    providerPromise = undefined;
    port.postMessage({
      type: 'init',
      error: errorToErrorLike(error),
    } satisfies DocgenWorkerResponse);
  }
}

async function handleExtract(id: number, entry: IndexEntry): Promise<void> {
  try {
    if (!providerPromise) {
      throw new Error('docgen worker received an extract request before init');
    }
    const provider = await providerPromise;
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

port.on('message', (msg: DocgenWorkerRequest) => {
  switch (msg.type) {
    case 'init':
      void handleInit(msg);
      return;
    case 'extract':
      void handleExtract(msg.id, msg.entry);
      return;
    default: {
      const _exhaustive: never = msg;
      throw new Error(`docgen worker received unknown message: ${JSON.stringify(_exhaustive)}`);
    }
  }
});
