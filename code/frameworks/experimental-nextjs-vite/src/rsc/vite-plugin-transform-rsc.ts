// vite-plugin-transform-rsc.js
import { types as t, traverse } from '@babel/core';
import generate from '@babel/generator';
import { parse } from '@babel/parser';

export default function transformRSCPlugin() {
  return {
    name: 'transform-rsc-for-storybook',
    enforce: 'pre' as const,

    transform(code: string, id: string) {
      if (!id.match(/\.(jsx|tsx)$/) || !isAsyncComponent(code)) {
        return null;
      }

      try {
        const ast = parse(code, {
          sourceType: 'module',
          plugins: ['jsx', 'typescript'],
        });

        let memoizedPromisesCount = 0;
        const memoizedPromises = new Set();
        let addMemoizationLibrary = false;

        // Transform the AST
        traverse(ast, {
          // Find async function components
          FunctionDeclaration(path) {
            console.log(path);
            if (path.node.async && isReactComponent(path.node)) {
              transformAsyncFunction(path);
            }
          },

          ArrowFunctionExpression(path) {
            if (path.node.async && isReactComponent(path.node)) {
              transformAsyncFunction(path);
            }
          },

          // Transform await expressions
          AwaitExpression(path) {
            addMemoizationLibrary = true;

            // Create unique memoization identifier
            const memoId = `__memoized_promise_${memoizedPromisesCount++}`;

            // Find scope-defining ancestor
            const funcPath = path.findParent(
              (p) =>
                t.isFunctionDeclaration(p as any) ||
                t.isArrowFunctionExpression(p as any) ||
                t.isFunctionExpression(p as any)
            );

            // Get parameters actually used in the await expression
            const usedParams = getUsedParameters(path.node.argument, funcPath);
            const paramNames = usedParams.length > 0 ? usedParams : [];

            // Create module-scoped memoized function
            const programPath = path.scope.getProgramParent().path;

            // Check if memoization already exists
            let memoExists = false;
            (programPath.node as any).body.forEach((node: any) => {
              if (
                t.isVariableDeclaration(node) &&
                node.declarations.some(
                  (decl: any) => t.isIdentifier(decl.id) && decl.id.name === memoId
                )
              ) {
                memoExists = true;
              }
            });

            if (!memoExists) {
              // Create the memoization function with appropriate parameters
              const memoDeclaration = t.variableDeclaration('const', [
                t.variableDeclarator(
                  t.identifier(memoId),
                  t.callExpression(t.identifier('memoize'), [
                    t.arrowFunctionExpression(
                      paramNames.map((name) => t.identifier(name)),
                      path.node.argument
                    ),
                    t.objectExpression([
                      t.objectProperty(t.identifier('primitive'), t.booleanLiteral(true)),
                      t.objectProperty(t.identifier('max'), t.numericLiteral(100)),
                    ]),
                  ])
                ),
              ]);

              // Insert at beginning of the file
              (programPath.node as any).body.unshift(memoDeclaration);
            }

            // Replace await with React.use call, passing appropriate parameters
            path.replaceWith(
              t.callExpression(t.memberExpression(t.identifier('React'), t.identifier('use')), [
                t.callExpression(
                  t.identifier(memoId),
                  // Only pass parameters if they exist
                  paramNames.map((name) => t.identifier(name))
                ),
              ])
            );
          },
        });

        // Add imports
        if (addMemoizationLibrary) {
          addImports(ast, code);
        }

        // Generate code
        const output = generate(ast, {}, code);

        // Add 'use client' directive if needed
        const useClientDirective = "'use client';\n\n";
        const finalCode = !code.includes('use client')
          ? useClientDirective + output.code
          : output.code;

        return {
          code: finalCode,
          map: output.map,
        };
      } catch (e) {
        console.error(`Error transforming RSC in ${id}:`, e);
        return null;
      }
    },
  };
}

