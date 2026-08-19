import type { IndexEntry } from 'storybook/internal/types';

import { readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { vol } from 'memfs';

import type { AngularClassMeta, AngularComponentMetaResult } from '@storybook/angular-cm';
import type { AngularComponentMetaSource, BuildDocgenContext } from './build-docgen.ts';
import { buildDocgenPayload } from './build-docgen.ts';

vi.mock('node:fs', { spy: true });

beforeEach(async () => {
  vol.reset();
  const memfs = await vi.importActual<typeof import('memfs')>('memfs');
  vi.mocked(readFileSync).mockImplementation(memfs.fs.readFileSync as typeof readFileSync);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// The story files sit in the fixtures directory next to the component modules they import, because
// module resolution reads the real filesystem; only the story files' contents come from memfs.
const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '__testfixtures__');
const STORY_PATH = join(FIXTURES, 'button.stories.ts');
const COMPONENT_PATH = join(FIXTURES, 'button.component.ts');

const entry: IndexEntry = {
  id: 'button--default',
  name: 'Default',
  title: 'Button',
  type: 'story',
  subtype: 'story',
  // The story index writes `importPath` relative to the worker's cwd.
  importPath: relative(process.cwd(), STORY_PATH),
};

// The shared parsing module warns, and `vitest-setup.ts` fails the run on console.warn.
const logger = { warn: vi.fn(), debug: vi.fn() };

const givenStoryFile = (
  source = `
    import { ButtonComponent } from './button.component';
    export default { title: 'Button', component: ButtonComponent };
    export const Default = {};
  `
) => {
  vol.fromNestedJSON({ [STORY_PATH]: source });
};

const componentEntry = (overrides: Record<string, unknown> = {}): AngularClassMeta =>
  ({
    name: 'ButtonComponent',
    type: 'component',
    file: COMPONENT_PATH,
    description: 'Renders a button.',
    rawdescription: 'Renders a button.',
    propertiesClass: [],
    methodsClass: [],
    outputsClass: [],
    inputsClass: [
      {
        name: 'label',
        type: 'string',
        optional: false,
        initializer: { kind: 'literal', literalKind: 'string', text: "'Click me'" },
      },
    ],
    ...overrides,
  }) as unknown as AngularClassMeta;

const metaFor = (classMeta: AngularClassMeta): AngularComponentMetaResult =>
  ({ entry: classMeta, json: { components: [classMeta] } }) as AngularComponentMetaResult;

const managerReturning = (meta: AngularComponentMetaResult | undefined) => ({
  extractComponentMeta: vi.fn<AngularComponentMetaSource['extractComponentMeta']>(() => meta),
});

const context = (
  manager: AngularComponentMetaSource,
  options: BuildDocgenContext['options'] = { propsTable: 'all' }
): BuildDocgenContext => ({ manager, options, logger });

describe('buildDocgenPayload', () => {
  it('extracts argTypes from the analyzer and derives the snippet meta', () => {
    givenStoryFile();
    const classMeta = componentEntry();
    const manager = managerReturning(metaFor(classMeta));

    const payload = buildDocgenPayload({ entry }, context(manager));

    expect(manager.extractComponentMeta).toHaveBeenCalledExactlyOnceWith(COMPONENT_PATH, {
      exportName: 'ButtonComponent',
      localName: 'ButtonComponent',
    });
    expect(payload).toMatchObject({
      id: 'button',
      name: 'ButtonComponent',
      path: entry.importPath,
      description: 'Renders a button.',
      jsDocTags: {},
      renderer: 'angular',
      apiDescription: expect.stringContaining('export type ButtonComponentInputs = {'),
    });
    expect(payload?.argTypes?.label).toMatchObject({
      name: 'label',
      table: { category: 'inputs', defaultValue: { summary: 'Click me' } },
    });
    expect(payload?.angularComponentMeta).toEqual({
      name: 'ButtonComponent',
      selector: undefined,
      standalone: true,
      inputs: ['label'],
      outputs: [],
      enums: [],
    });
    expect(payload?.compodoc).toBeUndefined();
    expect(payload?.subcomponents).toBeUndefined();
    expect(payload?.error).toBeUndefined();
  });

  it('marks the snippet meta non-standalone only for an explicit `standalone: false`', () => {
    givenStoryFile();
    const manager = managerReturning(metaFor(componentEntry({ standalone: false })));

    const payload = buildDocgenPayload({ entry }, context(manager));

    expect(payload?.angularComponentMeta?.standalone).toBe(false);
  });

  describe('description and JSDoc tags', () => {
    it.each([
      [
        'prefers the trimmed rawdescription',
        '\n\nRenders a button.\n',
        'ignored',
        'Renders a button.',
      ],
      [
        'falls back to the description when rawdescription is empty',
        '',
        'Renders a button.',
        'Renders a button.',
      ],
      ['reports no description when both are empty', '', '', undefined],
    ])('%s', (_name, rawdescription, description, expected) => {
      givenStoryFile();
      const manager = managerReturning(metaFor(componentEntry({ rawdescription, description })));

      expect(buildDocgenPayload({ entry }, context(manager))?.description).toBe(expected);
    });

    it('publishes the analyzer`s own tags and sources `summary` from a @summary tag', () => {
      givenStoryFile();
      const tag = (name: string, comment?: string) => ({ tagName: { escapedText: name }, comment });
      const manager = managerReturning(
        metaFor(
          componentEntry({
            jsdoctags: [
              tag('summary', 'A clickable button'),
              tag('see', 'a'),
              tag('see', 'b'),
              tag('internal'),
              { comment: 'orphan' },
              {},
            ],
          })
        )
      );

      const payload = buildDocgenPayload({ entry }, context(manager));

      expect(payload?.jsDocTags).toEqual({
        summary: ['A clickable button'],
        see: ['a', 'b'],
        internal: [''],
      });
      expect(payload?.summary).toBe('A clickable button');
    });
  });

  describe('extraction rules on the analyzer path', () => {
    it('keeps plain-text comments intact where an HTML unwrapper would mangle them', () => {
      // `Array<string>` run through htmlToText loses `<string>`: a letter-opened angle bracket
      // reads as an HTML tag.
      givenStoryFile();
      const classMeta = componentEntry({
        jsdoctags: [{ tagName: { escapedText: 'remarks' }, comment: 'Accepts Array<string>.' }],
        inputsClass: [
          {
            name: 'items',
            type: 'string',
            optional: true,
            jsdoctags: [{ tagName: { escapedText: 'default' }, comment: '[] as Array<string>' }],
          },
        ],
      });

      const payload = buildDocgenPayload({ entry }, context(managerReturning(metaFor(classMeta))));

      expect(payload?.jsDocTags).toEqual({ remarks: ['Accepts Array<string>.'] });
      expect(payload?.argTypes?.items?.table?.defaultValue).toEqual({
        summary: '[] as Array<string>',
      });
    });

    it('invents no defaults, types functions structurally, and surfaces prop JSDoc tags', () => {
      givenStoryFile();
      const classMeta = componentEntry({
        inputsClass: [
          { name: 'count', type: 'number', optional: true },
          { name: 'formatter', type: 'function', optional: false },
          {
            name: 'legend',
            type: 'string',
            optional: true,
            jsdoctags: [
              { tagName: { escapedText: 'deprecated' }, comment: 'Use `label` instead.' },
            ],
          },
        ],
      });

      const payload = buildDocgenPayload({ entry }, context(managerReturning(metaFor(classMeta))));

      expect(payload?.argTypes?.count?.table?.defaultValue).toEqual({ summary: undefined });
      expect(payload?.argTypes?.formatter?.type).toEqual({ name: 'function' });
      expect(payload?.argTypes?.legend?.table?.jsDocTags).toEqual({
        deprecated: 'Use `label` instead.',
      });
    });
  });

  it('hands `propsTable` to the conversion', () => {
    givenStoryFile();
    const classMeta = componentEntry({
      propertiesClass: [
        { name: 'note', type: 'string', optional: false },
        { name: 'cdr', type: 'ChangeDetectorRef', optional: false, visibility: 'private' },
      ],
    });
    const argNames = (options: BuildDocgenContext['options']) =>
      Object.keys(
        buildDocgenPayload({ entry }, context(managerReturning(metaFor(classMeta)), options))
          ?.argTypes ?? {}
      );

    expect(argNames({ propsTable: 'all' })).toEqual(['note', 'cdr', 'label']);
    expect(argNames({ propsTable: 'api' })).toEqual(['note', 'label']);
    expect(argNames({ propsTable: 'inputs' })).toEqual(['label']);
  });

  describe('apiDescription', () => {
    // `line` is what marks the input/output pair as one `model()`, not two aliased members.
    const colorPicker = componentEntry({
      name: 'ColorPickerComponent',
      inputsClass: [
        {
          name: 'color',
          type: 'string',
          optional: true,
          line: 12,
          initializer: { kind: 'literal', literalKind: 'string', text: "'#345F92'" },
          rawdescription: 'The currently selected colour',
        },
      ],
      outputsClass: [{ name: 'color', type: 'string', line: 12 }],
      propertiesClass: [
        { name: 'cdr', type: 'ChangeDetectorRef', optional: false, visibility: 'private' },
      ],
    });

    it('documents the two-way binding and tags the payload with its renderer', () => {
      givenStoryFile();
      const manager = managerReturning(metaFor(colorPicker));

      const payload = buildDocgenPayload({ entry }, context(manager, { propsTable: 'api' }));

      expect(payload?.renderer).toBe('angular');
      expect(payload?.apiDescription?.split('\n')).toEqual([
        '## Inputs',
        '',
        '```',
        'export type ColorPickerComponentInputs = {',
        '  /**',
        '   * The currently selected colour',
        '   *',
        // The analyzer unquotes string defaults for the props table, and this reads that value.
        '   * @default #345F92',
        '   */',
        '  color?: string; // two-way: [(color)]',
        '}',
        '```',
        '',
        '## Outputs',
        '',
        '```',
        'export type ColorPickerComponentOutputs = {',
        '  colorChange: (e: string) => void;',
        '}',
        '```',
      ]);
    });

    it.each(['all', 'inputs'] as const)(
      'documents the same api surface when the props table is `%s`',
      (propsTable) => {
        givenStoryFile();
        const manager = managerReturning(metaFor(colorPicker));
        const apiPayload = buildDocgenPayload(
          { entry },
          context(managerReturning(metaFor(colorPicker)), { propsTable: 'api' })
        );

        const payload = buildDocgenPayload({ entry }, context(manager, { propsTable }));

        expect(payload?.apiDescription).toBe(apiPayload?.apiDescription);
        expect(payload?.apiDescription).toContain('## Outputs');
        expect(payload?.apiDescription).not.toContain('cdr');
      }
    );

    it('is omitted for a component that binds nothing', () => {
      givenStoryFile();
      const manager = managerReturning(
        metaFor(componentEntry({ inputsClass: [], outputsClass: [] }))
      );

      const payload = buildDocgenPayload({ entry }, context(manager));

      expect(payload?.apiDescription).toBeUndefined();
      expect(payload?.renderer).toBe('angular');
    });
  });

  describe('component resolution', () => {
    it('asks the analyzer for the default export and reports its class name', () => {
      givenStoryFile(`
        import Button from './default-button.component';
        export default { title: 'Button', component: Button };
      `);
      const manager = managerReturning(
        metaFor(componentEntry({ name: 'DefaultExportedButtonComponent' }))
      );

      const payload = buildDocgenPayload({ entry }, context(manager));

      expect(manager.extractComponentMeta).toHaveBeenCalledExactlyOnceWith(
        join(FIXTURES, 'default-button.component.ts'),
        { exportName: 'default', localName: 'Button' }
      );
      expect(payload?.name).toBe('DefaultExportedButtonComponent');
    });

    it('analyzes the story file itself for a component declared inside it', () => {
      givenStoryFile(`
        class ButtonComponent {}
        export default { title: 'Button', component: ButtonComponent };
      `);
      const manager = managerReturning(metaFor(componentEntry({ file: STORY_PATH })));

      const payload = buildDocgenPayload({ entry }, context(manager));

      expect(manager.extractComponentMeta).toHaveBeenCalledExactlyOnceWith(STORY_PATH, {
        exportName: 'ButtonComponent',
        localName: 'ButtonComponent',
      });
      expect(payload?.error).toBeUndefined();
    });
  });

  describe('error payloads', () => {
    it('names the file and export, and points at tsconfig coverage, when extraction misses', () => {
      givenStoryFile();
      const manager = managerReturning(undefined);

      const payload = buildDocgenPayload({ entry }, context(manager));

      expect(payload?.error?.name).toBe('AngularComponentMetaNotFound');
      expect(payload?.error?.message).toContain(COMPONENT_PATH);
      expect(payload?.error?.message).toContain('"ButtonComponent"');
      expect(payload?.error?.message).toContain('tsconfig.json');
      expect(payload).toMatchObject({ id: 'button', name: 'ButtonComponent', jsDocTags: {} });
      expect(payload?.argTypes).toBeUndefined();
      expect(payload?.angularComponentMeta).toBeUndefined();
    });

    it('converts an analyzer throw into an error payload instead of letting it escape', () => {
      givenStoryFile();
      const manager = {
        extractComponentMeta: vi.fn<AngularComponentMetaSource['extractComponentMeta']>(() => {
          throw new TypeError('Debug Failure. False expression.');
        }),
      };

      const payload = buildDocgenPayload({ entry }, context(manager));

      expect(payload?.error?.name).toBe('AngularComponentMetaExtractionFailed');
      expect(payload?.error?.message).toContain('Debug Failure. False expression.');
      expect(payload?.error?.message).toContain(COMPONENT_PATH);
      expect(payload).toMatchObject({ id: 'button', name: 'ButtonComponent', jsDocTags: {} });
      expect(payload?.argTypes).toBeUndefined();
    });

    it('reports an import that resolves to no file without asking the analyzer', () => {
      givenStoryFile(`
        import { ButtonComponent } from './nope.component';
        export default { title: 'Button', component: ButtonComponent };
      `);
      const manager = managerReturning(metaFor(componentEntry()));

      const payload = buildDocgenPayload({ entry }, context(manager));

      expect(payload?.error?.name).toBe('AngularComponentMetaNotFound');
      expect(payload?.error?.message).toContain('./nope.component');
      expect(manager.extractComponentMeta).not.toHaveBeenCalled();
    });
  });

  describe('"not mine" is not an error', () => {
    it('returns undefined for an entry with no story import path', () => {
      givenStoryFile();
      const docsEntry = {
        id: 'button--docs',
        name: 'Docs',
        title: 'Button',
        type: 'docs',
        importPath: './src/button.mdx',
        storiesImports: [],
        tags: [],
      } as unknown as IndexEntry;
      const manager = managerReturning(metaFor(componentEntry()));

      expect(buildDocgenPayload({ entry: docsEntry }, context(manager))).toBeUndefined();
      expect(manager.extractComponentMeta).not.toHaveBeenCalled();
    });

    it('returns undefined when the story file declares no component, and says why', () => {
      givenStoryFile(`export default { title: 'Button' };`);
      const manager = managerReturning(metaFor(componentEntry()));

      expect(buildDocgenPayload({ entry }, context(manager))).toBeUndefined();
      expect(manager.extractComponentMeta).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('No Angular component resolved from')
      );
      expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('button.stories.ts'));
    });
  });
});
