import { readFile } from 'node:fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { vol } from 'memfs';

import { docgenManifestRef } from '../../../shared/open-service/services/docgen/paths.ts';
import { storyDocsManifestRef } from '../../../shared/open-service/services/story-docs/paths.ts';
import type { DocgenPayload } from '../../../shared/open-service/services/docgen/types.ts';
import type { StoryDocsPayload } from '../../../shared/open-service/services/story-docs/types.ts';

import {
  COMPONENTS_REF_MANIFEST_VERSION,
  buildComponentsRefManifest,
  loadDocgenPayloadsFromDisk,
  loadStoryDocsPayloadsFromDisk,
  mergeManifestPayloads,
  toComponentManifestIndexEntries,
} from './components-ref-manifest.ts';

vi.mock('node:fs/promises', { spy: true });

beforeEach(async () => {
  vol.reset();
  const memfs = await vi.importActual<typeof import('memfs')>('memfs');

  vi.mocked(readFile).mockImplementation(
    memfs.fs.promises.readFile as unknown as typeof import('node:fs/promises').readFile
  );
});

describe('components-ref-manifest', () => {
  it('builds ref-based component manifest entries with nested docgen refs', () => {
    expect(
      buildComponentsRefManifest({
        button: {
          id: 'button',
          name: 'Button',
          docgen: { $ref: docgenManifestRef('button') },
        },
        card: {
          id: 'card',
          name: 'Card',
          summary: 'A card',
        },
      })
    ).toEqual({
      v: COMPONENTS_REF_MANIFEST_VERSION,
      components: {
        button: {
          id: 'button',
          name: 'Button',
          docgen: { $ref: docgenManifestRef('button') },
        },
        card: {
          id: 'card',
          name: 'Card',
          summary: 'A card',
        },
      },
    });
  });

  it('carries meta when provided', () => {
    expect(
      buildComponentsRefManifest({}, { docgen: 'react-component-meta', durationMs: 42 })
    ).toEqual({
      v: COMPONENTS_REF_MANIFEST_VERSION,
      components: {},
      meta: { docgen: 'react-component-meta', durationMs: 42 },
    });
  });

  it('loads full docgen payloads from built snapshots on disk', async () => {
    const payload = {
      id: 'button',
      name: 'Button',
      description: 'A button',
      summary: 'Click me',
      path: './button.stories.tsx',
      jsDocTags: {},
    };
    vol.fromNestedJSON({
      '/output/services/core/docgen/button.json': JSON.stringify({
        components: { button: payload },
      }),
    });

    await expect(loadDocgenPayloadsFromDisk('/output', ['button'])).resolves.toEqual({
      button: payload,
    });
  });

  it('skips components without a readable snapshot', async () => {
    await expect(loadDocgenPayloadsFromDisk('/output', ['button'])).resolves.toEqual({});
  });

  it('builds index entries with nested docgen and story-docs refs when payloads exist', () => {
    const docgen: DocgenPayload = {
      id: 'button',
      name: 'Button',
      description: 'A button',
      summary: 'Click me',
      path: './button.stories.tsx',
      jsDocTags: {},
    };
    const storyDocs: StoryDocsPayload = {
      id: 'button',
      name: 'Button',
      path: './button.stories.tsx',
      stories: {
        'button--primary': { id: 'button--primary', name: 'Primary', snippet: '<Button />' },
      },
    };

    expect(
      toComponentManifestIndexEntries(['button'], { button: docgen }, { button: storyDocs })
    ).toEqual({
      button: {
        id: 'button',
        name: 'Button',
        description: 'A button',
        summary: 'Click me',
        docgen: { $ref: docgenManifestRef('button') },
        stories: { $ref: storyDocsManifestRef('button') },
      },
    });
  });

  it('merges docgen and story-docs payloads for the HTML debugger', () => {
    const docgen: DocgenPayload = {
      id: 'button',
      name: 'Button',
      path: './button.stories.tsx',
      jsDocTags: {},
      description: 'A button',
    };
    const storyDocs: StoryDocsPayload = {
      id: 'button',
      name: 'Button',
      path: './button.stories.tsx',
      import: 'import { Button } from "./Button";',
      stories: {
        'button--primary': { id: 'button--primary', name: 'Primary', snippet: '<Button />' },
      },
    };

    expect(mergeManifestPayloads(docgen, storyDocs)).toEqual({
      ...docgen,
      import: 'import { Button } from "./Button";',
      stories: {
        'button--primary': { id: 'button--primary', name: 'Primary', snippet: '<Button />' },
      },
    });
  });

  it('loads story-docs payloads from built snapshots on disk', async () => {
    const payload: StoryDocsPayload = {
      id: 'button',
      name: 'Button',
      path: './button.stories.tsx',
      stories: {},
    };
    vol.fromNestedJSON({
      '/output/services/core/story-docs/button.json': JSON.stringify({
        components: { button: payload },
      }),
    });

    await expect(loadStoryDocsPayloadsFromDisk('/output', ['button'])).resolves.toEqual({
      button: payload,
    });
  });

  it('builds index entries with a nested docgen ref when a payload exists', () => {
    const payload: DocgenPayload = {
      id: 'button',
      name: 'Button',
      description: 'A button',
      summary: 'Click me',
      path: './button.stories.tsx',
      jsDocTags: {},
    };

    expect(toComponentManifestIndexEntries(['button'], { button: payload })).toEqual({
      button: {
        id: 'button',
        name: 'Button',
        description: 'A button',
        summary: 'Click me',
        docgen: { $ref: docgenManifestRef('button') },
      },
    });
  });

  it('builds a minimal index entry (no docgen ref) when a payload is missing', () => {
    expect(toComponentManifestIndexEntries(['button'], {})).toEqual({
      button: { id: 'button', name: 'button' },
    });
  });
});
