import {
  NodeTypes,
  parse,
  type DirectiveNode,
  type ElementNode,
  type SimpleExpressionNode,
  type TemplateChildNode,
} from '@vue/compiler-dom';

import { babelParseExpression, types as t } from 'storybook/internal/babel';
import {
  keyOf,
  propertyValue,
  returnedExpression,
  unwrapExpression,
  type ImportBinding,
} from 'storybook/internal/csf-tools';

import type { ClassifiedArg } from './classify-args.ts';
import { isFunctionExpression, printValue } from './classify-value.ts';
import {
  createRenderContext,
  escapeTextContent,
  hoistArgValue,
  hoistModelRef,
  importStatementForBinding,
  inlinePrimitiveSource,
  renderArgsBindingExpansion,
  renderBoundArgAttribute,
  renderPreparedSfcSnippet,
  wrapSlotContent,
  type RenderContext,
} from './render-primitives.ts';
import { renderSlotArgContent } from './render-slot-content.ts';

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
  /** Story component tag; role-aware args expansion applies only to it. */
  componentName?: string;
  /** Import bindings from the CSF module, for components a function slot renders. */
  importBindings?: Map<string, ImportBinding>;
  /** Pre-seeded context carrying imports and hoists an upstream printer collected. */
  ctx?: RenderContext;
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
  componentName?: string;
  importBindings: Map<string, ImportBinding>;
  template: string;
}

type ElementProp = ElementNode['props'][number];

interface ElementContext {
  /** Whether the element is the story component tag, where role-aware expansion applies. */
  storyTag: boolean;
  /** Wrapped slot children waiting to be spliced into the element. */
  slotChildren: string[];
}

interface ArgsExpansionPlan {
  /** The `v-bind="args"` directive to expand, when the element carries exactly one. */
  directive?: DirectiveNode;
  /** Args surviving later-wins collision resolution against the element's own attributes. */
  surviving: ClassifiedArg[];
  /** Author attributes the expansion overrides, removed because the expansion comes later. */
  removed: Set<ElementProp>;
}

interface ArgsReference {
  start: number;
  end: number;
  name: string;
}

type ExpressionContext = 'directive' | 'interpolation';

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
 * The template is parsed with Vue's own parser, and only understood args ranges are spliced in the
 * original source, so every untouched author byte survives verbatim. Args usage that cannot be
 * substituted safely, and anything Vue itself refuses to parse, bails to the runtime source
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
    ctx: input.ctx ?? createRenderContext(),
    edits: [],
    componentImports: input.componentImports,
    componentName: input.componentName,
    importBindings: input.importBindings ?? new Map(),
    template: input.template,
  };

  if (!collectTemplateScopeBindings(ast.children, state.ctx)) {
    return undefined;
  }

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
  const expressionNode =
    node.content.type === NodeTypes.SIMPLE_EXPRESSION ? node.content : undefined;
  const expression = expressionNode?.content.trim() ?? '';
  const argName = exactArgsMemberName(expression);

  if (!argName) {
    if (!expressionNode || !valueReferencesArgs(expression)) {
      return true;
    }

    const edit = substituteArgsExpression(expressionNode, state, 'interpolation');
    if (!edit) {
      return false;
    }
    state.edits.push(edit);
    return true;
  }

  const arg = state.argsByName.get(argName);
  const rendered = arg ? inlinePrimitiveSource(arg.value) : undefined;
  if (rendered === undefined) {
    return false;
  }

  // Runtime interpolation renders escaped text, so markup and mustache characters in the value
  // are entity-escaped to decode back to the same text when the snippet re-parses.
  const text = escapeTextContent(rendered);

  // A value edge touching an author '{' would concatenate into a new '{{'.
  const start = node.loc.start.offset;
  const end = node.loc.end.offset;
  if (
    (text.startsWith('{') && state.template[start - 1] === '{') ||
    (text.endsWith('{') && state.template[end] === '{')
  ) {
    return false;
  }

  state.edits.push({ start, end, text });
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

  const element: ElementContext = {
    storyTag: node.tag === state.componentName,
    slotChildren: [],
  };
  const attributesByName = attributePropsByName(node);
  const plan = planArgsBindingExpansion(node, attributesByName, state);
  if (!plan) {
    return false;
  }

  for (const prop of node.props) {
    if (plan.removed.has(prop)) {
      state.edits.push(replacementFor(prop, '', state.template));
      continue;
    }
    if (plan.directive && prop === plan.directive) {
      if (!expandArgsBinding(plan.directive, plan.surviving, element, state)) {
        return false;
      }
      continue;
    }
    if (
      prop.type === NodeTypes.DIRECTIVE &&
      !transformDirective(prop, attributesByName, element, state)
    ) {
      return false;
    }
  }

  if (element.slotChildren.length > 0) {
    // Slot children joining an element that already renders its own content would reorder or
    // duplicate what the story shows, so only an empty element takes them.
    if (hasNonWhitespaceChildren(node)) {
      return false;
    }
    const edit = slotChildrenEdit(node, element.slotChildren, state.template);
    if (!edit) {
      return false;
    }
    state.edits.push(edit);
  }

  return node.children.every((child) => transformNode(child, state));
}