function addImports(ast: any, code: string) {
  // Add React import if needed
  let hasReactImport = false;
  let hasMemoizeImport = false;

  traverse(ast, {
    ImportDeclaration(path) {
      if (path.node.source.value === 'react') {
        hasReactImport = true;
        let hasUseImport = false;
        path.node.specifiers.forEach((specifier) => {
          if (
            t.isImportSpecifier(specifier) &&
            specifier.imported &&
            (specifier.imported as any).name === 'use'
          ) {
            hasUseImport = true;
          }
        });

        if (!hasUseImport) {
          path.node.specifiers.push(t.importSpecifier(t.identifier('use'), t.identifier('use')));
        }
      }

      if (path.node.source.value === 'memoizee') {
        hasMemoizeImport = true;
      }
    },
  });

  // Add imports as needed
  const imports: any[] = [];

  if (!hasReactImport) {
    imports.push(
      t.importDeclaration(
        [
          t.importDefaultSpecifier(t.identifier('React')),
          t.importSpecifier(t.identifier('use'), t.identifier('use')),
        ],
        t.stringLiteral('react')
      )
    );
  }

  if (!hasMemoizeImport) {
    imports.push(
      t.importDeclaration(
        [t.importDefaultSpecifier(t.identifier('memoize'))],
        t.stringLiteral('memoizee')
      )
    );
  }

  // Add imports to beginning of file
  if (imports.length > 0) {
    for (const importDecl of imports.reverse()) {
      ast.program.body.unshift(importDecl);
    }
  }
}

// Get likely parameters that affect the promise
function getParameterNames(path: any) {
  // Analyze the await expression to find what variables it depends on
  const deps = new Set();

  traverse(
    path.node.argument,
    {
      Identifier(p) {
        // Skip function calls, only capture variables
        if (!t.isMemberExpression(p.parent) && !t.isCallExpression(p.parent)) {
          deps.add(p.node.name);
        }
      },
    },
    path.scope
  );

  // Get the component's parameters to see which ones are used
  const componentParams = getComponentParameters(path);
  const propNames: any[] = componentParams.filter((param) => deps.has(param));

  // Add any props object if it exists
  const propsParam = componentParams.find((param) => param === 'props');

  if (propsParam) {
    propNames.push('props');
  }

  return propNames.length ? propNames : ['_unused'];
}

function getParameterValues(path: any) {
  const paramNames = getParameterNames(path);
  return paramNames.map((name) => t.identifier(name));
}

function getComponentParameters(path: any) {
  let functionPath = path;
  while (
    functionPath &&
    !t.isFunctionDeclaration(functionPath.node) &&
    !t.isArrowFunctionExpression(functionPath.node)
  ) {
    functionPath = functionPath.parentPath;
  }

  if (functionPath && functionPath.node && functionPath.node.params) {
    // Handle different parameter patterns
    const params: any[] = [];
    functionPath.node.params.forEach((param: any) => {
      if (t.isIdentifier(param)) {
        params.push(param.name);
      } else if (t.isObjectPattern(param)) {
        param.properties.forEach((prop) => {
          if (t.isObjectProperty(prop) && t.isIdentifier(prop.key)) {
            params.push(prop.key.name);
          }
        });
      }
    });
    return params;
  }

  return [];
}

// Remove async modifier
function transformAsyncFunction(path: any) {
  path.node.async = false;
}

// Helper functions
function isAsyncComponent(code: string) {
  // Basic check for async function components
  return (
    /async\s+(function|const|let|var|export)\s+\w+\s*\([^)]*\)\s*{/.test(code) ||
    /async\s*\([^)]*\)\s*=>/.test(code)
  );
}

function isReactComponent(node: any) {
  // Heuristics to identify React components - customize as needed
  return (
    // Look for JSX in the function body
    // Or check for PascalCase naming
    t.isIdentifier(node.id) && /^[A-Z]/.test(node.id.name)
  );
}

function getUsedParameters(node: any, funcPath: any) {
  const usedVariables = new Set();

  // Traverse the await expression to find used variables
  traverse(
    node,
    {
      Identifier(path) {
        if (!path.isReferencedIdentifier()) {
          return;
        }

        // If not a function call or property access

        // If not a function call or property access
        if (
          (!t.isMemberExpression(path.parent) && !t.isCallExpression(path.parent)) ||
          (t.isCallExpression(path.parent) && path.parent.callee === path.node)
        ) {
          usedVariables.add(path.node.name);
        }
      },
    },
    funcPath.scope
  );

  // Get component parameters
  const params: any[] = [];
  if (funcPath && funcPath.node.params && funcPath.node.params.length > 0) {
    funcPath.node.params.forEach((param: any) => {
      if (t.isIdentifier(param)) {
        if (usedVariables.has(param.name)) {
          params.push(param.name);
        }
      } else if (t.isObjectPattern(param)) {
        param.properties.forEach((prop) => {
          if (
            t.isObjectProperty(prop) &&
            t.isIdentifier(prop.key) &&
            usedVariables.has(prop.key.name)
          ) {
            params.push(prop.key.name);
          }
        });
      }
    });
  }

  return params;
}
