import { utimesSync, writeFileSync } from 'node:fs';
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

// These tests use real temp dirs rather than `memfs` (the default per AGENTS.md): `buildStoryDocsPayload`
// drives the real resolve + parse pipeline (oxc parser, module resolution of relative component
// imports, tsconfig lookups), which reads from the actual filesystem and cannot run against an
// in-memory volume.

/**
 * Overwrite a file and push its mtime forward so the mtime-aware story-file cache is guaranteed to
 * miss, regardless of the host clock resolution. Mirrors a developer saving an edited story file.
 */
function rewriteStoryFile(filePath: string, content: string): void {
  writeFileSync(filePath, content);
  const future = new Date(Date.now() + 1000);
  utimesSync(filePath, future, future);
}

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

  it('reflects edited story args after the story file changes on disk', async () => {
    tempDir = createTempDir('story-docs-build');

    const files = writeFiles(tempDir, {
      'Button.tsx': dedent`
        import React from 'react';
        export const Button = (_props: { label: string }) => <button />;
      `,
      'Button.stories.tsx': dedent`
        import { Button } from './Button';
        export default { component: Button, title: 'Forms/Button' };
        export const Primary = () => <Button label="before" />;
      `,
    });

    const importPath = files['Button.stories.tsx'];
    const resolvePath = (p: string) => (path.isAbsolute(p) ? p : path.join(tempDir!, p));
    const entry = makeStoryIndexEntry(importPath, 'Forms/Button');

    const before = await buildStoryDocsPayload({ entry }, { resolvePath });
    expect(Object.values(before!.stories)[0]!.snippet).toMatch(/label="before"/);

    rewriteStoryFile(
      importPath,
      dedent`
        import { Button } from './Button';
        export default { component: Button, title: 'Forms/Button' };
        export const Primary = () => <Button label="after" />;
      `
    );

    const after = await buildStoryDocsPayload({ entry }, { resolvePath });
    expect(Object.values(after!.stories)[0]!.snippet).toMatch(/label="after"/);
    expect(Object.values(after!.stories)[0]!.snippet).not.toMatch(/label="before"/);
  });

  it('reflects a renamed story after the story file changes on disk', async () => {
    tempDir = createTempDir('story-docs-build');

    const files = writeFiles(tempDir, {
      'Button.tsx': dedent`
        import React from 'react';
        export const Button = (_props: { label: string }) => <button />;
      `,
      'Button.stories.tsx': dedent`
        import { Button } from './Button';
        export default { component: Button, title: 'Forms/Button' };
        export const Primary = () => <Button label="hi" />;
      `,
    });

    const importPath = files['Button.stories.tsx'];
    const resolvePath = (p: string) => (path.isAbsolute(p) ? p : path.join(tempDir!, p));
    const entry = makeStoryIndexEntry(importPath, 'Forms/Button');

    const before = await buildStoryDocsPayload({ entry }, { resolvePath });
    expect(Object.values(before!.stories).map((s) => s.name)).toEqual(['Primary']);

    rewriteStoryFile(
      importPath,
      dedent`
        import { Button } from './Button';
        export default { component: Button, title: 'Forms/Button' };
        export const Secondary = () => <Button label="hi" />;
      `
    );

    const after = await buildStoryDocsPayload({ entry }, { resolvePath });
    expect(Object.values(after!.stories).map((s) => s.name)).toEqual(['Secondary']);
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
