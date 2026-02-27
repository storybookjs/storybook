import { fileURLToPath } from 'node:url';

import type { PresetProperty } from 'storybook/internal/types';

import type { StorybookConfigVite } from '@storybook/builder-vite';
import { viteFinal as reactViteFinal } from '@storybook/react-vite/preset';

import * as ts from 'typescript';
import type { Plugin } from 'vite';

type TextEdit = {
  start: number;
  end: number;
  content: string;
};

const SERVER_FN_STUB_MODULE = '@storybook/tanstack-react/server-fn-stubs';

const applyEdits = (input: string, edits: TextEdit[]) => {
  if (edits.length === 0) {
    return input;
  }

  const sorted = [...edits].sort((a, b) => b.start - a.start);
  let output = input;

  sorted.forEach((edit) => {
    output = output.slice(0, edit.start) + edit.content + output.slice(edit.end);
  });

  return output;
};

const unwrapExpression = (expression: ts.Expression): ts.Expression => {
  let current = expression;
  while (
    ts.isAsExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isNonNullExpression(current) ||
    ts.isParenthesizedExpression(current)
  ) {
    current = current.expression;
  }
  return current;
};

const findCreateServerFnRoot = (expression: ts.Expression): ts.CallExpression | null => {
  const unwrapped = unwrapExpression(expression);

  if (ts.isCallExpression(unwrapped)) {
    const callee = unwrapExpression(unwrapped.expression);
    if (ts.isIdentifier(callee) && callee.text === 'createServerFn') {
      return unwrapped;
    }
    if (ts.isPropertyAccessExpression(callee)) {
      return findCreateServerFnRoot(callee.expression);
    }
  }

  if (ts.isPropertyAccessExpression(unwrapped)) {
    return findCreateServerFnRoot(unwrapped.expression);
  }

  return null;
};

const getHandlerCalls = (sourceFile: ts.SourceFile) => {
  const calls: Array<{ node: ts.CallExpression; name?: string }> = [];

  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'handler' &&
      findCreateServerFnRoot(node.expression.expression)
    ) {
      const parent = node.parent;
      const name =
        ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)
          ? parent.name.text
          : undefined;
      calls.push({ node, name });
    }

    ts.forEachChild(node, visit);
  };

  ts.forEachChild(sourceFile, visit);
  return calls;
};

const hasCreateServerFnImport = (sourceFile: ts.SourceFile) => {
  return sourceFile.statements.some((statement) => {
    if (!ts.isImportDeclaration(statement)) {
      return false;
    }

    if (!statement.importClause || statement.importClause.isTypeOnly) {
      return false;
    }

    if (!ts.isStringLiteral(statement.moduleSpecifier)) {
      return false;
    }

    if (statement.moduleSpecifier.text !== '@tanstack/react-start') {
      return false;
    }

    const namedBindings = statement.importClause.namedBindings;
    if (!namedBindings || !ts.isNamedImports(namedBindings)) {
      return false;
    }

    return namedBindings.elements.some(
      (element) => element.name.text === 'createServerFn' && !element.propertyName
    );
  });
};

const isIdentifierUsage = (node: ts.Identifier) => {
  const parent = node.parent;
  if (!parent) {
    return false;
  }

  if (
    ts.isImportSpecifier(parent) ||
    ts.isImportClause(parent) ||
    ts.isNamespaceImport(parent) ||
    ts.isImportEqualsDeclaration(parent)
  ) {
    return false;
  }

  if (ts.isVariableDeclaration(parent) && parent.name === node) {
    return false;
  }

  if (ts.isBindingElement(parent) && parent.name === node) {
    return false;
  }

  if (ts.isParameter(parent) && parent.name === node) {
    return false;
  }

  if (ts.isFunctionDeclaration(parent) && parent.name === node) {
    return false;
  }

  if (ts.isClassDeclaration(parent) && parent.name === node) {
    return false;
  }

  if (ts.isPropertyDeclaration(parent) && parent.name === node) {
    return false;
  }

  if (ts.isMethodDeclaration(parent) && parent.name === node) {
    return false;
  }

  if (ts.isPropertyAccessExpression(parent) && parent.name === node) {
    return false;
  }

  if (ts.isPropertyAssignment(parent) && parent.name === node && parent.initializer !== node) {
    return false;
  }

  if (ts.isTypeReferenceNode(parent) || ts.isTypeAliasDeclaration(parent)) {
    return false;
  }

  if (ts.isInterfaceDeclaration(parent)) {
    return false;
  }

  if (ts.isQualifiedName(parent) && parent.right === node) {
    return false;
  }

  if (ts.isExportSpecifier(parent)) {
    return true;
  }

  if (ts.isShorthandPropertyAssignment(parent) && parent.name === node) {
    return true;
  }

  return true;
};

