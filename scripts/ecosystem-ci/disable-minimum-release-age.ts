import { readFile, writeFile } from 'node:fs/promises';

import { join } from 'pathe';
import { parse, stringify } from 'yaml';

/** Turn off the sandbox's pnpm age gate, kept in its own pnpm-workspace.yaml. */
export async function disableMinimumReleaseAge(sandboxDir: string) {
  const configPath = join(sandboxDir, 'pnpm-workspace.yaml');

  let config: Record<string, unknown> = {};
  try {
    config = parse(await readFile(configPath, 'utf-8')) ?? {};
  } catch (error) {
    if (!isEnoent(error)) {
      throw error;
    }
  }

  await writeFile(configPath, stringify({ ...config, minimumReleaseAge: 0 }));
}

function isEnoent(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