/**
 * Collision resolution for a `v-bind="args"` expansion, mirroring Vue's own merge order: the
 * binding that appears later in the source wins.
 *
 * @example `<C v-bind="args" label="x" />` drops the `label` arg;
 * `<C label="x" v-bind="args" />` removes the attribute
 */
function planArgsBindingExpansion(
  node: ElementNode,
  attributesByName: Map<string, ElementProp[]>,
  state: TransformState
): ArgsExpansionPlan | undefined {
  const directives = node.props.filter(
    (prop): prop is DirectiveNode =>
      prop.type === NodeTypes.DIRECTIVE &&
      prop.name === 'bind' &&
      !prop.arg &&
      prop.exp?.type === NodeTypes.SIMPLE_EXPRESSION &&
      prop.exp.content.trim() === ARGS_NAME
  );
  if (directives.length === 0) {
    return { surviving: [], removed: new Set() };
  }
  // Two expansions of the same args cannot both win the element.
  if (directives.length > 1) {
    return undefined;
  }

  const [directive] = directives;
  const removed = new Set<ElementProp>();
  const surviving: ClassifiedArg[] = [];

  for (const arg of state.argsByName.values()) {
    const attributeName = arg.role === 'event' ? (arg.eventName ?? arg.name) : arg.name;
    const competitors = attributesByName.get(attributeName) ?? [];
    if (competitors.length === 0) {
      surviving.push(arg);
      continue;
    }
    // Vue merges class and style from every source, runs every colliding listener, and pairs a
    // v-model with an update listener; none of those reduce to a single later-wins winner.
    if (attributeName === 'class' || attributeName === 'style' || arg.role !== 'prop') {
      return undefined;
    }
    if (competitors.some((prop) => prop.loc.start.offset > directive.loc.start.offset)) {
      continue;
    }
    for (const prop of competitors) {
      removed.add(prop);
    }
    surviving.push(arg);
  }

  return { directive, surviving, removed };
}

function expandArgsBinding(
  directive: DirectiveNode,
  surviving: ClassifiedArg[],
  element: ElementContext,
  state: TransformState
): boolean {
  const rendered = renderArgsBindingExpansion(surviving, state.ctx, {
    roleAware: element.storyTag,
    renderSlotArg: (slot) =>
      renderSlotArgContent(slot, state.ctx, state.importBindings, state.componentImports),
  });
  if (!rendered) {
    return false;
  }

  element.slotChildren.push(...rendered.slotChildren);
  state.edits.push(replacementFor(directive, rendered.attributes.join(' '), state.template));
  return true;
}

