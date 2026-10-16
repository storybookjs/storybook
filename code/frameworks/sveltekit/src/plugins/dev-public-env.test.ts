import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createServer } from 'vite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { devPublicEnv } from './dev-public-env.ts';

// The module that SvelteKit writes for `$app/env/public` in development
async function evaluateDevPublicEnv() {
  const root = await mkdtemp(join(tmpdir(), 'sveltekit-env-'));
  await mkdir(join(root, '.svelte-kit/generated/dev/env/public'), { recursive: true });
  await writeFile(
    join(root, '.svelte-kit/generated/dev/env/public/client.js'),
    `const { env } = globalThis.__sveltekit_dev;\n\nexport const DYNAMIC = env.DYNAMIC;\nexport const STATIC = "static";\n`
  );
  const server = await createServer({
    root,
    configFile: false,
    logLevel: 'silent',
    appType: 'custom',
    server: { middlewareMode: true, ws: false },
    plugins: [devPublicEnv()],
  });
  try {
    const result = await server.environments.client.transformRequest(
      '/.svelte-kit/generated/dev/env/public/client.js'
    );
    // A unique URL, so each test evaluates the module again
    return await import(`data:text/javascript,${encodeURIComponent(`${result!.code}\n//${root}`)}`);
  } finally {
    await server.close();
  }
}

describe('devPublicEnv', () => {
  // The module under test sets the global itself, so stub it to restore it after each test
  beforeEach(() => {
    vi.stubGlobal('__sveltekit_dev', undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('evaluates `$app/env/public` before anything sets the SvelteKit global', async () => {
    await expect(evaluateDevPublicEnv()).resolves.toMatchObject({
      DYNAMIC: undefined,
      STATIC: 'static',
    });
  });

  it('evaluates `$app/env/public` when the global has no `env`', async () => {
    vi.stubGlobal('__sveltekit_dev', { base: '' });

    await expect(evaluateDevPublicEnv()).resolves.toMatchObject({ DYNAMIC: undefined });
  });

  it('keeps an `env` that is already set', async () => {
    vi.stubGlobal('__sveltekit_dev', { env: { DYNAMIC: 'value' } });

    await expect(evaluateDevPublicEnv()).resolves.toMatchObject({ DYNAMIC: 'value' });
  });
});
