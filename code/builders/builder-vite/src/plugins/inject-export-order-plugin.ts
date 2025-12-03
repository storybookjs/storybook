import { parse } from 'es-module-lexer';
import MagicString from 'magic-string';

export async function injectExportOrderPlugin() {
  // Define filters for story files
  const storyFilePatterns = [/\.stories\.([tj])sx?$/, /(stories|story)\.mdx$/];

  return {
    name: 'storybook:inject-export-order-plugin',
    // This should only run after the typescript has been transpiled
    enforce: 'post' as const,
    transform: {
      // Use filter to pre-filter on the Rust side
     filter: {
       id: storyFilePatterns,
     },
      async handler(code: string, id: string, meta?: any) {
       // Fallback check for compatibility with older Vite versions
       const matchesPattern = storyFilePatterns.some((pattern) => pattern.test(id));
       if (!matchesPattern) {
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
        
        // Use native MagicString if available (Rolldown optimization)
        const magicString = meta?.magicString;
        const s = magicString || new MagicString(code);
        
       const orderedExports = exportNames.filter((e) => e !== 'default');
       s.append(`;export const __namedExportsOrder = ${JSON.stringify(orderedExports)};`);
       return {
          code: magicString ? s : s.toString(),
          map: magicString ? undefined : s.generateMap({ hires: true, source: id }),
       };
     },
    },
  };
}
