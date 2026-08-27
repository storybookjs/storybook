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
  unwrapExpression,
  type ImportBinding,
} from 'storybook/internal/csf-tools';

import type { ClassifiedArg } from './classify-args.ts';
import { isFunctionExpression, printValue } from './classify-value.ts';
import { readForwardableSetup, type ForwardableSetup } from './forward-setup.ts';
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
  /** Setup statements to forward into the snippet's script. */
  setup?: ForwardableSetup;
}

export type TemplateRenderResolution =
  | { kind: 'config'; config: TemplateRenderConfig }
  | { kind: 'bail'; warning: string }
  /** Not a transformable template render object; the h-tree path may still resolve it. */
  | { kind: 'skip' };

export interface ReadTemplateRenderConfigOptions {
  /** Meta component identifier from CSF meta.component. */
  componentName?: string;
  /** Import statement for the meta component, after any `@import` override. */
  componentImportStatement?: string;
  /** Render-function parameter the setup body closes over as the story args. */
  argsParam?: string;
  /** Story file source backing the render object, for forwarding setup statements. */
  source?: string;
}

export interface TransformTemplateInput {
  /** Static Vue template markup from a render object. */
  template: string;
  /** Merged and classified CSF args for the story. */
  args: ClassifiedArg[];
  /** Arg names explicitly set to undefined; their bindings render as if never written. */
  unsetArgs: ReadonlySet<string>;
  /** Component tag name to import statement from the render object's components map. */
  componentImports: Map<string, string>;
  /** Story component tag; role-aware args expansion applies only to it. */
  componentName?: string;
  /** Import bindings from the CSF module, for components a function slot renders. */
  importBindings?: Map<string, ImportBinding>;
  /** Pre-seeded context carrying imports and hoists an upstream printer collected. */
  ctx?: RenderContext;
  /** Setup statements to forward into the snippet's script. */
  setup?: ForwardableSetup;
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
  unsetArgs: ReadonlySet<string>;
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
const BLANK_REGEXP = /[ \t]/;
const SETUP_PROPERTY = 'setup';

const TEMPLATE_UNREADABLE_WARNING =
  'No static snippet: the `template` could not be read statically.';
const COMPONENTS_UNREADABLE_WARNING =
  'No static snippet: the `components` map could not be read statically.';

/** Read a transformable template-render object without resolving the render function itself. */
export function readTemplateRenderConfig(
  renderObject: t.ObjectExpression,
  importBindings: Map<string, ImportBinding>,
  options: ReadTemplateRenderConfigOptions = {}
): TemplateRenderResolution {
  if (!hasOnlySupportedRenderProperties(renderObject)) {
    return { kind: 'skip' };
  }

  const templateProperty = propertyValue(renderObject, 'template');
  if (!templateProperty) {
    return { kind: 'skip' };
  }
  const template = staticTemplateSource(templateProperty);
  if (template === undefined) {
    return { kind: 'bail', warning: TEMPLATE_UNREADABLE_WARNING };
  }

  let setup: ForwardableSetup | undefined;
  const setupProp = setupProperty(renderObject);
  if (setupProp) {
    const resolution = readForwardableSetup(setupProp, {
      argsParam: options.argsParam,
      importBindings,
      source: options.source ?? '',
    });
    // A setup returning a render closure wins over the template at runtime.
    if (resolution.kind === 'render-closure') {
      return { kind: 'skip' };
    }
    if (resolution.kind === 'bail') {
      return resolution;
    }
    setup = resolution.setup;
  }

  const componentImports = readComponentImports(
    propertyValue(renderObject, 'components'),
    importBindings,
    options
  );
  if (!componentImports) {
    return { kind: 'bail', warning: COMPONENTS_UNREADABLE_WARNING };
  }

  return { kind: 'config', config: { template, componentImports, setup } };
}

/**
 * Transform Vue template markup into a static SFC snippet.
 *
 * This is the single args-semantics engine: author-written render templates, markup printed from
 * `h()` trees, and the synthesized template for render-less stories all pass through here. The
 * template is parsed with Vue's own parser, and only understood args ranges are spliced in the
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
    unsetArgs: input.unsetArgs,
    ctx: input.ctx ?? createRenderContext(),
    edits: [],
    componentImports: input.componentImports,
    componentName: input.componentName,
    importBindings: input.importBindings ?? new Map(),
    template: input.template,
  };

  if (input.setup && !seedForwardedSetup(input.setup, state)) {
    return undefined;
  }

  if (!collectTemplateScopeBindings(ast.children, state.ctx)) {
    return undefined;
  }

  if (!ast.children.every((child) => transformNode(child, state))) {
    return undefined;
  }

  if (input.setup && !appendSetupStatements(input.setup, state)) {
    return undefined;
  }

  return {
    snippet: renderPreparedSfcSnippet({
      templateCode: applyEdits(input.template, state.edits),
      ctx: state.ctx,
    }),
  };
}

/** Reserve setup names and route forwarded imports before any hoist can collide with them. */
function seedForwardedSetup(setup: ForwardableSetup, state: TransformState): boolean {
  for (const name of setup.bindings) {
    state.ctx.bindings.add(name);
  }
  for (const { localName, binding } of setup.imports) {
    if (binding.importName === localName) {
      (state.ctx.imports[binding.importId] ??= new Set()).add(localName);
    } else {
      const statement = importStatementForBinding(localName, binding);
      if (!statement) {
        return false;
      }
      state.ctx.componentImports.add(statement);
    }
  }
  return true;
}

function appendSetupStatements(setup: ForwardableSetup, state: TransformState): boolean {
  for (const statement of setup.statements) {
    let text = statement.source;
    for (const read of [...statement.argsReads].sort((a, b) => b.start - a.start)) {
      const arg = state.argsByName.get(read.name);
      const rendered = arg
        ? arg.role === 'prop'
          ? arg.plan.kind === 'inline'
            ? printValue(unwrapExpression(arg.value))
            : hoistArgValue(arg.name, arg.value, state.ctx)
          : undefined
        : state.unsetArgs.has(read.name)
          ? 'undefined'
          : undefined;
      if (rendered === undefined) {
        return false;
      }
      const wrapped = wrapSubstitution(rendered, text.slice(read.end));
      text = text.slice(0, read.start) + wrapped + text.slice(read.end);
    }
    text = text.replace(/\r\n?/g, '\n');
    state.ctx.statements.push(dedentBy(text, statement.column));
  }
  return true;
}

/**
 * Parenthesize substituted text that would fuse with the surrounding expression.
 *
 * @example `-2` before ` ** 2` → `(-2)`; `5` before `.toFixed(1)` → `(5)`, since `5.toFixed`
 * lexes the dot into the number
 */
function wrapSubstitution(text: string, following: string): string {
  if (text.startsWith('-') || (following.startsWith('.') && /^\d/.test(text))) {
    return `(${text})`;
  }
  return text;
}

// Continuation lines keep the story file's nesting; strip the statement's own column from them.
function dedentBy(source: string, column: number): string {
  if (column <= 0) {
    return source;
  }
  const indentation = ' '.repeat(column);
  return source
    .split('\n')
    .map((line, index) => (index > 0 && line.startsWith(indentation) ? line.slice(column) : line))
    .join('\n');
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
  if (!arg && state.unsetArgs.has(argName)) {
    state.edits.push({ start: node.loc.start.offset, end: node.loc.end.offset, text: '' });
    return true;
  }
  if (!arg) {
    return false;
  }

  const rendered = inlinePrimitiveSource(arg.value);
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
  // Vue reads either spelling as the built-in dynamic component only when an `is` binding is
  // present; a snippet cannot re-create the registration context that binding resolves against.
  // Without one, the tag resolves like any other component, including one named `Component`.
  if ((node.tag === 'component' || node.tag === 'Component') && hasIsBinding(node)) {
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
    if ((attributesByName.get(boundProp)?.length ?? 0) > 1) {
      return false;
    }
    if (!arg && state.unsetArgs.has(argName)) {
      // Vue resolves a prop bound to undefined to its declared default, exactly as an absent attribute does.
      state.edits.push(replacementFor(directive, '', state.template));
      return true;
    }
    if (!arg) {
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
    if (!arg && state.unsetArgs.has(argName)) {
      // An undefined handler attaches no listener, exactly as an absent binding does.
      state.edits.push(replacementFor(directive, '', state.template));
      return true;
    }
    if (!arg) {
      return false;
    }
    if (!isFunctionExpression(arg.value)) {
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
    if (!arg && !state.unsetArgs.has(argName)) {
      return false;
    }
    if (arg && (arg.role === 'slot' || arg.role === 'event')) {
      return false;
    }
    // Dropping the binding would drop the two-way flow the story demonstrates, so it starts its ref empty.
    state.edits.push({
      start: expressionNode.loc.start.offset,
      end: expressionNode.loc.end.offset,
      text: hoistModelRef(argName, arg?.value, state.ctx),
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
      const wrapped = wrapSubstitution(
        replacements.get(reference.name)!,
        expression.slice(reference.end)
      );
      return expression.slice(0, reference.start) + wrapped + expression.slice(reference.end);
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
  if (!arg && state.unsetArgs.has(reference.name)) {
    return 'undefined';
  }
  if (!arg) {
    return undefined;
  }
  if (arg.role === 'slot') {
    return undefined;
  }

  // Non-slot args are typed with renderable plans only, so no 'function-slot' check is needed.
  const text =
    arg.plan.kind === 'inline'
      ? printValue(unwrapExpression(arg.value))
      : hoistArgValue(arg.name, arg.value, state.ctx);

  // Vue entity-decodes generated markup on re-parse, so `&` cannot be substituted faithfully.
  if ((quote && text.includes(quote)) || text.includes('}}') || text.includes('&')) {
    return undefined;
  }

  return text;
}

/**
 * Removing an attribute outright must also consume the whitespace that separated it from its
 * neighbors, so `<MyButton v-bind="args" />` with nothing to expand stays `<MyButton />`.
 */
function replacementFor(prop: { loc: ElementProp['loc'] }, text: string, template: string): Edit {
  const start = prop.loc.start.offset;
  const end = prop.loc.end.offset;
  if (text !== '') {
    return { start, end, text };
  }

  const lineStart = blankRunStart(template, start);
  const lineEnd = blankRunEnd(template, end);
  const lineTerminator = lineTerminatorAt(template, lineEnd);
  if (template[lineStart - 1] === '\n' && lineTerminator) {
    return {
      start: previousLineTerminatorStart(template, lineStart),
      end: lineTerminator.start,
      text,
    };
  }
  return { start: lineStart, end, text };
}

function blankRunStart(template: string, index: number): number {
  let cursor = index;
  while (cursor > 0 && BLANK_REGEXP.test(template[cursor - 1])) {
    cursor -= 1;
  }
  return cursor;
}

function blankRunEnd(template: string, index: number): number {
  let cursor = index;
  while (cursor < template.length && BLANK_REGEXP.test(template[cursor])) {
    cursor += 1;
  }
  return cursor;
}

function lineTerminatorAt(template: string, index: number): { start: number } | undefined {
  if (template[index] === '\r' && template[index + 1] === '\n') {
    return { start: index };
  }
  return template[index] === '\n' ? { start: index } : undefined;
}

function previousLineTerminatorStart(template: string, index: number): number {
  return template[index - 2] === '\r' ? index - 2 : index - 1;
}

/**
 * Splices slot children into an element, opening a self-closing tag when needed.
 *
 * Children always sit on their own indented lines: slot text is whitespace-safe by construction,
 * because padded strings hoist to interpolations before they get here.
 *
 * @example `<C label="Hi" />` + `Body` → `<C label="Hi">\n  Body\n</C>`
 */
function slotChildrenEdit(
  node: ElementNode,
  children: string[],
  template: string
): Edit | undefined {
  const baseIndent = ' '.repeat(Math.max(node.loc.start.column - 1, 0));
  const joined = `\n${children
    .map((child) => indentBy(child, `${baseIndent}  `))
    .join('\n')}\n${baseIndent}`;

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

// <component is="x">, <component :is="x">, or the legacy <component v-is="x">
function hasIsBinding(node: ElementNode): boolean {
  return node.props.some((prop) => {
    if (prop.type === NodeTypes.ATTRIBUTE) {
      return prop.name === 'is';
    }
    return prop.name === 'is' || (prop.name === 'bind' && staticDirectiveArg(prop) === 'is');
  });
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
