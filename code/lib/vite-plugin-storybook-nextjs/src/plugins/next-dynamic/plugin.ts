import MagicString from "magic-string";
import type { Plugin } from "vite";

/**
 * A Vite plugin to transform dynamic imports using `require.resolveWeak` into standard dynamic imports.
 * `require.resolveWeak` is Webpack-specific and doesn't have any effect in Vite environments.
 *
 * This plugin searches for patterns like:
 *
 * ```typescript
 * const DynamicComponent = dynamic(async () => {
 *   typeof require.resolveWeak !== "undefined" && require.resolveWeak(<string>);
 * });
 * ```
 *
 * And transforms them into:
 *
 * ```typescript
 * const DynamicComponent = dynamic(() => import(<string>), {});
 * ```
 *
 * @returns A Vite plugin object.
 */
export const vitePluginNextDynamic = () =>
  ({
    name: "vite-plugin-storybook-nextjs-dynamic",
    transform(code) {
      // Regex to match the dynamic import pattern
      const dynamicImportRegex =
        /dynamic\(\s*async\s*\(\s*\)\s*=>\s*\{\s*typeof\s*require\.resolveWeak\s*!==\s*"undefined"\s*&&\s*require\.resolveWeak\(([^)]+)\);\s*\}/g;

      // Check if the code matches the pattern
      if (dynamicImportRegex.test(code)) {
        const s = new MagicString(code);

        let match: RegExpExecArray | null;

        // biome-ignore lint/suspicious/noAssignInExpressions: <explanation>
        while ((match = dynamicImportRegex.exec(code)) !== null) {
          const [fullMatch, importPath] = match;

          // Construct the new import statement
          const newImport = `dynamic(() => import(${importPath})`;

          // Replace the old code with the new import statement
          s.overwrite(match.index, match.index + fullMatch.length, newImport);
        }

        return {
          code: s.toString(),
          map: s.generateMap({ hires: true }),
        };
      }

      return null;
    },
  }) satisfies Plugin;
