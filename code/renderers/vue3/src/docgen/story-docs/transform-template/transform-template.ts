import {
  NodeTypes,
  parse,
  type DirectiveNode,
  type ElementNode,
  type SimpleExpressionNode,
  type TemplateChildNode,
} from '@vue/compiler-dom';

import {
  type ESTree as E,
  type ESTreeNode as Node,
  type ImportBinding,
  argCode,
  isOperand,
  isStringLiteral,
  normalizeLineEndings,
  parseModule,
  propertyValue,
  staticKey,
  unwrapExpression,
  walk,
} from 'storybook/internal/csf-tools';
import { defaultWord, hasHoleBracket, hole, holeWord } from 'storybook/internal/docs-tools';

import type {
  ClassifiedArg,
  ClassifiedPropLikeArg,
  ClassifiedSlotArg,
} from '../classify-args/classify-args.ts';
import { printHFragment } from '../print-h/print-h.ts';
import { isFunctionExpression } from '../../shared/classify-value.ts';
import {
  readForwardableSetup,
  type ForwardableSetup,
  type ForwardableStatement,
  type ArgsRead,
} from './forward-setup.ts';
import {
  createRenderContext,
  hoistArgCode,
  hoistModelRef,
  importStatementForBinding,
  quoteAttributeValue,
  renderPreparedSfcSnippet,
  renderSlotContent,
  type RenderContext,
} from '../../shared/render-primitives.ts';

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
  /** Static Vue template markup from a render object, or printed from an `h()` tree. */
  template: string;
  /** Component tag name to import statement from the render object's components map. */
  componentImports: Map<string, string>;
  /** The story component's slots, which `v-bind="args"` does not pass. */
  slots: string[];
  /** Merged and classified CSF args for the story. */
  args?: ClassifiedArg[];
  /** The node the story writes each arg with, which decides where its code needs parentheses. */
  written?: Record<string, Node>;
  /** Pre-seeded context carrying imports and hoists an upstream printer collected. */
  ctx?: RenderContext;
  /** Setup statements to forward into the snippet's script. */
  setup?: ForwardableSetup;
}

type Edit = { start: number; end: number; text: string };

type Spanned = { start: number; end: number };

const SETUP_PROPERTY = 'setup';

const TEMPLATE_UNREADABLE_WARNING =
  'No static snippet: the `template` could not be read statically.';
const COMPONENTS_UNREADABLE_WARNING =
  'No static snippet: the `components` map could not be read statically.';

