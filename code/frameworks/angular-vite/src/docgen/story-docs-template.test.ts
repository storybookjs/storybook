import type { IndexEntry, ProvidedStoryDoc } from 'storybook/internal/types';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { dedent } from 'ts-dedent';

import { vol } from 'memfs';

import {
  type SnippetTemplate,
  fillTemplate,
  formatTemplate,
  stripHoles,
} from 'storybook/internal/docs-tools';

import { printHole } from '../client/docs/print-hole.ts';
import type { AngularHolePlace } from '../snippet-values.ts';
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

const docgen = async (): Promise<AngularDocgenPayload> => ({
  id: 'example-button',
  name: 'ButtonComponent',
  path: STORY_PATH,
  jsDocTags: {},
  angularComponentMeta: {
    name: 'ButtonComponent',
    selector: 'sb-button',
    standalone: true,
    inputs: ['label', 'size', 'config', 'formatter'],
    outputs: ['pressed'],
    enums: [],
  },
});

const storyDocs = async (source: string): Promise<ProvidedStoryDoc[]> => {
  vol.fromNestedJSON({ [STORY_PATH]: dedent(source) });
  const payload = await buildStoryDocsPayload({ entry }, { getDocgenPayload: docgen });
  return Object.values(payload!.stories);
};

const fill = (
  story: ProvidedStoryDoc,
  initialArgs: Record<string, unknown>,
  args = initialArgs
) => {
  expect(stripHoles(story.template!)).toBe(story.snippet);
  // The build writes Angular's places, which the payload type leaves to the renderer.
  const template = story.template as SnippetTemplate<AngularHolePlace>;
  return fillTemplate(template, { initialArgs, unmappedArgs: args }, printHole);
};

const IMPORTS = dedent`
  import { argsToTemplate } from '@storybook/angular-vite';
  import { ButtonComponent } from './button.component';
  export default { title: 'Example/Button', component: ButtonComponent };
`;

