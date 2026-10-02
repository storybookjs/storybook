import { existsSync } from 'node:fs';
import { isAbsolute } from 'node:path';

import { describe, expect, it } from 'vitest';

import { SVELTE_CSF_RUNTIME_STORIES_IMPORT_SOURCE } from '../constants.ts';
import { transformPlugin } from './plugins.ts';

describe(transformPlugin.name, () => {
  it('resolves the runtime stories import to a file, so stories files resolve it without a direct dependency', async () => {
    const plugin = await transformPlugin();
    const resolveId = plugin.resolveId as (source: string) => string | undefined;

    const resolved = resolveId(SVELTE_CSF_RUNTIME_STORIES_IMPORT_SOURCE);

    expect(resolved).toBeDefined();
    expect(isAbsolute(resolved!)).toBe(true);
    expect(existsSync(resolved!)).toBe(true);
    expect(resolveId('./Button.svelte')).toBeUndefined();
  });
});
