/* eslint-disable @typescript-eslint/naming-convention */

/* eslint-disable no-underscore-dangle */

/**
 * Source: https://github.com/vercel/next.js/blob/canary/packages/next/src/build/babel/plugins/react-loadable-plugin.ts
 */
import { relative as relativePath } from 'node:path';

import type { types as BabelTypes, NodePath, PluginObj } from '@babel/core';

export default function ({ types: t }: { types: typeof BabelTypes }): PluginObj {
  return {
    visitor: {
      ImportDeclaration(path: NodePath<BabelTypes.ImportDeclaration>, state: any) {
        const source = path.node.source.value;
        if (source !== 'next/dynamic') return;

        const defaultSpecifier = path.get('specifiers').find((specifier: any) => {
          return specifier.isImportDefaultSpecifier();
        });

        if (!defaultSpecifier) return;

        const bindingName = defaultSpecifier.node.local.name;
        const binding = path.scope.getBinding(bindingName);

        if (!binding) {
          return;
        }

        binding.referencePaths.forEach((refPath: any) => {
          let callExpression = refPath.parentPath;

          if (callExpression.isMemberExpression() && callExpression.node.computed === false) {
            const property = callExpression.get('property');
            if (!Array.isArray(property) && property.isIdentifier({ name: 'Map' })) {
              callExpression = callExpression.parentPath;
            }
          }

          if (!callExpression.isCallExpression()) return;

          const callExpression_ = callExpression as NodePath<BabelTypes.CallExpression>;

          let args = callExpression_.get('arguments');
          if (args.length > 2) {
            throw callExpression_.buildCodeFrameError('next/dynamic only accepts 2 arguments');
          }

          if (!args[0]) {
            return;
          }

          let loader;
          let options;

          if (args[0].isObjectExpression()) {
            options = args[0];
          } else {
            if (!args[1]) {
              callExpression_.node.arguments.push(t.objectExpression([]));
            }
            // This is needed as the code is modified above
            args = callExpression_.get('arguments');
            loader = args[0];
            options = args[1];
          }

          if (!options.isObjectExpression()) return;
          const options_ = options as NodePath<BabelTypes.ObjectExpression>;

          const properties = options_.get('properties');
          const propertiesMap: {
            [key: string]: NodePath<
              | BabelTypes.ObjectProperty
              | BabelTypes.ObjectMethod
              | BabelTypes.SpreadElement
              | BabelTypes.BooleanLiteral
            >;
          } = {};

          properties.forEach((property) => {
            const key: any = property.get('key');
            propertiesMap[key.node.name] = property;
          });

          if (propertiesMap.loadableGenerated) {
            return;
          }

          if (propertiesMap.loader) {
            loader = propertiesMap.loader.get('value');
          }

          if (propertiesMap.modules) {
            loader = propertiesMap.modules.get('value');
          }

          if (!loader || Array.isArray(loader)) {
            return;
          }
          const dynamicImports: BabelTypes.Expression[] = [];
          const dynamicKeys: BabelTypes.Expression[] = [];

          if (propertiesMap.ssr) {
            const ssr = propertiesMap.ssr.get('value');
            const nodePath = Array.isArray(ssr) ? undefined : ssr;

            if (nodePath) {
              const nonSSR =
                nodePath.node.type === 'BooleanLiteral' && nodePath.node.value === false;
              // If `ssr` is set to `false`, erase the loader for server side
              if (nonSSR && loader && state.file.opts.caller?.isServer) {
                loader.replaceWith(t.arrowFunctionExpression([], t.nullLiteral(), true));
              }
            }
          }

          loader.traverse({
            Import(importPath) {
              const importArguments = importPath.parentPath.get('arguments');
              if (!Array.isArray(importArguments)) return;
              const { node } = importArguments[0];
              dynamicImports.push(node as any);
              dynamicKeys.push(
                t.binaryExpression(
                  '+',
                  t.stringLiteral(
                    `${
                      state.file.opts.caller?.pagesDir
                        ? relativePath(state.file.opts.caller.pagesDir, state.file.opts.filename)
                        : state.file.opts.filename
                    } -> `
                  ),
                  node as any
                )
              );
            },
          });

          if (!dynamicImports.length) return;

          options.node.properties.push(
            t.objectProperty(
              t.identifier('loadableGenerated'),
              t.objectExpression(
                state.file.opts.caller?.isDev || state.file.opts.caller?.isServer
                  ? [t.objectProperty(t.identifier('modules'), t.arrayExpression(dynamicKeys))]
                  : [
                      t.objectProperty(
                        t.identifier('webpack'),
                        t.arrowFunctionExpression(
                          [],
                          t.arrayExpression(
                            dynamicImports.map((dynamicImport) => {
                              return t.callExpression(
                                t.memberExpression(
                                  t.identifier('require'),
                                  t.identifier('resolveWeak')
                                ),
                                [dynamicImport]
                              );
                            })
                          )
                        )
                      ),
                    ]
              )
            )
          );

          // Turns `dynamic(import('something'))` into `dynamic(() => import('something'))` for backwards compat.
          // This is the replicate the behavior in versions below Next.js 7 where we magically handled not executing the `import()` too.
          // We'll deprecate this behavior and provide a codemod for it in 7.1.
          if (loader.isCallExpression()) {
            const arrowFunction = t.arrowFunctionExpression([], loader.node);
            loader.replaceWith(arrowFunction);
          }
        });
      },
    },
  };
}
