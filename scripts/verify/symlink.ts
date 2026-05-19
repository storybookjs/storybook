// Symlink helper with CI/Windows cp fallback and dangling-symlink heal for the PR verify harness.

import { access, cp, lstat, mkdir, readlink, rename, rm, symlink, unlink } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

// Copy `source` into a sibling temp dir, then atomically swap it over
// `target` (rm old + rename). rename(2) is atomic on the same filesystem, so
// an interrupted copy populates only the throwaway temp dir and never exposes
// a torn/Frankenstein dist tree at `target`.
async function atomicCopyDir(source: string, target: string): Promise<void> {
  const tmp = join(dirname(target), '.' + basename(target) + '.tmp-' + process.pid + '-' + Date.now());
  await rm(tmp, { recursive: true, force: true });
  try {
    await cp(source, tmp, { recursive: true, force: true });
    await rm(target, { recursive: true, force: true });
    await rename(tmp, target);
  } catch (e) {
    await rm(tmp, { recursive: true, force: true }).catch(() => {});
    throw e;
  }
}

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
    await atomicCopyDir(source, target);
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
      await atomicCopyDir(source, target);
    } else {
      throw error;
    }
  }
}
