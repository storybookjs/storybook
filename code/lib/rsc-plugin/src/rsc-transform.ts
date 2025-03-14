import type { NodePath } from 'storybook/internal/babel';
import { babelParse, babelPrint, types as t, traverse } from 'storybook/internal/babel';

const RE_CLIENT = /\S*['"]use client['"]\S;?/u;

const isPascalCase = (id?: t.Node | null) => t.isIdentifier(id) && /^[A-Z]/.test(id.name);

const isAsyncReactComponent = (functionPath: NodePath<t.Function>) => {
  const { node } = functionPath;
  if (!node.async) {
    return false;
  }

  let hasJsx = false;
  functionPath.traverse({
    JSXElement() {
      hasJsx = true;
    },
  });
  return hasJsx;
};

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

export const rscTransform = (code: string) => {
  if (RE_CLIENT.test(code)) {
    console.log('SKIP', code);
    return code;
  }

  const ast = babelParse(code);
  let memoizedPromisesCount = 0;
  let addMemoizationLibrary = false;

  const transformAsyncReactComponent = (component: NodePath<t.Function>) => {
    component.node.async = false;

    component.traverse({
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
  };

  traverse(ast, {
    FunctionDeclaration(path) {
      if (isPascalCase(path.node.id) && isAsyncReactComponent(path)) {
        transformAsyncReactComponent(path);
      }
    },

    ArrowFunctionExpression(path) {
      if (
        path.parentPath.isVariableDeclarator() &&
        isPascalCase(path.parentPath.node.id) &&
        isAsyncReactComponent(path)
      ) {
        transformAsyncReactComponent(path);
      }
    },
  });

  if (addMemoizationLibrary) {
    addImports(ast, code);
  }

  const out = babelPrint(ast);
  return out;
};
