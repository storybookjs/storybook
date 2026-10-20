// The object a `CsfObject` edits: an object literal, or members written as separate statements.
import type { E, Property, Span } from './estree/ast.ts';
import {
  type SourceEditor,
  appendMembers,
  appendToList,
  argumentList,
  arrayList,
  groupMembers,
  lineIndent,
  prependMembers,
  prependToList,
  printKey,
  reindent,
  removeFromList,
  removeMembers,
  renameKey,
  renamedMemberText,
  replaceSpan,
  replaceValue,
} from './estree/editor.ts';
import { placeableValueSource } from './estree/values.ts';

// `text` is the whole member, including its leading comments.
export interface MemberInsert {
  key: string;
  value: string;
  text: string;
}

// Object literals edit their braces; a config made of named exports edits export declarations.
export interface ObjectRoot {
  readonly properties: readonly E.ObjectPropertyKind[];
  readonly detached: boolean;
  // The object literal itself, when the root is one.
  readonly node?: E.ObjectExpression;
  append(members: MemberInsert[]): void;
  prepend(members: MemberInsert[]): void;
  remove(members: Property[]): void;
  replaceValue(member: Property, text: string): void;
  // `key` is the raw property name.
  rename(member: Property, key: string): void;
  // Replaces contiguous members with `key: { ...members }`.
  group(members: Property[], key: string): void;
  // The member as text to insert elsewhere under another key.
  take(member: Property, key: string): MemberInsert;
  // Why the root cannot take a new member named `key`, when it cannot.
  refuseKey?(key: string): string | undefined;
}

// A member of an `ObjectRoot` that is not written as one, such as a named export or a
// `Story.name = value` assignment. Its key and value are nodes of the file, so every span read from
// it is real; the member itself only exists in memory, spanning `statement`.
export const detachedMember = (
  key: Property['key'],
  value: Property['value'],
  computed: boolean,
  statement: Span
): Property => ({
  type: 'Property',
  kind: 'init',
  method: false,
  shorthand: false,
  computed,
  key,
  value,
  start: statement.start,
  end: statement.end,
});

export const literalRoot = (editor: SourceEditor, object: E.ObjectExpression): ObjectRoot => ({
  properties: object.properties,
  detached: false,
  node: object,
  append: (members) =>
    appendMembers(
      editor,
      object,
      members.map((member) => member.text)
    ),
  prepend: (members) =>
    prependMembers(
      editor,
      object,
      members.map((member) => member.text)
    ),
  remove: (members) => removeMembers(editor, object, members),
  replaceValue: (member, text) => replaceValue(editor, member, text),
  rename: (member, key) => renameKey(editor, member, printKey(key, editor.quote)),
  group: (members, key) => groupMembers(editor, object, members, key),
  take: (member, key) => ({
    key,
    value: placeableValueSource(editor, member),
    text: renamedMemberText(editor, object, member, printKey(key, editor.quote)),
  }),
});

// The elements of an array or the arguments of a call, by their position in the source.
export interface ListRoot {
  readonly node: E.ArrayExpression | E.CallExpression;
  // `null` is a hole.
  readonly items: readonly (E.Expression | E.SpreadElement | null)[];
  append(texts: string[]): void;
  prepend(texts: string[]): void;
  remove(index: number): void;
  replace(index: number, text: string): void;
}

export type Container = ObjectRoot | ListRoot;

export const isListRoot = (container: Container): container is ListRoot => 'items' in container;

export const listRoot = (
  editor: SourceEditor,
  node: E.ArrayExpression | E.CallExpression
): ListRoot => {
  const list = () =>
    node.type === 'ArrayExpression' ? arrayList(editor, node) : argumentList(editor, node);
  return {
    node,
    items: node.type === 'ArrayExpression' ? node.elements : node.arguments,
    append: (texts) => appendToList(editor, list(), texts),
    prepend: (texts) => prependToList(editor, list(), texts),
    remove: (index) => {
      const current = list();
      removeFromList(editor, current, [current.items[index]]);
    },
    replace: (index, text) => {
      const span = list().items[index];
      replaceSpan(editor, span, reindent(text, '', lineIndent(editor.code, span.start)));
    },
  };
};
