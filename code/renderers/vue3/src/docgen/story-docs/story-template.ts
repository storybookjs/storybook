import {
  type ElementNode,
  NodeTypes,
  parse,
  type SimpleExpressionNode,
  type TemplateChildNode,
} from '@vue/compiler-dom';

import { babelParseExpression, types as t } from 'storybook/internal/babel';
import { isOperand } from 'storybook/internal/csf-tools';
import { hasHoleBracket, hole, holeWord } from 'storybook/internal/docs-tools';

import {
  createRenderContext,
  hoistArgCode,
  hoistModelRef,
  renderPreparedSfcSnippet,
} from '../shared/render-primitives.ts';
import type { ClassifiedArg } from './classify-args/classify-args.ts';
import type { ForwardableSetup } from './transform-template/forward-setup.ts';
import {
  collectTemplateScopeBindings,
  componentImportForTag,
  seedForwardedSetup,
  setupStatementCode,
} from './transform-template/transform-template.ts';

type Edit = { start: number; end: number; text: string };

// A story without a render function is the component with every arg, its slots as content.
export function componentTemplate(name: string, importStatement: string, slots: string[]) {
  const ctx = createRenderContext();
  ctx.componentImports.add(importStatement);
  return renderPreparedSfcSnippet({
    templateCode: hole('element', name, ...slots.map(holeWord)),
    ctx,
  });
}

/**
 * The render function's template and the statements of its `setup` as written, with a hole
 * wherever they read an arg, for `fillTemplate`. It is `undefined` when they read the args in a way
 * no hole stands for, such as in an event handler, and the static snippet is shown instead.
 *
 * An arg the static snippet hoists to a `const`, as the story sets an object or array, is a `const`
 * here too, so every read of it is the same value, as in the story.
 */