function transformDirective(
  directive: DirectiveNode,
  attributesByName: Map<string, ElementProp[]>,
  element: ElementContext,
  state: TransformState
): boolean {
  // A dynamic argument (`:[args.key]`, `#[args.slotName]`) reads a binding the snippet's script
  // never declares, so it would throw where the story renders.
  if (directive.arg && !staticDirectiveArg(directive)) {
    return false;
  }

  const expressionNode =
    directive.exp?.type === NodeTypes.SIMPLE_EXPRESSION ? directive.exp : undefined;
  const expression = expressionNode?.content.trim();

  const boundProp = staticDirectiveArg(directive);
  const argName = expression === undefined ? undefined : exactArgsMemberName(expression);

  // <MyButton :label="args.label" />
  if (directive.name === 'bind' && boundProp && directive.modifiers.length === 0 && argName) {
    const arg = state.argsByName.get(argName);
    if (!arg || (attributesByName.get(boundProp)?.length ?? 0) > 1) {
      return false;
    }
    // <MyButton :header="args.header" /> fills the slot the binding names.
    if (arg.role === 'slot') {
      if (!element.storyTag) {
        return false;
      }
      const content = renderSlotArgContent(
        arg,
        state.ctx,
        state.importBindings,
        state.componentImports
      );
      if (content === undefined) {
        return false;
      }
      element.slotChildren.push(wrapSlotContent(boundProp, content));
      state.edits.push(replacementFor(directive, '', state.template));
      return true;
    }
    state.edits.push({
      start: directive.loc.start.offset,
      end: directive.loc.end.offset,
      text: renderBoundArgAttribute(boundProp, arg, state.ctx),
    });
    return true;
  }

  // <MyButton @click="args.onClick" />
  if (directive.name === 'on' && boundProp && argName && expressionNode) {
    const arg = state.argsByName.get(argName);
    if (!arg || !isFunctionExpression(arg.value)) {
      return false;
    }
    state.edits.push({
      start: expressionNode.loc.start.offset,
      end: expressionNode.loc.end.offset,
      text: hoistArgValue(argName, arg.value, state.ctx),
    });
    return true;
  }

  // <MyButton v-model="args.modelValue" />
  if (directive.name === 'model' && argName && expressionNode) {
    const arg = state.argsByName.get(argName);
    if (!arg || arg.role === 'slot' || arg.role === 'event') {
      return false;
    }
    state.edits.push({
      start: expressionNode.loc.start.offset,
      end: expressionNode.loc.end.offset,
      text: hoistModelRef(argName, arg.value, state.ctx),
    });
    return true;
  }

  if (!expressionNode || !expression || !valueReferencesArgs(expression)) {
    return true;
  }

  if (directive.name === 'on' || directive.name === 'model' || directive.name === 'slot') {
    return false;
  }

  const edit = substituteArgsExpression(expressionNode, state, 'directive');
  if (!edit) {
    return false;
  }
  state.edits.push(edit);
  return true;
}

function substituteArgsExpression(
  exp: SimpleExpressionNode,
  state: TransformState,
  context: ExpressionContext
): Edit | undefined {
  const source = state.template.slice(exp.loc.start.offset, exp.loc.end.offset);
  if (source !== exp.content) {
    return undefined;
  }

  let ast: t.Expression;
  try {
    ast = babelParseExpression(exp.content);
  } catch {
    return undefined;
  }

  const references = collectArgsReferences(ast);
  if (!references) {
    return undefined;
  }

  const quote =
    context === 'directive' ? surroundingAttributeQuote(exp, state.template) : undefined;
  if (context === 'directive' && !quote) {
    return undefined;
  }

  const replacements = new Map<string, string>();
  for (const reference of references) {
    const replacement =
      replacements.get(reference.name) ?? replacementForArgsReference(reference, quote, state);
    if (!replacement) {
      return undefined;
    }
    replacements.set(reference.name, replacement);
  }

  const text = references
    .sort((a, b) => b.start - a.start)
    .reduce((expression, reference) => {
      return (
        expression.slice(0, reference.start) +
        replacements.get(reference.name)! +
        expression.slice(reference.end)
      );
    }, exp.content);

  return { start: exp.loc.start.offset, end: exp.loc.end.offset, text };
}

