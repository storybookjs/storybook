import { expect } from 'vitest';

interface RawSnapshotEntry {
  file: string;
  snapshot?: string;
}

interface ExpectWithState {
  getState: () => { snapshotState?: { _rawSnapshots?: RawSnapshotEntry[] } };
}

/**
 * The vitest runner maintains `snapshotState` on the GLOBAL expect instance
 * (`globalThis[Symbol.for('expect-global')]`); in module graphs that resolve a second
 * `@vitest/expect` instance (this repo patches that package), the imported `expect` carries a
 * separate state object without it, so the global instance is authoritative.
 */
const expectWithSnapshotState = (): ExpectWithState =>
  ((globalThis as Record<symbol, unknown>)[Symbol.for('expect-global')] as
    | ExpectWithState
    | undefined) ?? (expect as unknown as ExpectWithState);

/**
 * The bytes a `-u` run has queued for `filePath`, or undefined when the file's content matched and
 * no rewrite is queued. `toMatchFileSnapshot` does not write eagerly - vitest flushes raw
 * snapshots when the whole test file finishes (`SnapshotState.save`), so re-reading the file after
 * the assertion still returns the committed bytes. The queued `snapshot` string is exactly what
 * `saveSnapshotFile` will write verbatim, which lets the recorders prove the future file parses
 * back to the live extraction before it ever lands on disk. Reaches into vitest internals, so it
 * fails loudly when the shape moves rather than skipping the proof.
 */
export function pendingRawSnapshotContent(filePath: string): string | undefined {
  const rawSnapshots = expectWithSnapshotState().getState().snapshotState?._rawSnapshots;
  if (rawSnapshots === undefined) {
    // eslint-disable-next-line local-rules/no-uncategorized-errors
    throw new Error(
      'vitest no longer exposes snapshotState._rawSnapshots on the expect state; ' +
        'update pendingRawSnapshotContent to the new internals'
    );
  }
  const entry = rawSnapshots.find((snapshot) => snapshot.file === filePath);
  if (entry === undefined) {
    return undefined;
  }
  if (typeof entry.snapshot !== 'string') {
    // eslint-disable-next-line local-rules/no-uncategorized-errors
    throw new Error(
      `the queued raw snapshot for ${filePath} carries no content; ` +
        'update pendingRawSnapshotContent to the new vitest internals'
    );
  }
  return entry.snapshot;
}
