// @vitest-environment happy-dom
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';

import { join } from 'pathe';
import { rolldown } from 'rolldown';
import { afterEach, describe, expect, it } from 'vitest';

const DIST = join(import.meta.dirname, '../../dist');
const TEST_BUILT = existsSync(join(DIST, 'test/index.js'));

// Vite's dependency optimizer (Vite 8), Rollup and webpack bundle `storybook/test` again, honoring
// `sideEffects` in package.json. The test libraries it bundles must still work after that.
describe('storybook/test bundled again by a consumer', () => {
  let workDir: string | undefined;
  afterEach(() => {
    if (workDir) {
      rmSync(workDir, { recursive: true, force: true });
    }
  });

  /** Bundles `source` with Rolldown, like a consumer bundler, and imports the result. */
  const bundleAndImport = async (source: string) => {
    // Inside the package, where Vitest serves modules from.
    const cacheDir = join(import.meta.dirname, '../../node_modules/.cache');
    mkdirSync(cacheDir, { recursive: true });
    workDir = mkdtempSync(join(cacheDir, 'storybook-rebundle-'));
    const input = join(workDir, 'consumer.mjs');
    writeFileSync(input, source);

    const build = await rolldown({ input, platform: 'browser', logLevel: 'silent' });
    await build.write({ dir: join(workDir, 'out'), format: 'es', entryFileNames: 'bundle.mjs' });
    await build.close();
    return import(/* @vite-ignore */ join(workDir, 'out/bundle.mjs'));
  };

  it.runIf(process.env.CI)('is built before this suite runs', () => {
    expect(TEST_BUILT).toBe(true);
  });

  it.runIf(TEST_BUILT)('initializes the libraries of storybook/test', async () => {
    const test = await bundleAndImport(
      `export * from ${JSON.stringify(join(DIST, 'test/index.js'))};`
    );

    document.body.innerHTML = '<button>Save</button>';
    const onClick = test.fn();
    document.querySelector('button')!.addEventListener('click', onClick);
    await test.userEvent.click(test.within(document.body).getByRole('button', { name: 'Save' }));
    test.expect(onClick).toHaveBeenCalledOnce();
    expect(() => test.expect(1).toBe(2)).toThrow('expected 1 to be 2');
  });
});
