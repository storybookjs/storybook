import type { DocgenError, IndexEntry } from 'storybook/internal/types';

import { readFileSync } from 'node:fs';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fs as memfs, vol } from 'memfs';

import type { BuildDocgenContext } from './build-docgen.ts';
import { buildDocgenPayload } from './build-docgen.ts';
import type { ManifestTag } from './manifest/manifest-manager.ts';
import type { ManifestDeclaration } from './manifest/types.ts';

vi.mock('node:fs', { spy: true });

beforeEach(() => {
  vol.reset();
  vi.spyOn(process, 'cwd').mockReturnValue('/workspace');
  vi.mocked(readFileSync).mockImplementation(memfs.readFileSync as typeof readFileSync);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const STORY_PATH = '/workspace/input.stories.ts';

const entry: IndexEntry = {
  id: 'fixture--basic',
  name: 'Basic',
  title: 'Fixture',
  type: 'story',
  subtype: 'story',
  importPath: './input.stories.ts',
};

const givenStory = (component: string): void => {
  vol.fromNestedJSON({
    [STORY_PATH]: `export default { title: 'Fixture', component: ${component} };`,
  });
};

const context = ({
  tags = [],
  loadErrors = [],
  paths = ['custom-elements.json'],
}: {
  tags?: [string, ManifestTag][];
  loadErrors?: DocgenError[];
  paths?: string[];
}): BuildDocgenContext => ({
  manifests: {
    tags: new Map(tags),
    errors: loadErrors,
    paths,
  },
  typeProperty: 'parsedType',
});

const tag = (declaration: ManifestDeclaration, warning?: string): [string, ManifestTag] => [
  declaration.tagName ?? declaration.name,
  {
    declaration,
    manifestPath: 'custom-elements.json',
    ...(warning ? { warning } : {}),
  },
];

describe('buildDocgenPayload', () => {
  it('builds a payload from the matching manifest declaration', () => {
    givenStory("'x-card'");

    expect(
      buildDocgenPayload(
        { entry },
        context({
          tags: [
            tag({
              name: 'XCard',
              customElement: true,
              kind: 'class',
              tagName: 'x-card',
              description: '  Card description.  ',
              summary: '  Card summary.  ',
              attributes: [{ name: 'label', description: 'Label.', type: { text: 'string' } }],
            }),
          ],
        })
      )
    ).toMatchInlineSnapshot(`
      {
        "argTypes": {
          "label": {
            "description": "Label.",
            "name": "label",
            "table": {
              "category": "attributes",
              "defaultValue": {
                "summary": undefined,
              },
              "type": {
                "summary": "string",
              },
            },
            "type": {
              "name": "string",
            },
          },
        },
        "customElementsManifest": {
          "declaration": {
            "attributes": [
              {
                "description": "Label.",
                "name": "label",
                "type": {
                  "text": "string",
                },
              },
            ],
            "customElement": true,
            "description": "  Card description.  ",
            "kind": "class",
            "name": "XCard",
            "summary": "  Card summary.  ",
            "tagName": "x-card",
          },
          "manifestPath": "custom-elements.json",
        },
        "description": "Card description.",
        "id": "fixture",
        "jsDocTags": {},
        "name": "x-card",
        "path": "./input.stories.ts",
        "renderer": "web-components",
        "summary": "Card summary.",
      }
    `);
  });

  it.each([
    [
      'component-not-a-tag',
      () => {
        givenStory('Button');
        return context({
          tags: [tag({ name: 'XCard', customElement: true, kind: 'class', tagName: 'x-card' })],
        });
      },
      {
        id: 'fixture',
        name: 'Fixture',
        path: './input.stories.ts',
        jsDocTags: {},
        error: {
          name: 'component-not-a-tag',
          message: "`meta.component` must be the element's tag name as a string, got `Button`",
        },
      },
    ],
    [
      'manifest-invalid',
      () => {
        givenStory("'x-card'");
        return context({
          loadErrors: [
            {
              name: 'manifest-invalid',
              message:
                'Invalid Custom Elements Manifest at custom-elements.json: expected a top-level modules array.',
            },
          ],
          paths: ['custom-elements.json'],
        });
      },
      {
        id: 'fixture',
        name: 'x-card',
        path: './input.stories.ts',
        jsDocTags: {},
        error: {
          name: 'manifest-invalid',
          message:
            'Invalid Custom Elements Manifest at custom-elements.json: expected a top-level modules array.',
        },
      },
    ],
    [
      'manifest-unsupported',
      () => {
        givenStory("'x-card'");
        return context({
          loadErrors: [
            {
              name: 'manifest-unsupported',
              message:
                'custom-elements.json uses the web-component-analyzer manifest shape. The Storybook docgen server reads Custom Elements Manifests only; generate one with @custom-elements-manifest/analyzer.',
            },
          ],
          paths: ['custom-elements.json'],
        });
      },
      {
        id: 'fixture',
        name: 'x-card',
        path: './input.stories.ts',
        jsDocTags: {},
        error: {
          name: 'manifest-unsupported',
          message:
            'custom-elements.json uses the web-component-analyzer manifest shape. The Storybook docgen server reads Custom Elements Manifests only; generate one with @custom-elements-manifest/analyzer.',
        },
      },
    ],
    [
      'tag-not-found',
      () => {
        givenStory("'x-card'");
        return context({
          tags: [
            tag({
              name: 'OtherCard',
              customElement: true,
              kind: 'class',
              tagName: 'other-card',
            }),
          ],
        });
      },
      {
        id: 'fixture',
        name: 'x-card',
        path: './input.stories.ts',
        jsDocTags: {},
        error: {
          name: 'tag-not-found',
          message:
            'No declaration for "x-card" was found in custom-elements.json. If the element is new, rerun the custom elements manifest analyzer.',
        },
      },
    ],
    [
      'load error with no entry',
      () => {
        givenStory("'x-card'");
        return context({
          loadErrors: [
            {
              name: 'manifest-invalid',
              message: 'Invalid Custom Elements Manifest at custom-elements.json: nope',
            },
          ],
          paths: ['custom-elements.json'],
        });
      },
      {
        id: 'fixture',
        name: 'x-card',
        path: './input.stories.ts',
        jsDocTags: {},
        error: {
          name: 'manifest-invalid',
          message: 'Invalid Custom Elements Manifest at custom-elements.json: nope',
        },
      },
    ],
  ])('reports %s', (_name, buildContext, expected) => {
    expect(buildDocgenPayload({ entry }, buildContext())).toEqual(expected);
  });

  it('copies manifest warnings to resolved payloads', () => {
    givenStory("'x-card'");

    expect(
      buildDocgenPayload(
        { entry },
        context({
          tags: [
            tag(
              { name: 'XCard', customElement: true, kind: 'class', tagName: 'x-card' },
              'custom-elements.json has 1 schema violation(s); first: /modules/0 must match'
            ),
          ],
        })
      )
    ).toMatchObject({
      warning: 'custom-elements.json has 1 schema violation(s); first: /modules/0 must match',
    });
  });

  it('falls through when the story has no meta.component', () => {
    vol.fromNestedJSON({ [STORY_PATH]: `export default { title: 'Fixture' };` });

    expect(
      buildDocgenPayload(
        { entry },
        context({
          tags: [tag({ name: 'XCard', customElement: true, kind: 'class', tagName: 'x-card' })],
        })
      )
    ).toBeUndefined();
  });
});
