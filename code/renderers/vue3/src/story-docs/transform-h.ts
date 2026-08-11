import { types as t } from 'storybook/internal/babel';
import {
  keyOf,
  returnedExpressionPath,
  unwrapValue,
  type ImportBinding,
} from 'storybook/internal/csf-tools';

import { importStatementForBinding, wrapSlotContent } from './ast-utils.ts';
import type { ClassifiedArg, ClassifiedPropLikeArg, ClassifiedSlotArg } from './classify-args.ts';
import { classifyValue } from './classify-value.ts';
import {
  createRenderContext,
  formatRenderedProp,
  partitionArgsByRole,
  renderEventArg,
  renderInlinePrimitiveValue,
  renderPreparedSfcSnippet,
  renderPropLikeArg,
  renderSlotArgContent,
  type FunctionSlotRenderer,
  type RenderContext,
} from './render-sfc.ts';

export interface TransformHInput {
  /** Render-function expression to convert into Vue markup. */
  node: t.Node;
  /** Merged and classified CSF args visible to the render function. */
  args: ClassifiedArg[];
  /** Name of the render function's args parameter. */
  argsParam?: string;
  /** Import bindings from the CSF module. */
  importBindings: Map<string, ImportBinding>;
}

export interface TransformHResult {
  /** Vue SFC snippet for the docs payload. */
  snippet: string;
  /** Import statements for components used by the h tree. */
  imports: string[];
}

export interface RenderHSlotFunctionInput {
  /** Slot function expression from CSF args. */
  node: t.ArrowFunctionExpression | t.FunctionExpression;
  /** Imports and variables referenced by the prepared template markup. */
  ctx: RenderContext;
  /** Import bindings from the CSF module. */
  importBindings: Map<string, ImportBinding>;
}

export interface RenderHSlotFunctionResult {
  /** Rendered slot children markup. */
  content: string;
  /** Import statements for components used by the slot tree. */
  imports: string[];
}

type HRenderOptions = {
  args: ClassifiedArg[];
  argsParam?: string;
  ctx: RenderContext;
  importBindings: Map<string, ImportBinding>;
  usedImports: Set<string>;
};

type HTag = {
  name: string;
  selfClosing: boolean;
};

type HArguments = {
  props?: t.Node;
  children?: t.Node;
};

const H_FUNCTION = 'h';

/** Transform a statically decidable Vue `h()` tree into an SFC snippet. */
export function transformH(input: TransformHInput): TransformHResult | undefined {
  const ctx = createRenderContext();
  const usedImports = new Set<string>();
  const templateCode = renderHNode(input.node, {
    args: input.args,
    argsParam: input.argsParam,
    ctx,
    importBindings: input.importBindings,
    usedImports,
  });

  return templateCode
    ? {
        snippet: renderPreparedSfcSnippet({ templateCode, ctx }),
        imports: Array.from(usedImports),
      }
    : undefined;
}

/** Render a zero-argument slot function whose body is a static `h()` child tree. */
export function renderHSlotFunction(
  input: RenderHSlotFunctionInput
): RenderHSlotFunctionResult | undefined {
  if (input.node.params.length > 0) {
    return undefined;
  }

  const returned = returnedExpressionPath(input.node);
  if (!returned) {
    return undefined;
  }

  const usedImports = new Set<string>();
  const content = renderHNode(returned, {
    args: [],
    ctx: input.ctx,
    importBindings: input.importBindings,
    usedImports,
  });

  return content ? { content, imports: Array.from(usedImports) } : undefined;
}

// h('div', { class: 'row' }, 'Hi') -> <div class="row">Hi</div>
function renderHNode(node: t.Node, options: HRenderOptions): string | undefined {
  const value = unwrapValue(node);
  if (!value || !t.isCallExpression(value) || !t.isIdentifier(value.callee, { name: H_FUNCTION })) {
    return undefined;
  }

  const tag = renderTag(value.arguments[0], options);
  const hArguments = splitHArguments(value.arguments.slice(1));
  if (!tag || !hArguments || value.arguments.length > 3) {
    return undefined;
  }

  const props = renderProps(hArguments.props, options);
  if (props === undefined) {
    return undefined;
  }

  const children = renderChildren(hArguments.children, options);
  if (children === undefined) {
    return undefined;
  }

  if (props.slotChildren.length > 0) {
    if (children.length > 0) {
      return undefined;
    }
    children.push(...props.slotChildren);
  }

  const openTag = [tag.name, ...props.attributes].join(' ');
  return children.length > 0
    ? `<${openTag}>${children.join('')}</${tag.name}>`
    : tag.selfClosing
      ? `<${openTag} />`
      : `<${openTag}></${tag.name}>`;
}

