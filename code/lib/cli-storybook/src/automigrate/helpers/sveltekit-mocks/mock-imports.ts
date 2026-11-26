import {
  type Binding,
  type ESTree as E,
  type ESTreeNode as Node,
  type SourceEditor,
  declaratorList,
  insertAfterImports,
  lineIndent,
  removeFromList,
  removeStatement,
  setImportSpecifiers,
} from 'storybook/internal/csf-tools';

import { MOCK_EXPORTS, type MockExport, type Span } from './mock-statements.ts';

const TEST_MODULES = ['storybook/test', '@storybook/test'];

// `removeStatement` takes the blank lines above a statement; the code below gets one back
const removeKeepingBlankLine = (editor: SourceEditor, statement: Node) => {
  const { code } = editor;
  const lineStart = code.lastIndexOf('\n', statement.start - 1);
  const blankAbove = lineStart > 0 && /\n[ \t]*$/.test(code.slice(0, lineStart));
  const nextLine = code.indexOf('\n', statement.end) + 1;
  removeStatement(editor, statement);
  if (
    blankAbove &&
    nextLine > 0 &&
    code.slice(nextLine).trim() &&
    !/^[ \t]*\n/.test(code.slice(nextLine))
  ) {
    editor.edits.prependRight(nextLine, '\n');
  }
};

const importedName = (specifier: E.ImportSpecifier) =>
  specifier.imported.type === 'Identifier' ? specifier.imported.name : specifier.imported.value;

const valueImports = (editor: SourceEditor) =>
  editor.program.body.filter(
    (node): node is E.ImportDeclaration =>
      node.type === 'ImportDeclaration' && node.importKind !== 'type'
  );

const namedSpecifiers = (declaration: E.ImportDeclaration) =>
  declaration.specifiers.filter(
    (specifier): specifier is E.ImportSpecifier =>
      specifier.type === 'ImportSpecifier' && specifier.importKind !== 'type'
  );

export const findImport = (editor: SourceEditor, modules: readonly string[], name: string) => {
  for (const declaration of valueImports(editor)) {
    if (modules.includes(declaration.source.value)) {
      const specifier = namedSpecifiers(declaration).find((s) => importedName(s) === name);
      if (specifier) {
        return { declaration, specifier };
      }
    }
  }
  return undefined;
};

// The mocks that the module imports under another name: a spy of that name can't give way to them,
// as the code that reads the spy would lose its binding
export const aliasedImports = (editor: SourceEditor) =>
  new Set(
    (Object.keys(MOCK_EXPORTS) as MockExport[]).filter((name) => {
      const found = findImport(editor, [MOCK_EXPORTS[name]], name);
      return found && found.specifier.local.name !== name;
    })
  );

// Whether generated code reads a name, such as `fn` in a value that moved into `beforeEach`
export const readsName = (texts: string[], name: string) =>
  texts.some((text) => new RegExp(`\\b${name}\\b`).test(text));

export const isTestFnBinding = (binding: Binding | undefined) =>
  !!(
    binding?.kind === 'import' &&
    binding.node.type === 'ImportSpecifier' &&
    importedName(binding.node) === 'fn' &&
    TEST_MODULES.includes((binding.declaration as E.ImportDeclaration).source.value)
  );

// The names the migrated code uses for the mocks, and the imports that bring them into the module.
// A name the module already imports is reused; one that something else in the file takes is
// imported under an alias.
export class MockImports {
  private readonly added = new Map<MockExport, string>();

  private readonly taken: Set<string>;

  private readonly shadowed: Set<string>;

  // `shadowed` names something else where the generated code runs, such as the instance script of
  // a Svelte file for the markup, so an import of that name can't be reused
  constructor(
    private readonly editor: SourceEditor,
    taken: Iterable<string>,
    shadowed: Iterable<string> = []
  ) {
    this.taken = new Set(taken);
    this.shadowed = new Set(shadowed);
  }

