import { type NodePath, types as t } from 'storybook/internal/babel';
import { isOperand } from 'storybook/internal/csf-tools';
import {
  asOperand,
  dedentStoryCode,
  defaultWord,
  hasHoleBracket,
  hole,
  holeWord,
  isHoleWord,
} from 'storybook/internal/docs-tools';

export type StoryFunction =
  | t.ArrowFunctionExpression
  | t.FunctionExpression
  | t.FunctionDeclaration
  | t.ObjectMethod;

type Scope = NodePath['scope'];

interface Edit {
  start: number;
  end: number;
  text: string;
}

/**
 * The story as written in `code`, with a hole wherever it reads an arg, for `fillTemplate`. It is
 * `undefined` when the story reads its args in a way no hole stands for, such as passing them along
 * whole, and the static snippet is shown instead. `args` holds the node each arg is written with,
 * which decides where its code needs parentheses; see `isOperand`.
 */
export function buildStoryTemplate(
  storyName: string,
  fnPath: NodePath<StoryFunction> | undefined,
  componentName: string | undefined,
  code: string,
  args: Record<string, t.Node> = {}
): string | undefined {
  if (!fnPath) {
    // `component: Button as any` names no element.
    return componentName && isHoleWord(componentName)
      ? `const ${storyName} = () => ${hole('element', componentName)};`
      : undefined;
  }
  const { params, body } = fnPath.node;
  if (params.length !== 1 || hasHoleBracket(code) || body.start == null || body.end == null) {
    return undefined;
  }
  const edits = argEdits(fnPath.get('params')[0]!, code, args);
  if (!edits || edits.length === 0) {
    return undefined;
  }
  let text = code.slice(body.start, body.end);
  for (const { start, end, text: replacement } of edits.sort((a, b) => b.start - a.start)) {
    text = text.slice(0, start - body.start) + replacement + text.slice(end - body.start);
  }
  const lines = dedentStoryCode(text, body.loc!.start.column).split('\n');
  const expression =
    lines.length > 1 && !t.isBlockStatement(body)
      ? `(\n${lines.map((line) => (line ? `  ${line}` : line)).join('\n')}\n)`
      : lines.join('\n');
  return `const ${storyName} = ${fnPath.node.async ? 'async ' : ''}() => ${expression};`;
}

// An edit per arg reference, or `undefined` when one is not a hole.
function argEdits(param: NodePath, code: string, args: Record<string, t.Node>): Edit[] | undefined {
  const spreadInto = new Set<t.Node>();
  const writtenAs = (arg: string) => (Object.hasOwn(args, arg) ? args[arg] : undefined);

  // The references of a name that holds every arg but `omitted`: the parameter, or a `...rest`.
  const objectEdits = (scope: Scope, name: string, omitted: string[]): (Edit | undefined)[] =>
    referencesOf(scope, name)?.flatMap((reference) => {
      const parent = reference.parentPath!;
      // The target of a write, as in `args.count++`, is no read and stays as written.
      if (t.isMemberExpression(parent.node, { object: reference.node }) && isWritten(parent)) {
        return [];
      }
      if (parent.isJSXSpreadAttribute()) {
        // A second spread of the args on one element would write each attribute twice.
        const first = !spreadInto.has(parent.parent);
        spreadInto.add(parent.parent);
        return first ? spreadEdits(parent, omitted, code) : [undefined];
      }
      const arg = memberName(parent, reference.node);
      if (arg !== undefined) {
        return [omitted.includes(arg) ? undefined : readEdit(parent, arg, '', writtenAs(arg))];
      }
      const declaration = ownDeclaration(parent);
      const taken = declaration && patternEdits(parent.get('id') as NodePath, omitted);
      return taken?.every((edit) => edit !== undefined)
        ? [...taken, removeEdit(declaration!, code)]
        : [wholeEdit(reference, omitted)];
    }) ?? [undefined];

  // `{ label, size = 'md', ...rest }`, taken from an object that holds every arg but `omitted`.
  const patternEdits = (pattern: NodePath, omitted: string[]): (Edit | undefined)[] => {
    if (!pattern.isObjectPattern()) {
      return [undefined];
    }
    const taken: string[] = [];
    const edits: (Edit | undefined)[] = [];
    for (const property of pattern.get('properties')) {
      if (property.isRestElement()) {
        const { argument } = property.node;
        edits.push(
          ...(t.isIdentifier(argument)
            ? objectEdits(pattern.scope, argument.name, [...omitted, ...taken])
            : [undefined])
        );
        continue;
      }
      const { key, value, computed } = property.node as t.ObjectProperty;
      const arg = t.isIdentifier(key) ? key.name : t.isStringLiteral(key) ? key.value : undefined;
      const local = t.isAssignmentPattern(value) ? value.left : value;
      const fallback = t.isAssignmentPattern(value)
        ? fallbackCode(property.get('value.right') as NodePath<t.Expression>, pattern, code)
        : '';
      const references = t.isIdentifier(local) && referencesOf(pattern.scope, local.name);
      if (
        computed ||
        arg === undefined ||
        omitted.includes(arg) ||
        fallback === undefined ||
        !references
      ) {
        return [undefined];
      }
      taken.push(arg);
      for (const reference of references) {
        const shorthand = reference.parentPath;
        if (shorthand?.isObjectProperty() && shorthand.node.shorthand) {
          const name = (local as t.Identifier).name;
          edits.push(nodeEdit(shorthand.node, `${name}: ${argHole('value', [arg], fallback)}`));
        } else if (!isWritten(reference)) {
          // `<Tag>` for `{ as: Tag }` names a component, which no literal can.
          edits.push(
            reference.isJSXIdentifier()
              ? undefined
              : readEdit(reference, arg, fallback, writtenAs(arg))
          );
        }
      }
    }
    return edits;
  };

  const edits = param.isIdentifier()
    ? objectEdits(param.scope, param.node.name, [])
    : patternEdits(param, []);
  return edits.every((edit) => edit !== undefined) ? (edits as Edit[]) : undefined;
}

