import { types as t } from 'storybook/internal/babel';

import type { ClassifiedArg } from './classify-args.ts';
import { printValue, unwrapValue } from './classify-value.ts';

export interface RenderSfcInput {
  /** Component identifier from CSF meta.component. */
  componentName: string;
  /** Classified args to render into the SFC snippet. */
  args: ClassifiedArg[];
}

interface RenderContext {
  /** Imports hoisted into `<script setup>`. */
  imports: Record<string, Set<string>>;
  bindings: Set<string>;
  variables: Map<string, string>;
}

interface RenderedProp {
  /** Source arg name. */
  name: string;
  /** Vue template attribute. */
  attribute: string;
}

const VUE_PACKAGE = 'vue';

/** Render classified CSF args into the same SFC block shape as Vue's runtime source decorator. */
export function renderSfcSnippet(input: RenderSfcInput): string {
  const ctx = createRenderContext(input.args);
  // Sorted before rendering, so hoisted consts are declared in the order their attributes appear.
  const props = input.args
    .filter((arg) => arg.role === 'model' || arg.role === 'prop')
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((arg) => renderPropLikeArg(arg, ctx).attribute);
  const events = input.args
    .filter((arg) => arg.role === 'event')
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((arg) => renderEventArg(arg, ctx).attribute);
  const slotSourceCode = input.args
    .filter((arg) => arg.role === 'slot')
    .sort((a, b) => slotSortKey(a.name).localeCompare(slotSortKey(b.name)))
    .map((arg) => renderSlotArg(arg, ctx))
    .join('\n\n');
  const openTag = [input.componentName, ...props, ...events].join(' ');
  const templateCode = slotSourceCode
    ? `<${openTag}> ${slotSourceCode} </${input.componentName}>`
    : `<${openTag} />`;
  const template = `<template>\n  ${templateCode}\n</template>`;
  const script = renderScript(ctx);

  return script ? `${script}\n\n${template}` : template;
}

function renderPropLikeArg(arg: ClassifiedArg, ctx: RenderContext): RenderedProp {
  return arg.role === 'model' ? renderModelArg(arg, ctx) : renderPropArg(arg, ctx);
}

function renderPropArg(arg: ClassifiedArg, ctx: RenderContext): RenderedProp {
  const value = unwrapValue(arg.value);

  if (arg.plan.kind === 'hoist') {
    return hoistedProp(arg, ctx, printValue(value));
  }

  if (value.type === 'BooleanLiteral') {
    return { name: arg.name, attribute: value.value ? arg.name : `:${arg.name}="false"` };
  }

  if (value.type === 'StringLiteral') {
    const quoted = quoteAttributeValue(value.value);
    // Both quote styles occur, so no attribute delimiter can carry the value verbatim.
    return quoted === undefined
      ? hoistedProp(arg, ctx, printValue(value))
      : { name: arg.name, attribute: `${arg.name}=${quoted}` };
  }

  return { name: arg.name, attribute: `:${arg.name}="${printValue(value)}"` };
}

function hoistedProp(arg: ClassifiedArg, ctx: RenderContext, source: string): RenderedProp {
  const bindingName = allocateBindingName(arg.name, ctx);
  ctx.variables.set(bindingName, source);
  return { name: arg.name, attribute: `:${arg.name}="${bindingName}"` };
}

function renderModelArg(arg: ClassifiedArg, ctx: RenderContext): RenderedProp {
  const bindingName = allocateBindingName(arg.name, ctx);
  ctx.variables.set(bindingName, `ref(${printValue(unwrapValue(arg.value))})`);

  const directive = arg.name === 'modelValue' ? 'v-model' : `v-model:${arg.name}`;
  return { name: arg.name, attribute: `${directive}="${bindingName}"` };
}

/** Listeners hoist their handler, because inline handlers would bloat the tag. */
function renderEventArg(arg: ClassifiedArg, ctx: RenderContext): RenderedProp {
  const bindingName = allocateBindingName(arg.name, ctx);
  ctx.variables.set(bindingName, printValue(unwrapValue(arg.value)));
  return { name: arg.name, attribute: `@${arg.eventName ?? arg.name}="${bindingName}"` };
}

function renderSlotArg(arg: ClassifiedArg, ctx: RenderContext): string {
  const content = renderSlotContent(arg, ctx);
  return arg.name === 'default' ? content : `<template #${arg.name}>${content}</template>`;
}

/**
 * Slot children for one classified slot arg.
 *
 * Text-shaped literals become text directly; everything else is interpolated, since a hoisted
 * `<script setup>` binding cannot reach slot content any other way.
 */
function renderSlotContent(arg: ClassifiedArg, ctx: RenderContext): string {
  const value = unwrapValue(arg.value);

  if (arg.plan.kind === 'inline') {
    switch (value.type) {
      case 'StringLiteral':
        return value.value;
      case 'NumericLiteral':
      case 'BooleanLiteral':
        return String(value.value);
      default:
        return `{{ ${printValue(value)} }}`;
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

function createRenderContext(args: ClassifiedArg[]): RenderContext {
  const imports: RenderContext['imports'] = {};
  const bindings = new Set<string>();

  if (args.some((arg) => arg.role === 'model')) {
    imports[VUE_PACKAGE] = new Set(['ref']);
    bindings.add('ref');
  }

  return { imports, bindings, variables: new Map() };
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
  if (!value.includes('"')) {
    return `"${value}"`;
  }
  if (!value.includes("'")) {
    return `'${value}'`;
  }
  return undefined;
}

function slotSortKey(name: string): string {
  return name === 'default' ? '' : name;
}
