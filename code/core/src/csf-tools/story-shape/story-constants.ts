import { type Node, isFunction, isTSWrapper, unwrapExpression, walk } from '../estree/ast.ts';
import { qualifiedNameRoot } from '../estree/scope.ts';
import type { ReferenceContext } from './resolve-members.ts';
import { unchangingKind } from './unchanging-binding.ts';

/** A constant the story file declares at module level, which a snippet can declare again. */
export interface StoryConstant {
  /**
   * Its value as written, keeping `as const` and `satisfies`. With `jsx`, a value under a `<T>`
   * assertion loses every type wrapper around it, since JSX cannot hold `<T>`.
   */
  value: Node;
  /** The constants this value reads, declared before it. */
  uses: string[];
  /** Its position in the story file, for ordering. */
  start: number;
}

/** The story-file constants a story's args read. */
export interface StoryConstants {
  /** The declaration of each constant in `names`, by name. */
  declarations: ReadonlyMap<string, StoryConstant>;
  /** Every constant name the snippet may declare, which it must keep free. */
  names: ReadonlySet<string>;
  /** The constants a value reads; none if it also reads something the snippet cannot declare. */
  readBy: (value: Node) => ReadonlySet<string>;
  /** The constant whose declared value this is, so the snippet can print its name instead. */
  declaredAs: (value: Node) => string | undefined;
}

const NO_NAMES: ReadonlySet<string> = new Set();

export const NO_STORY_CONSTANTS: StoryConstants = {
  declarations: new Map(),
  names: NO_NAMES,
  readBy: () => NO_NAMES,
  declaredAs: () => undefined,
};

/**
 * Collect the module-level constants a story's args read, so its snippet can declare them.
 *
 * Each arg value is all or nothing: either every story-file name it reads is an unchanging constant
 * the snippet can declare again, outside `taken`, or the value adds no constant at all. Callers
 * report the names they could not declare themselves. With `jsx`, a constant that would not parse
 * in a TSX snippet, such as `<T>value`, is not declared.
 *
 * @example `const lines = ['a']; args: { count: lines.length }` → declares `lines`
 */
