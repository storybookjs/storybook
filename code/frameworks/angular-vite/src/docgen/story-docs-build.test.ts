import type { IndexEntry } from 'storybook/internal/types';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { dedent } from 'ts-dedent';

import { vol } from 'memfs';

import type { AngularDocgenPayload } from './build-docgen.ts';
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
});
