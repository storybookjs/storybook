import type { ESTree as E, ESTreeNode as Node, SourceEditor } from 'storybook/internal/csf-tools';

// Removes top-level statements so the blank lines around them read as if they were never there:
// the first statement takes the whitespace after it, any other the whitespace before it. A `;`
// right after a removed statement, as in `function f() {};`, goes with it.
export function removeStatements(editor: SourceEditor, statements: ReadonlySet<Node>) {
  const { code, program } = editor;
  const removed = new Set(statements);
  program.body.forEach((statement, index) => {
    const next = program.body[index + 1];
    if (removed.has(statement) && next?.type === 'EmptyStatement' && next.start === statement.end) {
      removed.add(next);
    }
  });
  program.body.forEach((statement, index) => {
    if (!removed.has(statement)) {
      return;
    }
    if (index === 0) {
      const next = /\S/.exec(code.slice(statement.end));
      editor.edits.remove(statement.start, next ? statement.end + next.index : code.length);
      return;
    }
    const previousEnd = program.body[index - 1].end;
    const lineEnd = code.indexOf('\n', previousEnd);
    const hasTrailingComment =
      lineEnd !== -1 &&
      lineEnd < statement.start &&
      /^[ \t]*\/[/*]/.test(code.slice(previousEnd, lineEnd));
    editor.edits.remove(hasTrailingComment ? lineEnd : previousEnd, statement.end);
  });
}

// Rewrites the specifier list of an import declaration, as a reprint of the declaration would.
export function setImportSpecifiers(
  editor: SourceEditor,
  declaration: E.ImportDeclaration,
  specifiers: readonly E.ImportDeclaration['specifiers'][number][],
  added: { default?: string; named?: string[] } = {}
) {
  const source = (specifier: Node) => editor.source(specifier);
  const named = [
    ...specifiers.filter((specifier) => specifier.type === 'ImportSpecifier').map(source),
    ...(added.named ?? []),
  ];
  const parts = [
    ...(added.default ? [added.default] : []),
    ...specifiers.filter((specifier) => specifier.type !== 'ImportSpecifier').map(source),
    ...(named.length > 0 ? [`{ ${named.join(', ')} }`] : []),
  ];
  const kind = declaration.importKind === 'type' ? 'import type' : 'import';
  editor.edits.overwrite(
    declaration.start,
    declaration.source.start,
    `${kind} ${parts.join(', ')} from `
  );
}
