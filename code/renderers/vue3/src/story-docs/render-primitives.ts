import { types as t } from 'storybook/internal/babel';
import {
  buildImportStatements,
  unwrapExpression,
  type ImportBinding,
} from 'storybook/internal/csf-tools';

import type {
  ClassifiedArg,
  ClassifiedPropLikeArg,
  ClassifiedSlotArg,
  RenderableValuePlan,
} from './classify-args.ts';
import { printValue } from './classify-value.ts';

export interface RenderSfcMarkupInput {
  /** Rendered Vue template markup without the wrapping `<template>` block. */
  templateCode: string;
  /** Imports and variables referenced by the prepared template markup. */
  ctx: RenderContext;
}

/**
 * Everything one generated snippet accumulates while its markup is produced.
 *
 * Passed to every renderer, so nothing has to be threaded through as an extra parameter and a
 * snippet that bails discards its imports and hoists with it.
 */
export interface RenderContext {
  /** Imports hoisted into `<script setup>`. */
  imports: Record<string, Set<string>>;
  /** Identifiers already taken in `<script setup>` scope. */
  bindings: Set<string>;
  /** Const declarations hoisted into `<script setup>`. */
  variables: Map<string, string>;
  /** Import statements for components the rendered markup references. */
  componentImports: Set<string>;
}

export interface RenderPropValueInput {
  /** Vue template attribute name. */
  attributeName: string;
  /** JavaScript identifier referenced by hoisted values. */
  variableName: string;
  /** CSF arg value expression. */
  value: t.Node;
  /** Render plan the value was classified with. */
  plan: RenderableValuePlan;
}

export interface RenderedProp {
  /** Vue template attribute. */
  attrName: string;
  /** Vue template attribute value, or undefined for a bare attribute. */
  value?: string;
}

const VUE_PACKAGE = 'vue';

/**
 * Split classified args by role, each group sorted in stable attribute order.
 *
 * Sorted before rendering, so hoisted consts are declared in the order their attributes appear.
 */
export function partitionArgsByRole(args: ClassifiedArg[]): {
  props: ClassifiedPropLikeArg[];
  events: ClassifiedPropLikeArg[];
  slots: ClassifiedSlotArg[];
} {
  return {
    props: args
      .filter((arg): arg is ClassifiedPropLikeArg => arg.role === 'model' || arg.role === 'prop')
      .sort((a, b) => a.name.localeCompare(b.name)),
    events: args
      .filter((arg): arg is ClassifiedPropLikeArg => arg.role === 'event')
      .sort((a, b) => a.name.localeCompare(b.name)),
    slots: args
      .filter((arg): arg is ClassifiedSlotArg => arg.role === 'slot')
      .sort((a, b) => slotSortKey(a.name).localeCompare(slotSortKey(b.name))),
  };
}

/** Create an isolated hoist context for one generated snippet. */
export function createRenderContext(): RenderContext {
  return {
    imports: {},
    // `ref` is reserved up front so no hoisted arg can shadow the Vue import a v-model may need.
    bindings: new Set(['ref']),
    variables: new Map(),
    componentImports: new Set(),
  };
}

/** Wrap prepared template markup with the shared SFC block assembly. */
export function renderPreparedSfcSnippet(input: RenderSfcMarkupInput): string {
  const template = `<template>\n${indent(input.templateCode)}\n</template>`;
  const script = renderScript(input.ctx);

  return script ? `${script}\n\n${template}` : template;
}

/** Render a classified prop or model arg into a Vue template attribute. */
export function renderPropLikeArg(arg: ClassifiedPropLikeArg, ctx: RenderContext): RenderedProp {
  return arg.role === 'model' ? renderModelArg(arg, ctx) : renderPropArg(arg, ctx);
}

function renderPropArg(arg: ClassifiedPropLikeArg, ctx: RenderContext): RenderedProp {
  return renderPropValue(
    { attributeName: arg.name, variableName: arg.name, value: arg.value, plan: arg.plan },
    ctx
  );
}

