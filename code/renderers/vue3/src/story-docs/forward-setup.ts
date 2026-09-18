import { types as t } from 'storybook/internal/babel';
import { keyOf, unwrapExpression, type ImportBinding } from 'storybook/internal/csf-tools';

import { collectPatternNames, isFunctionExpression, RESOLVABLE_GLOBALS } from './classify-value.ts';

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

type SetupBody = { statements: t.Statement[]; returned?: t.Node };

type SourcePosition = NonNullable<t.Node['loc']>['start'];
type SourceRange = { start: SourcePosition; end: SourcePosition };
type ArgsReadLocation = SourceRange & { name: string };

type ArgsReadsResult = { ok: true; reads: ArgsReadLocation[] } | { ok: false; reference: string };

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
  setup: t.ObjectMethod | t.ObjectProperty,
  options: ReadForwardableSetupOptions
): ForwardableSetupResolution {
  const bail = (warning: string): ForwardableSetupResolution => ({ kind: 'bail', warning });

  const setupFn = t.isObjectMethod(setup) ? setup : unwrapExpression(setup.value);
  if (!t.isObjectMethod(setupFn) && !isFunctionExpression(setupFn)) {
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
  if (returned && !t.isObjectExpression(returned)) {
    return bail(SETUP_RETURN_WARNING);
  }

  const locals = new Set<string>();
  for (const statement of body.statements) {
    if (t.isVariableDeclaration(statement)) {
      const named = statement.declarations.every((declaration) =>
        collectPatternNames(declaration.id, locals)
      );
      if (!named) {
        return bail(SETUP_UNSUPPORTED_WARNING);
      }
    } else if (!t.isExpressionStatement(statement)) {
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
    if (!t.isObjectProperty(property) || property.computed) {
      return bail(SETUP_RETURN_WARNING);
    }
    const key = keyOf(property);
    const value = unwrapExpression(property.value);
    if (!key || !t.isIdentifier(value)) {
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
    if (bindings.has(key)) {
      return bail(SETUP_RETURN_WARNING);
    }
    bindings.add(key);
    aliasStatements.push({ source: `const ${key} = ${value.name};`, column: 0, argsReads: [] });
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

  const lineStarts = lineStartOffsets(options.source);
  const statements: ForwardableStatement[] = [];
  for (const statement of body.statements) {
    const { loc } = statement;
    if (loc == null) {
      return bail(SETUP_UNSUPPORTED_WARNING);
    }
    const start = offsetAt(lineStarts, loc.start);
    const end = offsetAt(lineStarts, loc.end);
    if (start == null || end == null || start > end || end > options.source.length) {
      return bail(SETUP_UNSUPPORTED_WARNING);
    }
    const reads = collectArgsReads(statement, options.argsParam);
    if (!reads.ok) {
      return bail(setupReferencesWarning([reads.reference]));
    }
    const argsReads: ArgsRead[] = [];
    for (const read of reads.reads) {
      const readStart = offsetAt(lineStarts, read.start);
      const readEnd = offsetAt(lineStarts, read.end);
      if (
        readStart == null ||
        readEnd == null ||
        readStart < start ||
        readEnd < readStart ||
        readEnd > end
      ) {
        return bail(SETUP_UNSUPPORTED_WARNING);
      }
      argsReads.push({
        start: readStart - start,
        end: readEnd - start,
        name: read.name,
      });
    }
    statements.push({
      source: options.source.slice(start, end),
      column: loc.start.column,
      argsReads,
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

function lineStartOffsets(source: string): number[] {
  const starts = [0];
  for (let index = 0; index < source.length; index += 1) {
    const code = source.charCodeAt(index);
    if (code === 13) {
      if (source.charCodeAt(index + 1) === 10) {
        index += 1;
      }
      starts.push(index + 1);
    } else if (code === 10 || code === 0x2028 || code === 0x2029) {
      starts.push(index + 1);
    }
  }
  return starts;
}

function offsetAt(lineStarts: number[], pos: { line: number; column: number }): number | undefined {
  const lineStart = lineStarts[pos.line - 1];
  return lineStart == null ? undefined : lineStart + pos.column;
}

// setup() { ...statements; return {...}; } or setup: () => ({ ... })
function readSetupBody(body: t.BlockStatement | t.Expression): SetupBody | undefined {
  if (!t.isBlockStatement(body)) {
    return { statements: [], returned: body };
  }

  const returnIndex = body.body.findIndex((statement) => t.isReturnStatement(statement));
  if (returnIndex === -1) {
    return { statements: body.body };
  }
  // A return anywhere but last would make the forwarded statements diverge from what actually ran.
  if (returnIndex !== body.body.length - 1) {
    return undefined;
  }

  const returnStatement = body.body[returnIndex] as t.ReturnStatement;
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
function collectArgsReads(statement: t.Statement, argsParam: string | undefined): ArgsReadsResult {
  if (!argsParam) {
    return { ok: true, reads: [] };
  }

  const reads: ArgsReadLocation[] = [];
  let blocked: string | undefined;

  const visit = (node: t.Node, parent?: t.Node): void => {
    if (blocked) {
      return;
    }

    // A mutation whose target roots at the args parameter has no substitutable value form.
    const mutationTarget = t.isAssignmentExpression(node)
      ? node.left
      : t.isUpdateExpression(node) || (t.isUnaryExpression(node) && node.operator === 'delete')
        ? node.argument
        : undefined;
    if (mutationTarget && rootIdentifierName(mutationTarget) === argsParam) {
      blocked = argsParam;
      return;
    }

    if (t.isIdentifier(node, { name: argsParam })) {
      const member =
        parent &&
        (t.isMemberExpression(parent) || t.isOptionalMemberExpression(parent)) &&
        parent.object === node &&
        !parent.computed
          ? parent
          : undefined;
      if (!member || !t.isIdentifier(member.property) || member.loc == null) {
        blocked = argsParam;
        return;
      }
      reads.push({ start: member.loc.start, end: member.loc.end, name: member.property.name });
      return;
    }

    for (const key of t.VISITOR_KEYS[node.type] ?? []) {
      if (skipsReferencePosition(node, key)) {
        continue;
      }
      const child = node[key as keyof typeof node];
      if (Array.isArray(child)) {
        child.forEach((entry) => {
          if (t.isNode(entry)) {
            visit(entry, node);
          }
        });
      } else if (t.isNode(child)) {
        visit(child, node);
      }
    }
  };
  visit(statement);

  return blocked ? { ok: false, reference: blocked } : { ok: true, reads };
}

// args.theme.color -> 'args'
function rootIdentifierName(node: t.Node): string | undefined {
  let current: t.Node = node;
  while (t.isMemberExpression(current) || t.isOptionalMemberExpression(current)) {
    current = current.object;
  }
  return t.isIdentifier(current) ? current.name : undefined;
}

// args.label -> 'label' and { label: 1 } -> 'label' are name positions, not references
function skipsReferencePosition(node: t.Node, key: string): boolean {
  if ((t.isMemberExpression(node) || t.isOptionalMemberExpression(node)) && key === 'property') {
    return !node.computed;
  }
  if (t.isObjectProperty(node) && key === 'key') {
    return !node.computed;
  }
  return false;
}

/**
 * Collects every free identifier a statement references, or reports `false` for syntax the
 * forwarding grammar does not model. Unknown shapes bail rather than pass through unchecked.
 */
function collectFreeIdentifiers(
  node: t.Statement,
  scope: ReadonlySet<string>,
  free: Set<string>
): boolean {
  if (t.isVariableDeclaration(node)) {
    // Declared names are already in scope; pattern defaults were validated during collection.
    return node.declarations.every(
      (declaration) => !declaration.init || collectFreeExpression(declaration.init, scope, free)
    );
  }
  if (t.isExpressionStatement(node)) {
    return collectFreeExpression(node.expression, scope, free);
  }
  if (t.isReturnStatement(node)) {
    return !node.argument || collectFreeExpression(node.argument, scope, free);
  }
  return false;
}

function collectFreeExpression(
  node: t.Node,
  scope: ReadonlySet<string>,
  free: Set<string>
): boolean {
  if (t.isSpreadElement(node)) {
    return collectFreeExpression(node.argument, scope, free);
  }

  const value = unwrapExpression(node as t.Expression);
  const collect = (child: t.Node): boolean => collectFreeExpression(child, scope, free);

  switch (value.type) {
    case 'StringLiteral':
    case 'NumericLiteral':
    case 'BooleanLiteral':
    case 'NullLiteral':
    case 'BigIntLiteral':
    case 'RegExpLiteral':
      return true;

    case 'Identifier':
      if (!scope.has(value.name)) {
        free.add(value.name);
      }
      return true;

    case 'TemplateLiteral':
      return value.expressions.every(
        (expression) => t.isExpression(expression) && collect(expression)
      );

    case 'ArrayExpression':
      return value.elements.every((element) => element === null || collect(element));

    case 'ObjectExpression':
      return value.properties.every((property) => {
        if (t.isSpreadElement(property)) {
          return collect(property.argument);
        }
        if (t.isObjectProperty(property)) {
          return (!property.computed || collect(property.key)) && collect(property.value);
        }
        return collectFreeFunction(property, scope, free);
      });

    case 'MemberExpression':
    case 'OptionalMemberExpression':
      return collect(value.object) && (!value.computed || collect(value.property));

    case 'CallExpression':
    case 'OptionalCallExpression':
    case 'NewExpression':
      return collect(value.callee) && value.arguments.every(collect);

    case 'ArrowFunctionExpression':
    case 'FunctionExpression':
      return collectFreeFunction(value, scope, free);

    case 'UnaryExpression':
    case 'UpdateExpression':
      return collect(value.argument);

    case 'BinaryExpression':
      return t.isExpression(value.left) && collect(value.left) && collect(value.right);

    case 'LogicalExpression':
      return collect(value.left) && collect(value.right);

    case 'ConditionalExpression':
      return collect(value.test) && collect(value.consequent) && collect(value.alternate);

    case 'AssignmentExpression':
      return t.isExpression(value.left) && collect(value.left) && collect(value.right);

    case 'SequenceExpression':
      return value.expressions.every(collect);

    default:
      return false;
  }
}

function collectFreeFunction(
  fn: t.ArrowFunctionExpression | t.FunctionExpression | t.ObjectMethod,
  scope: ReadonlySet<string>,
  free: Set<string>
): boolean {
  const childScope = new Set(scope);
  if (!fn.params.every((param) => collectPatternNames(param, childScope))) {
    return false;
  }
  if (t.isFunctionExpression(fn) && fn.id) {
    childScope.add(fn.id.name);
  }

  const body = fn.body;
  if (!t.isBlockStatement(body)) {
    return collectFreeExpression(body, childScope, free);
  }

  // Inner declarations scope over the whole body, approximating function-scope hoisting.
  for (const statement of body.body) {
    if (t.isVariableDeclaration(statement)) {
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
