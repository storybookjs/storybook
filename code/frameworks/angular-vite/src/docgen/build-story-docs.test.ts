import type { IndexEntry, StoryDocsPayload } from 'storybook/internal/types';

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import type { CompodocJson } from '@storybook/angular-compodoc';
import type { BuildStoryDocsContext } from './build-story-docs.ts';
import { buildStoryDocsPayload } from './build-story-docs.ts';
import type { CompodocComponentResolverOptions } from './compodoc-component-resolver.ts';
import { createCompodocComponentResolver } from './compodoc-component-resolver.ts';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '__testfixtures__');

/** The same shape production reads out of the resolved output directory. */
const documentationJson = () =>
  JSON.parse(readFileSync(join(FIXTURES, 'documentation.json'), 'utf8')) as CompodocJson;

const entry = (importPath: string, title = 'StoryDocs'): IndexEntry => ({
  id: 'storydocs--basic',
  name: 'Basic',
  title,
  type: 'story',
  subtype: 'story',
  importPath,
});

const compodocResolver = (overrides: Partial<CompodocComponentResolverOptions> = {}) =>
  createCompodocComponentResolver({
    workspaceRoot: FIXTURES,
    readMetadata: documentationJson,
    logger: { warn: vi.fn(), debug: vi.fn() },
    ...overrides,
  });

const build = (
  importPath: string,
  overrides: Partial<BuildStoryDocsContext> = {},
  title?: string
): StoryDocsPayload | undefined =>
  buildStoryDocsPayload(
    { entry: entry(importPath, title) },
    {
      storyRoot: FIXTURES,
      resolveComponent: compodocResolver(),
      logger: { debug: vi.fn() },
      ...overrides,
    }
  );

/** Snippet for one story export, keyed the way the payload is: by story id. */
const snippetOf = (payload: StoryDocsPayload | undefined, storyName: string) =>
  Object.values(payload?.stories ?? {}).find((story) => story.name === storyName)?.snippet;

const storyOf = (payload: StoryDocsPayload | undefined, storyName: string) =>
  Object.values(payload?.stories ?? {}).find((story) => story.name === storyName);

const warningOf = (payload: StoryDocsPayload | undefined, storyName: string) =>
  storyOf(payload, storyName)?.warning;

