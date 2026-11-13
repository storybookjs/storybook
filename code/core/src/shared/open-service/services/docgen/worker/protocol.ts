/**
 * Message protocol between the docgen worker client (main thread) and the worker
 * ({@link ./docgen-worker.ts}). All payloads are structured-clone-safe so they can cross the
 * `postMessage` boundary.
 *
 * Responses are success/failure unions discriminated by the presence of an {@link ErrorLike}
 * `error` (mirroring `ModuleGraphStatus`), rather than an `ok` flag with nullable fields — a
 * response either carries its result or an error, never an ambiguous mix.
 */
import type { LogLevel } from 'storybook/internal/node-logger';

import type { IndexEntry } from '../../../../../types/modules/indexer.ts';
import type { ErrorLike } from '../../module-graph/types.ts';
import type { DocgenPayload, DocgenProviderDescriptor } from '../types.ts';

/** Sent once, right after spawn, to compose the provider chain inside the worker. */
export interface DocgenWorkerInitRequest {
  type: 'init';
  descriptors: DocgenProviderDescriptor[];
  logLevel: LogLevel;
}

/** Sent per batch of components to extract their docgen payloads. `id` correlates the response. */
export interface DocgenWorkerExtractRequest {
  type: 'extract';
  id: number;
  entries: IndexEntry[];
}

export type DocgenWorkerRequest = DocgenWorkerInitRequest | DocgenWorkerExtractRequest;

/** Chain composition succeeded; the worker is ready for extract requests. */
export interface DocgenWorkerInitSuccess {
  type: 'init';
  error?: undefined;
}

/** Chain composition failed; the worker is unusable. */
export interface DocgenWorkerInitFailure {
  type: 'init';
  error: ErrorLike;
}

export type DocgenWorkerInitResponse = DocgenWorkerInitSuccess | DocgenWorkerInitFailure;

/** One entry's extraction; `payload` is absent when no provider produced docgen. */
export type DocgenWorkerEntryResult =
  | { payload?: DocgenPayload; error?: undefined }
  | { payload?: undefined; error: ErrorLike };

/** The provider chain ran; `results` holds one result per requested entry, in the same order. */
export interface DocgenWorkerExtractSuccess {
  type: 'extract';
  id: number;
  results: DocgenWorkerEntryResult[];
  error?: undefined;
}

/** The provider chain threw for the whole batch; `error` describes the failure. */
export interface DocgenWorkerExtractFailure {
  type: 'extract';
  id: number;
  error: ErrorLike;
}

export type DocgenWorkerExtractResponse = DocgenWorkerExtractSuccess | DocgenWorkerExtractFailure;

export type DocgenWorkerResponse = DocgenWorkerInitResponse | DocgenWorkerExtractResponse;
