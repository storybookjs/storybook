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
  const init = local && constInit(local);
  const root = findPath(fn, init ?? value);
  if (!root || (init && !onlyHere(fn, local!, (reference) => reference.node === value))) {
    return undefined;
  }
  const program = fn.scope.getProgramParent().path.node as t.Program;

  const reads = new Map<t.Node, { arg: string; alone: boolean }>();
  // A `const` the code names in turn, written in its place where nothing else but a subscription
  // reads it, so the snippet has one copy just as the render does.
  const inlined = new Map<t.Node, { code: t.Node; alone: boolean }>();
  const roots: NodePath[] = [];
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
    reads.set(path.node, { arg, alone: roots.includes(path) || standsAlone(path) });
  };
  const visit = (path: NodePath<t.Identifier | t.JSXIdentifier>) => {
    const { name } = path.node;
    const binding = path.scope.getBinding(name);
    if (!binding) {
      // A type the story file declares is no import the snippet could bring along.
      carried &&= !declaresType(program, name);
      return;
    }
    if (roots.some((within) => binding.path.isDescendant(within))) {
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
      } else if (
        init &&
        !roots.some(({ node }) => node === init) &&
        onlyHere(fn, binding, (reference) => roots.some((within) => reference.isDescendant(within)))
      ) {
        inlined.set(path.node, { code: init, alone: standsAlone(path) });
        walk(findPath(fn, init));
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

// Whether the code is all that reads a binding, besides a statement of the body that subscribes to
// it: any other may change the object, or share it, which the snippet declares afresh.
const onlyHere = (
  fn: NodePath<t.Function>,
  binding: Binding,
  carries: (reference: NodePath) => boolean
) =>
  binding.referencePaths.every(
    (reference) => carries(reference) || subscribesTo(fn.node, reference)
  );

// `control.valueChanges.subscribe(…)`, which reads what the object emits and changes nothing of it.
export const isSubscription = (
  statement: t.Node
): statement is t.ExpressionStatement & {
  expression: t.CallExpression & { callee: t.MemberExpression };
} =>
  t.isExpressionStatement(statement) &&
  t.isCallExpression(statement.expression) &&
  t.isMemberExpression(statement.expression.callee, { computed: false }) &&
  t.isIdentifier(statement.expression.callee.property, { name: 'subscribe' });

const subscribesTo = (fn: t.Function, reference: NodePath) => {
  let path = reference;
  while (path.parentPath?.isMemberExpression({ object: path.node, computed: false })) {
    path = path.parentPath;
  }
  const statement = path.parentPath?.parentPath;
  return (
    statement?.parent === fn.body &&
    isSubscription(statement.node) &&
    statement.node.expression.callee === path.node
  );
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

// Whether a literal printed in place of the read is read the same: `5.toFixed()`, `--1` and
// `() => { a: 1 } || {}` are not, so a read elsewhere is parenthesised.
const standsAlone = (path: NodePath): boolean => {
  const { parent, listKey, key } = path;
  const operand =
    (t.isObjectProperty(parent) && key === 'value') ||
    t.isArrayExpression(parent) ||
    ((t.isCallExpression(parent) || t.isNewExpression(parent)) && listKey === 'arguments') ||
    t.isLogicalExpression(parent) ||
    t.isConditionalExpression(parent) ||
    t.isTemplateLiteral(parent) ||
    t.isSpreadElement(parent) ||
    (t.isBinaryExpression(parent) && parent.operator !== '**');
  return operand && !opensBody(path);
};

// Whether code printed in place of the node would open an arrow body or a statement, where `{`
// reads as a block.
const opensBody = (path: NodePath): boolean => {
  for (let current = path; current.parentPath; current = current.parentPath) {
    const { parentPath, parent, key } = current;
    if (
      parentPath.isExpressionStatement() ||
      (parentPath.isArrowFunctionExpression() && key === 'body')
    ) {
      return true;
    }
    const leads =
      (key === 'left' && (t.isBinary(parent) || t.isAssignmentExpression(parent))) ||
      (key === 'test' && t.isConditionalExpression(parent)) ||
      (key === 'object' &&
        (t.isMemberExpression(parent) || t.isOptionalMemberExpression(parent))) ||
      (key === 'callee' && (t.isCallExpression(parent) || t.isOptionalCallExpression(parent))) ||
      (key === 'tag' && t.isTaggedTemplateExpression(parent)) ||
      (key === 0 && t.isSequenceExpression(parent)) ||
      (key === 'expression' &&
        (t.isTSAsExpression(parent) ||
          t.isTSSatisfiesExpression(parent) ||
          t.isTSNonNullExpression(parent)));
    if (!leads) {
      return false;
    }
  }
  return false;
};

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
