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

// A spread a parent created after it carries forward, with the object literal of the local
// constant it spreads, whose own members are known.
type CarriedSpread = { source: string; literal: E.ObjectExpression | undefined };

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

export const carriedSpreads = (
  editor: SourceEditor,
  properties: readonly E.ObjectPropertyKind[]
):
  | { ok: true; spreads: CarriedSpread[] }
  | { ok: false; code: CsfMutationDiagnosticCode; node: Node } => {
  const spreads: CarriedSpread[] = [];
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
    // A type assertion stays, so the carried member has the type the spread was given.
    const source = editor.source(member.argument);
    spreads.push({
      source: reference === member.argument ? source : `(${source})`,
      literal: init?.type === 'ObjectExpression' ? init : undefined,
    });
  }
  return { ok: true, spreads };
};

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

// The spread that writes the member at `keys` of `spreads` into a new object or array, or
// `undefined` when none can have it. The last spread that may have the first key wins, earlier ones
// follow after `??` in case it lacks it; a local literal known to have it ends that list, and one
// known to lack it is skipped. A member below a spread's own is read with `?.`, unless it is read
// from an object literal: only the literal's own members are known, as a copy of it shares the
// objects it holds, through which code can change them.
export const carriedSpread = (
  spreads: readonly CarriedSpread[],
  keys: readonly string[],
  quote: string,
  into: 'object' | 'array'
) => {
  const spreadOf = (expression: string, alternatives = false) =>
    into === 'array'
      ? `...(${expression} ?? [])`
      : `...${alternatives ? `(${expression})` : expression}`;
  const [first, ...rest] = keys;
  const candidates: { expression: string; object: boolean }[] = [];
  for (const spread of [...spreads].reverse()) {
    const member = spread.literal ? literalMember(spread.literal, first) : undefined;
    if (member?.kind === 'missing') {
      continue;
    }
    candidates.push({
      expression: `${spread.source}${printMemberAccess(first, quote)}`,
      object: member?.kind === 'value' && member.object,
    });
    if (member?.kind === 'value') {
      break;
    }
  }
  if (candidates.length === 0) {
    return undefined;
  }
  if (candidates.length > 1) {
    const either = candidates.map(({ expression }) => expression).join(' ?? ');
    return rest.length === 0
      ? spreadOf(either, true)
      : spreadOf(`(${either})${rest.map((key) => printMemberAccess(key, quote, true)).join('')}`);
  }
  const [{ expression, object }] = candidates;
  return spreadOf(
    expression +
      rest.map((key, index) => printMemberAccess(key, quote, index > 0 || !object)).join('')
  );
};
