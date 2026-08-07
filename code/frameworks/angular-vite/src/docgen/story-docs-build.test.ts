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

  it('skips snippets for stories with a custom render, keeping their descriptions', () => {
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
    expect(story.snippet).toBeUndefined();
    expect(story.description).toBe('Renders a hand-written template.');
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
