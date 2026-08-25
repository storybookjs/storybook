import { types as t } from 'storybook/internal/babel';
import {
  keyOf,
  returnedExpression,
  unwrapExpression,
  type ImportBinding,
} from 'storybook/internal/csf-tools';

import {
  classifyArg,
  type ClassifiedArg,
  type ClassifiedSlotArg,
  type VueDocgenArgInfo,
} from './classify-args.ts';
import { isFunctionExpression } from './classify-value.ts';
import {
  createRenderContext,
  escapeTextContent,
  formatRenderedProp,
  importStatementForBinding,
  indent,
  inlinePrimitiveSource,
  partitionArgsByRole,
  renderEventArg,
  renderPreparedSfcSnippet,
  renderPropLikeArg,
  renderSlotContent,
  wrapSlotContent,
  type RenderContext,
} from './render-primitives.ts';

export interface TransformHInput {
  /** Render-function expression to convert into Vue markup. */
  node: t.Node;
  /** Merged and classified CSF args visible to the render function. */
  args: ClassifiedArg[];
  /** Names of args explicitly set to `undefined`, which render as if they were never written. */
  unsetArgs: Set<string>;
  /** Name of the render function's args parameter. */
  argsParam?: string;
  /** Story component tag the docgen roles describe. */
  componentName: string;
  /** Import statement for the story component tag, after any `@import` override. */
  componentImportStatement?: string;
  /** Docgen roles used to classify values written directly into the render tree. */
  docgen: VueDocgenArgInfo;
  /** Import bindings from the CSF module. */
  importBindings: Map<string, ImportBinding>;
}

export interface TransformHResult {
  /** Vue SFC snippet for the docs payload. */
  snippet: string;
}

type HRenderOptions = {
  args: ClassifiedArg[];
  unsetArgs: ReadonlySet<string>;
  argsParam?: string;
  /** Story component tag the docgen roles apply to; absent in slot content. */
  componentName?: string;
  componentImportStatements: Map<string, string>;
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
  props?: t.Node;
  children?: t.Node;
};

const H_FUNCTION = 'h';

const NO_DOCGEN: VueDocgenArgInfo = { props: new Set(), events: new Set(), slots: new Set() };
const NO_UNSET_ARGS: ReadonlySet<string> = new Set();

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

/** Transform a statically decidable Vue `h()` tree into an SFC snippet. */
export function transformH(input: TransformHInput): TransformHResult | undefined {
  const ctx = createRenderContext();
  const componentImportStatements = input.componentImportStatement
    ? new Map([[input.componentName, input.componentImportStatement]])
    : new Map<string, string>();
  const templateCode = renderHNode(input.node, {
    args: input.args,
    unsetArgs: input.unsetArgs,
    argsParam: input.argsParam,
    componentName: input.componentName,
    componentImportStatements,
    ctx,
    docgen: input.docgen,
    importBindings: input.importBindings,
  });

  return templateCode
    ? {
        snippet: renderPreparedSfcSnippet({ templateCode, ctx }),
      }
    : undefined;
}

/** Slot children for one classified slot arg, or undefined when a function slot cannot render. */
export function renderSlotArgContent(
  arg: ClassifiedSlotArg,
  ctx: RenderContext,
  importBindings: Map<string, ImportBinding>,
  componentImportStatements: Map<string, string> = new Map()
): string | undefined {
  if (arg.plan.kind !== 'function-slot') {
    return renderSlotContent(arg, arg.plan, ctx);
  }

  const value = unwrapExpression(arg.value);
  return isFunctionExpression(value)
    ? renderHSlotFunction(value, ctx, importBindings, componentImportStatements)
    : undefined;
}

/** Render a zero-argument slot function whose body is a static `h()` child tree. */
function renderHSlotFunction(
  node: t.ArrowFunctionExpression | t.FunctionExpression,
  ctx: RenderContext,
  importBindings: Map<string, ImportBinding>,
  componentImportStatements: Map<string, string>
): string | undefined {
  if (node.params.length > 0) {
    return undefined;
  }

  const returned = returnedExpression(node);
  if (!returned) {
    return undefined;
  }

  return renderHNode(returned, {
    args: [],
    unsetArgs: NO_UNSET_ARGS,
    componentImportStatements,
    ctx,
    // Slot content renders children of components the story does not describe, so nothing here can
    // be resolved to a declared slot, event, or v-model.
    docgen: NO_DOCGEN,
    importBindings,
  });
}

