import * as path from 'node:path';

import { projectPathsEqual } from '../instances/project-path.ts';
import type { StorybookInstanceRecord } from '../instances/types.ts';

export type FidelityMatch = { ok: true };

export type FidelityMismatch =
  | { ok: false; kind: 'cwd'; processCwd: string; instanceCwd: string }
  | {
      ok: false;
      kind: 'version';
      callerVersion: string;
      instanceVersion: string;
    };

export type FidelityResult = FidelityMatch | FidelityMismatch;

export function checkFidelity(
  record: Pick<StorybookInstanceRecord, 'cwd' | 'storybookVersion'>,
  { cwd, version }: { cwd: string; version: string }
): FidelityResult {
  const processCwd = path.resolve(cwd);
  const instanceCwd = path.resolve(record.cwd);
  if (!projectPathsEqual(cwd, record.cwd)) {
    return { ok: false, kind: 'cwd', processCwd, instanceCwd };
  }

  const instanceVersion = record.storybookVersion;
  if (instanceVersion === undefined || instanceVersion !== version) {
    return {
      ok: false,
      kind: 'version',
      callerVersion: version,
      instanceVersion: instanceVersion ?? 'unknown',
    };
  }

  return { ok: true };
}
