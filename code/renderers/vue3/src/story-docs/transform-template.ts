import {
  NodeTypes,
  parse,
  type AttributeNode,
  type DirectiveNode,
  type ElementNode,
  type SimpleExpressionNode,
  type TemplateChildNode,
} from '@vue/compiler-dom';

import { babelParseExpression, types as t } from 'storybook/internal/babel';
import { unwrapExpression } from 'storybook/internal/csf-tools';

import type { ClassifiedArg } from './classify-args.ts';
import { isFunctionExpression, printValue } from './classify-value.ts';
import {
  createRenderContext,
  dedentBlock,
  hoistArgValue,
  hoistModelRef,
  inlinePrimitiveSource,
  renderArgsBindingAttributes,
  renderBoundArgAttribute,
  renderPreparedSfcSnippet,
  VUE_PACKAGE,
  type RenderContext,
} from './render-primitives.ts';
import { ARGS_NAME, type SetupBlock } from './template-render-config.ts';

export interface TransformTemplateInput {
  /** Static Vue template markup from a render object. */
  template: string;
  /** Merged and classified CSF args for the story. */
  args: ClassifiedArg[];
  /** Component tag name to import statement from the render object's components map. */
  componentImports: Map<string, string>;
  /** Setup statements the template can reference. */
  setupBlock?: SetupBlock;
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

interface ArgsReference {
  start: number;
  end: number;
  name: string;
}

type ExpressionContext = 'directive' | 'interpolation';

const ARGS_IDENTIFIER_REGEXP = /(^|[^\w$])args([^\w$]|$)/;
const ARGS_MEMBER_REGEXP = /^args\.([A-Za-z_$][\w$]*)$/;

interface ComponentImport {
  importStatement: string;
  localName: string;
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
    ctx: createRenderContext(),
    edits: [],
    componentImports: input.componentImports,
    template: input.template,
  };

  if (!registerSetupBlock(input.setupBlock, state)) {
    return undefined;
  }

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

  const componentImport = componentImportForTag(node.tag, state.componentImports);
  if (componentImport) {
    state.ctx.componentImports.add(componentImport.importStatement);
    state.ctx.bindings.add(componentImport.localName);
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

  const expressionNode =
    directive.exp?.type === NodeTypes.SIMPLE_EXPRESSION ? directive.exp : undefined;
  const expression = expressionNode?.content.trim();

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
): ComponentImport | undefined {
  const direct = componentImports.get(tag);
  if (direct) {
    return { importStatement: direct, localName: tag };
  }

  const pascal = pascalCase(tag);
  const pascalImport = componentImports.get(pascal);
  return pascalImport ? { importStatement: pascalImport, localName: pascal } : undefined;
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

function registerSetupBlock(setupBlock: SetupBlock | undefined, state: TransformState): boolean {
  if (!setupBlock) {
    return true;
  }

  if (setupBlock.bindings.some((binding) => state.ctx.bindings.has(binding))) {
    return false;
  }

  // Vue's own `ref` import may take the reserved name: the v-model hoist dedupes with it. Any
  // other import must not collide, or two declarations would share one identifier.
  const importCollides = setupBlock.imports.some((binding) => {
    if (binding.importName === 'ref') {
      return binding.importId !== VUE_PACKAGE;
    }
    return state.ctx.bindings.has(binding.importName);
  });
  if (importCollides) {
    return false;
  }

  setupBlock.bindings.forEach((binding) => state.ctx.bindings.add(binding));
  setupBlock.imports.forEach((binding) => state.ctx.bindings.add(binding.importName));

  const edits: Edit[] = [];
  for (const reference of setupBlock.argsRefs) {
    const text = replacementForSetupArgsReference(reference.name, state);
    if (!text) {
      return false;
    }
    edits.push({
      end: reference.end - setupBlock.start,
      start: reference.start - setupBlock.start,
      text,
    });
  }

  for (const binding of setupBlock.imports) {
    (state.ctx.imports[binding.importId] ??= new Set()).add(binding.importName);
  }

  state.ctx.setupSource = dedentBlock(applyEdits(setupBlock.source, edits));
  return true;
}

function replacementForSetupArgsReference(name: string, state: TransformState): string | undefined {
  const arg = state.argsByName.get(name);
  if (!arg || arg.role === 'slot') {
    return undefined;
  }

  return arg.plan.kind === 'inline'
    ? printValue(unwrapExpression(arg.value))
    : hoistSetupArgValue(arg.name, arg.value, state);
}

function hoistSetupArgValue(name: string, value: t.Node, state: TransformState): string {
  const bindingName = hoistArgValue(name, value, state.ctx);
  const source = state.ctx.variables.get(bindingName);
  if (source) {
    state.ctx.variables.delete(bindingName);
    state.ctx.setupVariables.set(bindingName, source);
  }
  return bindingName;
}
