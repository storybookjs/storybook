// How a path of keys and indexes reaches a value in the object a `CsfObject` edits, and how a write
// creates the containers a path lacks.
import type { CsfMutationDiagnosticCode } from './CsfObject.ts';
import {
  type Access,
  carriedSpread,
  carriedSpreads,
  lookupElement,
  lookupMember,
} from './ObjectMembers.ts';
import {
  type ListRoot,
  type MemberInsert,
  type ObjectRoot,
  listRoot,
  literalRoot,
} from './ObjectRoot.ts';
import {
  type E,
  type Node,
  type Property,
  children,
  isNumericLiteral,
  isStringLiteral,
  staticKey,
  unwrapExpression,
} from './estree/ast.ts';
import { type SourceEditor, detachedSource, printKey, printObject } from './estree/editor.ts';
import { type Binding, constantInit } from './estree/scope.ts';
import { resolveExpression, valueSource } from './estree/values.ts';

/**
 * A path to a value: a string addresses a property of an object, a number an element of an array
 * or an argument of a call, by its position in the source.
 */
export type CsfPath = readonly (string | number)[];

/**
 * A path segment for every key of an object, as in `remove(['argTypes', anyKey, 'defaultValue'])`,
 * which removes `defaultValue` from each arg.
 */
export const anyKey = Symbol.for('storybook/csf-tools/anyKey') as AnyKey;

// Branded by its description, not declared `unique symbol`: the types of the source and of a
// build of it, which a check of the source can see both of, are then the same.
export type AnyKey = symbol & { readonly description: 'storybook/csf-tools/anyKey' };

const isAnyKey = (segment: unknown): segment is AnyKey => segment === anyKey;

/** A path that may hold `anyKey` segments. */
export type CsfPattern = readonly (string | number | AnyKey)[];

/** A pattern as a path, with `*` for each `anyKey`. */
export const patternPath = (pattern: CsfPattern): (string | number)[] =>
  pattern.map((segment) => (isAnyKey(segment) ? '*' : segment));

/** Print a path as `parameters.msw.handlers[0]`. */
export const printCsfPath = (path: CsfPattern) =>
  patternPath(path)
    .map((segment, index) =>
      typeof segment === 'number' ? `[${segment}]` : index === 0 ? segment : `.${segment}`
    )
    .join('');

// An index is a position in the source.
export const isInvalidIndex = (segment: string | number) =>
  typeof segment === 'number' && !(Number.isSafeInteger(segment) && segment >= 0);

// `__proto__` would set the prototype.
export const unsafePath = (path: CsfPath) =>
  path.some((segment) => segment === '__proto__' || isInvalidIndex(segment));

export const isKey = (segment: string | number): segment is string => typeof segment === 'string';

const invalidated = () => new Error('CsfObject mutation preflight was invalidated');

// A new array: its items go after the spread it carries forward, or before it when `first`.
type ArrayInsert = { items: string[]; first: boolean };

// Why a path or a write is refused; the message defaults to one for the code.
type Refusal = { ok: false; code: CsfMutationDiagnosticCode; node: Node; message?: string };

// Where a path ends: a property or an item, which is `null` for a hole, or the first segment the
// source lacks, a key at `missing` of the path or an item past the end of its list or at a hole
// before the last segment.
export type Located =
  | { ok: true; kind: 'property'; parent: ObjectRoot; key: string; property: Property }
  | { ok: true; kind: 'item'; parent: ListRoot; index: number; element: E.Expression | null }
  | { ok: true; kind: 'missing-key'; parent: ObjectRoot; missing: number }
  | { ok: true; kind: 'missing-item'; parent: ListRoot; index: number }
  | Refusal;

type Found = Extract<Located, { ok: true }>;

// The value at a property or an item, as `get` reads it: `node` is the property or the element,
// and `expression` the value to evaluate, which a method lacks.
export type Slot = { node: Property | E.Expression; source: string; expression?: Node };

// The next segment of a path with the container it addresses.
type Step =
  | { kind: 'object'; parent: ObjectRoot; key: string }
  | { kind: 'list'; parent: ListRoot; index: number };

// An array literal, or a call, also an optional one: `f?.(a)`.
const listNode = (value: Node | undefined) => {
  const node = value?.type === 'ChainExpression' ? value.expression : value;
  return node?.type === 'ArrayExpression' || node?.type === 'CallExpression' ? node : undefined;
};

