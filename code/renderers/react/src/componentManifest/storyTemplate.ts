import {
  type ESTree as E,
  type ESTreeNode as Node,
  type FunctionNode,
  type SourceEditor,
  isOperand,
  walk,
} from 'storybook/internal/csf-tools';
import { asOperand, defaultWord, hole, holeWord, isHoleWord } from 'storybook/internal/docs-tools';

interface Edit {
  start: number;
  end: number;
  text: string;
}

/**
 * The story as written in `editor`, with a hole wherever it reads an arg, for `fillTemplate`. It is
 * `undefined` when the story reads no arg, or reads one in a way no hole stands for, such as passing
 * them along whole, and the template is the printed snippet instead. `args` holds the node each
 * arg is written with, which decides where its code needs parentheses; see `isOperand`.
 */
export function buildStoryTemplate(
  storyName: string,
  fn: FunctionNode,
  editor: SourceEditor,
  args: Record<string, Node> = {}
): string | undefined {
  const { params, body } = fn;
  if (params.length !== 1 || !body) {
    return undefined;
  }
  const { code } = editor;
  const edits = argEdits(fn, params[0] as Node, editor, args);
  if (!edits || edits.length === 0) {
    return undefined;
  }
  const column = body.start - (code.lastIndexOf('\n', body.start - 1) + 1);
  const print = (wrap: boolean) =>
    applyEdits(code, body, [...edits, ...indentEdits(code, body, edits, column, wrap ? '  ' : '')]);
  const printed = print(false);
  const expression =
    printed.includes('\n') && body.type !== 'BlockStatement' ? `(\n  ${print(true)}\n)` : printed;
  return `const ${storyName} = ${fn.async ? 'async ' : ''}() => ${expression};`;
}

const applyEdits = (code: string, range: Node, edits: Edit[]) => {
  let text = code.slice(range.start, range.end);
  for (const { start, end, text: replacement } of [...edits].sort((a, b) => b.start - a.start)) {
    text = text.slice(0, start - range.start) + replacement + text.slice(end - range.start);
  }
  return text;
};

// Edits that take the indentation the lines of `body` after its first share at `column` off, and
// put `indent` in its place, but leave the lines of a template literal and of a replaced range as
// they are.
function indentEdits(
  code: string,
  body: Node,
  edits: Edit[],
  column: number,
  indent: string
): Edit[] {
  const literals: Node[] = [];
  walk(body, (node) => {
    if (node.type === 'TemplateLiteral') {
      literals.push(node);
    }
  });
  const within = (offset: number, { start, end }: { start: number; end: number }) =>
    offset > start && offset < end;
  const lines: { start: number; space: number; blank: boolean }[] = [];
  for (let index = code.indexOf('\n', body.start); index !== -1 && index < body.end;) {
    const start = index + 1;
    const space = /^[ \t]*/.exec(code.slice(start))![0].length;
    const next = code.indexOf('\n', start);
    const blank = start + space === (next === -1 ? code.length : next);
    if (
      !literals.some((literal) => within(start, literal)) &&
      !edits.some((edit) => start >= edit.start && start < edit.end)
    ) {
      lines.push({ start, space, blank });
    }
    index = next;
  }
  const shared = Math.min(column, ...lines.filter((l) => !l.blank).map((l) => l.space));
  return lines.map(({ start, space, blank }) => ({
    start,
    end: start + (blank ? space : Math.min(space, shared)),
    text: blank ? '' : indent,
  }));
}

