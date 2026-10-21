// How a path of keys and indexes reaches a value in the object a `CsfObject` edits, and how a write
// creates the containers a path lacks.
import type { CsfMutationDiagnosticCode } from './CsfObject.ts';
import {
  type Access,
  carriedSpread,
  carriedSpreads,
  lookupElement,
  lookupProperty,
} from './ObjectMembers.ts';
import {
  type ListRoot,
  type MemberInsert,
  type ObjectRoot,
  listRoot,
  literalRoot,
} from './ObjectRoot.ts';
import type { E, Node, Property } from './estree/ast.ts';
import { type SourceEditor, detachedSource, printKey, printObject } from './estree/editor.ts';
import { resolveExpression, valueSource } from './estree/values.ts';

/**
 * A path to a value: a string addresses a property of an object, a number an element of an array
 * or an argument of a call, by its position in the source.
 */
export type CsfPath = readonly (string | number)[];

/** Print a path as `parameters.msw.handlers[0]`. */
export const printCsfPath = (path: CsfPath) =>
  path
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
export type Refusal = { ok: false; code: CsfMutationDiagnosticCode; node: Node; message?: string };

// Where a path ends: a property or an item, which is `null` for a hole, or the first segment the
// source lacks, a key at `missing` of the path or an item past the end of its list or at a hole
// before the last segment.
export type Located =
  | { ok: true; kind: 'property'; parent: ObjectRoot; key: string; property: Property }
  | { ok: true; kind: 'item'; parent: ListRoot; index: number; element: E.Expression | null }
  | { ok: true; kind: 'missing-key'; parent: ObjectRoot; missing: number }
  | { ok: true; kind: 'missing-item'; parent: ListRoot; index: number }
  | Refusal;

export type Found = Extract<Located, { ok: true }>;

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
export const addableList = (value: Node | undefined, last: string | number) => {
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
      const lookup = lookupProperty(
        parent.properties,
        key,
        last || access === 'set' ? access : 'read',
        editor
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

// Whether a write can create the value a path lacks. Missing values are created only at keys: a
// position is in the source or nowhere, and a hole is no value to add to. `carry` tells when the
// first key to create carries the spreads before it forward: when the write creates its parents
// too, always, or never.
export const creatable = (
  editor: SourceEditor,
  located: Found,
  path: CsfPath,
  carry: 'when-creating-parents' | 'always' | 'never'
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
  const refusal = located.parent.refuseKey?.(keys[0]);
  if (refusal) {
    return { ok: false, code: 'unsupported-member', node: editor.program, message: refusal };
  }
  if (carry === 'always' || (carry === 'when-creating-parents' && keys.length > 1)) {
    const carried = carriedSpreads(editor, located.parent.properties, keys[0]);
    if (carried.ok === false) {
      return carried;
    }
  }
  return { ok: true, keys };
};

// Writes the missing containers at `missing` into `parent`, the first one a member of it, which
// carry the spreads before them forward.
export const createContainers = (
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