// The list that `append` and `prepend` add to at the end of a path: an array literal, or, at a list
// item such as `['loaders', 0]` for `loaders: [mswLoader()]`, also a call, whose arguments are its
// items. A field is a list only when it holds an array literal: an argument added to a call such as
// `addons: base.filter(Boolean)` would change the call instead of adding an entry.
const addableList = (value: Node | undefined, last: string | number) => {
  const list = listNode(value);
  return list?.type === 'CallExpression' && isKey(last) ? undefined : list;
};

// A key addresses a property of an object literal, an index an element of an array or an
// argument of a call.
const stepInto = (
  editor: SourceEditor,
  value: Node | undefined,
  segment: string | number
): Step | undefined => {
  if (isKey(segment)) {
    return value?.type === 'ObjectExpression'
      ? { kind: 'object', parent: literalRoot(editor, value), key: segment }
      : undefined;
  }
  const list = listNode(value);
  return list && { kind: 'list', parent: listRoot(editor, list), index: segment };
};

export const valueAt = (editor: SourceEditor, located: Found): Slot | undefined => {
  if (located.kind === 'item' && located.element) {
    const { element } = located;
    return { node: element, source: detachedSource(editor, element), expression: element };
  }
  if (located.kind === 'property') {
    const { property } = located;
    return {
      node: property,
      source: valueSource(editor, property),
      ...(property.method ? {} : { expression: property.value }),
    };
  }
  return undefined;
};

// `access` applies to the last field of the path, and to its parents for a `set`, which creates
// missing ones; other parents are read. Only a lookup for a read follows a shared constant.
export const locate = (
  editor: SourceEditor,
  root: ObjectRoot,
  path: CsfPath,
  access: Access = 'read',
  edits = true
): Located => {
  const [first] = path;
  if (typeof first !== 'string') {
    return { ok: false, code: 'unsupported-member', node: editor.program };
  }
  let step: Step = { kind: 'object', parent: root, key: first };

  for (let index = 0; ; index++) {
    const last = index === path.length - 1;
    let value: Node;
    if (step.kind === 'list') {
      const { parent, index: position } = step;
      const lookup = lookupElement(parent.items, position);
      if (lookup.ok === false) {
        return lookup;
      }
      const { element } = lookup;
      if (last && element !== undefined) {
        return { ok: true, kind: 'item', parent, index: position, element };
      }
      if (!element) {
        return { ok: true, kind: 'missing-item', parent, index: position };
      }
      value = element;
    } else {
      const { parent, key } = step;
      const lookup = lookupMember(
        editor,
        parent.properties,
        key,
        last || access === 'set' ? access : 'read'
      );
      if (lookup.ok === false) {
        return lookup;
      }
      const { property } = lookup;
      if (!property) {
        return { ok: true, kind: 'missing-key', parent, missing: index };
      }
      if (last) {
        return { ok: true, kind: 'property', parent, key, property };
      }
      if (property.method) {
        return { ok: false, code: 'unsupported-member', node: property };
      }
      value = property.value;
    }
    const resolved = resolveExpression(editor.scopes, value, edits ? 'write' : 'read');
    const next = stepInto(editor, resolved, path[index + 1]);
    if (!next) {
      return { ok: false, code: 'unsupported-member', node: value };
    }
    step = next;
  }
};

// `anyKey` also stands for a member read whose key only running code knows, such as `types[key]`.
type ShownPath = CsfPattern;

// The bindings being followed, where a cycle stops, and the paths each binding does not show, so
// a constant spread twice is followed once. A miss found after stopping at a cycle is not kept,
// as the binding it stopped at may still show the path.
interface Visits {
  following: Set<Node>;
  misses: Map<Node, Set<string>>;
  cycles: number;
}

const visits = (): Visits => ({ following: new Set(), misses: new Map(), cycles: 0 });

const pathKey = (path: ShownPath) =>
  path.map((segment) => (segment === anyKey ? '*' : JSON.stringify(segment))).join('.');

// Whether the source shows a value at `path` below `properties`, through spreads, local constants,
// member reads and call arguments. A value from another module, or one only running code could
// build, is out of sight. An index is always in sight: positions are not followed.
export const showsPath = (
  editor: SourceEditor,
  properties: readonly E.ObjectPropertyKind[],
  path: CsfPattern
): boolean => showsMembers(editor, properties, path, visits());

/** Whether the source shows a value at `path` below the value `node`, as `showsPath` does. */
export const showsPathIn = (editor: SourceEditor, node: Node, path: CsfPattern): boolean =>
  path.length === 0 || showsValue(editor, node, path, visits());

