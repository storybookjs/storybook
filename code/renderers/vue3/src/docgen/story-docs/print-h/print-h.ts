import {
  type ESTree as E,
  type ESTreeNode as Node,
  type ImportBinding,
  codeOf,
  isStringLiteral,
  keyOf,
  returnedExpression,
  unwrapExpression,
  walk,
} from 'storybook/internal/csf-tools';

import {
  classifyArg,
  type ClassifiedSlotArg,
  type VueDocgenArgInfo,
} from '../classify-args/classify-args.ts';
import { isFunctionExpression, printValue } from '../../shared/classify-value.ts';
import {
  escapeTextContent,
  formatRenderedProp,
  importStatementForBinding,
  indent,
  inlinePrimitiveSource,
  renderEventArg,
  renderPropLikeArg,
  renderSlotContent,
  wrapSlotContent,
  type RenderContext,
} from '../../shared/render-primitives.ts';

export interface PrintHInput {
  /** Render-function expression to print as template markup. */
  node: Node;
  /** Name of the render function's args parameter. */
  argsParam?: string;
  /** Story component tag the docgen roles describe. */
  componentName: string;
  /** Import statement for the story component tag, after any `@import` override. */
  componentImportStatement?: string;
  /** Docgen roles used to classify values written literally on the story tag. */
  docgen: VueDocgenArgInfo;
  /** Import bindings from the CSF module. */
  importBindings: Map<string, ImportBinding>;
  /** Render context collecting imports and hoisted literals for the engine to build on. */
  ctx: RenderContext;
}

export interface PrintHResult {
  /** Vue template markup with story args preserved as `args` expressions. */
  template: string;
  /** Component tag name to import statement for every tag the markup references. */
  componentImports: Map<string, string>;
}

export interface PrintHFragmentOptions {
  /** Render context collecting imports for components the fragment references. */
  ctx: RenderContext;
  /** Import bindings from the CSF module. */
  importBindings: Map<string, ImportBinding>;
  /** Component tag name to import statement overrides consulted before the import bindings. */
  componentImportStatements?: Map<string, string>;
}

type PrintOptions = {
  /** Render-function args parameter the printed markup references as `args`; absent in fragments. */
  argsParam?: string;
  /** Story component tag the docgen roles apply to; absent in slot content. */
  componentName?: string;
  componentImports: Map<string, string>;
  ctx: RenderContext;
  docgen: VueDocgenArgInfo;
  importBindings: Map<string, ImportBinding>;
};

type HTag = {
  name: string;
  selfClosing: boolean;
  /** Native void element, which cannot carry children or a closing tag. */
  void: boolean;
};

type HArguments = {
  props?: Node;
  children?: Node;
};

type PrintedProps = {
  attributes: string[];
  slotChildren: string[];
};

const H_FUNCTION = 'h';
const ARGS_NAME = 'args';
const ARGS_BINDING = `v-bind="${ARGS_NAME}"`;

const NO_DOCGEN: VueDocgenArgInfo = { props: new Set(), events: new Set(), slots: new Set() };

/** @see https://html.spec.whatwg.org/multipage/syntax.html#void-elements */
const VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'source',
  'track',
  'wbr',
]);

const isVoidElement = (name: string): boolean => VOID_ELEMENTS.has(name);

// Vue resolves a capitalized tag name as a component rather than a native element.
const isComponentName = (name: string): boolean => /^[A-Z]/.test(name);

/**
 * Prints a statically decidable `h()` tree as template markup, preserving story args as `args`
 * expressions for the template engine to substitute.
 *
 * @example `h(C, { ...args, label: args.label })` → `<C v-bind="args" :label="args.label" />`
 */
export function printH(input: PrintHInput): PrintHResult | undefined {
  // Renaming the render parameter to `args` would capture any other binding already named `args`.
  if (
    input.argsParam &&
    input.argsParam !== ARGS_NAME &&
    referencesIdentifier(input.node, ARGS_NAME)
  ) {
    return undefined;
  }

  const componentImports = new Map<string, string>();
  if (input.componentImportStatement) {
    componentImports.set(input.componentName, input.componentImportStatement);
  }

  const template = printNode(input.node, {
    argsParam: input.argsParam,
    componentName: input.componentName,
    componentImports,
    ctx: input.ctx,
    docgen: input.docgen,
    importBindings: input.importBindings,
  });

  return template === undefined ? undefined : { template, componentImports };
}

/** Markup for a zero-argument slot function whose body is a static, args-free `h()` child tree. */
export function printHFragment(
  node: E.ArrowFunctionExpression | E.Function,
  options: PrintHFragmentOptions
): string | undefined {
  return printFragmentFunction(node, {
    componentImports: options.componentImportStatements ?? new Map(),
    ctx: options.ctx,
    docgen: NO_DOCGEN,
    importBindings: options.importBindings,
  });
}

