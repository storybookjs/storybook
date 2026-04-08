export type ChangeDetectionReadiness =
  | { status: 'ready' }
  | { status: 'unavailable'; reason: string; error?: Error }
  | { status: 'error'; error: Error };

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

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

export function getChangeDetectionReadiness(): Promise<ChangeDetectionReadiness> {
  return readinessState ? Promise.resolve(readinessState) : readinessDeferred.promise;
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
