import { readFileSync } from 'node:fs';

import { logger } from 'storybook/internal/node-logger';

import { dirname, join, relative } from 'pathe';

import type { ManagerBuilder } from '../types.ts';
import type { Stylesheet } from './css.ts';
import { cssPlugin } from './css.ts';

export interface OutputFile {
  path: string;
  contents: string;
}

type Config = Awaited<ReturnType<ManagerBuilder['getConfig']>>;

// An `import()` may name an optional package, and fails at runtime where the caller can catch it.
const isDynamicImport = ({ id, pos }: { id?: string; pos?: number }) =>
  id !== undefined &&
  pos !== undefined &&
  /\bimport\s*\(\s*$/.test(readFileSync(id, 'utf8').slice(0, pos));

// Bundles each manager entry into a script of its own, with a stylesheet when it imports CSS.
export const bundleManagerEntries = async (
  { entryPoints, outdir, ...options }: Config,
  minify: boolean
): Promise<OutputFile[]> => {
  const { build } = await import('rolldown');
  const dataUrlExtensions = new Set(
    Object.entries(options.moduleTypes ?? {}).flatMap(([extension, type]) =>
      type === 'dataurl' ? [extension] : []
    )
  );

  // Rolldown writes one `iife` per build, so each entry is a build.
  const outputs = await Promise.all(
    entryPoints.map(async (entry) => {
      // An entry is `<directory of the addon>/<name>-bundle.js` in the cache directory.
      const name = relative(dirname(dirname(entry)), entry).replace(/\.[^./]+$/, '');
      const url = `./sb-addons/${name.split('/').map(encodeURIComponent).join('/')}.js`;
      const stylesheets = new Map<string, Stylesheet>();

      const { output } = await build({
        ...options,
        input: entry,
        plugins: [options.plugins, cssPlugin(stylesheets, dataUrlExtensions, minify)],
        onLog(level, log, handler) {
          // Rolldown keeps an import it cannot resolve, for a page that cannot provide it.
          if (log.code === 'UNRESOLVED_IMPORT' && !isDynamicImport(log)) {
            handler('error', log);
          } else if (log.code !== 'PLUGIN_TIMINGS') {
            logger[level](log.message);
          }
        },
        output: {
          ...options.output,
          ...(minify && { minify }),
          banner: 'try{',
          // `import.meta.url` cannot name the entry: Rolldown minifies the footer with the chunk,
          // which it parses as a script.
          footer: `}catch(e){ console.error("[Storybook] One of your manager-entries failed: " + ${JSON.stringify(url)}, e); }`,
          // A define of `module` would hide `module.exports` from Rolldown, which then reads a
          // CommonJS dependency as a module without exports.
          intro: 'var module = {};',
        },
        write: false,
      });

      const files = output.flatMap((item) =>
        item.type === 'chunk' ? [{ path: join(outdir, `${name}.js`), contents: item.code }] : []
      );
      if (stylesheets.size > 0) {
        // Stylesheets are joined in the order their modules run.
        const order = output.flatMap((item) => (item.type === 'chunk' ? item.moduleIds : []));
        const sorted = [...stylesheets.entries()]
          .sort(([a], [b]) => order.indexOf(a) - order.indexOf(b))
          .map(([, stylesheet]) => stylesheet);
        const imports = new Set(sorted.flatMap((stylesheet) => stylesheet.imports));
        files.push({
          path: join(outdir, `${name}.css`),
          contents: [
            ...[...imports].map((url) => `@import url(${JSON.stringify(url)});`),
            ...sorted.map((stylesheet) => stylesheet.css),
          ].join('\n'),
        });
      }
      return files;
    })
  );

  return outputs.flat();
};