// The places a name is read.
const referencesOf = (scope: Scope, name: string) => scope.getBinding(name)?.referencePaths;

// The arg `args.label` or `args['label']` reads.
function memberName(member: NodePath, object: t.Node): string | undefined {
  if (!member.isMemberExpression() && !member.isOptionalMemberExpression()) {
    return undefined;
  }
  const { property, computed } = member.node;
  if (member.node.object !== object) {
    return undefined;
  }
  return !computed && t.isIdentifier(property)
    ? property.name
    : computed && t.isStringLiteral(property)
      ? property.value
      : undefined;
}

// The statement of `const { label, ...rest } = args;`, which the template can leave out.
function ownDeclaration(declarator: NodePath): t.Node | undefined {
  const declaration = declarator.parentPath;
  return declarator.isVariableDeclarator() &&
    declaration?.isVariableDeclaration() &&
    declaration.node.declarations.length === 1 &&
    declaration.parentPath.isBlockStatement()
    ? declaration.node
    : undefined;
}

// A statement, with its line when it has that to itself.
function removeEdit(statement: t.Node, code: string): Edit {
  const line = code.lastIndexOf('\n', statement.start! - 1) + 1;
  const after = /^[ \t]*\n?/.exec(code.slice(statement.end!))![0];
  const ownLine = !code.slice(line, statement.start!).trim() && after.endsWith('\n');
  return {
    start: ownLine ? line : statement.start!,
    end: statement.end! + (ownLine ? after.length : after.trimEnd().length),
    text: '',
  };
}

// The code of a default, as in `{ size = 'md' }`, to write wherever the arg is read; `undefined` for
// one that reads the story's own names, or is not the same value at each read, such as a call.
function fallbackCode(
  fallback: NodePath<t.Expression>,
  pattern: NodePath,
  code: string
): string | undefined {
  const story = pattern.getFunctionParent()!;
  let inlinable = true;
  const visit = (path: NodePath) => {
    if (
      path.isCallExpression() ||
      path.isOptionalCallExpression() ||
      path.isNewExpression() ||
      path.isTaggedTemplateExpression() ||
      path.isAssignmentExpression() ||
      path.isUpdateExpression() ||
      path.isAwaitExpression() ||
      path.isYieldExpression() ||
      path.isSequenceExpression()
    ) {
      inlinable = false;
    }
    if (path.isReferencedIdentifier()) {
      const declared = path.scope.getBinding(path.node.name)?.path;
      const within = ({ node }: NodePath) => declared?.findParent((parent) => parent.node === node);
      inlinable &&= !within(story) || !!within(fallback);
    }
  };
  visit(fallback);
  fallback.traverse({ enter: visit });
  const written = code.slice(fallback.node.start!, fallback.node.end!);
  const { node } = fallback;
  const atom =
    t.isLiteral(node) ||
    t.isIdentifier(node) ||
    t.isMemberExpression(node) ||
    t.isArrayExpression(node) ||
    t.isObjectExpression(node) ||
    t.isJSXElement(node);
  return !inlinable ? undefined : atom ? written : `(${written})`;
}

