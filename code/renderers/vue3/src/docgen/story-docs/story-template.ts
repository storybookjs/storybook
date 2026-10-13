import {
  type ElementNode,
  NodeTypes,
  parse,
  type SimpleExpressionNode,
  type TemplateChildNode,
} from '@vue/compiler-dom';

import { babelParseExpression, types as t } from 'storybook/internal/babel';
import { isOperand } from 'storybook/internal/csf-tools';
import { hasHoleBracket, hole } from 'storybook/internal/docs-tools';

import { createRenderContext, renderPreparedSfcSnippet } from '../shared/render-primitives.ts';
import { componentImportForTag } from './transform-template/transform-template.ts';

type Edit = { start: number; end: number; text: string };

// A story without a render function is the component with every arg, its slots as content.
export function componentTemplate(name: string, importStatement: string, slots: string[]) {
  const ctx = createRenderContext();
  ctx.componentImports.add(importStatement);
  return renderPreparedSfcSnippet({ templateCode: hole('element', name, ...slots), ctx });
}

/**
 * The render function's template as written, with a hole wherever it reads an arg, for
 * `fillTemplate`. It is `undefined` when the template reads its args in a way no hole stands for,
 * such as in an event handler or a `v-model`, and the static snippet is shown instead.
 */
export function renderTemplate(
  template: string,
  componentImports: Map<string, string>,
  slots: string[]
): string | undefined {
  let invalid = hasHoleBracket(template);
  const root = parse(template, { onError: () => (invalid = true) });
  const ctx = createRenderContext();
  const edits: Edit[] = [];

  const visit = (node: TemplateChildNode): boolean => {
    if (node.type === NodeTypes.INTERPOLATION) {
      // `{{ args.label }}` is the arg as content.
      const { start, end } = node.loc;
      const holes = argHoles(node.content as SimpleExpressionNode, template, (name) => ({
        start: start.offset,
        end: end.offset,
        text: hole('text', name),
      }));
      edits.push(...(holes ?? []));
      return holes !== undefined;
    }
    if (node.type !== NodeTypes.ELEMENT) {
      return true;
    }
    const importStatement = componentImportForTag(node.tag, componentImports);
    if (importStatement) {
      ctx.componentImports.add(importStatement);
    }
    for (const [index, prop] of node.props.entries()) {
      if (prop.type !== NodeTypes.DIRECTIVE || !prop.exp) {
        continue;
      }
      const exp = prop.exp as SimpleExpressionNode;
      const arg = prop.arg as SimpleExpressionNode | undefined;
      const { start, end } = prop.loc;
      // `v-bind="args"` passes every arg but the slots and the attributes written after it, which
      // win; see `spreadArgs`.
      if (prop.name === 'bind' && !arg && exp.content.trim() === 'args') {
        const written = node.props.map(propName);
        const before = written.slice(0, index).filter((name) => name !== undefined);
        const after = written.slice(index + 1).filter((name) => name !== undefined);
        const words = [
          ...before.map((name) => `^${name}`),
          ...[...slots, ...after].map((name) => `-${name}`),
        ];
        edits.push({ start: start.offset, end: end.offset, text: hole('props', ...words) });
        continue;
      }
      // `:label="args.label"` is one attribute, unless a modifier changes how it binds or the
      // element writes `label` itself too, as `class` next to `:class`.
      const name =
        prop.name === 'bind' && arg?.isStatic && prop.modifiers.length === 0
          ? arg.content
          : undefined;
      const owned = node.props.every(
        (other) => other === prop || other.type !== NodeTypes.ATTRIBUTE || other.name !== name
      );
      const holes = argHoles(exp, template, (word) =>
        name !== undefined && owned
          ? { start: start.offset, end: end.offset, text: hole('attr', name, word) }
          : undefined
      );
      const unusual = prop.name === 'on' || prop.name === 'model' || (arg && !arg.isStatic);
      if (!holes || (holes.length > 0 && unusual)) {
        return false;
      }
      edits.push(...holes);
    }
    return node.children.every(visit);
  };

  if (!root.children.every(visit) || invalid || edits.length === 0) {
    return undefined;
  }
  let templateCode = template;
  for (const { start, end, text } of edits.sort((a, b) => b.start - a.start)) {
    templateCode = templateCode.slice(0, start) + text + templateCode.slice(end);
  }
  return renderPreparedSfcSnippet({ templateCode, ctx });
}

// A value hole for each `args.label` an expression reads, or the `whole` edit when it is nothing
// but that read; `undefined` when it reads `args` another way.
function argHoles(
  exp: SimpleExpressionNode,
  template: string,
  whole: (name: string) => Edit | undefined
): Edit[] | undefined {
  const offset = exp.loc.start.offset;
  if (!/\bargs\b/.test(exp.content)) {
    return [];
  }
  let ast: t.Expression;
  try {
    ast = babelParseExpression(exp.content);
  } catch {
    return undefined;
  }
  // Vue decodes entities in an attribute, which would shift the offsets.
  if (template.slice(offset, exp.loc.end.offset) !== exp.content) {
    return undefined;
  }
  const holes: (Edit | undefined)[] = [];
  t.traverse(ast, (node, ancestors) => {
    const parent = ancestors.at(-1)?.node;
    if (
      !t.isIdentifier(node, { name: 'args' }) ||
      (parent && !t.isReferenced(node, parent, ancestors.at(-2)?.node))
    ) {
      return;
    }
    const name =
      t.isMemberExpression(parent, { object: node, computed: false }) &&
      t.isIdentifier(parent.property) &&
      parent.property.name;
    const around = ancestors.slice(0, -1).map((ancestor) => ancestor.node);
    const kind = isOperand(parent!, around.reverse()) ? 'operand' : 'value';
    holes.push(
      !name
        ? undefined
        : (parent === ast && whole(name)) || {
            start: offset + parent.start!,
            end: offset + parent.end!,
            text: hole(kind, name),
          }
    );
  });
  return holes.every((edit) => edit !== undefined) ? holes : undefined;
}

// The prop an attribute, a bound attribute or a `v-model` sets, which a `v-bind="args"` spread
// could also set: `max-count` sets `maxCount`.
const propName = (prop: ElementNode['props'][number]) =>
  attributeName(prop)?.replace(/-(\w)/g, (_, letter: string) => letter.toUpperCase());

function attributeName(prop: ElementNode['props'][number]): string | undefined {
  if (prop.type === NodeTypes.ATTRIBUTE) {
    return prop.name;
  }
  const arg = prop.arg as SimpleExpressionNode | undefined;
  if (prop.name === 'model') {
    return arg?.content ?? 'modelValue';
  }
  return prop.name === 'bind' && arg ? arg.content : undefined;
}