const showsMembers = (
  editor: SourceEditor,
  properties: readonly E.ObjectPropertyKind[],
  path: ShownPath,
  seen: Visits
): boolean => {
  const [segment, ...rest] = path;
  if (typeof segment === 'number') {
    return true;
  }
  return properties.some((member) => {
    if (member.type === 'SpreadElement') {
      return showsValue(editor, member.argument, path, seen);
    }
    const key = staticKey(member);
    if (key !== undefined && segment !== anyKey && key !== segment) {
      return false;
    }
    return rest.length === 0 || showsValue(editor, member.value, rest, seen);
  });
};

// The key a member read such as `types.label` or `types['label']` reads.
const memberKey = (member: E.MemberExpression): string | AnyKey => {
  const property = member.property as Node;
  if (!member.computed) {
    return property.type === 'Identifier' ? property.name : anyKey;
  }
  if (isStringLiteral(property)) {
    return property.value;
  }
  if (isNumericLiteral(property)) {
    return String(property.value);
  }
  if (property.type === 'TemplateLiteral' && property.expressions.length === 0) {
    return property.quasis[0]?.value.cooked ?? anyKey;
  }
  return anyKey;
};

const showsValue = (
  editor: SourceEditor,
  node: Node | undefined,
  path: ShownPath,
  seen: Visits
): boolean => {
  const value = unwrapExpression(node);
  if (!value) {
    return false;
  }
  if (typeof path[0] === 'number') {
    return true;
  }
  if (value.type === 'ObjectExpression') {
    return showsMembers(editor, value.properties, path, seen);
  }
  const [segment, ...rest] = path;
  if (value.type === 'ArrayExpression' && (isAnyKey(segment) || /^\d+$/.test(segment))) {
    return value.elements.some(
      (element) =>
        !!element &&
        (rest.length === 0 ||
          (element.type === 'SpreadElement'
            ? showsValue(editor, element.argument, [anyKey, ...rest], seen)
            : showsValue(editor, element, rest, seen)))
    );
  }
  if (value.type === 'MemberExpression') {
    return showsValue(editor, value.object, [memberKey(value), ...path], seen);
  }
  if (value.type === 'Identifier') {
    return showsBinding(editor, editor.scopes.bindingOf(value), path, seen);
  }
  if (value.type === 'ClassBody') {
    return value.body.some((member) => {
      if (!('key' in member)) {
        return showsValue(editor, member, path, seen);
      }
      const key = member.key as Node;
      const name =
        !member.computed && key.type === 'Identifier'
          ? key.name
          : isStringLiteral(key)
            ? key.value
            : undefined;
      // A constructor can assign any field, as in `this.label = value`.
      const reads =
        name === undefined ||
        segment === anyKey ||
        name === segment ||
        (member.type === 'MethodDefinition' && member.kind === 'constructor');
      return (
        reads && (rest.length === 0 || showsValue(editor, member.value ?? undefined, rest, seen))
      );
    });
  }
  // A method can return its receiver or part of it, as in `list.at(0)`.
  const callee = value.type === 'CallExpression' ? unwrapExpression(value.callee) : undefined;
  if (callee?.type === 'MemberExpression' && showsValue(editor, callee.object, path, seen)) {
    return true;
  }
  return children(value, { skipTypes: true }).some((child) =>
    showsValue(editor, child, path, seen)
  );
};

// An import or a global is out of sight, and a parameter is checked where a call passes it. A
// function or class is followed into its body. Any other local value that the source does not
// declare as one constant expression, or writes through after it, may hold anything.
const showsBinding = (
  editor: SourceEditor,
  binding: Binding | undefined,
  path: ShownPath,
  seen: Visits
): boolean => {
  if (!binding || binding.kind === 'import' || binding.kind === 'param') {
    return false;
  }
  const key = pathKey(path);
  if (seen.misses.get(binding.node)?.has(key)) {
    return false;
  }
  if (seen.following.has(binding.node)) {
    seen.cycles++;
    return false;
  }
  const { cycles } = seen;
  seen.following.add(binding.node);
  let shown: boolean;
  try {
    shown = followBinding(editor, binding, path, seen);
  } finally {
    seen.following.delete(binding.node);
  }
  if (!shown && seen.cycles === cycles) {
    const misses = seen.misses.get(binding.node) ?? new Set();
    seen.misses.set(binding.node, misses.add(key));
  }
  return shown;
};

const followBinding = (
  editor: SourceEditor,
  binding: Binding,
  path: ShownPath,
  seen: Visits
): boolean => {
  if (binding.kind === 'function' || binding.kind === 'class') {
    return showsValue(editor, binding.node, path, seen);
  }
  if (writtenThrough(editor, binding)) {
    return true;
  }
  const init = constantInit(binding);
  if (init) {
    return showsValue(editor, init, path, seen);
  }
  if (!binding.constant && binding.identifier === (binding.node as E.VariableDeclarator).id) {
    return showsAssigned(editor, binding, path, seen);
  }
  return showsDestructured(editor, binding, path, seen);
};