  readonly local = (name: MockExport): string => {
    const existing = findImport(this.editor, [MOCK_EXPORTS[name]], name);
    if (existing && !this.shadowed.has(existing.specifier.local.name)) {
      return existing.specifier.local.name;
    }
    let local = this.added.get(name);
    if (!local) {
      local = name;
      for (let index = 1; this.taken.has(local); index++) {
        local = `_${name}${index === 1 ? '' : index}`;
      }
      this.taken.add(local);
      this.added.set(name, local);
    }
    return local;
  };

  // Delete the `const goto = fn()` spies that the imported mocks replace, and add the imports. The
  // `fn` import goes when nothing else uses it; `isUsedElsewhere` tells about uses outside the
  // editor's code, such as in the markup of a Svelte file.
  apply(
    spies: Iterable<E.VariableDeclarator>,
    removed: readonly Span[],
    isUsedElsewhere: (name: string) => boolean
  ) {
    const { editor } = this;
    const deleted = [...new Set(spies)];
    const byDeclaration = Map.groupBy(
      deleted,
      (declarator) => editor.parentOf(declarator) as E.VariableDeclaration
    );
    for (const [declaration, declarators] of byDeclaration) {
      if (declarators.length === declaration.declarations.length) {
        removeKeepingBlankLine(editor, declaration);
      } else {
        removeFromList(editor, declaratorList(editor, declaration), declarators);
      }
    }

    const unusedFn = this.unusedFn([...deleted, ...removed], isUsedElsewhere);
    const byModule = new Map<string, string[]>();
    const order = Object.keys(MOCK_EXPORTS) as MockExport[];
    const added = [...this.added].sort(([a], [b]) => order.indexOf(a) - order.indexOf(b));
    for (const [name, local] of added) {
      const module = MOCK_EXPORTS[name];
      byModule.set(module, [
        ...(byModule.get(module) ?? []),
        local === name ? name : `${name} as ${local}`,
      ]);
    }
    if (unusedFn && !byModule.has(unusedFn.declaration.source.value)) {
      byModule.set(unusedFn.declaration.source.value, []);
    }

    const declarations: string[] = [];
    for (const [module, specifiers] of byModule) {
      const declaration = valueImports(editor).find(
        (node) =>
          node.source.value === module &&
          !node.specifiers.some((specifier) => specifier.type === 'ImportNamespaceSpecifier')
      );
      if (!declaration) {
        const { quote } = editor;
        const semicolon = editor.semicolons ? ';' : '';
        declarations.push(
          `import { ${specifiers.join(', ')} } from ${quote}${module}${quote}${semicolon}`
        );
        continue;
      }
      const kept = declaration.specifiers.filter((specifier) => specifier !== unusedFn?.specifier);
      if (kept.length === 0 && specifiers.length === 0) {
        removeStatement(editor, declaration);
      } else if (kept.length < declaration.specifiers.length || specifiers.length > 0) {
        setImportSpecifiers(editor, declaration, kept, { named: specifiers });
      }
    }
    if (declarations.length > 0) {
      // Indented like the code around it, as in a Svelte `<script module>`
      const lastImport = editor.program.body.findLast((node) => node.type === 'ImportDeclaration');
      const anchor = lastImport ?? editor.program.body[0];
      const indent = anchor ? lineIndent(editor.code, anchor.start) : '';
      const block = declarations.map((declaration) => `${indent}${declaration}`).join('\n');
      insertAfterImports(editor, lastImport ? block : `${block}\n`);
    }
  }

  private unusedFn(removed: readonly Span[], isUsedElsewhere: (name: string) => boolean) {
    const found = findImport(this.editor, TEST_MODULES, 'fn');
    if (!found) {
      return undefined;
    }
    const binding = this.editor.scopes.bindingOf(found.specifier.local);
    const used = binding?.references.some(
      (reference) =>
        !removed.some(({ start, end }) => start <= reference.start && reference.end <= end)
    );
    return used || isUsedElsewhere(found.specifier.local.name) ? undefined : found;
  }
}
