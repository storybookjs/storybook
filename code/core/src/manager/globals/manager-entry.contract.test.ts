import { existsSync } from 'node:fs';

import { join } from 'pathe';
import { describe, expect, it } from 'vitest';

import { globalExternals } from '@fal-works/esbuild-plugin-global-externals';
import { build } from 'esbuild';

import { globalsModuleInfoMap } from './globals-module-info.ts';

const COMMON_MANAGER = join(
  import.meta.dirname,
  '../../../dist/core-server/presets/common-manager.js'
);
const BUILT = existsSync(COMMON_MANAGER);

describe('built-in manager entry', () => {
  it.runIf(process.env.CI)('is built before this suite runs', () => {
    expect(BUILT).toBe(true);
  });

  // Every Storybook loads this entry in the manager. storybook/test is no manager global, so a
  // module that imports it (e.g. `storybook/internal/csf`) would bundle its test libraries here,
  // from `dist/test` or from the preview runtime's chunks that it and the instrumenter share.
  it.runIf(BUILT)('does not bundle storybook/test', async () => {
    const { metafile } = await build({
      entryPoints: [COMMON_MANAGER],
      bundle: true,
      write: false,
      metafile: true,
      format: 'iife',
      platform: 'browser',
      conditions: ['browser', 'module', 'default'],
      plugins: [globalExternals(globalsModuleInfoMap)],
      logLevel: 'silent',
    });

    expect(
      Object.keys(metafile.inputs).filter((input) =>
        /dist\/(test|preview\/(vendor|_chunks))\/|node_modules\/(chai|@vitest|@testing-library)\//.test(
          input
        )
      )
    ).toEqual([]);
  });
});
