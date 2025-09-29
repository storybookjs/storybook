import { describe, expect, it } from 'vitest';

import { buildIndex } from './build-index';

describe('buildIndex', () => {
  it.skip('should build index', async () => {
    const index = await buildIndex({
      configDir: `${__dirname}/utils/__mockdata__`,
    });
    expect(index).toMatchInlineSnapshot(`
      {
        "entries": {
          "my-component-a--story-one": {
            "componentPath": undefined,
            "id": "my-component-a--story-one",
            "importPath": "./core/src/core-server/utils/__mockdata__/docs-id-generation/A.stories.jsx",
            "name": "Story One",
            "subtype": "story",
            "tags": [
              "dev",
              "test",
              "autodocs",
            ],
            "title": "A",
            "type": "story",
          },
          "my-component-b--docs": {
            "id": "my-component-b--docs",
            "importPath": "./core/src/core-server/utils/__mockdata__/docs-id-generation/B.docs.mdx",
            "name": "Docs",
            "storiesImports": [
              "./core/src/core-server/utils/__mockdata__/docs-id-generation/B.stories.jsx",
            ],
            "tags": [
              "dev",
              "test",
              "attached-mdx",
            ],
            "title": "B",
            "type": "docs",
          },
          "my-component-b--story-one": {
            "componentPath": undefined,
            "id": "my-component-b--story-one",
            "importPath": "./core/src/core-server/utils/__mockdata__/docs-id-generation/B.stories.jsx",
            "name": "Story One",
            "subtype": "story",
            "tags": [
              "dev",
              "test",
            ],
            "title": "B",
            "type": "story",
          },
        },
        "v": 5,
      }
    `);
  });
});