// h('div', { class: 'row' }, 'Hi') -> <div class="row">Hi</div>
function printNode(node: Node, options: PrintOptions): string | undefined {
  const value = unwrapExpression(node);
  if (!isHCall(value)) {
    return undefined;
  }

  const tag = renderTag(value.arguments[0], options);
  const hArguments = splitHArguments(value.arguments.slice(1));
  if (!tag || !hArguments || value.arguments.length > 3) {
    return undefined;
  }

  const props = printProps(hArguments.props, tag, options);
  if (props === undefined) {
    return undefined;
  }

  const children = printChildren(hArguments.children, options);
  if (children === undefined) {
    return undefined;
  }

  if (props.slotChildren.length > 0) {
    if (children.length > 0) {
      return undefined;
    }
    children.push(...props.slotChildren);
  }

  // A void element has no closing tag to put children before, so a tree that gives it any is not
  // representable as markup at all.
  if (tag.void && children.length > 0) {
    return undefined;
  }

  const openTag = [tag.name, ...props.attributes].join(' ');
  if (children.length === 0) {
    return tag.selfClosing ? `<${openTag} />` : `<${openTag}></${tag.name}>`;
  }

  return `<${openTag}>${joinChildren(children)}</${tag.name}>`;
}

/**
 * Children on their own indented lines once they are all markup, and inline otherwise.
 *
 * Text children stay inline because breaking them introduces whitespace that Vue would render.
 */
function joinChildren(children: string[]): string {
  return children.every((child) => child.startsWith('<'))
    ? `\n${indent(children.join('\n'))}\n`
    : children.join('');
}

function renderTag(node: Node | undefined | null, options: PrintOptions): HTag | undefined {
  const tag = node ? unwrapExpression(node) : undefined;
  if (!tag) {
    return undefined;
  }

  if (isStringLiteral(tag)) {
    return isComponentName(tag.value)
      ? componentTag(tag.value, options)
      : { name: tag.value, selfClosing: isVoidElement(tag.value), void: isVoidElement(tag.value) };
  }

  return tag.type === 'Identifier' ? componentTag(tag.name, options) : undefined;
}

/**
 * Component tag whose import the snippet can declare, or `undefined` when it cannot be named.
 *
 * Every component tag the snippet prints has to come with an import, otherwise the snippet does not
 * compile where a reader pastes it.
 */
function componentTag(name: string, options: PrintOptions): HTag | undefined {
  const importStatement =
    options.componentImports.get(name) ??
    importStatementForBinding(name, options.importBindings.get(name));
  if (!importStatement) {
    return undefined;
  }

  options.ctx.componentImports.add(importStatement);
  options.componentImports.set(name, importStatement);
  return { name, selfClosing: true, void: false };
}

