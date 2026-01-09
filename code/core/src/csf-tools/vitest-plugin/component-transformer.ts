import path from 'node:path';

import {
  BabelFileClass,
  type NodePath,
  babelParse,
  generate,
  types as t,
  traverse,
} from 'storybook/internal/babel';
import type { ArgTypes } from 'storybook/internal/csf';

import {
  STORYBOOK_FN_PLACEHOLDER,
  generateDummyPropsFromArgTypes,
} from '../../core-server/utils/get-dummy-props-for-args';
import { createTestGuardDeclaration } from './transformer';

const VITEST_IMPORT_SOURCE = 'vitest';
const TEST_UTILS_IMPORT_SOURCE = '@storybook/addon-vitest/internal/test-utils';
const STORYBOOK_TEST_IMPORT_SOURCE = 'storybook/test';

type ComponentExport = {
  exportedName: string;
  localIdentifier: t.Identifier;
};

const sanitizeIdentifier = (value: string) => {
  const sanitized = value.replace(/[^a-zA-Z0-9_$]+/g, '');
  return sanitized || 'Component';
};

const createComponentNameFromFileName = (fileName: string) => {
  if (!fileName) {
    return 'Component';
  }

  const basename = path.basename(fileName, path.extname(fileName));
  return sanitizeIdentifier(basename);
};

const containsJsxNode = (valuePath: NodePath<t.Node | null | undefined> | null) => {
  if (!valuePath?.node) {
    return false;
  }

  let found = false;
  valuePath.traverse({
    JSXElement(path) {
      found = true;
      path.stop();
    },
    JSXFragment(path) {
      found = true;
      path.stop();
    },
  });
  return found;
};

const unwrapExpression = (node: t.Node | null): t.Node | null => {
  if (!node) {
    return null;
  }

  if (t.isTSAsExpression(node) || t.isTSSatisfiesExpression(node)) {
    return unwrapExpression(node.expression);
  }

  return node;
};

const dedupeImports = (program: t.Program, source: string, specifiers: t.ImportSpecifier[]) => {
  const existing = program.body.find(
    (node) => t.isImportDeclaration(node) && node.source.value === source
  ) as t.ImportDeclaration | undefined;

  if (existing) {
    specifiers.forEach((specifier) => {
      if (
        existing.specifiers.every(
          (existingSpecifier) =>
            !t.isImportSpecifier(existingSpecifier) ||
            existingSpecifier.local.name !== specifier.local.name
        )
      ) {
        existing.specifiers.push(specifier);
      }
    });
    return;
  }

  program.body.unshift(t.importDeclaration(specifiers, t.stringLiteral(source)));
};

