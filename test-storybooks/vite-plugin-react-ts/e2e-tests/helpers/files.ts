import { readFile, writeFile } from 'node:fs/promises';

/** Writes `original` back to `file` and reports whether it had changed. */
export async function restoreFile(file: string, original: string): Promise<boolean> {
  if ((await readFile(file, 'utf8')) !== original) {
    await writeFile(file, original);
    return true;
  }

  return false;
}
