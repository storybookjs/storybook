import path from 'node:path';

import type { ArgTypes } from 'storybook/internal/csf';

import {
  STORYBOOK_FN_PLACEHOLDER,
  generateDummyArgsFromArgTypes,
} from '../../core-server/utils/get-dummy-args-from-argtypes.ts';
import { type E, type Node, unwrapExpression, walk } from '../estree/ast.ts';
import {
  SourceEditor,
  appendToList,
  prependStatement,
  printKey,
  printValue,
} from '../estree/editor.ts';
import { generateUid } from '../estree/scope.ts';
import { GeneratedTail, createTestGuardDeclaration, printWithTail } from './transformer.ts';

const VITEST_IMPORT_SOURCE = 'vitest';
const TEST_UTILS_IMPORT_SOURCE = '@storybook/addon-vitest/internal/test-utils';
const STORYBOOK_TEST_IMPORT_SOURCE = 'storybook/test';

type ComponentExport = {
  exportedName: string;
  localName: string;
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

const containsJsxNode = (node: Node | null | undefined) => {
  if (!node) {
    return false;
  }

  let found = false;
  walk(node, (child) => {
    if (found) {
      return false;
    }
    if (child.type === 'JSXElement' || child.type === 'JSXFragment') {
      found = true;
      return false;
    }
  });
  return found;
};

const dedupeImports = (
  editor: SourceEditor,
  source: string,
  specifiers: { imported: string; local: string }[]
) => {
  const texts = specifiers.map(({ imported, local }) =>
    imported === local ? imported : `${imported} as ${local}`
  );
  const existing = editor.program.body.find(
    (node): node is E.ImportDeclaration =>
      node.type === 'ImportDeclaration' &&
      node.source.value === source &&
      node.importKind !== 'type'
  );
  const named = existing?.specifiers.filter((specifier) => specifier.type === 'ImportSpecifier');
  if (existing && named && named.length > 0) {
    const open = editor.code.indexOf('{', existing.start) + 1;
    appendToList(editor, { open, close: editor.code.indexOf('}', open), items: named }, texts);
    return;
  }
  if (
    existing &&
    existing.specifiers.length === 1 &&
    existing.specifiers[0].type === 'ImportDefaultSpecifier'
  ) {
    editor.edits.appendLeft(existing.specifiers[0].end, `, { ${texts.join(', ')} }`);
    return;
  }
  prependStatement(editor, `import { ${texts.join(', ')} } from ${JSON.stringify(source)};`);
};

// Finds all exported components that contain JSX. Handles named exports, default exports, and
// various declaration types.
const collectComponentExports = (editor: SourceEditor, fileName: string) => {
  const components: ComponentExport[] = [];
  const { program, scopes } = editor;

  // Helper to add a component to the collection if it contains JSX
  const addComponent = (
    exportedName: string,
    localName: string,
    value: Node | null | undefined
  ) => {
    if (!value || !unwrapExpression(value)) {
      return;
    }

    if (!containsJsxNode(value)) {
      return;
    }

    components.push({ exportedName, localName });
  };

  for (const node of program.body) {
    if (node.type === 'ExportNamedDeclaration') {
      if (node.source) {
        continue;
      }

      const { declaration } = node;
      if (declaration?.type === 'VariableDeclaration') {
        for (const declarator of declaration.declarations) {
          if (declarator.id.type === 'Identifier') {
            addComponent(declarator.id.name, declarator.id.name, declarator.init);
          }
        }
      } else if (
        (declaration?.type === 'FunctionDeclaration' || declaration?.type === 'ClassDeclaration') &&
        declaration.id
      ) {
        addComponent(declaration.id.name, declaration.id.name, declaration);
      }

      for (const specifier of node.specifiers) {
        const { local, exported } = specifier;
        if (local.type !== 'Identifier' || exported.type !== 'Identifier') {
          continue;
        }
        const binding = scopes.program.bindings.get(local.name);
        if (!binding) {
          continue;
        }
        if (binding.node.type === 'VariableDeclarator') {
          addComponent(exported.name, binding.name, binding.node.init);
        } else if (
          (binding.node.type === 'FunctionDeclaration' ||
            binding.node.type === 'ClassDeclaration') &&
          binding.node.id
        ) {
          addComponent(exported.name, binding.name, binding.node);
        }
      }
    } else if (node.type === 'ExportDefaultDeclaration') {
      const declaration = node.declaration as Node;

      if (
        declaration.type === 'FunctionExpression' ||
        declaration.type === 'ArrowFunctionExpression' ||
        declaration.type === 'ClassExpression' ||
        // Handle wrapped component exports e.g.
        // export default someWrapper(Component)
        declaration.type === 'CallExpression'
      ) {
        const identifierName = createComponentNameFromFileName(fileName);
        const identifier = generateUid(scopes, identifierName);
        const span = declaration as Node & { start: number };
        editor.edits.overwrite(node.start, span.start, `const ${identifier} = `);
        editor.edits.appendLeft(node.end, `\nexport default ${identifier};`);

        if (declaration.type === 'CallExpression') {
          // Assume wrapped exports are components without detecting JSX to filter out. We can do that if needed in the future based on feedback.
          components.push({ exportedName: identifierName, localName: identifier });
        } else {
          addComponent(identifierName, identifier, declaration);
        }
        continue;
      }

      if (declaration.type === 'Identifier') {
        const binding = scopes.program.bindings.get(declaration.name);
        if (!binding) {
          continue;
        }

        if (binding.node.type === 'VariableDeclarator') {
          addComponent(createComponentNameFromFileName(fileName), binding.name, binding.node.init);
        } else if (
          (binding.node.type === 'FunctionDeclaration' ||
            binding.node.type === 'ClassDeclaration') &&
          binding.node.id
        ) {
          addComponent(binding.node.id.name, binding.name, binding.node);
        }
        continue;
      }

      if (
        (declaration.type === 'FunctionDeclaration' || declaration.type === 'ClassDeclaration') &&
        declaration.id
      ) {
        addComponent(declaration.id.name, declaration.id.name, declaration);
      }
    }
  }

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
}): Promise<ReturnType<typeof printWithTail> | { code: string; map: null }> => {
  const editor = new SourceEditor(code, fileName);

  const components = collectComponentExports(editor, fileName);
  if (!components.length) {
    return { code, map: null };
  }

  const { scopes } = editor;
  const vitestTestId = generateUid(scopes, 'test');
  const vitestExpectId = generateUid(scopes, 'expect');
  const testStoryId = generateUid(scopes, 'testStory');
  const convertToFilePathId = 'convertToFilePath';
  const fnId = generateUid(scopes, 'fn');

  const testStatements: string[] = [];

  // Detect whether argTypes contains fn placeholders that need replacing with an actual function expression. Done ahead of time for performance reasons.
  const hasFunctionPlaceholder = (value: unknown): boolean => {
    return JSON.stringify(value).includes(STORYBOOK_FN_PLACEHOLDER);
  };

  /**
   * When argTypes relate to handlers like onClick, they will have a string value like
   * [[STORYBOOK_FN_PLACEHOLDER]] In those cases we need to replace them with an actual fn() call
   * from storybook/test
   */
  const printArg = (value: unknown, replaceFnCalls: boolean): string => {
    if (!replaceFnCalls) {
      return printValue(value, '"');
    }

    if (value === STORYBOOK_FN_PLACEHOLDER) {
      return `${fnId}()`;
    }

    if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        return `[${value.map((val) => printArg(val, replaceFnCalls)).join(', ')}]`;
      }

      // For objects, create a new object with recursively processed values
      return buildArgsExpression(value as Record<string, unknown>, replaceFnCalls);
    }

    return printValue(value, '"');
  };

  // Helper to convert a props object to an object expression
  const buildArgsExpression = (args?: Record<string, unknown>, useFnImport = false) => {
    if (!args || Object.keys(args).length === 0) {
      return '{}';
    }

    return `{ ${Object.entries(args)
      .map(([key, value]) => `${printKey(key, '"')}: ${printArg(value, useFnImport)}`)
      .join(', ')} }`;
  };

  // Check if any component has function placeholders and add import if needed
  let hasAnyFunctionPlaceholders = false;

  // Each collected component becomes a test case
  for (const component of components) {
    const argTypes = getComponentArgTypes
      ? await getComponentArgTypes({ componentName: component.exportedName, fileName })
      : undefined;
    const generatedArgs = argTypes
      ? generateDummyArgsFromArgTypes(argTypes, { skipUrlGeneration: true }).required
      : undefined;

    if (!hasAnyFunctionPlaceholders && generatedArgs && hasFunctionPlaceholder(generatedArgs)) {
      hasAnyFunctionPlaceholders = true;
    }

    // Each component export is passed as component in an inline meta
    // this allows for multiple component metas in a single test file
    const meta = `{ title: ${JSON.stringify(`generated/tests/${component.exportedName}`)}, component: ${component.localName} }`;

    // The actual testStory function, with the story annotation for the component defined inline
    const testStoryArgs = [
      `exportName: ${JSON.stringify(component.exportedName)}`,
      `story: { args: ${buildArgsExpression(generatedArgs, hasAnyFunctionPlaceholders)} }`,
      `meta: ${meta}`,
      'skipTags: []',
      `storyId: ${JSON.stringify(`generated-${component.exportedName}`)}`,
      `componentPath: ${JSON.stringify(fileName)}`,
      `componentName: ${JSON.stringify(component.localName)}`,
    ].join(', ');

    testStatements.push(
      `  ${vitestTestId}(${JSON.stringify(component.exportedName)}, ${testStoryId}({ ${testStoryArgs} }));`
    );
  }

  dedupeImports(editor, VITEST_IMPORT_SOURCE, [
    { imported: 'test', local: vitestTestId },
    { imported: 'expect', local: vitestExpectId },
  ]);
  dedupeImports(editor, TEST_UTILS_IMPORT_SOURCE, [
    { imported: 'testStory', local: testStoryId },
    { imported: 'convertToFilePath', local: convertToFilePathId },
  ]);
  if (hasAnyFunctionPlaceholders) {
    dedupeImports(editor, STORYBOOK_TEST_IMPORT_SOURCE, [{ imported: 'fn', local: fnId }]);
  }

  // Wrap the code in a guard to avoid side effects when running tests
  const guardIdentifier = generateUid(scopes, 'isRunningFromThisFile');
  const tail = new GeneratedTail();
  tail.push(createTestGuardDeclaration(guardIdentifier, vitestExpectId, convertToFilePathId));
  tail.push(`if (${guardIdentifier}) {`);
  testStatements.forEach((statement) => tail.push(statement));
  tail.push('}');

  return printWithTail(editor, tail, fileName);
};
