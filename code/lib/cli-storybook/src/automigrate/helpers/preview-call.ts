import { type NodePath, traverse, types as t } from 'storybook/internal/babel';

export type RemoveTopLevelCallResult =
  | { removed: false; reason: string }
  | { removed: true; keptArguments: string[] };

export const isTopLevelCall = (node: t.Statement, callee: string): node is t.ExpressionStatement =>
  t.isExpressionStatement(node) &&
  t.isCallExpression(node.expression) &&
  t.isIdentifier(node.expression.callee, { name: callee });

export const topLevelCalls = (program: t.Program, callee: string): t.ExpressionStatement[] =>
  program.body.filter((node): node is t.ExpressionStatement => isTopLevelCall(node, callee));

/** Reads of `name` that resolve to the program-level binding or to a global, skipping shadowed ones. */
export const referencePaths = (program: t.Program, name: string): NodePath<t.Identifier>[] => {
  const paths: NodePath<t.Identifier>[] = [];
  traverse(t.file(program), {
    Identifier(path): void {
      if (path.node.name !== name || path.parentPath?.isImportDefaultSpecifier()) {
        return;
      }
      if (!path.isReferencedIdentifier()) {
        return;
      }
      const binding = path.scope.getBinding(name);
      if (binding && binding.scope !== path.scope.getProgramParent()) {
        return;
      }
      paths.push(path);
    },
  });
  return paths;
};

export const countReferences = (program: t.Program, name: string): number =>
  referencePaths(program, name).length;

export const topLevelReaders = (program: t.Program, name: string): t.Statement[] => {
  const readers = new Set<t.Node>(
    referencePaths(program, name).flatMap((path): t.Node[] => {
      const statement = path.find((parent) => parent.parentPath?.isProgram() ?? false);
      return statement ? [statement.node] : [];
    })
  );
  return program.body.filter((node) => readers.has(node));
};

/**
 * Strips the top-level `callee` calls and the imports that only fed them. `keptArguments` lists the
 * identifier arguments whose imports survive because other code still reads them.
 *
 * Real previews wrap the call in a helper or pre-process its argument first. Rewriting those safely
 * is not worth the risk, so anything that is not a plain top-level call is reported instead.
 */
export const removeTopLevelCall = (
  program: t.Program,
  { callee, calleeSources }: { callee: string; calleeSources: ReadonlySet<string> }
): RemoveTopLevelCallResult => {
  const callsToDrop = topLevelCalls(program, callee);
  if (callsToDrop.length === 0) {
    return { removed: false, reason: `${callee} is not called at the top level` };
  }

  const dropped = new Set<t.Statement>(callsToDrop);
  const withoutCalls = t.program(program.body.filter((node) => !dropped.has(node)));
  if (countReferences(withoutCalls, callee) > 0) {
    return { removed: false, reason: `${callee} is still used elsewhere` };
  }

  const argumentNames = new Set(
    callsToDrop.flatMap((node): string[] => {
      const [argument] = (node.expression as t.CallExpression).arguments;
      return t.isIdentifier(argument) ? [argument.name] : [];
    })
  );
  const keptArguments = [...argumentNames].filter(
    (name) => countReferences(withoutCalls, name) > 0
  );

  const remaining: t.Statement[] = [];
  for (const node of withoutCalls.body) {
    if (t.isImportDeclaration(node) && node.specifiers.length > 0) {
      node.specifiers = node.specifiers.filter(
        (specifier) =>
          !(
            (calleeSources.has(node.source.value) && specifier.local.name === callee) ||
            (argumentNames.has(specifier.local.name) &&
              !keptArguments.includes(specifier.local.name))
          )
      );
      if (node.specifiers.length === 0) {
        continue;
      }
    }
    remaining.push(node);
  }

  program.body = remaining;
  return { removed: true, keptArguments };
};