// Traverses the AST to find all exported components that contain JSX. Handles named exports,
// default exports, and various declaration types.
const collectComponentExports = (program: t.Program, fileName: string) => {
  const components: ComponentExport[] = [];

  // Helper to add a component to the collection if it contains JSX
  const addComponent = (
    exportedName: string,
    localIdentifier: t.Identifier,
    valuePath: NodePath<t.Node | null | undefined> | null
  ) => {
    if (!valuePath || !valuePath.node) {
      return;
    }

    const target = unwrapExpression(valuePath.node);
    if (!target) {
      return;
    }

    if (!containsJsxNode(valuePath)) {
      return;
    }

    components.push({ exportedName, localIdentifier });
  };

  traverse(program, {
    ExportNamedDeclaration(path) {
      const { node } = path;
      if (node.source) {
        return;
      }

      const declarationPath = path.get('declaration');

      if (declarationPath.isVariableDeclaration()) {
        declarationPath.get('declarations').forEach((declPath) => {
          if (!declPath.isVariableDeclarator()) {
            return;
          }
          const id = declPath.node.id;
          if (!t.isIdentifier(id)) {
            return;
          }
          const initPath = declPath.get('init');
          addComponent(id.name, id, initPath);
        });
      } else if (declarationPath.isFunctionDeclaration() && declarationPath.node.id) {
        const declarationId = declarationPath.node.id;
        if (t.isIdentifier(declarationId)) {
          addComponent(declarationId.name, declarationId, declarationPath);
        }
      } else if (declarationPath.isClassDeclaration() && declarationPath.node.id) {
        const declarationId = declarationPath.node.id;
        if (t.isIdentifier(declarationId)) {
          addComponent(declarationId.name, declarationId, declarationPath);
        }
      }

      path.get('specifiers').forEach((specifierPath) => {
        if (!specifierPath.isExportSpecifier()) {
          return;
        }
        const { local, exported } = specifierPath.node;
        if (!t.isIdentifier(local) || !t.isIdentifier(exported)) {
          return;
        }
        const binding = specifierPath.scope.getBinding(local.name);
        if (!binding) {
          return;
        }

        const bindingPath = binding.path;
        const localIdentifier = binding.identifier;
        if (!t.isIdentifier(localIdentifier)) {
          return;
        }
        if (bindingPath.isVariableDeclarator()) {
          addComponent(exported.name, localIdentifier, bindingPath.get('init'));
        } else if (bindingPath.isFunctionDeclaration() || bindingPath.isClassDeclaration()) {
          const bindingNodeId = bindingPath.node.id;
          if (t.isIdentifier(bindingNodeId)) {
            addComponent(bindingNodeId.name, localIdentifier, bindingPath);
          }
        }
      });
    },
    ExportDefaultDeclaration(path) {
      const { node } = path;
      const declaration = node.declaration;

      if (
        t.isFunctionExpression(declaration) ||
        t.isArrowFunctionExpression(declaration) ||
        t.isClassExpression(declaration)
      ) {
        const identifierName = createComponentNameFromFileName(fileName);
        const identifier = path.scope.generateUidIdentifier(identifierName);
        const variableDeclaration = t.variableDeclaration('const', [
          t.variableDeclarator(identifier, declaration),
        ]);
        variableDeclaration.loc = node.loc;
        path.insertBefore(variableDeclaration);
        node.declaration = identifier;

        const insertedVarPath = path.getPrevSibling();
        let initPath: NodePath<t.Node | null | undefined> | null = null;
        if (insertedVarPath?.isVariableDeclaration()) {
          const declarationPath = insertedVarPath.get('declarations')[0];
          if (declarationPath?.isVariableDeclarator()) {
            initPath = declarationPath.get('init');
          }
        }

        addComponent(identifierName, identifier, initPath);
        return;
      }

      if (t.isIdentifier(declaration)) {
        const binding = path.scope.getBinding(declaration.name);
        if (!binding) {
          return;
        }

        const bindingIdentifier = binding.identifier;
        if (!t.isIdentifier(bindingIdentifier)) {
          return;
        }

        if (binding.path.isVariableDeclarator()) {
          addComponent(
            createComponentNameFromFileName(fileName),
            bindingIdentifier,
            binding.path.get('init')
          );
        } else if (binding.path.isFunctionDeclaration() || binding.path.isClassDeclaration()) {
          const bindingNodeId = binding.path.node.id;
          if (t.isIdentifier(bindingNodeId)) {
            addComponent(bindingNodeId.name, bindingIdentifier, binding.path);
          }
        }
        return;
      }

      if (t.isFunctionDeclaration(declaration) && declaration.id) {
        addComponent(
          declaration.id.name,
          declaration.id,
          path.get('declaration') as NodePath<t.FunctionDeclaration>
        );
        return;
      }

      if (t.isClassDeclaration(declaration) && declaration.id) {
        addComponent(
          declaration.id.name,
          declaration.id,
          path.get('declaration') as NodePath<t.ClassDeclaration>
        );
      }
    },
  });

  return components;
};

/**
 * Transforms a component file directly into a Vitest test file. Uses a getComponentArgTypes
 * function to retrieve component argTypes for required prop generation. Uses portable stories to
 * construct a test based on the default state of a component (basic render + required args)
 */
