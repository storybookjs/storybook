import type { IndexEntry } from 'storybook/internal/types';

import { readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { vol } from 'memfs';

import type { AngularClassMeta, AngularComponentMetaResult } from '@storybook/angular-cm';
import type { AngularComponentMetaSource } from './build-docgen.ts';
import { buildStoryDocsPayload } from './story-docs-build.ts';

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
  title: 'Example/Button',
  type: 'story',
  subtype: 'story',
  importPath: relative(process.cwd(), STORY_PATH),
};

const givenStoryFile = (source: string) => {
  vol.fromNestedJSON({ [STORY_PATH]: source });
};

const DEFAULT_STORY_FILE = `
  import { ButtonComponent } from './button.component';
  export default { title: 'Example/Button', component: ButtonComponent };
  export const Default = { args: { label: 'Save', count: 3 } };
`;

/** An analyzer class record shaped like the pinned `AngularClassMeta` contract. */
const componentEntry = (overrides: Record<string, unknown> = {}): AngularClassMeta =>
  ({
    name: 'ButtonComponent',
    type: 'component',
    file: COMPONENT_PATH,
    selector: 'sb-button',
    propertiesClass: [],
    methodsClass: [],
    outputsClass: [{ name: 'clicked', type: 'EventEmitter' }],
    inputsClass: [
      { name: 'label', type: 'string', optional: false },
      { name: 'count', type: 'number', optional: true },
    ],
    ...overrides,
  }) as unknown as AngularClassMeta;

const metaFor = (
  classMeta: AngularClassMeta,
  json: Record<string, unknown> = {}
): AngularComponentMetaResult =>
  ({ entry: classMeta, json: { components: [classMeta], ...json } }) as AngularComponentMetaResult;

const managerReturning = (meta: AngularComponentMetaResult | undefined) => ({
  extractComponentMeta: vi.fn<AngularComponentMetaSource['extractComponentMeta']>(() => meta),
});

const soleSnippet = (manager: AngularComponentMetaSource, storyFile = DEFAULT_STORY_FILE) => {
  givenStoryFile(storyFile);
  const payload = buildStoryDocsPayload({ entry }, { manager });
  const stories = Object.values(payload?.stories ?? {});
  expect(stories).toHaveLength(1);
  return stories[0];
};

/**
 * The story shapes the provider has to tell apart, in one file so they share a meta.
 *
 * Written against {@link componentEntry}: `label` and `count` are inputs, `clicked` is an output,
 * and `footer` is an arg the component does not accept.
 */
const STORY_SHAPES_FILE = [
  `import { argsToTemplate } from '@storybook/angular-vite';`,
  `import { ButtonComponent } from './button.component';`,
  `import { IMPORTED_TEMPLATE } from './templates';`,
  `declare function buildSlot(args: unknown): string;`,
  `const HOISTED_TEMPLATE = '<sb-button hoisted></sb-button>';`,
  `const renderFn = () => ({ template: '<sb-button via-fn></sb-button>' });`,
  `export default {`,
  `  title: 'Example/Button',`,
  `  component: ButtonComponent,`,
  `  args: { label: 'meta' },`,
  `};`,
  `export const OwnTemplate = { template: '<sb-button emphasis>hi</sb-button>' };`,
  `export const EmptyTemplate = { template: '' };`,
  `export const NullTemplate = { template: null, args: { count: 2 } };`,
  `export const RenderTemplate = {`,
  `  render: () => ({ template: '<sb-button rendered></sb-button>' }),`,
  `};`,
  `export const Csf2Function = () => ({ template: '<sb-button csf2></sb-button>' });`,
  `export const HoistedTemplate = { template: HOISTED_TEMPLATE };`,
  `export const RenderIdentifier = { render: renderFn, args: { count: 4 } };`,
  `export const ImportedTemplate = { template: IMPORTED_TEMPLATE, args: { count: 5 } };`,
  // `export { X }` registers a story without a declarator, so it exercises the other branch of the
  // CSF parser. Its own args must still win over the meta's.
  `const ReExported = { args: { label: 'reexported', count: 9 } };`,
  `export { ReExported };`,
  `const RenamedSource = { args: { count: 10 } };`,
  `export { RenamedSource as RenamedStory };`,
  `const ReExportedTemplate = { template: '<sb-button reexported></sb-button>' };`,
  `export { ReExportedTemplate };`,
  // The idiom every Angular docs example uses: wrapper markup the user wrote, with the bindings
  // filled in by `argsToTemplate`.
  `export const ArgsToTemplate = {`,
  `  args: { label: 'Save', count: 7 },`,
  `  render: (args) => ({`,
  '    props: args,',
  '    template: `<div class="wrap"><sb-button ${argsToTemplate(args)}></sb-button></div>`,',
  `  }),`,
  `};`,
  `export const ArgsToTemplateExclude = {`,
  `  args: { label: 'Save', count: 7 },`,
  `  render: (args) => ({`,
  '    props: args,',
  "    template: `<sb-button ${argsToTemplate(args, { exclude: ['count'] })}></sb-button>`,",
  `  }),`,
  `};`,
  `export const SlotInterpolation = {`,
  `  args: { label: 'Save', footer: 'Bye' },`,
  `  render: ({ footer, ...args }) => ({`,
  '    props: args,',
  '    template: `<sb-button ${argsToTemplate(args)}><span>${footer}</span></sb-button>`,',
  `  }),`,
  `};`,
  `export const UnreadableInterpolation = {`,
  `  args: { label: 'Save' },`,
  '  render: (args) => ({ props: args, template: `<sb-button>${buildSlot(args)}</sb-button>` }),',
  `};`,
  // CSF2 assigns args after the declaration, out of reach of the story's own initializer.
  `export const Csf2AssignedArgs = () => ({ props: {} });`,
  `Csf2AssignedArgs.args = { label: 'assigned', count: 11 };`,
].join('\n');

