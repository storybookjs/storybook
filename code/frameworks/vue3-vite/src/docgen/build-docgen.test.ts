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

import { buildDocgenPayload } from './build-docgen.ts';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '__testfixtures__');

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
    { checker, resolvePath: (importPath) => join(fixturesDir, importPath) }
  );

describe('buildDocgenPayload', () => {
  it('builds a payload with argTypes converted from the component meta', async () => {
    const payload = await build(createChecker(buttonMeta));

    expect(payload).toMatchObject({
      id: 'example-button',
      name: 'Button',
      path: './Button.stories.ts',
    });
    expect(payload?.argTypes?.label).toMatchObject({
      name: 'label',
      description: 'Text on the button.',
      type: { name: 'string', required: true },
      table: { category: 'props' },
    });
    expect(payload?.argTypes?.size?.type).toEqual({
      name: 'enum',
      value: ['small', 'large'],
      required: false,
    });
  });

  // The worker posts the payload with `postMessage`, so anything a structured clone cannot carry is
  // not a cosmetic problem: it throws `DataCloneError`, which fails a static build and silently
  // yields no docgen in dev.
  it('produces a payload that survives the worker boundary', async () => {
    const payload = await build(createChecker(buttonMeta));

    expect(() => structuredClone(payload)).not.toThrow();
    expect(payload?.vueComponentMeta?.props[0]).not.toHaveProperty('getDeclarations');
    expect(payload?.vueComponentMeta?.props[0]).not.toHaveProperty('getTypeObject');
  });

  it('keeps the raw component meta for non-UI consumers', async () => {
    const payload = await build(createChecker(buttonMeta));

    expect(payload?.vueComponentMeta).toMatchObject({
      exportName: 'default',
      displayName: 'Button',
      sourceFiles: join(fixturesDir, 'Button.vue'),
    });
  });

  it('prefers the CSF meta docblock over the docgen description and reads its tags', async () => {
    const payload = await build(createChecker(buttonMeta));

    // Tag values keep the `name description` join that every docgen provider uses, hence the
    // trailing space on a tag with no description part.
    expect(payload).toMatchObject({
      description: 'A button.',
      summary: 'Clickable ',
      jsDocTags: { summary: ['Clickable '] },
    });
  });

  it('reports an error payload when the story file names no component', async () => {
    const payload = await build(createChecker(buttonMeta), {
      ...storyEntry,
      importPath: './NoComponent.stories.ts',
    } as IndexEntry);

    expect(payload?.argTypes).toBeUndefined();
    expect(payload?.error?.name).toBe('No component found');
    expect(payload?.error?.message).toContain('Specify meta.component');
  });

  it('reports an error payload when the engine extracts no metadata', async () => {
    const payload = await build(createChecker(undefined));

    expect(payload?.error).toMatchObject({ name: 'No docgen found' });
    expect(payload?.argTypes).toBeUndefined();
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
