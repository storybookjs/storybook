import {
  type ESTree as E,
  type ESTreeNode as Node,
  type SourceEditor,
  detachedTextOf,
  isIdentifier,
  itemText,
  objectList,
  staticKey,
  unwrapExpression,
  walk,
} from 'storybook/internal/csf-tools';

export const KEY = 'sveltekit_experimental';

export const MOCK_EXPORTS = {
  page: '$app/state',
  navigating: '$app/state',
  updated: '$app/state',
  goto: '$app/navigation',
  invalidate: '$app/navigation',
  invalidateAll: '$app/navigation',
  refreshAll: '$app/navigation',
  pushState: '$app/navigation',
  replaceState: '$app/navigation',
  link: '@storybook/sveltekit/navigation.mock',
  setAfterNavigate: '@storybook/sveltekit/navigation.mock',
  formAction: '@storybook/sveltekit/forms.mock',
  mocked: 'storybook/test',
} as const;

export type MockExport = keyof typeof MOCK_EXPORTS;

const NAVIGATION_FUNCTIONS = [
  'goto',
  'invalidate',
  'invalidateAll',
  'refreshAll',
  'pushState',
  'replaceState',
] as const;

type NavigationFunction = (typeof NAVIGATION_FUNCTIONS)[number];
type StateObject = 'page' | 'navigating' | 'updated';
export type FunctionLiteral = E.ArrowFunctionExpression | E.Function;

export interface Span {
  start: number;
  end: number;
}

// A part of `sveltekit_experimental` that the fix cannot migrate, at an index of the editor's code.
export interface Problem {
  index: number;
  message: string;
}

// The keys whose values the old parameters merged across the preview, the meta and the story.
export interface MergedKeys {
  hrefs: boolean;
  afterNavigate: boolean;
  // The mock functions given an implementation, such as `goto` and `formAction`
  functions: string[];
  // `page.data`, `navigating.to` and the like, also nested ones such as `page.data.user`, set to an
  // object literal.
  objects: string[];
  // The same paths set to a value that can be a plain object, such as a variable, which the old
  // parameters merged too. `page.*` stands for every path under `page`.
  values: string[];
  // Every `page` and `navigating` property that is set, also nested ones
  assigned: string[];
  // The paths set to a value that is not a plain object, such as `null`: then the old parameters
  // merged none of the values of that path, and the last one won
  replaced: string[];
}

export const noMergedKeys = (): MergedKeys => ({
  hrefs: false,
  afterNavigate: false,
  functions: [],
  objects: [],
  values: [],
  assigned: [],
  replaced: [],
});

export const mergeKeys = (outer: MergedKeys, inner: MergedKeys): MergedKeys => ({
  hrefs: outer.hrefs || inner.hrefs,
  afterNavigate: outer.afterNavigate || inner.afterNavigate,
  functions: [...new Set([...outer.functions, ...inner.functions])],
  objects: [...new Set([...outer.objects, ...inner.objects])],
  values: [...new Set([...outer.values, ...inner.values])],
  assigned: [...new Set([...outer.assigned, ...inner.assigned])],
  replaced: [...new Set([...outer.replaced, ...inner.replaced])],
});

// Whether a level set a value that isn't an object literal at a path, or under a path ending in `.*`
const holdsValue = (keys: MergedKeys, path: string) =>
  keys.values.some((value) =>
    value.endsWith('.*') ? path.startsWith(value.slice(0, -1)) : value === path
  );

// Whether a path holds what the old parameters could merge with a plain object at `keys`' level
const mergesWith = (keys: MergedKeys, path: string) =>
  keys.objects.includes(path) || holdsValue(keys, path);

const ENHANCE_READS_EVENT =
  '`forms.enhance` reads the submit event. `formAction` receives `{ action, formData, formElement, submitter }` instead.';

// Record the paths of a value that a level inside this one could merge with
export const recordMerged = (keys: MergedKeys, node: Node, path: string) => {
  keys.assigned.push(path);
  const object = objectValue(node);
  if (!object) {
    keys[canBePlainObject(node) ? 'values' : 'replaced'].push(path);
    return;
  }
  keys.objects.push(path);
  for (const member of object.properties) {
    const key = isProperty(member) && !member.method ? staticKey(member) : undefined;
    if (key !== undefined) {
      recordMerged(keys, (member as E.ObjectProperty).value, `${path}.${key}`);
    } else if (member.type === 'SpreadElement') {
      keys.values.push(`${path}.*`);
    }
  }
};

