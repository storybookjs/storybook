// Reads the code a story's render computes a prop with, so the snippet can declare it as a host
// field that follows the args it reads.
import { type NodePath, babelPrint, types as t } from 'storybook/internal/babel';

type Binding = NonNullable<ReturnType<NodePath['scope']['getBinding']>>;

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
  /** The code, with each arg it reads written as `write` returns it. */
  print: (write: (arg: string) => string) => string;
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
 * The code a prop holds, following the `const`s of the render body it names, or `undefined` when it
 * reads no arg or names something only the story file or the running render has.
 */
export const propCode = (
  fn: NodePath<t.Function>,
  value: t.Node,
  names: ArgNames
): PropCode | undefined => {
  const local = t.isIdentifier(value) ? fn.scope.getOwnBinding(value.name) : undefined;
  const code = (local && constInit(local)) ?? value;
  const root = findPath(fn, code);
  if (!root) {
    return undefined;
  }

  const reads = new Map<t.Node, { arg: string; alone: boolean }>();
  // A `const` the code names in turn, written in its place where nothing else but a statement of
  // the body reads it, so the snippet has one copy just as the render does.
  const inlined = new Map<t.Node, { code: t.Node; alone: boolean }>();
  const roots: NodePath[] = [];
  const imports = new Set<string>();
  let carried = true;
  const read = (path: NodePath, arg: string) => {
    // An arg the code calls or writes holds what no control sets.
    const { parentPath } = path;
    if (
      parentPath?.isCallExpression({ callee: path.node }) ||
      parentPath?.isAssignmentExpression({ left: path.node }) ||
      parentPath?.isUpdateExpression()
    ) {
      carried = false;
    }
    reads.set(path.node, { arg, alone: roots.includes(path) || standsAlone(path) });
  };
  const visit = (path: NodePath<t.Identifier | t.JSXIdentifier>) => {
    const { name } = path.node;
    const binding = path.scope.getBinding(name);
    if (!binding || roots.some((within) => binding.path.isDescendant(within))) {
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
      const init = constInit(binding);
      if (arg !== undefined) {
        read(path, arg);
      } else if (key !== undefined && !except!.includes(key)) {
        read(member!, key);
      } else if (init && !roots.some(({ node }) => node === init) && onlyHere(fn, binding, roots)) {
        inlined.set(path.node, { code: init, alone: standsAlone(path) });
        walk(findPath(fn, init));
      } else {
        carried = false;
      }
    } else if (binding.path.findParent((parent) => parent.node === fn.node)) {
      carried = false;
    } else {
      const source = binding.path.parentPath?.isImportDeclaration()
        ? binding.path.parentPath.node.source.value
        : undefined;
      if (source === undefined || STORYBOOK_MODULE.test(source)) {
        carried = false;
      } else {
        imports.add(name);
      }
    }
  };
  const walk = (path: NodePath | undefined) => {
    if (!path) {
      carried = false;
      return;
    }
    roots.push(path);
    if (path.isIdentifier()) {
      visit(path);
    }
    path.traverse({
      ReferencedIdentifier: visit,
      ThisExpression(self) {
        const owner = self.getFunctionParent();
        carried &&=
          owner !== null && owner.isDescendant(path) && !owner.isArrowFunctionExpression();
      },
    });
  };
  walk(root);

  const args = [...new Set([...reads.values()].map(({ arg }) => arg))];
  if (!carried || args.length === 0) {
    return undefined;
  }
  return {
    args,
    imports: [...imports],
    print: (write) => {
      const replace = (node: t.Node): t.Node | undefined => {
        const found = reads.get(node);
        const inline = inlined.get(node);
        const written = found
          ? t.identifier(write(found.arg))
          : inline && rewritten(inline.code, replace);
        const alone = found?.alone ?? inline?.alone;
        return written && !alone ? t.parenthesizedExpression(written as t.Expression) : written;
      };
      return babelPrint(rewritten(root.node, replace));
    },
  };
};

// The value of a `const` binding the code can be written with.
const constInit = (binding: Binding): t.Expression | undefined => {
  const declarator = binding.path.node;
  return binding.constant &&
    binding.kind === 'const' &&
    t.isVariableDeclarator(declarator) &&
    t.isIdentifier(declarator.id)
    ? (declarator.init ?? undefined)
    : undefined;
};

// Whether the code is all that reads a binding, besides statements of the body such as a
// subscription.
const onlyHere = (fn: NodePath<t.Function>, binding: Binding, roots: NodePath[]) =>
  binding.referencePaths.every(
    (reference) =>
      roots.some((within) => reference.isDescendant(within)) ||
      reference.findParent((parent) => parent.isExpressionStatement())?.parent === fn.node.body
  );

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

// Whether a literal printed in place of the read is read the same: `5.toFixed()`, `--1` and
// `() => { a: 1 }` are not, so a read elsewhere is parenthesised.
const standsAlone = ({ parent, listKey, key }: NodePath): boolean =>
  (t.isObjectProperty(parent) && key === 'value') ||
  t.isArrayExpression(parent) ||
  ((t.isCallExpression(parent) || t.isNewExpression(parent)) && listKey === 'arguments') ||
  t.isLogicalExpression(parent) ||
  t.isConditionalExpression(parent) ||
  t.isTemplateLiteral(parent) ||
  t.isSpreadElement(parent) ||
  (t.isBinaryExpression(parent) && parent.operator !== '**');

// A copy of the code with the nodes `replace` answers for swapped out.
const rewritten = (node: t.Node, replace: (node: t.Node) => t.Node | undefined): t.Node => {
  const replaced = replace(node);
  if (replaced) {
    return replaced;
  }
  // A clone drops what recast keeps of the file, so the copy prints from the tree.
  const copy = t.cloneNode(node, false) as unknown as Record<string, unknown>;
  for (const key of t.VISITOR_KEYS[node.type] ?? []) {
    const child = (node as unknown as Record<string, unknown>)[key];
    const isKey = key === 'key' && t.isObjectProperty(node) && !node.computed;
    if (Array.isArray(child)) {
      copy[key] = child.map((item: t.Node | null) => item && rewritten(item, replace));
    } else if (child && !isKey) {
      copy[key] = rewritten(child as t.Node, replace);
    }
  }
  // `{ value }` reads the arg and names the property at once.
  if (t.isObjectProperty(node) && node.shorthand && copy.value !== node.value) {
    copy.shorthand = false;
  }
  return copy as unknown as t.Node;
};
