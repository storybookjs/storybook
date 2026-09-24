import type { IndexEntry } from 'storybook/internal/types';

import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, it, vi } from 'vitest';

import { adaptCoreComponent, formatComponentManifest } from 'storybook/internal/toolsets-docs';
import { AngularComponentMetaManager } from '@storybook/angular-cm';
import { buildDocgenPayload } from './build-docgen.ts';

// Nothing here is mocked: the story file, the component and the fixture tsconfig come off the real
// filesystem.
const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '__testfixtures__');
const STORY_PATH = join(FIXTURES, 'button.stories.ts');
const COLOR_PICKER_STORY_PATH = join(FIXTURES, 'color-picker.stories.ts');
const COMPOSITE_STORY_PATH = join(FIXTURES, 'composite.stories.ts');

const entryFor = (storyPath: string, id: string, title: string): IndexEntry => ({
  id: `${id}--default`,
  name: 'Default',
  title,
  type: 'story',
  subtype: 'story',
  importPath: relative(process.cwd(), storyPath),
});

const entry = entryFor(STORY_PATH, 'button', 'Button');

const withRealAnalyzer = async <T>(run: (manager: AngularComponentMetaManager) => T) => {
  const typescript = await import('typescript');
  const manager = new AngularComponentMetaManager(typescript.default ?? typescript);
  try {
    return run(manager);
  } finally {
    manager.dispose();
  }
};

// A cold TS program (lib + @angular/core types) can outrun the 10s default timeout on CI.
it('builds a real payload through the TypeScript-backed analyzer', async () => {
  const payload = await withRealAnalyzer((manager) =>
    buildDocgenPayload(
      { entry },
      {
        manager,
        options: { propsTable: 'api' },
        logger: { warn: vi.fn(), debug: vi.fn() },
        resolvePath: () => STORY_PATH,
      }
    )
  );

  expect(payload?.error).toBeUndefined();
  expect(payload?.name).toBe('ButtonComponent');
  expect({ description: payload?.description, jsDocTags: payload?.jsDocTags })
    .toMatchInlineSnapshot(`
      {
        "description": "Renders with {@link IconButton } in prose.
      Use together with",
        "jsDocTags": {
          "deprecated": [
            "Use NewButton.",
          ],
          "example": [
            "<sb-button label="Save">
      Save
      </sb-button>",
          ],
          "see": [
            "ButtonGroup for accessibility.",
          ],
        },
      }
    `);
  expect(payload?.argTypes?.label).toMatchObject({
    name: 'label',
    table: { category: 'inputs' },
  });
  expect(payload?.angularComponentMeta).toMatchObject({
    name: 'ButtonComponent',
    inputs: ['label'],
  });
  // The button story declares no subcomponents: the key is absent entirely.
  expect(payload && 'subcomponents' in payload).toBe(false);
}, 30_000);

it('documents a real declared subcomponent through the same chain as the primary', async () => {
  const payload = await withRealAnalyzer((manager) =>
    buildDocgenPayload(
      { entry: entryFor(COMPOSITE_STORY_PATH, 'composite', 'Composite') },
      {
        manager,
        options: { propsTable: 'api' },
        logger: { warn: vi.fn(), debug: vi.fn() },
        resolvePath: () => COMPOSITE_STORY_PATH,
      }
    )
  );

  expect(payload?.error).toBeUndefined();
  expect(payload?.name).toBe('ButtonComponent');
  expect(payload?.subcomponents?.ColorPicker).toMatchObject({
    name: 'ColorPickerComponent',
    path: join(FIXTURES, 'color-picker.component.ts'),
    description: 'The colour picker panel.',
    renderer: 'angular',
  });
  expect(payload?.subcomponents?.ColorPicker?.argTypes?.color).toMatchObject({
    name: 'color',
    table: { category: 'inputs' },
  });
  expect(payload?.subcomponents?.ColorPicker?.apiDescription).toContain(
    'export type ColorPickerComponentInputs = {'
  );
  expect(payload?.subcomponents?.ColorPicker?.error).toBeUndefined();
}, 30_000);

