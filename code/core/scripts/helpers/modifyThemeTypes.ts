import { join } from 'node:path';
import { dedent, Bun } from '../../../../scripts/prepare/tools';

export async function modifyThemeTypes() {
  /**
   * This is a unique hack (pre-existing the CPC project) because the only way to set a custom Theme interface with emotion, is by module enhancement.
   * This is not an option for us, because we pre-bundle emotion in.
   * The little hack work to ensure the `Theme` export is overloaded with our `StorybookTheme` interface. (in both development and production builds)
   */
  const target = join(import.meta.dirname, '..', '..', 'dist', 'theming', 'index.d.ts');
  const contents = await Bun.file(target).text();

  const footer = contents.includes('// auto generated file')
    ? `export { StorybookTheme as Theme } from '../src/index';`
    : dedent`
      interface Theme extends StorybookTheme {}
      export type { Theme };
    `;

  const newContents = dedent`
    ${contents}
    ${footer}
  `;

  await Bun.write(target, newContents);
}
