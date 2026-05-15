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
  try {
    await ensureSymlinkOrCopy(source, target);
  } catch (e) {
    console.log('[sync] symlink skipped: ' + (e instanceof Error ? e.message : String(e)));
  }
  const symlinkMs = performance.now() - symlinkStart;

  return { compileMs, symlinkMs };
}