function renderTag(node: t.Node | undefined | null, options: HRenderOptions): HTag | undefined {
  const tag = unwrapValue(node);
  if (!tag) {
    return undefined;
  }

  if (t.isStringLiteral(tag)) {
    return { name: tag.value, selfClosing: /^[A-Z]/.test(tag.value) };
  }

  if (!t.isIdentifier(tag)) {
    return undefined;
  }

  const binding = options.importBindings.get(tag.name);
  if (!binding || binding.importName === '*') {
    return undefined;
  }

  options.usedImports.add(importStatementForBinding(tag.name, binding));
  return { name: tag.name, selfClosing: true };
}

function splitHArguments(
  args: (t.Node | t.SpreadElement | t.ArgumentPlaceholder)[]
): HArguments | undefined {
  if (args.some((arg) => t.isSpreadElement(arg) || t.isArgumentPlaceholder(arg))) {
    return undefined;
  }
  if (args.length === 0) {
    return {};
  }
  // h(tag, propsOrChildren)
  if (args.length === 1) {
    return isChildrenArgument(args[0]) ? { children: args[0] } : { props: args[0] };
  }
  // h(tag, props, children)
  if (args.length === 2) {
    return { props: args[0], children: args[1] };
  }
  return undefined;
}

// h(tag, 'Hi'), h(tag, ['Hi']), h(tag, h('b')) -> the argument is children, not props
function isChildrenArgument(node: t.Node): boolean {
  const value = unwrapValue(node);
  return (
    Boolean(value) &&
    (t.isStringLiteral(value) ||
      t.isArrayExpression(value) ||
      (t.isCallExpression(value) && t.isIdentifier(value.callee, { name: H_FUNCTION })))
  );
}

function renderProps(
  node: t.Node | undefined,
  options: HRenderOptions
): { attributes: string[]; slotChildren: string[] } | undefined {
  const propsByName = new Map<string, ClassifiedPropLikeArg>();
  const slotsByName = new Map<string, ClassifiedSlotArg>();

  if (node) {
    if (!collectProps(node, propsByName, slotsByName, options)) {
      return undefined;
    }
  }

  // If the story sets a prop and a slot with the same name, the slot takes precedence in the rendered snippet.
  const partitioned = partitionArgsByRole([...propsByName.values(), ...slotsByName.values()]);
  // Render the props and events as attributes, and the slots as children.
  const attributes = [
    ...partitioned.props.map((arg) => formatRenderedProp(renderPropLikeArg(arg, options.ctx))),
    ...partitioned.events.map((arg) => formatRenderedProp(renderEventArg(arg, options.ctx))),
  ];
  const slotChildren: string[] = [];
  for (const slot of partitioned.slots) {
    const content = renderSlotArgContent(slot, options.ctx, hFunctionSlotRenderer(options));
    // A function slot without renderable content would misrepresent the story, so bail.
    if (content === undefined) {
      return undefined;
    }
    slotChildren.push(wrapSlotContent(slot.name, content));
  }

  return { attributes, slotChildren };
}

function hFunctionSlotRenderer(options: HRenderOptions): FunctionSlotRenderer {
  return (value, ctx) => {
    const rendered = renderHSlotFunction({
      node: value,
      ctx,
      importBindings: options.importBindings,
    });
    if (!rendered) {
      return undefined;
    }
    for (const importStatement of rendered.imports) {
      options.usedImports.add(importStatement);
    }
    return rendered.content;
  };
}

// h(tag, null), h(tag, args), h(tag, { ...args, label: 'Hi' })
function collectProps(
  node: t.Node,
  propsByName: Map<string, ClassifiedPropLikeArg>,
  slotsByName: Map<string, ClassifiedSlotArg>,
  options: HRenderOptions
): boolean {
  const value = unwrapValue(node);
  if (!value) {
    return false;
  }

  if (t.isNullLiteral(value)) {
    return true;
  }

  if (isArgsIdentifier(value, options.argsParam)) {
    expandArgs(propsByName, slotsByName, options.args);
    return true;
  }

  if (!t.isObjectExpression(value)) {
    return false;
  }

  for (const property of value.properties) {
    if (t.isSpreadElement(property)) {
      if (!isArgsIdentifier(property.argument, options.argsParam)) {
        return false;
      }
      expandArgs(propsByName, slotsByName, options.args);
      continue;
    }

    if (!t.isObjectProperty(property)) {
      return false;
    }

    const name = keyOf(property);
    if (!name) {
      return false;
    }

    const arg = argForObjectProperty(name, property.value, options);
    if (!arg) {
      return false;
    }

    if (arg.role === 'slot') {
      slotsByName.set(name, arg);
    } else {
      propsByName.set(name, arg);
    }
  }

  return true;
}

function expandArgs(
  propsByName: Map<string, ClassifiedPropLikeArg>,
  slotsByName: Map<string, ClassifiedSlotArg>,
  args: ClassifiedArg[]
): void {
  for (const arg of args) {
    if (arg.role === 'slot') {
      slotsByName.set(arg.name, arg);
    } else {
      propsByName.set(arg.name, arg);
    }
  }
}

