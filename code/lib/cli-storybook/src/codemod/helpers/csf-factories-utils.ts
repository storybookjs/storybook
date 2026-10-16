import {
  type ESTree as E,
  type ESTreeNode as Node,
  type SourceEditor,
  walk,
  removeStatements,
  setImportSpecifiers,
} from 'storybook/internal/csf-tools';

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

// Removes disallowed specifiers that the code no longer uses from `@storybook/*` imports.
export function cleanupTypeImports(editor: SourceEditor, disallowList: string[]) {
  const usedIdentifiers = new Set<string>();
  walk(editor.program, (node) => {
    if (node.type === 'ImportDeclaration') {
      return false;
    }
    if (node.type === 'Identifier') {
      usedIdentifiers.add(node.name);
    }
  });

  const removed = new Set<Node>();
  for (const node of editor.program.body) {
    if (node.type !== 'ImportDeclaration' || !node.source.value.startsWith('@storybook/')) {
      continue;
    }
    const allowedSpecifiers = node.specifiers.filter(
      (specifier) =>
        specifier.type !== 'ImportSpecifier' ||
        specifier.imported.type !== 'Identifier' ||
        !disallowList.includes(specifier.imported.name) ||
        usedIdentifiers.has(specifier.imported.name)
    );
    if (allowedSpecifiers.length === 0) {
      removed.add(node);
    } else if (allowedSpecifiers.length < node.specifiers.length) {
      setImportSpecifiers(editor, node, allowedSpecifiers);
    }
  }
  removeStatements(editor, removed);
}

export type ExportDeclarations = Record<string, E.VariableDeclarator | E.Function>;

// Removes the given named export declarations, and declarators that are not plain identifiers.
export function removeExportDeclarations(editor: SourceEditor, exportDecls: ExportDeclarations) {
  const removed = new Set<Node>();
  for (const node of editor.program.body) {
    if (node.type !== 'ExportNamedDeclaration' || !node.declaration) {
      continue;
    }
    const { declaration } = node;
    if (declaration.type === 'VariableDeclaration') {
      const { declarations } = declaration;
      const kept = declarations.filter(
        (decl) => decl.id.type === 'Identifier' && !exportDecls[decl.id.name]
      );
      if (kept.length === 0) {
        removed.add(node);
      } else if (kept.length < declarations.length) {
        editor.edits.overwrite(
          declarations[0].start,
          declarations.at(-1)!.end,
          kept.map((decl) => editor.source(decl)).join(', ')
        );
      }
    } else if (
      declaration.type === 'FunctionDeclaration' &&
      (!declaration.id || exportDecls[declaration.id.name])
    ) {
      removed.add(node);
    }
  }
  removeStatements(editor, removed);
}

// Source of the `name: value` members a `defineMain`/`definePreview` call gets from named exports.
export function getConfigProperties(
  editor: SourceEditor,
  exportDecls: ExportDeclarations,
  options: { configType: 'main' | 'preview' }
) {
  const properties: string[] = [];

  for (const [name, decl] of Object.entries(exportDecls)) {
    // only include real preview exports to definePreview factory
    if (options.configType === 'preview' && !projectAnnotationNames.includes(name)) {
      continue;
    }
    if (decl.type === 'VariableDeclarator' && decl.init) {
      properties.push(`${name}: ${editor.source(decl.init)}`);
    } else if (decl.type === 'FunctionDeclaration' && decl.body) {
      properties.push(`${name}: () => ${editor.source(decl.body)}`);
    }
  }

  return properties;
}

// Leading file comments, such as license headers or `@ts-check`, stay above the import.
