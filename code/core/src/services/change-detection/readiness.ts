import { getInstanceContext } from '../../shared/instance-context.ts';

export type ChangeDetectionReadiness =
  | { status: 'ready' }
  | { status: 'unavailable'; reason: string; error?: Error }
  | { status: 'error'; error: Error };

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

type ChangeDetectionHost = () => void | Promise<void>;

type ReadinessState = {
  deferred: Deferred<ChangeDetectionReadiness>;
  value?: ChangeDetectionReadiness;
  host?: ChangeDetectionHost;
  hostStarted?: Promise<void>;
};

const READINESS = Symbol.for('storybook.instance.change-detection-readiness');
const FALLBACK: ReadinessState = { deferred: createDeferred() };

function getReadiness(): ReadinessState {
  const context = getInstanceContext();
  if (!context) {
    return FALLBACK;
  }
  if (!context.state.has(READINESS)) {
    context.state.set(READINESS, { deferred: createDeferred() });
  }
  return context.state.get(READINESS) as ReadinessState;
}

/**
 * Install a one-shot starter the first {@link getChangeDetectionReadiness} call runs. The CLI uses
 * this so git/status scanning does not start at bootstrap; the dev server starts the service itself
 * and never installs a host.
 */
export function setChangeDetectionHost(next?: ChangeDetectionHost): void {
  const state = getReadiness();
  state.host = next;
  state.hostStarted = undefined;
}

export function getChangeDetectionReadiness(): Promise<ChangeDetectionReadiness> {
  const state = getReadiness();
  if (state.host && !state.hostStarted) {
    state.hostStarted = Promise.resolve()
      .then(() => state.host?.())
      .catch((error) => {
        setChangeDetectionReadiness({
          status: 'error',
          error: error instanceof Error ? error : new Error(String(error)),
        });
      });
  }
  const started = state.hostStarted ?? Promise.resolve();
  return started.then(() => (state.value ? Promise.resolve(state.value) : state.deferred.promise));
}

export function setChangeDetectionReadiness(readiness: ChangeDetectionReadiness): void {
  const state = getReadiness();
  if (state.value) {
    return;
  }

  state.value = readiness;
  state.deferred.resolve(readiness);
}

export function resetChangeDetectionReadiness(): void {
  const state = getReadiness();
  state.deferred = createDeferred<ChangeDetectionReadiness>();
  state.value = undefined;
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;

  return {
    promise: new Promise<T>((fulfill) => {
      resolve = fulfill;
    }),
    resolve,
  };
}