// A value that the old parameters could merge deeply, as it can be a plain object at runtime
export const canBePlainObject = (node: Node) => {
  const value = unwrapExpression(node);
  return !(
    isNotAFunction(value) ||
    isFunctionLiteral(value) ||
    value.type === 'NewExpression' ||
    value.type === 'ClassExpression' ||
    value.type === 'UnaryExpression' ||
    value.type === 'BinaryExpression' ||
    value.type === 'UpdateExpression'
  );
};

export interface LinkEntry {
  member: E.ObjectProperty;
  regex: boolean;
  callback: Node;
  method: boolean;
  // How many arguments the callback declares, when it is a function the fix can read
  arity: number | undefined;
  comments: string;
}

export type Op = { comments: string } & (
  | {
      kind: 'assign';
      object: 'page' | 'navigating';
      key: string;
      member: E.ObjectProperty;
      merge: boolean;
    }
  | { kind: 'assign-all'; object: StateObject; value: string }
  | {
      kind: 'implement';
      fn: NavigationFunction;
      callback: Node;
      method: boolean;
      loose: boolean;
      arity: number | undefined;
    }
  | { kind: 'import'; fn: NavigationFunction; value: Node }
  | { kind: 'no-op'; fn: NavigationFunction | 'formAction' }
  | { kind: 'after-navigate'; value: Node }
  | { kind: 'links'; entries: LinkEntry[] }
  | { kind: 'form-action'; callback: Node; method: boolean }
);

// What one level's `sveltekit_experimental` migrates to, before the names of its imports are known.
export interface LevelMocks {
  ops: Op[];
  // Module-level `const goto = fn()` spies that the imported function replaces.
  spies: E.VariableDeclarator[];
  problems: Problem[];
  merged: MergedKeys;
}

export interface ReadContext {
  // The module-level `const` declarator an identifier in this editor's code refers to.
  moduleDeclarator(identifier: E.IdentifierReference): E.VariableDeclarator | undefined;
  isTestFn(identifier: E.IdentifierReference): boolean;
  // The function a module-level `const` or function declaration gives an identifier
  moduleFunction(identifier: E.IdentifierReference): FunctionLiteral | E.Function | undefined;
  // The module and the export of the import an identifier refers to
  importOf(identifier: E.IdentifierReference): { module: string; name: string } | undefined;
  // The keys the levels around this one set.
  outer: MergedKeys;
}

export const isFunctionLiteral = (node: Node): node is FunctionLiteral =>
  node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression';

const isProperty = (member: Node): member is E.ObjectProperty => member.type === 'Property';

// Visits a function's own body, not the functions nested in it.
export const someInBody = (fn: FunctionLiteral, test: (node: Node) => boolean) => {
  let found = false;
  walk(fn.body as Node, (node) => {
    if (
      found ||
      (node !== fn.body && isFunctionLiteral(node)) ||
      node.type === 'FunctionDeclaration'
    ) {
      return false;
    }
    found = test(node);
  });
  return found;
};

// A function that reads `arguments` uses more than its declared parameters. Arrows nested in it
// read its `arguments` too.
const readsArguments = (fn: FunctionLiteral) => {
  let found = false;
  walk(fn.body as Node, (node) => {
    if (found || node.type === 'FunctionExpression' || node.type === 'FunctionDeclaration') {
      return false;
    }
    found = isIdentifier(node, 'arguments');
  });
  return found;
};

// Creating these has no effect, so a callback that only returns one does nothing.
const isInert = (node: Node): boolean => {
  const value = unwrapExpression(node);
  switch (value.type) {
    case 'Literal':
    case 'ArrowFunctionExpression':
    case 'FunctionExpression':
      return true;
    case 'Identifier':
      return value.name === 'undefined';
    case 'TemplateLiteral':
      return value.expressions.length === 0;
    case 'ArrayExpression':
      return value.elements.every((element) => !element || isInert(element));
    case 'ObjectExpression':
      return value.properties.every(
        (member) => isProperty(member) && !member.computed && isInert(member.value)
      );
    default:
      return false;
  }
};

const doesNothing = (node: Node) => {
  const value = unwrapExpression(node);
  if (!isFunctionLiteral(value) || value.generator) {
    return false;
  }
  return value.body?.type === 'BlockStatement'
    ? value.body.body.length === 0
    : isInert(value.body!);
};

