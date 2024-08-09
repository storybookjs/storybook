import { join, parse, relative, sep } from 'node:path';

import { resolvePathInStorybookCache } from '@storybook/core/common';

import fs from 'fs-extra';
import slash from 'slash';

const sanitizeBase = (path: string) => {
  return path
    .replaceAll('.', '')
    .replaceAll('@', '')
    .replaceAll(sep, '-')
    .replaceAll('/', '-')
    .replaceAll(new RegExp(/^(-)+/g), '');
};

const sanitizeFinal = (path: string) => {
  const sections = path.split(/-?node_modules-?/);

  return sections[sections.length - 1].replaceAll('storybook-addon-', '').replaceAll('dist-', '');
};

/**
 * Manager entries should be **self-invoking** bits of code.
 * They can of-course import from modules, and ESbuild will bundle all of that into a single file.
 * But they should not export anything. However this can't be enforced, so what we do is wrap the given file, in a bit of code like this:
 *
 * ```js
 * import '<<file>>';
 * ```
 *
 * That way we are indicating to ESbuild that we do not care about this files exports, and they will be dropped in the bundle.
 *
 * We do all of that so we can wrap a try-catch around the code.
 * That would have been invalid syntax had the export statements been left in place.
 *
 * We need to wrap each managerEntry with a try-catch because if we do not, a failing managerEntry can stop execution of other managerEntries.
 */
export async function wrapManagerEntries(entrypoints: string[], uniqueId?: string) {
  return Promise.all(
    entrypoints.map(async (entry, i) => {
      const { name, dir } = parse(entry);
      const cacheLocation = resolvePathInStorybookCache('sb-manager', uniqueId);

      if (!cacheLocation) {
        throw new Error('Could not create/find cache directory');
      }

      const base = relative(process.cwd(), dir);
      const location = join(
        cacheLocation,
        sanitizeFinal(join(`${sanitizeBase(base)}-${i}`, `${sanitizeBase(name)}-bundle.js`))
      );

      await fs.ensureFile(location);
      await fs.writeFile(location, `import '${slash(entry)}';`);

      return location;
    })
  );
}