export function renderTemplate(
  template: string,
  componentImports: Map<string, string>,
  slots: string[],
  setup?: ForwardableSetup,
  args: ClassifiedArg[] = []
): string | undefined {
  const statements = setup?.statements ?? [];
  let invalid = [template, ...statements.map(({ source }) => source)].some(hasHoleBracket);
  const root = parse(template, { onError: () => (invalid = true) });
  const ctx = createRenderContext();
  const edits: Edit[] = [];
  // A `setup` binding or a `v-for` variable named `args` is not the story's args.
  if (
    (setup && !seedForwardedSetup(setup, ctx)) ||
    !collectTemplateScopeBindings(root.children, ctx) ||
    ctx.bindings.has('args')
  ) {
    return undefined;
  }
  const hoisted = new Set(
    args.filter((arg) => arg.role !== 'slot' && arg.plan.kind === 'hoist').map((arg) => arg.name)
  );
  const constFor = (name: string) =>
    hoisted.has(name)
      ? hoistArgCode(name, hole('value', holeWord(name), 'script'), ctx)
      : undefined;

  const visit = (node: TemplateChildNode): boolean => {
    if (node.type === NodeTypes.INTERPOLATION) {
      // `{{ args.label }}` is the arg as content.
      const { start, end } = node.loc;
      const holes = argHoles(
        node.content as SimpleExpressionNode,
        template,
        '"',
        constFor,
        (name) => ({
          start: start.offset,
          end: end.offset,
          text: hole('text', holeWord(name)),
        })
      );
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
      if (prop.type !== NodeTypes.DIRECTIVE) {
        continue;
      }
      const arg = prop.arg as SimpleExpressionNode | undefined;
      // A dynamic argument, as in `:[args.key]`, reads an arg where no hole can stand.
      if (arg && !arg.isStatic && /\bargs\b/.test(arg.content)) {
        return false;
      }
      if (!prop.exp) {
        continue;
      }
      const exp = prop.exp as SimpleExpressionNode;
      const { start, end } = prop.loc;
      // `v-bind="args"` passes every arg but the slots and the attributes written after it, which
      // win; see `spreadArgs`.
      if (prop.name === 'bind' && !arg && exp.content.trim() === 'args') {
        const written = node.props.map(attributeName);
        const names = (props: (string | undefined)[]) =>
          props.flatMap((name) => (name === undefined ? [] : spellings(name)));
        const own = [...slots, ...names(written.slice(index + 1))];
        const words = [
          ...names(written.slice(0, index)).map((name) => `^${name}`),
          ...own.map((name) => `-${name}`),
        ];
        // An arg the static snippet hoists is its `const`, bound after the spread leaves it out.
        const consts = [...hoisted]
          .filter((name) => !own.includes(name) && !words.includes(`^${name}`))
          .filter((name) => /^[A-Za-z_][\w-]*$/.test(name))
          .sort((a, b) => a.localeCompare(b))
          .map((name) => [name, constFor(name)!]);
        const constWords = consts.map(([name]) => `-${name}`);
        const constAttributes = consts.map(([name, binding]) => ` :${name}="${binding}"`);
        edits.push({
          start: start.offset,
          end: end.offset,
          text:
            hole('props', ...[...words, ...constWords].map(holeWord)) + constAttributes.join(''),
        });
        continue;
      }
      // `v-model="args.open"` binds a ref that starts as the arg, as the static snippet writes it.
      const model = prop.name === 'model' && /^args\.([A-Za-z_$][\w$]*)$/.exec(exp.content.trim());
      if (model) {
        const text = hoistModelRef(model[1]!, hole('value', model[1]!, 'script'), ctx);
        edits.push({ start: exp.loc.start.offset, end: exp.loc.end.offset, text });
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
      const quote = template[exp.loc.start.offset - 1];
      const holes = argHoles(exp, template, quote, constFor, (word) =>
        name !== undefined && owned
          ? { start: start.offset, end: end.offset, text: hole('attr', name, holeWord(word)) }
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

  if (!root.children.every(visit) || invalid) {
    return undefined;
  }
  let templateCode = template;
  for (const { start, end, text } of edits.sort((a, b) => b.start - a.start)) {
    templateCode = templateCode.slice(0, start) + text + templateCode.slice(end);
  }
  // A statement reads its args as code in the `<script>`, which the `script` word says, and `;`
  // that it starts the statement after one without a `;`.
  ctx.statements = statements.map((statement, index) =>
    setupStatementCode(
      statement,
      statements[index - 1],
      ({ name, operand }, _, startsLine) =>
        constFor(name) ??
        hole(operand ? 'operand' : 'value', holeWord(name), 'script', ...(startsLine ? [';'] : []))
    )
  );
  const code = renderPreparedSfcSnippet({ templateCode, ctx });
  return hasHoleBracket(code) ? code : undefined;
}

// A value hole for each `args.label` an expression reads, its `const` for an arg that has one, or
// the `whole` edit when it is nothing but that read; `undefined` when it reads `args` another way.
// A hole in an attribute value written in single quotes says so with a `'` word.
function argHoles(
  exp: SimpleExpressionNode,
  template: string,
  quote: string | undefined,
  constFor: (name: string) => string | undefined,
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
      t.isMemberExpression(parent, { object: node }) &&
      (!parent.computed && t.isIdentifier(parent.property)
        ? parent.property.name
        : parent.computed && t.isStringLiteral(parent.property) && parent.property.value);
    const around = ancestors.slice(0, -1).map((ancestor) => ancestor.node);
    const [above] = around.reverse();
    // The target of a write, as in `args.count++`, is no read and stays as written.
    if (
      name &&
      (t.isAssignmentExpression(above, { left: parent }) ||
        t.isUpdateExpression(above) ||
        t.isUnaryExpression(above, { operator: 'delete' }))
    ) {
      return;
    }
    const kind = isOperand(parent!, around) ? 'operand' : 'value';
    if (!name) {
      holes.push(undefined);
      return;
    }
    const at = { start: offset + parent.start!, end: offset + parent.end! };
    const binding = constFor(name);
    const quoted = quote === '"' || quote === "'";
    holes.push(
      binding !== undefined
        ? { ...at, text: binding }
        : (parent === ast && whole(name)) ||
            (quoted
              ? { ...at, text: hole(kind, holeWord(name), ...(quote === "'" ? ["'"] : [])) }
              : undefined)
    );
  });
  return holes.every((edit) => edit !== undefined) ? holes : undefined;
}

// The arg names that set the same prop as an attribute: `max-count` and `maxCount`.
const spellings = (name: string) => [
  ...new Set([
    name,
    name.replace(/-(\w)/g, (_, letter: string) => letter.toUpperCase()),
    name.replace(/\B([A-Z])/g, '-$1').toLowerCase(),
  ]),
];

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