function collectTemplateScopeBindings(nodes: TemplateChildNode[], ctx: RenderContext): boolean {
  for (const node of nodes) {
    if (node.type !== NodeTypes.ELEMENT) {
      continue;
    }

    for (const prop of node.props) {
      if (prop.type !== NodeTypes.DIRECTIVE) {
        continue;
      }

      const pattern = bindingPatternForDirective(prop);
      if (pattern && !addBindingPattern(pattern, ctx)) {
        return false;
      }
    }

    if (!collectTemplateScopeBindings(node.children, ctx)) {
      return false;
    }
  }

  return true;
}

function bindingPatternForDirective(directive: DirectiveNode): string | undefined {
  const expression =
    directive.exp?.type === NodeTypes.SIMPLE_EXPRESSION ? directive.exp.content.trim() : undefined;
  if (!expression) {
    return undefined;
  }

  if (directive.name === 'for') {
    const match = /\s+(?:in|of)\s+/.exec(expression);
    return match ? expression.slice(0, match.index).trim() : expression;
  }

  return directive.name === 'slot' ? expression : undefined;
}

function addBindingPattern(pattern: string, ctx: RenderContext): boolean {
  let ast: t.Expression;
  try {
    ast = babelParseExpression(`${arrowParamsForPattern(pattern)} => 0`);
  } catch {
    return false;
  }

  if (!t.isArrowFunctionExpression(ast)) {
    return false;
  }

  for (const param of ast.params) {
    for (const name of Object.keys(t.getBindingIdentifiers(param))) {
      ctx.bindings.add(name);
    }
  }

  return true;
}

function arrowParamsForPattern(pattern: string): string {
  const trimmed = pattern.trim();
  return trimmed.startsWith('(') && trimmed.endsWith(')') ? trimmed : `(${trimmed})`;
}

function surroundingAttributeQuote(
  exp: SimpleExpressionNode,
  template: string
): '"' | "'" | undefined {
  const quote = template[exp.loc.start.offset - 1];
  return quote === '"' || quote === "'" ? quote : undefined;
}

function collectArgsReferences(expression: t.Expression): ArgsReference[] | undefined {
  const references: ArgsReference[] = [];
  let invalid = false;

  const visit = (node: t.Node | null | undefined, parent?: t.Node): void => {
    if (!node || invalid) {
      return;
    }

    if (
      t.isAssignmentExpression(node) ||
      t.isUpdateExpression(node) ||
      (t.isUnaryExpression(node) && node.operator === 'delete')
    ) {
      invalid = true;
      return;
    }

    const reference = argsReference(node);
    if (reference) {
      references.push(reference);
    }

    if (t.isIdentifier(node, { name: ARGS_NAME }) && !isAllowedArgsObject(node, parent)) {
      invalid = true;
      return;
    }

    for (const key of t.VISITOR_KEYS[node.type] ?? []) {
      const value = node[key as keyof typeof node];
      if (Array.isArray(value)) {
        value.forEach((child) => {
          if (t.isNode(child)) {
            visit(child, node);
          }
        });
      } else if (t.isNode(value)) {
        visit(value, node);
      }
    }
  };

  visit(expression);

  return invalid ? undefined : references;
}

function argsReference(node: t.Node): ArgsReference | undefined {
  const member =
    t.isMemberExpression(node) || t.isOptionalMemberExpression(node) ? node : undefined;
  if (!member || member.computed || !t.isIdentifier(member.object, { name: ARGS_NAME })) {
    return undefined;
  }
  if (!t.isIdentifier(member.property) || member.start == null || member.end == null) {
    return undefined;
  }

  return { start: member.start, end: member.end, name: member.property.name };
}

function isAllowedArgsObject(node: t.Identifier, parent: t.Node | undefined): boolean {
  if (!parent || (!t.isMemberExpression(parent) && !t.isOptionalMemberExpression(parent))) {
    return false;
  }
  return parent.object === node && !parent.computed;
}

