import type { IndexEntry } from 'storybook/internal/types';

import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, it, vi } from 'vitest';

import { AngularComponentMetaManager } from '@storybook/angular-cm';
import { buildDocgenPayload } from './build-docgen.ts';

// Nothing here is mocked: the story file, the component and the fixture tsconfig come off the real
// filesystem.
const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '__testfixtures__');
const STORY_PATH = join(FIXTURES, 'button.stories.ts');
const COLOR_PICKER_STORY_PATH = join(FIXTURES, 'color-picker.stories.ts');

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
