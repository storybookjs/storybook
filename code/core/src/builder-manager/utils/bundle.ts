import { logger } from 'storybook/internal/node-logger';

import { dirname, join, relative } from 'pathe';
import type { BuildOptions } from 'rolldown';

import type { ManagerBuilder } from '../types.ts';

// A manager entry is imported for what it registers, so its package.json and `@__PURE__` comments
// may not mark a module as free of side effects.
export const keepEveryModule: BuildOptions['treeshake'] = {
  moduleSideEffects: [{ test: /./, sideEffects: true }],
  annotations: false,
};

// Bundles each manager entry into its own file of `outdir`, and returns the URL of each.
export const bundleManagerEntries = async (
  { entryPoints, outdir, ...options }: Awaited<ReturnType<ManagerBuilder['getConfig']>>,
  minify: boolean
) => {
  // An entry is `<directory of the addon>/<name>-bundle.js` in the cache directory.
  const files = entryPoints.map((entry) => relative(dirname(dirname(entry)), entry));
  const urls = files.map(
    (file) => `./sb-addons/${file.split('/').map(encodeURIComponent).join('/')}`
  );
  // An `import()` may name an optional package, with a `catch` for when it is missing.
  const dynamicImports = new Set<string>();
  const { build } = await import('rolldown');
  await build(
    entryPoints.map((input, index): BuildOptions => ({
      ...options,
      input,
      plugins: [
        options.plugins,
        {
          name: 'storybook:manager-dynamic-imports',
          resolveId(id, importer, { kind }) {
            if (kind === 'dynamic-import') {
              dynamicImports.add(`${importer}\0${id}`);
            }
            return null;
          },
        },
      ],
      onLog(level, log, handler) {
        // Rolldown leaves an import it cannot resolve for the browser, where it throws.
        if (log.code === 'UNRESOLVED_IMPORT' && !dynamicImports.has(`${log.id}\0${log.exporter}`)) {
          handler('error', log);
        } else {
          logger[level](log.message);
        }
      },
      output: {
        ...options.output,
        ...(minify && { minify }),
        file: join(outdir, files[index]),
        // A define of `module` would hide `module.exports` from Rolldown's CommonJS detection.
        banner: 'try{var module={};',
        footer: `}catch(e){ console.error("[Storybook] One of your manager-entries failed: " + ${JSON.stringify(urls[index])}, e); }`,
      },
    }))
  );
  return urls;
};
