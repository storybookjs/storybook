import {
  type ESTree as E,
  type ESTreeNode as Node,
  type ImportBinding,
  parseModule,
  staticKey,
  unwrapExpression,
  walk,
} from 'storybook/internal/csf-tools';

import {
  collectPatternNames,
  isFunctionExpression,
  RESOLVABLE_GLOBALS,
} from '../../shared/classify-value.ts';

export interface ForwardableSetup {
  /** Setup-declared names plus return aliases, reserved so hoisted consts cannot collide. */
  bindings: string[];
  /** Story-file imports the statements reference, forwarded into the snippet. */
  imports: ForwardedImport[];
  /** Statements to print into `<script setup>` after the hoisted consts, in body order. */
  statements: ForwardableStatement[];
}

export interface ForwardedImport {
  /** Local name the statements reference. */
  localName: string;
  binding: ImportBinding;
}

export interface ForwardableStatement {
  /** Statement source exactly as written in the story file. */
  source: string;
  /** Column of the statement's first line, stripped from continuation lines on print. */
  column: number;
  /** Args member reads to substitute, with offsets relative to the source slice. */
  argsReads: ArgsRead[];
  /** Names the statement declares at any depth. */
  declares: string[];
}

export interface ArgsRead {
  start: number;
  end: number;
  name: string;
}

export type ForwardableSetupResolution =
  | { kind: 'forward'; setup: ForwardableSetup }
  /** The setup returns a render closure, which the h-tree path renders instead. */
  | { kind: 'render-closure' }
  | { kind: 'bail'; warning: string };

export interface ReadForwardableSetupOptions {
  /** Render-function parameter the setup body closes over as the story args. */
  argsParam?: string;
  /** Import bindings from the CSF module. */
  importBindings: Map<string, ImportBinding>;
  /** Story file source the statement slices come from. */
  source: string;
}

export const SETUP_PARAMETERS_WARNING =
  'No static snippet: the `setup` function receives parameters the snippet cannot reproduce.';
export const SETUP_UNSUPPORTED_WARNING =
  'No static snippet: the `setup` function could not be read statically.';
export const SETUP_RETURN_WARNING =
  'No static snippet: the `setup` return value could not be read statically.';

export function setupReferencesWarning(names: string[]): string {
  const list = names.map((name) => `\`${name}\``).join(', ');
  return `No static snippet: \`setup\` references ${list}, which the snippet cannot declare.`;
}

const ARGS_NAME = 'args';

type SetupBody = { statements: E.Statement[]; returned?: Node };

type Spanned = { start: number; end: number };

type ArgsReadsResult = { ok: true; reads: ArgsRead[] } | { ok: false; reference: string };

/**
 * Reads a render object's `setup` into statements the snippet forwards into `<script setup>`.
 *
 * The trivial `setup: () => ({ args })` is the degenerate zero-statement case: the return object
 * is dropped entirely because script setup auto-exposes every top-level binding.
 *
 * @example
 * `setup() { const count = ref(0); return { args, count }; }` → forwards `const count = ref(0);`
 */
