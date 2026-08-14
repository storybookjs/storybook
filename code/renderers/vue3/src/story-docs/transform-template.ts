import {
  NodeTypes,
  parse,
  type AttributeNode,
  type DirectiveNode,
  type ElementNode,
  type TemplateChildNode,
} from '@vue/compiler-dom';

import { types as t } from 'storybook/internal/babel';
import {
  keyOf,
  propertyValue,
  returnedExpression,
  unwrapExpression,
  type ImportBinding,
} from 'storybook/internal/csf-tools';

import type { ClassifiedArg } from './classify-args.ts';
import { isFunctionExpression } from './classify-value.ts';
import {
  createRenderContext,
  hoistArgValue,
  hoistModelRef,
  importStatementForBinding,
  inlinePrimitiveSource,
  renderArgsBindingAttributes,
  renderBoundArgAttribute,
  renderPreparedSfcSnippet,
  type RenderContext,
} from './render-primitives.ts';

export interface TemplateRenderConfig {
  /** Static Vue template string returned from the render function. */
  template: string;
  /** Component tag name to import statement. */
  componentImports: Map<string, string>;
}

export interface ReadTemplateRenderConfigOptions {
  /** Meta component identifier from CSF meta.component. */
  componentName?: string;
  /** Import statement for the meta component, after any `@import` override. */
  componentImportStatement?: string;
}

export interface TransformTemplateInput {
  /** Static Vue template markup from a render object. */
  template: string;
  /** Merged and classified CSF args for the story. */
  args: ClassifiedArg[];
  /** Component tag name to import statement from the render object's components map. */
  componentImports: Map<string, string>;
}

export interface TransformTemplateResult {
  /** Vue SFC snippet for the docs payload. */
  snippet: string;
}

interface Edit {
  start: number;
  end: number;
  text: string;
}

interface TransformState {
  argsByName: Map<string, ClassifiedArg>;
  ctx: RenderContext;
  edits: Edit[];
  componentImports: Map<string, string>;
  template: string;
}

const ARGS_NAME = 'args';
const ARGS_IDENTIFIER_REGEXP = /(^|[^\w$])args([^\w$]|$)/;
const ARGS_MEMBER_REGEXP = /^args\.([A-Za-z_$][\w$]*)$/;
const SETUP_PROPERTY = 'setup';

/** Read a transformable template-render object without resolving the render function itself. */
export function readTemplateRenderConfig(
  renderObject: t.ObjectExpression,
  importBindings: Map<string, ImportBinding>,
  options: ReadTemplateRenderConfigOptions = {}
): TemplateRenderConfig | undefined {
  if (!hasOnlySupportedRenderProperties(renderObject)) {
    return undefined;
  }

  const template = staticTemplateSource(propertyValue(renderObject, 'template'));
  if (template === undefined) {
    return undefined;
  }

  const setup = setupProperty(renderObject);
  if (setup && !isTrivialSetup(setup)) {
    return undefined;
  }

  const componentImports = readComponentImports(
    propertyValue(renderObject, 'components'),
    importBindings,
    options
  );
  return componentImports ? { template, componentImports } : undefined;
}

/**
 * Transform supported template-render markup into a static SFC snippet.
 *
 * The template is parsed with Vue's own parser, and only the ranges this pass fully understands
 * (`v-bind="args"`, `:prop="args.x"`, `@event="args.onX"`, `v-model="args.x"`, `{{ args.x }}`) are
 * spliced in the original source, so every untouched author byte survives verbatim. Anything else
 * that references args, and anything Vue itself refuses to parse, bails to the runtime source
 * fallback.
 */
export function transformTemplate(
  input: TransformTemplateInput
): TransformTemplateResult | undefined {
  let invalid = false;
  const ast = parse(input.template, { onError: () => (invalid = true) });
  if (invalid) {
    return undefined;
  }

  const state: TransformState = {
    argsByName: new Map(input.args.map((arg) => [arg.name, arg])),
    ctx: createRenderContext(),
    edits: [],
    componentImports: input.componentImports,
    template: input.template,
  };

  if (!ast.children.every((child) => transformNode(child, state))) {
    return undefined;
  }

  return {
    snippet: renderPreparedSfcSnippet({
      templateCode: applyEdits(input.template, state.edits),
      ctx: state.ctx,
    }),
  };
}

function transformNode(node: TemplateChildNode, state: TransformState): boolean {
  if (node.type === NodeTypes.INTERPOLATION) {
    return transformInterpolation(node, state);
  }

  if (node.type === NodeTypes.ELEMENT) {
    return transformElement(node, state);
  }

  return true;
}

