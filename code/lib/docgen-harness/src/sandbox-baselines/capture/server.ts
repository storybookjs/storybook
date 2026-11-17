import { dirname } from 'node:path';

import { readStaticDocgen } from '../read-static-docgen.ts';
import { readStaticStoryDocs } from '../read-static-story-docs.ts';
import { readCaptureIndex } from './read-index.ts';
import type { CapturedComponents } from './types.ts';

export function captureServer(staticDir: string): CapturedComponents {
  const docgen = readStaticDocgen({ staticDir, sandboxDir: dirname(staticDir) });
  const { entries, selected } = readCaptureIndex(staticDir);
  const storyDocs = readStaticStoryDocs(staticDir);
  return Object.fromEntries(
    Array.from(new Set([...Object.keys(docgen), ...selected.keys()])).map((id) => [
      id,
      {
        id,
        name: docgen[id]?.name ?? selected.get(id)?.title ?? id,
        description: docgen[id]?.description,
        argTypes: docgen[id]?.argTypes ?? {},
        stories: {
          ...Object.fromEntries(
            entries
              .filter(
                (entry) =>
                  entry.type === 'story' &&
                  entry.subtype === 'story' &&
                  entry.id.split('--')[0] === id
              )
              .map((entry) => [entry.id, { snippet: null }])
          ),
          ...storyDocs[id],
        },
      },
    ])
  );
}
