// Which member of an object literal a key statically reads, and the spreads that carry it into a new
// object.
import type { CsfMutationDiagnosticCode } from './CsfObject.ts';
import {
  type E,
  type Node,
  type Property,
  isTSWrapper,
  staticKey,
  unwrapExpression,
} from './estree/ast.ts';
import { type SourceEditor, printMemberAccess } from './estree/editor.ts';
import type { Binding } from './estree/scope.ts';

type PropertyLookup =
  | { ok: true; property?: Property }
  | { ok: false; code: CsfMutationDiagnosticCode; node: Node };

// A `set` appends a missing field after every member, so it overrides what they could provide;
// a removal could reveal what an earlier member provides.
export type Access = 'read' | 'set' | 'remove';

export const lookupProperty = (
  properties: readonly E.ObjectPropertyKind[],
  name: string,
  access: Access = 'read'
): PropertyLookup => {
  const matches: Property[] = [];
  let unknown: { code: CsfMutationDiagnosticCode; node: Node } | undefined;
  let unknownAfterMatch: { code: CsfMutationDiagnosticCode; node: Node } | undefined;

  for (const member of properties) {
    const key = member.type === 'SpreadElement' ? undefined : staticKey(member);
    if (key === undefined) {
      unknown = {
        code: member.type === 'SpreadElement' ? 'spread-field' : 'dynamic-key',
        node: member,
      };
      if (matches.length > 0) {
        unknownAfterMatch = unknown;
      }
      continue;
    }
    if (key !== name) {
      continue;
    }
    if (member.type !== 'Property' || member.kind !== 'init') {
      return { ok: false, code: 'unsupported-member', node: member };
    }
    matches.push(member);
  }

  if (matches.length > 1) {
    return { ok: false, code: 'duplicate-field', node: matches[1] };
  }
  // A member whose key is only known at runtime cannot shadow an explicit property declared after
  // it, but it can shadow one declared before it, and with no explicit property at all it leaves
  // both the value and its absence unproven.
  const unproven =
    unknownAfterMatch ??
    (access === 'remove' || (access === 'read' && matches.length === 0) ? unknown : undefined);
  if (unproven) {
    return { ok: false, code: unproven.code, node: unproven.node };
  }
  return { ok: true, property: matches[0] };
};

// The spread a parent created after it carries forward, read at the parent's key, and whether
// that member is known to be an object literal.
type CarriedSpread = { source: string; object: boolean };

// A reference reads the same value when it is read again.
const isReference = (node: Node): boolean =>
  node.type === 'Identifier' ||
  (node.type === 'MemberExpression' &&
    !node.computed &&
    !node.optional &&
    node.property.type === 'Identifier' &&
    isReference(node.object));

// Whether `user` writes to `target`, the binding or a member path of it.
const writes = (editor: SourceEditor, user: Node, target: Node) =>
  ((user.type === 'AssignmentExpression' ||
    user.type === 'AssignmentPattern' ||
    user.type === 'ForInStatement' ||
    user.type === 'ForOfStatement') &&
    user.left === target) ||
  user.type === 'UpdateExpression' ||
  (user.type === 'UnaryExpression' && user.operator === 'delete') ||
  user.type === 'ArrayPattern' ||
  user.type === 'RestElement' ||
  (user.type === 'Property' && editor.parentOf(user)?.type === 'ObjectPattern');

