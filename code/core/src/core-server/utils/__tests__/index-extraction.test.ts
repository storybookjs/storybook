import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { normalizeStoriesEntry } from '@storybook/core/common';
import type { NormalizedStoriesSpecifier } from '@storybook/core/types';

import type { StoryIndexGeneratorOptions } from '../StoryIndexGenerator';
import { AUTODOCS_TAG, StoryIndexGenerator } from '../StoryIndexGenerator';

vi.mock('@storybook/core/node-logger');

const options: StoryIndexGeneratorOptions = {
  configDir: join(__dirname, '..', '__mockdata__'),
  workingDir: join(__dirname, '..', '__mockdata__'),
  indexers: [],
  docs: { defaultName: 'docs', autodocs: false },
};

describe('story extraction', () => {
  it('extracts stories from full indexer inputs', async () => {
    const relativePath = './src/A.stories.js';
    const absolutePath = join(options.workingDir, relativePath);
    const specifier: NormalizedStoriesSpecifier = normalizeStoriesEntry(relativePath, options);

    const generator = new StoryIndexGenerator([specifier], {
      ...options,
      indexers: [
        {
          test: /\.stories\.(m?js|ts)x?$/,
          createIndex: async (fileName) => [
            // properties identical to the auto-generated ones, eg. 'StoryOne' -> 'Story One'
            {
              type: 'story',
              importPath: fileName,
              exportName: 'StoryOne',
              name: 'Story One',
              title: 'A',
              metaId: 'a',
              tags: ['story-tag-from-indexer'],
              __id: 'a--story-one',
            },
            // properties different from the auto-generated ones, eg. 'StoryOne' -> 'Another Story Name'
            {
              type: 'story',
              importPath: fileName,
              exportName: 'StoryOne',
              name: 'Another Story Name',
              title: 'Custom Title',
              metaId: 'custom-id',
              tags: ['story-tag-from-indexer'],
              __id: 'some-fully-custom-id',
            },
          ],
        },
      ],
    });
    const result = await generator.extractStories(specifier, absolutePath);

    expect(result).toMatchInlineSnapshot(`
      {
        "dependents": [],
        "entries": [
          {
            "componentPath": undefined,
            "extra": {
              "metaId": "a",
              "stats": {},
            },
            "id": "a--story-one",
            "importPath": "./src/A.stories.js",
            "name": "Story One",
            "tags": [
              "story-tag-from-indexer",
            ],
            "title": "A",
            "type": "story",
          },
          {
            "componentPath": undefined,
            "extra": {
              "metaId": "custom-id",
              "stats": {},
            },
            "id": "some-fully-custom-id",
            "importPath": "./src/A.stories.js",
            "name": "Another Story Name",
            "tags": [
              "story-tag-from-indexer",
            ],
            "title": "Custom Title",
            "type": "story",
          },
        ],
        "type": "stories",
      }
    `);
  });

  it('extracts stories from minimal indexer inputs', async () => {
    const relativePath = './src/first-nested/deeply/F.stories.js';
    const absolutePath = join(options.workingDir, relativePath);
    const specifier: NormalizedStoriesSpecifier = normalizeStoriesEntry(relativePath, options);

    const generator = new StoryIndexGenerator([specifier], {
      ...options,
      indexers: [
        {
          test: /\.stories\.(m?js|ts)x?$/,
          createIndex: async (fileName) => [
            {
              exportName: 'StoryOne',
              importPath: fileName,
              type: 'story',
            },
          ],
        },
      ],
    });
    const result = await generator.extractStories(specifier, absolutePath);

    expect(result).toMatchInlineSnapshot(`
      {
        "dependents": [],
        "entries": [
          {
            "componentPath": undefined,
            "extra": {
              "metaId": undefined,
              "stats": {},
            },
            "id": "f--story-one",
            "importPath": "./src/first-nested/deeply/F.stories.js",
            "name": "Story One",
            "tags": [],
            "title": "F",
            "type": "story",
          },
        ],
        "type": "stories",
      }
    `);
  });

  it('auto-generates title from indexer inputs without title', async () => {
    const relativePath = './src/first-nested/deeply/F.stories.js';
    const absolutePath = join(options.workingDir, relativePath);
    const specifier: NormalizedStoriesSpecifier = normalizeStoriesEntry(relativePath, options);

    const generator = new StoryIndexGenerator([specifier], {
      ...options,
      indexers: [
        {
          test: /\.stories\.(m?js|ts)x?$/,
          createIndex: async (fileName) => [
            {
              exportName: 'StoryOne',
              __id: 'a--story-one',
              name: 'Story One',
              metaId: 'a',
              tags: ['story-tag-from-indexer'],
              importPath: fileName,
              type: 'story',
            },
          ],
        },
      ],
    });
    const result = await generator.extractStories(specifier, absolutePath);

    expect(result).toMatchInlineSnapshot(`
      {
        "dependents": [],
        "entries": [
          {
            "componentPath": undefined,
            "extra": {
              "metaId": "a",
              "stats": {},
            },
            "id": "a--story-one",
            "importPath": "./src/first-nested/deeply/F.stories.js",
            "name": "Story One",
            "tags": [
              "story-tag-from-indexer",
            ],
            "title": "F",
            "type": "story",
          },
        ],
        "type": "stories",
      }
    `);
  });

  it('auto-generates name from indexer inputs without name', async () => {
    const relativePath = './src/A.stories.js';
    const absolutePath = join(options.workingDir, relativePath);
    const specifier: NormalizedStoriesSpecifier = normalizeStoriesEntry(relativePath, options);

    const generator = new StoryIndexGenerator([specifier], {
      ...options,
      indexers: [
        {
          test: /\.stories\.(m?js|ts)x?$/,
          createIndex: async (fileName) => [
            {
              exportName: 'StoryOne',
              __id: 'a--story-one',
              title: 'A',
              metaId: 'a',
              tags: ['story-tag-from-indexer'],
              importPath: fileName,
              type: 'story',
            },
          ],
        },
      ],
    });
    const result = await generator.extractStories(specifier, absolutePath);

    expect(result).toMatchInlineSnapshot(`
      {
        "dependents": [],
        "entries": [
          {
            "componentPath": undefined,
            "extra": {
              "metaId": "a",
              "stats": {},
            },
            "id": "a--story-one",
            "importPath": "./src/A.stories.js",
            "name": "Story One",
            "tags": [
              "story-tag-from-indexer",
            ],
            "title": "A",
            "type": "story",
          },
        ],
        "type": "stories",
      }
    `);
  });

  it('auto-generates id', async () => {
    const relativePath = './src/A.stories.js';
    const absolutePath = join(options.workingDir, relativePath);
    const specifier: NormalizedStoriesSpecifier = normalizeStoriesEntry(relativePath, options);

    const generator = new StoryIndexGenerator([specifier], {
      ...options,
      indexers: [
        {
          test: /\.stories\.(m?js|ts)x?$/,
          createIndex: async (fileName) => [
            // exportName + title -> id
            {
              exportName: 'StoryOne',
              name: 'Story One',
              title: 'A',
              tags: ['story-tag-from-indexer'],
              importPath: fileName,
              type: 'story',
            },
            // exportName + custom title (ignoring custom name) -> id
            {
              exportName: 'StoryTwo',
              name: 'Custom Name For Second Story',
              title: 'Custom Title',
              tags: ['story-tag-from-indexer'],
              importPath: fileName,
              type: 'story',
            },
            // exportName + custom metaId (ignoring custom title and name) -> id
            {
              exportName: 'StoryThree',
              metaId: 'custom-meta-id',
              title: 'Custom Title',
              tags: ['story-tag-from-indexer'],
              importPath: fileName,
              type: 'story',
            },
          ],
        },
      ],
    });
    const result = await generator.extractStories(specifier, absolutePath);

    expect(result).toMatchInlineSnapshot(`
      {
        "dependents": [],
        "entries": [
          {
            "componentPath": undefined,
            "extra": {
              "metaId": undefined,
              "stats": {},
            },
            "id": "a--story-one",
            "importPath": "./src/A.stories.js",
            "name": "Story One",
            "tags": [
              "story-tag-from-indexer",
            ],
            "title": "A",
            "type": "story",
          },
          {
            "componentPath": undefined,
            "extra": {
              "metaId": undefined,
              "stats": {},
            },
            "id": "custom-title--story-two",
            "importPath": "./src/A.stories.js",
            "name": "Custom Name For Second Story",
            "tags": [
              "story-tag-from-indexer",
            ],
            "title": "Custom Title",
            "type": "story",
          },
          {
            "componentPath": undefined,
            "extra": {
              "metaId": "custom-meta-id",
              "stats": {},
            },
            "id": "custom-meta-id--story-three",
            "importPath": "./src/A.stories.js",
            "name": "Story Three",
            "tags": [
              "story-tag-from-indexer",
            ],
            "title": "Custom Title",
            "type": "story",
          },
        ],
        "type": "stories",
      }
    `);
  });

  it('auto-generates id, title and name from exportName input', async () => {
    const relativePath = './src/A.stories.js';
    const absolutePath = join(options.workingDir, relativePath);
    const specifier: NormalizedStoriesSpecifier = normalizeStoriesEntry(relativePath, options);

    const generator = new StoryIndexGenerator([specifier], {
      ...options,
      indexers: [
        {
          test: /\.stories\.(m?js|ts)x?$/,
          createIndex: async (fileName) => [
            {
              exportName: 'StoryOne',
              tags: ['story-tag-from-indexer'],
              importPath: fileName,
              type: 'story',
            },
          ],
        },
      ],
    });
    const result = await generator.extractStories(specifier, absolutePath);

    expect(result).toMatchInlineSnapshot(`
      {
        "dependents": [],
        "entries": [
          {
            "componentPath": undefined,
            "extra": {
              "metaId": undefined,
              "stats": {},
            },
            "id": "a--story-one",
            "importPath": "./src/A.stories.js",
            "name": "Story One",
            "tags": [
              "story-tag-from-indexer",
            ],
            "title": "A",
            "type": "story",
          },
        ],
        "type": "stories",
      }
    `);
  });
});
describe('docs entries from story extraction', () => {
  it('adds docs entry when autodocs is globally enabled', async () => {
    const relativePath = './src/A.stories.js';
    const absolutePath = join(options.workingDir, relativePath);
    const specifier: NormalizedStoriesSpecifier = normalizeStoriesEntry(relativePath, options);

    const generator = new StoryIndexGenerator([specifier], {
      ...options,
      docs: { defaultName: 'docs', autodocs: true },
      indexers: [
        {
          test: /\.stories\.(m?js|ts)x?$/,
          createIndex: async (fileName) => [
            {
              exportName: 'StoryOne',
              __id: 'a--story-one',
              name: 'Story One',
              title: 'A',
              tags: ['story-tag-from-indexer'],
              importPath: fileName,
              type: 'story',
            },
          ],
        },
      ],
    });
    const result = await generator.extractStories(specifier, absolutePath);

    expect(result).toMatchInlineSnapshot(`
      {
        "dependents": [],
        "entries": [
          {
            "componentPath": undefined,
            "extra": {
              "metaId": undefined,
              "stats": {},
            },
            "id": "a--story-one",
            "importPath": "./src/A.stories.js",
            "name": "Story One",
            "tags": [
              "story-tag-from-indexer",
            ],
            "title": "A",
            "type": "story",
          },
        ],
        "type": "stories",
      }
    `);
  });
  it(`adds docs entry when autodocs is "tag" and an entry has the "${AUTODOCS_TAG}" tag`, async () => {
    const relativePath = './src/A.stories.js';
    const absolutePath = join(options.workingDir, relativePath);
    const specifier: NormalizedStoriesSpecifier = normalizeStoriesEntry(relativePath, options);

    const generator = new StoryIndexGenerator([specifier], {
      ...options,
      docs: { defaultName: 'docs', autodocs: 'tag' },
      indexers: [
        {
          test: /\.stories\.(m?js|ts)x?$/,
          createIndex: async (fileName) => [
            {
              exportName: 'StoryOne',
              __id: 'a--story-one',
              name: 'Story One',
              title: 'A',
              tags: [AUTODOCS_TAG, 'story-tag-from-indexer'],
              importPath: fileName,
              type: 'story',
            },
          ],
        },
      ],
    });
    const result = await generator.extractStories(specifier, absolutePath);

    expect(result).toMatchInlineSnapshot(`
      {
        "dependents": [],
        "entries": [
          {
            "headings": [
              "Story One",
            ],
            "id": "a--docs",
            "importPath": "./src/A.stories.js",
            "name": "docs",
            "storiesImports": [],
            "tags": [
              "autodocs",
              "story-tag-from-indexer",
            ],
            "title": "A",
            "type": "docs",
          },
          {
            "componentPath": undefined,
            "extra": {
              "metaId": undefined,
              "stats": {},
            },
            "id": "a--story-one",
            "importPath": "./src/A.stories.js",
            "name": "Story One",
            "tags": [
              "autodocs",
              "story-tag-from-indexer",
            ],
            "title": "A",
            "type": "story",
          },
        ],
        "type": "stories",
      }
    `);
  });
  it(`DOES NOT adds docs entry when autodocs is false and an entry has the "${AUTODOCS_TAG}" tag`, async () => {
    const relativePath = './src/A.stories.js';
    const absolutePath = join(options.workingDir, relativePath);
    const specifier: NormalizedStoriesSpecifier = normalizeStoriesEntry(relativePath, options);

    const generator = new StoryIndexGenerator([specifier], {
      ...options,
      docs: { defaultName: 'docs', autodocs: false },
      indexers: [
        {
          test: /\.stories\.(m?js|ts)x?$/,
          createIndex: async (fileName) => [
            {
              exportName: 'StoryOne',
              __id: 'a--story-one',
              name: 'Story One',
              title: 'A',
              tags: [AUTODOCS_TAG, 'story-tag-from-indexer'],
              importPath: fileName,
              type: 'story',
            },
          ],
        },
      ],
    });
    const result = await generator.extractStories(specifier, absolutePath);

    expect(result).toMatchInlineSnapshot(`
      {
        "dependents": [],
        "entries": [
          {
            "componentPath": undefined,
            "extra": {
              "metaId": undefined,
              "stats": {},
            },
            "id": "a--story-one",
            "importPath": "./src/A.stories.js",
            "name": "Story One",
            "tags": [
              "autodocs",
              "story-tag-from-indexer",
            ],
            "title": "A",
            "type": "story",
          },
        ],
        "type": "stories",
      }
    `);
  });
});
