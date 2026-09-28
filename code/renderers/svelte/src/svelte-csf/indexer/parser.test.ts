import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeEach, describe, it, vi } from 'vitest';

const loadSvelteConfig = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock('@sveltejs/vite-plugin-svelte', () => ({ loadSvelteConfig }));

const currentDir = dirname(fileURLToPath(import.meta.url));
const storyFile = resolve(currentDir, '../../examples/Button.stories.svelte');

describe('parseForIndexer', () => {
  beforeEach(() => {
    // The config cache lives in module scope — reset modules so each test starts cold
    vi.resetModules();
    loadSvelteConfig.mockClear();
  });

  it('loads the Svelte config once across multiple story files', async ({ expect }) => {
    const { parseForIndexer } = await import('./parser.js');
    const files = [storyFile, resolve(currentDir, '../../examples/ExportName.stories.svelte')];

    for (const file of files) {
      await parseForIndexer(file, { legacyTemplate: false });
    }

    expect(loadSvelteConfig).toHaveBeenCalledTimes(1);
  });

  it('retries the Svelte config lookup after a failure instead of caching it', async ({
    expect,
  }) => {
    const { parseForIndexer } = await import('./parser.js');
    loadSvelteConfig.mockRejectedValueOnce(new Error('broken config'));

    await expect(parseForIndexer(storyFile, { legacyTemplate: false })).rejects.toThrow(
      'broken config'
    );
    await expect(parseForIndexer(storyFile, { legacyTemplate: false })).resolves.toBeDefined();

    expect(loadSvelteConfig).toHaveBeenCalledTimes(2);
  });
});
