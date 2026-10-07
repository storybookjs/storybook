import { realpathSync } from 'node:fs';

import { normalize } from 'pathe';

import type { StorybookInstanceRecord } from '../instances/types.ts';
import { projectPathsEqual } from '../instances/project-path.ts';

export type InstallationCheck =
  | { ok: true }
  | { ok: false; reason: 'different-installation'; callerPath: string; instancePath: string }
  | { ok: false; reason: 'unknown-installation' };

// Decides how to attach: the same `storybook` installation on both sides may join in-process; a
// different one must go through a child host of the instance's installation. callerPath is this
// process's own realpathed package root (from `findStorybookPackageRoot`); the record side is
// realpathed here so a symlinked layout of the same installation still matches. A record without
// a root, a recorded root gone from disk, or a caller without a root is unknown — the check never
// guesses.
export function checkInstallation(
  record: Pick<StorybookInstanceRecord, 'storybookPath'>,
  callerPath: string | undefined
): InstallationCheck {
  if (!callerPath || !record.storybookPath) {
    return { ok: false, reason: 'unknown-installation' };
  }

  let instancePath: string;
  try {
    instancePath = normalize(realpathSync(record.storybookPath));
  } catch {
    return { ok: false, reason: 'unknown-installation' };
  }

  if (!projectPathsEqual(instancePath, callerPath)) {
    return { ok: false, reason: 'different-installation', callerPath, instancePath };
  }

  return { ok: true };
}