// A variable written after its declaration, as in `let selected = false; selected = true`, holds
// its initializer or a value assigned to it. One written another way may hold anything.
const showsAssigned = (
  editor: SourceEditor,
  binding: Binding,
  path: ShownPath,
  seen: Visits
): boolean => {
  const values: (Node | null | undefined)[] = [(binding.node as E.VariableDeclarator).init];
  for (const reference of binding.references) {
    const parent = editor.parentOf(reference);
    if (parent?.type === 'AssignmentExpression' && parent.left === reference) {
      values.push(parent.right);
    } else if (
      parent?.type !== 'UpdateExpression' &&
      (parent?.type?.endsWith('Pattern') || parent?.type === 'RestElement')
    ) {
      return true;
    }
  }
  return values.some((value) => showsValue(editor, value ?? undefined, path, seen));
};

// A name a constant pattern declares, as `dir` in `const { dir } = ATTRIBUTES`, reads its path in
// the declarator's value, or a default in the pattern. Any other may hold anything.
const showsDestructured = (
  editor: SourceEditor,
  binding: Binding,
  path: ShownPath,
  seen: Visits
): boolean => {
  const declarator = binding.node;
  if (!binding.constant || declarator.type !== 'VariableDeclarator' || !declarator.init) {
    return true;
  }
  let keys: ShownPath = path;
  let rest = false;
  for (let node: Node = binding.identifier; node !== declarator.id;) {
    const parent = editor.parentOf(node);
    if (!parent) {
      return true;
    }
    if (parent.type === 'AssignmentPattern') {
      if (parent.left === node && showsValue(editor, parent.right, keys, seen)) {
        return true;
      }
    } else if (parent.type === 'Property') {
      keys = [staticKey(parent) ?? anyKey, ...keys];
    } else if (parent.type === 'RestElement') {
      // `...rest` holds the members or elements of the value itself.
      rest = true;
    } else if (parent.type === 'ArrayPattern') {
      keys = rest ? keys : [anyKey, ...keys];
      rest = false;
    } else if (parent.type === 'ObjectPattern') {
      rest = false;
    } else {
      return true;
    }
    node = parent;
  }
  return showsValue(editor, declarator.init, keys, seen);
};

// Whether the source changes a constant's value through it, as in `base.label = value`,
// `delete base.label` or `Object.assign(base, value)`.
const writtenThrough = (editor: SourceEditor, binding: Binding) =>
  binding.references.some((reference) => {
    let target: Node = reference;
    let parent = editor.parentOf(target);
    while (parent?.type === 'MemberExpression' && parent.object === target) {
      target = parent;
      parent = editor.parentOf(target);
    }
    if (parent?.type === 'CallExpression' && parent.arguments[0] === target) {
      const callee = unwrapExpression(parent.callee);
      return (
        callee.type === 'MemberExpression' &&
        callee.object.type === 'Identifier' &&
        callee.object.name === 'Object' &&
        memberKey(callee) === 'assign'
      );
    }
    return (
      target !== reference &&
      ((parent?.type === 'AssignmentExpression' && parent.left === target) ||
        parent?.type === 'UpdateExpression' ||
        (parent?.type === 'UnaryExpression' && parent.operator === 'delete'))
    );
  });

// Why `parent` refuses a new member `key`, such as a function story's `name`.
export const refusedKey = (
  editor: SourceEditor,
  parent: ObjectRoot,
  key: string
): Refusal | undefined => {
  const message = parent.refuseKey?.(key);
  return message
    ? { ok: false, code: 'unsupported-member', node: editor.program, message }
    : undefined;
};

// Whether a write can create the value a path lacks. Missing values are created only at keys: a
// position is in the source or nowhere, and a hole is no value to add to. `carry` tells when the
// first key to create carries the spreads before it forward: always, or when the write creates its
// parents too.
export const creatable = (
  editor: SourceEditor,
  located: Found,
  path: CsfPath,
  carry: 'when-creating-parents' | 'always'
): { ok: true; keys: readonly string[] } | Refusal => {
  const keys = located.kind === 'missing-key' ? path.slice(located.missing) : [];
  if (located.kind !== 'missing-key' || !keys.every(isKey)) {
    return {
      ok: false,
      code: 'unsupported-member',
      node: located.parent.node ?? editor.program,
      message: `Cannot create ${printCsfPath(path)}: an index addresses an element or argument that exists, and append or prepend adds one`,
    };
  }
  const refused = refusedKey(editor, located.parent, keys[0]);
  if (refused) {
    return refused;
  }
  if (carry === 'always' || (carry === 'when-creating-parents' && keys.length > 1)) {
    const carried = carriedSpreads(editor, located.parent.properties, keys[0]);
    if (carried.ok === false) {
      return carried;
    }
  }
  return { ok: true, keys };
};

