// eslint-disable-next-line depend/ban-dependencies
import fg from 'fast-glob';
import fs from 'node:fs/promises';

/**
 * Recursively collects all .mdx files in the given docs directory.
 */
export async function getMdxFiles(docsDir: string): Promise<string[]> {
  return fg(['**/*.mdx'], { cwd: docsDir, absolute: true });
}

/**
 * Reads a file and returns an array of its lines.
 */
export async function readFileLines(filePath: string): Promise<string[]> {
  const content = await fs.readFile(filePath, 'utf8');
  return content.split(/\r?\n/);
}