export function readForwardableSetup(
  setup: E.ObjectProperty,
  options: ReadForwardableSetupOptions
): ForwardableSetupResolution {
  const bail = (warning: string): ForwardableSetupResolution => ({ kind: 'bail', warning });

  const setupFn = unwrapExpression(setup.value);
  if (!isFunctionExpression(setupFn)) {
    return bail(SETUP_UNSUPPORTED_WARNING);
  }
  if (setupFn.params.length > 0) {
    return bail(SETUP_PARAMETERS_WARNING);
  }
  if (setupFn.async || setupFn.generator) {
    return bail(SETUP_UNSUPPORTED_WARNING);
  }

  const body = readSetupBody(setupFn.body);
  if (!body) {
    return bail(SETUP_UNSUPPORTED_WARNING);
  }

  const returned = body.returned === undefined ? undefined : unwrapExpression(body.returned);
  if (returned && isFunctionExpression(returned)) {
    return { kind: 'render-closure' };
  }
  if (returned && returned.type !== 'ObjectExpression') {
    return bail(SETUP_RETURN_WARNING);
  }

  const locals = new Set<string>();
  for (const statement of body.statements) {
    if (statement.type === 'VariableDeclaration') {
      const named = statement.declarations.every((declaration) =>
        collectPatternNames(declaration.id, locals)
      );
      if (!named) {
        return bail(SETUP_UNSUPPORTED_WARNING);
      }
    } else if (statement.type !== 'ExpressionStatement') {
      return bail(SETUP_UNSUPPORTED_WARNING);
    }
  }

  const scope = new Set(locals);
  if (options.argsParam) {
    scope.add(options.argsParam);
  }
  const free = new Set<string>();
  for (const statement of body.statements) {
    if (!collectFreeIdentifiers(statement, scope, free)) {
      return bail(SETUP_UNSUPPORTED_WARNING);
    }
  }

  const bindings = new Set(locals);
  const aliasStatements: ForwardableStatement[] = [];
  for (const property of returned?.properties ?? []) {
    if (
      property.type !== 'Property' ||
      property.method ||
      property.kind !== 'init' ||
      property.computed
    ) {
      return bail(SETUP_RETURN_WARNING);
    }
    const key = staticKey(property);
    const value = unwrapExpression(property.value);
    if (!key || value.type !== 'Identifier') {
      return bail(SETUP_RETURN_WARNING);
    }

    if (options.argsParam && value.name === options.argsParam) {
      // Exposing the render args under any other name would leave template reads unsubstitutable.
      if (key !== ARGS_NAME) {
        return bail(SETUP_RETURN_WARNING);
      }
      continue;
    }

    if (!locals.has(value.name)) {
      free.add(value.name);
    }
    // Script setup auto-exposes the binding itself; only a renamed export needs an alias.
    if (key === value.name) {
      continue;
    }
    if (bindings.has(key) || !isBindingName(key)) {
      return bail(SETUP_RETURN_WARNING);
    }
    bindings.add(key);
    aliasStatements.push({
      source: `const ${key} = ${value.name};`,
      column: 0,
      argsReads: [],
      declares: [key],
    });
  }

  const imports: ForwardedImport[] = [];
  const unresolvable: string[] = [];
  for (const name of [...free].sort()) {
    if (RESOLVABLE_GLOBALS.has(name)) {
      continue;
    }
    const binding = options.importBindings.get(name);
    if (binding && binding.importName !== '*') {
      imports.push({ localName: name, binding });
      bindings.add(name);
    } else {
      unresolvable.push(name);
    }
  }
  if (unresolvable.length > 0) {
    return bail(setupReferencesWarning(unresolvable));
  }

  const statements: ForwardableStatement[] = [];
  for (const statement of body.statements) {
    const { start, end } = statement as E.Statement & Spanned;
    const reads = collectArgsReads(statement, options.argsParam);
    if (!reads.ok) {
      return bail(setupReferencesWarning([reads.reference]));
    }
    statements.push({
      source: options.source.slice(start, end),
      column: start - lineStartOf(options.source, start),
      argsReads: reads.reads.map((read) => ({
        start: read.start - start,
        end: read.end - start,
        name: read.name,
      })),
      declares: [...declaredNamesIn(statement)],
    });
  }

  return {
    kind: 'forward',
    setup: {
      bindings: [...bindings].sort(),
      imports,
      statements: [...statements, ...aliasStatements],
    },
  };
}

function lineStartOf(source: string, offset: number): number {
  let index = offset;
  while (index > 0 && !/[\n\r\u2028\u2029]/.test(source[index - 1])) {
    index -= 1;
  }
  return index;
}