// An edit per arg reference, or `undefined` when one is not a hole.
function argEdits(
  story: FunctionNode,
  param: Node,
  editor: SourceEditor,
  args: Record<string, Node>
): Edit[] | undefined {
  const { code } = editor;
  const parentOf = (node: Node) => editor.parentOf(node) ?? undefined;
  const spreadInto = new Set<Node>();
  const writtenAs = (arg: string) => (Object.hasOwn(args, arg) ? args[arg] : undefined);

  // The places the name an identifier declares is read.
  const referencesOf = (identifier: Node): Node[] | undefined =>
    editor.scopes
      .bindingOf(identifier)
      ?.references.filter(
        (reference) =>
          (reference.type === 'Identifier' || reference.type === 'JSXIdentifier') &&
          reference !== identifier &&
          !isAssigned(reference, parentOf(reference)) &&
          !isDestructuredTarget(reference, parentOf)
      );

  const startsOperand = (read: Node, written?: Node) => {
    const ancestors: Node[] = [];
    for (let parent = parentOf(read); parent; parent = parentOf(parent)) {
      ancestors.push(parent);
    }
    return isOperand(read, ancestors, written);
  };

  // `label={args.label}`, `{args.label}` as a child, or `args.label` in code, written as `written`.
  const readEdit = (member: Node, arg: string, fallback: string, written?: Node): Edit => {
    // `args?.label` is read as the chain around it.
    const chain = parentOf(member);
    const read = chain?.type === 'ChainExpression' && chain.expression === member ? chain : member;
    const container = parentOf(read);
    if (container?.type === 'JSXExpressionContainer') {
      const attribute = parentOf(container);
      if (attribute?.type === 'JSXAttribute' && attribute.name.type === 'JSXIdentifier') {
        return nodeEdit(attribute, argHole('attr', [attribute.name.name, arg], fallback));
      }
      if (attribute?.type === 'JSXElement' || attribute?.type === 'JSXFragment') {
        return nodeEdit(container, argHole('text', [arg], fallback));
      }
    }
    return startsOperand(read, written)
      ? nodeEdit(read, argHole('operand', [arg], fallback && asOperand(fallback)))
      : nodeEdit(read, argHole('value', [arg], fallback));
  };

  // The args passed along whole, as in `useState(args)`: the object they are, as a literal. It is
  // `undefined` where another object with the same args would not do: one the story compares by
  // identity, as a hook's dependency list does.
  const wholeEdit = (read: Node, omitted: string[]): Edit | undefined => {
    const parent = parentOf(read);
    if (
      read.type !== 'Identifier' ||
      !parent ||
      parent.type === 'TSTypeQuery' ||
      parent.type === 'ArrayExpression'
    ) {
      return undefined;
    }
    const literal = hole('args', ...omitted.map((name) => holeWord(`-${name}`)));
    if (parent.type === 'Property' && parent.shorthand) {
      return nodeEdit(parent, `${read.name}: ${literal}`);
    }
    return nodeEdit(read, startsOperand(read) ? `(${literal})` : literal);
  };

  // `<Button {...args}>` passes every arg but the children and the attributes the element writes,
  // and `<Button {...args} />` is the component with every arg, its children as content. An element
  // without children of its own shows those the spread passes as content: a self-closing one ends
  // in a `⟦close Button⟧`, and `<Button {...args} size="sm"></Button>` has a `⟦text children⟧`.
  const spreadEdits = (spread: E.JSXSpreadAttribute, omitted: string[]): (Edit | undefined)[] => {
    const opening = parentOf(spread) as E.JSXOpeningElement;
    const element = parentOf(opening) as E.JSXElement;
    const namesOf = (attributes: Node[]) =>
      attributes.flatMap((attribute) =>
        attribute.type === 'JSXAttribute'
          ? [code.slice(attribute.name.start, attribute.name.end)]
          : []
      );
    const left = omitted.map((name) => `-${name}`);
    const tag = code.slice(opening.name.start, opening.name.end);
    if (element.children.length === 0 && opening.attributes.length === 1) {
      return [
        isHoleWord(tag)
          ? nodeEdit(element, hole('element', tag, ...left.map(holeWord)))
          : undefined,
      ];
    }
    const content =
      element.children.length === 0 &&
      opening.attributes.every(
        (attribute) => attribute === spread || attribute.type === 'JSXAttribute'
      ) &&
      ![...omitted, ...namesOf(opening.attributes)].includes('children')
        ? contentEdit(element, tag, code)
        : undefined;
    // The spread leaves out what the element writes itself, before or after it, which shows as
    // written.
    const words = new Set([
      ...left,
      ...namesOf(opening.attributes).map((name) => `-${name}`),
      ...(element.children.length > 0 || content ? ['-children'] : []),
    ]);
    return [
      nodeEdit(spread, hole('props', ...[...words].map(holeWord))),
      ...(content ? [content] : []),
    ];
  };

  // The references of a name that holds every arg but `omitted`: the parameter, or a `...rest`.
  const objectEdits = (identifier: Node, omitted: string[]): (Edit | undefined)[] =>
    referencesOf(identifier)?.flatMap((reference) => {
      const parent = parentOf(reference);
      // The target of a write, as in `args.count++`, is no read and stays as written.
      if (
        parent?.type === 'MemberExpression' &&
        parent.object === reference &&
        isWritten(parent, parentOf(parent))
      ) {
        return [];
      }
      if (parent?.type === 'JSXSpreadAttribute') {
        // A second spread of the args on one element would write each attribute twice.
        const opening = parentOf(parent)!;
        const first = !spreadInto.has(opening);
        spreadInto.add(opening);
        return first ? spreadEdits(parent, omitted) : [undefined];
      }
      const arg = parent && memberName(parent, reference);
      if (arg !== undefined) {
        // A name every object inherits, as `args.constructor`, is no arg.
        return [
          omitted.includes(arg) || arg in Object.prototype
            ? undefined
            : readEdit(parent!, arg, '', writtenAs(arg)),
        ];
      }
      const declaration = parent && ownDeclaration(parent, reference, parentOf);
      const taken = declaration && patternEdits((parent as E.VariableDeclarator).id, omitted);
      return taken?.every((edit) => edit !== undefined)
        ? [...taken, removeEdit(declaration!, code)]
        : [wholeEdit(reference, omitted)];
    }) ?? [undefined];

  // `{ label, size = 'md', ...rest }`, taken from an object that holds every arg but `omitted`.
  const patternEdits = (pattern: Node, omitted: string[]): (Edit | undefined)[] => {
    if (pattern.type !== 'ObjectPattern') {
      return [undefined];
    }
    const taken: string[] = [];
    const edits: (Edit | undefined)[] = [];
    for (const property of pattern.properties) {
      if (property.type === 'RestElement') {
        const { argument } = property;
        edits.push(
          ...(argument.type === 'Identifier'
            ? objectEdits(argument, [...omitted, ...taken])
            : [undefined])
        );
        continue;
      }
      const { key, value, computed } = property;
      const arg =
        key.type === 'Identifier'
          ? key.name
          : key.type === 'Literal' && typeof key.value === 'string'
            ? key.value
            : undefined;
      const local = value.type === 'AssignmentPattern' ? value.left : value;
      const fallback =
        value.type === 'AssignmentPattern' ? fallbackCode(value.right, story, editor) : '';
      const references = local.type === 'Identifier' && referencesOf(local);
      if (
        computed ||
        arg === undefined ||
        arg in Object.prototype ||
        omitted.includes(arg) ||
        fallback === undefined ||
        !references
      ) {
        return [undefined];
      }
      taken.push(arg);
      for (const reference of references) {
        const shorthand = parentOf(reference);
        if (shorthand?.type === 'Property' && shorthand.shorthand) {
          const name = (local as E.BindingIdentifier).name;
          edits.push(nodeEdit(shorthand, `${name}: ${argHole('value', [arg], fallback)}`));
        } else if (!isWritten(reference, shorthand)) {
          // `<Tag>` for `{ as: Tag }` names a component, which no literal can.
          edits.push(
            reference.type === 'JSXIdentifier'
              ? undefined
              : readEdit(reference, arg, fallback, writtenAs(arg))
          );
        }
      }
    }
    return edits;
  };

  const edits = param.type === 'Identifier' ? objectEdits(param, []) : patternEdits(param, []);
  return edits.every((edit) => edit !== undefined) ? (edits as Edit[]) : undefined;
}