/** Render a classified arg value into a Vue template attribute under a chosen attribute name. */
export function renderPropValue(input: RenderPropValueInput, ctx: RenderContext): RenderedProp {
  const value = unwrapExpression(input.value);

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

function renderModelArg(arg: ClassifiedPropLikeArg, ctx: RenderContext): RenderedProp {
  const bindingName = hoistModelRef(arg.name, arg.value, ctx);
  const directive = arg.name === 'modelValue' ? 'v-model' : `v-model:${arg.name}`;
  return { attrName: directive, value: bindingName };
}

/** Listeners hoist their handler, because inline handlers would bloat the tag. */
export function renderEventArg(arg: ClassifiedPropLikeArg, ctx: RenderContext): RenderedProp {
  const bindingName = allocateBindingName(arg.name, ctx);
  ctx.variables.set(bindingName, printValue(unwrapExpression(arg.value)));
  return { attrName: `@${arg.eventName ?? arg.name}`, value: bindingName };
}

/** Slot children for one classified slot arg with a renderable plan. */
export function renderSlotContent(
  arg: ClassifiedSlotArg,
  plan: RenderableValuePlan,
  ctx: RenderContext
): string {
  const value = unwrapExpression(arg.value);

  if (plan.kind === 'inline') {
    const source = inlinePrimitiveSource(value);
    if (source === undefined) {
      return `{{ ${printValue(value)} }}`;
    }
    // Vue's whitespace condensing would alter padded text, so it hoists to an interpolation.
    if (!/^\s|\s$/.test(source)) {
      return escapeTextContent(source);
    }
  }

  const bindingName = allocateBindingName(arg.name, ctx);
  ctx.variables.set(bindingName, printValue(value));
  return `{{ ${bindingName} }}`;
}

/** Source text of a primitive arg value that can appear directly in template text, unescaped. */
export function inlinePrimitiveSource(node: t.Node): string | undefined {
  const value = unwrapExpression(node);

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

/**
 * Escapes a string value so it reaches the reader as the text the story passed.
 *
 * Vue compiles the generated snippet, so an unescaped `<` opens a tag and `{{` opens an
 * interpolation, both of which would render something the story never produced.
 */
export function escapeTextContent(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('{{', '&#123;&#123;');
}

function renderScript(ctx: RenderContext): string | undefined {
  const importsCode = Object.entries(ctx.imports)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([packageName, imports]) => {
      return `import { ${Array.from(imports.values()).sort().join(', ')} } from "${packageName}";`;
    })
    .concat(Array.from(ctx.componentImports).sort())
    .join('\n');
  const variablesCode = Array.from(ctx.variables.entries())
    .map(([name, value]) => `const ${name} = ${value};`)
    .join('\n\n');

  if (!importsCode && !variablesCode) {
    return undefined;
  }

  const scriptCode =
    importsCode && variablesCode
      ? `${importsCode}\n\n${variablesCode}`
      : importsCode || variablesCode;

  return `<script lang="ts" setup>
${scriptCode}
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

/** Quoted attribute value, or `undefined` when both quote styles occur and it must be hoisted. */
function quoteAttributeValue(value: string): string | undefined {
  // Attribute values are entity-decoded on re-parse, so an `&` would come back as a different
  // string than the story set. Text content escapes instead; an attribute has to hoist.
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

/** Format one structured attribute at the SFC print boundary. */
export function formatRenderedProp(prop: RenderedProp): string {
  if (prop.value === undefined) {
    return prop.attrName;
  }

  if (!isVueExpressionAttribute(prop.attrName)) {
    // renderPropValue hoists strings mixing both quote styles, so this value is always quotable.
    return `${prop.attrName}=${quoteAttributeValue(prop.value)!}`;
  }

  return `${prop.attrName}="${prop.value}"`;
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
  arg: ClassifiedPropLikeArg,
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
  ctx.variables.set(bindingName, printValue(unwrapExpression(value)));
  return bindingName;
}

/** Hoist an arg value as a `ref` for a `v-model` binding. */
export function hoistModelRef(name: string, value: t.Node, ctx: RenderContext): string {
  (ctx.imports[VUE_PACKAGE] ??= new Set()).add('ref');
  const bindingName = allocateBindingName(name, ctx);
  ctx.variables.set(bindingName, `ref(${printValue(unwrapExpression(value))})`);
  return bindingName;
}

/**
 * Import statement binding a component tag, or `undefined` when no statement can name it.
 *
 * A namespace binding has no importable member to alias, so it yields no statement rather than an
 * import the snippet could not compile against.
 */
export function importStatementForBinding(
  localName: string,
  binding: ImportBinding | undefined
): string | undefined {
  if (!binding || binding.importName === '*') {
    return undefined;
  }

  return buildImportStatements({
    refs: [
      {
        importId: binding.importId,
        importName: binding.importName,
        localImportName: localName,
      },
    ],
  }).join('\n');
}

export function wrapSlotContent(name: string, content: string): string {
  return name === 'default' ? content : `<template #${name}>\n${indent(content)}\n</template>`;
}

export function indent(source: string): string {
  return source
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n');
}

function slotSortKey(name: string): string {
  return name === 'default' ? '' : name;
}

function isVueExpressionAttribute(name: string): boolean {
  return name.startsWith(':') || name.startsWith('@') || name.startsWith('v-');
}
