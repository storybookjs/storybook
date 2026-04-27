/**
 * Worker-thread entry point that parses a single file with `oxc-parser` and returns its
 * import edges. The worker is spawned by {@link ./worker-pool.ts} and delegates to the
 * same {@link oxcParse} implementation used on the main thread — the only difference is
 * that the CPU work runs off the event loop so dev-server traffic stays responsive.
 */
import { parentPort } from 'node:worker_threads';

import { oxcParse } from './parse.ts';

interface RequestMessage {
  id: number;
  filePath: string;
  source: string;
}

interface ResponseMessage {
  id: number;
  ok: boolean;
  edges?: unknown;
  message?: string;
  name?: string;
}

// Defensive no-op when (somehow) imported outside a worker thread — there is no main
// loop to post messages back to and no value in crashing the importing module.
const port = parentPort;

port?.on('message', async (msg: RequestMessage) => {
  try {
    const edges = await oxcParse(msg.filePath, msg.source);
    const response: ResponseMessage = { id: msg.id, ok: true, edges };
    port.postMessage(response);
  } catch (error) {
    const err = error as { message?: string; name?: string } | undefined;
    const response: ResponseMessage = {
      id: msg.id,
      ok: false,
      message: err?.message ?? String(error),
      name: err?.name ?? 'Error',
    };
    port.postMessage(response);
  }
});