// The arg `args.label` or `args['label']` reads.
function memberName(member: Node, object: Node): string | undefined {
  if (member.type !== 'MemberExpression' || member.object !== object) {
    return undefined;
  }
  const { property, computed } = member;
  return !computed && property.type === 'Identifier'
    ? property.name
    : computed && property.type === 'Literal' && typeof property.value === 'string'
      ? property.value
      : undefined;
}

// The statement of `const { label, ...rest } = args;`, which the template can leave out.
function ownDeclaration(
  declarator: Node,
  init: Node,
  parentOf: (node: Node) => Node | undefined
): Node | undefined {
  if (declarator.type !== 'VariableDeclarator' || declarator.init !== init) {
    return undefined;
  }
  const declaration = parentOf(declarator);
  return declaration?.type === 'VariableDeclaration' &&
    declaration.declarations.length === 1 &&
    parentOf(declaration)?.type === 'BlockStatement'
    ? declaration
    : undefined;
}

// A statement, with its line when it has that to itself.
function removeEdit(statement: Node, code: string): Edit {
  const line = code.lastIndexOf('\n', statement.start - 1) + 1;
  const after = /^[ \t]*\n?/.exec(code.slice(statement.end))![0];
  const ownLine = !code.slice(line, statement.start).trim() && after.endsWith('\n');
  return {
    start: ownLine ? line : statement.start,
    end: statement.end + (ownLine ? after.length : after.trimEnd().length),
    text: '',
  };
}