// <p>{{ args.label }}</p> -> <p>Hello</p>
function transformInterpolation(
  node: Extract<TemplateChildNode, { type: NodeTypes.INTERPOLATION }>,
  state: TransformState
): boolean {
  const expression =
    node.content.type === NodeTypes.SIMPLE_EXPRESSION ? node.content.content.trim() : '';
  const argName = exactArgsMemberName(expression);

  if (!argName) {
    return !valueReferencesArgs(expression);
  }

  const arg = state.argsByName.get(argName);
  const rendered = arg ? inlinePrimitiveSource(arg.value) : undefined;
  // Runtime interpolation renders escaped text; a value the template parser would read as markup
  // or as a new interpolation has no faithful inline form.
  if (rendered === undefined || /[<&]|{{/.test(rendered)) {
    return false;
  }

  // A value edge touching an author '{' would concatenate into a new '{{'.
  const start = node.loc.start.offset;
  const end = node.loc.end.offset;
  if (
    (rendered.startsWith('{') && state.template[start - 1] === '{') ||
    (rendered.endsWith('{') && state.template[end] === '{')
  ) {
    return false;
  }

  state.edits.push({ start, end, text: rendered });
  return true;
}

function transformElement(node: ElementNode, state: TransformState): boolean {
  // A snippet cannot re-create the registration context a dynamic component resolves against.
  // Vue's compiler accepts both spellings of the built-in tag.
  if (node.tag === 'component' || node.tag === 'Component') {
    return false;
  }

  const importStatement = componentImportForTag(node.tag, state.componentImports);
  if (importStatement) {
    state.ctx.componentImports.add(importStatement);
  }

  const nameCounts = attributeNameCounts(node);
  for (const prop of node.props) {
    if (prop.type === NodeTypes.DIRECTIVE && !transformDirective(prop, nameCounts, state)) {
      return false;
    }
  }

  return node.children.every((child) => transformNode(child, state));
}

function transformDirective(
  directive: DirectiveNode,
  nameCounts: Map<string, number>,
  state: TransformState
): boolean {
  // A dynamic argument (`:[args.key]`, `#[args.slotName]`) reads a binding the snippet's script
  // never declares, so it would throw where the story renders.
  if (directive.arg && !staticDirectiveArg(directive)) {
    return false;
  }

  const expression =
    directive.exp?.type === NodeTypes.SIMPLE_EXPRESSION ? directive.exp.content.trim() : undefined;

  // <MyButton v-bind="args" />
  if (directive.name === 'bind' && !directive.arg && expression === ARGS_NAME) {
    const rendered = renderArgsBindingAttributes(
      Array.from(state.argsByName.values()),
      new Set(nameCounts.keys()),
      state.ctx
    );
    if (rendered === undefined) {
      return false;
    }
    state.edits.push(replacementFor(directive, rendered, state.template));
    return true;
  }

  const boundProp = staticDirectiveArg(directive);
  const argName = expression === undefined ? undefined : exactArgsMemberName(expression);

  // <MyButton :label="args.label" />
  if (directive.name === 'bind' && boundProp && directive.modifiers.length === 0 && argName) {
    const arg = state.argsByName.get(argName);
    if (!arg || arg.role === 'slot' || (nameCounts.get(boundProp) ?? 0) > 1) {
      return false;
    }
    state.edits.push({
      start: directive.loc.start.offset,
      end: directive.loc.end.offset,
      text: renderBoundArgAttribute(boundProp, arg, state.ctx),
    });
    return true;
  }

  // <MyButton @click="args.onClick" />
  if (directive.name === 'on' && boundProp && argName && directive.exp) {
    const arg = state.argsByName.get(argName);
    if (!arg || !isFunctionExpression(arg.value)) {
      return false;
    }
    state.edits.push({
      start: directive.exp.loc.start.offset,
      end: directive.exp.loc.end.offset,
      text: hoistArgValue(argName, arg.value, state.ctx),
    });
    return true;
  }

  // <MyButton v-model="args.modelValue" />
  if (directive.name === 'model' && argName && directive.exp) {
    const arg = state.argsByName.get(argName);
    if (!arg || arg.role === 'slot' || arg.role === 'event') {
      return false;
    }
    state.edits.push({
      start: directive.exp.loc.start.offset,
      end: directive.exp.loc.end.offset,
      text: hoistModelRef(argName, arg.value, state.ctx),
    });
    return true;
  }

  // Any other args usage is beyond what a static snippet can honestly represent.
  return expression === undefined || !valueReferencesArgs(expression);
}

/**
 * Removing a directive outright must also consume the whitespace that separated it from its
 * neighbors, so `<MyButton v-bind="args" />` with nothing to expand stays `<MyButton />`.
 */
function replacementFor(directive: DirectiveNode, text: string, template: string): Edit {
  let start = directive.loc.start.offset;
  if (text === '') {
    while (start > 0 && template[start - 1] === ' ') {
      start -= 1;
    }
  }
  return { start, end: directive.loc.end.offset, text };
}

function applyEdits(template: string, edits: Edit[]): string {
  return edits
    .sort((a, b) => b.start - a.start)
    .reduce(
      (source, edit) => source.slice(0, edit.start) + edit.text + source.slice(edit.end),
      template
    );
}

// ':label' or 'v-bind:label' -> 'label'; dynamic args ('[key]') have no static name
function staticDirectiveArg(directive: DirectiveNode): string | undefined {
  return directive.arg?.type === NodeTypes.SIMPLE_EXPRESSION && directive.arg.isStatic
    ? directive.arg.content
    : undefined;
}

/**
 * How often each attribute name occurs on the element, counting a directive by the prop or event
 * it binds. Vue resolves collisions by source order and merge rules a static rewrite cannot
 * reproduce, so callers bail when a name is already taken.
 */
function attributeNameCounts(node: ElementNode): Map<string, number> {
  const counts = new Map<string, number>();
  const add = (name: string | undefined): void => {
    if (name) {
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  };

  for (const prop of node.props) {
    if (prop.type === NodeTypes.ATTRIBUTE) {
      add((prop as AttributeNode).name);
    } else if (prop.name === 'model' && !prop.arg) {
      add('modelValue');
    } else {
      add(staticDirectiveArg(prop));
    }
  }

  return counts;
}

/**
 * Import statement for a template tag, matched the way Vue resolves components: the literal tag
 * first, then its PascalCase form (`<my-button>` -> `MyButton`).
 */
function componentImportForTag(
  tag: string,
  componentImports: Map<string, string>
): string | undefined {
  return componentImports.get(tag) ?? componentImports.get(pascalCase(tag));
}

function pascalCase(tag: string): string {
  const camel = tag.replace(/-(\w)/g, (_match, char: string) => char.toUpperCase());
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

// 'args.label' -> 'label'
function exactArgsMemberName(value: string): string | undefined {
  return ARGS_MEMBER_REGEXP.exec(value)?.[1];
}

function valueReferencesArgs(value: string): boolean {
  return ARGS_IDENTIFIER_REGEXP.test(value);
}

// '<MyButton />' or `<MyButton />` without substitutions
function staticTemplateSource(node: t.Node | undefined): string | undefined {
  if (t.isStringLiteral(node)) {
    return node.value;
  }
  if (t.isTemplateLiteral(node) && node.expressions.length === 0) {
    return node.quasis[0]?.value.cooked;
  }
  return undefined;
}

// { components: { Button }, setup: () => ({ args }), template: '<Button />' }
function hasOnlySupportedRenderProperties(renderObject: t.ObjectExpression): boolean {
  return renderObject.properties.every((property) => {
    // { ...baseRender, template: '<Button />' }
    if (t.isSpreadElement(property)) {
      return false;
    }

    const key = keyOf(property);
    return key === 'components' || key === SETUP_PROPERTY || key === 'template';
  });
}

// { Button, 'my-button': Button }
function readComponentImports(
  value: t.Node | undefined,
  importBindings: Map<string, ImportBinding>,
  options: ReadTemplateRenderConfigOptions
): Map<string, string> | undefined {
  const componentImports = new Map<string, string>();
  if (options.componentName && options.componentImportStatement) {
    componentImports.set(options.componentName, options.componentImportStatement);
  }
  if (!value) {
    return componentImports;
  }
  if (!t.isObjectExpression(value)) {
    return undefined;
  }

  for (const property of value.properties) {
    if (!t.isObjectProperty(property)) {
      return undefined;
    }

    const tagName = keyOf(property);
    const component = unwrapExpression(property.value);
    if (!tagName || !t.isIdentifier(component)) {
      return undefined;
    }

    const importStatement =
      component.name === options.componentName
        ? options.componentImportStatement
        : importStatementForBinding(component.name, importBindings.get(component.name));
    if (!importStatement) {
      return undefined;
    }

    componentImports.set(tagName, importStatement);
  }

  return componentImports;
}

// setup() { return { args }; }
function setupProperty(
  renderObject: t.ObjectExpression
): t.ObjectMethod | t.ObjectProperty | undefined {
  return renderObject.properties.find((property): property is t.ObjectMethod | t.ObjectProperty => {
    if (!t.isObjectMethod(property) && !t.isObjectProperty(property)) {
      return false;
    }
    return keyOf(property) === SETUP_PROPERTY;
  });
}

// setup: () => ({ args })
function isTrivialSetup(setup: t.ObjectMethod | t.ObjectProperty): boolean {
  const returned = setupReturnObject(setup);
  if (!returned || returned.properties.length !== 1) {
    return false;
  }

  const [property] = returned.properties;
  if (!t.isObjectProperty(property) || keyOf(property) !== ARGS_NAME) {
    return false;
  }

  const value = unwrapExpression(property.value);
  return t.isIdentifier(value, { name: ARGS_NAME });
}

// setup() { return { args }; } or setup: () => ({ args })
function setupReturnObject(
  setup: t.ObjectMethod | t.ObjectProperty
): t.ObjectExpression | undefined {
  const setupFunction = t.isObjectMethod(setup) ? setup : unwrapExpression(setup.value);
  const returned = returnedExpression(setupFunction);
  return t.isObjectExpression(returned) ? returned : undefined;
}
