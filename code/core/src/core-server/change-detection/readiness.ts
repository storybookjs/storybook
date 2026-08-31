import { getService, isDelegatedMode } from '../../shared/open-service/service-registry.ts';
import type { ModuleGraphService } from '../../shared/open-service/services/module-graph/definition.ts';

export type ChangeDetectionReadiness =
  | { status: 'ready' }
  | { status: 'unavailable'; reason: string; error?: Error }
  | { status: 'error'; error: Error };

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

type ChangeDetectionHost = () => void | Promise<void>;

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;

  return {
    promise: new Promise<T>((fulfill) => {
      resolve = fulfill;
    }),
    resolve,
  };
}

let readinessDeferred = createDeferred<ChangeDetectionReadiness>();
let readinessState: ChangeDetectionReadiness | undefined;
let host: ChangeDetectionHost | undefined;
let hostStarted: Promise<void> | undefined;

/**
 * Install a one-shot starter the first {@link getChangeDetectionReadiness} call runs. The CLI uses
 * this so git/status scanning does not start at bootstrap; the dev server starts the service itself
 * and never installs a host.
 */
export function setChangeDetectionHost(next?: ChangeDetectionHost): void {
  host = next;
  hostStarted = undefined;
}

export function getChangeDetectionReadiness(): Promise<ChangeDetectionReadiness> {
  if (isDelegatedMode() && !readinessState && !host) {
    return fetchDelegatedReadiness();
  }
  if (host && !hostStarted) {
    hostStarted = Promise.resolve()
      .then(() => host?.())
      .catch((error) => {
        setChangeDetectionReadiness({
          status: 'error',
          error: error instanceof Error ? error : new Error(String(error)),
        });
      });
  }
  const started = hostStarted ?? Promise.resolve();
  return started.then(() =>
    readinessState ? Promise.resolve(readinessState) : readinessDeferred.promise
  );
}

async function fetchDelegatedReadiness(): Promise<ChangeDetectionReadiness> {
  const moduleGraph = getService<ModuleGraphService>('core/module-graph', { internal: true });
  const readiness = await moduleGraph.commands._getChangeDetectionReadiness(undefined);
  if (readiness.status === 'error') {
    return { status: 'error', error: new Error(readiness.error.message) };
  }
  return readiness;
}

export function setChangeDetectionReadiness(readiness: ChangeDetectionReadiness): void {
  if (readinessState) {
    return;
  }

  readinessState = readiness;
  readinessDeferred.resolve(readiness);
}

export function resetChangeDetectionReadiness(): void {
  readinessDeferred = createDeferred<ChangeDetectionReadiness>();
  readinessState = undefined;
}