export const componentTransform = async ({
  code,
  fileName,
  getComponentArgTypes,
}: {
  code: string;
  fileName: string;
  getComponentArgTypes?: (options: {
    componentName: string;
    fileName: string;
  }) => Promise<ArgTypes | null | undefined>;
}): Promise<ReturnType<typeof generate> | { code: string; map: null }> => {
  const ast = babelParse(code);
  const file = new BabelFileClass({ filename: fileName, highlightCode: false }, { code, ast });

  const components = collectComponentExports(ast.program, fileName);
  if (!components.length) {
    return { code, map: null };
  }

  const vitestTestId = file.path.scope.generateUidIdentifier('test');
  const vitestExpectId = file.path.scope.generateUidIdentifier('expect');
  const testStoryId = file.path.scope.generateUidIdentifier('testStory');
  const convertToFilePathId = t.identifier('convertToFilePath');
  const fnId = file.path.scope.generateUidIdentifier('fn');

  dedupeImports(ast.program, VITEST_IMPORT_SOURCE, [
    t.importSpecifier(vitestTestId, t.identifier('test')),
    t.importSpecifier(vitestExpectId, t.identifier('expect')),
  ]);
  dedupeImports(ast.program, TEST_UTILS_IMPORT_SOURCE, [
    t.importSpecifier(testStoryId, t.identifier('testStory')),
    t.importSpecifier(convertToFilePathId, t.identifier('convertToFilePath')),
  ]);

  const testStatements: t.ExpressionStatement[] = [];

  // Detect whether argTypes contains fn placeholders that need replacing with an actual function expression. Done ahead of time for performance reasons.
  const hasFunctionPlaceholder = (value: unknown): boolean => {
    return JSON.stringify(value).includes(STORYBOOK_FN_PLACEHOLDER);
  };

  /**
   * When argTypes relate to handlers like onClick, they will have a string value like
   * [[STORYBOOK_FN_PLACEHOLDER]] In those cases we need to replace them with an actual fn() call
   * from storybook/test
   */
  const valueToNodeRecursive = (value: unknown, replaceFnCalls: boolean): t.Expression => {
    // When there are no function placeholders, no need to recurse - just use valueToNode
    if (!replaceFnCalls) {
      return t.valueToNode(value) as t.Expression;
    }

    if (value === STORYBOOK_FN_PLACEHOLDER) {
      return t.callExpression(fnId, []);
    }

    if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        return t.arrayExpression(value.map((val) => valueToNodeRecursive(val, replaceFnCalls)));
      }

      // For objects, create a new object with recursively processed values
      const properties = Object.entries(value).map(([key, val]) =>
        t.objectProperty(t.identifier(key), valueToNodeRecursive(val, replaceFnCalls))
      );
      return t.objectExpression(properties);
    }

    return t.valueToNode(value) as t.Expression;
  };

  // Helper to convert a props object to an AST object expression
  const buildArgsExpression = (args?: Record<string, unknown>, useFnImport = false) => {
    if (!args || Object.keys(args).length === 0) {
      return t.objectExpression([]);
    }

    const properties = Object.entries(args).map(([key, value]) => {
      return t.objectProperty(t.identifier(key), valueToNodeRecursive(value, useFnImport));
    });
    return t.objectExpression(properties);
  };

  // Check if any component has function placeholders and add import if needed
  let hasAnyFunctionPlaceholders = false;

  // Each collected component becomes a test case
  for (const component of components) {
    const argTypes = getComponentArgTypes
      ? await getComponentArgTypes({ componentName: component.exportedName, fileName })
      : undefined;
    const generatedArgs = argTypes
      ? generateDummyPropsFromArgTypes(argTypes, { skipUrlGeneration: true }).required
      : undefined;

    if (!hasAnyFunctionPlaceholders && generatedArgs && hasFunctionPlaceholder(generatedArgs)) {
      hasAnyFunctionPlaceholders = true;
    }

    // Each component export is passed as component in an inline meta
    // this allows for multiple component metas in a single test file
    const meta = t.objectExpression([
      t.objectProperty(
        t.identifier('title'),
        t.stringLiteral(`generated/tests/${component.exportedName}`)
      ),
      t.objectProperty(t.identifier('component'), component.localIdentifier),
    ]);

    // The actual testStory function
    const testStoryArgs = t.objectExpression([
      t.objectProperty(t.identifier('exportName'), t.stringLiteral(component.exportedName)),
      // This is where the story annotation for a particular component is defined, inline
      t.objectProperty(
        t.identifier('story'),
        t.objectExpression([
          t.objectProperty(
            t.identifier('args'),
            buildArgsExpression(generatedArgs, hasAnyFunctionPlaceholders)
          ),
        ])
      ),
      t.objectProperty(t.identifier('meta'), meta),
      t.objectProperty(t.identifier('skipTags'), t.arrayExpression([])),
      t.objectProperty(
        t.identifier('storyId'),
        t.stringLiteral(`generated-${component.exportedName}`)
      ),
      t.objectProperty(t.identifier('componentPath'), t.stringLiteral(fileName)),
      t.objectProperty(
        t.identifier('componentName'),
        t.stringLiteral(component.localIdentifier.name)
      ),
    ]);

    const testCall = t.expressionStatement(
      t.callExpression(vitestTestId, [
        t.stringLiteral(component.exportedName),
        t.callExpression(testStoryId, [testStoryArgs]),
      ])
    );

    testStatements.push(testCall);
  }

  if (hasAnyFunctionPlaceholders) {
    dedupeImports(ast.program, STORYBOOK_TEST_IMPORT_SOURCE, [
      t.importSpecifier(fnId, t.identifier('fn')),
    ]);
  }

  // Wrap the code in a guard to avoid side effects when running tests
  const { declaration: guardDeclaration, identifier: guardIdentifier } = createTestGuardDeclaration(
    file.path.scope,
    vitestExpectId,
    convertToFilePathId
  );

  ast.program.body.push(guardDeclaration);
  ast.program.body.push(t.ifStatement(guardIdentifier, t.blockStatement(testStatements)));

  return generate(ast, { sourceMaps: true, sourceFileName: fileName }, code);
};
