import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, it } from 'vitest';

import { readStaticStoryDocs } from './read-static-story-docs.ts';

it('keeps snippets across component snapshots and records missing snippets as null', () => {
  const root = mkdtempSync(join(tmpdir(), 'static-story-docs-'));
  try {
    const directory = join(root, 'services/core/story-docs');
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      join(directory, 'button.json'),
      JSON.stringify({
        components: {
          button: {
            stories: {
              'button--primary': { snippet: '<Button primary />', description: 'Ignored' },
              'button--unresolved': { warning: 'Cannot resolve' },
            },
          },
        },
      })
    );
    expect(readStaticStoryDocs(root)).toEqual({
      button: {
        'button--primary': { snippet: '<Button primary />' },
        'button--unresolved': { snippet: null },
      },
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