// label: args.label -> the classified arg holding the value the story supplied
function argForObjectProperty(
  name: string,
  value: t.Node,
  options: HRenderOptions
): ClassifiedArg | undefined {
  const argValue = substituteArgsMember(value, options);
  if (!argValue || !isStaticValue(argValue, options)) {
    return undefined;
  }

  const plan = classifyValue(argValue);
  if (plan.kind !== 'inline' && plan.kind !== 'hoist') {
    return undefined;
  }

  const existing = options.args.find((arg) => arg.name === name);
  if (existing?.role === 'slot') {
    return { name, value: argValue, role: 'slot', plan };
  }
  return {
    name,
    value: argValue,
    role: existing?.role ?? 'prop',
    ...(existing?.role === 'event' && existing.eventName ? { eventName: existing.eventName } : {}),
    plan,
  };
}

// h(tag, { header: () => h('span') }) -> named slots; h(tag, 'Hi') -> one child
function renderChildren(node: t.Node | undefined, options: HRenderOptions): string[] | undefined {
  if (!node) {
    return [];
  }

  const value = unwrapValue(node);
  if (!value) {
    return undefined;
  }

  if (t.isObjectExpression(value)) {
    return renderSlotsObject(value, options);
  }

  const child = renderChildValue(value, options);
  return child === undefined ? undefined : [child];
}

// 'Hi', h('b', 'Hi'), or ['a', h('b', 'c')] -> markup
function renderChildValue(node: t.Node, options: HRenderOptions): string | undefined {
  const value = substituteArgsMember(node, options);
  if (!value) {
    return undefined;
  }

  const unwrapped = unwrapValue(value);
  if (!unwrapped) {
    return undefined;
  }

  if (t.isCallExpression(unwrapped)) {
    return t.isIdentifier(unwrapped.callee, { name: H_FUNCTION })
      ? renderHNode(unwrapped, options)
      : undefined;
  }

  if (t.isArrayExpression(unwrapped)) {
    const children: string[] = [];
    for (const element of unwrapped.elements) {
      if (!element || t.isSpreadElement(element)) {
        return undefined;
      }
      const child = renderChildValue(element, options);
      if (child === undefined) {
        return undefined;
      }
      children.push(child);
    }
    return children.join('');
  }

  return renderInlinePrimitiveValue(unwrapped);
}

// { header: () => h('span', 'Hi') } -> <template #header><span>Hi</span></template>
function renderSlotsObject(
  value: t.ObjectExpression,
  options: HRenderOptions
): string[] | undefined {
  const slots: string[] = [];

  for (const property of value.properties) {
    if (!t.isObjectProperty(property)) {
      return undefined;
    }

    const name = keyOf(property);
    const slotFunction = unwrapValue(property.value);
    if (
      !name ||
      !slotFunction ||
      (!t.isArrowFunctionExpression(slotFunction) && !t.isFunctionExpression(slotFunction))
    ) {
      return undefined;
    }

    const rendered = renderHSlotFunction({
      node: slotFunction,
      ctx: options.ctx,
      importBindings: options.importBindings,
    });
    if (!rendered) {
      return undefined;
    }
    for (const importStatement of rendered.imports) {
      options.usedImports.add(importStatement);
    }
    slots.push(wrapSlotContent(name, rendered.content));
  }

  return slots;
}

// args.label -> the value node classified for 'label'
function substituteArgsMember(node: t.Node, options: HRenderOptions): t.Node | undefined {
  const value = unwrapValue(node);
  if (!options.argsParam || !t.isMemberExpression(value) || value.computed) {
    return value;
  }

  const property = value.property;
  if (!t.isIdentifier(value.object, { name: options.argsParam }) || !t.isIdentifier(property)) {
    return value;
  }

  const arg = options.args.find((candidate) => candidate.name === property.name);
  return arg?.role === 'slot' ? undefined : arg?.value;
}

function isStaticValue(node: t.Node, options: HRenderOptions): boolean {
  const value = unwrapValue(node);
  if (!value) {
    return false;
  }

  if (isArgsIdentifier(value, options.argsParam)) {
    return true;
  }

  if (
    t.isStringLiteral(value) ||
    t.isBooleanLiteral(value) ||
    t.isNumericLiteral(value) ||
    t.isBigIntLiteral(value) ||
    t.isNullLiteral(value)
  ) {
    return true;
  }

  if (t.isObjectExpression(value)) {
    return value.properties.every((property) => {
      return (
        t.isObjectProperty(property) &&
        keyOf(property) !== null &&
        isStaticValue(property.value, options)
      );
    });
  }

  if (t.isArrayExpression(value)) {
    return value.elements.every((element) => {
      if (!element || t.isSpreadElement(element)) {
        return false;
      }
      return isStaticValue(element, options);
    });
  }

  if (t.isUnaryExpression(value)) {
    return t.isNumericLiteral(value.argument) || t.isBigIntLiteral(value.argument);
  }

  return false;
}

function isArgsIdentifier(node: t.Node, argsParam: string | undefined): boolean {
  const value = unwrapValue(node);
  return Boolean(argsParam && t.isIdentifier(value, { name: argsParam }));
}
