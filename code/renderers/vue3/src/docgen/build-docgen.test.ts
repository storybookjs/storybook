import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import type { IndexEntry } from 'storybook/internal/types';

import {
  type ComponentMeta,
  type ComponentMetaChecker,
  type PropertyMeta,
  TypeMeta,
} from 'vue-component-meta';

import { type VueDocgenPayload, buildDocgenPayload } from './build-docgen.ts';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '__testfixtures__');

/**
 * Collapses this machine's fixture directory wherever the payload echoes a resolved path, so the
 * snapshots stay identical across machines and CI.
 */
const withStablePaths = <T>(value: T): T =>
  JSON.parse(
    JSON.stringify(value, (_key, entry) =>
      typeof entry === 'string' ? entry.split(fixturesDir).join('<fixtures>') : entry
    )
  );

/** The payload without the raw engine echo, which is large and asserted separately. */
const withoutRawMeta = (payload: VueDocgenPayload | undefined) => {
  const { vueComponentMeta, ...rest } = payload ?? {};
  return withStablePaths(rest);
};

const storyEntry: IndexEntry = {
  type: 'story',
  subtype: 'story',
  id: 'example-button--default',
  name: 'Default',
  title: 'Example/Button',
  importPath: './Button.stories.ts',
} as IndexEntry;

const prop = (overrides: Partial<PropertyMeta>): PropertyMeta =>
  ({
    description: '',
    global: false,
    required: false,
    tags: [],
    schema: 'string',
    type: 'string',
    declarations: [],
    // test serialization
    getDeclarations: () => [],
    getTypeObject: () => ({}),
    ...overrides,
  }) as unknown as PropertyMeta;

const buttonMeta: ComponentMeta = {
  type: TypeMeta.Class,
  description: 'Docgen description',
  props: [
    prop({ name: 'label', type: 'string', required: true, description: 'Text on the button.' }),
    prop({
      name: 'size',
      type: '"small" | "large" | undefined',
      schema: { kind: 'enum', type: '"small" | "large"', schema: ['"small"', '"large"'] },
    }),
  ],
  events: [],
  slots: [],
  exposed: [],
} as unknown as ComponentMeta;

function createChecker(meta: ComponentMeta | undefined): ComponentMetaChecker {
  return {
    getExportNames: () => (meta ? ['default'] : []),
    getComponentMeta: () => {
      if (!meta) {
        throw new Error('no meta');
      }
      return meta;
    },
    updateFile: vi.fn(),
    deleteFile: vi.fn(),
    reload: vi.fn(),
    clearCache: vi.fn(),
    getProgram: () => undefined,
  } as unknown as ComponentMetaChecker;
}

const build = (checker: ComponentMetaChecker, entry: IndexEntry = storyEntry) =>
  buildDocgenPayload(
    { entry },
    { getChecker: () => checker, resolvePath: (importPath) => join(fixturesDir, importPath) }
  );

describe('buildDocgenPayload', () => {
  it('builds the UI-facing payload from the component meta', async () => {
    const payload = await build(createChecker(buttonMeta));

    expect(withoutRawMeta(payload)).toMatchInlineSnapshot(`
      {
        "argTypes": {
          "label": {
            "description": "Text on the button.",
            "name": "label",
            "table": {
              "category": "props",
              "type": {
                "summary": "string",
              },
            },
            "type": {
              "name": "string",
              "required": true,
            },
          },
          "size": {
            "description": "",
            "name": "size",
            "table": {
              "category": "props",
              "type": {
                "summary": ""small" | "large"",
              },
            },
            "type": {
              "name": "enum",
              "required": false,
              "value": [
                "small",
                "large",
              ],
            },
          },
        },
        "description": "A button.",
        "id": "example-button",
        "jsDocTags": {
          "summary": [
            "Clickable ",
          ],
        },
        "name": "Button",
        "path": "./Button.stories.ts",
        "summary": "Clickable ",
      }
    `);
  });

  it('produces a payload that survives the worker boundary', async () => {
    const payload = await build(createChecker(buttonMeta));

    expect(() => structuredClone(payload)).not.toThrow();
    // Snapshotted raw, not through `withStablePaths`: that helper serializes to JSON, which would
    // drop the accessor methods itself and mask the very regression this pins.
    expect(payload?.vueComponentMeta?.props[0]).toMatchInlineSnapshot(`
      {
        "declarations": [],
        "description": "Text on the button.",
        "global": false,
        "name": "label",
        "required": true,
        "schema": "string",
        "tags": [],
        "type": "string",
      }
    `);
  });

  it('keeps the raw component meta for non-UI consumers', async () => {
    const payload = await build(createChecker(buttonMeta));
    const { exportName, displayName, sourceFiles } = payload?.vueComponentMeta ?? {};

    expect(withStablePaths({ exportName, displayName, sourceFiles })).toMatchInlineSnapshot(`
      {
        "displayName": "Button",
        "exportName": "default",
        "sourceFiles": "<fixtures>/Button.vue",
      }
    `);
  });

  it('reports an error payload when the story file names no component', async () => {
    const payload = await build(createChecker(buttonMeta), {
      ...storyEntry,
      importPath: './NoComponent.stories.ts',
    } as IndexEntry);

    expect(payload?.argTypes).toBeUndefined();
    expect(withoutRawMeta(payload)).toMatchInlineSnapshot(`
      {
        "error": {
          "message": "We could not detect the component from your story file. Specify meta.component.
        1 | // Fixture read from disk by the docgen tests: a story file that names no component.
      > 2 | export default {
          | ^
        3 |   title: 'Example/Button',
        4 | };
        5 |

      ./NoComponent.stories.ts:
      // Fixture read from disk by the docgen tests: a story file that names no component.
      export default {
        title: 'Example/Button',
      };

      export const Default = { args: { label: 'Hello' } };
      ",
          "name": "No component found",
        },
        "id": "example-button",
        "jsDocTags": {},
        "name": "Button",
        "path": "./NoComponent.stories.ts",
      }
    `);
  });

  // The indexer parsed this file with the same loader to produce the entry, so a parse failure here
  // is a version skew or a bug on our side — it must surface, not fall through as "no docgen".
  it('reports an error payload when the story file cannot be parsed', async () => {
    const payload = await build(createChecker(buttonMeta), {
      ...storyEntry,
      importPath: './Unparseable.stories.ts.txt',
    } as IndexEntry);

    expect(payload?.argTypes).toBeUndefined();
    expect(payload?.error?.name).toMatchInlineSnapshot(`"Story file could not be parsed"`);
    // The name falls back to the title segment: `meta.component` is unreadable without a parse.
    expect(payload?.name).toMatchInlineSnapshot(`"Button"`);
  });

  it('reports an error payload when the engine extracts no metadata', async () => {
    const payload = await build(createChecker(undefined));

    expect(payload?.argTypes).toBeUndefined();
    expect(withStablePaths(payload?.error)).toMatchInlineSnapshot(`
      {
        "message": "vue-component-meta extracted no component metadata for the "default" export of <fixtures>/Button.vue.",
        "name": "No docgen found",
      }
    `);
  });

  it('falls through when the entry has no story file', async () => {
    await expect(
      build(createChecker(buttonMeta), { ...storyEntry, type: 'docs' } as IndexEntry)
    ).resolves.toBeUndefined();
  });

  it('falls through when the story file cannot be read', async () => {
    await expect(
      build(createChecker(buttonMeta), {
        ...storyEntry,
        importPath: './Missing.stories.ts',
      } as IndexEntry)
    ).resolves.toBeUndefined();
  });
});