function replacementForArgsReference(
  reference: ArgsReference,
  quote: '"' | "'" | undefined,
  state: TransformState
): string | undefined {
  const arg = state.argsByName.get(reference.name);
  // Non-slot args are typed with renderable plans only, so no 'function-slot' check is needed.
  if (!arg || arg.role === 'slot') {
    return undefined;
  }

  const text =
    arg.plan.kind === 'inline'
      ? printValue(unwrapExpression(arg.value))
      : hoistArgValue(arg.name, arg.value, state.ctx);

  // Vue entity-decodes generated markup on re-parse, so `&` cannot be substituted faithfully.
  if ((quote && text.includes(quote)) || text.includes('}}') || text.includes('&')) {
    return undefined;
  }

  return text.startsWith('-') ? `(${text})` : text;
}

/**
 * Removing an attribute outright must also consume the whitespace that separated it from its
 * neighbors, so `<MyButton v-bind="args" />` with nothing to expand stays `<MyButton />`.
 */
function replacementFor(prop: { loc: ElementProp['loc'] }, text: string, template: string): Edit {
  let start = prop.loc.start.offset;
  if (text === '') {
    while (start > 0 && template[start - 1] === ' ') {
      start -= 1;
    }
  }
  return { start, end: prop.loc.end.offset, text };
}

/**
 * Splices slot children into an element, opening a self-closing tag when needed.
 *
 * @example `<C label="Hi" />` + `Body` → `<C label="Hi">Body</C>`
 */
function slotChildrenEdit(
  node: ElementNode,
  children: string[],
  template: string
): Edit | undefined {
  // Text children stay inline because breaking them onto lines introduces whitespace Vue renders.
  const baseIndent = ' '.repeat(Math.max(node.loc.start.column - 1, 0));
  const joined = children.every((child) => child.startsWith('<'))
    ? `\n${children.map((child) => indentBy(child, `${baseIndent}  `)).join('\n')}\n${baseIndent}`
    : children.join('');

  if (node.isSelfClosing) {
    let start = node.loc.end.offset - 2;
    while (start > 0 && template[start - 1] === ' ') {
      start -= 1;
    }
    return { start, end: node.loc.end.offset, text: `>${joined}</${node.tag}>` };
  }

  if (node.children.length > 0) {
    const start = node.children[0].loc.start.offset;
    const end = node.children[node.children.length - 1].loc.end.offset;
    return { start, end, text: joined };
  }

  const innerStart = openTagEndOffset(node, template);
  return innerStart === undefined
    ? undefined
    : { start: innerStart, end: innerStart, text: joined };
}

function hasNonWhitespaceChildren(node: ElementNode): boolean {
  return node.children.some(
    (child) => child.type !== NodeTypes.TEXT || child.content.trim() !== ''
  );
}

// After the last attribute only whitespace and the tag close remain, so scanning for '>' is safe.
function openTagEndOffset(node: ElementNode, template: string): number | undefined {
  const lastProp = node.props.at(-1);
  let offset = lastProp ? lastProp.loc.end.offset : node.loc.start.offset + 1 + node.tag.length;
  while (offset < template.length && template[offset] !== '>') {
    offset += 1;
  }
  return template[offset] === '>' ? offset + 1 : undefined;
}

function indentBy(source: string, indentation: string): string {
  return source
    .split('\n')
    .map((line) => `${indentation}${line}`)
    .join('\n');
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
 * The element's attributes grouped by the prop or event name each one binds, counting a directive
 * by its static argument. Callers consult positions to resolve name collisions the way Vue does.
 */
function attributePropsByName(node: ElementNode): Map<string, ElementProp[]> {
  const byName = new Map<string, ElementProp[]>();
  const add = (name: string | undefined, prop: ElementProp): void => {
    if (name) {
      byName.set(name, [...(byName.get(name) ?? []), prop]);
    }
  };

  for (const prop of node.props) {
    if (prop.type === NodeTypes.ATTRIBUTE) {
      add(prop.name, prop);
    } else if (prop.name === 'model' && !prop.arg) {
      add('modelValue', prop);
    } else {
      add(staticDirectiveArg(prop), prop);
    }
  }

  return byName;
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
    // `inheritAttrs` only tunes runtime attribute fallthrough; the markup stays faithful without it.
    return (
      key === 'components' || key === SETUP_PROPERTY || key === 'template' || key === 'inheritAttrs'
    );
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
