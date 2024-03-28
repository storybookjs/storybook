import type { Worker } from 'node:worker_threads';
import type { RequestMessage, ResponseMessage } from './interfaces';
import type { WorkerAPI } from './worker';

let requestId = 0;

const getRequestId = (): number => {
  requestId = (requestId + 1) % Number.MAX_SAFE_INTEGER;
  return requestId;
};

interface Resolvable<T = unknown> {
  resolve: (result: T) => void;
  reject: (error: any) => void;
  promise: Promise<T>;
}

const createResolvable = <T>(): Resolvable<T> => {
  let resolve;
  let reject;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });

  // @ts-expect-error (not type-safe)
  return { resolve, reject, promise };
};

const activeRequests = new Map<number, Resolvable>();

export const createService = (worker: Worker): WorkerAPI => {
  const receive = (message: ResponseMessage) => {
    if (!activeRequests.has(message.id)) {
      throw new Error(`Received a response for a request that is not tracked! (id=${message.id})`, {
        cause: { message },
      });
    }
    // @ts-expect-error (not type-safe)
    const { resolve, reject } = activeRequests.get(message.id);
    activeRequests.delete(message.id);
    if (message.kind === 'success') {
      resolve(message.result);
    } else {
      reject(message.error);
    }
  };

  const call = async <T>(method: string, args?: unknown) => {
    const id = getRequestId();
    const request: RequestMessage = {
      id,
      method,
      args,
    };
    const resolvable = createResolvable<T>();

    // @ts-expect-error (not type-safe)
    activeRequests.set(id, resolvable);
    worker.postMessage(request);
    return resolvable.promise;
  };

  worker.addListener('message', receive);
  worker.addListener('error', (err) =>
    console.error(`Worker encountered error: ${err?.toString()}`)
  );
  worker.addListener('exit', (code) => {
    if (code) {
      console.error(`Worker exited with non-zero exit code ${code}`);
    }
  });

  return {
    analyze: (fileName) => call('analyze', fileName),
  };
};
