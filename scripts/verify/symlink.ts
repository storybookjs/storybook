// Symlink helper with CI/Windows cp fallback and dangling-symlink heal for the PR verify harness.

import { access, cp, lstat, mkdir, readlink, symlink, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';

async function ensureSymlink(src: string, dest: string): Promise<void> {
  await mkdir(dirname(dest), { recursive: true });

  try {
    await lstat(dest);
    return;
  } catch (e: any) {
    if (e?.code !== 'ENOENT') {
      throw e;
    }
  }

  await symlink(src, dest);
}

export async function ensureSymlinkOrCopy(source: string, target: string): Promise<void> {
  if (process.env.CI) {
    await cp(source, target, { recursive: true, force: true });
    return;
  }

  // Net-new dangling-symlink heal: if target exists as a symlink but points to a missing location,
  // unlink it so ensureSymlink can recreate it correctly.
  try {
    const stat = await lstat(target);
    if (stat.isSymbolicLink()) {
      try {
        const linkTarget = await readlink(target);
        await access(linkTarget);
      } catch {
        await unlink(target);
        console.log('[symlink] healed dangling target ' + target);
      }
    }
  } catch (e: any) {
    if (e?.code !== 'ENOENT') throw e;
  }

  try {
    await ensureSymlink(source, target);
  } catch (error: any) {
    if (error.code === 'EPERM' || error.code === 'EEXIST') {
      console.log('[symlink] symlink failed for ' + target + ', falling back to cp');
      await cp(source, target, { recursive: true, force: true });
    } else {
      throw error;
    }
  }
}
