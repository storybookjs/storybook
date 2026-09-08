import { readFile, writeFile } from 'node:fs/promises';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { componentSubtitle } from './component-subtitle.ts';

vi.mock('node:fs/promises', { spy: true });

afterEach(() => vi.restoreAllMocks());

describe('component-subtitle file migration', () => {
  it('does not write any file when one file cannot be migrated', async () => {
    vi.mocked(readFile).mockImplementation(async (file) =>
      Buffer.from(
        file === 'safe.stories.ts'
          ? `export default { parameters: { componentSubtitle: 'Safe' } }`
          : `export default {
              parameters: {
                componentSubtitle: 'Legacy',
                docs: { subtitle: getSubtitle() }
              }
            }`
      )
    );

    await expect(
      componentSubtitle.run!({
        result: { files: ['safe.stories.ts', 'unsafe.stories.ts'] },
      } as never)
    ).rejects.toThrow('- unsafe.stories.ts: parameters.docs.subtitle has dynamic truthiness');
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('uses AST candidates in check without matching unrelated source text', async () => {
    vi.mocked(readFile).mockImplementation(async (file) =>
      Buffer.from(
        file === 'unsafe.stories.ts'
          ? `const legacyParameters = { componentSubtitle: 'Legacy' };
             export default { parameters: { ...legacyParameters } };`
          : `export default { parameters: { ...parameters } };
             export const Primary = { args: { componentSubtitle: 'A component prop' } };`
      )
    );

    await expect(
      componentSubtitle.check!({
        storiesPaths: ['unsafe.stories.ts', 'unrelated.stories.ts'],
      } as never)
    ).resolves.toEqual({
      files: ['unsafe.stories.ts'],
      previewConfigPath: undefined,
    });
  });

  it('keeps run atomic for an unsafe docs.subtitle accessor', async () => {
    vi.mocked(readFile).mockImplementation(async (file) =>
      Buffer.from(
        file === 'safe.stories.ts'
          ? `export default { parameters: { componentSubtitle: 'Safe' } }`
          : `export default {
              parameters: {
                componentSubtitle: 'Legacy',
                docs: { get subtitle() { return 'Current'; } }
              }
            }`
      )
    );

    await expect(
      componentSubtitle.run!({
        result: { files: ['safe.stories.ts', 'unsafe.stories.ts'] },
      } as never)
    ).rejects.toThrow(
      '- unsafe.stories.ts: parameters.docs.subtitle does not have a supported value'
    );
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('reads preview precedence even when the preview itself needs no migration', async () => {
    vi.mocked(readFile).mockImplementation(async (file) =>
      Buffer.from(
        file === '.storybook/preview.ts'
          ? `export default { parameters: { docs: { subtitle: 'Global' } } }`
          : `export default { parameters: { componentSubtitle: 'Legacy' } }`
      )
    );

    await expect(
      componentSubtitle.run!({
        result: {
          files: ['Button.stories.ts'],
          previewConfigPath: '.storybook/preview.ts',
        },
      } as never)
    ).rejects.toThrow('inherited parameters.docs.subtitle');
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('treats indirect preview parameters as possible inherited precedence', async () => {
    vi.mocked(readFile).mockImplementation(async (file) =>
      Buffer.from(
        file === '.storybook/preview.ts'
          ? `const parameters = { docs: { subtitle: 'Global' } };
             export default { parameters };`
          : `export default { parameters: { componentSubtitle: 'Legacy' } }`
      )
    );

    await expect(
      componentSubtitle.run!({
        result: {
          files: ['Button.stories.ts'],
          previewConfigPath: '.storybook/preview.ts',
        },
      } as never)
    ).rejects.toThrow('inherited parameters.docs.subtitle');
  });
});
