import { readFile, writeFile } from 'node:fs/promises';

import { resolve } from 'node:path';

import { fs, vol } from 'memfs';
import { loadConfig } from 'storybook/internal/csf-tools';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { componentSubtitle } from './component-subtitle.ts';

vi.mock('node:fs/promises', { spy: true });

afterEach(() => {
  vi.restoreAllMocks();
  vol.reset();
});

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
    ).rejects.toThrow('- unsafe.stories.ts: Cannot mutate parameters.docs.subtitle');
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('includes all story files in preflight so inherited subtitles are checked', async () => {
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
      files: ['unsafe.stories.ts', 'unrelated.stories.ts'],
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
    ).rejects.toThrow('- unsafe.stories.ts: Cannot mutate parameters.docs.subtitle');
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

describe('component-subtitle writes', () => {
  it.each([false, true])('preflights and writes real files with dryRun=%s', async (dryRun) => {
    const previewConfigPath = resolve('project/.storybook/preview.ts');
    const storyPath = resolve('project/Button.stories.ts');
    const previewSource = "export default { parameters: { componentSubtitle: 'Preview' } };";
    const storySource = "export default { parameters: { componentSubtitle: 'Meta' } };";
    vol.fromJSON({ [previewConfigPath]: previewSource, [storyPath]: storySource });
    vi.mocked(readFile).mockImplementation(async (file) =>
      String(await fs.promises.readFile(String(file), 'utf8'))
    );
    vi.mocked(writeFile).mockImplementation(async (file, contents) => {
      if (typeof contents !== 'string') throw new Error('Expected migrated source text');
      await fs.promises.writeFile(String(file), contents);
    });

    const result = await componentSubtitle.check({
      previewConfigPath,
      storiesPaths: [storyPath],
    } as never);
    expect(result).toBeTruthy();
    await componentSubtitle.run!({ result, dryRun } as never);

    const preview = fs.readFileSync(previewConfigPath, 'utf8');
    const story = fs.readFileSync(storyPath, 'utf8');
    if (dryRun) {
      expect(preview).toBe(previewSource);
      expect(story).toBe(storySource);
    } else {
      expect(loadConfig(String(preview)).parse().getValue(['parameters', 'docs', 'subtitle'])).toBe(
        'Preview'
      );
      expect(loadConfig(String(story)).parse().getValue(['parameters', 'docs', 'subtitle'])).toBe(
        'Meta'
      );
      expect(preview).not.toContain('componentSubtitle');
      expect(story).not.toContain('componentSubtitle');
      await expect(
        componentSubtitle.check({ previewConfigPath, storiesPaths: [storyPath] } as never)
      ).resolves.toBeNull();
    }
  });
});
