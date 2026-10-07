// Under `-u` the match call rewrites the file, so old-text vs new-output divergence is the
// comparator's job, not a parser failure; the recorders skip the parsed-vs-live round-trip proof
// there and it re-arms on the next normal run. Reads the worker config rather than
// expect.getState() so the guard does not depend on which expect instance a recorder imported; if
// the worker global ever disappears the guard runs the proof everywhere - loud, never weaker.
export const isSnapshotUpdateRun = (): boolean =>
  (
    (globalThis as unknown as Record<string, unknown>).__vitest_worker__ as
      | { config?: { snapshotOptions?: { updateSnapshot?: string } } }
      | undefined
  )?.config?.snapshotOptions?.updateSnapshot === 'all';
