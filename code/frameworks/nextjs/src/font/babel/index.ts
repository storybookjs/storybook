import type * as BabelCoreNamespace from '@babel/core';

import {
  getVariableMetasBySpecifier,
  isDefined,
  removeTransformedVariableDeclarations,
  replaceImportWithParamterImport,
} from './helpers';

type Babel = typeof BabelCoreNamespace;

/**
 * Transforms "next/font" imports and usages to a webpack loader friendly format with parameters
 * @example
 * // src/example.js
 * // Turns this code:
 * import { Inter, Roboto } from 'next/font/google'
 * import localFont from 'next/font/local'
 *
 * const myFont = localFont({ src: './my-font.woff2' })
 * const roboto = Roboto({
 *   weight: '400',
 * })
 *
 * const inter = Inter({
 *   subsets: ['latin'],
 * });
 *
 * // Into this code:
 * import inter from 'storybook-nextjs-font-loader?{filename: "src/example.js", source: "next/font/google", fontFamily: "Inter", props: {"subsets":["latin"]}}!next/font/google'
 * import roboto from 'storybook-nextjs-font-loader?{filename: "src/example.js", source: "next/font/google", fontFamily: "Roboto", props: {"weight": "400"}}!next/font/google'
 * import myFont from 'storybook-nextjs-font-loader?{filename: "src/example.js", source: "next/font/local", props: {"src": "./my-font.woff2"}}!next/font/local'
 *
 * This Plugin tries to adopt the functionality which is provided by the nextjs swc plugin
 * https://github.com/vercel/next.js/pull/40221
 */
export default function TransformFontImports({ types }: Babel): BabelCoreNamespace.PluginObj {
  return {
    name: 'storybook-nextjs-font-imports',
    visitor: {
      ImportDeclaration(path, state) {
        const { node } = path;
        const { source } = node;
        const { filename = '' } = state;

        if (source.value === 'next/font/local' || source.value === '@next/font/local') {
          const { specifiers } = node;

          // next/font/local only provides a default export
          const specifier = specifiers[0];

          if (!path.parentPath.isProgram()) {
            return;
          }

          const program = path.parentPath;

          const variableMetas = getVariableMetasBySpecifier(program, types, specifier);

          removeTransformedVariableDeclarations(path, types, variableMetas);
          replaceImportWithParamterImport(path, types, source, variableMetas, filename);
        }

        if (source.value === 'next/font/google' || source.value === '@next/font/google') {
          const { specifiers } = node;

          const variableMetas = specifiers
            .flatMap((specifier) => {
              if (!path.parentPath.isProgram()) {
                return [];
              }

              const program = path.parentPath;

              return getVariableMetasBySpecifier(program, types, specifier);
            })
            .filter(isDefined);

          removeTransformedVariableDeclarations(path, types, variableMetas);
          replaceImportWithParamterImport(path, types, source, variableMetas, filename);
        }
      },
    },
  };
}
