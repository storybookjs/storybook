// Reads the code a story's render computes a prop with, so the snippet can declare it as a host
// field that follows the args it reads.
import type { ESTree as E, ESTreeNode as Node, SourceEditor } from 'storybook/internal/csf-tools';
import { isOperand, isStringLiteral, walk } from 'storybook/internal/csf-tools';
import { dedentStoryCode, hole, holeWord } from 'storybook/internal/docs-tools';

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

type FunctionNode = E.Function | E.ArrowFunctionExpression;

/**
 * The code a prop holds, or `undefined` when it reads no arg or names something only the story
 * file or the running render has. `fn` is the render function in the story file `editor` holds,
 * and `written` holds the node the story writes each arg with, which decides where its code needs
 * parentheses; see `isOperand`.
 */
export const propCode = (
  fn: FunctionNode,
  root: Node,
  names: ArgNames,
  editor: SourceEditor,
  written: Record<string, Node> = {}
): PropCode | undefined => {
  const { code, scopes } = editor;
  const within = (node: Node, outer: Node) => outer.start <= node.start && node.end <= outer.end;

  const reads: { node: Node; arg: string; kind: string; key?: string }[] = [];
  const imports = new Set<string>();
  let carried = true;
  // `ancestors` holds the nodes around `node`, the nearest first, up to the root of the prop.
  const read = (node: Node, ancestors: Node[], arg: string) => {
    const [parent] = ancestors;
    // The target of a write, as in `args.count++`, is no read and stays as written.
    if (
      (parent?.type === 'AssignmentExpression' && parent.left === node) ||
      parent?.type === 'UpdateExpression' ||
      (parent?.type === 'UnaryExpression' && parent.operator === 'delete')
    ) {
      return;
    }
    // `{ value }` reads the arg and names the property at once.
    const shorthand = parent?.type === 'Property' && parent.shorthand && parent.value === node;
    reads.push({
      node: shorthand ? parent : node,
      arg,
      // Code around the read is only what the prop holds, so a literal in its place is read as it
      // is there.
      kind:
        isOperand(node, ancestors, Object.hasOwn(written, arg) ? written[arg] : undefined) ||
        (parent?.type === 'NewExpression' && parent.callee === node) ||
        (parent?.type === 'TaggedTemplateExpression' && parent.tag === node)
          ? 'operand'
          : 'value',
      ...(shorthand ? { key: code.slice(node.start, node.end) } : {}),
    });
  };
  const visit = (node: E.IdentifierReference | E.JSXIdentifier, ancestors: Node[]) => {
    const { name } = node;
    const binding = scopes.bindingOf(node);
    if (!binding) {
      // A type the story file declares is no import the snippet could bring along.
      carried &&= !scopes.tsDeclarationNames.has(name);
      return;
    }
    if (within(binding.identifier, root)) {
      return;
    }
    if (binding.scope.node === fn) {
      const arg = names.defaulted.has(name) ? undefined : names.argBindings.get(name);
      const except = names.argsExpansions.get(name);
      const [member] = ancestors;
      const key =
        except && member?.type === 'MemberExpression' && member.object === node
          ? memberName(member)
          : undefined;
      if (arg !== undefined) {
        read(node, ancestors, arg);
      } else if (key !== undefined && !except!.includes(key)) {
        read(member, ancestors.slice(1), key);
      } else {
        carried = false;
      }
    } else if (within(binding.identifier, fn)) {
      carried = false;
    } else {
      const declaration = binding.kind === 'import' ? binding.declaration : undefined;
      const source =
        declaration?.type === 'ImportDeclaration' ? declaration.source.value : undefined;
      // The snippet's import statements bring values along, which a type-only import is not.
      const typeOnly =
        (declaration?.type === 'ImportDeclaration' && declaration.importKind === 'type') ||
        (binding.node.type === 'ImportSpecifier' && binding.node.importKind === 'type');
      if (source === undefined || STORYBOOK_MODULE.test(source) || typeOnly) {
        carried = false;
      } else {
        imports.add(name);
      }
    }
  };

  // Every name the prop reads, with the nodes around it up to the root, the nearest first.
  const stack: Node[] = [];
  const enter = (node: Node) => {
    const ancestors = [...stack].reverse();
    const [parent] = ancestors;
    if (node.type === 'ThisExpression') {
      const owner = ancestors.find(
        (ancestor): ancestor is FunctionNode =>
          ancestor.type === 'FunctionExpression' ||
          ancestor.type === 'FunctionDeclaration' ||
          ancestor.type === 'ArrowFunctionExpression'
      );
      carried &&= owner !== undefined && owner.type !== 'ArrowFunctionExpression';
    } else if (node.type === 'Identifier' && isReference(node as E.IdentifierReference, parent)) {
      visit(node as E.IdentifierReference, ancestors);
    } else if (node.type === 'JSXIdentifier' && isJSXReference(node, parent)) {
      visit(node, ancestors);
    }
    stack.push(node);
    walk(node, (child) => {
      if (child !== node) {
        enter(child);
        return false;
      }
    });
    stack.pop();
  };
  enter(root);

  const args = [...new Set(reads.map(({ arg }) => arg))];
  if (!carried || args.length === 0) {
    return undefined;
  }
  const { start, end } = root;
  let text = code.slice(start, end);
  for (const { node, arg, kind, key } of reads.sort((a, b) => b.node.start - a.node.start)) {
    const filled =
      key === undefined ? hole(kind, holeWord(arg)) : `${key}: ${hole(kind, holeWord(arg))}`;
    text = text.slice(0, node.start - start) + filled + text.slice(node.end - start);
  }
  return {
    args,
    imports: [...imports],
    template: dedentStoryCode(text, start - (code.lastIndexOf('\n', start - 1) + 1)),
  };
};

// Whether an identifier reads a binding, rather than naming a property, a label or what it declares.
const isReference = (node: E.IdentifierReference, parent: Node | undefined) => {
  switch (parent?.type) {
    case 'MemberExpression':
      return parent.object === node || parent.computed;
    case 'Property':
      return parent.value === node || parent.computed;
    case 'MethodDefinition':
    case 'PropertyDefinition':
    case 'AccessorProperty':
      return parent.key !== node || parent.computed;
    case 'LabeledStatement':
    case 'BreakStatement':
    case 'ContinueStatement':
    case 'MetaProperty':
      return false;
    case 'ExportSpecifier':
    case 'ImportSpecifier':
      return false;
    default:
      return true;
  }
};

// A JSX tag that names a component, which a lowercase intrinsic element does not.
const isJSXReference = (node: E.JSXIdentifier, parent: Node | undefined) =>
  ((parent?.type === 'JSXOpeningElement' || parent?.type === 'JSXClosingElement') &&
    parent.name === node &&
    !/^[a-z]/.test(node.name)) ||
  (parent?.type === 'JSXMemberExpression' && parent.object === node);

const memberName = (member: E.MemberExpression): string | undefined => {
  if (!member.computed && member.property.type === 'Identifier') {
    return member.property.name;
  }
  return isStringLiteral(member.property) ? member.property.value : undefined;
};
