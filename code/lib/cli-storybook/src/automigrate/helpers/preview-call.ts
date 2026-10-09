import { traverse, types as t } from 'storybook/internal/babel';

export const topLevelCalls = (program: t.Program, callee: string): t.ExpressionStatement[] =>
  program.body.filter(
    (node): node is t.ExpressionStatement =>
      t.isExpressionStatement(node) &&
      t.isCallExpression(node.expression) &&
      t.isIdentifier(node.expression.callee, { name: callee })
  );

export const countReferences = (program: t.Program, name: string): number => {
  let references = 0;
  traverse(t.file(program), {
    Identifier(path): void {
      if (path.node.name !== name || path.parentPath?.isImportDefaultSpecifier()) {
        return;
      }
      if (path.isReferencedIdentifier()) {
        references += 1;
      }
    },
  });
  return references;
};

/**
 * Strips the top-level `callee` calls and the imports that only fed them. Returns why the file was
 * left alone, or `null` once removed.
 *
 * Real previews wrap the call in a helper or pre-process its argument first. Rewriting those safely
 * is not worth the risk, so anything that is not a plain top-level call is reported instead, and
 * imports survive while any other code still reads them.
 */
export const removeTopLevelCall = (
  program: t.Program,
  { callee, calleeSources }: { callee: string; calleeSources: ReadonlySet<string> }
): string | null => {
  const callsToDrop = topLevelCalls(program, callee);
  if (callsToDrop.length === 0) {
    return `${callee} is not called at the top level`;
  }

  const dropped = new Set<t.Statement>(callsToDrop);
  const withoutCalls = t.program(program.body.filter((node) => !dropped.has(node)));
  if (countReferences(withoutCalls, callee) > 0) {
    return `${callee} is still used elsewhere`;
  }

  const droppableImportNames = new Set(
    callsToDrop.flatMap((node): string[] => {
      const [argument] = (node.expression as t.CallExpression).arguments;
      return t.isIdentifier(argument) && countReferences(withoutCalls, argument.name) === 0
        ? [argument.name]
        : [];
    })
  );

  const remaining: t.Statement[] = [];
  for (const node of withoutCalls.body) {
    if (t.isImportDeclaration(node) && node.specifiers.length > 0) {
      node.specifiers = node.specifiers.filter(
        (specifier) =>
          !(
            (calleeSources.has(node.source.value) && specifier.local.name === callee) ||
            droppableImportNames.has(specifier.local.name)
          )
      );
      if (node.specifiers.length === 0) {
        continue;
      }
    }
    remaining.push(node);
  }

  program.body = remaining;
  return null;
};
