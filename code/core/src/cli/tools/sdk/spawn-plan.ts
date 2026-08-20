import type { StorybookInstanceRecord } from '../instances/types.ts';
import { checkFidelity, type FidelityMismatch } from './fidelity.ts';

export type AttachHostPlan =
  | { action: 'in-process' }
  | { action: 'throw-mismatch'; fidelity: FidelityMismatch }
  | {
      action: 'throw-restart';
      instanceVersion: string;
      resolvedProjectVersion: string;
    }
  | { action: 'throw-spawn-failed' }
  | { action: 'spawn'; cwd: string };

export function planAttachHost({
  processCwd,
  callerVersion,
  record,
  autoSpawn,
  isChildHost,
  resolvedProjectVersion,
}: {
  processCwd: string;
  callerVersion: string;
  record: Pick<StorybookInstanceRecord, 'cwd' | 'storybookVersion'>;
  autoSpawn: boolean;
  isChildHost: boolean;
  resolvedProjectVersion: string | undefined;
}): AttachHostPlan {
  const fidelity = checkFidelity(record, { cwd: processCwd, version: callerVersion });
  if (fidelity.ok) {
    return { action: 'in-process' };
  }

  if (!autoSpawn || isChildHost) {
    return { action: 'throw-mismatch', fidelity };
  }

  if (resolvedProjectVersion === undefined) {
    return { action: 'throw-spawn-failed' };
  }

  if (resolvedProjectVersion !== record.storybookVersion) {
    return {
      action: 'throw-restart',
      instanceVersion: record.storybookVersion ?? 'unknown',
      resolvedProjectVersion,
    };
  }

  return { action: 'spawn', cwd: record.cwd };
}
