// Under `-u` the match call rewrites the file, so old-text vs new-output divergence is the
// comparator's job, not a parser failure; the recorders skip the parsed-vs-live round-trip
// proof there and it re-arms on the next normal run. Reads the worker config because
// storybook/test (loaded via the recorders' production imports) replaces the expect instance
// carrying snapshotState; if the worker global ever disappears, the guard degrades to running
// the proof everywhere - loud, never silently weaker.
export const isSnapshotUpdateRun = (): boolean =>
  (
    (globalThis as unknown as Record<string, unknown>).__vitest_worker__ as
      | { config?: { snapshotOptions?: { updateSnapshot?: string } } }
      | undefined
  )?.config?.snapshotOptions?.updateSnapshot === 'all';
