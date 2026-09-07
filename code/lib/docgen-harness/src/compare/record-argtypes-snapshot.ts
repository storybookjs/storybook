import { existsSync, readFileSync } from 'node:fs';

import { expect } from 'vitest';

import type { StrictArgTypes } from '../../../../core/src/csf/story.ts';
import type { CompareArgTypesOptions } from './argtypes.ts';
import type { ArgTypesComparisonOptions } from './expect-current-or-better.ts';
import { expectCurrentOrBetter } from './expect-current-or-better.ts';
import { isSnapshotUpdateRun } from './is-snapshot-update-run.ts';
import { parseArgTypesSnapshot } from './parse-snapshot.ts';
import { pendingRawSnapshotContent } from './pending-raw-snapshot.ts';

/** An extra committed recording the candidate must also hold, gated before the snapshot call. */
type ArgTypesGate = ArgTypesComparisonOptions & {
  /** Committed snapshot text of the other recording. */
  committed: string;
  label: string;
};

interface RecordArgTypesSnapshotInput extends CompareArgTypesOptions {
  /** Snapshot file the candidate is recorded into and ratcheted against. */
  path: string;
  /** Human-readable name for the snapshot, used in gate failures. */
  label: string;
  candidate: StrictArgTypes;
  /** Gates against other committed recordings, e.g. the legacy leg in a parity recorder. */
  extraGates?: ArgTypesGate[];
}

/**
 * Records an argTypes table into a snapshot file, gated so a recording can never get worse.
 *
 * Every gate runs BEFORE the snapshot call: under `-u` that call queues the rewrite, so a gate
 * placed after it would turn the run red while still persisting the regressed recording - and the
 * rerun would then compare regressed-vs-regressed and go green.
 */
export async function recordArgTypesSnapshot({
  path,
  label,
  candidate,
  extraGates = [],
  ...ratchet
}: RecordArgTypesSnapshotInput): Promise<void> {
  const committed = existsSync(path) ? readFileSync(path, 'utf8') : undefined;
  const parsed = committed !== undefined ? parseArgTypesSnapshot(committed, label) : undefined;

  if (parsed !== undefined) {
    expectCurrentOrBetter({ kind: 'argTypes', baseline: parsed, candidate, ...ratchet });
  }
  for (const { committed: gateCommitted, label: gateLabel, ...gateOptions } of extraGates) {
    expectCurrentOrBetter({
      kind: 'argTypes',
      baseline: parseArgTypesSnapshot(gateCommitted, gateLabel),
      candidate,
      ...gateOptions,
    });
  }

  await expect(candidate).toMatchFileSnapshot(path);

  if (isSnapshotUpdateRun()) {
    // `-u` skips the committed-text proof below, so prove the bytes this run will flush at suite
    // end (or the committed bytes, when nothing changed) parse back to the live extraction - a
    // recording whose unescaped write misparses can then never land green.
    const finalText = pendingRawSnapshotContent(path) ?? committed;
    expect(finalText, `no snapshot content recorded for ${label}`).toBeDefined();
    expect(parseArgTypesSnapshot(finalText!, label)).toEqual(candidate);
  } else if (parsed !== undefined) {
    // Round-trip proof: the tokenizer must reconstruct exactly what pretty-format wrote.
    expect(parsed).toEqual(candidate);
  }
}
