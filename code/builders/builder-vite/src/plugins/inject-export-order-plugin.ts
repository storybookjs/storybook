import { type ExportSpecifier, parse } from 'es-module-lexer';
import MagicString from 'magic-string';
import type { Plugin } from 'vite';

export async function injectExportOrderPlugin() {
  const { createFilter } = await import('vite');

  const include = [/\.stories\.([tj])sx?$/, /(stories|story).mdx$/];
  const filter = createFilter(include);

  return {
    name: 'storybook:inject-export-order-plugin',
    // This should only run after the typescript has been transpiled
    enforce: 'post',
    transform: {
      filter: { id: include },
      async handler(code: string, id: string) {
        if (!filter(id)) {
          return undefined;
        }

        // TODO: Maybe convert `injectExportOrderPlugin` to function that returns object,
        //  and run `await init;` once and then call `parse()` without `await`,
        //  instead of calling `await parse()` every time.
        let exports: readonly ExportSpecifier[];
        try {
          [, exports] = await parse(code);
        } catch (error) {
          const { message, idx } = error as Error & { idx?: number };
          // Vite transpiles JSX only in .jsx/.tsx, and JSX in .ts already fails in esbuild
          const hint = id.endsWith('.js')
            ? ' If the file contains JSX, rename it to use the .jsx or .tsx extension.'
            : '';
          // Rollup only adds the location and code frame for a separate `pos` argument
          this.error(
            { message: `Failed to parse the story file: ${message}.${hint}`, cause: error },
            idx
          );
        }

        const exportNames = exports.map((e) => code.substring(e.s, e.e));

        if (exportNames.includes('__namedExportsOrder')) {
          // user has defined named exports already
          return undefined;
        }
        const s = new MagicString(code);
        const orderedExports = exportNames.filter((e) => e !== 'default');
        s.append(`;export const __namedExportsOrder = ${JSON.stringify(orderedExports)};`);
        return {
          code: s.toString(),
          map: s.generateMap({ hires: true, source: id }).toString(),
        };
      },
    },
  } satisfies Plugin;
}
