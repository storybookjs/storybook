import type { FileChangeEvent } from './adapters/index.ts';

/**
 * Lightweight process-wide notifier for raw source-file change events seen by
 * change detection. Mirrors the singleton shape of {@link ./readiness.ts}.
 *
 * Change detection already watches the builder's file events; this lets other
 * server-side consumers (e.g. `@storybook/addon-review`, to decide whether a
 * pushed review has gone stale) react to "a watched source file changed"
 * without re-implementing a watcher or coupling to git-baseline story statuses.
 */

type SourceFileChangeListener = (event: FileChangeEvent) => void;

const listeners = new Set<SourceFileChangeListener>();

/**
 * Subscribe to source-file change events. Returns an unsubscribe function.
 * Listeners fire for every file event change detection handles, regardless of
 * whether the change ultimately affects any story's status.
 */
export function subscribeToSourceFileChanges(listener: SourceFileChangeListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Published by {@link ChangeDetectionService} for each file-change event. */
export function notifySourceFileChange(event: FileChangeEvent): void {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      // A listener failure must never break change detection.
    }
  }
}

/** Test-only: drop all listeners between cases. */
export function internal_resetSourceFileChangeListeners(): void {
  listeners.clear();
}