// The list `append` and `prepend` add to at the end of a path, `missing` when they create it, or why
// they refuse it.
export const listAt = (
  editor: SourceEditor,
  root: ObjectRoot,
  path: CsfPath
):
  | { ok: true; kind: 'list'; list: E.ArrayExpression | E.CallExpression }
  | { ok: true; kind: 'missing' }
  | Refusal => {
  if (path.length === 0 || unsafePath(path)) {
    return { ok: false, code: 'unsupported-member', node: editor.program };
  }
  const located = locate(editor, root, path, 'set');
  if (located.ok === false) {
    return located;
  }
  const slot = valueAt(editor, located);
  if (!slot) {
    const creation = creatable(editor, located, path, 'always');
    return creation.ok ? { ok: true, kind: 'missing' } : creation;
  }
  const { scopes } = editor;
  const last = path[path.length - 1];
  const resolved = slot.expression && resolveExpression(scopes, slot.expression);
  const list = addableList(resolved, last);
  if (list) {
    return { ok: true, kind: 'list', list };
  }
  const node = slot.expression ?? slot.node;
  const shared =
    slot.expression && addableList(resolveExpression(scopes, slot.expression, 'read'), last);
  return {
    ok: false,
    code: 'unsupported-value',
    node,
    message: shared
      ? `Cannot edit '${printCsfPath(path)}' because it is a constant that other code refers to as well`
      : `Expected an array literal${isKey(last) ? '' : ' or a call'} at '${printCsfPath(path)}', got '${(resolved ?? node).type}'`,
  };
};

// Writes the missing containers at `missing` into `parent`, the first one a member of it, which
// carry the spreads before them forward.
const createContainers = (
  editor: SourceEditor,
  parent: ObjectRoot,
  missing: CsfPath,
  content: { members: MemberInsert[] } | ArrayInsert
) => {
  const { quote, indent } = editor;
  if (!missing.every(isKey)) {
    throw invalidated();
  }
  const [name] = missing;
  const carried = carriedSpreads(editor, parent.properties, name);
  if (carried.ok === false) {
    throw invalidated();
  }
  const texts = 'members' in content ? content.members.map((member) => member.text) : content.items;
  const forward = (depth: number, into: 'object' | 'array' = 'object') => {
    const spread = carriedSpread(carried.spread, missing.slice(0, depth + 1), quote, into);
    return spread ? [spread] : [];
  };
  const last = missing.length - 1;
  let nested: string;
  // Comments travel with moved members; a line comment makes the object span lines.
  if ('members' in content) {
    nested = printObject([...forward(last), ...texts], indent);
  } else {
    const spread = forward(last, 'array');
    nested = `[${(content.first ? [...texts, ...spread] : [...spread, ...texts]).join(', ')}]`;
  }
  for (let depth = last - 1; depth >= 0; depth--) {
    nested = printObject(
      [...forward(depth), `${printKey(missing[depth + 1], quote)}: ${nested}`],
      indent
    );
  }
  parent.append([{ key: name, value: nested, text: `${printKey(name, quote)}: ${nested}` }]);
};

// Writes `content` into the object at `containers`, creating the missing ones, which carry the
// spreads before them forward; the last one is an array for `items`. The caller has validated it.
export const insertAt = (
  editor: SourceEditor,
  root: ObjectRoot,
  containers: CsfPath,
  content: { members: MemberInsert[] } | ArrayInsert
) => {
  let object: ObjectRoot | undefined = containers.length === 0 ? root : undefined;
  if (!object) {
    const located = locate(editor, root, containers, 'set');
    if (located.ok && located.kind === 'missing-key') {
      createContainers(editor, located.parent, containers.slice(located.missing), content);
      return;
    }
    const slot = located.ok ? valueAt(editor, located) : undefined;
    const value = slot?.expression && resolveExpression(editor.scopes, slot.expression);
    object = value?.type === 'ObjectExpression' ? literalRoot(editor, value) : undefined;
  }
  if (!object || !('members' in content)) {
    throw invalidated();
  }
  object.append(content.members);
};
