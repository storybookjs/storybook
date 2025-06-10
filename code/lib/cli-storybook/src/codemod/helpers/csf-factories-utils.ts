import { types as t, traverse } from 'storybook/internal/babel';

const projectAnnotationNames = [
  'decorators',
  'parameters',
  'args',
  'argTypes',
  'loaders',
  'beforeEach',
  'afterEach',
  'render',
  'tags',
  'mount',
  'argsEnhancers',
  'argTypesEnhancers',
  'beforeAll',
  'initialGlobals',
  'globalTypes',
  'applyDecorators',
  'runStep',
];

export function cleanupTypeImports(programNode: t.Program, disallowList: string[]) {
  const usedIdentifiers = new Set<string>();

  try {
    // Collect all identifiers used in the program
    traverse(programNode, {
      Identifier(path) {
        // Ensure we're not counting identifiers within import declarations
        if (!path.findParent((p) => p.isImportDeclaration())) {
          usedIdentifiers.add(path.node.name);
        }
      },
      noScope: true,
    });
  } catch (err) {
    // traversing could fail if the code isn't supported by
    // our babel parse plugins, so we ignore
  }

  return programNode.body.filter((node) => {
    if (t.isImportDeclaration(node)) {
      const { source, specifiers } = node;

      if (source.value.startsWith('@storybook/')) {
        const allowedSpecifiers = specifiers.filter((specifier) => {
          if (t.isImportSpecifier(specifier) && t.isIdentifier(specifier.imported)) {
            const name = specifier.imported.name;
            // Only remove if disallowed AND unused
            return !disallowList.includes(name) || usedIdentifiers.has(name);
          }
          // Retain namespace imports and non-specifiers
          return true;
        });

        // Remove the entire import if no valid specifiers remain
        if (allowedSpecifiers.length > 0) {
          node.specifiers = allowedSpecifiers;
          return true;
        }
        return false;
      }
    }

    // Retain all other nodes
    return true;
    // @TODO adding any for now, unsure how to fix the following error:
    // error TS4058: Return type of exported function has or is using name 'BlockStatement' from external module "/code/core/dist/babel/index" but cannot be named
  }) as any;
}

export function removeExportDeclarations(
  programNode: t.Program,
  exportDecls: Record<string, t.VariableDeclarator | t.FunctionDeclaration>
) {
  return programNode.body.filter((node) => {
    if (t.isExportNamedDeclaration(node) && node.declaration) {
      if (t.isVariableDeclaration(node.declaration)) {
        // Handle variable declarations
        node.declaration.declarations = node.declaration.declarations.filter(
          (decl) => t.isIdentifier(decl.id) && !exportDecls[decl.id.name]
        );
        return node.declaration.declarations.length > 0;
      } else if (t.isFunctionDeclaration(node.declaration)) {
        // Handle function declarations
        const funcDecl = node.declaration;
        return t.isIdentifier(funcDecl.id) && !exportDecls[funcDecl.id.name];
      }
    }
    return true;
    // @TODO adding any for now, unsure how to fix the following error:
    // error TS4058: Return type of exported function has or is using name 'ObjectProperty' from external module "/tmp/storybook/code/core/dist/babel/index" but cannot be named.
  }) as any;
}

export function getConfigProperties(
  exportDecls: Record<string, t.VariableDeclarator | t.FunctionDeclaration>,
  options: { configType: 'main' | 'preview' }
) {
  const properties = [];

  // Collect properties from named exports
  for (const [name, decl] of Object.entries(exportDecls)) {
    // only include real preview exports to definePreview factory
    if (options.configType === 'preview' && !projectAnnotationNames.includes(name)) {
      continue;
    }
    if (t.isVariableDeclarator(decl) && decl.init) {
      properties.push(t.objectProperty(t.identifier(name), decl.init));
    } else if (t.isFunctionDeclaration(decl)) {
      properties.push(
        t.objectProperty(t.identifier(name), t.arrowFunctionExpression([], decl.body))
      );
    }
  }

  // @TODO adding any for now, unsure how to fix the following error:
  // error TS4058: Return type of exported function has or is using name 'ObjectProperty' from external module "/tmp/storybook/code/core/dist/babel/index" but cannot be named.
  return properties as any;
}
