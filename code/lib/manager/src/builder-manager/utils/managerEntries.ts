import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, parse, relative, sep } from 'node:path';

import { resolvePathInStorybookCache } from '@storybook/core/internal/common';

// eslint-disable-next-line depend/ban-dependencies
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
 * Wrap each manager entry in `import '<<file>>';` so its exports are dropped from the bundle; manager
 * entries are side-effect-only modules.
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

      if (!existsSync(location)) {
        const directory = dirname(location);
        await mkdir(directory, { recursive: true });
      }

      await writeFile(location, `import '${slash(entry).replaceAll(/'/g, "\\'")}';`);

      return location;
    })
  );
}
