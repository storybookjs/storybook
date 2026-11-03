import type { IndexEntry, StoryDoc } from 'storybook/internal/types';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { dedent } from 'ts-dedent';

import { vol } from 'memfs';

import { asWrittenArgs } from 'storybook/internal/docs-tools';

import { fillTemplate } from '../client/docs/fill-template.ts';
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

const storyDocs = async (source: string): Promise<StoryDoc[]> => {
  vol.fromNestedJSON({ [STORY_PATH]: dedent(source) });
  const payload = await buildStoryDocsPayload({ entry }, { getDocgenPayload: docgen });
  return Object.values(payload!.stories);
};

// As the preview fills a template: an arg no control changed is the code it is written with.
const fill = (story: StoryDoc, initialArgs: Record<string, unknown>, args = initialArgs) =>
  fillTemplate(
    story.template!,
    asWrittenArgs({ args, unmappedArgs: args, initialArgs }, story.argCode)
  );

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
    expect(story!.template).toContain(
      '[label]="⟦bind label⟧"\n        [config]="⟦bind config⟧"\n        [formatter]="formatter"'
    );
    expect(story!.template).toContain('formatter = ⟦field formatter⟧;');
    expect(story!.argCode).toEqual({ formatter: '(value) => value.trim()' });

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
    expect(story!.template).toContain('<sb-button ⟦prop label⟧ ⟦prop size⟧></sb-button>');
    const own = { label: 'Go', size: 'lg' };
    expect(fill(story!, own)).toBe(story!.snippet);
    expect(fill(story!, own, { label: 'Go', size: undefined })).toContain(
      `<sb-button [label]="'Go'"></sb-button>`
    );
  });

  it('fills text the markup interpolates', async () => {
    const [story] = await storyDocs(`
      ${IMPORTS}
      export const Default = {
        args: { label: 'Go' },
        render: ({ label }) => ({ template: \`<sb-button>\${label}</sb-button>\` }),
      };
    `);
    expect(story!.template).toContain('<sb-button>⟦text label⟧</sb-button>');
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
