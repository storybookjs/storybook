import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve, relative, sep } from 'node:path';

import { z } from 'zod';

import { SandboxBaselineError } from '../error.ts';

export const storySourceSchema = z.object({
  importPath: z.string().min(1),
  sha: z.string().min(1),
  digest: z.string().regex(/^[a-f0-9]{64}$/),
  source: z.string(),
});
export type StorySource = z.infer<typeof storySourceSchema>;

export function sourceDigest(source: string): string {
  return createHash('sha256').update(source).digest('hex');
}

export function readStorySource(root: string, importPath: string, sha: string): StorySource {
  const file = resolve(root, importPath);
  const path = relative(root, file);
  if (path === '..' || path.startsWith(`..${sep}`) || resolve(file) === resolve(root)) {
    throw new SandboxBaselineError(`Story source is outside the project: ${importPath}`);
  }
  const source = readFileSync(file, 'utf8');
  return { importPath, sha, digest: sourceDigest(source), source };
}
