import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { dedent } from 'ts-dedent';

import { CODE_DIRECTORY } from '../../utils/constants';

/**
 * This is a unique hack (pre-existing the CPC project) because the only way to set a custom Theme
 * interface with emotion, is by module augmentation.
 *
 * Module augmentation is not an option for us, because we pre-bundle emotion in. This change
 * ensures the `Theme` export is overloaded with our `StorybookTheme` interface. (in both
 * development and production builds)
 */
export async function modifyCoreThemeTypes(cwd: string) {
  const CORE_ROOT_DIR = join(CODE_DIRECTORY, 'core');
  if (cwd !== CORE_ROOT_DIR) {
    return;
  }
  const target = join(CORE_ROOT_DIR, 'dist', 'theming', 'index.d.ts');
  const contents = await readFile(target, 'utf-8');

  const CODE_DEV = dedent`
    export { StorybookTheme as Theme } from '../../src/theming/index';
  `;
  const CODE_PROD = dedent`
    interface Theme extends StorybookTheme {}
    export type { Theme };
  `;

  const footer = contents.includes('// auto generated file') ? CODE_DEV : CODE_PROD;

  await writeFile(target, contents + '\n\n' + footer);
}