// The old mocks called only functions, so `goto: true` never did anything.
const isNotAFunction = (node: Node) => {
  const value = unwrapExpression(node);
  return (
    value.type === 'Literal' ||
    isIdentifier(value, 'undefined') ||
    value.type === 'ObjectExpression' ||
    value.type === 'ArrayExpression' ||
    value.type === 'TemplateLiteral'
  );
};

export const objectValue = (node: Node) => {
  const value = unwrapExpression(node);
  return value.type === 'ObjectExpression' ? value : undefined;
};

const keyText = (member: E.ObjectProperty) => staticKey(member) ?? '[computed]';

const deepMergeMessage = (path: string) =>
  `\`${path}\` is also set on a level around this one. The old parameters merged both values deeply, and an assignment replaces the earlier value.`;

export const readMocks = (
  editor: SourceEditor,
  sveltekit: Node,
  context: ReadContext
): LevelMocks => {
  const mocks: LevelMocks = { ops: [], spies: [], problems: [], merged: noMergedKeys() };
  const typescript = /\.[cm]?tsx?$/.test(editor.fileName ?? '');
  // The function a callback is, or the one a module-level identifier gives it
  const functionOf = (node: Node) => {
    const value = unwrapExpression(node);
    if (isFunctionLiteral(value)) {
      return value;
    }
    return value.type === 'Identifier'
      ? context.moduleFunction(value as E.IdentifierReference)
      : undefined;
  };
  // In TypeScript, a callback whose declared parameters or result the mock's signature doesn't accept
  const isLoose = (node: Node) => {
    const fn = functionOf(node);
    return (
      typescript &&
      !!fn &&
      (!!fn.returnType ||
        fn.params.some(
          (param) =>
            !!(param as { typeAnnotation?: unknown }).typeAnnotation ||
            (param.type === 'AssignmentPattern' &&
              !!(param.left as { typeAnnotation?: unknown }).typeAnnotation)
        ))
    );
  };
  const arityOf = (node: Node) => {
    const fn = functionOf(node);
    return fn &&
      !fn.params.some((param) => param.type === 'RestElement') &&
      (fn.type === 'ArrowFunctionExpression' || !readsArguments(fn))
      ? fn.params.length
      : undefined;
  };
  const problem = (node: Node, message: string) =>
    mocks.problems.push({ index: node.start, message });
  const commentsOf = (object: E.ObjectExpression, member: E.ObjectPropertyKind) => {
    const full = itemText(editor, objectList(editor, object), member);
    const own = detachedTextOf(member);
    return full.endsWith(own) ? full.slice(0, full.length - own.length) : '';
  };
  // Members that are not `key: value`, such as spreads and getters, are reported; the rest are read
  const membersOf = (object: E.ObjectExpression, path: string) =>
    object.properties.filter((member): member is E.ObjectProperty => {
      if (!isProperty(member)) {
        problem(member, `\`${path}\` spreads another object.`);
        return false;
      }
      if (member.kind !== 'init') {
        problem(member, `\`${path}.${keyText(member)}\` is a getter or setter.`);
        return false;
      }
      if (staticKey(member) === undefined) {
        problem(member, `\`${path}\` has a computed key.`);
        return false;
      }
      return true;
    });
  const objectOf = (node: Node, path: string) => {
    const object = objectValue(node);
    if (!object) {
      problem(node, `\`${path}\` is not an object literal, so its keys can't be read.`);
    }
    return object;
  };

  const root = objectOf(sveltekit, 'sveltekit_experimental');
  if (!root) {
    return mocks;
  }
  // A module-level `await` can't move into a `beforeEach` that isn't async
  walk(root, (node) => {
    if (isFunctionLiteral(node)) {
      return false;
    }
    if (node.type === 'AwaitExpression') {
      problem(
        node,
        'Awaits a value, which the `beforeEach` that the mocks move into would have to await.'
      );
    }
  });
  const members = membersOf(root, 'sveltekit_experimental');
  const state = members.find((member) => staticKey(member) === 'state');
  const stateKeys = new Set(
    (state && objectValue(state.value)?.properties.filter(isProperty).map(staticKey)) ?? []
  );

  for (const member of members) {
    const key = staticKey(member);
    const comments = commentsOf(root, member);
    if (key === 'state' || key === 'stores') {
      readState(member, key, comments);
    } else if (key === 'navigation') {
      readNavigation(member, comments);
    } else if (key === 'hrefs') {
      readHrefs(member, comments);
    } else if (key === 'forms') {
      readForms(member, comments);
    }
  }
  return mocks;

  function readState(member: E.ObjectProperty, key: 'state' | 'stores', comments: string) {
    const object = objectOf(member.value, key);
    if (!object) {
      return;
    }
    let first = comments;
    for (const entry of membersOf(object, key)) {
      const name = staticKey(entry);
      // `stores` mocked `$app/stores`, which SvelteKit 3 removed; `state` mocks what replaced it
      if (
        (name !== 'page' && name !== 'navigating' && name !== 'updated') ||
        (key === 'stores' && stateKeys.has(name))
      ) {
        continue;
      }
      const entryComments = first + commentsOf(object, entry);
      first = '';
      if (name === 'updated') {
        const value = detachedTextOf(entry.value);
        mocks.ops.push({
          kind: 'assign-all',
          object: 'updated',
          value: key === 'stores' ? `{ current: ${value} }` : value,
          comments: entryComments,
        });
        continue;
      }
      // `Object.assign()` replaces each property that the old parameters merged deeply
      const assignAll = (value: Node) => {
        if (canBePlainObject(value)) {
          const merged = [...context.outer.objects, ...context.outer.values].some((path) =>
            path.startsWith(`${name}.`)
          );
          if (merged) {
            problem(value, deepMergeMessage(`${key}.${name}`));
          }
          mocks.merged.values.push(`${name}.*`);
        }
      };
      const properties = objectValue(entry.value);
      if (!properties) {
        assignAll(entry.value);
        mocks.ops.push({
          kind: 'assign-all',
          object: name,
          value: detachedTextOf(entry.value),
          comments: entryComments,
        });
        continue;
      }
      let propertyComments = entryComments;
      for (const property of properties.properties) {
        const ownComments = propertyComments + commentsOf(properties, property);
        propertyComments = '';
        if (!isProperty(property)) {
          assignAll(property.argument);
          mocks.ops.push({
            kind: 'assign-all',
            object: name,
            value: detachedTextOf(property.argument),
            comments: ownComments,
          });
          continue;
        }
        const propertyKey = staticKey(property);
        if (property.kind !== 'init' || propertyKey === undefined) {
          problem(
            property,
            `\`${key}.${name}\` has a getter, a setter or a computed key, which assignments can't keep.`
          );
          continue;
        }
        if (isIdentifier(unwrapExpression(property.value), 'undefined')) {
          continue;
        }
        const path = `${name}.${propertyKey}`;
        mocks.merged.assigned.push(path);
        const isObject = !property.method && !!objectValue(property.value);
        if (!property.method && !property.shorthand) {
          checkDeepMerge(property.value, path);
        } else if (property.shorthand && mergesWith(context.outer, path)) {
          problem(property, deepMergeMessage(`${key}.${path}`));
        }
        if (!property.method) {
          recordMerged(mocks.merged, property.value, path);
        }
        mocks.ops.push({
          kind: 'assign',
          object: name,
          key: propertyKey,
          member: property,
          merge:
            isObject &&
            context.outer.objects.includes(path) &&
            !context.outer.replaced.includes(path),
          comments: ownComments,
        });
      }
    }
  }

  // Report a value that the old parameters merged with an outer one deeper than the `...page.data`
  // spread that the fix writes, so the outer one had something that the assignment loses: a value
  // that isn't an object literal, or a nested object that lacks a key of the outer one
  function checkDeepMerge(node: Node, path: string, top = true) {
    const { outer } = context;
    if (!mergesWith(outer, path) || outer.replaced.includes(path)) {
      return;
    }
    const object = objectValue(node);
    const opaque = holdsValue(outer, path);
    if (!object || opaque) {
      if (!object ? canBePlainObject(node) : true) {
        problem(node, deepMergeMessage(`state.${path}`));
      }
      return;
    }
    const keys = new Map<string, Node>();
    for (const member of object.properties) {
      const key = isProperty(member) && !member.method ? staticKey(member) : undefined;
      if (key === undefined) {
        // A spread or a method: the fix can't tell which keys it has
        problem(member, deepMergeMessage(`state.${path}`));
        return;
      }
      keys.set(key, (member as E.ObjectProperty).value);
    }
    const prefix = `${path}.`;
    const outerKeys = new Set(
      outer.assigned
        .filter((assigned) => assigned.startsWith(prefix))
        .map((assigned) => assigned.slice(prefix.length).split('.')[0])
    );
    // The top level is spread, which keeps the outer keys
    if (!top && [...outerKeys].some((key) => !keys.has(key))) {
      problem(node, deepMergeMessage(`state.${path}`));
      return;
    }
    for (const [key, value] of keys) {
      checkDeepMerge(value, `${prefix}${key}`, false);
    }
  }

  function readNavigation(member: E.ObjectProperty, comments: string) {
    const object = objectOf(member.value, 'navigation');
    if (!object) {
      return;
    }
    let first = comments;
    for (const entry of membersOf(object, 'navigation')) {
      const name = staticKey(entry)!;
      const entryComments = first + commentsOf(object, entry);
      first = '';
      if (name === 'afterNavigate') {
        if (context.outer.afterNavigate) {
          problem(
            entry,
            '`navigation.afterNavigate` is also set on a level around this one. The old parameters merged both objects, and `setAfterNavigate()` replaces the earlier call.'
          );
          continue;
        }
        mocks.merged.afterNavigate = true;
        mocks.ops.push({ kind: 'after-navigate', value: entry.value, comments: entryComments });
        continue;
      }
      if (!(NAVIGATION_FUNCTIONS as readonly string[]).includes(name)) {
        continue;
      }
      const fn = name as NavigationFunction;
      const value = unwrapExpression(entry.value);
      // The old parameters skipped `undefined`, so an outer level's value stayed
      if (!entry.method && isIdentifier(value, 'undefined')) {
        continue;
      }
      // A value that does nothing still replaced the implementation that a level around set
      const nothing = () => {
        if (context.outer.functions.includes(fn)) {
          mocks.ops.push({ kind: 'no-op', fn, comments: entryComments });
        }
      };
      const implement = (callback: Node, method: boolean) => {
        mocks.merged.functions.push(fn);
        mocks.ops.push({
          kind: 'implement',
          fn,
          callback,
          method,
          loose: isLoose(callback),
          arity: arityOf(callback),
          comments: entryComments,
        });
      };
      if (entry.method || isFunctionLiteral(value)) {
        if (doesNothing(value)) {
          nothing();
        } else {
          implement(value, entry.method);
        }
        continue;
      }
      if (isNotAFunction(value) || isSpyCall(value)) {
        nothing();
        continue;
      }
      const spy = isIdentifier(value, fn)
        ? spyDeclarator(value as E.IdentifierReference)
        : undefined;
      if (spy) {
        mocks.spies.push(spy);
        mocks.ops.push({ kind: 'import', fn, value, comments: entryComments });
        nothing();
        continue;
      }
      // The mock itself, imported by hand already: calling it from its implementation would recurse
      const imported =
        value.type === 'Identifier' ? context.importOf(value as E.IdentifierReference) : undefined;
      if (imported?.module === MOCK_EXPORTS[fn] && imported.name === fn) {
        nothing();
        continue;
      }
      implement(value, false);
    }
  }

  // `fn()` without an implementation, which the imported mock function already is
  function isSpyCall(node: Node) {
    const value = unwrapExpression(node);
    return (
      value.type === 'CallExpression' &&
      value.arguments.length === 0 &&
      value.callee.type === 'Identifier' &&
      context.isTestFn(value.callee)
    );
  }

  function spyDeclarator(identifier: E.IdentifierReference) {
    const declarator = context.moduleDeclarator(identifier);
    return declarator?.init && isSpyCall(declarator.init) ? declarator : undefined;
  }

  function readHrefs(member: E.ObjectProperty, comments: string) {
    const object = objectOf(member.value, 'hrefs');
    if (!object) {
      return;
    }
    if (context.outer.hrefs) {
      problem(
        member,
        '`hrefs` is also set on a level around this one. The old parameters merged both objects, and `link.mockImplementation()` replaces the earlier one.'
      );
      return;
    }
    mocks.merged.hrefs = true;
    const entries: LinkEntry[] = [];
    for (const entry of object.properties) {
      if (!isProperty(entry) || entry.kind !== 'init') {
        problem(entry, '`hrefs` has a spread, a getter or a setter.');
        continue;
      }
      const config = objectValue(entry.value);
      const base = { member: entry, comments: commentsOf(object, entry) };
      if (!config) {
        const callback = unwrapExpression(entry.value);
        const declarator =
          callback.type === 'Identifier'
            ? context.moduleDeclarator(callback as E.IdentifierReference)
            : undefined;
        if (declarator?.init && objectValue(declarator.init)) {
          problem(entry, `\`hrefs\` reads the config of \`${keyText(entry)}\` from a variable.`);
          continue;
        }
        if (!doesNothing(callback) && !isNotAFunction(callback)) {
          entries.push({
            ...base,
            regex: false,
            callback,
            method: entry.method,
            arity: arityOf(callback),
          });
        }
        continue;
      }
      const configMembers = membersOf(config, `hrefs[${JSON.stringify(keyText(entry))}]`);
      const asRegex = configMembers.find((option) => staticKey(option) === 'asRegex');
      const callback = configMembers.find((option) => staticKey(option) === 'callback');
      const regex = asRegex ? unwrapExpression(asRegex.value) : undefined;
      if (regex && !(regex.type === 'Literal' && typeof regex.value === 'boolean')) {
        problem(asRegex!, '`asRegex` is not `true` or `false`.');
        continue;
      }
      if (callback && !doesNothing(callback.value) && !isNotAFunction(callback.value)) {
        entries.push({
          ...base,
          regex: regex?.type === 'Literal' && regex.value === true,
          callback: unwrapExpression(callback.value),
          method: callback.method,
          arity: arityOf(callback.value),
        });
      }
    }
    if (entries.length > 0) {
      mocks.ops.push({ kind: 'links', entries, comments });
    }
  }

  function readForms(member: E.ObjectProperty, comments: string) {
    const object = objectOf(member.value, 'forms');
    if (!object) {
      return;
    }
    const enhance = membersOf(object, 'forms').find((entry) => staticKey(entry) === 'enhance');
    if (!enhance) {
      return;
    }
    const callback = unwrapExpression(enhance.value);
    if (!enhance.method && isIdentifier(callback, 'undefined')) {
      return;
    }
    const nothing = () => {
      if (context.outer.functions.includes('formAction')) {
        mocks.ops.push({ kind: 'no-op', fn: 'formAction', comments });
      }
    };
    if (enhance.method || isFunctionLiteral(callback)) {
      if (doesNothing(callback)) {
        nothing();
        return;
      }
      if ((callback as FunctionLiteral).params.length > 0) {
        problem(enhance, ENHANCE_READS_EVENT);
        return;
      }
    } else if (isNotAFunction(callback) || isSpyCall(callback)) {
      nothing();
      return;
    } else if ((functionOf(callback)?.params.length ?? 0) > 0) {
      problem(enhance, ENHANCE_READS_EVENT);
      return;
    }
    mocks.merged.functions.push('formAction');
    mocks.ops.push({
      kind: 'form-action',
      callback,
      method: enhance.method,
      comments: comments + commentsOf(object, enhance),
    });
  }
};

