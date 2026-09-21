import type { IndexEntry } from 'storybook/internal/types';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { parseTemplate } from '@angular/compiler';

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
  (jsDocTags: AngularDocgenPayload['jsDocTags'] = {}, standalone = true, outputs = ['pressed']) =>
  async (): Promise<AngularDocgenPayload> => ({
    id: 'example-button',
    name: 'ButtonComponent',
    path: STORY_PATH,
    jsDocTags,
    angularComponentMeta: {
      name: 'ButtonComponent',
      selector: 'sb-button',
      standalone,
      inputs: ['label'],
      outputs,
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
    standalone: true,
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
  `import { IMPORTED_TEMPLATE, importedRender } from './templates';`,
  `declare function buildSlot(args: unknown): string;`,
  `const HOISTED_TEMPLATE = '<sb-button hoisted></sb-button>';`,
  `const renderFn = () => ({ template: '<sb-button via-fn></sb-button>' });`,
  `const sharedArgs = { label: 'shared' };`,
  `const LOCAL_LABEL = 'Save';`,
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
  `export const ImportedRender = { render: importedRender, args: { count: 6 } };`,
  // Args merged in with a spread, and a whole config merged in with one.
  `export const SpreadArgs = { args: { ...sharedArgs, count: 1 } };`,
  `export const ConfigSpread = { ...SpreadArgs, args: { count: 12 } };`,
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
  `  args: { label: 'Save', count: 7, clicked: () => {} },`,
  `  render: (args) => ({`,
  '    props: args,',
  '    template: `<div class="wrap"><sb-button ${argsToTemplate(args)}></sb-button></div>`,',
  `  }),`,
  `};`,
  `export const ArgsToTemplateExclude = {`,
  `  args: { label: 'Save', count: 7, clicked: () => {} },`,
  `  render: (args) => ({`,
  '    props: args,',
  "    template: `<sb-button ${argsToTemplate(args, { exclude: ['count'] })}></sb-button>`,",
  `  }),`,
  `};`,
  `export const SlotInterpolation = {`,
  `  args: { label: 'Save', footer: 'Bye', clicked: () => {} },`,
  `  render: ({ footer, ...args }) => ({`,
  '    props: args,',
  '    template: `<sb-button ${argsToTemplate(args)}><span>${footer}</span></sb-button>`,',
  `  }),`,
  `};`,
  // Markup written without `argsToTemplate` binds the args by name, which only resolves because
  // the story hands them to the template through `props: args`.
  `export const HandWrittenBindings = {`,
  `  args: { label: 'Save', count: 3 },`,
  `  render: (args) => ({`,
  '    props: args,',
  `    template: '<sb-button [label]="label" [count]="count"></sb-button>',`,
  `  }),`,
  `};`,
  // The half-and-half shape `exclude` exists for: most bindings expanded, one written by hand.
  `export const PartlyHandWritten = {`,
  `  args: { label: 'Save', count: 7 },`,
  `  render: (args) => ({`,
  '    props: args,',
  '    template: `<sb-button ${argsToTemplate(args, { exclude: [\'label\'] })} [label]="label.toUpperCase()"></sb-button>`,',
  `  }),`,
  `};`,
  `export const OutputNamedArg = {`,
  `  args: { clicked: 'not a handler' },`,
  `  render: (args) => ({`,
  '    props: args,',
  `    template: '<sb-button (clicked)="clicked($event)"></sb-button>',`,
  `  }),`,
  `};`,
  `export const IdentifierArgValue = {`,
  `  args: { label: LOCAL_LABEL },`,
  `  render: (args) => ({ props: args, template: '<sb-button [label]="label"></sb-button>' }),`,
  `};`,
  `export const UnreadableInterpolation = {`,
  `  args: { label: 'Save' },`,
  '  render: (args) => ({ props: args, template: `<sb-button>${buildSlot(args)}</sb-button>` }),',
  `};`,
  // CSF2 assigns args after the declaration, out of reach of the story's own initializer.
  `export const Csf2AssignedArgs = () => ({ props: {} });`,
  `Csf2AssignedArgs.args = { label: 'assigned', count: 11 };`,
].join('\n');

/** Story doc per story name, for a file that declares more than one. */
const storiesOf = async (storyFile: string, extraFiles: Record<string, string> = {}) => {
  vol.fromNestedJSON({ [STORY_PATH]: storyFile, ...extraFiles });
  const payload = await buildStoryDocsPayload(
    { entry },
    {
      getDocgenPayload: shapesDocgen,
      // memfs has no module resolution, so specifiers resolve by appending the extension.
      resolveImport: (fromFile, specifier) => join(fromFile, '..', `${specifier}.ts`),
    }
  );
  return new Map(Object.values(payload?.stories ?? {}).map((story) => [story.name, story]));
};

/** Template inside the host-component snippet per story name, for a multi-story file. */
const templatesOf = async (storyFile: string, extraFiles: Record<string, string> = {}) =>
  new Map(
    [...(await storiesOf(storyFile, extraFiles))].map(([name, story]) => [
      name,
      story.snippet === undefined ? undefined : extractHostComponentTemplate(story.snippet),
    ])
  );

const warningsOf = async (storyFile: string, extraFiles: Record<string, string> = {}) =>
  new Map(
    [...(await storiesOf(storyFile, extraFiles))].map(([name, story]) => [name, story.warning])
  );

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

  it('keeps unevaluable arg source when the story file uses CRLF', async () => {
    givenStoryFile(
      dedent`
        import { ButtonComponent } from './button.component';
        export default { title: 'Example/Button', component: ButtonComponent };
        export const Default = { args: { label: (value) => value } };
      `.replace(/\n/g, '\r\n')
    );

    const payload = await buildStoryDocsPayload({ entry }, { getDocgenPayload: buttonDocgen() });

    expect(Object.values(payload!.stories)[0].snippet).toContain(`label = (value) => value;`);
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
        standalone: true,
        inputs: ['label'],
        outputs: [],
        enums: [],
      },
    });

    const payload = await buildStoryDocsPayload({ entry }, { getDocgenPayload });

    const story = Object.values(payload!.stories)[0];
    expect(story.snippet).toContain('sb-button');
    expect(story.snippet).toContain(`[label]="'Save'"`);
    expect(story.warning).toBeUndefined();
  });

  it('slices an unevaluable arg out of a story file written with CRLF line endings', async () => {
    givenStoryFile(
      [
        `import { ButtonComponent } from './button.component';`,
        `export default { title: 'Example/Button', component: ButtonComponent };`,
        `export const Default = { args: { label: (value) => value.trim() } };`,
      ].join('\r\n')
    );

    const payload = await buildStoryDocsPayload({ entry }, { getDocgenPayload: buttonDocgen() });

    const story = Object.values(payload!.stories)[0];
    expect(story.snippet).toContain(`label = (value) => value.trim();`);
  });

  it('attaches the snippet builder warning for a non-standalone component', async () => {
    givenStoryFile(`
      import { ButtonComponent } from './button.component';
      export default { title: 'Example/Button', component: ButtonComponent };
      export const Default = { args: { label: 'Save' } };
    `);

    const payload = await buildStoryDocsPayload(
      { entry },
      { getDocgenPayload: buttonDocgen({}, false) }
    );

    const story = Object.values(payload!.stories)[0];
    expect(story.snippet).toContain('imports: [],');
    expect(story.snippet).not.toContain('./button.component');
    expect(story.warning).toContain('standalone: false');
    expect(story.warning).toContain('NgModule');
  });

  it("mirrors the story's moduleMetadata modules for a non-standalone component", async () => {
    givenStoryFile(`
      import { moduleMetadata } from '@storybook/angular-vite';
      import { ButtonComponent } from './button.component';
      import { ButtonModule } from './button.module';
      export default {
        title: 'Example/Button',
        component: ButtonComponent,
        decorators: [moduleMetadata({ imports: [ButtonModule] })],
      };
      export const Default = { args: { label: 'Save' } };
    `);

    const payload = await buildStoryDocsPayload(
      { entry },
      { getDocgenPayload: buttonDocgen({}, false) }
    );

    const story = Object.values(payload!.stories)[0];
    expect(story.snippet).toContain('imports: [ButtonModule],');
    expect(story.snippet).toContain("import { ButtonModule } from './button.module';");
    expect(story.snippet).not.toContain('./button.component');
    expect(story.warning).toBeUndefined();
  });

  it('merges story-level moduleMetadata modules with the meta-level ones', async () => {
    givenStoryFile(`
      import { moduleMetadata } from '@storybook/angular-vite';
      import { ButtonComponent } from './button.component';
      import { ButtonModule } from './button.module';
      import { IconModule } from './icon.module';
      export default {
        title: 'Example/Button',
        component: ButtonComponent,
        decorators: [moduleMetadata({ imports: [ButtonModule] })],
      };
      export const Default = {
        decorators: [moduleMetadata({ imports: [IconModule, ButtonModule] })],
      };
    `);

    const payload = await buildStoryDocsPayload(
      { entry },
      { getDocgenPayload: buttonDocgen({}, false) }
    );

    const story = Object.values(payload!.stories)[0];
    expect(story.snippet).toContain('imports: [ButtonModule, IconModule],');
    expect(story.snippet).toContain("import { ButtonModule } from './button.module';");
    expect(story.snippet).toContain("import { IconModule } from './icon.module';");
    expect(story.warning).toBeUndefined();
  });

  it('keeps the warning when moduleMetadata declares the component instead of importing a module', async () => {
    givenStoryFile(`
      import { moduleMetadata } from '@storybook/angular-vite';
      import { ButtonComponent } from './button.component';
      import { IconModule } from './icon.module';
      export default {
        title: 'Example/Button',
        component: ButtonComponent,
        decorators: [moduleMetadata({ declarations: [ButtonComponent], imports: [IconModule] })],
      };
      export const Default = {};
    `);

    const payload = await buildStoryDocsPayload(
      { entry },
      { getDocgenPayload: buttonDocgen({}, false) }
    );

    const story = Object.values(payload!.stories)[0];
    expect(story.snippet).toContain('imports: [],');
    expect(story.warning).toContain('NgModule');
  });

  it('keeps the warning when the only moduleMetadata module is declared in the story file', async () => {
    givenStoryFile(`
      import { NgModule } from '@angular/core';
      import { moduleMetadata } from '@storybook/angular-vite';
      import { ButtonComponent } from './button.component';
      @NgModule({ declarations: [ButtonComponent], exports: [ButtonComponent] })
      class StoryModule {}
      export default {
        title: 'Example/Button',
        component: ButtonComponent,
        decorators: [moduleMetadata({ imports: [StoryModule] })],
      };
      export const Default = {};
    `);

    const payload = await buildStoryDocsPayload(
      { entry },
      { getDocgenPayload: buttonDocgen({}, false) }
    );

    const story = Object.values(payload!.stories)[0];
    expect(story.snippet).toContain('imports: [],');
    expect(story.snippet).not.toContain('StoryModule');
    expect(story.warning).toContain('NgModule');
  });

  it('ignores moduleMetadata entries a snippet cannot restate as an import', async () => {
    givenStoryFile(`
      import { moduleMetadata } from '@storybook/angular-vite';
      import { RouterModule } from '@angular/router';
      import { ButtonComponent } from './button.component';
      export default {
        title: 'Example/Button',
        component: ButtonComponent,
        decorators: [moduleMetadata({ imports: [RouterModule.forRoot([]), ButtonComponent] })],
      };
      export const Default = {};
    `);

    const payload = await buildStoryDocsPayload(
      { entry },
      { getDocgenPayload: buttonDocgen({}, false) }
    );

    const story = Object.values(payload!.stories)[0];
    expect(story.snippet).toContain('imports: [],');
    expect(story.warning).toContain('NgModule');
  });

  it('imports a standalone component alongside the modules its moduleMetadata lists', async () => {
    givenStoryFile(`
      import { moduleMetadata } from '@storybook/angular-vite';
      import { ButtonComponent } from './button.component';
      import { IconModule } from './icon.module';
      export default {
        title: 'Example/Button',
        component: ButtonComponent,
        decorators: [moduleMetadata({ imports: [IconModule] })],
      };
      export const Default = {};
    `);

    const payload = await buildStoryDocsPayload({ entry }, { getDocgenPayload: buttonDocgen() });

    const story = Object.values(payload!.stories)[0];
    expect({ snippet: story.snippet, warning: story.warning }).toMatchInlineSnapshot(`
      {
        "snippet": "import { Component } from '@angular/core';
      import { ButtonComponent } from './button.component';
      import { IconModule } from './icon.module';

      @Component({
        selector: 'app-demo',
        imports: [ButtonComponent, IconModule],
        template: \`<sb-button (pressed)="pressed($event)" />\`,
      })
      export class DemoComponent {
        pressed(event: unknown) {}
      }",
        "warning": undefined,
      }
    `);
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
        template: \`<sb-button [label]="'Save'" (pressed)="pressed($event)" />\`,
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
        `<sb-button [label]="'meta'" [count]="2" (clicked)="clicked($event)" />`
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

    // A snippet that fell back is still useful, so it ships - but silently shipping it leaves a
    // consumer no way to know its example is partial.
    it.each([
      ['Imported Template', 'IMPORTED_TEMPLATE'],
      ['Imported Render', 'importedRender'],
      ['Unreadable Interpolation', 'buildSlot(args)'],
    ])('names the markup the %s story fell back from', async (storyName, expected) => {
      const story = (await storiesOf(STORY_SHAPES_FILE)).get(storyName);
      expect(story?.warning).toContain(expected);
      // The note is data on the story, not a comment in the markup, so a consumer that renders the
      // snippet is not left with a stray comment and one that reads it can act on it.
      expect(story?.snippet).toContain('<sb-button');
      expect(story?.snippet).not.toContain(expected);
    });

    it('reads args CSF2 assigned after the declaration', async () => {
      expect((await templatesOf(STORY_SHAPES_FILE)).get('Csf 2 Assigned Args')).toBe(
        `<sb-button [label]="'assigned'" [count]="11" (clicked)="clicked($event)" />`
      );
    });

    // `export { X }` is registered by a different branch of the CSF parser, which keeps the export
    // name verbatim rather than deriving a display name from it.
    it.each([
      [
        'ReExported',
        `<sb-button [label]="'reexported'" [count]="9" (clicked)="clicked($event)" />`,
      ],
      ['RenamedStory', `<sb-button [label]="'meta'" [count]="10" (clicked)="clicked($event)" />`],
      ['ReExportedTemplate', '<sb-button reexported></sb-button>'],
    ])('reads the re-exported %s story from its own config', async (storyName, expected) => {
      expect((await templatesOf(STORY_SHAPES_FILE)).get(storyName)).toBe(expected);
    });

    // `argsToTemplate(args)` expands to exactly the bindings this generator emits, so a template
    // built around it is fully readable and the user's wrapper markup survives.
    it('expands argsToTemplate inside the markup the story wrote', async () => {
      expect((await templatesOf(STORY_SHAPES_FILE)).get('Args To Template')).toBe(
        [
          '<div class="wrap">',
          '    <sb-button',
          `        [label]="'Save'"`,
          '        [count]="7"',
          '        (clicked)="clicked($event)">',
          '    </sb-button>',
          '</div>',
        ].join('\n')
      );
    });

    it('reports an arg the component does not declare instead of binding it', async () => {
      const story = await soleStory(`
        import { argsToTemplate } from '@storybook/angular-vite';
        import { ButtonComponent } from './button.component';
        export default { title: 'Example/Button', component: ButtonComponent };
        export const Default = {
          args: { label: 'Save', tooltip: 'Hi' },
          render: (args) => ({
            props: args,
            template: \`<sb-button \${argsToTemplate(args)}></sb-button>\`,
          }),
        };
      `);
      expect({ snippet: story.snippet, warning: story.warning }).toMatchInlineSnapshot(`
        {
          "snippet": "import { Component } from '@angular/core';
        import { ButtonComponent } from './button.component';

        @Component({
          selector: 'app-demo',
          imports: [ButtonComponent],
          template: \`<sb-button [label]="'Save'"></sb-button>\`,
        })
        export class DemoComponent {}",
          "warning": "Incomplete snippet: \`tooltip\` could not be bound, since ButtonComponent declares no such input.",
        }
      `);
    });

    it('reports an arg whose name is not a binding the component accepts', async () => {
      const story = await soleStory(`
        import { argsToTemplate } from '@storybook/angular-vite';
        import { ButtonComponent } from './button.component';
        export default { title: 'Example/Button', component: ButtonComponent };
        export const Default = {
          args: { label: 'Save', 'aria-label': 'Close', 'two words': 'x' },
          render: (args) => ({
            props: args,
            template: \`<sb-button \${argsToTemplate(args)}></sb-button>\`,
          }),
        };
      `);
      expect({ snippet: story.snippet, warning: story.warning }).toMatchInlineSnapshot(`
        {
          "snippet": "import { Component } from '@angular/core';
        import { ButtonComponent } from './button.component';

        @Component({
          selector: 'app-demo',
          imports: [ButtonComponent],
          template: \`<sb-button [label]="'Save'"></sb-button>\`,
        })
        export class DemoComponent {}",
          "warning": "Incomplete snippet: \`aria-label\`, \`two words\` could not be bound, since ButtonComponent declares no such input.",
        }
      `);
    });

    it('leaves an undefined-valued arg unbound, as argsToTemplate does at runtime', async () => {
      const story = await soleStory(`
        import { argsToTemplate } from '@storybook/angular-vite';
        import { ButtonComponent } from './button.component';
        export default { title: 'Example/Button', component: ButtonComponent };
        export const Default = {
          args: { label: undefined },
          render: (args) => ({
            props: args,
            template: \`<sb-button \${argsToTemplate(args)}></sb-button>\`,
          }),
        };
      `);
      expect({ snippet: story.snippet, warning: story.warning }).toMatchInlineSnapshot(`
        {
          "snippet": "import { Component } from '@angular/core';
        import { ButtonComponent } from './button.component';

        @Component({
          selector: 'app-demo',
          imports: [ButtonComponent],
          template: \`<sb-button></sb-button>\`,
        })
        export class DemoComponent {}",
          "warning": undefined,
        }
      `);
    });

    it('reports a function-valued arg the component declares no output for', async () => {
      const story = await soleStory(`
        import { argsToTemplate } from '@storybook/angular-vite';
        import { ButtonComponent } from './button.component';
        export default { title: 'Example/Button', component: ButtonComponent };
        export const Default = {
          args: { onSelect: () => {} },
          render: (args) => ({
            props: args,
            template: \`<sb-button \${argsToTemplate(args)}></sb-button>\`,
          }),
        };
      `);
      expect({ snippet: story.snippet, warning: story.warning }).toMatchInlineSnapshot(`
        {
          "snippet": "import { Component } from '@angular/core';
        import { ButtonComponent } from './button.component';

        @Component({
          selector: 'app-demo',
          imports: [ButtonComponent],
          template: \`<sb-button></sb-button>\`,
        })
        export class DemoComponent {}",
          "warning": "Incomplete snippet: \`onSelect\` could not be bound, since ButtonComponent declares no such output.",
        }
      `);
    });

    it('expands only present args whose values match their binding kind', async () => {
      const story = await soleStory(
        `
        import { argsToTemplate } from '@storybook/angular-vite';
        import { ButtonComponent } from './button.component';
        export default { title: 'Example/Button', component: ButtonComponent };
        export const Default = {
          args: { label: 'Save', pressed: () => {}, changed: 'not a handler' },
          render: (args) => ({
            props: args,
            template: \`<sb-button \${argsToTemplate(args)}></sb-button>\`,
          }),
        };
        `,
        buttonDocgen({}, true, ['pressed', 'changed', 'absent'])
      );

      expect({ snippet: story.snippet, warning: story.warning }).toMatchInlineSnapshot(`
        {
          "snippet": "import { Component } from '@angular/core';
        import { ButtonComponent } from './button.component';

        @Component({
          selector: 'app-demo',
          imports: [ButtonComponent],
          template: \`<sb-button [label]="'Save'" (pressed)="pressed($event)"></sb-button>\`,
        })
        export class DemoComponent {
          pressed(event: unknown) {}
        }",
          "warning": "Incomplete snippet: \`changed\` could not be bound, since ButtonComponent declares no such input.",
        }
      `);
    });

    it('honours argsToTemplate exclude options', async () => {
      expect((await templatesOf(STORY_SHAPES_FILE)).get('Args To Template Exclude')).toBe(
        `<sb-button [label]="'Save'" (clicked)="clicked($event)"></sb-button>`
      );
    });

    it('substitutes an interpolated arg used as slot content', async () => {
      const story = (await storiesOf(STORY_SHAPES_FILE)).get('Slot Interpolation');
      expect({ snippet: story?.snippet, warning: story?.warning }).toMatchInlineSnapshot(`
        {
          "snippet": "import { Component } from '@angular/core';
        import { ButtonComponent } from './button.component';

        @Component({
          selector: 'app-demo',
          imports: [ButtonComponent],
          template: \`
            <sb-button [label]="'Save'" (clicked)="clicked($event)">
                <span>Bye</span>
            </sb-button>\`,
        })
        export class DemoComponent {
          clicked(event: unknown) {}
        }",
          "warning": undefined,
        }
      `);
    });

    it('leaves a story it could read entirely alone', async () => {
      expect((await warningsOf(STORY_SHAPES_FILE)).get('Null Template')).toBeUndefined();
    });

    // `{ ...SpreadArgs, args: { count: 12 } }` copies the story it names and then replaces its
    // args outright, which is what the spread means; only the meta's args survive underneath.
    it('reads a spread at the config level, not only one inside args', async () => {
      expect((await warningsOf(STORY_SHAPES_FILE)).get('Config Spread')).toBeUndefined();
      expect((await templatesOf(STORY_SHAPES_FILE)).get('Config Spread')).toBe(
        `<sb-button [label]="'meta'" [count]="12" (clicked)="clicked($event)" />`
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

  // Hand-written markup runs against the story's `props: args`, which the host component the
  // snippet ships does not have. The args it names have to come with it or the example is dead.
  describe('args the markup binds by name', () => {
    it('declares them on the host, leaving the markup as written', async () => {
      expect((await storiesOf(STORY_SHAPES_FILE)).get('Hand Written Bindings')?.snippet).toBe(
        [
          `import { Component } from '@angular/core';`,
          `import { ButtonComponent } from './button.component';`,
          '',
          '@Component({',
          `  selector: 'app-demo',`,
          '  imports: [ButtonComponent],',
          '  template: `<sb-button [label]="label" [count]="count"></sb-button>`,',
          '})',
          'export class DemoComponent {',
          `  label = 'Save';`,
          '  count = 3;',
          '}',
        ].join('\n')
      );
    });

    // An expanded binding carries its value in the markup, so only the attribute name is left to
    // match on; declaring it would add a member nothing reads.
    it('skips the args argsToTemplate already expanded', async () => {
      const snippet = (await storiesOf(STORY_SHAPES_FILE)).get('Partly Hand Written')?.snippet;
      expect(snippet).toContain(`[count]="7"`);
      expect(snippet).toContain(`  label = 'Save';`);
      expect(snippet).not.toContain('count = 7;');
    });

    it('leaves an output binding to its handler rather than declaring both', async () => {
      const snippet = (await storiesOf(STORY_SHAPES_FILE)).get('Output Named Arg')?.snippet;
      expect(snippet).toContain('  clicked(event: unknown) {}');
      expect(snippet).not.toContain(`clicked = 'not a handler';`);
    });

    it('declares statically keyed and void-valued args as host fields', async () => {
      const story = await soleStory(`
        import { ButtonComponent } from './button.component';
        export default { title: 'Example/Button', component: ButtonComponent };
        export const Default = {
          args: { 'two words': 'available', label: void 0 },
          render: (args) => ({
            props: args,
            template: \`<sb-button [label]="label">{{ this['two words'] }}</sb-button>\`,
          }),
        };
      `);

      expect({ snippet: story.snippet, warning: story.warning }).toMatchInlineSnapshot(`
        {
          "snippet": "import { Component } from '@angular/core';
        import { ButtonComponent } from './button.component';

        @Component({
          selector: 'app-demo',
          imports: [ButtonComponent],
          template: \`<sb-button [label]="label">{{ this['two words'] }}</sb-button>\`,
        })
        export class DemoComponent {
          ['two words'] = 'available';
          label = undefined;
        }",
          "warning": undefined,
        }
      `);
    });

    it('declares an arg a @defer condition reads', async () => {
      const story = await soleStory(`
        import { ButtonComponent } from './button.component';
        export default { title: 'Example/Button', component: ButtonComponent };
        export const Default = {
          args: { ready: true },
          render: (args) => ({
            props: args,
            template: '<div>@defer (when ready) { <sb-button></sb-button> }</div>',
          }),
        };
      `);
      expect({ snippet: story.snippet, warning: story.warning }).toMatchInlineSnapshot(`
        {
          "snippet": "import { Component } from '@angular/core';
        import { ButtonComponent } from './button.component';

        @Component({
          selector: 'app-demo',
          imports: [ButtonComponent],
          template: \`
            <div>
                @defer (when ready) {
                <sb-button></sb-button>
                }
            </div>\`,
        })
        export class DemoComponent {
          ready = true;
        }",
          "warning": undefined,
        }
      `);
    });

    // A name the story file declares is read through to its value: the host component the snippet
    // ships would evaluate `LOCAL_LABEL` against itself and silently find nothing.
    it('declares the value behind an arg written as a local name', async () => {
      const story = (await storiesOf(STORY_SHAPES_FILE)).get('Identifier Arg Value');
      expect(story?.warning).toBeUndefined();
      expect(story?.snippet).toContain(`  label = 'Save';`);
      expect(story?.snippet).not.toContain('label = LOCAL_LABEL;');
    });

    // A name another module owns cannot be read here and must not be printed as if it resolved.
    it('reports an arg whose value another module owns', async () => {
      const story = await soleStory(`
        import { ButtonComponent } from './button.component';
        import { REMOTE_LABEL } from './labels';
        export default { title: 'Example/Button', component: ButtonComponent };
        export const Default = {
          args: { label: REMOTE_LABEL },
          render: (args) => ({ props: args, template: '<sb-button [label]="label"></sb-button>' }),
        };
      `);
      expect(story.warning).toBe(
        'Incomplete snippet: `REMOTE_LABEL` could not be resolved statically.'
      );
      expect(story.snippet).not.toContain('label = REMOTE_LABEL;');
    });
  });

  describe('story shapes that cannot be read statically', () => {
    it('reads the template a render method shorthand returns', async () => {
      const story = await soleStory(`
        import { ButtonComponent } from './button.component';
        export default { title: 'Example/Button', component: ButtonComponent };
        export const Default = {
          args: { label: 'Save' },
          render(args) {
            return { template: '<div class="only-in-render"><sb-button></sb-button></div>' };
          },
        };
      `);
      expect(extractHostComponentTemplate(story.snippet!)).toBe(
        ['<div class="only-in-render">', '    <sb-button></sb-button>', '</div>'].join('\n')
      );
    });

    // At runtime, reading `render` invokes the getter; the accessor itself is not the function.
    it('falls back with a warning for a render accessor', async () => {
      const story = await soleStory(`
        import { ButtonComponent } from './button.component';
        export default { title: 'Example/Button', component: ButtonComponent };
        export const Default = {
          args: { label: 'Save' },
          get render() {
            return () => ({ template: '<sb-button from-getter></sb-button>' });
          },
        };
      `);
      expect(story.warning).toContain('get render()');
      expect(extractHostComponentTemplate(story.snippet!)).toBe(
        `<sb-button [label]="'Save'" (pressed)="pressed($event)" />`
      );
    });

    // `{ render: fn, ...base }` runs base.render when the spread carries one, so reading the spread
    // is what says whether the explicit property survives.
    it('keeps the render a later spread turns out not to shadow', async () => {
      const story = await soleStory(`
        import { ButtonComponent } from './button.component';
        export default { title: 'Example/Button', component: ButtonComponent };
        const base = {};
        export const Default = {
          render: () => ({ template: '<sb-button from-story></sb-button>' }),
          ...base,
        };
      `);
      expect(story.warning).toBeUndefined();
      expect(extractHostComponentTemplate(story.snippet!)).toBe(
        '<sb-button from-story></sb-button>'
      );
    });

    it('falls back with a warning when a later spread cannot be read at all', async () => {
      const story = await soleStory(`
        import { ButtonComponent } from './button.component';
        export default { title: 'Example/Button', component: ButtonComponent };
        declare function makeBase(): object;
        export const Default = {
          render: () => ({ template: '<sb-button from-story></sb-button>' }),
          ...makeBase(),
        };
      `);
      expect(story.warning).toBe(
        'Incomplete snippet: `...makeBase()` could not be resolved statically.'
      );
      expect(story.snippet).not.toContain('from-story');
    });

    // `{ template: '…', ...makeBase() }` runs the spread after the write, so the template the story
    // ends up with may be a different one entirely.
    it('falls back when a later unreadable spread may replace the template', async () => {
      const story = await soleStory(`
        import { ButtonComponent } from './button.component';
        export default { title: 'Example/Button', component: ButtonComponent };
        declare function makeBase(): object;
        export const Default = {
          template: '<sb-button from-story></sb-button>',
          ...makeBase(),
        };
      `);
      expect(story.warning).toContain('`...makeBase()` could not be resolved statically');
      expect(story.snippet).not.toContain('from-story');
    });

    it('reads a config that is only a spread', async () => {
      const story = await soleStory(`
        import { ButtonComponent } from './button.component';
        export default { title: 'Example/Button', component: ButtonComponent };
        const base = { args: { label: 'From base' } };
        export const Default = { ...base };
      `);
      expect(story.warning).toBeUndefined();
      expect(story.snippet).toContain(`[label]="'From base'"`);
    });

    it('reads a template written after a harmless earlier spread', async () => {
      const story = await soleStory(`
        import { ButtonComponent } from './button.component';
        export default { title: 'Example/Button', component: ButtonComponent };
        const base = {};
        export const Default = { ...base, template: '<sb-button explicit></sb-button>' };
      `);
      expect(extractHostComponentTemplate(story.snippet!)).toBe('<sb-button explicit></sb-button>');
    });

    it('reads a spread of a module-level constant object into the args', async () => {
      const story = await soleStory(`
        import { ButtonComponent } from './button.component';
        export default { title: 'Example/Button', component: ButtonComponent };
        const extra = { label: 'extra' };
        export const Default = { args: { ...extra } };
      `);
      expect(extractHostComponentTemplate(story.snippet!)).toBe(
        `<sb-button [label]="'extra'" (pressed)="pressed($event)" />`
      );
    });

    it('reads a meta args spread of a module-level constant, story keys winning', async () => {
      const story = await soleStory(`
        import { ButtonComponent } from './button.component';
        const shared = { label: 'shared' };
        export default { title: 'Example/Button', component: ButtonComponent, args: { ...shared } };
        export const Default = { args: { label: 'Save' } };
      `);
      expect(extractHostComponentTemplate(story.snippet!)).toBe(
        `<sb-button [label]="'Save'" (pressed)="pressed($event)" />`
      );
    });

    it('reports a spread only a running story could produce', async () => {
      const story = await soleStory(`
        import { ButtonComponent } from './button.component';
        export default { title: 'Example/Button', component: ButtonComponent };
        const makeArgs = () => ({ label: 'computed' });
        export const Default = { args: { label: 'Save', ...makeArgs() } };
      `);
      expect(story.warning).toBe(
        'Incomplete snippet: `...makeArgs()` could not be resolved statically.'
      );
      expect(story.snippet).toContain(`[label]="'Save'"`);
    });

    // Assigning a member is not hiding it: the value the spread copies is the assigned one.
    it('applies a member assignment that has already run when the spread copies the object', async () => {
      const story = await soleStory(`
        import { ButtonComponent } from './button.component';
        export default { title: 'Example/Button', component: ButtonComponent };
        const extra = { label: 'extra' };
        extra.label = 'mutated';
        export const Default = { args: { ...extra } };
      `);
      expect(story.warning).toBeUndefined();
      expect(story.snippet).toContain(`[label]="'mutated'"`);
    });

    it('reports a spread of an object something mutates a level deeper', async () => {
      const story = await soleStory(`
        import { ButtonComponent } from './button.component';
        export default { title: 'Example/Button', component: ButtonComponent };
        const extra = { nested: { label: 'extra' } };
        extra.nested.label = 'mutated';
        export const Default = { args: { ...extra } };
      `);
      expect(story.warning).toContain('...extra');
    });

    // Which branch runs depends on the story's args at runtime.
    it('falls back with a warning for a render with more than one exit', async () => {
      const story = await soleStory(`
        import { ButtonComponent } from './button.component';
        export default { title: 'Example/Button', component: ButtonComponent };
        export const Default = {
          args: { label: 'Save' },
          render: (args) => {
            if (args.label) {
              return { template: '<sb-button first></sb-button>' };
            }
            return { template: '<sb-button second></sb-button>' };
          },
        };
      `);
      expect(story.warning).toContain('render:');
      expect(story.snippet).not.toContain('first');
      expect(story.snippet).toContain(`[label]="'Save'"`);
    });

    it('reports an opaque factory story even when its template reads', async () => {
      const story = await soleStory(`
        import { ButtonComponent } from './button.component';
        import { makeStory } from './factory';
        export default {
          title: 'Example/Button',
          component: ButtonComponent,
          render: () => ({ template: '<sb-button></sb-button>' }),
        };
        export const Default = makeStory('primary');
      `);
      expect({ snippet: story.snippet, warning: story.warning }).toMatchInlineSnapshot(`
        {
          "snippet": "import { Component } from '@angular/core';
        import { ButtonComponent } from './button.component';

        @Component({
          selector: 'app-demo',
          imports: [ButtonComponent],
          template: \`<sb-button (pressed)="pressed($event)" />\`,
        })
        export class DemoComponent {
          pressed(event: unknown) {}
        }",
          "warning": "Incomplete snippet: \`makeStory('primary')\` could not be resolved statically.",
        }
      `);
    });

    it('falls back with a warning when argsToTemplate options need the story to run', async () => {
      const story = await soleStory(`
        import { argsToTemplate } from '@storybook/angular-vite';
        import { ButtonComponent } from './button.component';
        export default { title: 'Example/Button', component: ButtonComponent };
        const INCLUDES = ['label'];
        export const Default = {
          args: { label: 'Save' },
          render: (args) => ({
            props: args,
            template: \`<sb-button \${argsToTemplate(args, { include: INCLUDES })}></sb-button>\`,
          }),
        };
      `);
      expect(story.warning).toContain('argsToTemplate(args, { include: INCLUDES })');
      expect(story.snippet).toContain(`[label]="'Save'"`);
    });

    it('falls back with a warning when argsToTemplate is given a derived object', async () => {
      const story = await soleStory(`
        import { argsToTemplate } from '@storybook/angular-vite';
        import { ButtonComponent } from './button.component';
        export default { title: 'Example/Button', component: ButtonComponent };
        export const Default = {
          args: { label: 'Save' },
          render: (args) => ({
            props: args,
            template: \`<sb-button \${argsToTemplate({ ...args, extra: 1 })}></sb-button>\`,
          }),
        };
      `);
      expect(story.warning).toContain('argsToTemplate({ ...args, extra: 1 })');
      expect(story.snippet).toContain(`[label]="'Save'"`);
    });
  });

  describe('config keys resolve with runtime object semantics', () => {
    it('reads a member-assigned render, which runs after the declaration', async () => {
      const story = await soleStory(`
        import { ButtonComponent } from './button.component';
        export default { title: 'Example/Button', component: ButtonComponent };
        export const Default = { args: { label: 'Save' } };
        Default.render = () => ({ template: '<div class="assigned"><sb-button></sb-button></div>' });
      `);
      expect(extractHostComponentTemplate(story.snippet!)).toBe(
        ['<div class="assigned">', '    <sb-button></sb-button>', '</div>'].join('\n')
      );
    });

    it('resolves duplicate template keys to the last occurrence', async () => {
      const story = await soleStory(`
        import { ButtonComponent } from './button.component';
        export default { title: 'Example/Button', component: ButtonComponent };
        export const Default = {
          template: '<sb-button first></sb-button>',
          template: '<sb-button second></sb-button>',
        };
      `);
      expect(extractHostComponentTemplate(story.snippet!)).toBe('<sb-button second></sb-button>');
    });

    it('reads a string-literal computed key the way the runtime does', async () => {
      const story = await soleStory(`
        import { ButtonComponent } from './button.component';
        export default { title: 'Example/Button', component: ButtonComponent };
        export const Default = { ['template']: '<sb-button computed></sb-button>' };
      `);
      expect(extractHostComponentTemplate(story.snippet!)).toBe('<sb-button computed></sb-button>');
    });

    it('falls back with a warning when a dynamic key could carry the template', async () => {
      const story = await soleStory(`
        import { ButtonComponent } from './button.component';
        export default { title: 'Example/Button', component: ButtonComponent };
        const key = 'template';
        export const Default = { args: { label: 'Save' }, [key]: '<sb-button dynamic></sb-button>' };
      `);
      expect(story.warning).toContain('[key]');
      expect(story.snippet).not.toContain('dynamic');
      expect(story.snippet).toContain(`[label]="'Save'"`);
    });
  });

  describe('interpolated identifiers resolve by scope', () => {
    it('substitutes a module-level constant the template interpolates', async () => {
      const story = await soleStory(`
        import { ButtonComponent } from './button.component';
        export default { title: 'Example/Button', component: ButtonComponent };
        const HEADER = '<h1>Hi</h1>';
        export const Default = {
          args: { label: 'Save' },
          render: (args) => ({ props: args, template: \`\${HEADER}<sb-button></sb-button>\` }),
        };
      `);
      expect(extractHostComponentTemplate(story.snippet!)).toBe(
        ['<h1>Hi</h1>', '<sb-button></sb-button>'].join('\n')
      );
    });

    // The render does not destructure `footer`, so the runtime reads the module constant, not the
    // same-named arg.
    it('prefers the module constant over a same-named arg the render never binds', async () => {
      const story = await soleStory(`
        import { ButtonComponent } from './button.component';
        export default { title: 'Example/Button', component: ButtonComponent };
        const footer = 'module value';
        export const Default = {
          args: { label: 'Save', footer: 'arg value' },
          render: (args) => ({ props: args, template: \`<sb-button>\${footer}</sb-button>\` }),
        };
      `);
      expect(extractHostComponentTemplate(story.snippet!)).toBe(
        '<sb-button>module value</sb-button>'
      );
    });

    // A reassigned binding's value at render time is not its initializer.
    it('emits no snippet when the interpolated binding is reassigned', async () => {
      const story = await soleStory(`
        import { ButtonComponent } from './button.component';
        export default { title: 'Example/Button', component: ButtonComponent };
        let footer = 'first';
        footer = 'second';
        export const Default = {
          args: { label: 'Save' },
          render: (args) => ({ props: args, template: \`<sb-button>\${footer}</sb-button>\` }),
        };
      `);
      expect(story.warning).toContain('${footer}');
      expect(story.snippet).toContain(`[label]="'Save'"`);
    });

    it('falls back with a warning for a template identifier that is reassigned', async () => {
      const story = await soleStory(`
        import { ButtonComponent } from './button.component';
        export default { title: 'Example/Button', component: ButtonComponent };
        let TEMPLATE = '<sb-button first></sb-button>';
        TEMPLATE = '<sb-button second></sb-button>';
        export const Default = { template: TEMPLATE };
      `);
      expect(story.warning).toContain('TEMPLATE');
      expect(story.snippet).not.toContain('first');
    });

    // The body-local declaration shadows the module constant the program scope would resolve.
    it('falls back with a warning when the render body declares the interpolated name', async () => {
      const story = await soleStory(`
        import { ButtonComponent } from './button.component';
        export default { title: 'Example/Button', component: ButtonComponent };
        const footer = 'module value';
        export const Default = {
          args: { label: 'Save' },
          render: (args) => {
            const footer = 'local value';
            return { props: args, template: \`<sb-button>\${footer}</sb-button>\` };
          },
        };
      `);
      expect(story.warning).toContain('${footer}');
      expect(story.snippet).not.toContain('local value');
      expect(story.snippet).toContain(`[label]="'Save'"`);
    });
  });

  describe('legacy CSF2 idioms', () => {
    it('follows Template.bind({}) to the template the story renders', async () => {
      const story = await soleStory(`
        import { ButtonComponent } from './button.component';
        export default { title: 'Example/Button', component: ButtonComponent };
        const Template = (args) => ({ props: args, template: '<div class="bound"><sb-button></sb-button></div>' });
        export const Default = Template.bind({});
        Default.args = { label: 'Save' };
      `);
      expect(extractHostComponentTemplate(story.snippet!)).toBe(
        ['<div class="bound">', '    <sb-button></sb-button>', '</div>'].join('\n')
      );
    });
  });

  describe('binding values survive the attribute position', () => {
    it.each([
      ["it's fine", "[label]=\"'it\\\\'s fine'\""],
      ['say "hi"', '[label]="\'say &quot;hi&quot;\'"'],
      ['Tom &amp; Jerry', '[label]="\'Tom &amp;amp; Jerry\'"'],
      ['broken &#65 reference', '[label]="\'broken &amp;#65 reference\'"'],
    ])('escapes %s losslessly', async (value, expected) => {
      const story = await soleStory(`
        import { ButtonComponent } from './button.component';
        export default { title: 'Example/Button', component: ButtonComponent };
        export const Default = { args: { label: ${JSON.stringify(value)} } };
      `);
      expect(story.snippet).toContain(expected);
    });

    it('binds an unevaluable arg the same way whatever whitespace the file uses', async () => {
      const storyFile = (eol: string, indent: string) =>
        [
          `import { ButtonComponent } from './button.component';`,
          `export default { title: 'Example/Button', component: ButtonComponent };`,
          `export const Default = {`,
          `${indent}args: {`,
          `${indent}${indent}label: (value) => {`,
          `${indent}${indent}${indent}return value.replace('a', 'b');`,
          `${indent}${indent}},`,
          `${indent}},`,
          `};`,
        ].join(eol);

      const lf = await soleStory(storyFile('\n', '  '));
      const crlf = await soleStory(storyFile('\r\n', '  '));
      const tabs = await soleStory(storyFile('\n', '\t'));

      expect(lf.snippet).toContain(
        `  label = (value) => {\n    return value.replace('a', 'b');\n  };`
      );
      expect(crlf.snippet).toBe(lf.snippet);
      expect(tabs.snippet).toBe(lf.snippet);
    });

    it.each([
      ['above the arg', `label:\n          // why\n          (value) => value.trim(),`],
      ['before the arg', `label: /* why */ (value) => value.trim(),`],
      ['inside the arg', `label: (value) => /* why */ value.trim(),`],
      ['inside the parameter list', `label: (/* why */ value) => value.trim(),`],
    ])('leaves a comment %s out of the binding', async (_name, property) => {
      const story = await soleStory(`
        import { ButtonComponent } from './button.component';
        export default { title: 'Example/Button', component: ButtonComponent };
        export const Default = { args: { ${property} } };
      `);
      expect(story.snippet).toContain(`label = (value) => value.trim();`);
    });
  });

  describe('args a template expression cannot carry', () => {
    /** Every arg below binds to one of these inputs; the enum is what `kind` resolves through. */
    const hoistDocgen = async (): Promise<AngularDocgenPayload> => ({
      id: 'example-button',
      name: 'ButtonComponent',
      path: STORY_PATH,
      jsDocTags: {},
      angularComponentMeta: {
        name: 'ButtonComponent',
        selector: 'sb-button',
        standalone: true,
        inputs: [
          'label',
          'count',
          'disabled',
          'tags',
          'data',
          'kind',
          'value',
          'constructed',
          'arrow',
          'globalCall',
          'globalRead',
          'interpolated',
        ],
        outputs: [],
        enums: [{ name: 'ButtonKind', members: [{ name: 'Secondary', value: 'secondary' }] }],
      },
    });

    const storyWithArgs = (args: string, prelude = '') =>
      soleStory(
        [
          `import { ButtonComponent } from './button.component';`,
          prelude,
          `export default { title: 'Example/Button', component: ButtonComponent };`,
          `export const Default = { args: { ${args} } };`,
        ].join('\n'),
        hoistDocgen
      );

    // One story per behaviour rather than one per input shape: the point of these snapshots is to
    // read the whole generated component, and five near-identical copies of it would obscure that.
    it('hoists every arg a template expression cannot carry', async () => {
      const story = await storyWithArgs(
        [
          `constructed: new Error('Failed to load cards.')`,
          `arrow: () => {}`,
          `globalCall: Array.from([1, 2], (index) => index)`,
          `globalRead: Date.now()`,
          'interpolated: `${1 + 1} items`',
        ].join(', ')
      );

      expect({ snippet: story.snippet, warning: story.warning }).toMatchInlineSnapshot(`
        {
          "snippet": "import { Component } from '@angular/core';
        import { ButtonComponent } from './button.component';

        @Component({
          selector: 'app-demo',
          imports: [ButtonComponent],
          template: \`
            <sb-button
                [constructed]="constructed"
                [arrow]="arrow"
                [globalCall]="globalCall"
                [globalRead]="globalRead"
                [interpolated]="interpolated"
            />\`,
        })
        export class DemoComponent {
          constructed = new Error('Failed to load cards.');
          arrow = () => {};
          globalCall = Array.from([1, 2], (index) => index);
          globalRead = Date.now();
          interpolated = \`\${1 + 1} items\`;
        }",
          "warning": undefined,
        }
      `);
    });

    it('inlines every arg that reduces to a literal', async () => {
      const story = await storyWithArgs(
        [
          `label: 'Save'`,
          `count: 3`,
          `disabled: true`,
          `tags: ['a', 'b']`,
          `data: { id: 7, deep: { ok: true } }`,
          `kind: ButtonKind.Secondary`,
        ].join(', '),
        `import { ButtonKind } from './kinds';`
      );

      expect({ snippet: story.snippet, warning: story.warning }).toMatchInlineSnapshot(`
        {
          "snippet": "import { Component } from '@angular/core';
        import { ButtonComponent } from './button.component';

        @Component({
          selector: 'app-demo',
          imports: [ButtonComponent],
          template: \`
            <sb-button
                [label]="'Save'"
                [count]="3"
                [disabled]="true"
                [tags]="['a', 'b']"
                [data]="{id: 7, deep: {ok: true}}"
                [kind]="'secondary'"
            />\`,
        })
        export class DemoComponent {}",
          "warning": undefined,
        }
      `);
    });

    it('indents a hoisted value that prints over several lines', async () => {
      const story = await storyWithArgs(`value: (item) => { return item.id; }`);

      expect(story.snippet).toMatchInlineSnapshot(`
        "import { Component } from '@angular/core';
        import { ButtonComponent } from './button.component';

        @Component({
          selector: 'app-demo',
          imports: [ButtonComponent],
          template: \`<sb-button [value]="value" />\`,
        })
        export class DemoComponent {
          value = (item) => {
            return item.id;
          };
        }"
      `);
    });

    it('leaves an arg naming what the snippet cannot provide as written, and still warns', async () => {
      const story = await storyWithArgs(
        `value: buildValue(seed)`,
        [`let seed = 1;`, `const buildValue = (n: number) => String(n);`].join('\n')
      );

      expect({ snippet: story.snippet, warning: story.warning }).toMatchInlineSnapshot(`
        {
          "snippet": "import { Component } from '@angular/core';
        import { ButtonComponent } from './button.component';

        @Component({
          selector: 'app-demo',
          imports: [ButtonComponent],
          template: \`<sb-button [value]="buildValue(seed)" />\`,
        })
        export class DemoComponent {}",
          "warning": "Incomplete snippet: \`buildValue\`, \`seed\`, \`buildValue(seed)\` could not be resolved statically.",
        }
      `);
    });

    it('keeps a hoisted value as TypeScript rather than escaping it for an attribute', async () => {
      const story = await storyWithArgs(`value: (text) => text.replace('"', "'")`);

      expect(story.snippet).toMatchInlineSnapshot(`
        "import { Component } from '@angular/core';
        import { ButtonComponent } from './button.component';

        @Component({
          selector: 'app-demo',
          imports: [ButtonComponent],
          template: \`<sb-button [value]="value" />\`,
        })
        export class DemoComponent {
          value = (text) => text.replace('"', '\\'');
        }"
      `);
      expect(story.snippet).not.toContain('&quot;');
    });

    const parseErrorsOf = (snippet: string | undefined) =>
      parseTemplate(extractHostComponentTemplate(snippet ?? '') ?? '', 'story-docs.html').errors;

    // Pinned deliberately: `parseTemplate` reports a clean parse as `errors === null` rather than as
    // an empty array, so an Angular release that started returning `[]` would turn the assertions
    // below - and `analyzeStoryTemplate`, which tests the same value for truthiness - vacuous.
    it('rejects inlined values and accepts the field binding that replaces them', () => {
      expect(parseTemplate(`<sb-button [value]="value" />`, 'story-docs.html').errors).toBeNull();
      expect(
        parseTemplate(`<sb-button [value]="new Error('x')" />`, 'story-docs.html').errors
      ).not.toBeNull();
      expect(
        parseTemplate(`<sb-button [value]="() => {}" />`, 'story-docs.html').errors
      ).not.toBeNull();
    });

    it.each([
      `new Error('Failed to load cards.')`,
      `() => {}`,
      `Array.from([1, 2], (index) => index)`,
      `Date.now()`,
    ])('emits a template Angular parses for %s', async (source) => {
      const story = await storyWithArgs(`value: ${source}`);

      expect(parseErrorsOf(story.snippet)).toBeNull();
    });
  });

  describe("spreads of another story's args", () => {
    const HEADER_STORY_PATH = join(process.cwd(), 'header.stories.ts');

    it("merges `...Primary.args` with the spreading story's own keys winning", async () => {
      const templates = await templatesOf(`
        import { ButtonComponent } from './button.component';
        export default { title: 'Example/Button', component: ButtonComponent };
        export const Primary = { args: { label: 'Button', count: 1 } };
        export const Secondary = { args: { ...Primary.args, label: 'Secondary' } };
      `);
      expect(templates.get('Secondary')).toBe(
        `<sb-button [label]="'Secondary'" [count]="1" (clicked)="clicked($event)" />`
      );
    });

    it('follows a chain of spreads across stories', async () => {
      const templates = await templatesOf(`
        import { ButtonComponent } from './button.component';
        export default { title: 'Example/Button', component: ButtonComponent };
        export const Primary = { args: { label: 'Button' } };
        export const Chained = { args: { ...Primary.args, count: 1 } };
        export const TwoDeep = { args: { ...Chained.args, label: 'deep' } };
      `);
      expect(templates.get('Two Deep')).toBe(
        `<sb-button [label]="'deep'" [count]="1" (clicked)="clicked($event)" />`
      );
    });

    it('reads `...Primary.input.args` on a factory story', async () => {
      const templates = await templatesOf(`
        import preview from '../.storybook/preview';
        import { ButtonComponent } from './button.component';
        const meta = preview.meta({ title: 'Example/Button', component: ButtonComponent });
        export const Primary = meta.story({ args: { label: 'Button', count: 1 } });
        export const Secondary = meta.story({ args: { ...Primary.input.args, label: 'Secondary' } });
      `);
      expect(templates.get('Secondary')).toBe(
        `<sb-button [label]="'Secondary'" [count]="1" (clicked)="clicked($event)" />`
      );
    });

    it('merges the parent chain of a factory `extend` story the way the runtime does', async () => {
      const templates = await templatesOf(`
        import preview from '../.storybook/preview';
        import { ButtonComponent } from './button.component';
        const meta = preview.meta({ title: 'Example/Button', component: ButtonComponent });
        export const Base = meta.story({ args: { label: 'base', count: 1 } });
        export const Extended = Base.extend({ args: { count: 2 } });
        export const Spread = meta.story({ args: { ...Extended.input.args, label: 'spread' } });
      `);
      expect(templates.get('Spread')).toBe(
        `<sb-button [label]="'spread'" [count]="2" (clicked)="clicked($event)" />`
      );
    });

    it("follows a namespace import to the other file's story", async () => {
      const templates = await templatesOf(
        `
          import { ButtonComponent } from './button.component';
          import * as HeaderStories from './header.stories';
          export default { title: 'Example/Button', component: ButtonComponent };
          export const LoggedIn = { args: { ...HeaderStories.LoggedIn.args } };
        `,
        {
          [HEADER_STORY_PATH]: `
            import { HeaderComponent } from './header.component';
            export default { title: 'Example/Header', component: HeaderComponent };
            export const LoggedIn = { args: { label: 'from header', count: 3 } };
          `,
        }
      );
      expect(templates.get('Logged In')).toBe(
        `<sb-button [label]="'from header'" [count]="3" (clicked)="clicked($event)" />`
      );
    });

    it("follows a named import to the other file's factory story", async () => {
      const templates = await templatesOf(
        `
          import { ButtonComponent } from './button.component';
          import { LoggedIn as HeaderLoggedIn } from './header.stories';
          export default { title: 'Example/Button', component: ButtonComponent };
          export const LoggedIn = { args: { ...HeaderLoggedIn.input.args } };
        `,
        {
          [HEADER_STORY_PATH]: `
            import preview from '../.storybook/preview';
            import { HeaderComponent } from './header.component';
            const meta = preview.meta({ title: 'Example/Header', component: HeaderComponent });
            export const LoggedIn = meta.story({ args: { label: 'from header' } });
          `,
        }
      );
      expect(templates.get('Logged In')).toBe(
        `<sb-button [label]="'from header'" (clicked)="clicked($event)" />`
      );
    });

    it('spreads the value visible where the spread runs, not the final one', async () => {
      const templates = await templatesOf(`
        import { ButtonComponent } from './button.component';
        export default { title: 'Example/Button', component: ButtonComponent };
        export const Primary = { args: { label: 'original' } };
        export const SeesOriginal = { args: { ...Primary.args } };
        Primary.args = { label: 'replaced' };
        export const SeesReplaced = { args: { ...Primary.args } };
      `);
      expect(templates.get('Sees Original')).toBe(
        `<sb-button [label]="'original'" (clicked)="clicked($event)" />`
      );
      expect(templates.get('Sees Replaced')).toBe(
        `<sb-button [label]="'replaced'" (clicked)="clicked($event)" />`
      );
    });

    it('reports a spread whose target is declared later (a TDZ read at runtime)', async () => {
      const stories = await storiesOf(`
        import { ButtonComponent } from './button.component';
        export default { title: 'Example/Button', component: ButtonComponent };
        export const Early = { args: { ...Later.args } };
        export const Later = { args: { label: 'later' } };
      `);
      expect(stories.get('Early')?.warning).toBe(
        'Incomplete snippet: `...Later.args` could not be resolved statically.'
      );
      expect(stories.get('Later')?.warning).toBeUndefined();
    });

    it("reports a spread when stories spread each other's args in a cycle", async () => {
      const stories = await storiesOf(`
        import { ButtonComponent } from './button.component';
        export default { title: 'Example/Button', component: ButtonComponent };
        export const Self = { args: { ...Self.args, label: 'self' } };
      `);
      expect(stories.get('Self')?.warning).toBe(
        'Incomplete snippet: `...Self.args` could not be resolved statically.'
      );
    });

    it('reports the spread when something mutates inside the args object', async () => {
      const stories = await storiesOf(`
        import { ButtonComponent } from './button.component';
        export default { title: 'Example/Button', component: ButtonComponent };
        export const Mutated = { args: { label: 'x' } };
        Mutated.args.label = 'mutated';
        export const Spreading = { args: { ...Mutated.args } };
      `);
      expect(stories.get('Mutated')?.warning).toContain('Mutated.args.label');
      expect(stories.get('Spreading')?.warning).toContain('...Mutated.args');
    });

    it("reports a spread whose accessor does not match the story's form", async () => {
      const stories = await storiesOf(`
        import preview from '../.storybook/preview';
        import { ButtonComponent } from './button.component';
        const meta = preview.meta({ title: 'Example/Button', component: ButtonComponent });
        export const Factory = meta.story({ args: { label: 'f' } });
        export const Wrong = meta.story({ args: { ...Factory.args } });
      `);
      expect(stories.get('Wrong')?.warning).toBe(
        'Incomplete snippet: `...Factory.args` could not be resolved statically.'
      );
    });

    it('reports a cross-file spread whose arg value does not reduce to a literal', async () => {
      const stories = await storiesOf(
        `
          import { ButtonComponent } from './button.component';
          import * as HeaderStories from './header.stories';
          export default { title: 'Example/Button', component: ButtonComponent };
          export const LoggedIn = { args: { ...HeaderStories.LoggedIn.args } };
        `,
        {
          [HEADER_STORY_PATH]: `
            import { HeaderComponent } from './header.component';
            import { REMOTE_LABEL } from './labels';
            export default { title: 'Example/Header', component: HeaderComponent };
            export const LoggedIn = { args: { label: REMOTE_LABEL } };
          `,
        }
      );
      expect(stories.get('Logged In')?.warning).toBe(
        'Incomplete snippet: `...HeaderStories.LoggedIn.args` could not be resolved statically.'
      );
    });
  });

  describe('args the generated element cannot represent', () => {
    it('reports an arg the component declares no input for', async () => {
      const story = await soleStory(`
        import { ButtonComponent } from './button.component';
        export default { title: 'Example/Button', component: ButtonComponent };
        export const Default = { args: { label: 'Save', tooltip: 'Hi' } };
      `);
      expect({ snippet: story.snippet, warning: story.warning }).toMatchInlineSnapshot(`
        {
          "snippet": "import { Component } from '@angular/core';
        import { ButtonComponent } from './button.component';

        @Component({
          selector: 'app-demo',
          imports: [ButtonComponent],
          template: \`<sb-button [label]="'Save'" (pressed)="pressed($event)" />\`,
        })
        export class DemoComponent {
          pressed(event: unknown) {}
        }",
          "warning": "Incomplete snippet: \`tooltip\` could not be bound, since ButtonComponent declares no such input.",
        }
      `);
    });

    it('names every arg it could not bind', async () => {
      const story = await soleStory(`
        import { ButtonComponent } from './button.component';
        export default { title: 'Example/Button', component: ButtonComponent };
        export const Default = { args: { tooltip: 'Hi', size: 'large' } };
      `);
      expect({ snippet: story.snippet, warning: story.warning }).toMatchInlineSnapshot(`
        {
          "snippet": "import { Component } from '@angular/core';
        import { ButtonComponent } from './button.component';

        @Component({
          selector: 'app-demo',
          imports: [ButtonComponent],
          template: \`<sb-button (pressed)="pressed($event)" />\`,
        })
        export class DemoComponent {
          pressed(event: unknown) {}
        }",
          "warning": "Incomplete snippet: \`tooltip\`, \`size\` could not be bound, since ButtonComponent declares no such input.",
        }
      `);
    });

    it('leaves an arg the component declares as an output to its handler', async () => {
      const story = await soleStory(`
        import { ButtonComponent } from './button.component';
        export default { title: 'Example/Button', component: ButtonComponent };
        export const Default = { args: { pressed: () => {} } };
      `);
      expect({ snippet: story.snippet, warning: story.warning }).toMatchInlineSnapshot(`
        {
          "snippet": "import { Component } from '@angular/core';
        import { ButtonComponent } from './button.component';

        @Component({
          selector: 'app-demo',
          imports: [ButtonComponent],
          template: \`<sb-button (pressed)="pressed($event)" />\`,
        })
        export class DemoComponent {
          pressed(event: unknown) {}
        }",
          "warning": undefined,
        }
      `);
    });

    it('reports an arg whose value another module owns', async () => {
      const story = await soleStory(`
        import { ButtonComponent } from './button.component';
        import { REMOTE_LABEL } from './labels';
        export default { title: 'Example/Button', component: ButtonComponent };
        export const Default = { args: { label: REMOTE_LABEL } };
      `);
      expect({ snippet: story.snippet, warning: story.warning }).toMatchInlineSnapshot(`
        {
          "snippet": "import { Component } from '@angular/core';
        import { ButtonComponent } from './button.component';

        @Component({
          selector: 'app-demo',
          imports: [ButtonComponent],
          template: \`<sb-button [label]="REMOTE_LABEL" (pressed)="pressed($event)" />\`,
        })
        export class DemoComponent {
          pressed(event: unknown) {}
        }",
          "warning": "Incomplete snippet: \`REMOTE_LABEL\` could not be resolved statically.",
        }
      `);
    });
  });

  describe('a source the author wrote', () => {
    it('omits generated code when authored source code is explicitly disabled', async () => {
      const story = await soleStory(`
        import { ButtonComponent } from './button.component';
        export default { title: 'Example/Button', component: ButtonComponent };
        export const Default = {
          args: { label: 'Save' },
          parameters: { docs: { source: { code: null } } },
        };
      `);
      expect({ snippet: story.snippet, warning: story.warning }).toMatchInlineSnapshot(`
        {
          "snippet": undefined,
          "warning": undefined,
        }
      `);
    });

    it('reports authored code it cannot read instead of replacing it silently', async () => {
      const story = await soleStory(`
        import { ButtonComponent } from './button.component';
        import { AUTHORED } from './authored';
        export default { title: 'Example/Button', component: ButtonComponent };
        export const Default = {
          args: { label: 'Save' },
          parameters: { docs: { source: { code: AUTHORED } } },
        };
      `);
      expect({ snippet: story.snippet, warning: story.warning }).toMatchInlineSnapshot(`
        {
          "snippet": "import { Component } from '@angular/core';
        import { ButtonComponent } from './button.component';

        @Component({
          selector: 'app-demo',
          imports: [ButtonComponent],
          template: \`<sb-button [label]="'Save'" (pressed)="pressed($event)" />\`,
        })
        export class DemoComponent {
          pressed(event: unknown) {}
        }",
          "warning": "Incomplete snippet: \`AUTHORED\` could not be resolved statically.",
        }
      `);
    });

    it('uses authored code even when core/docgen has no payload', async () => {
      const story = await soleStory(
        `
          import { ButtonComponent } from './button.component';
          export default { title: 'Example/Button', component: ButtonComponent };
          export const Default = {
            parameters: { docs: { source: { code: '<sb-button authored></sb-button>' } } },
          };
        `,
        noDocgen
      );
      expect({ snippet: story.snippet, warning: story.warning }).toMatchInlineSnapshot(`
        {
          "snippet": "<sb-button authored></sb-button>",
          "warning": undefined,
        }
      `);
    });
  });
});
