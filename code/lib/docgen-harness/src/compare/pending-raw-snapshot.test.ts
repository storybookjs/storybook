import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { pendingRawSnapshotContent } from './pending-raw-snapshot.ts';

const probePath = join(
  dirname(fileURLToPath(import.meta.url)),
  '__testfixtures__',
  'pending-raw-snapshot-probe.snapshot'
);

describe('pendingRawSnapshotContent', () => {
  it('returns undefined when a file snapshot matched and no rewrite is queued', async () => {
    // Matching the committed probe byte-for-byte queues nothing, in every update mode; reaching
    // undefined (rather than the loud internals-moved throw) also proves the vitest state shape
    // the helper depends on still exists.
    const committed = readFileSync(probePath, 'utf8');
    await expect(committed).toMatchFileSnapshot(probePath);
    expect(pendingRawSnapshotContent(probePath)).toBeUndefined();
  });

  it('returns the queued bytes for a pending write', () => {
    // A real queued entry only exists on `-u` runs or first records, which a committed test must
    // not depend on; exercise the lookup against a synthetic entry and restore the queue. The
    // queue lives on the GLOBAL expect instance, the same one the helper reads.
    const globalExpect = (globalThis as Record<symbol, unknown>)[
      Symbol.for('expect-global')
    ] as typeof expect;
    const state = globalExpect.getState() as unknown as {
      snapshotState: { _rawSnapshots: { file: string; snapshot?: string }[] };
    };
    const entry = { file: '/virtual/queued.snapshot', snapshot: 'queued bytes' };
    state.snapshotState._rawSnapshots.push(entry);
    try {
      expect(pendingRawSnapshotContent('/virtual/queued.snapshot')).toBe('queued bytes');
    } finally {
      state.snapshotState._rawSnapshots.splice(state.snapshotState._rawSnapshots.indexOf(entry), 1);
    }
  });
});