// `<Button {...args}>` passes every arg but the children and the attributes written after it, which
// win, and `<Button {...args} />` is the component with every arg, its children as content. An
// element without children of its own shows those the spread passes as content: a self-closing one
// ends in a `⟦close Button⟧`, and `<Button {...args} size="sm"></Button>` has a `⟦text children⟧`.
function spreadEdits(
  spread: NodePath<t.JSXSpreadAttribute>,
  omitted: string[],
  code: string
): (Edit | undefined)[] {
  const opening = spread.parentPath.node as t.JSXOpeningElement;
  const element = spread.parentPath.parent as t.JSXElement;
  const index = opening.attributes.indexOf(spread.node);
  const namesOf = (attributes: t.Node[]) =>
    attributes.flatMap((attribute) =>
      t.isJSXAttribute(attribute) ? [code.slice(attribute.name.start!, attribute.name.end!)] : []
    );
  const left = omitted.map((name) => `-${name}`);
  const tag = code.slice(opening.name.start!, opening.name.end!);
  if (element.children.length === 0 && opening.attributes.length === 1) {
    return [
      isHoleWord(tag) ? nodeEdit(element, hole('element', tag, ...left.map(holeWord))) : undefined,
    ];
  }
  const content =
    element.children.length === 0 &&
    opening.attributes.every(
      (attribute) => attribute === spread.node || t.isJSXAttribute(attribute)
    ) &&
    ![...omitted, ...namesOf(opening.attributes)].includes('children')
      ? contentEdit(element, tag, code)
      : undefined;
  // An attribute written both before and after the spread is the one after it, which wins.
  const words = [
    ...left,
    ...namesOf(opening.attributes.slice(index + 1)).map((name) => `-${name}`),
    ...namesOf(opening.attributes.slice(0, index)).map((name) => `^${name}`),
    ...(element.children.length > 0 || content ? ['-children'] : []),
  ].filter(
    (word, i, all) => !all.slice(0, i).some((earlier) => earlier.slice(1) === word.slice(1))
  );
  return [
    nodeEdit(spread.node, hole('props', ...words.map(holeWord))),
    ...(content ? [content] : []),
  ];
}

// Where the children a spread passes go in an element without children of its own. A `/>` on a
// line of its own stays there.
function contentEdit(element: t.JSXElement, tag: string, code: string): Edit {
  const { openingElement: opening, closingElement: closing } = element;
  if (closing) {
    return { start: closing.start!, end: closing.start!, text: hole('text', 'children') };
  }
  const slash = code.lastIndexOf('/', opening.end!);
  const ownLine = code.slice(opening.attributes.at(-1)!.end!, slash).includes('\n');
  return {
    start: ownLine ? slash : opening.attributes.at(-1)!.end!,
    end: opening.end!,
    text: hole('close', holeWord(tag)),
  };
}

// `label={args.label}`, `{args.label}` as a child, or `args.label` in code, written as `written`.
function readEdit(read: NodePath, arg: string, fallback: string, written?: t.Node): Edit {
  const { node } = read;
  const container = read.parentPath;
  if (container?.isJSXExpressionContainer()) {
    const attribute = container.parentPath;
    if (attribute.isJSXAttribute() && t.isJSXIdentifier(attribute.node.name)) {
      return nodeEdit(attribute.node, argHole('attr', [attribute.node.name.name, arg], fallback));
    }
    if (attribute.isJSXElement() || attribute.isJSXFragment()) {
      return nodeEdit(container.node, argHole('text', [arg], fallback));
    }
  }
  return startsOperand(read, written)
    ? nodeEdit(node, argHole('operand', [arg], fallback && asOperand(fallback)))
    : nodeEdit(node, argHole('value', [arg], fallback));
}

// The args passed along whole, as in `useState(args)`: the object they are, as a literal. It is
// `undefined` where another object with the same args would not do: one the story compares by
// identity, as a hook's dependency list does.
function wholeEdit(read: NodePath, omitted: string[]): Edit | undefined {
  const { node, parentPath: parent } = read;
  if (!read.isIdentifier() || !parent || parent.isTSTypeQuery() || parent.isArrayExpression()) {
    return undefined;
  }
  const literal = hole('args', ...omitted.map((name) => holeWord(`-${name}`)));
  if (parent.isObjectProperty() && parent.node.shorthand) {
    return nodeEdit(parent.node, `${read.node.name}: ${literal}`);
  }
  return nodeEdit(node, startsOperand(read) ? `(${literal})` : literal);
}

const isWritten = ({ node, parent }: NodePath) =>
  t.isAssignmentExpression(parent, { left: node }) ||
  t.isUpdateExpression(parent) ||
  t.isUnaryExpression(parent, { operator: 'delete' });

const startsOperand = (read: NodePath, written?: t.Node) =>
  isOperand(
    read.node,
    read
      .getAncestry()
      .slice(1)
      .map((path) => path.node),
    written
  );

// A hole for one arg, with the code the story defaults it to while it is unset.
const argHole = (kind: string, words: string[], fallback: string) =>
  hole(kind, ...words.map(holeWord), ...(fallback ? [defaultWord(fallback)] : []));

const nodeEdit = (node: t.Node, text: string): Edit => ({
  start: node.start!,
  end: node.end!,
  text,
});
