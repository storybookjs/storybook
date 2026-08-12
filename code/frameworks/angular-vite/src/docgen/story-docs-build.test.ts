import type { IndexEntry } from 'storybook/internal/types';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { dedent } from 'ts-dedent';

import { vol } from 'memfs';

import type { AngularDocgenPayload } from './build-docgen.ts';
import { buildStoryDocsPayload } from './story-docs-build.ts';
import { extractHostComponentTemplate } from './story-docs-snippet.ts';

vi.mock('node:fs', { spy: true });

beforeEach(async () => {
  vol.reset();
  const memfs = await vi.importActual<typeof import('memfs')>('memfs');
  vi.mocked(readFileSync).mockImplementation(memfs.fs.readFileSync as typeof readFileSync);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const STORY_PATH = join(process.cwd(), 'button.stories.ts');

const entry: IndexEntry = {
  id: 'button--default',
  name: 'Default',
  title: 'Example/Button',
  type: 'story',
  subtype: 'story',
  importPath: 'button.stories.ts',
};

const givenStoryFile = (source: string) => {
  vol.fromNestedJSON({ [STORY_PATH]: source });
};

const noDocgen = async (): Promise<undefined> => undefined;

const buttonDocgen =
  (jsDocTags: AngularDocgenPayload['jsDocTags'] = {}) =>
  async (): Promise<AngularDocgenPayload> => ({
    id: 'example-button',
    name: 'ButtonComponent',
    path: STORY_PATH,
    jsDocTags,
    angularComponentMeta: {
      name: 'ButtonComponent',
      selector: 'sb-button',
      inputs: ['label'],
      outputs: ['pressed'],
      enums: [],
    },
  });

/** The docgen stub the story-shape file below is written against. */
const shapesDocgen = async (): Promise<AngularDocgenPayload> => ({
  id: 'example-button',
  name: 'ButtonComponent',
  path: STORY_PATH,
  jsDocTags: {},
  angularComponentMeta: {
    name: 'ButtonComponent',
    selector: 'sb-button',
    inputs: ['label', 'count'],
    outputs: ['clicked'],
    enums: [],
  },
});

/**
 * The story shapes the provider has to tell apart, in one file so they share a meta.
 *
 * Written against {@link shapesDocgen}: `label` and `count` are inputs, `clicked` is an output,
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

/** Template inside the host-component snippet per story name, for a multi-story file. */
const templatesOf = async (storyFile: string) => {
  givenStoryFile(storyFile);
  const payload = await buildStoryDocsPayload({ entry }, { getDocgenPayload: shapesDocgen });
  return new Map(
    Object.values(payload?.stories ?? {}).map((story) => [
      story.name,
      story.snippet === undefined ? undefined : extractHostComponentTemplate(story.snippet),
    ])
  );
};

const soleStory = async (source: string, getDocgenPayload = buttonDocgen()) => {
  givenStoryFile(source);
  const payload = await buildStoryDocsPayload({ entry }, { getDocgenPayload });
  const stories = Object.values(payload?.stories ?? {});
  expect(stories).toHaveLength(1);
  return stories[0];
};

describe('buildStoryDocsPayload', () => {
  it('returns undefined for entries without a story file or with an unparsable one', async () => {
    const docsEntry: IndexEntry = {
      id: 'docs--page',
      name: 'Page',
      title: 'Docs',
      type: 'docs',
      importPath: './page.mdx',
      storiesImports: [],
      tags: [],
    };
    expect(
      await buildStoryDocsPayload({ entry: docsEntry }, { getDocgenPayload: noDocgen })
    ).toBeUndefined();

    givenStoryFile('export default { title: "Broken" ');
    expect(await buildStoryDocsPayload({ entry }, { getDocgenPayload: noDocgen })).toBeUndefined();
  });

  it('still emits description-only stories when core/docgen is unavailable', async () => {
    givenStoryFile(`
      export default { title: 'Example/Button' };
      /** Documented without a component. */
      export const Default = {};
    `);

    const payload = await buildStoryDocsPayload({ entry }, { getDocgenPayload: noDocgen });

    expect(payload?.name).toBe('Button');
    expect(Object.values(payload!.stories)[0]).toEqual({
      id: 'example-button--default',
      name: 'Default',
      description: 'Documented without a component.',
    });
  });

  it('builds a snippet from the snippet meta core/docgen carries alongside argTypes', async () => {
    givenStoryFile(`
      import { ButtonComponent } from './button.component';
      export default { title: 'Example/Button', component: ButtonComponent };
      export const Default = { args: { label: 'Save' } };
    `);
    const getDocgenPayload = async (): Promise<AngularDocgenPayload> => ({
      id: 'example-button',
      name: 'ButtonComponent',
      path: STORY_PATH,
      jsDocTags: {},
      angularComponentMeta: {
        name: 'ButtonComponent',
        selector: 'sb-button',
        inputs: ['label'],
        outputs: [],
        enums: [],
      },
    });

    const payload = await buildStoryDocsPayload({ entry }, { getDocgenPayload });

    const story = Object.values(payload!.stories)[0];
    expect(story.snippet).toContain('sb-button');
    expect(story.snippet).toContain(`[label]="'Save'"`);
  });

  it('names the payload after the story file component when core/docgen has no payload', async () => {
    givenStoryFile(`
      import { ButtonComponent } from './button.component';
      export default { title: 'Example/Button', component: ButtonComponent };
      export const Default = { args: { label: 'Save' } };
    `);

    const payload = await buildStoryDocsPayload({ entry }, { getDocgenPayload: noDocgen });

    expect(payload?.name).toBe('ButtonComponent');
    const story = Object.values(payload!.stories)[0];
    expect(story.snippet).toBeUndefined();
    expect(story.error).toBeUndefined();
  });

  it('inlines the story file import into the snippet instead of a payload-level field', async () => {
    givenStoryFile(`
      import { ButtonComponent } from './button.component';
      export default { title: 'Example/Button', component: ButtonComponent };
      export const Default = { args: { label: 'Save' } };
    `);

    const payload = await buildStoryDocsPayload({ entry }, { getDocgenPayload: buttonDocgen() });

    expect(payload?.import).toBeUndefined();
    expect(Object.values(payload!.stories)[0].snippet).toBe(dedent`
      import { Component } from '@angular/core';
      import { ButtonComponent } from './button.component';

      @Component({
        selector: 'app-demo',
        imports: [ButtonComponent],
        template: \`<sb-button [label]="'Save'" (pressed)="pressed($event)"></sb-button>\`,
      })
      export class DemoComponent {
        pressed(event: unknown) {}
      }
    `);
  });

  it('refers to the component by the local name the story file imported it under', async () => {
    givenStoryFile(`
      import { ButtonComponent as Button } from './button.component';
      export default { title: 'Example/Button', component: Button };
      export const Default = {};
    `);

    const snippet = Object.values(
      (await buildStoryDocsPayload({ entry }, { getDocgenPayload: buttonDocgen() }))!.stories
    )[0].snippet;

    expect(snippet).toContain("import { ButtonComponent as Button } from './button.component';");
    expect(snippet).toContain('imports: [Button],');
  });

  it('lets an `@import` tag on the component class replace the derived import', async () => {
    givenStoryFile(`
      import { ButtonComponent } from './button.component';
      export default { title: 'Example/Button', component: ButtonComponent };
      export const Default = {};
    `);
    const getDocgenPayload = buttonDocgen({
      import: ["import { ButtonComponent } from '@design-system/components';"],
    });

    const snippet = Object.values(
      (await buildStoryDocsPayload({ entry }, { getDocgenPayload }))!.stories
    )[0].snippet;

    expect(snippet).toContain("import { ButtonComponent } from '@design-system/components';");
    expect(snippet).not.toContain('./button.component');
  });

  it('warns that a component declared in the story file is not imported by the snippet', async () => {
    givenStoryFile(`
      import { Component } from '@angular/core';
      @Component({ selector: 'sb-button', template: '' })
      class LocalButton {}
      export default { title: 'Example/Button', component: LocalButton };
      export const Default = {};
    `);

    const story = Object.values(
      (await buildStoryDocsPayload({ entry }, { getDocgenPayload: buttonDocgen() }))!.stories
    )[0];

    expect(story.snippet).toContain("import { Component } from '@angular/core';");
    expect(story.snippet).toContain('imports: [LocalButton],');
    expect(story.snippet!.match(/^import /gm)).toHaveLength(1);
    expect(story.warning).toBe(
      'LocalButton is declared in the story file, so the snippet references it without importing it.'
    );
  });

  it('leaves the warning off a snippet that imports its component', async () => {
    givenStoryFile(`
      import { ButtonComponent } from './button.component';
      export default { title: 'Example/Button', component: ButtonComponent };
      export const Default = {};
    `);

    const story = Object.values(
      (await buildStoryDocsPayload({ entry }, { getDocgenPayload: buttonDocgen() }))!.stories
    )[0];

    expect(story.warning).toBeUndefined();
  });

  it('shows the template a custom render returns, keeping the description', async () => {
    const story = await soleStory(`
      import { ButtonComponent } from './button.component';
      export default { title: 'Example/Button', component: ButtonComponent };
      /** Renders a hand-written template. */
      export const Default = {
        args: { label: 'Save' },
        render: (args) => ({ template: '<sb-button></sb-button>' }),
      };
    `);
    expect(extractHostComponentTemplate(story.snippet!)).toBe('<sb-button></sb-button>');
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
    ])('shows the %s story as written', async (storyName, expected) => {
      expect((await templatesOf(STORY_SHAPES_FILE)).get(storyName)).toBe(expected);
    });

    it('treats a null template as no template rather than as markup', async () => {
      expect((await templatesOf(STORY_SHAPES_FILE)).get('Null Template')).toBe(
        `<sb-button [label]="'meta'" [count]="2" (clicked)="clicked($event)"></sb-button>`
      );
    });

    // A local helper is markup the story really did write, so following the name back to its
    // declaration beats replacing it with a fabricated element.
    it.each([
      ['Hoisted Template', '<sb-button hoisted></sb-button>'],
      ['Render Identifier', '<sb-button via-fn></sb-button>'],
    ])('follows the %s story identifier to its declaration', async (storyName, expected) => {
      expect((await templatesOf(STORY_SHAPES_FILE)).get(storyName)).toBe(expected);
    });

    it('falls back to generated bindings for an imported template it cannot follow', async () => {
      expect((await templatesOf(STORY_SHAPES_FILE)).get('Imported Template')).toBe(
        `<sb-button [label]="'meta'" [count]="5" (clicked)="clicked($event)"></sb-button>`
      );
    });

    it('reads args CSF2 assigned after the declaration', async () => {
      expect((await templatesOf(STORY_SHAPES_FILE)).get('Csf 2 Assigned Args')).toBe(
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
    ])('reads the re-exported %s story from its own config', async (storyName, expected) => {
      expect((await templatesOf(STORY_SHAPES_FILE)).get(storyName)).toBe(expected);
    });

    // `argsToTemplate(args)` expands to exactly the bindings this generator emits, so a template
    // built around it is fully readable and the user's wrapper markup survives.
    it('expands argsToTemplate inside the markup the story wrote', async () => {
      expect((await templatesOf(STORY_SHAPES_FILE)).get('Args To Template')).toBe(
        `<div class="wrap"><sb-button [label]="'Save'" [count]="7" (clicked)="clicked($event)"></sb-button></div>`
      );
    });

    it('honours argsToTemplate exclude options', async () => {
      expect((await templatesOf(STORY_SHAPES_FILE)).get('Args To Template Exclude')).toBe(
        `<sb-button [label]="'Save'" (clicked)="clicked($event)"></sb-button>`
      );
    });

    it('substitutes an interpolated arg used as slot content', async () => {
      expect((await templatesOf(STORY_SHAPES_FILE)).get('Slot Interpolation')).toBe(
        `<sb-button [label]="'Save'" (clicked)="clicked($event)"><span>Bye</span></sb-button>`
      );
    });

    it('falls back when an interpolation needs the story to run', async () => {
      expect((await templatesOf(STORY_SHAPES_FILE)).get('Unreadable Interpolation')).toBe(
        `<sb-button [label]="'Save'" (clicked)="clicked($event)"></sb-button>`
      );
    });

    it('declares handlers only for the outputs the markup binds', async () => {
      givenStoryFile(STORY_SHAPES_FILE);
      const payload = await buildStoryDocsPayload({ entry }, { getDocgenPayload: shapesDocgen });
      const byName = new Map(
        Object.values(payload!.stories).map((story) => [story.name, story.snippet])
      );

      expect(byName.get('Args To Template')).toContain('clicked(event: unknown) {}');
      expect(byName.get('Own Template')).not.toContain('clicked(event: unknown) {}');
    });
  });
});