// setup() { ...statements; return {...}; } or setup: () => ({ ... })
function readSetupBody(body: E.FunctionBody | E.Expression | null): SetupBody | undefined {
  if (!body) {
    return undefined;
  }
  if (body.type !== 'BlockStatement') {
    return { statements: [], returned: body };
  }

  const returnIndex = body.body.findIndex((statement) => statement.type === 'ReturnStatement');
  if (returnIndex === -1) {
    return { statements: body.body };
  }
  // A return anywhere but last would make the forwarded statements diverge from what actually ran.
  if (returnIndex !== body.body.length - 1) {
    return undefined;
  }

  const returnStatement = body.body[returnIndex] as E.ReturnStatement;
  return {
    statements: body.body.slice(0, returnIndex),
    returned: returnStatement.argument ?? undefined,
  };
}

/**
 * Non-computed `args.x` reads inside one statement, or the reference that blocks substitution.
 *
 * @example `const a = args.label;` → one read; `const a = args;` → blocked on `args`
 */
function collectArgsReads(statement: E.Statement, argsParam: string | undefined): ArgsReadsResult {
  if (!argsParam) {
    return { ok: true, reads: [] };
  }

  const reads: ArgsRead[] = [];
  let blocked: string | undefined;

  walk(statement, (node, parent) => {
    if (blocked) {
      return false;
    }

    // A mutation whose target roots at the args parameter has no substitutable value form.
    const mutationTarget =
      node.type === 'AssignmentExpression'
        ? node.left
        : node.type === 'UpdateExpression' ||
            (node.type === 'UnaryExpression' && node.operator === 'delete')
          ? node.argument
          : undefined;
    if (mutationTarget && rootIdentifierName(mutationTarget) === argsParam) {
      blocked = argsParam;
      return false;
    }

    if (node.type !== 'Identifier' || node.name !== argsParam || isNamePosition(node, parent)) {
      return;
    }
    const member =
      parent?.type === 'MemberExpression' && parent.object === node && !parent.computed
        ? parent
        : undefined;
    if (!member || member.property.type !== 'Identifier') {
      blocked = argsParam;
      return false;
    }
    const { start, end } = member as E.MemberExpression & Spanned;
    reads.push({ start, end, name: member.property.name });
  });

  return blocked ? { ok: false, reference: blocked } : { ok: true, reads };
}

// args.theme.color -> 'args'
function rootIdentifierName(node: Node): string | undefined {
  let current: Node = node;
  while (current.type === 'MemberExpression' || current.type === 'ChainExpression') {
    current = current.type === 'MemberExpression' ? current.object : current.expression;
  }
  return current.type === 'Identifier' ? current.name : undefined;
}

// `{ class: cls }` and `{ 'my-label': label }` have no `const` form.
function isBindingName(name: string): boolean {
  try {
    parseModule(`let ${name};`);
    return true;
  } catch {
    return false;
  }
}

// args.label -> 'label' and { label: 1 } -> 'label' are name positions, not references
export function isNamePosition(node: Node, parent: Node | null): boolean {
  if (parent?.type === 'MemberExpression') {
    return parent.property === node && !parent.computed;
  }
  return (
    parent?.type === 'Property' && parent.key === node && !parent.computed && !parent.shorthand
  );
}

/**
 * Collects every free identifier a statement references, or reports `false` for syntax the
 * forwarding grammar does not model. Unknown shapes bail rather than pass through unchecked.
 */
function collectFreeIdentifiers(
  node: E.Statement,
  scope: ReadonlySet<string>,
  free: Set<string>
): boolean {
  if (node.type === 'VariableDeclaration') {
    // Declared names are already in scope; pattern defaults were validated during collection.
    return node.declarations.every(
      (declaration) => !declaration.init || collectFreeExpression(declaration.init, scope, free)
    );
  }
  if (node.type === 'ExpressionStatement') {
    return collectFreeExpression(node.expression, scope, free);
  }
  if (node.type === 'ReturnStatement') {
    return !node.argument || collectFreeExpression(node.argument, scope, free);
  }
  return false;
}