const UNINLINABLE = new Set([
  'CallExpression',
  'NewExpression',
  'TaggedTemplateExpression',
  'AssignmentExpression',
  'UpdateExpression',
  'AwaitExpression',
  'YieldExpression',
  'SequenceExpression',
]);

const ATOMS = new Set([
  'Literal',
  'TemplateLiteral',
  'Identifier',
  'MemberExpression',
  'ArrayExpression',
  'ObjectExpression',
  'JSXElement',
]);

// The code of a default, as in `{ size = 'md' }`, to write wherever the arg is read; `undefined` for
// one that reads the story's own names, or is not the same value at each read, such as a call.
function fallbackCode(
  fallback: Node,
  story: FunctionNode,
  editor: SourceEditor
): string | undefined {
  const within = (node: Node, outer: Node) => node.start >= outer.start && node.end <= outer.end;
  let inlinable = true;
  walk(fallback, (node) => {
    if (UNINLINABLE.has(node.type)) {
      inlinable = false;
    }
    const binding = node.type === 'Identifier' ? editor.scopes.bindingOf(node) : undefined;
    if (binding && binding.identifier !== node) {
      const declared = binding.identifier;
      inlinable &&= !within(declared, story) || within(declared, fallback);
    }
  });
  const written = editor.code.slice(fallback.start, fallback.end);
  return !inlinable ? undefined : ATOMS.has(fallback.type) ? written : `(${written})`;
}

// Where the children a spread passes go in an element without children of its own. A `/>` on a
// line of its own stays there.
function contentEdit(element: E.JSXElement, tag: string, code: string): Edit {
  const { openingElement: opening, closingElement: closing } = element;
  if (closing) {
    return {
      start: closing.start,
      end: closing.start,
      text: hole('text', 'children'),
    };
  }
  const slash = code.lastIndexOf('/', opening.end);
  const last = opening.attributes.at(-1)!;
  const ownLine = code.slice(last.end, slash).includes('\n');
  return {
    start: ownLine ? slash : last.end,
    end: opening.end,
    text: hole('close', holeWord(tag)),
  };
}

// The target of an assignment or update, which reads nothing.
const isAssigned = (node: Node, parent: Node | undefined) =>
  (parent?.type === 'AssignmentExpression' && parent.left === node) ||
  parent?.type === 'UpdateExpression';

// Whether an identifier is written by a destructuring assignment or a loop head, as `label` in
// `[label] = ['y']` or `for (label of labels)`.
const isDestructuredTarget = (node: Node, parentOf: (node: Node) => Node | undefined): boolean => {
  let child = node;
  for (let parent = parentOf(node); parent; child = parent, parent = parentOf(parent)) {
    switch (parent.type) {
      case 'ArrayPattern':
      case 'ObjectPattern':
      case 'RestElement':
        continue;
      case 'Property':
        if (parent.value !== child) {
          return false;
        }
        continue;
      case 'AssignmentPattern':
        if (parent.left !== child) {
          return false;
        }
        continue;
      case 'AssignmentExpression':
      case 'ForOfStatement':
      case 'ForInStatement':
        return parent.left === child;
      default:
        return false;
    }
  }
  return false;
};

const isWritten = (node: Node, parent: Node | undefined) =>
  isAssigned(node, parent) || (parent?.type === 'UnaryExpression' && parent.operator === 'delete');

// A hole for one arg, with the code the story defaults it to while it is unset.
const argHole = (kind: string, words: string[], fallback: string) =>
  hole(kind, ...words.map(holeWord), ...(fallback ? [defaultWord(fallback)] : []));

const nodeEdit = (node: Node, text: string): Edit => ({
  start: node.start,
  end: node.end,
  text,
});
