import { existsSync, readFileSync, readdirSync } from 'node:fs';

import { join } from 'pathe';
import { describe, expect, it } from 'vitest';

import { globalExternals } from '@fal-works/esbuild-plugin-global-externals';
import { build } from 'esbuild';

import { globalsModuleInfoMap } from './globals-module-info.ts';

const CODE = join(import.meta.dirname, '../../../..');
const ADDONS = join(CODE, 'addons');

// Every Storybook loads `common-manager`; the addons' `./manager` exports load with each addon.
const managerEntries = [
  join(CODE, 'core/dist/core-server/presets/common-manager.js'),
  ...readdirSync(ADDONS).flatMap((addon) => {
    const packageJson = join(ADDONS, addon, 'package.json');
    if (!existsSync(packageJson)) {
      return [];
    }
    const manager = JSON.parse(readFileSync(packageJson, 'utf-8')).exports?.['./manager'];
    if (!manager) {
      return [];
    }
    const file = typeof manager === 'string' ? manager : manager.default;
    if (typeof file !== 'string') {
      throw new Error(`Can't find the file of the ./manager export of ${addon}`);
    }
    return [join(ADDONS, addon, file)];
  }),
];
const built = managerEntries.filter((entry) => existsSync(entry));

// The preview runtime's chunks and vendor entries, `storybook/test`, and the test libraries.
const TEST_STACK =
  /dist\/(test|preview\/(vendor|_chunks))\/|node_modules\/(chai|@vitest|@testing-library)\//;

describe('built-in manager entries', () => {
  it.runIf(process.env.CI)('are built before this suite runs', () => {
    expect(managerEntries.filter((entry) => !existsSync(entry))).toEqual([]);
  });

  // storybook/test is no manager global, so a module that imports it (e.g. `storybook/internal/csf`)
  // would bundle its test libraries into the manager, from `dist/test` or from the preview
  // runtime's chunks that it and the instrumenter share. Import such helpers from a pure module
  // instead, like `storybook/internal/csf/csf-utils`.
  it.runIf(built.length > 0).each(built.map((entry) => [entry.slice(CODE.length + 1), entry]))(
    '%s does not bundle storybook/test',
    async (_, entry) => {
      // Like the manager builder: its globals and esbuild options.
      const { metafile } = await build({
        entryPoints: [entry],
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
        Object.keys(metafile.inputs).filter((input) => TEST_STACK.test(input)),
        'modules of the test stack in this manager entry'
      ).toEqual([]);
    }
  );
});
