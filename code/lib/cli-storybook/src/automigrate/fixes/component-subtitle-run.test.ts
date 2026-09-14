import { readFile, writeFile } from 'node:fs/promises';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { componentSubtitle } from './component-subtitle.ts';

vi.mock('node:fs/promises', { spy: true });

afterEach(() => vi.restoreAllMocks());

describe('component-subtitle run', () => {
  it('does not write files when a migration fails', async () => {
    vi.mocked(readFile).mockImplementation(async (file) =>
      Buffer.from(
        file === 'safe.stories.ts'
          ? `export default { parameters: { componentSubtitle: 'Safe' } }`
          : `export default { parameters: { componentSubtitle: 'Legacy', docs: { ...docs } } }`
      )
    );

    await expect(
      componentSubtitle.run!({
        result: { files: ['safe.stories.ts', 'unsafe.stories.ts'] },
      } as never)
    ).rejects.toThrow();
    expect(writeFile).not.toHaveBeenCalled();
  });
});
