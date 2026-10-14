// Reads the code a story's render computes a prop with, so the snippet can declare it as a host
// field that follows the args it reads.
import { type NodePath, types as t } from 'storybook/internal/babel';
import { isOperand } from 'storybook/internal/csf-tools';
import { dedentStoryCode, hole } from 'storybook/internal/docs-tools';

/** The names a render function binds its args under; see `functionScope`. */
export interface ArgNames {
  argBindings: ReadonlyMap<string, string>;
  defaulted: ReadonlyMap<string, unknown>;
  argsExpansions: ReadonlyMap<string, readonly string[]>;
}

/** Code of a prop that reads args, and that a snippet can carry outside the story file. */
export interface PropCode {
  /** The args the code reads. */
  args: string[];
  /** The names the code needs imported, as the story file imports them. */
  imports: string[];
  /** The code as the story writes it, with a `⟦value⟧` or `⟦operand⟧` hole at each arg read. */
  template: string;
}

const STORYBOOK_MODULE = /^(storybook|@storybook)(\/|$)/;

export const functionPath = (
  program: NodePath<t.Program>,
  fn: t.Node
): NodePath<t.Function> | undefined => {
  let found: NodePath<t.Function> | undefined;
  program.traverse({
    Function(path) {
      if (path.node === fn) {
        found = path;
        path.stop();
      }
    },
  });
  return found;
};

/**
 * The code a prop holds, or `undefined` when it reads no arg or names something only the story
 * file or the running render has. `code` is the source text of the story file.
 */
export const propCode = (
  fn: NodePath<t.Function>,
  value: t.Node,
  names: ArgNames,
  code: string
): PropCode | undefined => {
  const root = findPath(fn, value);
  if (!root) {
    return undefined;
  }
  const program = fn.scope.getProgramParent().path.node as t.Program;

  const reads: { node: t.Node; arg: string; kind: string; key?: string }[] = [];
  const imports = new Set<string>();
  let carried = true;
  const read = (path: NodePath, arg: string) => {
    // An arg the code calls or writes holds what no control sets.
    const { parentPath } = path;
    if (
      parentPath?.isCallExpression({ callee: path.node }) ||
      parentPath?.isOptionalCallExpression({ callee: path.node }) ||
      parentPath?.isNewExpression({ callee: path.node }) ||
      parentPath?.isTaggedTemplateExpression({ tag: path.node }) ||
      parentPath?.isAssignmentExpression({ left: path.node }) ||
      parentPath?.isUpdateExpression()
    ) {
      carried = false;
    }
    // Code around the read is only what the prop holds, so a literal in its place is read as it is
    // there.
    const around = path.getAncestry().map(({ node }) => node);
    const within = around.slice(1, around.indexOf(root.node) + 1);
    // `{ value }` reads the arg and names the property at once.
    const shorthand =
      parentPath?.isObjectProperty({ value: path.node }) && parentPath.node.shorthand;
    reads.push({
      node: shorthand ? parentPath.node : path.node,
      arg,
      kind: isOperand(path.node, within) ? 'operand' : 'value',
      ...(shorthand ? { key: code.slice(path.node.start!, path.node.end!) } : {}),
    });
  };
  const visit = (path: NodePath<t.Identifier | t.JSXIdentifier>) => {
    const { name } = path.node;
    const binding = path.scope.getBinding(name);
    if (!binding) {
      // A type the story file declares is no import the snippet could bring along.
      carried &&= !declaresType(program, name);
      return;
    }
    if (binding.path.isDescendant(root)) {
      return;
    }
    if (binding.scope === fn.scope) {
      const arg = names.defaulted.has(name) ? undefined : names.argBindings.get(name);
      const except = names.argsExpansions.get(name);
      const member = path.parentPath;
      const key =
        except && member?.isMemberExpression({ object: path.node })
          ? memberName(member.node)
          : undefined;
      if (arg !== undefined) {
        read(path, arg);
      } else if (key !== undefined && !except!.includes(key)) {
        read(member!, key);
      } else {
        carried = false;
      }
    } else if (binding.path.findParent((parent) => parent.node === fn.node)) {
      carried = false;
    } else {
      const declaration = binding.path.parentPath;
      const source = declaration?.isImportDeclaration() ? declaration.node.source.value : undefined;
      // The snippet's import statements bring values along, which a type-only import is not.
      const typeOnly =
        declaration?.isImportDeclaration({ importKind: 'type' }) ||
        (binding.path.isImportSpecifier() && binding.path.node.importKind === 'type');
      if (source === undefined || STORYBOOK_MODULE.test(source) || typeOnly) {
        carried = false;
      } else {
        imports.add(name);
      }
    }
  };
  if (root.isIdentifier()) {
    visit(root);
  }
  root.traverse({
    ReferencedIdentifier: visit,
    ThisExpression(self) {
      const owner = self.getFunctionParent();
      carried &&= owner !== null && owner.isDescendant(root) && !owner.isArrowFunctionExpression();
    },
  });

  const args = [...new Set(reads.map(({ arg }) => arg))];
  if (!carried || args.length === 0) {
    return undefined;
  }
  const { start, end, loc } = root.node;
  let text = code.slice(start!, end!);
  for (const { node, arg, kind, key } of reads.sort((a, b) => b.node.start! - a.node.start!)) {
    const written = key === undefined ? hole(kind, arg) : `${key}: ${hole(kind, arg)}`;
    text = text.slice(0, node.start! - start!) + written + text.slice(node.end! - start!);
  }
  return {
    args,
    imports: [...imports],
    template: dedentStoryCode(text, loc!.start.column),
  };
};

const declaresType = (program: t.Program, name: string) =>
  program.body.some((statement) => {
    const declaration = t.isExportNamedDeclaration(statement) ? statement.declaration : statement;
    return (
      (t.isTSInterfaceDeclaration(declaration) || t.isTSTypeAliasDeclaration(declaration)) &&
      declaration.id.name === name
    );
  });

const findPath = (within: NodePath, node: t.Node): NodePath | undefined => {
  let found: NodePath | undefined;
  within.traverse({
    enter(path) {
      if (path.node === node) {
        found = path;
        path.stop();
      }
    },
  });
  return found;
};

const memberName = (member: t.MemberExpression): string | undefined => {
  if (!member.computed && t.isIdentifier(member.property)) {
    return member.property.name;
  }
  return t.isStringLiteral(member.property) ? member.property.value : undefined;
};