// Whether a level writes code that sets up the mocks: every op but the import that replaces a spy
// prints a statement, and `keepSpies` turns an import into a statement only when another op
// implements that function
export const writesMocks = (mocks: LevelMocks) => mocks.ops.some((op) => op.kind !== 'import');

// Keep the `const goto = fn()` spies of the functions that a level of the file or the preview gives
// an implementation: other code can call the spy, which the imported mock would run that
// implementation for. The level calls its spy instead.
export const keepSpies = (mocks: LevelMocks, implemented: ReadonlySet<string>) => {
  const kept = new Set<NavigationFunction>();
  mocks.ops = mocks.ops.flatMap((op): Op[] => {
    if (op.kind === 'import' && implemented.has(op.fn)) {
      kept.add(op.fn);
      return [
        {
          kind: 'implement',
          fn: op.fn,
          callback: op.value,
          method: false,
          loose: false,
          arity: undefined,
          comments: op.comments,
        },
      ];
    }
    // The reset that followed the import: the implementation replaces it
    return op.kind === 'no-op' && kept.has(op.fn as NavigationFunction) ? [] : [op];
  });
  mocks.spies = mocks.spies.filter(
    (spy) => !kept.has((spy.id as E.BindingIdentifier).name as NavigationFunction)
  );
  mocks.merged.functions.push(...kept);
};