/** Snippet per story name, for a file that declares more than one story. */
const snippetsOf = (storyFile: string) => {
  givenStoryFile(storyFile);
  const payload = buildStoryDocsPayload(
    { entry },
    { manager: managerReturning(metaFor(componentEntry())) }
  );
  return new Map(Object.values(payload?.stories ?? {}).map((story) => [story.name, story.snippet]));
};

describe('buildStoryDocsPayload', () => {
  it('returns undefined for entries without a story file or with an unparsable one', () => {
    const docsEntry: IndexEntry = {
      id: 'docs--page',
      name: 'Page',
      title: 'Docs',
      type: 'docs',
      importPath: './page.mdx',
      storiesImports: [],
      tags: [],
    };
    expect(buildStoryDocsPayload({ entry: docsEntry }, { manager: undefined })).toBeUndefined();

    givenStoryFile('export default { title: "Broken" ');
    expect(
      buildStoryDocsPayload({ entry }, { manager: managerReturning(undefined) })
    ).toBeUndefined();
  });

  it('renders inputs present in args and every output, in runtime grammar', () => {
    const manager = managerReturning(metaFor(componentEntry()));
    const story = soleSnippet(manager);
    expect(story.snippet).toBe(
      '<sb-button [label]="\'Save\'" [count]="3" (clicked)="clicked($event)"></sb-button>'
    );
    expect(manager.extractComponentMeta).toHaveBeenCalledWith(COMPONENT_PATH, {
      exportName: 'ButtonComponent',
      localName: 'ButtonComponent',
    });
  });

  it('merges meta args under story args and ignores args that are not inputs', () => {
    const manager = managerReturning(metaFor(componentEntry()));
    const story = soleSnippet(
      manager,
      `
        import { ButtonComponent } from './button.component';
        export default {
          title: 'Example/Button',
          component: ButtonComponent,
          args: { label: 'Base', notAnInput: true },
        };
        export const Default = { args: { count: 2 } };
      `
    );
    expect(story.snippet).toBe(
      '<sb-button [label]="\'Base\'" [count]="2" (clicked)="clicked($event)"></sb-button>'
    );
  });

  it('formats undefined, objects, and enum members the way the runtime generator does', () => {
    const manager = managerReturning(
      metaFor(
        componentEntry({
          inputsClass: [
            { name: 'label', type: 'string' },
            { name: 'data', type: 'any' },
            { name: 'kind', type: 'ButtonKind' },
          ],
          outputsClass: [],
        }),
        {
          miscellaneous: {
            typealiases: [],
            enumerations: [
              { name: 'ButtonKind', childs: [{ name: 'Secondary', value: 'secondary' }] },
            ],
          },
        }
      )
    );
    const story = soleSnippet(
      manager,
      `
        import { ButtonComponent } from './button.component';
        import { ButtonKind } from './types';
        export default { title: 'Example/Button', component: ButtonComponent };
        export const Default = {
          args: {
            label: undefined,
            data: { id: 7, tags: ['a', 'b'], nested: { deep: true } },
            kind: ButtonKind.Secondary,
          },
        };
      `
    );
    expect(story.snippet).toBe(
      '<sb-button [label]="undefined" [data]="{id: 7, tags: [\'a\', \'b\'], nested: {deep: true}}" [kind]="\'secondary\'"></sb-button>'
    );
  });

  it('inlines the source text of arg values it cannot evaluate', () => {
    const manager = managerReturning(
      metaFor(componentEntry({ inputsClass: [{ name: 'formatter' }], outputsClass: [] }))
    );
    const story = soleSnippet(
      manager,
      `
        import { ButtonComponent } from './button.component';
        export default { title: 'Example/Button', component: ButtonComponent };
        export const Default = { args: { formatter: (value) => value.toUpperCase() } };
      `
    );
    expect(story.snippet).toBe(
      '<sb-button [formatter]="(value) => value.toUpperCase()"></sb-button>'
    );
  });

  it('binds a model() output under its Change-suffixed name', () => {
    const manager = managerReturning(
      metaFor(
        componentEntry({
          inputsClass: [{ name: 'value', type: 'string' }],
          outputsClass: [{ name: 'value', type: 'string' }],
        })
      )
    );
    const story = soleSnippet(
      manager,
      `
        import { ButtonComponent } from './button.component';
        export default { title: 'Example/Button', component: ButtonComponent };
        export const Default = { args: { value: 'hello' } };
      `
    );
    expect(story.snippet).toBe(
      '<sb-button [value]="\'hello\'" (valueChange)="valueChange($event)"></sb-button>'
    );
  });

  it('renders attribute selectors as an element with plain attributes', () => {
    const manager = managerReturning(
      metaFor(
        componentEntry({
          selector: 'button[sb-action], a[sb-action]',
          inputsClass: [{ name: 'emphasis', type: 'boolean' }],
          outputsClass: [],
        })
      )
    );
    const story = soleSnippet(
      manager,
      `
        import { ButtonComponent } from './button.component';
        export default { title: 'Example/Button', component: ButtonComponent };
        export const Default = { args: { emphasis: true } };
      `
    );
    expect(story.snippet).toBe('<button sb-action [emphasis]="true"></button>');
  });

  it('falls back to ngComponentOutlet when the component has no selector', () => {
    const manager = managerReturning(metaFor(componentEntry({ selector: undefined })));
    const story = soleSnippet(manager);
    expect(story.snippet).toBe(
      '<ng-container *ngComponentOutlet="ButtonComponent"></ng-container>'
    );
  });

  it('shows the template a custom render returns, keeping the description', () => {
    const manager = managerReturning(metaFor(componentEntry()));
    const story = soleSnippet(
      manager,
      `
        import { ButtonComponent } from './button.component';
        export default { title: 'Example/Button', component: ButtonComponent };
        /** Renders a hand-written template. */
        export const Default = {
          args: { label: 'Save' },
          render: (args) => ({ template: '<sb-button></sb-button>' }),
        };
      `
    );
    expect(story.snippet).toBe('<sb-button></sb-button>');
    expect(story.description).toBe('Renders a hand-written template.');
  });

  describe('stories that supply their own markup', () => {
    it.each([
      ['Own Template', '<sb-button emphasis>hi</sb-button>'],
      // An empty string is a user-defined template, matching the preview's own rule.
      ['Empty Template', ''],
      ['Render Template', '<sb-button rendered></sb-button>'],
      // CSF2: the story is the render function, and Angular's idiom is to return `{ template }`.
      ['Csf 2 Function', '<sb-button csf2></sb-button>'],
    ])('leaves the %s story alone', (storyName, expected) => {
      expect(snippetsOf(STORY_SHAPES_FILE).get(storyName)).toBe(expected);
    });

    it('treats a null template as no template rather than as markup', () => {
      expect(snippetsOf(STORY_SHAPES_FILE).get('Null Template')).toBe(
        `<sb-button [label]="'meta'" [count]="2" (clicked)="clicked($event)"></sb-button>`
      );
    });

    // A local helper is markup the story really did write, so following the name back to its
    // declaration beats replacing it with a fabricated element.
    it.each([
      ['Hoisted Template', '<sb-button hoisted></sb-button>'],
      ['Render Identifier', '<sb-button via-fn></sb-button>'],
    ])('follows the %s story identifier to its declaration', (storyName, expected) => {
      expect(snippetsOf(STORY_SHAPES_FILE).get(storyName)).toBe(expected);
    });

    it('falls back to generated bindings for an imported template it cannot follow', () => {
      expect(snippetsOf(STORY_SHAPES_FILE).get('Imported Template')).toBe(
        `<sb-button [label]="'meta'" [count]="5" (clicked)="clicked($event)"></sb-button>`
      );
    });

    it('reads args CSF2 assigned after the declaration', () => {
      expect(snippetsOf(STORY_SHAPES_FILE).get('Csf 2 Assigned Args')).toBe(
        `<sb-button [label]="'assigned'" [count]="11" (clicked)="clicked($event)"></sb-button>`
      );
    });

    // `export { X }` is registered by a different branch of the CSF parser, which keeps the export
    // name verbatim rather than deriving a display name from it.
    it.each([
      [
        'ReExported',
        `<sb-button [label]="'reexported'" [count]="9" (clicked)="clicked($event)"></sb-button>`,
      ],
      [
        'RenamedStory',
        `<sb-button [label]="'meta'" [count]="10" (clicked)="clicked($event)"></sb-button>`,
      ],
      ['ReExportedTemplate', '<sb-button reexported></sb-button>'],
    ])('reads the re-exported %s story from its own config', (storyName, expected) => {
      expect(snippetsOf(STORY_SHAPES_FILE).get(storyName)).toBe(expected);
    });

    // `argsToTemplate(args)` expands to exactly the bindings this generator emits, so a template
    // built around it is fully readable and the user's wrapper markup survives.
    it('expands argsToTemplate inside the markup the story wrote', () => {
      expect(snippetsOf(STORY_SHAPES_FILE).get('Args To Template')).toBe(
        `<div class="wrap"><sb-button [label]="'Save'" [count]="7" (clicked)="clicked($event)"></sb-button></div>`
      );
    });

    it('honours argsToTemplate exclude options', () => {
      expect(snippetsOf(STORY_SHAPES_FILE).get('Args To Template Exclude')).toBe(
        `<sb-button [label]="'Save'" (clicked)="clicked($event)"></sb-button>`
      );
    });

    it('substitutes an interpolated arg used as slot content', () => {
      expect(snippetsOf(STORY_SHAPES_FILE).get('Slot Interpolation')).toBe(
        `<sb-button [label]="'Save'" (clicked)="clicked($event)"><span>Bye</span></sb-button>`
      );
    });

    it('falls back when an interpolation needs the story to run', () => {
      expect(snippetsOf(STORY_SHAPES_FILE).get('Unreadable Interpolation')).toBe(
        `<sb-button [label]="'Save'" (clicked)="clicked($event)"></sb-button>`
      );
    });
  });

  it('extracts story descriptions and @summary tags like the React provider', () => {
    const manager = managerReturning(metaFor(componentEntry()));
    const story = soleSnippet(
      manager,
      `
        import { ButtonComponent } from './button.component';
        export default { title: 'Example/Button', component: ButtonComponent };
        /**
         * The default state.
         *
         * @summary Primary look
         */
        export const Default = { args: { label: 'Save' } };
      `
    );
    expect(story.description).toBe('The default state.');
    expect(story.summary).toBe('Primary look');
    expect(story.snippet).toContain('<sb-button');
  });

  it('still emits description-only stories when there is no component or the analyzer fails', () => {
    givenStoryFile(`
      export default { title: 'Example/Button' };
      /** Documented without a component. */
      export const Default = {};
    `);
    const payload = buildStoryDocsPayload({ entry }, { manager: undefined });
    expect(payload?.name).toBe('Button');
    const stories = Object.values(payload!.stories);
    expect(stories[0].snippet).toBeUndefined();
    expect(stories[0].description).toBe('Documented without a component.');

    const throwingManager: AngularComponentMetaSource = {
      extractComponentMeta: () => {
        throw new Error('ts blew up');
      },
    };
    const story = soleSnippet(throwingManager);
    expect(story.snippet).toBeUndefined();
    expect(story.error).toBeUndefined();
  });
});