function splitHArguments(args: E.Argument[]): HArguments | undefined {
  if (args.some((arg) => arg.type === 'SpreadElement')) {
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
function isChildrenArgument(node: Node): boolean {
  const value = unwrapExpression(node);
  return isStringLiteral(value) || value.type === 'ArrayExpression' || isHCall(value);
}

function isHCall(node: Node): node is E.CallExpression {
  return (
    node.type === 'CallExpression' &&
    node.callee.type === 'Identifier' &&
    node.callee.name === H_FUNCTION
  );
}

// A plain `key: value` member, not a method or accessor.
function isValueProperty(node: Node): node is E.ObjectProperty {
  return node.type === 'Property' && !node.method && node.kind === 'init';
}

/**
 * Attributes and slot children for one props argument, in source order.
 *
 * Source order is what makes the engine's later-wins collision resolution faithful: a spread
 * before a literal key loses to it exactly as it does in the object literal.
 *
 * @example `{ label: 'Hi', ...args }` → `label="Hi" v-bind="args"`
 */
function printProps(
  node: Node | undefined,
  tag: HTag,
  options: PrintOptions
): PrintedProps | undefined {
  if (!node) {
    return { attributes: [], slotChildren: [] };
  }

  const value = unwrapExpression(node);
  if (value.type === 'Literal' && value.raw === 'null') {
    return { attributes: [], slotChildren: [] };
  }
  if (isArgsIdentifier(value, options.argsParam)) {
    return { attributes: [ARGS_BINDING], slotChildren: [] };
  }
  if (value.type !== 'ObjectExpression') {
    return undefined;
  }

  // Docgen roles describe the story component only, so props on any other tag classify without
  // them rather than inheriting its slots, events, and models.
  const docgen = tag.name === options.componentName ? options.docgen : NO_DOCGEN;
  const attributes: string[] = [];
  const slotChildren: string[] = [];

  for (const property of value.properties) {
    if (property.type === 'SpreadElement') {
      if (!isArgsIdentifier(property.argument, options.argsParam)) {
        return undefined;
      }
      attributes.push(ARGS_BINDING);
      continue;
    }
    if (!isValueProperty(property)) {
      return undefined;
    }

    const name = keyOf(property);
    if (!name) {
      return undefined;
    }
    const propValue = unwrapExpression(property.value);

    if (options.argsParam && referencesIdentifier(propValue, options.argsParam)) {
      const expression = printedArgsExpression(propValue, options.argsParam);
      // '&' entity-decodes and '"' ends the attribute when the engine re-parses the markup.
      if (!expression || expression.includes('"') || expression.includes('&')) {
        return undefined;
      }
      attributes.push(argsExpressionAttribute(name, expression));
      continue;
    }

    const classification = classifyArg(name, propValue, docgen);
    // A value written into the tree that the snippet cannot represent would silently change the
    // example, so bail rather than drop it the way story-level args do. Functions land on the
    // vnode at runtime even when no docgen role names them, so their omission bails too.
    if (
      classification.kind === 'unrepresentable' ||
      (classification.kind === 'omit' && isFunctionExpression(propValue))
    ) {
      return undefined;
    }
    if (classification.kind === 'omit' || classification.kind === 'unset') {
      continue;
    }

    const arg = classification.arg;
    if (arg.role === 'slot') {
      const content = printSlotArgContent(arg, options);
      if (content === undefined) {
        return undefined;
      }
      slotChildren.push(wrapSlotContent(arg.name, content));
      continue;
    }
    attributes.push(
      formatRenderedProp(
        arg.role === 'event'
          ? renderEventArg(arg, options.ctx)
          : renderPropLikeArg(arg, options.ctx)
      )
    );
  }

  return { attributes, slotChildren };
}

/** Slot children for one literal slot value, realizing function slots as printed fragments. */
function printSlotArgContent(arg: ClassifiedSlotArg, options: PrintOptions): string | undefined {
  if (arg.plan.kind !== 'function-slot') {
    return renderSlotContent(arg, arg.plan, options.ctx);
  }

  const value = unwrapExpression(arg.value);
  return isFunctionExpression(value) ? printFragmentFunction(value, options) : undefined;
}

/** Fragments print args-free: their content belongs to components the story does not describe. */
function printFragmentFunction(
  node: E.ArrowFunctionExpression | E.Function,
  options: Omit<PrintOptions, 'argsParam' | 'componentName'>
): string | undefined {
  if (node.params.length > 0) {
    return undefined;
  }

  const returned = returnedExpression(node);
  if (!returned) {
    return undefined;
  }

  return printNode(returned, {
    componentImports: options.componentImports,
    ctx: options.ctx,
    docgen: NO_DOCGEN,
    importBindings: options.importBindings,
  });
}

// h(tag, { header: () => h('span') }) -> named slots; h(tag, 'Hi') -> one child
function printChildren(node: Node | undefined, options: PrintOptions): string[] | undefined {
  if (!node) {
    return [];
  }

  const value = unwrapExpression(node);
  return value.type === 'ObjectExpression'
    ? printSlotsObject(value, options)
    : printChildValue(value, options);
}

// 'Hi', h('b', 'Hi'), args.label, or ['a', h('b', 'c')] -> one child per rendered vnode
function printChildValue(node: Node, options: PrintOptions): string[] | undefined {
  const value = unwrapExpression(node);

  if (value.type === 'CallExpression') {
    if (!isHCall(value)) {
      return undefined;
    }
    const child = printNode(value, options);
    return child === undefined ? undefined : [child];
  }

  if (value.type === 'ArrayExpression') {
    const children: string[] = [];
    for (const element of value.elements) {
      if (!element || element.type === 'SpreadElement') {
        return undefined;
      }
      const rendered = printChildValue(element, options);
      if (rendered === undefined) {
        return undefined;
      }
      children.push(...rendered);
    }
    return children;
  }

  if (options.argsParam && referencesIdentifier(value, options.argsParam)) {
    const expression = printedArgsExpression(value, options.argsParam);
    // '&' entity-decodes and '}}' ends the interpolation when the engine re-parses the markup.
    if (!expression || expression.includes('&') || expression.includes('}}')) {
      return undefined;
    }
    return [`{{ ${expression} }}`];
  }

  const text = inlinePrimitiveSource(value);
  return text === undefined ? undefined : [escapeTextContent(text)];
}

// { header: () => h('span', 'Hi') } -> <template #header><span>Hi</span></template>
function printSlotsObject(value: E.ObjectExpression, options: PrintOptions): string[] | undefined {
  const slots: string[] = [];

  for (const property of value.properties) {
    if (!isValueProperty(property)) {
      return undefined;
    }

    const name = keyOf(property);
    const slotFunction = unwrapExpression(property.value);
    if (!name || !isFunctionExpression(slotFunction)) {
      return undefined;
    }

    const content = printFragmentFunction(slotFunction, options);
    if (content === undefined) {
      return undefined;
    }
    slots.push(wrapSlotContent(name, content));
  }

  return slots;
}

// 'onItemClick' -> '@itemClick="expr"' mirrors Vue's h-props listener rule; others bind ':name'
function argsExpressionAttribute(name: string, expression: string): string {
  const match = /^on([A-Z].*)/.exec(name);
  if (!match) {
    return `:${name}="${expression}"`;
  }
  const eventName = `${match[1].charAt(0).toLowerCase()}${match[1].slice(1)}`;
  return `@${eventName}="${expression}"`;
}

/**
 * Source text of an expression whose only free references are the args parameter, renamed to
 * `args`, or `undefined` when it reads anything else the printed template cannot declare.
 *
 * @example (param `a`) `a.count + 1` → `args.count + 1`; `a.label + suffix` → undefined
 */
function printedArgsExpression(node: Node, argsParam: string): string | undefined {
  if (!isPrintableArgsExpression(node, argsParam)) {
    return undefined;
  }
  if (argsParam === ARGS_NAME) {
    return printValue(node);
  }

  const source = codeOf(node);
  const start = (node as Node & { start: number }).start;
  let renamed = '';
  let cursor = 0;
  for (const { identifier, shorthand } of identifierReferences(node, argsParam)) {
    renamed += source.slice(cursor, identifier.start - start);
    renamed += shorthand ? `${argsParam}: ${ARGS_NAME}` : ARGS_NAME;
    cursor = identifier.end - start;
  }
  return renamed + source.slice(cursor);
}

/**
 * Expression shapes that survive printing into a template attribute or interpolation and
 * re-parsing by the engine, with the args parameter as the only free reference.
 */
function isPrintableArgsExpression(node: Node, argsParam: string): boolean {
  const value = unwrapExpression(node);
  const valid = (child: Node): boolean => isPrintableArgsExpression(child, argsParam);

  switch (value.type) {
    case 'Literal':
      return !('regex' in value && value.regex);

    case 'Identifier':
      return value.name === argsParam;

    case 'TemplateLiteral':
      return value.expressions.every(valid);

    case 'ArrayExpression':
      return value.elements.every((element) => element !== null && valid(element));

    case 'ObjectExpression':
      return value.properties.every(
        (property) =>
          isValueProperty(property) &&
          (!property.computed || valid(property.key)) &&
          valid(property.value)
      );

    // Only an optional member chain; an optional call is not printable.
    case 'ChainExpression':
      return value.expression.type === 'MemberExpression' && valid(value.expression);

    case 'MemberExpression':
      return (
        valid(value.object) &&
        (value.computed ? valid(value.property) : value.property.type === 'Identifier')
      );

    case 'CallExpression':
    case 'NewExpression':
      return valid(value.callee) && value.arguments.every(valid);

    case 'UnaryExpression':
      return value.operator !== 'delete' && valid(value.argument);

    case 'BinaryExpression':
    case 'LogicalExpression':
      return valid(value.left) && valid(value.right);

    case 'ConditionalExpression':
      return valid(value.test) && valid(value.consequent) && valid(value.alternate);

    default:
      return false;
  }
}

/** Whether the expression reads the identifier anywhere outside member properties and object keys. */
function referencesIdentifier(node: Node, name: string): boolean {
  return identifierReferences(node, name).length > 0;
}

/** Reads of an identifier in source order, flagging the ones written as a shorthand property. */
function identifierReferences(
  root: Node,
  name: string
): { identifier: E.IdentifierReference & { start: number; end: number }; shorthand: boolean }[] {
  const byStart = new Map<
    number,
    { identifier: E.IdentifierReference & { start: number; end: number }; shorthand: boolean }
  >();
  walk(root, (node, parent) => {
    if (node.type !== 'Identifier' || node.name !== name) {
      return;
    }
    // args.label -> 'label' and { label: 1 } -> 'label' are name positions, not references
    if (parent?.type === 'MemberExpression' && parent.property === node && !parent.computed) {
      return;
    }
    if (
      parent?.type === 'Property' &&
      parent.key === node &&
      !parent.computed &&
      !parent.shorthand
    ) {
      return;
    }
    const identifier = node as E.IdentifierReference & { start: number; end: number };
    byStart.set(identifier.start, {
      identifier,
      shorthand: parent?.type === 'Property' && parent.shorthand,
    });
  });
  return [...byStart.values()].sort((a, b) => a.identifier.start - b.identifier.start);
}

function isArgsIdentifier(node: Node, argsParam: string | undefined): boolean {
  const value = unwrapExpression(node);
  return Boolean(argsParam && value.type === 'Identifier' && value.name === argsParam);
}
