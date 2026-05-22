import * as path from 'node:path';
import { performance } from 'node:perf_hooks';

import { exec } from '../utils/exec.ts';
import { ensureSymlinkOrCopy } from './symlink.ts';

export interface SyncResult {
  compileMs: number;
  symlinkMs: number;
}

export async function syncCorePackage(opts: { sandboxDir: string }): Promise<SyncResult> {
  const repoRoot = path.resolve(import.meta.dirname, '..', '..');

  const compileStart = performance.now();
  await exec(
    'yarn nx compile core',
    { cwd: repoRoot },
    {
      startMessage: '[sync] compiling core',
      errorMessage: '[sync] yarn nx compile core failed',
    }
  );
  const compileMs = performance.now() - compileStart;

  const symlinkStart = performance.now();
  const source = path.join(repoRoot, 'code', 'core', 'dist');
  const target = path.join(opts.sandboxDir, 'node_modules', 'storybook', 'dist');
  // Fail loud: a swallowed symlink/copy failure means the sandbox boots
  // against STALE core and "verifies" nothing while reporting success. Let
  // the failure propagate so verify-pr.ts's boot try/catch records a
  // regression stub with the real cause.
  await ensureSymlinkOrCopy(source, target);
  const symlinkMs = performance.now() - symlinkStart;

  return { compileMs, symlinkMs };
}
