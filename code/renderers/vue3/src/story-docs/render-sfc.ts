import { types as t } from 'storybook/internal/babel';

import type { ClassifiedArg } from './classify-args.ts';
import { printValue, unwrapValue } from './classify-value.ts';

export interface RenderSfcInput {
  /** Component identifier from CSF meta.component. */
  componentName: string;
  /** Classified args to render into the SFC snippet. */
  args: ClassifiedArg[];
}

export interface RenderSfcMarkupInput {
  /** Rendered Vue template markup without the wrapping `<template>` block. */
  templateCode: string;
  /** Imports and variables referenced by the prepared template markup. */
  ctx: RenderContext;
}

export interface RenderContext {
  /** Imports hoisted into `<script setup>`. */
  imports: Record<string, Set<string>>;
  /** Identifiers already taken in `<script setup>` scope. */
  bindings: Set<string>;
  /** Const declarations hoisted into `<script setup>`. */
  variables: Map<string, string>;
}

interface RenderedProp {
  /** Vue template attribute. */
  attrName: string;
  /** Vue template attribute value, or undefined for a bare attribute. */
  value?: string;
}

const VUE_PACKAGE = 'vue';

// Raw slot text must survive Vue's parse and whitespace condensing unchanged.
const UNSAFE_SLOT_TEXT_REGEXP = /^\s|\s$|[<&]|{{/;

/** Render classified CSF args into the same SFC block shape as Vue's runtime source decorator. */
export function renderSfcSnippet(input: RenderSfcInput): string {
  const ctx = createRenderContext();
  const partitioned = partitionArgsByRole(input.args);
  const props = partitioned.props.map((arg) => formatRenderedProp(renderPropLikeArg(arg, ctx)));
  const events = partitioned.events.map((arg) => formatRenderedProp(renderEventArg(arg, ctx)));
  const slotSourceCode = partitioned.slots.map((arg) => renderSlotArg(arg, ctx)).join('\n');
  const openTag = [input.componentName, ...props, ...events].join(' ');
  const templateCode = slotSourceCode
    ? `<${openTag}>\n${indent(slotSourceCode)}\n</${input.componentName}>`
    : `<${openTag} />`;

  return renderPreparedSfcSnippet({ templateCode, ctx });
}

/** Create an isolated hoist context for one generated snippet. */
export function createRenderContext(): RenderContext {
  // `ref` is reserved up front so no hoisted arg can shadow the Vue import a v-model may need.
  return { imports: {}, bindings: new Set(['ref']), variables: new Map() };
}

/** Wrap prepared template markup with the shared SFC block assembly. */
export function renderPreparedSfcSnippet(input: RenderSfcMarkupInput): string {
  const template = `<template>\n${indent(input.templateCode)}\n</template>`;
  const script = renderScript(input.ctx);

  return script ? `${script}\n\n${template}` : template;
}

/**
 * Attribute text for a `v-bind="args"` expansion, or `undefined` when no faithful expansion
 * exists.
 *
 * At runtime `v-bind` spreads args one-way as props and listeners only: an arg named after a slot
 * never fills that slot, and a `modelValue` arg carries no update binding. Slot args therefore
 * bail, and model args render as plain prop bindings. A name colliding with an attribute already
 * on the element bails too, since the winner depends on source order and merge behavior.
 */
export function renderArgsBindingAttributes(
  args: ClassifiedArg[],
  existingAttributeNames: Set<string>,
  ctx: RenderContext
): string | undefined {
  const partitioned = partitionArgsByRole(args);
  if (partitioned.slots.length > 0) {
    return undefined;
  }

  const collides = [
    ...partitioned.props.map((arg) => arg.name),
    ...partitioned.events.map((arg) => arg.eventName ?? arg.name),
  ].some((name) => existingAttributeNames.has(name));
  if (collides) {
    return undefined;
  }

  const props = partitioned.props.map((arg) =>
    renderPropValue(
      { attributeName: arg.name, variableName: arg.name, value: arg.value, plan: arg.plan },
      ctx
    )
  );
  const events = partitioned.events.map((arg) => renderEventArg(arg, ctx));
  return [...props, ...events].map(formatRenderedProp).join(' ');
}

/** Attribute text for one `:prop="args.x"` binding rewritten to the arg's static value. */
export function renderBoundArgAttribute(
  attributeName: string,
  arg: ClassifiedArg,
  ctx: RenderContext
): string {
  return formatRenderedProp(
    renderPropValue(
      { attributeName, variableName: arg.name, value: arg.value, plan: arg.plan },
      ctx
    )
  );
}

/** Hoist an arg value into `<script setup>` and return the binding name that replaces it. */
export function hoistArgValue(name: string, value: t.Node, ctx: RenderContext): string {
  const bindingName = allocateBindingName(name, ctx);
  ctx.variables.set(bindingName, printValue(unwrapValue(value)));
  return bindingName;
}

/** Hoist an arg value as a `ref` for a `v-model` binding. */
export function hoistModelRef(name: string, value: t.Node, ctx: RenderContext): string {
  (ctx.imports[VUE_PACKAGE] ??= new Set()).add('ref');
  const bindingName = allocateBindingName(name, ctx);
  ctx.variables.set(bindingName, `ref(${printValue(unwrapValue(value))})`);
  return bindingName;
}

/** Inline primitive arg values that do not require script setup hoists. */
export function renderInlinePrimitiveValue(node: t.Node): string | undefined {
  const value = unwrapValue(node);

  switch (value.type) {
    case 'StringLiteral':
      return value.value;
    case 'NumericLiteral':
    case 'BooleanLiteral':
      return String(value.value);
    default:
      return undefined;
  }
}

// Split by role, each group sorted so hoisted consts are declared in attribute order.
function partitionArgsByRole(args: ClassifiedArg[]): {
  props: ClassifiedArg[];
  events: ClassifiedArg[];
  slots: ClassifiedArg[];
} {
  return {
    props: args
      .filter((arg) => arg.role === 'model' || arg.role === 'prop')
      .sort((a, b) => a.name.localeCompare(b.name)),
    events: args.filter((arg) => arg.role === 'event').sort((a, b) => a.name.localeCompare(b.name)),
    slots: args
      .filter((arg) => arg.role === 'slot')
      .sort((a, b) => slotSortKey(a.name).localeCompare(slotSortKey(b.name))),
  };
}

interface RenderPropValueInput {
  attributeName: string;
  variableName: string;
  value: t.Node;
  plan: ClassifiedArg['plan'];
}

function renderPropLikeArg(arg: ClassifiedArg, ctx: RenderContext): RenderedProp {
  return arg.role === 'model' ? renderModelArg(arg, ctx) : renderPropArg(arg, ctx);
}

function renderPropArg(arg: ClassifiedArg, ctx: RenderContext): RenderedProp {
  return renderPropValue(
    { attributeName: arg.name, variableName: arg.name, value: arg.value, plan: arg.plan },
    ctx
  );
}

function renderPropValue(input: RenderPropValueInput, ctx: RenderContext): RenderedProp {
  const value = unwrapValue(input.value);

  if (input.plan.kind === 'hoist') {
    return hoistedProp(input, ctx, printValue(value));
  }

  if (value.type === 'BooleanLiteral') {
    return value.value
      ? { attrName: input.attributeName }
      : { attrName: `:${input.attributeName}`, value: 'false' };
  }

  if (value.type === 'StringLiteral') {
    const quoted = quoteAttributeValue(value.value);
    return quoted === undefined
      ? hoistedProp(input, ctx, printValue(value))
      : { attrName: input.attributeName, value: value.value };
  }

  return { attrName: `:${input.attributeName}`, value: printValue(value) };
}

function hoistedProp(
  input: Pick<RenderPropValueInput, 'attributeName' | 'variableName'>,
  ctx: RenderContext,
  source: string
): RenderedProp {
  const bindingName = allocateBindingName(input.variableName, ctx);
  ctx.variables.set(bindingName, source);
  return { attrName: `:${input.attributeName}`, value: bindingName };
}

function renderModelArg(arg: ClassifiedArg, ctx: RenderContext): RenderedProp {
  const bindingName = hoistModelRef(arg.name, arg.value, ctx);
  const directive = arg.name === 'modelValue' ? 'v-model' : `v-model:${arg.name}`;
  return { attrName: directive, value: bindingName };
}

// Listeners hoist their handler, because inline handlers would bloat the tag.
function renderEventArg(arg: ClassifiedArg, ctx: RenderContext): RenderedProp {
  const bindingName = allocateBindingName(arg.name, ctx);
  ctx.variables.set(bindingName, printValue(unwrapValue(arg.value)));
  return { attrName: `@${arg.eventName ?? arg.name}`, value: bindingName };
}

function renderSlotArg(arg: ClassifiedArg, ctx: RenderContext): string {
  const content = renderSlotContent(arg, ctx);
  return arg.name === 'default'
    ? content
    : `<template #${arg.name}>\n${indent(content)}\n</template>`;
}

/**
 * Slot children for one classified slot arg.
 *
 * Safe text becomes raw slot content; hoisted values and text the template parser would alter are
 * interpolated, since that is the only way slot content can reach a `<script setup>` binding.
 */
function renderSlotContent(arg: ClassifiedArg, ctx: RenderContext): string {
  const value = unwrapValue(arg.value);

  if (arg.plan.kind === 'inline') {
    const text = renderInlinePrimitiveValue(value);
    if (text === undefined) {
      return `{{ ${printValue(value)} }}`;
    }
    if (!UNSAFE_SLOT_TEXT_REGEXP.test(text)) {
      return text;
    }
  }

  const bindingName = allocateBindingName(arg.name, ctx);
  ctx.variables.set(bindingName, printValue(value));
  return `{{ ${bindingName} }}`;
}

function renderScript(ctx: RenderContext): string | undefined {
  const importsCode = Object.entries(ctx.imports)
    .map(([packageName, imports]) => {
      return `import { ${Array.from(imports.values()).sort().join(', ')} } from "${packageName}";`;
    })
    .join('\n');
  const variablesCode = Array.from(ctx.variables.entries())
    .map(([name, value]) => `const ${name} = ${value};`)
    .join('\n\n');

  if (!importsCode && !variablesCode) {
    return undefined;
  }

  return `<script lang="ts" setup>
${importsCode ? `${importsCode}\n\n${variablesCode}` : variablesCode}
</script>`;
}

function allocateBindingName(name: string, ctx: RenderContext): string {
  const baseName = t.toIdentifier(name);
  let bindingName = baseName;
  let suffix = 2;

  while (ctx.bindings.has(bindingName)) {
    bindingName = `${baseName}${suffix}`;
    suffix += 1;
  }

  ctx.bindings.add(bindingName);
  return bindingName;
}

/**
 * Quoted attribute value, or `undefined` when it must be hoisted: both quote styles occur, or the
 * value contains `&` and re-parsing the attribute could decode it into a different prop value.
 */
function quoteAttributeValue(value: string): string | undefined {
  if (value.includes('&')) {
    return undefined;
  }
  if (!value.includes('"')) {
    return `"${value}"`;
  }
  if (!value.includes("'")) {
    return `'${value}'`;
  }
  return undefined;
}

function formatRenderedProp(prop: RenderedProp): string {
  if (prop.value === undefined) {
    return prop.attrName;
  }

  if (!prop.attrName.startsWith(':') && !prop.attrName.startsWith('@')) {
    // renderPropValue hoists strings that cannot be quoted inline, so this is always quotable.
    return `${prop.attrName}=${quoteAttributeValue(prop.value)!}`;
  }

  return `${prop.attrName}="${prop.value}"`;
}

function slotSortKey(name: string): string {
  return name === 'default' ? '' : name;
}

function indent(source: string): string {
  return source
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n');
}