function collectFreeExpression(node: Node, scope: ReadonlySet<string>, free: Set<string>): boolean {
  if (node.type === 'SpreadElement') {
    return collectFreeExpression(node.argument, scope, free);
  }

  const value = unwrapExpression(node);
  const collect = (child: Node): boolean => collectFreeExpression(child, scope, free);

  switch (value.type) {
    case 'Literal':
      return true;

    case 'Identifier':
      if (!scope.has(value.name)) {
        free.add(value.name);
      }
      return true;

    case 'TemplateLiteral':
    case 'SequenceExpression':
      return value.expressions.every(collect);

    case 'ArrayExpression':
      return value.elements.every((element) => element === null || collect(element));

    case 'ObjectExpression':
      return value.properties.every((property) => {
        if (property.type === 'SpreadElement') {
          return collect(property.argument);
        }
        if (!property.method && property.kind === 'init') {
          return (!property.computed || collect(property.key)) && collect(property.value);
        }
        return collectFreeFunction(property.value as E.Function, scope, free);
      });

    case 'ChainExpression':
      return collect(value.expression);

    case 'MemberExpression':
      return collect(value.object) && (!value.computed || collect(value.property));

    case 'CallExpression':
    case 'NewExpression':
      return collect(value.callee) && value.arguments.every(collect);

    case 'ArrowFunctionExpression':
    case 'FunctionExpression':
      return collectFreeFunction(value, scope, free);

    case 'UnaryExpression':
    case 'UpdateExpression':
      return collect(value.argument);

    case 'BinaryExpression':
    case 'LogicalExpression':
    case 'AssignmentExpression':
      return collect(value.left) && collect(value.right);

    case 'ConditionalExpression':
      return collect(value.test) && collect(value.consequent) && collect(value.alternate);

    default:
      return false;
  }
}

function collectFreeFunction(
  fn: E.ArrowFunctionExpression | E.Function,
  scope: ReadonlySet<string>,
  free: Set<string>
): boolean {
  const childScope = new Set(scope);
  if (!fn.params.every((param) => collectPatternNames(param, childScope))) {
    return false;
  }
  if (fn.type === 'FunctionExpression' && fn.id) {
    childScope.add(fn.id.name);
  }

  const body = fn.body;
  if (!body) {
    return false;
  }
  if (body.type !== 'BlockStatement') {
    return collectFreeExpression(body, childScope, free);
  }

  // Inner declarations scope over the whole body, approximating function-scope hoisting.
  for (const statement of body.body) {
    if (statement.type === 'VariableDeclaration') {
      const named = statement.declarations.every((declaration) =>
        collectPatternNames(declaration.id, childScope)
      );
      if (!named) {
        return false;
      }
    }
  }
  return body.body.every((statement) => collectFreeIdentifiers(statement, childScope, free));
}

export function declaredNamesIn(code: Node): Set<string> {
  const names = new Set<string>();
  walk(code, (node) => {
    if (
      node.type === 'ArrowFunctionExpression' ||
      node.type === 'FunctionExpression' ||
      node.type === 'FunctionDeclaration'
    ) {
      node.params.forEach((param) => addBindingNames(param, names));
      if (node.id) {
        names.add(node.id.name);
      }
    } else if (node.type === 'VariableDeclarator') {
      addBindingNames(node.id, names);
    } else if (node.type === 'CatchClause' && node.param) {
      addBindingNames(node.param, names);
    } else if (node.type === 'ClassExpression' || node.type === 'ClassDeclaration') {
      if (node.id) {
        names.add(node.id.name);
      }
    }
  });
  return names;
}

// ({ a, b: [c] }, ...rest) -> a, c, rest
export function addBindingNames(pattern: Node, into: Set<string>): void {
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