describe('buildStoryDocsPayload', () => {
  it('builds a payload for a real Angular story file', () => {
    const payload = build('./story-docs.stories.ts');

    expect(payload).toMatchObject({
      id: 'storydocs',
      name: 'ButtonComponent',
      path: './story-docs.stories.ts',
    });
    expect(snippetOf(payload, 'Basic')).toBe(
      `<sb-button [label]="'Save'" [count]="3" (clicked)="clicked($event)"></sb-button>`
    );
    expect(storyOf(payload, 'Basic')?.warning).toBeUndefined();
    // The bare template carries no imports of its own.
    expect(payload?.import).toBeUndefined();
  });

  it('merges meta args under story args', () => {
    // `label` comes from the meta, `count` from the story.
    expect(snippetOf(build('./story-docs.stories.ts'), 'Null Template')).toBe(
      `<sb-button [label]="'meta'" [count]="2" (clicked)="clicked($event)"></sb-button>`
    );
  });

  it('carries the story JSDoc description through', () => {
    expect(storyOf(build('./story-docs.stories.ts'), 'Basic')?.description).toBe(
      'Renders the button with a label and a count.'
    );
  });

  it.each([
    ['Own Template', '<sb-button emphasis>hi</sb-button>'],
    // An empty string is a user-defined template, matching the preview's own rule.
    ['Empty Template', ''],
    ['Render Template', '<sb-button rendered></sb-button>'],
    // CSF2: the story is the render function, and Angular's idiom is to return `{ template }`.
    ['Csf 2 Function', '<sb-button csf2></sb-button>'],
  ])('leaves the %s story alone', (storyName, expected) => {
    expect(snippetOf(build('./story-docs.stories.ts'), storyName)).toBe(expected);
  });

  it('reports args a spread hid rather than shipping a snippet that looks complete', () => {
    const story = storyOf(build('./story-docs.stories.ts'), 'Spread Args');

    // The note is data on the story, not a comment inside the markup, so a consumer that renders
    // the snippet is not left with a stray comment and one that reads it can act on it.
    expect(story?.snippet).toBe(
      `<sb-button [label]="'meta'" [count]="1" (clicked)="clicked($event)"></sb-button>`
    );
    expect(story?.warning).toBe(
      'Incomplete snippet: `...sharedArgs` could not be resolved statically.'
    );
  });

  it('reports a spread at the config level, not only one inside args', () => {
    expect(warningOf(build('./story-docs.stories.ts'), 'Config Spread')).toBe(
      'Incomplete snippet: `...Basic` could not be resolved statically.'
    );
  });

  it.each([
    // Emitting the identifier's source text would put JavaScript in the Source block where the
    // user expects markup, so the template is reported as unresolvable instead.
    ['Hoisted Template', 'HOISTED_TEMPLATE'],
    // A `render` that is not an inline function returning an object literal may still produce
    // markup; generating an element from args would silently replace it.
    ['Render Identifier', 'render: renderFn'],
  ])('reports the %s story rather than printing its JavaScript', (storyName, expected) => {
    const story = storyOf(build('./story-docs.stories.ts'), storyName);
    expect(story?.warning).toContain(`\`${expected}\``);
    expect(story?.snippet).toContain('<sb-button');
    expect(story?.snippet).not.toContain(expected);
  });

  // `export { X }` is registered by a different branch of the CSF parser, which records no
  // declaration path. Reading only that path silently fell back to the meta's args.
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
    expect(snippetOf(build('./story-docs.stories.ts'), storyName)).toBe(expected);
  });

  it('isolates a story it cannot read and still ships the rest of the file', () => {
    const payload = build('./story-docs.stories.ts');

    expect(storyOf(payload, 'Unclassifiable')).toMatchObject({
      error: { message: expect.stringContaining('Could not evaluate story expression') },
    });
    expect(storyOf(payload, 'Unclassifiable')?.snippet).toBeUndefined();
    expect(snippetOf(payload, 'Basic')).toBeDefined();
  });

  it.each([
    ['a story file that does not exist', './missing.stories.ts', {}],
    ['a story file with no meta.component', './no-component.stories.ts', {}],
    [
      'a component the docgen engine has nothing for',
      './story-docs.stories.ts',
      { resolveComponent: (): undefined => undefined },
    ],
    [
      'a component Compodoc never documented',
      './story-docs.stories.ts',
      {
        resolveComponent: compodocResolver({
          readMetadata: (): CompodocJson => ({ components: [] }),
        }),
      },
    ],
    [
      'unreadable Compodoc metadata',
      './story-docs.stories.ts',
      {
        resolveComponent: compodocResolver({
          readMetadata: () => {
            throw new Error('ENOENT');
          },
        }),
      },
    ],
  ])('falls through for %s', (_case, importPath, overrides) => {
    expect(build(importPath, overrides as Partial<BuildStoryDocsContext>)).toBeUndefined();
  });

  it('falls through when the entry has no story import path', () => {
    expect(
      buildStoryDocsPayload(
        {
          entry: { id: 'x', name: 'x', title: 'x', type: 'docs', storiesImports: [] } as IndexEntry,
        },
        {
          storyRoot: FIXTURES,
          resolveComponent: compodocResolver(),
          logger: { debug: vi.fn() },
        }
      )
    ).toBeUndefined();
  });

  // Compodoc is one source of a component's selector and binding names; an in-process Angular
  // component meta service is meant to be another. Snippet generation must not care which.
  it('builds from a resolver that has never heard of Compodoc', () => {
    const payload = build('./story-docs.stories.ts', {
      resolveComponent: () => ({
        name: 'ButtonComponent',
        selector: 'my-button',
        inputs: ['label'],
        outputs: ['pressed'],
      }),
    });

    expect(snippetOf(payload, 'Basic')).toBe(
      `<my-button [label]="'Save'" (pressed)="pressed($event)"></my-button>`
    );
  });
});

describe('buildStoryDocsPayload in component format', () => {
  const componentPayload = () =>
    build('./story-docs.stories.ts', { snippetFormat: 'component' as const });

  it('wraps the generated bindings in a host component that declares their handlers', () => {
    expect(snippetOf(componentPayload(), 'Basic')).toBe(
      `@Component({
  selector: 'app-root',
  template: \`<sb-button [label]="'Save'" [count]="3" (clicked)="clicked($event)"></sb-button>\`,
  imports: [ButtonComponent],
})
export class App {
  clicked(event: unknown) {}
}`
    );
  });

  it('carries the import block once for the whole component', () => {
    expect(componentPayload()?.import).toBe(
      `import { Component } from '@angular/core';\nimport { ButtonComponent } from './button.component';`
    );
  });

  it('declares no handlers for a story that supplied its own template', () => {
    // Which outputs the user's markup binds is unknowable, so inventing methods for all of them
    // would put members on the host that its template never references.
    expect(snippetOf(componentPayload(), 'Own Template')).toBe(
      `@Component({
  selector: 'app-root',
  template: \`<sb-button emphasis>hi</sb-button>\`,
  imports: [ButtonComponent],
})
export class App {}`
    );
  });

  it('reports an unresolved arg on the story, not inside the component it emits', () => {
    const story = storyOf(componentPayload(), 'Spread Args');

    expect(story?.warning).toBe(
      'Incomplete snippet: `...sharedArgs` could not be resolved statically.'
    );
    expect(story?.snippet).not.toContain('sharedArgs');
  });
});