// The payload alone doesn't prove a subcomponent actually renders where MCP's `docs.show` puts it:
// core's `formatComponentManifest` synthesizes `## Subcomponents` from the flat payload record and
// demotes each child's own apiDescription headings underneath it. This runs the same real analyzer
// chain as above, then the exact composition function MCP calls, and snapshot-compares the full
// rendered markdown so a regression in that composition — a dropped section, a duplicated heading,
// a child whose headings stop being demoted — shows as a diff here rather than only in a QA run.
it('renders a real declared subcomponent under `## Subcomponents` in the composed markdown', async () => {
  const payload = await withRealAnalyzer((manager) =>
    buildDocgenPayload(
      { entry: entryFor(COMPOSITE_STORY_PATH, 'composite', 'Composite') },
      {
        manager,
        options: { propsTable: 'api' },
        logger: { warn: vi.fn(), debug: vi.fn() },
        resolvePath: () => COMPOSITE_STORY_PATH,
      }
    )
  );

  expect(payload?.error).toBeUndefined();
  const manifest = adaptCoreComponent({ ...payload!, id: payload!.id, name: payload!.name });
  const markdown = formatComponentManifest(manifest);

  expect(markdown).toMatchInlineSnapshot(`
    "# ButtonComponent

    ID: composite

    > **Deprecated:** Use NewButton.

    Renders with {@link IconButton } in prose.
    Use together with

    > **See:** ButtonGroup for accessibility.

    **Example:**
    \`\`\`
    <sb-button label="Save">
    Save
    </sb-button>
    \`\`\`

    ## Subcomponents

    ### ColorPickerComponent

    The colour picker panel.

    #### Inputs

    \`\`\`
    export type ColorPickerComponentInputs = {
      /**
       * The currently selected colour
       *
       * @default #345F92
       */
      color?: string; // two-way: [(color)]
    }
    \`\`\`

    #### Outputs

    \`\`\`
    export type ColorPickerComponentOutputs = {
      /** The currently selected colour */
      colorChange: (e: string) => void;
    }
    \`\`\`

    ## Inputs

    \`\`\`
    export type ButtonComponentInputs = {
      /** @default Click me */
      label?: string;
    }
    \`\`\`"
  `);
}, 30_000);

it('renders no `## Subcomponents` section when the component declares none', async () => {
  const payload = await withRealAnalyzer((manager) =>
    buildDocgenPayload(
      { entry },
      {
        manager,
        options: { propsTable: 'api' },
        logger: { warn: vi.fn(), debug: vi.fn() },
        resolvePath: () => STORY_PATH,
      }
    )
  );

  expect(payload?.error).toBeUndefined();
  const manifest = adaptCoreComponent({ ...payload!, id: payload!.id, name: payload!.name });
  const markdown = formatComponentManifest(manifest);

  expect(markdown).not.toContain('## Subcomponents');
}, 30_000);

it('documents a real `model()` as one two-way input and one Change output', async () => {
  const payload = await withRealAnalyzer((manager) =>
    buildDocgenPayload(
      { entry: entryFor(COLOR_PICKER_STORY_PATH, 'color-picker', 'ColorPicker') },
      {
        manager,
        options: { propsTable: 'api' },
        logger: { warn: vi.fn(), debug: vi.fn() },
        resolvePath: () => COLOR_PICKER_STORY_PATH,
      }
    )
  );

  expect(payload?.error).toBeUndefined();
  expect(payload?.renderer).toBe('angular');
  expect(payload?.apiDescription).toMatchInlineSnapshot(`
    "## Inputs

    \`\`\`
    export type ColorPickerComponentInputs = {
      /**
       * The currently selected colour
       *
       * @default #345F92
       */
      color?: string; // two-way: [(color)]
    }
    \`\`\`

    ## Outputs

    \`\`\`
    export type ColorPickerComponentOutputs = {
      /** The currently selected colour */
      colorChange: (e: string) => void;
    }
    \`\`\`"
  `);
}, 30_000);
