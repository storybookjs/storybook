import { readFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { z } from 'zod';

import { SandboxBaselineError } from '../error.ts';
import { readCaptureIndex } from './read-index.ts';
import { readStorySource, storySourceSchema } from './story-source.ts';
import type { CapturedComponents } from './types.ts';

export function attachStorySources(
  components: CapturedComponents,
  staticDir: string,
  sha: string,
  manifest: string
): void {
  const sources = z.array(storySourceSchema).parse(JSON.parse(readFileSync(manifest, 'utf8')));
  const byPath = new Map(sources.map((source) => [source.importPath.replace(/^\.\//, ''), source]));
  for (const entry of readCaptureIndex(staticDir).entries) {
    if (entry.type !== 'story') continue;
    const story = components[entry.id.split('--')[0]]?.stories[entry.id];
    const source = byPath.get(entry.importPath.replace(/^\.\//, ''));
    if (!story || !source) continue;
    const current = readStorySource(dirname(staticDir), entry.importPath, sha);
    if (
      source.sha !== sha ||
      source.digest !== current.digest ||
      source.source !== current.source
    ) {
      throw new SandboxBaselineError(
        `Story source changed since the pre-build manifest: ${entry.importPath}`
      );
    }
    story.source = source;
  }
}