export function collectStoryConstants(
  args: Record<string, Node>,
  ctx: ReferenceContext,
  { taken = NO_NAMES, jsx = false }: { taken?: ReadonlySet<string>; jsx?: boolean } = {}
): StoryConstants {
  const declarations = new Map<string, StoryConstant>();
  const values = new WeakMap<Node, string>();
  const rejected = new Set<string>();
  const { editor } = ctx;
  const { program } = editor.scopes;

  // A node copied from another module has no parent in this file.
  const owned = (node: Node): boolean => editor.parentOf(node) !== null;

  // An enum or a namespace has no binding, and no declaration the snippet can copy.
  const readNames = (node: Node): string[] => {
    const names = new Set<string>();
    walk(node, (child, parent) => {
      if (child.type !== 'Identifier' && child.type !== 'JSXIdentifier') {
        return;
      }
      const binding = editor.scopes.bindingOf(child);
      if (
        binding?.scope === program ||
        (!binding && isValueRead(child, parent) && editor.scopes.tsDeclarationNames.has(child.name))
      ) {
        names.add(child.name);
      }
    });
    return [...names];
  };

  const declarable = (name: string, visiting: Set<string>): boolean => {
    if (declarations.has(name)) {
      return true;
    }
    // A constant that reads itself cannot be ordered.
    if (rejected.has(name) || visiting.has(name) || taken.has(name)) {
      return false;
    }

    const binding = program.bindings.get(name);
    const declarator =
      binding?.node.type === 'VariableDeclarator' && unchangingKind(binding, ctx) !== undefined
        ? binding.node
        : undefined;
    const init = declarator?.init ? unwrapExpression(declarator.init) : undefined;
    if (!declarator?.init || !init || namesStoryFileType(declarator.init, ctx)) {
      rejected.add(name);
      return false;
    }

    const uses = readNames(init);
    visiting.add(name);
    const readable = uses.every((used) => declarable(used, visiting));
    visiting.delete(name);
    if (!readable) {
      rejected.add(name);
      return false;
    }

    // `<T>value` does not parse in a TSX snippet.
    const value = jsx && hasAngleBracketAssertion(declarator.init) ? init : declarator.init;
    if (jsx && breaksJsx(value, ctx.filePath.endsWith('.tsx'))) {
      rejected.add(name);
      return false;
    }
    declarations.set(name, {
      value,
      uses,
      start: declarator.start,
    });
    values.set(init, name);
    return true;
  };

  // All or nothing: one name the snippet cannot declare drops the whole value.
  const reads = (value: Node): ReadonlySet<string> => {
    const unwrapped = unwrapExpression(value);
    if (!owned(unwrapped) || namesStoryFileType(value, ctx)) {
      return NO_NAMES;
    }
    const names = readNames(unwrapped);
    return names.every((name) => declarable(name, new Set())) ? new Set(names) : NO_NAMES;
  };

  const names = new Set<string>();
  const name = (constant: string): void => {
    if (!names.has(constant)) {
      names.add(constant);
      declarations.get(constant)?.uses.forEach(name);
    }
  };
  for (const value of Object.values(args)) {
    reads(value).forEach(name);
  }

  return {
    declarations: new Map([...names].map((constant) => [constant, declarations.get(constant)!])),
    names,
    readBy: (value) => {
      const read = reads(value);
      return [...read].every((constant) => names.has(constant)) ? read : NO_NAMES;
    },
    declaredAs: (value) => {
      const constant = values.get(unwrapExpression(value));
      return constant !== undefined && names.has(constant) ? constant : undefined;
    },
  };
}

// A type the story file declares does not exist where the snippet lands.
function namesStoryFileType(node: Node, { editor }: ReferenceContext): boolean {
  const { tsDeclarationNames, program } = editor.scopes;
  let named = false;
  walk(node, (child) => {
    if (named) {
      return false;
    }
    // `import('./types').Item` may not resolve where the snippet lands.
    if (child.type === 'TSImportType') {
      named = true;
    } else if (child.type === 'TSTypeReference' || child.type === 'TSTypeQuery') {
      // `Item` in `Item`, `Shapes` in `Shapes.Item`, `config` in `typeof config`.
      const root = qualifiedNameRoot(
        child.type === 'TSTypeReference' ? child.typeName : child.exprName
      );
      named = root !== undefined && (tsDeclarationNames.has(root) || program.bindings.has(root));
    }
  });
  return named;
}

// `<T>value`, and `<T>(value: T) => value` outside a `.tsx` file, read as JSX tags in a TSX snippet.
function breaksJsx(node: Node, tsx: boolean): boolean {
  let found = false;
  walk(node, (child) => {
    found ||=
      child.type === 'TSTypeAssertion' ||
      (!tsx &&
        isFunction(child) &&
        Boolean((child as { typeParameters?: unknown }).typeParameters));
    return !found;
  });
  return found;
}

// `Kind` in `Kind.Primary`, but not in `tokens.Kind`, `{ Kind: 1 }` or `<b Kind />`.
const isValueRead = (node: Node, parent: Node | null): boolean =>
  node.type === 'Identifier' &&
  !(parent?.type === 'MemberExpression' && parent.property === node && !parent.computed) &&
  !(parent?.type === 'Property' && parent.key === node && !parent.computed && !parent.shorthand);

function hasAngleBracketAssertion(node: Node): boolean {
  let current: Node = node;
  while (isTSWrapper(current) || current.type === 'ParenthesizedExpression') {
    if (current.type === 'TSTypeAssertion') {
      return true;
    }
    current = (current as Node & { expression: Node }).expression;
  }
  return false;
}
