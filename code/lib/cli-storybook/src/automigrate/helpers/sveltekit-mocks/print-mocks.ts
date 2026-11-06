import {
  type ESTree as E,
  type ESTreeNode as Node,
  type SourceEditor,
  detachedTextOf,
  isIdentifier,
  isStringLiteral,
  lineIndent,
  outerSpan,
  placeableTextOf,
  printString,
  reindent,
  staticKey,
  walk,
} from 'storybook/internal/csf-tools';

import {
  type FunctionLiteral,
  type LevelMocks,
  type LinkEntry,
  type MockExport,
  type Op,
  isFunctionLiteral,
  someInBody,
} from './mock-statements.ts';

export interface Style {
  quote: string;
  semicolons: boolean;
  indent: string;
}

type Names = (name: MockExport) => string;

// Statements on lines of their own at `indent`
export const printStatements = (statements: string[], indent: string) =>
  statements.map((statement) => `${indent}${reindent(statement, '', indent)}`).join('\n');

// Identifiers that a node reads, leaving out property names and the parameters of `except`
const readNames = (node: Node, except?: FunctionLiteral) => {
  const names = new Set<string>();
  const own = new Set(
    except?.params.filter((param) => param.type === 'Identifier').map((param) => param.name)
  );
  walk(node, (child, parent) => {
    if (child.type !== 'Identifier') {
      return;
    }
    const isKey =
      (parent?.type === 'MemberExpression' && parent.property === child && !parent.computed) ||
      (parent?.type === 'Property' &&
        parent.key === child &&
        !parent.computed &&
        !parent.shorthand);
    if (!isKey && !own.has(child.name)) {
      names.add(child.name);
    }
  });
  return names;
};

// A parameter written to in the body, which inlining would turn into a write to the mock's own
const writesParameter = (fn: FunctionLiteral) => {
  const names = new Set(parameterNames(fn));
  let writes = false;
  walk(fn.body as Node, (node) => {
    const target =
      node.type === 'AssignmentExpression'
        ? node.left
        : node.type === 'UpdateExpression'
          ? node.argument
          : undefined;
    writes ||= target?.type === 'Identifier' && names.has(target.name);
  });
  return writes;
};

const usesOwnContext = (fn: FunctionLiteral) =>
  someInBody(
    fn,
    (node) =>
      node.type === 'ThisExpression' ||
      isIdentifier(node, 'arguments') ||
      node.type === 'ReturnStatement' ||
      node.type === 'AwaitExpression' ||
      node.type === 'YieldExpression'
  );

const parameterNames = (fn: FunctionLiteral) =>
  fn.params.every((param) => param.type === 'Identifier' && !param.optional)
    ? fn.params.map((param) => (param as E.BindingIdentifier).name)
    : undefined;

