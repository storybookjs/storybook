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
import type { ComponentSummary, DocgenPayload, DocgenProviderDescriptor } from '../types.ts';

/** Sent once, right after spawn, to compose the provider chain inside the worker. */
export interface DocgenWorkerInitRequest {
  type: 'init';
  descriptors: DocgenProviderDescriptor[];
  logLevel: LogLevel;
}

/** Sent per component to extract its docgen payload. `id` correlates the response. */
export interface DocgenWorkerExtractRequest {
  type: 'extract';
  id: number;
  entry: IndexEntry;
}

/** Sent per listing to summarize the component of each entry. `id` correlates the response. */
export interface DocgenWorkerSummarizeRequest {
  type: 'summarize';
  id: number;
  entries: IndexEntry[];
}

export type DocgenWorkerRequest =
  | DocgenWorkerInitRequest
  | DocgenWorkerExtractRequest
  | DocgenWorkerSummarizeRequest;

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

/** Extraction succeeded; `payload` is the result (absent when no provider produced docgen). */
export interface DocgenWorkerExtractSuccess {
  type: 'extract';
  id: number;
  payload?: DocgenPayload;
  error?: undefined;
}

/** Extraction threw; `error` describes the failure. */
export interface DocgenWorkerExtractFailure {
  type: 'extract';
  id: number;
  error: ErrorLike;
}

export type DocgenWorkerExtractResponse = DocgenWorkerExtractSuccess | DocgenWorkerExtractFailure;

/** The summaries, in entry order; absent when a provider module in the chain summarizes nothing. */
export interface DocgenWorkerSummarizeSuccess {
  type: 'summarize';
  id: number;
  summaries?: ComponentSummary[];
  error?: undefined;
}

/** Summarizing threw; `error` describes the failure. */
export interface DocgenWorkerSummarizeFailure {
  type: 'summarize';
  id: number;
  error: ErrorLike;
}

export type DocgenWorkerSummarizeResponse =
  | DocgenWorkerSummarizeSuccess
  | DocgenWorkerSummarizeFailure;

export type DocgenWorkerResponse =
  | DocgenWorkerInitResponse
  | DocgenWorkerExtractResponse
  | DocgenWorkerSummarizeResponse;
