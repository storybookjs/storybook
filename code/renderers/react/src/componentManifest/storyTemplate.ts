import { type NodePath, types as t } from 'storybook/internal/babel';
import { hasHoleBracket, hole, isHoleWord } from 'storybook/internal/docs-tools';

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
  const lines = dedent(text).split('\n');
  const expression =
    lines.length > 1 && !t.isBlockStatement(body)
      ? `(\n${lines.map((line) => (line ? `  ${line}` : line)).join('\n')}\n)`
      : lines.join('\n');
  return `const ${storyName} = ${fnPath.node.async ? 'async ' : ''}() => ${expression};`;
}

// An edit per arg reference, or `undefined` when one is not a hole.
function argEdits(param: NodePath, code: string): Edit[] | undefined {
  if (param.isIdentifier()) {
    const references = referencesOf(param, param.node.name);
    const edits = references?.map((reference) => {
      const parent = reference.parentPath!;
      if (parent.isJSXSpreadAttribute()) {
        return spreadEdit(parent);
      }
      const arg = argName(parent, reference.node);
      return arg === undefined ? undefined : readEdit(parent, arg, code);
    });
    return edits?.every((edit) => edit !== undefined) ? (edits as Edit[]) : undefined;
  }
  if (!param.isObjectPattern()) {
    return undefined;
  }
  const edits: Edit[] = [];
  for (const property of param.get('properties')) {
    const { key, value, computed } = property.node as t.ObjectProperty;
    const arg = t.isIdentifier(key) ? key.name : t.isStringLiteral(key) ? key.value : undefined;
    if (!property.isObjectProperty() || computed || !t.isIdentifier(value) || arg === undefined) {
      return undefined;
    }
    for (const reference of referencesOf(param, value.name) ?? []) {
      const shorthand = reference.parentPath;
      if (shorthand?.isObjectProperty() && shorthand.node.shorthand) {
        edits.push(nodeEdit(shorthand.node, `${arg}: ${hole('value', arg)}`));
      } else {
        edits.push(readEdit(reference, arg, code));
      }
    }
  }
  return edits;
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

// `<Button {...args}>` passes every arg but the children the element writes itself.
function spreadEdit(spread: NodePath<t.JSXSpreadAttribute>): Edit | undefined {
  const opening = spread.parentPath.node as t.JSXOpeningElement;
  const element = spread.parentPath.parent as t.JSXElement;
  // Another attribute would override a spread arg or be overridden by it.
  if (opening.attributes.length > 1) {
    return undefined;
  }
  const words = element.children.length > 0 ? ['-children'] : [];
  return { start: opening.name.end!, end: spread.node.end!, text: hole('props', ...words) };
}

// `label={args.label}`, `{args.label}` as a child, or `args.label` in code.
function readEdit(read: NodePath, arg: string, code: string): Edit {
  const container = read.parentPath;
  if (container?.isJSXExpressionContainer()) {
    const attribute = container.parentPath;
    if (attribute.isJSXAttribute() && t.isJSXIdentifier(attribute.node.name)) {
      const start = code.slice(0, attribute.node.start!).trimEnd().length;
      return { start, end: attribute.node.end!, text: hole('attr', attribute.node.name.name, arg) };
    }
    if (attribute.isJSXElement() || attribute.isJSXFragment()) {
      return nodeEdit(container.node, hole('text', arg));
    }
  }
  return nodeEdit(read.node, hole('value', arg));
}

const nodeEdit = (node: t.Node, text: string): Edit => ({
  start: node.start!,
  end: node.end!,
  text,
});

// Without the indentation the code has in the story file, which its lines after the first share.
function dedent(text: string): string {
  const [first, ...rest] = text.split('\n');
  const indents = rest.filter((line) => line.trim()).map((line) => /^\s*/.exec(line)![0].length);
  const indent = Math.min(...indents);
  return [first, ...rest.map((line) => line.slice(indent))].join('\n');
}
