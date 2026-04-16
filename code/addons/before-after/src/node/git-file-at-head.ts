// eslint-disable-next-line depend/ban-dependencies
import { execa } from 'execa';

import { logger } from 'storybook/internal/node-logger';

const cache = new Map<string, string | null>();

/**
 * Reads a file's content at git HEAD.
 * Returns the file content as a string, or null if the file doesn't exist at HEAD (new file).
 */
export async function getFileAtHead(
  repoRoot: string,
  repoRelativePath: string
): Promise<string | null> {
  const cached = cache.get(repoRelativePath);
  if (cached !== undefined) {
    return cached;
  }

  try {
    const { stdout } = await execa('git', ['show', `HEAD:${repoRelativePath}`], {
      cwd: repoRoot,
    });
    cache.set(repoRelativePath, stdout);
    return stdout;
  } catch (error: unknown) {
    // File doesn't exist at HEAD (new file) or git error
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('does not exist') || message.includes('fatal:')) {
      cache.set(repoRelativePath, null);
      return null;
    }
    logger.warn(`[before-after] Failed to read file at HEAD: ${repoRelativePath}`);
    logger.warn(message);
    return null;
  }
}

export function invalidateCache(path?: string): void {
  if (path) {
    cache.delete(path);
  } else {
    cache.clear();
  }
}
