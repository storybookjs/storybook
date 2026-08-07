import type { IndexEntry } from 'storybook/internal/types';

import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, it, vi } from 'vitest';

import { AngularComponentMetaManager } from '@storybook/angular-cm';
import { buildDocgenPayload } from './build-docgen.ts';

// Unlike build-docgen.test.ts this file mocks nothing: the story file, the component, and the
// fixture tsconfig are read from the real filesystem, so the production seam
// (resolveStoryComponent -> extractComponentMeta -> extractArgTypesFromData) is crossed for real.
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

// The 30s timeout: the first extraction builds a cold TS LanguageService program (lib +
// @angular/core types), which can outrun the 10s default on CI.
it('builds a real payload through the TypeScript-backed analyzer', async () => {
  // The project's own compiler, exactly as the worker imports it.
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
    expect(payload?.angularComponentMeta?.name).toBe('ButtonComponent');
  } finally {
    manager.dispose();
  }
}, 30_000);
