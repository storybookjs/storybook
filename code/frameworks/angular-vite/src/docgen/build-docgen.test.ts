import type { IndexEntry } from 'storybook/internal/types';

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { vol } from 'memfs';

import type { CompodocJson } from '@storybook/angular-compodoc';
import type { BuildDocgenContext } from './build-docgen.ts';
import { buildDocgenPayload, findCompodocEntry } from './build-docgen.ts';

vi.mock('node:fs', { spy: true });

beforeEach(async () => {
  vol.reset();
  const memfs = await vi.importActual<typeof import('memfs')>('memfs');
  vi.mocked(existsSync).mockImplementation(memfs.fs.existsSync as typeof existsSync);
  vi.mocked(readFileSync).mockImplementation(memfs.fs.readFileSync as typeof readFileSync);
  logger.warn.mockClear();
  logger.debug.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Built with `resolve`/`join` so the seeded paths match what the production code derives on
// Windows, where `join` yields backslashes.
const OUTPUT_DIR = resolve('/workspace/docs');
const DOCUMENTATION_JSON = join(OUTPUT_DIR, 'documentation.json');
// The story index writes `importPath` relative to the worker's cwd.
const STORY_PATH = resolve(process.cwd(), 'src/button.stories.ts');

const entry: IndexEntry = {
  id: 'button--default',
  name: 'Default',
  title: 'Button',
  type: 'story',
  subtype: 'story',
  importPath: './src/button.stories.ts',
};

/** Package root, which the fixtures stand in for a Compodoc workspace root. */
const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const FIXTURES = join(PACKAGE_ROOT, 'src/docgen/__testfixtures__');
const FIXTURE_STORY_PATH = join(FIXTURES, 'button.stories.ts');
const fixtureEntry: IndexEntry = {
  ...entry,
  importPath: relative(process.cwd(), FIXTURE_STORY_PATH),
};

/** A logger, because the shared parsing module warns and `vitest-setup.ts` fails on console.warn. */
const logger = { warn: vi.fn(), debug: vi.fn() };

const buttonComponent: Record<string, unknown> = {
  name: 'ButtonComponent',
  file: 'src/button.component.ts',
  type: 'component',
  description: '<p>Renders a button.</p>\n',
  propertiesClass: [],
  methodsClass: [],
  outputsClass: [],
  inputsClass: [{ name: 'label', type: 'string', optional: false, defaultValue: "'Click me'" }],
};

/** The `ButtonComponent` the fixture story imports: two inputs, in its own file. */
const fixtureButton: Record<string, unknown> = {
  ...buttonComponent,
  file: 'src/docgen/__testfixtures__/button.component.ts',
  inputsClass: [
    { name: 'label', type: 'string', optional: false },
    { name: 'primary', type: 'boolean', optional: false },
  ],
};

/** A different `ButtonComponent`, in a different file, with a single different input. */
const unrelatedButton: Record<string, unknown> = {
  ...buttonComponent,
  file: 'src/stories/frameworks/angular-vite/button.component.ts',
  inputsClass: [{ name: 'text', type: 'string', optional: false }],
};

const emptyJson: CompodocJson = {
  components: [],
  directives: [],
  pipes: [],
  injectables: [],
  classes: [],
};

/** Writes the story file, and `documentation.json` unless the test is about it being absent. */
const givenWorkspace = ({ withDocumentationJson = true } = {}) => {
  vol.fromNestedJSON({
    [STORY_PATH]: `
      import { ButtonComponent } from './button.component';
      export default { title: 'Button', component: ButtonComponent };
      export const Default = {};
    `,
    ...(withDocumentationJson ? { [DOCUMENTATION_JSON]: '{}' } : {}),
  });
};

const context = (
  compodocJson: CompodocJson | (() => CompodocJson),
  overrides: Partial<BuildDocgenContext['options']> = {}
): BuildDocgenContext => ({
  options: {
    outputDir: OUTPUT_DIR,
    compodocArgs: ['-e', 'json'],
    workspaceRoot: process.cwd(),
    tsconfig: 'tsconfig.json',
    ...overrides,
  },
  readDocumentationJson: typeof compodocJson === 'function' ? compodocJson : () => compodocJson,
  logger,
});

const jsonWith = (component: Record<string, unknown>) =>
  ({ ...emptyJson, components: [component] }) as unknown as CompodocJson;

describe('buildDocgenPayload', () => {
  it('extracts argTypes and attaches the raw Compodoc entry unfiltered', () => {
    givenWorkspace();
    const json = jsonWith(buttonComponent);

    const payload = buildDocgenPayload({ entry }, context(json));

    expect(payload).toMatchObject({
      id: 'button',
      name: 'ButtonComponent',
      path: './src/button.stories.ts',
      description: 'Renders a button.',
      jsDocTags: {},
    });
    expect(payload?.argTypes?.label).toMatchObject({
      name: 'label',
      table: { category: 'inputs', defaultValue: { summary: 'Click me' } },
    });
    // Unfiltered: the same object Compodoc emitted, not a curated subset.
    expect(payload?.compodoc).toBe(json.components?.[0]);
    expect(payload?.subcomponents).toBeUndefined();
    expect(payload?.error).toBeUndefined();
  });

  describe('description and JSDoc tags', () => {
    const tag = (name: string, comment?: string) => ({ tagName: { escapedText: name }, comment });

    const tagCases: [jsdoctags: unknown[], expected: Record<string, string[]>][] = [
      // `summary` is sourced from a @summary tag, as React does.
      [[tag('summary', '<p>A clickable button</p>\n')], { summary: ['A clickable button'] }],
      // Repeats accumulate under one name.
      [
        [tag('see', '<p>a</p>\n'), tag('see', '<p>b</p>\n'), tag('deprecated', '<p>Gone.</p>\n')],
        { see: ['a', 'b'], deprecated: ['Gone.'] },
      ],
      // A tag may carry no comment, and a malformed one is skipped rather than published.
      [[tag('internal'), { comment: '<p>orphan</p>\n' }, {}], { internal: [''] }],
    ];

    it.each(tagCases)('publishes Compodoc`s own tags (%#)', (jsdoctags, expected) => {
      givenWorkspace();

      const payload = buildDocgenPayload(
        { entry },
        context(jsonWith({ ...buttonComponent, jsdoctags }))
      );

      expect(payload?.jsDocTags).toEqual(expected);
      expect(payload?.summary).toBe(expected.summary?.[0]);
      expect(payload?.description).toBe('Renders a button.');
    });

    it('keeps prose around a documented @Input() code block and invents no tag from it', () => {
      givenWorkspace();
      const description =
        '<p>A button.</p>\n<pre><code class="language-ts">@Input() label: string;\n</code></pre>\n<p>Use it.</p>\n';

      const payload = buildDocgenPayload(
        { entry },
        context(jsonWith({ ...buttonComponent, description }))
      );

      expect(payload?.description).toBe('A button.\n@Input() label: string;\n\nUse it.');
      expect(payload?.jsDocTags).toEqual({});
    });
  });

  it('honours `angularFilterNonInputControls`', () => {
    givenWorkspace();
    const json = jsonWith({
      ...buttonComponent,
      propertiesClass: [{ name: 'internal', type: 'string', optional: false }],
    });

    expect(Object.keys(buildDocgenPayload({ entry }, context(json))?.argTypes ?? {})).toEqual([
      'internal',
      'label',
    ]);
    expect(
      Object.keys(
        buildDocgenPayload({ entry }, context(json, { angularFilterNonInputControls: true }))
          ?.argTypes ?? {}
      )
    ).toEqual(['label']);
  });

  describe('lookup', () => {
    it('reads argTypes from the component the story actually imports', () => {
      // Module resolution reads the real filesystem, so the story file sits in the fixtures
      // directory next to the component modules it imports; only its contents come from memfs.
      vol.fromNestedJSON({
        [FIXTURE_STORY_PATH]: `
          import { ButtonComponent } from './button.component';
          export default { title: 'Button', component: ButtonComponent };
        `,
        [DOCUMENTATION_JSON]: '{}',
      });

      const payload = buildDocgenPayload(
        { entry: fixtureEntry },
        // The unrelated one is listed first, which is what a name-only lookup would return.
        context(
          { ...emptyJson, components: [unrelatedButton, fixtureButton] } as unknown as CompodocJson,
          { workspaceRoot: PACKAGE_ROOT }
        )
      );

      expect(Object.keys(payload?.argTypes ?? {})).toEqual(['label', 'primary']);
      expect(payload?.error).toBeUndefined();
    });

    it('ignores a same-named pipe, injectable and plain class', () => {
      givenWorkspace();
      const collision: Record<string, unknown> = {
        name: 'ButtonComponent',
        properties: [],
        methods: [],
      };
      const json = {
        ...emptyJson,
        pipes: [{ ...collision, type: 'class' }],
        injectables: [{ ...collision, type: 'injectable' }],
        classes: [{ ...collision, type: 'class' }],
        components: [buttonComponent],
      } as unknown as CompodocJson;

      expect(buildDocgenPayload({ entry }, context(json))?.compodoc).toBe(json.components?.[0]);
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('finds a directive as well as a component', () => {
      givenWorkspace();
      const json = {
        ...emptyJson,
        directives: [{ ...buttonComponent, type: 'directive' }],
      } as unknown as CompodocJson;

      expect(buildDocgenPayload({ entry }, context(json))?.argTypes?.label).toBeDefined();
    });

    it('does not throw on a partial documentation.json missing whole arrays', () => {
      givenWorkspace();

      expect(
        buildDocgenPayload({ entry }, context({ components: [buttonComponent] } as never))?.error
      ).toBeUndefined();
      expect(buildDocgenPayload({ entry }, context({} as CompodocJson))?.error?.name).toBe(
        'ComponentNotDocumented'
      );
    });
  });

  describe('error payloads', () => {
    it('names the file it looked for and tells the user to enable Compodoc', () => {
      givenWorkspace({ withDocumentationJson: false });

      const payload = buildDocgenPayload({ entry }, context(emptyJson));

      expect(payload?.error?.name).toBe('NoCompodocDocumentation');
      expect(payload?.error?.message).toContain(DOCUMENTATION_JSON);
      expect(payload?.error?.message).toContain('Enable Compodoc');
      expect(payload?.argTypes).toBeUndefined();
      expect(payload?.jsDocTags).toEqual({});
    });

    it('reports a documentation.json that exists but cannot be parsed the same way', () => {
      givenWorkspace();

      const payload = buildDocgenPayload(
        { entry },
        context(() => {
          throw new SyntaxError('Unexpected end of JSON input');
        })
      );

      expect(payload?.error?.name).toBe('NoCompodocDocumentation');
      expect(payload?.error?.message).toContain('Unexpected end of JSON input');
    });

    it('explains that Compodoc does not scan components declared inside story files', () => {
      vol.fromNestedJSON({
        [STORY_PATH]: `
          class ButtonComponent {}
          export default { title: 'Button', component: ButtonComponent };
        `,
        [DOCUMENTATION_JSON]: '{}',
      });

      const payload = buildDocgenPayload({ entry }, context(emptyJson));

      expect(payload?.error?.name).toBe('ComponentNotDocumented');
      expect(payload?.error?.message).toContain('declared inside story files');
      expect(payload?.error?.message).not.toContain('tsconfig');
    });

    it('points at tsconfig coverage when the scan exists but omits the component', () => {
      givenWorkspace();

      const payload = buildDocgenPayload(
        { entry },
        context(emptyJson, { tsconfig: '/workspace/tsconfig.doc.json' })
      );

      expect(payload?.error?.name).toBe('ComponentNotDocumented');
      expect(payload?.error?.message).toContain('/workspace/tsconfig.doc.json');
      expect(payload?.error?.message).toContain('ButtonComponent');
    });
  });

  describe('"not mine" is not an error', () => {
    it('returns undefined for an entry with no story import path', () => {
      givenWorkspace();
      const docsEntry = {
        id: 'button--docs',
        name: 'Docs',
        title: 'Button',
        type: 'docs',
        importPath: './src/button.mdx',
        storiesImports: [],
        tags: [],
      } as unknown as IndexEntry;

      expect(buildDocgenPayload({ entry: docsEntry }, context(emptyJson))).toBeUndefined();
    });

    it('returns undefined when the story file declares no component, and says why', () => {
      vol.fromNestedJSON({ [STORY_PATH]: `export default { title: 'Button' };` });

      expect(buildDocgenPayload({ entry }, context(emptyJson))).toBeUndefined();
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('No Angular component resolved from')
      );
      expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('button.stories.ts'));
    });
  });
});

describe('findCompodocEntry', () => {
  const WORKSPACE = '/workspace';
  const named = (name: string, file: string, input: string) => ({
    name,
    file,
    type: 'component',
    inputsClass: [{ name: input, type: 'string', optional: false }],
  });

  // A stock Angular sandbox declares `ButtonComponent` three times in three files.
  const collidingJson = {
    ...emptyJson,
    components: [
      named('ButtonComponent', 'src/stories/button.component.ts', 'label'),
      named('ButtonComponent', 'src/stories/frameworks/button.component.ts', 'text'),
    ],
    directives: [named('HighlightDirective', 'src/stories/highlight.directive.ts', 'colour')],
  } as unknown as CompodocJson;

  const cases: [name: string, component: { exportName: string; path?: string }, input?: string][] =
    [
      [
        'picks the entry whose file matches, not the first entry with the name',
        {
          exportName: 'ButtonComponent',
          path: `${WORKSPACE}/src/stories/frameworks/button.component.ts`,
        },
        'text',
      ],
      [
        'matches directives as well as components',
        {
          exportName: 'HighlightDirective',
          path: `${WORKSPACE}/src/stories/highlight.directive.ts`,
        },
        'colour',
      ],
      [
        'falls back to a name only one entry carries',
        { exportName: 'HighlightDirective', path: `${WORKSPACE}/src/somewhere/else.ts` },
        'colour',
      ],
      [
        'reports nothing rather than guessing when a name is ambiguous and no file matched',
        { exportName: 'ButtonComponent', path: `${WORKSPACE}/src/somewhere/else.ts` },
        undefined,
      ],
      [
        'reports nothing when the component could not be located at all and its name is ambiguous',
        { exportName: 'ButtonComponent' },
        undefined,
      ],
      [
        // The class name behind a default export never appears in the story file.
        'matches a default export on its file alone',
        { exportName: 'default', path: `${WORKSPACE}/src/stories/button.component.ts` },
        'label',
      ],
      [
        'reports nothing for a default export with no resolved file, since its name is unknown',
        { exportName: 'default' },
        undefined,
      ],
    ];

  it.each(cases)('%s', (_name, component, input) => {
    const found = findCompodocEntry(collidingJson, component, WORKSPACE) as
      | { inputsClass: { name: string }[] }
      | undefined;

    expect(found?.inputsClass?.[0]?.name).toBe(input);
  });

  // Compodoc lists one physical file twice when a story directory is symlinked: once relative to
  // where it ran, once absolute. Both spellings normalize to the same path, so treating them as two
  // candidates would report an ambiguity that does not exist.
  const duplicatedJson = {
    ...emptyJson,
    components: [
      named('ButtonComponent', 'src/stories/button.component.ts', 'text'),
      named('ButtonComponent', `${WORKSPACE}/src/stories/button.component.ts`, 'text'),
    ],
  } as unknown as CompodocJson;

  it.each([['default'], ['ButtonComponent']])(
    'treats one file listed under two spellings as one component (%s export)',
    (exportName) => {
      const found = findCompodocEntry(
        duplicatedJson,
        { exportName, path: `${WORKSPACE}/src/stories/button.component.ts` },
        WORKSPACE
      ) as { inputsClass: { name: string }[] } | undefined;

      expect(found?.inputsClass?.[0]?.name).toBe('text');
    }
  );

  it('still reports nothing when same-named entries are genuinely different files', () => {
    expect(
      findCompodocEntry(collidingJson, { exportName: 'ButtonComponent' }, WORKSPACE)
    ).toBeUndefined();
  });

  it('still reports nothing when same-named entries carry no file at all', () => {
    const fileless = {
      ...emptyJson,
      components: [
        { ...named('ButtonComponent', '', 'label'), file: undefined },
        { ...named('ButtonComponent', '', 'text'), file: undefined },
      ],
    } as unknown as CompodocJson;

    expect(
      findCompodocEntry(fileless, { exportName: 'ButtonComponent' }, WORKSPACE)
    ).toBeUndefined();
  });

  it('ignores entries that are neither components nor directives', () => {
    const json = {
      ...emptyJson,
      pipes: [named('ButtonComponent', 'src/stories/button.pipe.ts', 'label')],
      classes: [named('ButtonComponent', 'src/stories/button.base.ts', 'label')],
    } as unknown as CompodocJson;

    expect(findCompodocEntry(json, { exportName: 'ButtonComponent' }, WORKSPACE)).toBeUndefined();
  });
});
