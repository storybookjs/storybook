import {
  type ESTreeNode as Node,
  type SourceEditor,
  calledMethodName,
  isTSWrapper,
  staticKey,
  textOf,
} from 'storybook/internal/csf-tools';

export const isFunctionNode = (node: Node): boolean =>
  node.type === 'FunctionDeclaration' ||
  node.type === 'FunctionExpression' ||
  node.type === 'ArrowFunctionExpression';

const isWrapper = (node: Node): boolean =>
  node.type === 'ChainExpression' || node.type === 'ParenthesizedExpression' || isTSWrapper(node);

// Functions that keep the function they are given rather than call it while the script loads:
// lifecycle hooks and timers run it once the story renders, spies and listeners when it is called.
const KEEPING_FUNCTIONS = new Set(
  (
    '$effect $effect.pre afterUpdate beforeUpdate onDestroy onMount requestAnimationFrame ' +
    'setInterval setTimeout action fn vi.fn'
  ).split(' ')
);

const KEEPING_METHODS = new Set(['addEventListener', 'removeEventListener']);

// The config keys whose functions Storybook runs before a story renders.
const BEFORE_RENDER_KEYS = new Set(['beforeAll', 'beforeEach', 'decorators', 'loaders', 'render']);

/**
 * Whether code of a story file's script runs while the script loads: outside every function, or in
 * a function that code running while it loads calls. A change made there is in the value the story
 * renders with, while one an event handler or `onMount` makes later is the story's own state.
 */
export function runsWhileLoading(
  node: Node,
  editor: SourceEditor,
  visiting: Set<Node> = new Set()
): boolean {
  const fn = enclosingFunction(node, editor);
  if (!fn) {
    return true;
  }
  // A recursive function runs as often as its first caller.
  if (visiting.has(fn)) {
    return false;
  }
  visiting.add(fn);
  let held: Node = fn;
  let holder = editor.parentOf(fn);
  while (holder && isWrapper(holder)) {
    held = holder;
    holder = editor.parentOf(held);
  }
  const id =
    fn.type === 'FunctionDeclaration'
      ? fn.id
      : holder?.type === 'VariableDeclarator' && holder.init === held
        ? holder.id
        : undefined;
  const binding = id?.type === 'Identifier' ? editor.scopes.bindingOf(id) : undefined;
  if (!binding) {
    return (
      !isKept(held, holder) &&
      !isStoryHandler(held, editor) &&
      runsWhileLoading(fn, editor, visiting)
    );
  }
  return binding.references.some((reference) => {
    let read = reference;
    let parent = editor.parentOf(read);
    while (parent && isWrapper(parent)) {
      read = parent;
      parent = editor.parentOf(read);
    }
    if (
      parent?.type === 'MemberExpression' &&
      /^(call|apply)$/.test(calledMethodName(parent) ?? '')
    ) {
      read = parent;
      parent = editor.parentOf(read);
    }
    if (parent?.type === 'CallExpression' || parent?.type === 'NewExpression') {
      return (
        (parent.callee === read || !isKept(read, parent)) &&
        runsWhileLoading(parent, editor, visiting)
      );
    }
    if (
      parent?.type === 'ReturnStatement' ||
      (parent && isFunctionNode(parent) && (parent as { body?: Node }).body === read)
    ) {
      return runsWhileLoading(parent, editor, visiting);
    }
    return runsBeforeRender(reference, editor);
  });
}

function isKept(value: Node, parent: Node | null): boolean {
  return (
    (parent?.type === 'CallExpression' || parent?.type === 'NewExpression') &&
    parent.callee !== value &&
    (KEEPING_FUNCTIONS.has(textOf(parent.callee)) ||
      KEEPING_METHODS.has(calledMethodName(parent.callee) ?? ''))
  );
}

// `defineMeta({ args: { onclick: () => count++ } })`: a handler a story holds outside its
// before-render keys.
function isStoryHandler(value: Node, editor: SourceEditor): boolean {
  let node = value;
  let parent = editor.parentOf(node);
  let held = false;
  while (parent) {
    if (parent.type === 'Property' && parent.value === node) {
      if (BEFORE_RENDER_KEYS.has(staticKey(parent) ?? '')) {
        return false;
      }
      held = true;
    } else if (
      parent.type !== 'ObjectExpression' &&
      parent.type !== 'ArrayExpression' &&
      !isWrapper(parent)
    ) {
      break;
    }
    node = parent;
    parent = editor.parentOf(node);
  }
  return (
    held &&
    parent?.type === 'CallExpression' &&
    parent.callee !== node &&
    textOf(parent.callee) === 'defineMeta'
  );
}

function runsBeforeRender(node: Node, editor: SourceEditor): boolean {
  let current = node;
  let parent = editor.parentOf(current);
  while (parent?.type === 'ArrayExpression' || (parent && isWrapper(parent))) {
    current = parent;
    parent = editor.parentOf(current);
  }
  return (
    parent?.type === 'Property' &&
    parent.value === current &&
    BEFORE_RENDER_KEYS.has(staticKey(parent) ?? '')
  );
}

function enclosingFunction(node: Node, editor: SourceEditor): Node | undefined {
  for (let current = editor.parentOf(node); current; current = editor.parentOf(current)) {
    if (isFunctionNode(current)) {
      return current;
    }
  }
  return undefined;
}