describe('story-docs templates', () => {
  it('is the snippet with a hole wherever it prints an arg, filled with the args it has', async () => {
    const [story] = await storyDocs(`
      ${IMPORTS}
      export const Default = {
        args: { label: 'Go', config: { a: 1 }, formatter: (value) => value.trim() },
      };
    `);
    expect(formatTemplate(story!.template!)).toContain(
      `[label]="⟦bind label⟫'Go'⟧"\n        [config]="⟦bind config⟫{a: 1}⟧"\n        [formatter]="formatter"`
    );
    expect(formatTemplate(story!.template!)).toContain(
      'formatter = ⟦field formatter⟫(value) => value.trim()⟧;'
    );

    const own = { label: 'Go', config: { a: 1 }, formatter: () => '' };
    expect(fill(story!, own)).toBe(story!.snippet);
    const changed = fill(story!, own, { ...own, label: 'Stop', config: { a: 2, b: 'x' } });
    expect(changed).toContain(`[label]="'Stop'"\n        [config]="{a: 2, b: 'x'}"`);
    expect(changed).toContain('formatter = (value) => value.trim();');
  });

  it('leaves out an argsToTemplate binding a control unsets', async () => {
    const [story] = await storyDocs(`
      ${IMPORTS}
      export const Default = {
        args: { label: 'Go', size: 'lg' },
        render: (args) => ({ props: args, template: \`<sb-button \${argsToTemplate(args)}></sb-button>\` }),
      };
    `);
    expect(formatTemplate(story!.template!)).toContain(
      `<sb-button⟦prop label ~" "⟫ [label]="'Go'"⟧⟦prop size ~" "⟫ [size]="'lg'"⟧⟦prop config ~" "⟫⟧⟦prop formatter ~" "⟫⟧></sb-button>`
    );
    const own = { label: 'Go', size: 'lg' };
    expect(fill(story!, own)).toBe(story!.snippet);
    expect(fill(story!, own, { label: 'Go', size: undefined })).toContain(
      `<sb-button [label]="'Go'"></sb-button>`
    );
  });

  it('gives an input the story does not set a binding hole, which a control fills', async () => {
    const [story] = await storyDocs(`
      ${IMPORTS}
      export const Default = {
        args: { label: 'Go' },
        render: (args) => ({ props: args, template: \`<sb-button \${argsToTemplate(args)}></sb-button>\` }),
      };
    `);
    const own = { label: 'Go' };
    expect(fill(story!, own)).toBe(story!.snippet);
    expect(fill(story!, own, { label: 'Go', size: 'lg' })).toContain(
      `<sb-button [label]="'Go'" [size]="'lg'"></sb-button>`
    );
  });

  it('gives an input a story without a render does not set a binding hole', async () => {
    const [story] = await storyDocs(`
      ${IMPORTS}
      export const Default = { args: { label: 'Go' } };
    `);
    const own = { label: 'Go' };
    expect(fill(story!, own)).toBe(story!.snippet);
    expect(fill(story!, own, { label: 'Go', size: 'lg' })).toContain(`[size]="'lg'"`);
  });

  it('lays out a template with unset inputs as its snippet', async () => {
    const [story] = await storyDocs(`
      ${IMPORTS}
      export const Default = {
        args: { label: 'A label long enough that the bindings go one per line', size: 'lg' },
      };
    `);
    const own = { label: 'A label long enough that the bindings go one per line', size: 'lg' };
    expect(fill(story!, own)).toBe(story!.snippet);
  });

  it('gives text the story sets to an empty string a hole', async () => {
    const [story] = await storyDocs(`
      ${IMPORTS}
      export const Default = {
        args: { label: '' },
        render: ({ label }) => ({ template: \`<sb-button>\${label}</sb-button>\` }),
      };
    `);
    expect(formatTemplate(story!.template!)).toContain('<sb-button>⟦text label⟫⟧</sb-button>');
    expect(fill(story!, { label: '' })).toBe(story!.snippet);
    expect(fill(story!, { label: '' }, { label: 'Stop' })).toContain('<sb-button>Stop</sb-button>');
  });

  it('fills text the markup interpolates', async () => {
    const [story] = await storyDocs(`
      ${IMPORTS}
      export const Default = {
        args: { label: 'Go' },
        render: ({ label }) => ({ template: \`<sb-button>\${label}</sb-button>\` }),
      };
    `);
    expect(formatTemplate(story!.template!)).toContain('<sb-button>⟦text label⟫Go⟧</sb-button>');
    expect(fill(story!, { label: 'Go' }, { label: 'Stop' })).toContain(
      '<sb-button>Stop</sb-button>'
    );
  });

  it('keeps the layout of the static snippet for any args', async () => {
    const [story] = await storyDocs(`
      ${IMPORTS}
      export const Default = {
        args: { label: 'A label long enough to break the element over lines', size: 'large' },
      };
    `);
    expect(story!.snippet).toContain('\n        [label]=');
    const own = { label: 'A label long enough to break the element over lines', size: 'large' };
    expect(fill(story!, own)).toBe(story!.snippet);
    expect(fill(story!, own, { ...own, label: 'Short' })).toContain(
      `\n        [label]="'Short'"\n        [size]="'large'"`
    );
  });

  it('keeps the layout of an argsToTemplate call after empty text', async () => {
    const [story] = await storyDocs(`
      ${IMPORTS}
      export const Default = {
        args: { label: '', size: 'lg' },
        render: ({ label, ...rest }) => ({
          props: rest,
          template: \`<p>\${label}</p><sb-button \${argsToTemplate(rest)}></sb-button>\`,
        }),
      };
    `);
    const own = { label: '', size: 'lg' };
    expect(fill(story!, own)).toBe(story!.snippet);
    expect(fill(story!, own, { label: '', size: 'sm' })).toContain(
      `<sb-button [size]="'sm'"></sb-button>`
    );
  });

  it('gives each argsToTemplate call its own holes', async () => {
    const [story] = await storyDocs(`
      ${IMPORTS}
      export const Default = {
        args: { label: 'Go' },
        render: (args) => ({
          props: args,
          template: \`<sb-button \${argsToTemplate(args)}></sb-button><sb-button \${argsToTemplate(args)}></sb-button>\`,
        }),
      };
    `);
    expect(fill(story!, { label: 'Go' })).toBe(story!.snippet);
    expect(fill(story!, { label: 'Go' }, { label: 'Stop' }).match(/'Stop'/g)).toHaveLength(2);
  });

  it('keeps the field of an arg the markup reads and the story sets to undefined', async () => {
    const [story] = await storyDocs(`
      ${IMPORTS}
      export const Default = {
        args: { label: 'Go', size: undefined },
        render: (args) => ({
          props: args,
          template: \`<sb-button \${argsToTemplate(args)}>{{ size }}</sb-button>\`,
        }),
      };
    `);
    expect(story!.snippet).toContain('size = undefined;');
    expect(fill(story!, { label: 'Go', size: undefined })).toBe(story!.snippet);
  });

  it('prints an object with a __proto__ key as next does', async () => {
    const [story] = await storyDocs(`
      ${IMPORTS}
      export const Default = { args: { config: { __proto__: { a: 1 } } } };
    `);
    expect(story!.snippet).toContain(`[config]="{}"`);
    expect(fill(story!, { config: {} })).toBe(story!.snippet);
  });

  it('gives a story whose code holds what a template prints a hole with a template', async () => {
    const [story] = await storyDocs(`
      ${IMPORTS}
      export const Default = { args: { label: '⟦bind x⟫y⟧' } };
    `);
    expect(fill(story!, { label: '⟦bind x⟫y⟧' })).toBe(story!.snippet);
    expect(fill(story!, { label: '⟦bind x⟫y⟧' }, { label: 'Stop' })).toContain(`[label]="'Stop'"`);
  });

  it('has no template where text the snippet escapes stands right before other text', async () => {
    const [story] = await storyDocs(`
      ${IMPORTS}
      export const Default = {
        args: { label: '\`x\`', size: 'B' },
        render: ({ label, size }) => ({ template: \`<p>\${label}\${size}</p>\` }),
      };
    `);
    expect(story!.snippet).toContain('<p>\\`x\\`B</p>');
    expect(story!.template).toBeUndefined();
  });

  it('fills text right before other text', async () => {
    const [story] = await storyDocs(`
      ${IMPORTS}
      export const Default = {
        args: { label: 'Go', size: 'B' },
        render: ({ label, size }) => ({ template: \`<p>\${label}\${size}</p>\` }),
      };
    `);
    expect(fill(story!, { label: 'Go', size: 'B' }, { label: 'Stop', size: 'B' })).toContain(
      '<p>StopB</p>'
    );
  });

  it('keeps the snippet of a story whose text holds the name of an argsToTemplate marker', async () => {
    const [story] = await storyDocs(`
      ${IMPORTS}
      export const Default = {
        args: { label: 'data-storybook-args-to-template-1', size: 'lg' },
        render: ({ label, ...rest }) => ({
          props: rest,
          template: \`<p>\${label}</p><sb-button \${argsToTemplate(rest)}></sb-button>\`,
        }),
      };
    `);
    expect(story!.error).toBeUndefined();
    expect(story!.snippet).toContain(`<sb-button [size]="'lg'"></sb-button>`);
  });

  it('has no template where next prints the author code', async () => {
    const [story] = await storyDocs(`
      ${IMPORTS}
      export const Default = {
        args: { label: 'Go' },
        parameters: { docs: { source: { code: '<sb-button />' } } },
      };
    `);
    expect(story!.snippet).toBe('<sb-button />');
    expect(story!.template).toBeUndefined();
  });
});

describe('a value a control sets', () => {
  const VALUES: unknown[] = [
    'Go',
    `it's "q"`,
    'a & b &amp; c',
    'line\nbreak',
    '`tick` ${x} \\',
    '',
    0,
    -1,
    1e3,
    1.5,
    true,
    false,
    null,
    undefined,
    [1, 'a', null],
    { a: 1, 'b-c': ['x'] },
  ];

  it.each(VALUES.map((value) => [value]))(
    '%s fills as the static snippet of a story setting it',
    async (value) => {
      const literal = value === undefined ? 'undefined' : JSON.stringify(value);
      const [written] = await storyDocs(`
      ${IMPORTS}
      export const Default = { args: { label: ${literal} } };
    `);
      const [story] = await storyDocs(`
      ${IMPORTS}
      export const Default = { args: { label: 'Go' } };
    `);
      expect(fill(story!, { label: 'Go' }, { label: value })).toBe(written!.snippet);
    }
  );
});
