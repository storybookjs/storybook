import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { detectSetupPatterns } from './setup-patterns';

const TEST_ROOT = join(process.cwd(), '.tmp-storybook-setup-eval-patterns');

afterEach(async () => {
  await import('node:fs/promises').then((fs) => fs.rm(TEST_ROOT, { recursive: true, force: true }));
});

describe('detectSetupPatterns', () => {
  it('detects common Storybook setup patterns from changed files', async () => {
    const previewPath = join(TEST_ROOT, '.storybook', 'preview.tsx');
    await mkdir(dirname(previewPath), { recursive: true });
    await writeFile(
      previewPath,
      `import '../src/index.css';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
`
    );

    const patterns = await detectSetupPatterns(TEST_ROOT, [previewPath]);
    expect(patterns.map((entry) => entry.id)).toEqual(
      expect.arrayContaining(['global-css', 'redux-provider', 'router-provider'])
    );
  });
});
