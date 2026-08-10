import { recast, types as t } from 'storybook/internal/babel';

import type { ClassifiedArg, ModelArg, PropArg, SlotArg } from './classify-args.ts';

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
  const props = input.args
    .filter((arg): arg is ModelArg | PropArg => arg.type === 'model' || arg.type === 'prop')
    .map((arg) => renderPropLikeArg(arg, ctx))
    .filter((prop): prop is RenderedProp => prop !== undefined)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((prop) => prop.attribute);
  const slotSourceCode = input.args
    .filter((arg): arg is SlotArg => arg.type === 'slot')
    .sort((a, b) => slotSortKey(a.name).localeCompare(slotSortKey(b.name)))
    .map((arg) => renderSlotArg(arg))
    .filter((slot): slot is string => slot !== undefined)
    .join('\n\n');
  const openTag = [input.componentName, ...props].join(' ');
  const templateCode = slotSourceCode
    ? `<${openTag}> ${slotSourceCode} </${input.componentName}>`
    : `<${openTag} />`;
  const template = `<template>\n  ${templateCode}\n</template>`;
  const script = renderScript(ctx);

  return script ? `${script}\n\n${template}` : template;
}

function renderPropLikeArg(arg: ModelArg | PropArg, ctx: RenderContext): RenderedProp | undefined {
  return arg.type === 'model' ? renderModelArg(arg, ctx) : renderPropArg(arg, ctx);
}

function renderPropArg(arg: PropArg, ctx: RenderContext): RenderedProp | undefined {
  const value = unwrapValue(arg.value);

  switch (value.type) {
    case 'StringLiteral':
      if (value.value === '') {
        return undefined;
      }
      {
        const quoted = quoteAttributeValue(value.value);
        if (quoted === undefined) {
          const bindingName = allocateBindingName(arg.name, ctx);
          ctx.variables.set(bindingName, printValue(value));
          return { name: arg.name, attribute: `:${arg.name}="${bindingName}"` };
        }
        return { name: arg.name, attribute: `${arg.name}=${quoted}` };
      }
    case 'BooleanLiteral':
      return {
        name: arg.name,
        attribute: value.value ? arg.name : `:${arg.name}="false"`,
      };
    case 'NumericLiteral':
    case 'BigIntLiteral':
    case 'NullLiteral':
    case 'CallExpression':
    case 'UnaryExpression':
      return { name: arg.name, attribute: `:${arg.name}="${printValue(value)}"` };
    case 'ObjectExpression':
    case 'ArrayExpression': {
      const bindingName = allocateBindingName(arg.name, ctx);
      ctx.variables.set(bindingName, printValue(value));
      return { name: arg.name, attribute: `:${arg.name}="${bindingName}"` };
    }
    case 'ArrowFunctionExpression':
    case 'FunctionExpression':
      return undefined;
    default:
      return { name: arg.name, attribute: `:${arg.name}="${printValue(value)}"` };
  }
}

function renderModelArg(arg: ModelArg, ctx: RenderContext): RenderedProp | undefined {
  const value = unwrapValue(arg.value);
  if (value.type === 'ArrowFunctionExpression' || value.type === 'FunctionExpression') {
    return undefined;
  }

  const bindingName = allocateBindingName(arg.name, ctx);
  ctx.variables.set(bindingName, `ref(${printValue(value)})`);

  const directive = arg.name === 'modelValue' ? 'v-model' : `v-model:${arg.name}`;
  return { name: arg.name, attribute: `${directive}="${bindingName}"` };
}

function renderSlotArg(arg: SlotArg): string | undefined {
  const content = renderSlotContent(arg.value);
  if (!content) {
    return undefined;
  }

  if (arg.name === 'default') {
    return content;
  }

  return `<template #${arg.name}>${content}</template>`;
}

function renderSlotContent(node: t.Node): string | undefined {
  const value = unwrapValue(node);

  switch (value.type) {
    case 'StringLiteral':
      return value.value;
    case 'NumericLiteral':
    case 'BooleanLiteral':
      return String(value.value);
    case 'BigIntLiteral':
      return `{{ ${printValue(value)} }}`;
    case 'NullLiteral':
    case 'ArrowFunctionExpression':
    case 'FunctionExpression':
      return undefined;
    default:
      return undefined;
  }
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

  if (
    args.some((arg) => {
      if (arg.type !== 'model') {
        return false;
      }
      const value = unwrapValue(arg.value);
      return value.type !== 'ArrowFunctionExpression' && value.type !== 'FunctionExpression';
    })
  ) {
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

function printValue(node: t.Node): string {
  return recast.print(node).code;
}

function slotSortKey(name: string): string {
  return name === 'default' ? '' : name;
}

function unwrapValue(node: t.Node): t.Node {
  if (
    node.type === 'TSAsExpression' ||
    node.type === 'TSSatisfiesExpression' ||
    node.type === 'TSNonNullExpression' ||
    node.type === 'TSTypeAssertion'
  ) {
    return unwrapValue(node.expression);
  }

  return node;
}