/** Read a transformable template-render object without resolving the render function itself. */
export function readTemplateRenderConfig(
  renderObject: E.ObjectExpression,
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
 * The story's template: the Vue template markup and the statements of its `setup` as written, with
 * a hole wherever they read an arg, for `fillTemplate`. The static snippet is this template filled
 * with the story's own args.
 *
 * This is the single args-semantics engine: author-written render templates and markup printed from
 * `h()` trees both pass through here. The template is parsed with Vue's own parser, and only the
 * ranges that read an arg are replaced, so every other author byte survives verbatim. It is
 * `undefined` when the code reads the args in a way no hole stands for, such as `args` passed
 * whole or a read in an event handler, or when Vue itself refuses to parse it.
 *
 * An arg the story sets to more than a literal, such as an object or an array, is a `const` with a
 * hole for its value, so every read of it is the same value, as in the story. A listener bound to an
 * arg, as `@click="args.onClick"`, is a `const` too. `written` holds the node the story writes each
 * arg with, which decides where its code needs parentheses; see `isOperand`.
 */
export function transformTemplate(input: TransformTemplateInput): string | undefined {
  const { componentImports, slots, setup, args = [], written = {} } = input;
  // `parseModule` normalizes line endings, so template expressions must already use `\n`.
  const template = normalizeLineEndings(input.template);
  const statements = setup?.statements ?? [];
  let invalid = [template, ...statements.map(({ source }) => source)].some(hasHoleBracket);
  const root = parse(template, { onError: () => (invalid = true) });
  const ctx = input.ctx ?? createRenderContext();
  const edits: Edit[] = [];
  // A `setup` binding or a `v-for` variable named `args` is not the story's args.
  if (
    (setup && !seedForwardedSetup(setup, ctx)) ||
    !collectTemplateScopeBindings(root.children, ctx) ||
    ctx.bindings.has('args')
  ) {
    return undefined;
  }
  const hoisted = new Set(
    args.filter((arg) => arg.role !== 'slot' && arg.plan.kind === 'hoist').map((arg) => arg.name)
  );
  const writtenAs = (name: string) => (Object.hasOwn(written, name) ? written[name] : undefined);
  const scriptValue = (name: string) => hole('value', holeWord(name), 'script');
  const constFor = (name: string) =>
    hoisted.has(name) ? hoistArgCode(name, scriptValue(name), ctx) : undefined;

  const visit = (node: TemplateChildNode): boolean => {
    if (node.type === NodeTypes.INTERPOLATION) {
      // `{{ args.label }}` is the arg as content.
      const { start, end } = node.loc;
      const holes = argHoles(
        node.content as SimpleExpressionNode,
        template,
        '{{',
        constFor,
        writtenAs,
        (name) => ({
          start: start.offset,
          end: end.offset,
          text: hole('text', holeWord(name)),
        })
      );
      edits.push(...(holes ?? []));
      return holes !== undefined;
    }
    if (node.type !== NodeTypes.ELEMENT) {
      return true;
    }
    const importStatement = componentImportForTag(node.tag, componentImports);
    if (importStatement) {
      ctx.componentImports.add(importStatement);
    }
    for (const [index, prop] of node.props.entries()) {
      if (prop.type !== NodeTypes.DIRECTIVE) {
        continue;
      }
      const arg = prop.arg as SimpleExpressionNode | undefined;
      // A dynamic argument, as in `:[args.key]`, reads an arg where no hole can stand.
      if (arg && !arg.isStatic && /\bargs\b/.test(arg.content)) {
        return false;
      }
      if (!prop.exp) {
        continue;
      }
      const exp = prop.exp as SimpleExpressionNode;
      const { start, end } = prop.loc;
      // `v-bind="args"` passes every arg but the slots and the attributes written after it, which
      // win; see `spreadArgs`.
      if (prop.name === 'bind' && !arg && exp.content.trim() === 'args') {
        const attributes = node.props.map(attributeName);
        const names = (props: (string | undefined)[]) =>
          props.flatMap((name) => (name === undefined ? [] : spellings(name)));
        const own = [...slots, ...names(attributes.slice(index + 1))];
        const words = [
          ...names(attributes.slice(0, index)).map((name) => `^${name}`),
          ...own.map((name) => `-${name}`),
        ];
        edits.push({
          start: start.offset,
          end: end.offset,
          text: spreadAttributes(args, words, ctx, Object.keys(written)),
        });
        continue;
      }
      const read = ARGS_MEMBER_REGEXP.exec(exp.content.trim())?.[1];
      // `v-model="args.open"` binds a ref that starts as the arg, empty while it is unset, and
      // `@click="args.onClick"` the listener the arg holds, each as the static snippet writes it. An
      // arg the story leaves unset attaches no listener, as an absent one does.
      if (read && prop.name === 'on' && arg && !args.some(({ name }) => name === read)) {
        const before = template.slice(0, start.offset).trimEnd().length;
        edits.push({ start: before, end: end.offset, text: '' });
        continue;
      }
      if (read && (prop.name === 'model' || (prop.name === 'on' && arg))) {
        const text =
          prop.name === 'model'
            ? hoistModelRef(read, modelValue(read), ctx)
            : hoistArgCode(read, scriptValue(read), ctx);
        edits.push({ start: exp.loc.start.offset, end: exp.loc.end.offset, text });
        continue;
      }
      // `:label="args.label"` is one attribute, unless a modifier changes how it binds or the
      // element writes `label` itself too, as `class` next to `:class`.
      const name =
        prop.name === 'bind' && arg?.isStatic && prop.modifiers.length === 0
          ? arg.content
          : undefined;
      const owned = node.props.every(
        (other) => other === prop || other.type !== NodeTypes.ATTRIBUTE || other.name !== name
      );
      const quote = template[exp.loc.start.offset - 1];
      const holes = argHoles(exp, template, quote, constFor, writtenAs, (word) =>
        name !== undefined && owned
          ? { start: start.offset, end: end.offset, text: hole('attr', name, holeWord(word)) }
          : undefined
      );
      const unusual = prop.name === 'on' || prop.name === 'model' || (arg && !arg.isStatic);
      if (!holes || (holes.length > 0 && unusual)) {
        return false;
      }
      edits.push(...holes);
    }
    return node.children.every(visit);
  };

  if (!root.children.every(visit) || invalid) {
    return undefined;
  }
  let templateCode = template;
  for (const { start, end, text } of edits.sort((a, b) => b.start - a.start)) {
    templateCode = templateCode.slice(0, start) + text + templateCode.slice(end);
  }
  // A statement reads its args as code in the `<script>`, which the `script` word says, and `;`
  // that it starts the statement after one without a `;`.
  ctx.statements.push(
    ...statements.map((statement, index) =>
      setupStatementCode(
        statement,
        statements[index - 1],
        ({ name, operand }, _, startsLine) =>
          constFor(name) ??
          hole(
            operand(writtenAs(name)) ? 'operand' : 'value',
            holeWord(name),
            'script',
            ...(startsLine ? [';'] : [])
          )
      )
    )
  );
  return renderPreparedSfcSnippet({ templateCode, ctx });
}

/** A story's template, with the code an arg the story writes as more than a literal prints. */
export interface StoryTemplateCode {
  template: string;
  /** Code that replaces the arg's `argCode`, for a slot whose content the provider prints. */
  argCode?: Record<string, string>;
}

/**
 * A story without a render function is Storybook's render of the component: `v-bind="args"` as
 * `spreadAttributes` writes it, and the slots as content, default first.
 *
 * A slot the story writes as more than a literal is content the provider prints once, as the
 * static snippet shows it: a function's `h()` tree as markup, with the imports it needs, or its
 * returned value as text. That is the slot's `argCode`, which the `⟦slots⟧` hole prints as it is
 * while the arg is unchanged. It is `undefined` for a slot function no markup stands for, such as
 * one that reads its slot props.
 */
export function componentTemplate(
  name: string,
  importStatement: string,
  slots: string[],
  args: ClassifiedArg[],
  written: Record<string, Node>,
  importBindings: Map<string, ImportBinding>
): StoryTemplateCode | undefined {
  const ctx = createRenderContext();
  ctx.componentImports.add(importStatement);
  const attributes = spreadAttributes(
    args,
    slots.map((slot) => `-${slot}`),
    ctx,
    Object.keys(written)
  );
  const code = argCode(written);
  const slotCode: Record<string, string> = {};
  for (const slot of slots.filter((slot) => Object.hasOwn(code, slot))) {
    const arg = args.find(
      (candidate): candidate is ClassifiedSlotArg =>
        candidate.role === 'slot' && candidate.name === slot
    );
    // A slot arg that is no content, as an empty string or a value the snippet cannot declare,
    // shows nothing.
    const content = !arg
      ? ''
      : arg.plan.kind === 'function-slot'
        ? isFunctionExpression(arg.value)
          ? printHFragment(arg.value, {
              componentImportStatements: new Map([[name, importStatement]]),
              ctx,
              importBindings,
            })
          : undefined
        : renderSlotContent(arg, arg.plan, ctx);
    if (content === undefined) {
      return undefined;
    }
    slotCode[slot] = content;
  }
  const ordered = [...slots].sort((a, b) =>
    a === 'default' ? -1 : b === 'default' ? 1 : a.localeCompare(b)
  );
  return {
    template: renderPreparedSfcSnippet({
      templateCode: `<${name} ${attributes}${hole('slots', name, ...ordered.map(holeWord))}`,
      ctx,
    }),
    argCode: slotCode,
  };
}

/**
 * `v-bind="args"` as the static snippet writes it, for the args a `⟦props⟧` hole with `words` would
 * pass: each arg the story writes in name order, then its listeners. An arg it hoists to a `const`,
 * a model arg as the `v-model` of a `ref` and an event as a listener each have a hole for its
 * value, any other arg an `⟦attr⟧` hole, and a `⟦props⟧` hole passes the args the story does not
 * write.
 */
function spreadAttributes(
  args: ClassifiedArg[],
  words: string[],
  ctx: RenderContext,
  storyArgs: string[]
): string {
  const hoists = (arg: ClassifiedPropLikeArg) => {
    const value = unwrapExpression(arg.value);
    return (
      arg.role !== 'prop' ||
      arg.plan.kind === 'hoist' ||
      (isStringLiteral(value) && quoteAttributeValue(value.value) === undefined)
    );
  };
  const byName = new Map(args.map((arg) => [arg.name, arg]));
  const names = [...new Set([...storyArgs, ...byName.keys()])]
    .filter((name) => /^[A-Za-z_][\w-]*$/.test(name) && byName.get(name)?.role !== 'slot')
    .filter((name) => !words.some((word) => word.slice(1) === name))
    .sort((a, b) => a.localeCompare(b));
  const value = (name: string) => hole('value', holeWord(name), 'script');
  const listeners: string[] = [];
  const attributes = names.flatMap((name) => {
    const arg = byName.get(name) as ClassifiedPropLikeArg | undefined;
    if (!arg || !hoists(arg)) {
      return [hole('attr', name, name)];
    }
    if (arg.role === 'model') {
      const directive = name === 'modelValue' ? 'v-model' : `v-model:${name}`;
      return [`${directive}="${hoistModelRef(name, modelValue(name), ctx)}"`];
    }
    if (arg.role === 'event') {
      listeners.push(name);
      return [];
    }
    return [`:${name}="${hoistArgCode(name, value(name), ctx)}"`];
  });
  const events = listeners.map((name) => {
    const arg = byName.get(name) as ClassifiedPropLikeArg;
    return `@${arg.eventName}="${hoistArgCode(name, value(name), ctx)}"`;
  });
  const omitted = [...words, ...names.map((name) => `-${name}`)];
  return [...attributes, hole('props', ...omitted.map(holeWord)), ...events].join(' ');
}

/** The value a `v-model` ref starts as: the arg, or nothing while it is unset, as `ref()`. */
const modelValue = (name: string) => hole('value', holeWord(name), 'script', defaultWord(''));

const ARGS_MEMBER_REGEXP = /^args\.([A-Za-z_$][\w$]*)$/;

const QUOTE_WORDS: Record<string, string[]> = { '"': [], "'": ["'"], '{{': ['{{'] };

// A value hole for each `args.label` an expression reads, its `const` for an arg that has one, or
// the `whole` edit when it is nothing but that read; `undefined` when it reads `args` another way.
// A hole in an attribute value written in single quotes says so with a `'` word, and one in an
// interpolation, which `quote` gives as `{{`, with a `{{` word.
function argHoles(
  exp: SimpleExpressionNode,
  template: string,
  quote: string | undefined,
  constFor: (name: string) => string | undefined,
  writtenAs: (name: string) => Node | undefined,
  wholeEdit: (name: string) => Edit | undefined
): Edit[] | undefined {
  const offset = exp.loc.start.offset;
  if (!/\bargs\b/.test(exp.content)) {
    return [];
  }
  const ast = parseTemplateExpression(exp.content);
  if (!ast) {
    return undefined;
  }
  // Vue decodes entities in an attribute, which would shift the offsets.
  if (template.slice(offset, exp.loc.end.offset) !== exp.content) {
    return undefined;
  }
  // `args?.label` is a read the whole expression is, as `args.label` is.
  const whole = ast.type === 'ChainExpression' ? ast.expression : ast;
  const holes: (Edit | undefined)[] = [];
  const parents = new Map<Node, Node | null>();
  walk(ast, (node, parent) => {
    parents.set(node, parent);
    if (node.type !== 'Identifier' || node.name !== 'args' || !isReferenced(node, parent)) {
      return;
    }
    const member =
      parent?.type === 'MemberExpression' && parent.object === node ? parent : undefined;
    const name =
      member &&
      (!member.computed && member.property.type === 'Identifier'
        ? member.property.name
        : member.computed && isStringLiteral(member.property) && member.property.value);
    const around: Node[] = [];
    for (let above = member && parents.get(member); above; above = parents.get(above)) {
      around.push(above);
    }
    const [above] = around;
    // The target of a write, as in `args.count++`, is no read and stays as written.
    if (
      name &&
      ((above?.type === 'AssignmentExpression' && above.left === member) ||
        above?.type === 'UpdateExpression' ||
        (above?.type === 'UnaryExpression' && above.operator === 'delete'))
    ) {
      return;
    }
    if (!name || !member) {
      holes.push(undefined);
      return;
    }
    const kind = isOperand(member, around, writtenAs(name)) ? 'operand' : 'value';
    const { start, end } = member as E.MemberExpression & Spanned;
    const at = { start: offset + start, end: offset + end };
    const binding = constFor(name);
    const words = QUOTE_WORDS[quote ?? ''];
    holes.push(
      binding !== undefined
        ? { ...at, text: binding }
        : (member === whole && wholeEdit(name)) ||
            (words ? { ...at, text: hole(kind, holeWord(name), ...words) } : undefined)
    );
  });
  return holes.every((edit) => edit !== undefined) ? holes : undefined;
}

// The arg names that set the same prop as an attribute: `max-count` and `maxCount`.
const spellings = (name: string) => [
  ...new Set([
    name,
    name.replace(/-(\w)/g, (_, letter: string) => letter.toUpperCase()),
    name.replace(/\B([A-Z])/g, '-$1').toLowerCase(),
  ]),
];

function attributeName(prop: ElementNode['props'][number]): string | undefined {
  if (prop.type === NodeTypes.ATTRIBUTE) {
    return prop.name;
  }
  const arg = prop.arg as SimpleExpressionNode | undefined;
  if (prop.name === 'model') {
    return arg?.content ?? 'modelValue';
  }
  // `@click` sets the `onClick` arg.
  if (prop.name === 'on' && arg) {
    return `on${arg.content.charAt(0).toUpperCase()}${arg.content.slice(1)}`;
  }
  return prop.name === 'bind' && arg ? arg.content : undefined;
}

/** Reserve setup names and route forwarded imports before any hoist can collide with them. */
export function seedForwardedSetup(setup: ForwardableSetup, ctx: RenderContext): boolean {
  for (const name of setup.bindings) {
    ctx.bindings.add(name);
  }
  for (const statement of setup.statements) {
    reserveDeclaredNames(statement.source, ctx);
  }
  for (const { localName, binding } of setup.imports) {
    if (binding.importName === localName) {
      (ctx.imports[binding.importId] ??= new Set()).add(localName);
    } else {
      const statement = importStatementForBinding(localName, binding);
      if (!statement) {
        return false;
      }
      ctx.componentImports.add(statement);
    }
  }
  return true;
}

/**
 * A forwarded setup statement as `<script setup>` code, each args read as `print` writes it.
 * `startsLine` is set for a read that starts the statement right after one without a `;`, where a
 * literal starting with `(` or `[` would continue that statement.
 */
export function setupStatementCode(
  statement: ForwardableStatement,
  previous: ForwardableStatement | undefined,
  print: (read: ArgsRead, following: string, startsLine: boolean) => string
): string {
  const afterOpenStatement = previous !== undefined && !/;\s*$/.test(previous.source);
  let text = statement.source;
  for (const read of [...statement.argsReads].sort((a, b) => b.start - a.start)) {
    const printed = print(read, text.slice(read.end), afterOpenStatement && read.start === 0);
    text = text.slice(0, read.start) + printed + text.slice(read.end);
  }
  return dedentBy(text.replace(/\r\n?/g, '\n'), statement.column);
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

/**
 * Reserves the names `v-for` and slot scopes declare, and those an expression declares, such as the
 * parameter of `(item) => …`; `false` for a `v-for` or slot scope that cannot be read.
 */
export function collectTemplateScopeBindings(
  nodes: TemplateChildNode[],
  ctx: RenderContext
): boolean {
  for (const node of nodes) {
    if (node.type === NodeTypes.INTERPOLATION) {
      reserveDeclaredNames((node.content as SimpleExpressionNode).content, ctx);
    }
    if (node.type !== NodeTypes.ELEMENT) {
      continue;
    }

    for (const prop of node.props) {
      if (prop.type !== NodeTypes.DIRECTIVE) {
        continue;
      }
      if (prop.exp?.type === NodeTypes.SIMPLE_EXPRESSION) {
        reserveDeclaredNames(prop.exp.content, ctx);
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

// A hoisted const named as a name the code declares would be read as that name inside its scope,
// as `item` in `args.items.filter((item) => item.id !== args.item.id)`. Code that does not parse
// declares nothing the snippet could keep.
function reserveDeclaredNames(code: string, ctx: RenderContext) {
  let program: E.Program;
  try {
    ({ program } = parseModule(code));
  } catch {
    return;
  }
  walk(program, (node) => {
    const patterns =
      node.type === 'FunctionDeclaration' ||
      node.type === 'FunctionExpression' ||
      node.type === 'ArrowFunctionExpression'
        ? node.params
        : node.type === 'VariableDeclarator'
          ? [node.id]
          : node.type === 'CatchClause' && node.param
            ? [node.param]
            : [];
    for (const pattern of patterns) {
      addBindingNames(pattern, ctx.bindings);
    }
  });
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
  const ast = parseTemplateExpression(`${arrowParamsForPattern(pattern)} => 0`);
  if (ast?.type !== 'ArrowFunctionExpression') {
    return false;
  }

  for (const param of ast.params) {
    addBindingNames(param, ctx.bindings);
  }

  return true;
}

// ({ a, b: [c] }, ...rest) -> a, c, rest
function addBindingNames(pattern: Node, into: Set<string>): void {
  switch (pattern.type) {
    case 'Identifier':
      into.add(pattern.name);
      break;
    case 'AssignmentPattern':
      addBindingNames(pattern.left, into);
      break;
    case 'RestElement':
      addBindingNames(pattern.argument, into);
      break;
    case 'ObjectPattern':
      for (const property of pattern.properties) {
        addBindingNames(property.type === 'RestElement' ? property.argument : property.value, into);
      }
      break;
    case 'ArrayPattern':
      for (const element of pattern.elements) {
        if (element) {
          addBindingNames(element, into);
        }
      }
      break;
  }
}

// Offsets index into `code`; `undefined` unless `code` is exactly one expression.
function parseTemplateExpression(code: string): E.Expression | undefined {
  let program: E.Program;
  try {
    ({ program } = parseModule(`(${code}\n)`));
  } catch {
    return undefined;
  }
  const [statement, ...rest] = program.body;
  // An expression that closed the wrapping paren, as in `a) + (b`, starts at the paren itself.
  // Whitespace and outer parentheses (which the parser drops) make a valid expression start later.
  if (
    rest.length > 0 ||
    statement?.type !== 'ExpressionStatement' ||
    (statement.expression as E.Expression & Spanned).start === 0
  ) {
    return undefined;
  }
  walk(statement.expression, (node) => {
    const span = node as Node & Spanned;
    span.start -= 1;
    span.end -= 1;
  });
  return statement.expression;
}

// Whether an identifier reads a value, rather than naming a member, a key or a binding.
function isReferenced(node: Node, parent: Node | null): boolean {
  switch (parent?.type) {
    case 'MemberExpression':
      return parent.object === node || parent.computed;
    case 'Property':
      return parent.value === node || (parent.key === node && parent.computed);
    case 'MethodDefinition':
    case 'PropertyDefinition':
      return parent.key !== node || parent.computed;
    case 'VariableDeclarator':
      return parent.init === node;
    case 'FunctionDeclaration':
    case 'FunctionExpression':
    case 'ArrowFunctionExpression':
      return parent.id !== node && !(parent.params as Node[]).includes(node);
    case 'CatchClause':
      return parent.param !== node;
    case 'LabeledStatement':
    case 'BreakStatement':
    case 'ContinueStatement':
      return false;
    case 'MetaProperty':
      return false;
    default:
      return true;
  }
}

function arrowParamsForPattern(pattern: string): string {
  const trimmed = pattern.trim();
  return trimmed.startsWith('(') && trimmed.endsWith(')') ? trimmed : `(${trimmed})`;
}

/**
 * Import statement for a template tag, matched the way Vue resolves components: the literal tag
 * first, then its PascalCase form (`<my-button>` -> `MyButton`).
 */
export function componentImportForTag(
  tag: string,
  componentImports: Map<string, string>
): string | undefined {
  return componentImports.get(tag) ?? componentImports.get(pascalCase(tag));
}

function pascalCase(tag: string): string {
  const camel = tag.replace(/-(\w)/g, (_match, char: string) => char.toUpperCase());
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

// '<MyButton />' or `<MyButton />` without substitutions
function staticTemplateSource(node: Node | undefined): string | undefined {
  if (isStringLiteral(node)) {
    return node.value;
  }
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis[0]?.value.cooked ?? undefined;
  }
  return undefined;
}

// { components: { Button }, setup: () => ({ args }), template: '<Button />' }
function hasOnlySupportedRenderProperties(renderObject: E.ObjectExpression): boolean {
  return renderObject.properties.every((property) => {
    // { ...baseRender, template: '<Button />' }
    if (property.type === 'SpreadElement') {
      return false;
    }

    const key = staticKey(property);
    // `inheritAttrs` only tunes runtime attribute fallthrough; the markup stays faithful without it.
    return (
      key === 'components' || key === SETUP_PROPERTY || key === 'template' || key === 'inheritAttrs'
    );
  });
}

// { Button, 'my-button': Button }
function readComponentImports(
  value: Node | undefined,
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
  if (value.type !== 'ObjectExpression') {
    return undefined;
  }

  for (const property of value.properties) {
    if (property.type !== 'Property' || property.method || property.kind !== 'init') {
      return undefined;
    }

    const tagName = staticKey(property);
    const component = unwrapExpression(property.value);
    if (!tagName || component.type !== 'Identifier') {
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
function setupProperty(renderObject: E.ObjectExpression): E.ObjectProperty | undefined {
  return renderObject.properties.find(
    (property): property is E.ObjectProperty =>
      property.type === 'Property' && staticKey(property) === SETUP_PROPERTY
  );
}