const collectUsedIdentifiers = (sourceFile: ts.SourceFile) => {
  const used = new Set<string>();

  const visit = (node: ts.Node) => {
    if (ts.isExportSpecifier(node)) {
      used.add(node.propertyName ? node.propertyName.text : node.name.text);
    }

    if (ts.isIdentifier(node) && isIdentifierUsage(node)) {
      used.add(node.text);
    }

    ts.forEachChild(node, visit);
  };

  ts.forEachChild(sourceFile, visit);
  return used;
};

const hasExportModifier = (node: ts.Node) => {
  if (!ts.canHaveModifiers(node)) {
    return false;
  }

  return ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
};

const getStatementRemovalRange = (sourceFile: ts.SourceFile, statement: ts.Statement) => {
  const start = statement.getFullStart();
  let end = statement.getEnd();

  const text = sourceFile.getFullText();
  if (text[end] === '\n') {
    end += 1;
  }

  return { start, end };
};

const removeUnusedImportsAndHelpers = (input: string, id: string) => {
  const sourceFile = ts.createSourceFile(
    id,
    input,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const used = collectUsedIdentifiers(sourceFile);
  const edits: TextEdit[] = [];

  sourceFile.statements.forEach((statement) => {
    if (ts.isImportDeclaration(statement) && statement.importClause) {
      const importClause = statement.importClause;
      if (importClause.isTypeOnly) {
        return;
      }

      const importedNames: string[] = [];

      if (importClause.name) {
        importedNames.push(importClause.name.text);
      }

      const namedBindings = importClause.namedBindings;
      if (namedBindings) {
        if (ts.isNamespaceImport(namedBindings)) {
          importedNames.push(namedBindings.name.text);
        } else if (ts.isNamedImports(namedBindings)) {
          namedBindings.elements.forEach((element) => {
            importedNames.push(element.name.text);
          });
        }
      }

      if (importedNames.length > 0 && importedNames.every((name) => !used.has(name))) {
        edits.push({ ...getStatementRemovalRange(sourceFile, statement), content: '' });
      }
    }
  });

  sourceFile.statements.forEach((statement) => {
    if (hasExportModifier(statement)) {
      return;
    }

    if (ts.isFunctionDeclaration(statement) && statement.name) {
      if (!used.has(statement.name.text)) {
        edits.push({ ...getStatementRemovalRange(sourceFile, statement), content: '' });
      }
      return;
    }

    if (ts.isVariableStatement(statement)) {
      const declarations = statement.declarationList.declarations;
      const names = declarations
        .map((decl) => (ts.isIdentifier(decl.name) ? decl.name.text : null))
        .filter((name): name is string => Boolean(name));

      if (names.length === declarations.length && names.length > 0) {
        const allUnused = names.every((name) => !used.has(name));
        if (allUnused) {
          edits.push({ ...getStatementRemovalRange(sourceFile, statement), content: '' });
        }
      }
    }
  });

  return applyEdits(input, edits);
};

const ensureServerFnStubImport = (input: string, id: string) => {
  if (!input.includes('createServerFnStub')) {
    return input;
  }

  const sourceFile = ts.createSourceFile(
    id,
    input,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );

  const hasImport = sourceFile.statements.some((statement) => {
    if (!ts.isImportDeclaration(statement)) {
      return false;
    }

    if (!ts.isStringLiteral(statement.moduleSpecifier)) {
      return false;
    }

    if (statement.moduleSpecifier.text !== SERVER_FN_STUB_MODULE) {
      return false;
    }

    if (!statement.importClause || !statement.importClause.namedBindings) {
      return false;
    }

    const namedBindings = statement.importClause.namedBindings;
    if (!ts.isNamedImports(namedBindings)) {
      return false;
    }

    return namedBindings.elements.some((element) => element.name.text === 'createServerFnStub');
  });

  if (hasImport) {
    return input;
  }

  const lastImport = [...sourceFile.statements]
    .filter((statement): statement is ts.ImportDeclaration => ts.isImportDeclaration(statement))
    .pop();

  const importStatement = `import { createServerFnStub } from '${SERVER_FN_STUB_MODULE}';\n`;

  if (!lastImport) {
    return `${importStatement}${input}`;
  }

  const insertAt = lastImport.getEnd();
  const prefix = input[insertAt - 1] === '\n' ? '' : '\n';
  return `${input.slice(0, insertAt)}${prefix}${importStatement}${input.slice(insertAt)}`;
};

const createServerFnMockPlugin = (): Plugin => {
  return {
    name: 'storybook-tanstack-server-fn-mock',
    enforce: 'pre',
    transform(code, id) {
      if (!code.includes('@tanstack/react-start')) {
        return undefined;
      }

      const sourceFile = ts.createSourceFile(
        id,
        code,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX
      );
      if (!hasCreateServerFnImport(sourceFile)) {
        return undefined;
      }

      const handlerCalls = getHandlerCalls(sourceFile);
      if (handlerCalls.length === 0) {
        return undefined;
      }

      const edits: TextEdit[] = handlerCalls.map(({ node, name }) => {
        const stubCall = name
          ? `createServerFnStub(${JSON.stringify(name)})`
          : 'createServerFnStub()';
        return {
          start: node.getStart(sourceFile),
          end: node.getEnd(),
          content: stubCall,
        };
      });

      let transformed = applyEdits(code, edits);
      transformed = removeUnusedImportsAndHelpers(transformed, id);
      transformed = ensureServerFnStubImport(transformed, id);

      return {
        code: transformed,
        map: null,
      };
    },
  };
};

export const core: PresetProperty<'core'> = async (config, options) => {
  const framework = await options.presets.apply('framework');

  return {
    ...config,
    builder: {
      name: fileURLToPath(import.meta.resolve('@storybook/builder-vite')),
      options: typeof framework === 'string' ? {} : framework.options.builder || {},
    },
    renderer: fileURLToPath(import.meta.resolve('@storybook/react/preset')),
  };
};

export const previewAnnotations: PresetProperty<'previewAnnotations'> = (entry = []) => [
  ...entry,
  fileURLToPath(import.meta.resolve('@storybook/tanstack-react/preview')),
];

export const optimizeViteDeps = ['@tanstack/react-query', '@tanstack/react-router'];

export const viteFinal: StorybookConfigVite['viteFinal'] = async (config, options) => {
  const reactConfig = await reactViteFinal(config, options);

  /**
   * A custom viteFinal implementation that removes any TanStack Start Vite plugins from the user's
   * Vite config, as a workaround for compatibility issues.
   *
   * This follows the pattern discussed at: https://github.com/storybookjs/storybook/issues/33754
   */
  const isTanStackStartPlugin = (p: unknown): boolean => {
    if (Array.isArray(p)) {
      return p.some(isTanStackStartPlugin);
    }
    const pluginRecord = p as Record<string, unknown>;
    return (
      typeof p === 'object' &&
      p !== null &&
      'name' in pluginRecord &&
      typeof pluginRecord.name === 'string' &&
      pluginRecord.name.startsWith('tanstack-start')
    );
  };

  const basePlugins = reactConfig.plugins ?? [];
  const plugins = [
    ...basePlugins.filter((plugin) => !isTanStackStartPlugin(plugin)),
    createServerFnMockPlugin(),
  ];

  return {
    ...reactConfig,
    plugins,
  };
};
