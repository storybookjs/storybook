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

const entry: IndexEntry = {
  id: 'button--default',
  name: 'Default',
  title: 'Button',
  type: 'story',
  subtype: 'story',
  importPath: relative(process.cwd(), STORY_PATH),
};

// A cold TS program (lib + @angular/core types) can outrun the 10s default timeout on CI.
it('builds a real payload through the TypeScript-backed analyzer', async () => {
  const typescript = await import('typescript');
  const manager = new AngularComponentMetaManager(typescript.default ?? typescript);
  try {
    const payload = buildDocgenPayload(
      { entry },
      {
        manager,
        options: {},
        logger: { warn: vi.fn(), debug: vi.fn() },
        resolvePath: () => STORY_PATH,
      }
    );

    expect(payload?.error).toBeUndefined();
    expect(payload?.name).toBe('ButtonComponent');
    expect(payload?.argTypes?.label).toMatchObject({
      name: 'label',
      table: { category: 'inputs' },
    });
    expect(payload?.angularComponentMeta).toMatchObject({
      name: 'ButtonComponent',
      inputs: ['label'],
    });
  } finally {
    manager.dispose();
  }
}, 30_000);
