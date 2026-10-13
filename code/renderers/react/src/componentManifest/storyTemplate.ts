import { type NodePath, types as t } from 'storybook/internal/babel';
import { isOperand } from 'storybook/internal/csf-tools';
import { dedentStoryCode, hasHoleBracket, hole, isHoleWord } from 'storybook/internal/docs-tools';

export type StoryFunction =
  | t.ArrowFunctionExpression
  | t.FunctionExpression
  | t.FunctionDeclaration
  | t.ObjectMethod;

interface Edit {
  start: number;
  end: number;
  text: string;
}

/**
 * The story as written in `code`, with a hole wherever it reads an arg, for `fillTemplate`. It is
 * `undefined` when the story reads its args in a way no hole stands for, such as passing them along
 * whole, and the static snippet is shown instead.
 */
export function buildStoryTemplate(
  storyName: string,
  fnPath: NodePath<StoryFunction> | undefined,
  componentName: string | undefined,
  code: string
): string | undefined {
  if (!fnPath) {
    return componentName && `const ${storyName} = () => ${hole('element', componentName)};`;
  }
  const { params, body } = fnPath.node;
  if (params.length !== 1 || hasHoleBracket(code) || body.start == null || body.end == null) {
    return undefined;
  }
  const edits = argEdits(fnPath.get('params')[0]!, code);
  if (!edits || edits.length === 0) {
    return undefined;
  }
  let text = code.slice(body.start, body.end);
  for (const { start, end, text: replacement } of edits.sort((a, b) => b.start - a.start)) {
    text = text.slice(0, start - body.start) + replacement + text.slice(end - body.start);
  }
  const lines = dedentStoryCode(text).split('\n');
  const expression =
    lines.length > 1 && !t.isBlockStatement(body)
      ? `(\n${lines.map((line) => (line ? `  ${line}` : line)).join('\n')}\n)`
      : lines.join('\n');
  return `const ${storyName} = ${fnPath.node.async ? 'async ' : ''}() => ${expression};`;
}

// An edit per arg reference, or `undefined` when one is not a hole.
function argEdits(param: NodePath, code: string): Edit[] | undefined {
  if (param.isIdentifier()) {
    const edits = referencesOf(param, param.node.name)?.map((reference) => {
      const parent = reference.parentPath!;
      if (parent.isJSXSpreadAttribute()) {
        return spreadEdit(parent, code);
      }
      const arg = argName(parent, reference.node);
      return arg === undefined ? undefined : readEdit(parent, arg);
    });
    return edits?.every((edit) => edit !== undefined) ? (edits as Edit[]) : undefined;
  }
  if (!param.isObjectPattern()) {
    return undefined;
  }
  const edits: (Edit | undefined)[] = [];
  for (const property of param.get('properties')) {
    const { key, value, computed } = property.node as t.ObjectProperty;
    const arg = t.isIdentifier(key) ? key.name : t.isStringLiteral(key) ? key.value : undefined;
    if (
      !property.isObjectProperty() ||
      computed ||
      !t.isIdentifier(value) ||
      arg === undefined ||
      !isHoleWord(arg)
    ) {
      return undefined;
    }
    const references = referencesOf(param, value.name);
    if (!references) {
      return undefined;
    }
    for (const reference of references) {
      const shorthand = reference.parentPath;
      if (shorthand?.isObjectProperty() && shorthand.node.shorthand) {
        edits.push(nodeEdit(shorthand.node, `${arg}: ${hole('value', arg)}`));
      } else {
        // `<Tag>` for `{ as: Tag }` names a component, which no literal can.
        edits.push(reference.isJSXIdentifier() ? undefined : readEdit(reference, arg));
      }
    }
  }
  return edits.every((edit) => edit !== undefined) ? (edits as Edit[]) : undefined;
}

// The places a parameter's name is read; `undefined` when the story assigns to it.
function referencesOf(param: NodePath, name: string): NodePath[] | undefined {
  const binding = param.scope.getBinding(name);
  return binding && binding.constantViolations.length === 0 ? binding.referencePaths : undefined;
}

// The arg `args.label` or `args['label']` reads.
function argName(member: NodePath, object: t.Node): string | undefined {
  if (!member.isMemberExpression() && !member.isOptionalMemberExpression()) {
    return undefined;
  }
  const { property, computed } = member.node;
  if (member.node.object !== object) {
    return undefined;
  }
  const name =
    !computed && t.isIdentifier(property)
      ? property.name
      : computed && t.isStringLiteral(property)
        ? property.value
        : undefined;
  return name !== undefined && isHoleWord(name) ? name : undefined;
}

// `<Button {...args}>` passes every arg but the children and the attributes written after it, which
// win, and `<Button {...args} />` is the component with every arg, its children as content.
function spreadEdit(spread: NodePath<t.JSXSpreadAttribute>, code: string): Edit | undefined {
  const opening = spread.parentPath.node as t.JSXOpeningElement;
  const element = spread.parentPath.parent as t.JSXElement;
  const index = opening.attributes.indexOf(spread.node);
  if (!opening.attributes.every((attribute, i) => i === index || t.isJSXAttribute(attribute))) {
    return undefined;
  }
  const nameOf = (attribute: t.Node) =>
    code.slice((attribute as t.JSXAttribute).name.start!, (attribute as t.JSXAttribute).name.end!);
  const tag = code.slice(opening.name.start!, opening.name.end!);
  if (element.children.length === 0 && opening.attributes.length === 1) {
    return isHoleWord(tag) ? nodeEdit(element, hole('element', tag)) : undefined;
  }
  const words = [
    ...opening.attributes.slice(0, index).map((attribute) => `^${nameOf(attribute)}`),
    ...opening.attributes.slice(index + 1).map((attribute) => `-${nameOf(attribute)}`),
    ...(element.children.length > 0 ? ['-children'] : []),
  ];
  return nodeEdit(spread.node, hole('props', ...words));
}

// `label={args.label}`, `{args.label}` as a child, or `args.label` in code; `undefined` for a read
// the story writes to, such as `args.count++`.
function readEdit(read: NodePath, arg: string): Edit | undefined {
  const { node, parent } = read;
  if (
    t.isAssignmentExpression(parent, { left: node }) ||
    t.isUpdateExpression(parent) ||
    t.isUnaryExpression(parent, { operator: 'delete' })
  ) {
    return undefined;
  }
  const container = read.parentPath;
  if (container?.isJSXExpressionContainer()) {
    const attribute = container.parentPath;
    if (attribute.isJSXAttribute() && t.isJSXIdentifier(attribute.node.name)) {
      return nodeEdit(attribute.node, hole('attr', attribute.node.name.name, arg));
    }
    if (attribute.isJSXElement() || attribute.isJSXFragment()) {
      return nodeEdit(container.node, hole('text', arg));
    }
  }
  return nodeEdit(node, hole(isOperand(node, parent) ? 'operand' : 'value', arg));
}

const nodeEdit = (node: t.Node, text: string): Edit => ({
  start: node.start!,
  end: node.end!,
  text,
});
