import { readFile, rename, writeFile } from 'node:fs/promises';

/**
 * Generated sources are read concurrently by other build steps (rolldown scans and parallel package
 * builds whose declaration emit type-checks source), and `fs.writeFile` truncates before writing,
 * so a plain overwrite exposes readers to an empty or partial file. Skip identical content (the
 * steady state) and otherwise swap the new content in atomically via rename.
 */
export async function writeGeneratedFile(destination: string, content: string): Promise<void> {
  const existing = await readFile(destination, 'utf8').catch(() => null);
  if (existing === content) {
    return;
  }
  const temp = `${destination}.tmp-${process.pid}`;
  await writeFile(temp, content);
  try {
    await rename(temp, destination);
  } catch {
    // Windows can refuse to replace a file that another process holds open
    // without delete sharing; fall back to a plain overwrite there.
    await writeFile(destination, content);
  }
}
