import { dirname } from 'node:path';

import { readStaticDocgen } from '../read-static-docgen.ts';
import { readStaticStoryDocs } from '../read-static-story-docs.ts';
import { readCaptureIndex } from './read-index.ts';
import type { CapturedComponents } from './types.ts';

export function captureServer(staticDir: string): CapturedComponents {
  const docgen = readStaticDocgen({ staticDir, sandboxDir: dirname(staticDir) });
  const { entries } = readCaptureIndex(staticDir);
  const storyDocs = readStaticStoryDocs(staticDir);
  return Object.fromEntries(
    Object.entries(docgen).map(([id, component]) => [
      id,
      {
        id,
        name: component.name,
        description: component.description,
        argTypes: component.argTypes ?? {},
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
