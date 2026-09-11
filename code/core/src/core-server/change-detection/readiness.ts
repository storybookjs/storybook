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
