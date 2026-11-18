import { expect, it } from 'vitest';

import { NoMatchingExportError } from 'storybook/internal/server-errors';

import { join } from 'pathe';
import { build } from 'rolldown';

import { globalExternals } from '../../builder-manager/utils/global-externals.ts';
import { globalsModuleInfoMap } from '../../manager/globals/globals-module-info.ts';
import { buildOrThrow } from './build-or-throw.ts';

const addon = (name: string) =>
  join(import.meta.dirname, '../../builder-manager/__testfixtures__/addons', name, 'manager.js');

const bundle = (input: string) =>
  build({
    input,
    write: false,
    logLevel: 'silent',
    plugins: [globalExternals(globalsModuleInfoMap)],
  });

it('names a version mismatch when a manager entry imports what Storybook does not export', async () => {
  await expect(buildOrThrow(() => bundle(addon('missing-export')))).rejects.toThrow(
    NoMatchingExportError
  );
});

it('passes on the error of an export that is missing from another module', async () => {
  await expect(buildOrThrow(() => bundle(addon('missing-own-export')))).rejects.toThrow(
    '"notExported" is not exported'
  );
});