// h('div', { class: 'row' }, 'Hi') -> <div class="row">Hi</div>
function renderHNode(node: t.Node, options: HRenderOptions): string | undefined {
  const value = unwrapExpression(node);
  if (!t.isCallExpression(value) || !t.isIdentifier(value.callee, { name: H_FUNCTION })) {
    return undefined;
  }

  const tag = renderTag(value.arguments[0], options);
  const hArguments = splitHArguments(value.arguments.slice(1));
  if (!tag || !hArguments || value.arguments.length > 3) {
    return undefined;
  }

  const props = renderProps(hArguments.props, tag, options);
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

function renderTag(node: t.Node | undefined | null, options: HRenderOptions): HTag | undefined {
  const tag = node ? unwrapExpression(node) : undefined;
  if (!tag) {
    return undefined;
  }

  if (t.isStringLiteral(tag)) {
    return isComponentName(tag.value)
      ? componentTag(tag.value, options)
      : { name: tag.value, selfClosing: isVoidElement(tag.value), void: isVoidElement(tag.value) };
  }

  return t.isIdentifier(tag) ? componentTag(tag.name, options) : undefined;
}

/**
 * Component tag whose import the snippet can declare, or `undefined` when it cannot be named.
 *
 * Every component tag the snippet prints has to come with an import, otherwise the snippet does not
 * compile where a reader pastes it.
 */
function componentTag(name: string, options: HRenderOptions): HTag | undefined {
  const importStatement =
    options.componentImportStatements.get(name) ??
    importStatementForBinding(name, options.importBindings.get(name));
  if (!importStatement) {
    return undefined;
  }

  options.ctx.componentImports.add(importStatement);
  return { name, selfClosing: true, void: false };
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
  const value = unwrapExpression(node);
  return (
    t.isStringLiteral(value) ||
    t.isArrayExpression(value) ||
    (t.isCallExpression(value) && t.isIdentifier(value.callee, { name: H_FUNCTION }))
  );
}

function renderProps(
  node: t.Node | undefined,
  tag: HTag,
  options: HRenderOptions
): { attributes: string[]; slotChildren: string[] } | undefined {
  // Docgen roles describe the story component only, so props on any other tag classify without
  // them rather than inheriting its slots, events, and models.
  const docgen = tag.name === options.componentName ? options.docgen : NO_DOCGEN;
  const args = node ? collectProps(node, { ...options, docgen }) : [];
  if (!args) {
    return undefined;
  }

  // Render the props and events as attributes, and the slots as children.
  const partitioned = partitionArgsByRole(args);
  const attributes = [
    ...partitioned.props.map((arg) => formatRenderedProp(renderPropLikeArg(arg, options.ctx))),
    ...partitioned.events.map((arg) => formatRenderedProp(renderEventArg(arg, options.ctx))),
  ];
  const slotChildren: string[] = [];
  for (const slot of partitioned.slots) {
    const content = renderSlotArgContent(
      slot,
      options.ctx,
      options.importBindings,
      options.componentImportStatements
    );
    // A function slot without renderable content would misrepresent the story, so bail.
    if (content === undefined) {
      return undefined;
    }
    slotChildren.push(wrapSlotContent(slot.name, content));
  }

  return { attributes, slotChildren };
}

/**
 * Classified args the props argument contributes, with later entries winning by name.
 *
 * Values written literally in the tree are classified by the same rules as the story's own args, so
 * `h(C, { default: () => h(Child) })` and `args: { default: … }` land in the same role and plan.
 */
// h(tag, null), h(tag, args), h(tag, { ...args, label: 'Hi' })
function collectProps(node: t.Node, options: HRenderOptions): ClassifiedArg[] | undefined {
  const value = unwrapExpression(node);

  if (t.isNullLiteral(value)) {
    return [];
  }

  if (isArgsIdentifier(value, options.argsParam)) {
    return [...options.args];
  }

  if (!t.isObjectExpression(value)) {
    return undefined;
  }

  const argsByName = new Map<string, ClassifiedArg>();
  for (const property of value.properties) {
    if (t.isSpreadElement(property)) {
      if (!isArgsIdentifier(property.argument, options.argsParam)) {
        return undefined;
      }
      for (const arg of options.args) {
        argsByName.set(arg.name, arg);
      }
      continue;
    }

    if (!t.isObjectProperty(property)) {
      return undefined;
    }

    const name = keyOf(property);
    if (!name) {
      return undefined;
    }

    const argValue = substituteArgsMember(property.value, options);

    if (!argValue) {
      if (!referencesUnsetArg(property.value, options)) {
        return undefined;
      }
      argsByName.delete(name);
      continue;
    }

    const classification = classifyArg(name, argValue, options.docgen);
    // A value written into the tree that the snippet cannot represent would silently change the
    // example, so bail rather than drop it the way story-level args do. Functions land on the
    // vnode at runtime even when no docgen role names them, so their omission bails too.
    if (
      classification.kind === 'unrepresentable' ||
      (classification.kind === 'omit' && isFunctionExpression(argValue))
    ) {
      return undefined;
    }

    if (classification.kind === 'classified') {
      argsByName.set(name, classification.arg);
    } else {
      argsByName.delete(name);
    }
  }

  return [...argsByName.values()];
}

// h(tag, { header: () => h('span') }) -> named slots; h(tag, 'Hi') -> one child
function renderChildren(node: t.Node | undefined, options: HRenderOptions): string[] | undefined {
  if (!node) {
    return [];
  }

  const value = unwrapExpression(node);
  return t.isObjectExpression(value)
    ? renderSlotsObject(value, options)
    : renderChildValue(value, options);
}

// 'Hi', h('b', 'Hi'), or ['a', h('b', 'c')] -> one markup child per rendered vnode
function renderChildValue(node: t.Node, options: HRenderOptions): string[] | undefined {
  const value = substituteArgsMember(node, options);
  // An `undefined` child renders nothing at all, so it contributes no markup.
  if (!value) {
    return referencesUnsetArg(node, options) ? [] : undefined;
  }

  const unwrapped = unwrapExpression(value);

  if (t.isCallExpression(unwrapped)) {
    if (!t.isIdentifier(unwrapped.callee, { name: H_FUNCTION })) {
      return undefined;
    }
    const child = renderHNode(unwrapped, options);
    return child === undefined ? undefined : [child];
  }

  if (t.isArrayExpression(unwrapped)) {
    const children: string[] = [];
    for (const element of unwrapped.elements) {
      if (!element || t.isSpreadElement(element)) {
        return undefined;
      }
      const rendered = renderChildValue(element, options);
      if (rendered === undefined) {
        return undefined;
      }
      children.push(...rendered);
    }
    return children;
  }

  const text = inlinePrimitiveSource(unwrapped);
  return text === undefined ? undefined : [escapeTextContent(text)];
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
    const slotFunction = unwrapExpression(property.value);
    if (!name || !isFunctionExpression(slotFunction)) {
      return undefined;
    }

    const content = renderHSlotFunction(
      slotFunction,
      options.ctx,
      options.importBindings,
      options.componentImportStatements
    );
    if (content === undefined) {
      return undefined;
    }
    slots.push(wrapSlotContent(name, content));
  }

  return slots;
}

// args.label -> the value node classified for 'label'
function substituteArgsMember(node: t.Node, options: HRenderOptions): t.Node | undefined {
  const value = unwrapExpression(node);
  if (!options.argsParam || !t.isMemberExpression(value) || value.computed) {
    return value;
  }

  const property = value.property;
  if (!t.isIdentifier(value.object, { name: options.argsParam }) || !t.isIdentifier(property)) {
    return value;
  }

  return options.args.find((candidate) => candidate.name === property.name)?.value;
}

// args.label -> whether 'label' is an arg the story explicitly set to `undefined`
function referencesUnsetArg(node: t.Node, options: HRenderOptions): boolean {
  const value = unwrapExpression(node);
  if (!options.argsParam || !t.isMemberExpression(value) || value.computed) {
    return false;
  }
  if (!t.isIdentifier(value.object, { name: options.argsParam })) {
    return false;
  }
  return t.isIdentifier(value.property) && options.unsetArgs.has(value.property.name);
}

function isArgsIdentifier(node: t.Node, argsParam: string | undefined): boolean {
  const value = unwrapExpression(node);
  return Boolean(argsParam && t.isIdentifier(value, { name: argsParam }));
}