// Code that only reads a binding cannot change which members its literal has. A member read, even
// one that is called, is a read; the binding itself escaping, such as into `Object.assign`, is not.
const onlyRead = (editor: SourceEditor, binding: Binding) =>
  binding.references.every((reference) => {
    if (reference.type !== 'Identifier') {
      return reference.type === 'ExportNamedDeclaration';
    }
    let read: Node = reference;
    let member = false;
    for (let next = editor.parentOf(read); next; next = editor.parentOf(read)) {
      if (
        (next.type === 'MemberExpression' && next.object === read) ||
        (next.type === 'TSQualifiedName' && next.left === read)
      ) {
        member = true;
      } else if (
        !isTSWrapper(next) &&
        next.type !== 'ParenthesizedExpression' &&
        next.type !== 'ChainExpression'
      ) {
        break;
      }
      read = next;
    }
    const user = editor.parentOf(read);
    if (!user) {
      return false;
    }
    switch (user.type) {
      case 'SpreadElement':
      case 'JSXSpreadAttribute':
      case 'TSTypeQuery':
        return true;
      case 'ExportSpecifier':
        return read === reference;
      default:
        return member && !writes(editor, user, read);
    }
  });

// What an object literal is known to hold at `key`: no member, a value that may be an object
// literal, or unknown.
const literalMember = (literal: E.ObjectExpression, key: string) => {
  const lookup = lookupProperty(literal.properties, key);
  if (!lookup.ok || lookup.property?.method) {
    return { kind: 'unknown' as const };
  }
  if (!lookup.property) {
    return { kind: 'missing' as const };
  }
  const value = unwrapExpression(lookup.property.value);
  return { kind: 'value' as const, object: value.type === 'ObjectExpression' };
};

// The spread among `properties` whose member `key` a new parent at `key` carries forward: the last
// one that may have it, skipping a local literal known to lack it. When two may have it, which one
// does depends on own `undefined` members, so that is refused.
export const carriedSpreads = (
  editor: SourceEditor,
  properties: readonly E.ObjectPropertyKind[],
  key: string
):
  | { ok: true; spread: CarriedSpread | undefined }
  | { ok: false; code: CsfMutationDiagnosticCode; node: Node } => {
  // The spreads that may provide `key`, since the last one known to.
  let candidates: { spread: CarriedSpread; node: Node }[] = [];
  for (const member of properties) {
    if (member.type !== 'SpreadElement') {
      if (staticKey(member) === undefined) {
        return { ok: false, code: 'dynamic-key', node: member };
      }
      continue;
    }
    const reference = unwrapExpression(member.argument);
    if (!isReference(reference)) {
      return { ok: false, code: 'spread-field', node: member };
    }
    const binding =
      reference.type === 'Identifier' ? editor.scopes.bindingOf(reference) : undefined;
    const init =
      binding?.constant && binding.node.type === 'VariableDeclarator' && onlyRead(editor, binding)
        ? unwrapExpression(binding.node.init)
        : undefined;
    const known = init?.type === 'ObjectExpression' ? literalMember(init, key) : undefined;
    if (known?.kind === 'missing') {
      continue;
    }
    // A type assertion stays, so the carried member has the type the spread was given.
    const source = editor.source(member.argument);
    const candidate = {
      spread: {
        source: reference === member.argument ? source : `(${source})`,
        object: known?.kind === 'value' && known.object,
      },
      node: member,
    };
    candidates = known?.kind === 'value' ? [candidate] : [...candidates, candidate];
  }
  if (candidates.length > 1) {
    return { ok: false, code: 'spread-field', node: candidates.at(-1)!.node };
  }
  return { ok: true, spread: candidates[0]?.spread };
};

// The spread that writes the member at `keys` of `spread`, the one `carriedSpreads` chose for the
// first key, into a new object or array. A member below the spread's own is read with `?.`, unless
// it is read from an object literal: only the literal's own members are known, as a copy of it
// shares the objects it holds, through which code can change them.
export const carriedSpread = (
  spread: CarriedSpread | undefined,
  keys: readonly string[],
  quote: string,
  into: 'object' | 'array'
) => {
  if (!spread) {
    return undefined;
  }
  const [first, ...rest] = keys;
  const expression =
    spread.source +
    printMemberAccess(first, quote) +
    rest.map((key, index) => printMemberAccess(key, quote, index > 0 || !spread.object)).join('');
  return into === 'array' ? `...(${expression} ?? [])` : `...${expression}`;
};