// Print what one level migrates to, as statements without indent on their first line.
export const printMocks = (
  editor: SourceEditor,
  mocks: LevelMocks,
  names: Names,
  style: Style
): string[] => {
  const end = style.semicolons ? ';' : '';
  const step = style.indent;
  const code = editor.code;
  const statements: string[] = [];
  const block = (body: string[]) => `{\n${printStatements(body, step)}\n}`;
  const source = (node: Node) =>
    reindent(code.slice(node.start, node.end), lineIndent(code, node.start), '');
  // A method's function starts at its parameters, as in `goto() {}`
  const methodText = (fn: FunctionLiteral) => `${fn.async ? 'async ' : ''}function ${source(fn)}`;
  const call = (callback: Node, method: boolean, args: string, loose = false) => {
    const simple =
      callback.type === 'Identifier' ||
      callback.type === 'MemberExpression' ||
      callback.type === 'CallExpression';
    const text = method ? methodText(callback as FunctionLiteral) : detachedTextOf(callback);
    const target = simple && !method ? text : `(${text})`;
    if (!loose) {
      return `${target}(${args})`;
    }
    // A TypeScript callback that declares narrower parameters than the mock passes
    return callback.type === 'Identifier'
      ? `${target}(...(${args.slice(3)} as Parameters<typeof ${target}>))`
      : `(${target} as (...args: any[]) => unknown)(${args})`;
  };

  for (const op of mocks.ops) {
    const comments = op.comments;
    switch (op.kind) {
      case 'assign': {
        const target = `${names(op.object)}${/^[A-Za-z_$][\w$]*$/.test(op.key) ? `.${op.key}` : `[${printString(op.key, style.quote)}]`}`;
        let value = op.member.method
          ? methodText(op.member.value as FunctionLiteral)
          : op.member.shorthand
            ? op.key
            : detachedTextOf(op.member.value);
        if (op.merge) {
          value = value.replace(/^\{(\s*)/, (_, space: string) =>
            space.includes('\n') ? `{${space}...${target},${space}` : `{ ...${target}, `
          );
          value = value.replace(/^\{ \.\.\.(.+), \}$/, '{ ...$1 }');
        }
        statements.push(`${comments}${target} = ${value}${end}`);
        break;
      }
      case 'assign-all':
        statements.push(`${comments}Object.assign(${names(op.object)}, ${op.value})${end}`);
        break;
      case 'import':
        names(op.fn);
        break;
      case 'no-op':
        statements.push(
          op.fn === 'formAction'
            ? `${comments}${names('formAction')}.mockImplementation(async () => ({ type: ${printString('success', style.quote)}, status: 200 }))${end}`
            : `${comments}${names('mocked')}(${names(op.fn)}).mockImplementation(async () => {})${end}`
        );
        break;
      case 'implement': {
        const fn = `${names('mocked')}(${names(op.fn)})`;
        statements.push(
          `${comments}${fn}.mockImplementation(${implementation(op, names(op.fn))})${end}`
        );
        break;
      }
      case 'after-navigate':
        statements.push(
          `${comments}${names('setAfterNavigate')}(${detachedTextOf(op.value)})${end}`
        );
        break;
      case 'links':
        statements.push(`${comments}${links(op.entries)}${end}`);
        break;
      case 'form-action': {
        const result = `return { type: ${printString('success', style.quote)}, status: 200 }${end}`;
        const body = inlineBody(op.callback) ?? [`${call(op.callback, op.method, '')}${end}`];
        // The callback's code moves into this function, so its parameter must not capture a name it reads
        const read = readNames(op.callback);
        const submission = read.has('submission') ? uniqueName('submission', read) : 'submission';
        statements.push(
          `${comments}${names('formAction')}.mockImplementation(async (${submission}) => ${block([...body, result])})${end}`
        );
        break;
      }
      default:
        op satisfies never;
    }
  }
  return statements;

  // The callback, made async as `goto()` is, or a function that calls it
  function implementation(
    { callback, method, loose, arity }: Extract<Op, { kind: 'implement' }>,
    fn: string
  ) {
    if (
      isFunctionLiteral(callback) &&
      !callback.generator &&
      !callback.returnType &&
      !someInBody(callback, (node) => node.type === 'ReturnStatement' && !!node.argument)
    ) {
      // An expression body becomes a block, so its value isn't returned where `Promise<void>` is due
      const head = (text: string) => (callback.async ? text : `async ${text}`);
      const adapted = method
        ? `async ${methodText(callback).replace(/^async /, '')}`
        : callback.type === 'ArrowFunctionExpression' && callback.body.type !== 'BlockStatement'
          ? head(
              `${source({ start: callback.start, end: outerSpan(callback.body).start } as Node)}${block([`${asStatement(detachedTextOf(callback.body))}${end}`])}`
            )
          : head(detachedTextOf(callback));
      // Its parameters can be narrower than the mock's, as the old parameters accepted that
      return loose ? `(${adapted}) as typeof ${fn}` : adapted;
    }
    // The wrapper's parameter must not capture a name that the callback reads
    const read = readNames(callback);
    const args = read.has('args') ? uniqueName('args', read) : 'args';
    // A function that declares its parameters gets only those, as TypeScript requires
    const passed =
      arity === undefined || loose
        ? `...${args}`
        : Array.from({ length: arity }, (_, index) => `${args}[${index}]`).join(', ');
    return `async (...${args}) => ${block([`${call(callback, method, passed, loose)}${end}`])}`;
  }

  // The statements of a function that can run in place of a call, as its parameters are not read
  function inlineBody(callback: Node): string[] | undefined {
    if (
      callback.type !== 'ArrowFunctionExpression' ||
      callback.async ||
      callback.params.length > 0 ||
      usesOwnContext(callback)
    ) {
      return undefined;
    }
    if (callback.body.type !== 'BlockStatement') {
      return [`${asStatement(detachedTextOf(callback.body))}${end}`];
    }
    return callback.body.body.map((statement) => detachedTextOf(statement));
  }

  // An arrow's body with its parameters renamed, as it runs in place of a call
  function renamedBody(fn: E.ArrowFunctionExpression, names: string[]) {
    const body = fn.body as Node;
    const renames = new Map<number, { end: number; text: string }>();
    walk(body, (node, parent) => {
      const binding = node.type === 'Identifier' ? editor.scopes.bindingOf(node) : undefined;
      const index = binding ? fn.params.indexOf(binding.identifier as E.BindingIdentifier) : -1;
      if (index === -1 || binding!.identifier === node) {
        return;
      }
      const name = (node as E.IdentifierReference).name;
      const shorthand = parent?.type === 'Property' && parent.shorthand;
      renames.set(node.start, {
        end: node.end,
        text: shorthand ? `${name}: ${names[index]}` : names[index],
      });
    });
    let text = code.slice(body.start, body.end);
    for (const [start, { end: stop, text: name }] of [...renames].sort(([a], [b]) => b - a)) {
      text = text.slice(0, start - body.start) + name + text.slice(stop - body.start);
    }
    return reindent(text, lineIndent(code, body.start), '');
  }

  function links(entries: LinkEntry[]) {
    // Arrow callbacks run in their `if`, their parameters renamed to the mock's
    const inlined = entries.map(({ callback }) =>
      callback.type === 'ArrowFunctionExpression' &&
      !callback.async &&
      callback.params.length <= 2 &&
      callback.body.type !== 'SequenceExpression' &&
      // Inlined, an object literal would read as a block
      callback.body.type !== 'ObjectExpression' &&
      parameterNames(callback) &&
      !usesOwnContext(callback) &&
      !writesParameter(callback)
        ? callback
        : undefined
    );
    const read = new Set<string>();
    entries.forEach((entry, index) => {
      const callback = inlined[index];
      if (entry.member.computed) {
        readNames(entry.member.key).forEach((name) => read.add(name));
      }
      readNames(callback ? (callback.body as Node) : entry.callback, callback).forEach((name) =>
        read.add(name)
      );
    });
    const [href, event] = ['href', 'event'].map((name) =>
      read.has(name) ? uniqueName(name, read) : name
    );

    const body = entries.map((entry, index) => {
      const { member } = entry;
      const key = member.computed
        ? placeableTextOf(member.key)
        : isStringLiteral(member.key)
          ? editor.source(member.key)
          : printString(staticKey(member)!, style.quote);
      const condition = entry.regex ? `new RegExp(${key}).test(${href})` : `${href} === ${key}`;
      const callback = inlined[index];
      if (!callback) {
        // A callback that declares fewer parameters gets only those, as TypeScript requires
        const args = [href, event].slice(0, entry.arity ?? 2).join(', ');
        return `${entry.comments}if (${condition}) ${call(entry.callback, entry.method, args)}${end}`;
      }
      const inline = renamedBody(callback, [href, event]);
      return callback.body.type === 'BlockStatement'
        ? `${entry.comments}if (${condition}) ${inline}`
        : `${entry.comments}if (${condition}) ${asStatement(inline)}${end}`;
    });
    return `${names('link')}.mockImplementation((${href}, ${event}) => ${block(body)})`;
  }
};

// An expression as a statement: one that starts like a block, a function or a class needs parentheses
const asStatement = (text: string) =>
  /^(\{|(async\s+)?function\b|class\b|let\s*\[)/.test(text) ? `(${text})` : text;

const uniqueName = (name: string, taken: Set<string>) => {
  let unique = `_${name}`;
  for (let index = 2; taken.has(unique); index++) {
    unique = `_${name}${index}`;
  }
  return unique;
};
