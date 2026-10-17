import {
  type ConfigFile,
  type ESTree as E,
  type ESTreeNode as Node,
  type SourceEditor,
  walk,
  removeStatements,
  setImportSpecifiers,
} from 'storybook/internal/csf-tools';

export type RemoveTopLevelCallResult =
  | { removed: false; reason: string }
  | { removed: true; keptArguments: string[] };

export const isTopLevelCall = (node: Node, callee: string): node is E.ExpressionStatement =>
  node.type === 'ExpressionStatement' &&
  node.expression.type === 'CallExpression' &&
  node.expression.callee.type === 'Identifier' &&
  node.expression.callee.name === callee;

export const topLevelCalls = (program: E.Program, callee: string): E.ExpressionStatement[] =>
  program.body.filter((node): node is E.ExpressionStatement => isTopLevelCall(node, callee));

const isWithin = (node: Node, statements: readonly Node[]) =>
  statements.some((statement) => statement.start <= node.start && node.end <= statement.end);

/**
 * Reads of `name` outside `excluded` that resolve to the program-level binding or to a global,
 * skipping shadowed ones.
 */
export const referenceNodes = (
  editor: SourceEditor,
  name: string,
  excluded: readonly Node[] = []
): Node[] => {
  const { scopes } = editor;
  const binding = scopes.program.bindings.get(name);
  if (binding) {
    return binding.references.filter((reference) => !isWithin(reference, excluded));
  }
  const references: Node[] = [];
  walk(editor.program, (node, parent) => {
    if (isWithin(node, excluded)) {
      return false;
    }
    const isKey =
      (parent?.type === 'MemberExpression' && parent.property === node && !parent.computed) ||
      (parent?.type === 'Property' && parent.key === node && !parent.computed && !parent.shorthand);
    if (node.type === 'Identifier' && node.name === name && !isKey && !scopes.bindingOf(node)) {
      references.push(node);
    }
  });
  return references;
};

export const countReferences = (
  editor: SourceEditor,
  name: string,
  excluded: readonly Node[] = []
): number => referenceNodes(editor, name, excluded).length;

/** Top-level statements that read `name`, in source order. */
export const topLevelReaders = (editor: SourceEditor, name: string): Node[] => {
  const references = referenceNodes(editor, name);
  return editor.program.body.filter((statement) =>
    references.some((reference) => isWithin(reference, [statement]))
  );
};

/**
 * Strips the top-level `callee` calls and the imports that only fed them. `keptArguments` lists the
 * identifier arguments whose imports survive because other code still reads them.
 *
 * Real previews wrap the call in a helper or pre-process its argument first. Rewriting those safely
 * is not worth the risk, so anything that is not a plain top-level call is reported instead.
 */
export const removeTopLevelCall = (
  preview: ConfigFile,
  { callee, calleeSources }: { callee: string; calleeSources: ReadonlySet<string> }
): RemoveTopLevelCallResult => {
  const editor = preview._editorSource;
  const callsToDrop = topLevelCalls(editor.program, callee);
  if (callsToDrop.length === 0) {
    return { removed: false, reason: `${callee} is not called at the top level` };
  }

  if (countReferences(editor, callee, callsToDrop) > 0) {
    return { removed: false, reason: `${callee} is still used elsewhere` };
  }

  const argumentNames = new Set(
    callsToDrop.flatMap((node): string[] => {
      const [argument] = (node.expression as E.CallExpression).arguments;
      return argument?.type === 'Identifier' ? [argument.name] : [];
    })
  );
  const keptArguments = [...argumentNames].filter(
    (name) => countReferences(editor, name, callsToDrop) > 0
  );

  const statementsToDrop = new Set<Node>(callsToDrop);
  for (const node of editor.program.body) {
    // A declaration without specifiers is imported for its side effects, so it stays as it is.
    if (node.type !== 'ImportDeclaration' || node.specifiers.length === 0) {
      continue;
    }
    const kept = node.specifiers.filter(
      (specifier) =>
        !(
          (calleeSources.has(node.source.value) && specifier.local.name === callee) ||
          (argumentNames.has(specifier.local.name) && !keptArguments.includes(specifier.local.name))
        )
    );
    if (kept.length === 0) {
      statementsToDrop.add(node);
    } else if (kept.length < node.specifiers.length) {
      setImportSpecifiers(editor, node, kept);
    }
  }
  removeStatements(editor, statementsToDrop);
  preview._commit();
  return { removed: true, keptArguments };
};
