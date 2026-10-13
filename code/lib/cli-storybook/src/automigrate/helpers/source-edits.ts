import type { ESTree as E, ESTreeNode as Node, SourceEditor } from 'storybook/internal/csf-tools';

// Each statement takes the whitespace before it, or after it when nothing before it is kept, so no
// blank lines are left behind. A `;` right after a removed statement goes with it.
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
    if (program.body.slice(0, index).every((previous) => removed.has(previous))) {
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
