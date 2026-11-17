import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { z } from 'zod';

import { selectComponentEntriesByComponentId } from 'storybook/internal/common';
import type { IndexEntry } from 'storybook/internal/types';

const indexSchema = z.object({
  entries: z.record(
    z
      .object({
        id: z.string(),
        title: z.string(),
        importPath: z.string(),
        type: z.enum(['story', 'docs']),
        subtype: z.enum(['story', 'test']).optional(),
        tags: z.array(z.string()).optional(),
        storiesImports: z.array(z.string()).optional(),
        name: z.string().optional(),
      })
      .passthrough()
  ),
});

export function readCaptureIndex(staticDir: string) {
  const parsed = indexSchema.parse(JSON.parse(readFileSync(join(staticDir, 'index.json'), 'utf8')));
  const entries = Object.values(parsed.entries).map((entry): IndexEntry => {
    if (entry.type === 'docs')
      return {
        ...entry,
        type: 'docs',
        name: entry.name ?? 'Docs',
        storiesImports: entry.storiesImports ?? [],
      };
    return {
      ...entry,
      type: 'story',
      subtype: entry.subtype ?? 'story',
      name: entry.name ?? entry.id,
    };
  });
  return { entries, selected: selectComponentEntriesByComponentId(entries) };
}
