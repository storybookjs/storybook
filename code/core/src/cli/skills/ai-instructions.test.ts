import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { fs, vol } from 'memfs';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import type { Options } from '../../types/index.ts';
import { resolveAIInstructions } from './ai-instructions.ts';

vi.mock('node:fs', { spy: true });
vi.mock('node:fs/promises', { spy: true });

beforeEach(() => {
  vol.reset();
  vi.mocked(existsSync).mockImplementation(fs.existsSync);
  vi.mocked(readFile).mockImplementation(fs.promises.readFile as typeof readFile);
});
afterEach(() => vi.restoreAllMocks());

it.each(['js', 'ts'] as const)(
  'reads the %s preview syntax and factory format',
  async (language) => {
    const configDir = resolve('/project/.storybook');
    vol.fromJSON({
      [resolve(configDir, 'main.ts')]: 'export default {};',
      [resolve(configDir, `preview.${language}`)]:
        "import { definePreview } from '@storybook/vue3-vite'; export default definePreview({});",
    });
    const apply = vi.fn().mockResolvedValue({ story: 'Custom story' });
    const options = { configDir, presets: { apply } } as unknown as Options;
    expect(await resolveAIInstructions(options, '@storybook/vue3-vite')).toEqual({
      story: 'Custom story',
    });
    expect(apply).toHaveBeenCalledWith(
      'experimental_aiInstructions',
      {},
      {
        aiContext: {
          framework: '@storybook/vue3-vite',
          configDir,
          language,
          hasCsfFactoryPreview: true,
        },
      }
    );
  }
);

it('uses the resolved setup context without reading config files again', async () => {
  const aiContext = {
    framework: '@custom/framework',
    configDir: '.storybook',
    language: 'js',
    hasCsfFactoryPreview: false,
  } as const;
  const apply = vi.fn().mockResolvedValue({});
  const options = { presets: { apply } } as unknown as Options;
  await resolveAIInstructions(options, aiContext.framework, aiContext);
  expect(existsSync).not.toHaveBeenCalled();
  expect(readFile).not.toHaveBeenCalled();
  expect(apply).toHaveBeenCalledWith('experimental_aiInstructions', {}, { aiContext });
});
