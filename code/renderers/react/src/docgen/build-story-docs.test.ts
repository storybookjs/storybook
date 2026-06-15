import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import type { IndexEntry } from 'storybook/internal/types';
import { dedent } from 'ts-dedent';

import {
  cleanup,
  createTempDir,
  writeFiles,
} from '../componentManifest/componentMeta/test-helpers.ts';
import { buildStoryDocsPayload } from './build-story-docs.ts';

let tempDir: string | undefined;

function makeStoryIndexEntry(importPath: string, title: string): IndexEntry {
  const componentId = title.split('/').at(-1)!.replace(/\s+/g, '').toLowerCase();
  return {
    id: `${componentId}--primary`,
    name: 'Primary',
    title,
    type: 'story',
    subtype: 'story',
    importPath,
  };
}

afterEach(() => {
  if (tempDir) {
    cleanup(tempDir);
    tempDir = undefined;
  }
});

describe('buildStoryDocsPayload', () => {
  it('extracts snippets, descriptions, and imports for one component', async () => {
    tempDir = createTempDir('story-docs-build');

    const files = writeFiles(tempDir, {
      'Button.tsx': dedent`
        import React from 'react';
        export const Button = (_props: { label: string }) => <button />;
      `,
      'Button.stories.tsx': dedent`
        import { Button } from './Button';
        /** Story description */
        export default { component: Button, title: 'Forms/Button' };
        export const Primary = () => <Button label="hi" />;
      `,
    });

    const importPath = files['Button.stories.tsx'];

    const payload = await buildStoryDocsPayload(
      { entry: makeStoryIndexEntry(importPath, 'Forms/Button') },
      {
        resolvePath: (p) => (path.isAbsolute(p) ? p : path.join(tempDir!, p)),
      }
    );

    expect(payload).toBeDefined();
    expect(payload!.id).toBe('button');
    expect(payload!.import).toContain('Button');
    expect(Object.keys(payload!.stories)).toHaveLength(1);
    const [primaryStory] = Object.values(payload!.stories);
    expect(primaryStory).toMatchObject({
      id: expect.stringMatching(/--primary$/),
      name: 'Primary',
    });
    expect(primaryStory!.snippet).toMatch(/<Button label="hi"/);
  });

  it('returns undefined when the story file is missing', async () => {
    tempDir = createTempDir('story-docs-build');

    const payload = await buildStoryDocsPayload(
      {
        entry: makeStoryIndexEntry('does-not-exist.stories.tsx', 'Missing/Component'),
      },
      {
        resolvePath: (p) => path.join(tempDir!, p),
      }
    );

    expect(payload).toBeUndefined();
  });
});
