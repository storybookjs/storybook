import type { IndexEntry } from 'storybook/internal/types';

import { readFileSync } from 'node:fs';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fs as memfs, vol } from 'memfs';

import type { BuildDocgenContext, WebComponentsDocgenOptions } from './build-docgen.ts';
import { buildDocgenPayload } from './build-docgen.ts';
import type { ManifestLoadResult } from './manifest/load-manifest.ts';

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

const options: WebComponentsDocgenOptions = {
  manifestPaths: ['/workspace/custom-elements.json'],
};

const entry: IndexEntry = {
  id: 'fixture--basic',
  name: 'Basic',
  title: 'Fixture',
  type: 'story',
  subtype: 'story',
  importPath: './input.stories.ts',
};

const givenStory = (component: string) => {
  vol.fromNestedJSON({
    [STORY_PATH]: `export default { title: 'Fixture', component: ${component} };`,
  });
};

const context = (
  manifests: ManifestLoadResult[],
  overrideOptions: Partial<WebComponentsDocgenOptions> = {}
): BuildDocgenContext => ({
  manifests,
  options: { ...options, ...overrideOptions },
});

const manifest = (declaration: Record<string, unknown>): ManifestLoadResult => ({
  path: '/workspace/custom-elements.json',
  manifest: {
    modules: [{ declarations: [declaration] }],
  },
});

describe('buildDocgenPayload', () => {
  it('builds a payload from the matching manifest declaration', () => {
    givenStory("'x-card'");

    expect(
      buildDocgenPayload(
        { entry },
        context([
          manifest({
            name: 'XCard',
            tagName: 'x-card',
            description: '  Card description.  ',
            summary: '  Card summary.  ',
            attributes: [{ name: 'label', description: 'Label.', type: { text: 'string' } }],
          }),
        ])
      )
    ).toMatchInlineSnapshot(`
      {
        "argTypes": {
          "label": {
            "description": "Label.",
            "name": "label",
            "required": false,
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
            "description": "  Card description.  ",
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
        return context([manifest({ name: 'XCard', tagName: 'x-card' })]);
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
      'no-manifest',
      () => {
        givenStory("'x-card'");
        return context([], { manifestPaths: [] });
      },
      {
        id: 'fixture',
        name: 'x-card',
        path: './input.stories.ts',
        jsDocTags: {},
        error: {
          name: 'no-manifest',
          message:
            'No Custom Elements Manifest paths were configured. Set the `customElementsManifest` framework option or package.json#customElements.',
        },
      },
    ],
    [
      'manifest-invalid',
      () => {
        givenStory("'x-card'");
        return context([
          {
            path: '/workspace/custom-elements.json',
            error: {
              name: 'manifest-invalid',
              message:
                'Invalid Custom Elements Manifest at /workspace/custom-elements.json: expected a top-level modules array.',
            },
          },
        ]);
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
        return context([
          {
            path: '/workspace/custom-elements.json',
            error: {
              name: 'manifest-unsupported',
              message:
                '/workspace/custom-elements.json uses the web-component-analyzer manifest shape. The Storybook docgen server reads Custom Elements Manifests only; generate one with @custom-elements-manifest/analyzer.',
            },
          },
        ]);
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
        return context([manifest({ name: 'OtherCard', tagName: 'other-card' })]);
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
  ])('reports %s', (_name, buildContext, expected) => {
    expect(buildDocgenPayload({ entry }, buildContext())).toEqual(expected);
  });

  it('falls through when the story has no meta.component', () => {
    vol.fromNestedJSON({ [STORY_PATH]: `export default { title: 'Fixture' };` });

    expect(
      buildDocgenPayload({ entry }, context([manifest({ name: 'XCard', tagName: 'x-card' })]))
    ).toBeUndefined();
  });
});
