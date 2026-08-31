import * as nodePath from 'node:path';

import { projectPathsEqual, type ProjectPathImpl } from '../instances/project-path.ts';
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
  { cwd, version }: { cwd: string; version: string },
  pathImpl: ProjectPathImpl = nodePath
): FidelityResult {
  if (!projectPathsEqual(cwd, record.cwd, pathImpl)) {
    return {
      ok: false,
      kind: 'cwd',
      processCwd: pathImpl.resolve(cwd),
      instanceCwd: pathImpl.resolve(record.cwd),
    };
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
