import { parse } from 'es-module-lexer';
import MagicString from 'magic-string';

export async function injectExportOrderPlugin() {
  const { createFilter } = await import('vite');

  const include = [/\.stories\.([tj])sx?$/, /(stories|story).mdx$/];
  const filter = createFilter(include);

  return {
    name: 'storybook:inject-export-order-plugin',
    // This should only run after the typescript has been transpiled
    enforce: 'post',
    async transform(code: string, id: string) {
      if (!filter(id)) {
        return undefined;
      }

      // TODO: Maybe convert `injectExportOrderPlugin` to function that returns object,
      //  and run `await init;` once and then call `parse()` without `await`,
      //  instead of calling `await parse()` every time.
      const [, exports] = await parse(code);

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
        map: s.generateMap({ hires: true, source: id }),
      };
    },
  };
}
