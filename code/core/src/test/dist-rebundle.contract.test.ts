// @vitest-environment happy-dom
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';

import { join } from 'pathe';
import { rolldown } from 'rolldown';
import { afterAll, describe, expect, it } from 'vitest';

const TEST_ENTRY = join(import.meta.dirname, '../../dist/test/index.js');
const VENDOR_BUILT = existsSync(join(import.meta.dirname, '../../dist/preview/vendor'));

describe('storybook/test bundled again by a consumer', () => {
  it.runIf(process.env.CI)('is built before this suite runs', () => {
    expect(VENDOR_BUILT).toBe(true);
  });

  // Inside the package, where Vitest serves modules from.
  const cacheDir = join(import.meta.dirname, '../../node_modules/.cache');
  mkdirSync(cacheDir, { recursive: true });
  const outDir = mkdtempSync(join(cacheDir, 'storybook-test-rebundle-'));
  afterAll(() => rmSync(outDir, { recursive: true, force: true }));

  // Vite's dependency optimizer bundles `storybook/test` again, honoring `sideEffects` in
  // package.json. The vendor entries only re-export the libraries and call their lazy `init_*`
  // functions, so a bundler that treats them as side-effect free skips that call and leaves the
  // libraries uninitialized (`userEvent` was `undefined` in Vitest).
  it.runIf(VENDOR_BUILT)('initializes the test libraries', async () => {
    const build = await rolldown({ input: TEST_ENTRY, platform: 'browser', logLevel: 'silent' });
    await build.write({ dir: outDir, format: 'es', entryFileNames: 'test.js' });
    await build.close();

    const test = await import(/* @vite-ignore */ join(outDir, 'test.js'));

    expect(typeof test.userEvent?.click).toBe('function');
    expect(typeof test.uninstrumentedUserEvent?.setup).toBe('function');
    expect(typeof test.within).toBe('function');
    expect(typeof test.expect).toBe('function');
    expect(typeof test.fn).toBe('function');
  });
});
