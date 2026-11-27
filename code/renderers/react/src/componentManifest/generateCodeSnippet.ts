import {
  type CsfFile,
  type ESTree as E,
  type ESTreeNode as Node,
  type FunctionNode,
  type ImportRef,
  type RenderResolution,
  type StoryArgsResolver,
  textOf,
  collectImportBindings,
  createStoryArgsResolver,
  detachedTextOf,
  isCanonicalCsf2BindCall,
  isStringLiteral,
  lineIndent,
  metaObject,
  normalizeStoryDeclaration,
  parseModule,
  reindent,
  resolveRenderFunction,
  storyShapeError,
  walk,
} from 'storybook/internal/csf-tools';
import {
  type SnippetTemplate,
  createHoleMarks,
  stripHoles,
  withHoleSpace,
} from 'storybook/internal/docs-tools';

import {
  type JsxValue,
  type Mark,
  type ReactHolePlace,
  printAttribute,
  printAttributes,
  printChildren,
} from '../snippet-values.ts';
import { invariant } from './utils.ts';

function renderFunctionOf(resolution: RenderResolution) {
  if (resolution.kind === 'resolved') {
    return resolution.node;
  }
  return resolution.kind === 'unresolved' ? resolution.shadowedRender : undefined;
}

/** A story's snippet, and what showing it as a complete example still depends on. */
export interface CodeSnippet {
  /** Source of a `const` or `function` declaration named after the story. */
  snippet: string;
  // The snippet with each place an arg prints as a hole; see `StoryDoc`.
  template: SnippetTemplate<ReactHolePlace>;
  /** Imports the snippet needs beyond the component, from arg values that kept a name. */
  imports: ImportRef[];
  /** What a static pass could not read, in the source text it was written as. */
  unresolved: string[];
}

// The snippet is printed once, with each place an arg prints marked by a comment, which parses and
// reindents wherever the place stands. The marks become the template's holes, and the template
// without them is the snippet.
export function getCodeSnippet(
  csf: CsfFile,
  storyName: string,
  componentName?: string,
  resolver: StoryArgsResolver = createStoryArgsResolver(csf)
): CodeSnippet {
  const { args, imports, unresolved } = resolver.resolve(storyName);
  const importedBind = importedBoundStory(csf, storyName, args);
  // All code the snippet prints, so none of it is read as a mark.
  const sources = [csf.editor.code, ...Object.values(args).map(detachedTextOf)];
  const marks = createHoleMarks<ReactHolePlace>(sources, (mark) => `/*${mark}*/`);
  const marked = importedBind
    ? importedBind.print(marks.mark)
    : buildSnippet(csf, storyName, componentName, args, resolver, marks.mark);
  const holes = marks.toTemplate(marked);
  invariant(holes, 'A place an arg prints was printed inside another.');
  const template = withHoleSpace(
    holes,
    // An attribute a control clears leaves no gap or empty line.
    (hole) => hole.kind === 'attr'
  );
  return {
    snippet: stripHoles(template),
    template,
    imports: importedBind ? [...imports, importedBind.importRef] : imports,
    unresolved,
  };
}

type Args = Record<string, Node>;

// The args a bound story is called with, one a line, each as its code.
const printArgsObject = (args: [string, string][]) =>
  args.length === 0
    ? '{}'
    : `{\n${args.map(([name, code]) => `    ${JSON.stringify(name)}: ${code}`).join(',\n')}\n}`;

interface Edit {
  start: number;
  end: number;
  text: string;
}

// `Story = helper.bind({})` with `helper` imported: the snippet calls the bound helper with the args.
function importedBoundStory(
  csf: CsfFile,
  storyName: string,
  args: Args
): { print: (mark: Mark) => string; importRef: ImportRef } | undefined {
  const declaration = csf._storyExports[storyName];
  if (declaration?.type !== 'VariableDeclarator' || !isCanonicalCsf2BindCall(declaration.init)) {
    return undefined;
  }
  const local = declaration.init.callee.object.name;
  const binding = collectImportBindings(csf.program).get(local);
  if (!binding) {
    return undefined;
  }

  const print = valuePrinter('    ');
  const bound = textOf(declaration.init);
  // Each value the story writes is a hole for its arg.
  const argsObject = (mark: Mark) =>
    printArgsObject(
      Object.entries(args).map(([key, value]) => [
        key,
        mark({ kind: 'value', arg: key }, print(value)),
      ])
    );
  return {
    print: (mark) => `const ${storyName} = () => ${bound}(${argsObject(mark)});`,
    importRef: {
      localImportName: local,
      importId: binding.importId,
      importName: binding.importName,
      ...(binding.importName === '*' ? { namespace: local } : {}),
    },
  };
}

function buildSnippet(
  csf: CsfFile,
  storyName: string,
  componentName: string | undefined,
  merged: Args,
  resolver: StoryArgsResolver,
  mark: Mark
): string {
  const editor = csf.editor;
  const storyDeclaration = csf._storyExports[storyName];

  if (!storyDeclaration) {
    const message = 'Expected story to be a function or variable declaration';
    const statement = csf.program.body.find(
      (node) =>
        node.type === 'ExportNamedDeclaration' &&
        node.specifiers.some(
          (specifier) =>
            (specifier.exported.type === 'Identifier'
              ? specifier.exported.name
              : specifier.exported.value) === storyName
        )
    );
    throw statement ? storyShapeError(message, statement, editor) : message;
  }

  const normalizedStory = normalizeStoryDeclaration(storyDeclaration, editor);

  // Find a function (explicit story fn or render())
  let storyFn: FunctionNode | undefined =
    normalizedStory.type === 'fn' ? normalizedStory.node : undefined;

  const storyConfig = normalizedStory.type === 'config' ? normalizedStory.node : undefined;

  const metaRender = resolveRenderFunction(metaObject(csf), editor, resolver.ctx);
  const storyRender = resolveRenderFunction(storyConfig, editor, resolver.ctx);

  // Story render takes precedence. Only fall back to meta render when the story
  // has no render property at all — NOT when it has one that couldn't be resolved.
  // A render shadowed by a later spread is still the best static guess for this manifest,
  // which degrades to synthesis rather than suppressing snippets.
  if (!storyFn) {
    storyFn =
      renderFunctionOf(storyRender) ??
      (storyRender.kind === 'missing' ? renderFunctionOf(metaRender) : undefined);
  }

  if (storyFn) {
    return functionSnippet(
      editor.code,
      storyName,
      storyFn,
      isMethod(editor.parentOf(storyFn)),
      merged,
      mark
    );
  }

  // No function: synthesize `<Component {...attrs}/>`
  invariant(componentName, 'Could not generate snippet without component name.');
  const print = valuePrinter('');
  const attrs = injectedAttributes(merged, new Set(), print, mark);
  const added = addedAttributes(injectedNames(merged, new Set()), Boolean(merged.children), mark);
  const opening = `<${[componentName, ...attrs].join(' ')}${added}`;
  const element = merged.children
    ? `${opening}>${childrenHole(merged.children, print, mark)}</${componentName}>`
    : `${opening} />`;
  return `const ${storyName} = () => ${element};`;
}

const isMethod = (parent: Node | null) =>
  parent?.type === 'Property' && (parent.method || parent.kind !== 'init');

// The story function renamed to the story, with the args it reads inlined into its JSX.
function functionSnippet(
  code: string,
  storyName: string,
  fn: FunctionNode,
  method: boolean,
  merged: Args,
  mark: Mark
): string {
  const asyncPrefix = fn.async ? 'async ' : '';
  const params = fn.params.length
    ? code.slice(fn.params[0].start, fn.params[fn.params.length - 1].end)
    : '';
  const edits: Edit[] = [];

  if (fn.type === 'ArrowFunctionExpression' && isJsx(fn.body)) {
    if (rewriteJsx(code, fn.body, merged, edits, mark)) {
      const body = printRange(code, fn.body, edits);
      const kept = readsArgs(`${asyncPrefix}() => (${body});`) ? params : '';
      return `const ${storyName} = ${asyncPrefix}(${kept}) => ${body};`;
    }
  } else if (fn.body?.type === 'BlockStatement') {
    let changed = false;
    for (const statement of fn.body.body) {
      if (statement.type === 'ReturnStatement' && isJsx(statement.argument)) {
        changed = rewriteJsx(code, statement.argument, merged, edits, mark) || changed;
      }
    }
    if (changed) {
      const body = printRange(code, fn.body, edits);
      const head = `${asyncPrefix}function${fn.generator ? '*' : ''}`;
      const kept = readsArgs(`${head} f() ${body}`) ? params : '';
      return fn.type === 'FunctionDeclaration'
        ? `${asyncPrefix}function${fn.generator ? '*' : ''} ${storyName}(${kept}) ${body}`
        : `const ${storyName} = ${asyncPrefix}(${kept}) => ${body};`;
    }
  }

  // The story as written, but for the reads of args it does not set, which are marked.
  if (fn.type === 'FunctionDeclaration' && fn.body) {
    return `${asyncPrefix}function${fn.generator ? '*' : ''} ${storyName}(${params}) ${printRange(code, fn.body, edits)}`;
  }
  if (method && fn.body) {
    return `const ${storyName} = ${asyncPrefix}(${params}) => ${printRange(code, fn.body, edits)};`;
  }
  return `const ${storyName} = ${printRange(code, fn, edits)};`;
}

const isJsx = (node: Node | null | undefined): node is E.JSXElement | E.JSXFragment =>
  node?.type === 'JSXElement' || node?.type === 'JSXFragment';

// Dedents continuation lines so the snippet does not carry the story file's nesting.
function printRange(code: string, range: { start: number; end: number }, edits: Edit[]): string {
  let text = '';
  let cursor = range.start;
  for (const edit of [...edits].sort((a, b) => a.start - b.start || a.end - b.end)) {
    text += code.slice(cursor, edit.start) + edit.text;
    cursor = edit.end;
  }
  text += code.slice(cursor, range.end);

  return reindent(text, lineIndent(code, range.start), '');
}

// Whether code still reads the `args` parameter, so the snippet has to keep declaring it.
function readsArgs(source: string): boolean {
  // A key or a member name spelled `args` names a property, not the parameter.
  const named = new Set<Node>();
  let reads = false;

  walk(parseModule(source).program, (current) => {
    if (current.type === 'MemberExpression' && !current.computed) {
      named.add(current.property);
    }
    if (current.type === 'Property' && !current.computed && !current.shorthand) {
      named.add(current.key);
    }
    if (current.type === 'Identifier' && current.name === 'args' && !named.has(current)) {
      reads = true;
    }
  });

  return reads;
}

type ValuePrinter = (node: Node) => string;

// Prints an arg value for a snippet line indented by `indent`.
const valuePrinter =
  (indent: string): ValuePrinter =>
  (node) =>
    reindent(detachedTextOf(node), '', indent);

// An arg's node as the shared printers read it, its code printed by `print`.
const toJsxValue = (node: Node, print: ValuePrinter): JsxValue => {
  if (node.type === 'Literal' && typeof node.value === 'boolean') {
    return { kind: 'boolean', value: node.value };
  }
  if (isStringLiteral(node)) {
    return { kind: 'string', value: node.value, code: print(node) };
  }
  return { kind: isJsx(node) ? 'jsx' : 'code', code: print(node) };
};

const toAttr = (key: string, value: Node, print: ValuePrinter) =>
  printAttribute(key, toJsxValue(value, print));

// The args an element gets as attributes: every one it does not set by name, but `children`.
const injectedArgs = (merged: Args, existing: ReadonlySet<string>) =>
  Object.entries(merged).filter(([k, v]) => v != null && k !== 'children' && !existing.has(k));

const injectedNames = (merged: Args, existing: ReadonlySet<string>) =>
  injectedArgs(merged, existing).map(([k]) => k);

// Attributes for every arg not already set by name, with invalid names collected in a spread.
const injectedAttributes = (
  merged: Args,
  existing: ReadonlySet<string>,
  print: ValuePrinter,
  mark: Mark
) =>
  printAttributes(
    injectedArgs(merged, existing).map(([k, v]) => [k, toJsxValue(v, print)]),
    mark
  );

// Where a spread passes the args a control sets, but those the element prints already: by name,
// or `children` where it has content.
const addedAttributes = (printed: string[], hasContent: boolean, mark: Mark) =>
  mark(
    { kind: 'attrs', spread: true, except: hasContent ? [...printed, 'children'] : printed },
    ''
  );

// The `children` arg as content, in a hole for it.
const childrenHole = (node: Node, print: ValuePrinter, mark: Mark) =>
  mark({ kind: 'text', arg: 'children' }, toJsxChildren(node, print));

const toJsxChildren = (node: Node | null | undefined, print: ValuePrinter) =>
  node ? printChildren(toJsxValue(node, print)) : '';

/** Return `key` if expression is `args.key` (incl. optional chaining), else `null`. */
function getArgsMemberKey(expr: Node) {
  const member = expr.type === 'ChainExpression' ? expr.expression : expr;
  if (
    member.type !== 'MemberExpression' ||
    member.object.type !== 'Identifier' ||
    member.object.name !== 'args'
  ) {
    return null;
  }
  if (member.property.type === 'Identifier' && !member.computed) {
    return member.property.name;
  }
  if (isStringLiteral(member.property) && member.computed) {
    return member.property.value;
  }
  return null;
}

// Records edits expanding `{...args}` and inlining `args.foo` reads; returns whether any were made.
// A read of an arg the story does not set is kept as written, and only marked.
function rewriteJsx(
  code: string,
  node: E.JSXElement | E.JSXFragment,
  merged: Args,
  edits: Edit[],
  mark: Mark
): boolean {
  let changed = false;
  const printAt = (offset: number) => valuePrinter(lineIndent(code, offset));

  if (node.type === 'JSXElement') {
    const opening = node.openingElement;
    const attrs = opening.attributes;
    const isArgsSpread = (a: Node) =>
      a.type === 'JSXSpreadAttribute' &&
      a.argument.type === 'Identifier' &&
      a.argument.name === 'args';
    const firstSpread = attrs.findIndex(isArgsSpread);
    const tagEnd = (opening.typeArguments ?? opening.name).end;

    if (firstSpread !== -1) {
      changed = true;
      const existing = new Set(
        attrs.flatMap((a) =>
          a.type === 'JSXAttribute' && a.name.type === 'JSXIdentifier' ? [a.name.name] : []
        )
      );
      const print = printAt(attrs[firstSpread].start);
      const injected = injectedNames(merged, existing);
      const pieces =
        injectedAttributes(merged, existing, print, mark).join(' ') +
        addedAttributes(
          [...existing, ...injected],
          Boolean(merged.children) || node.children.length > 0,
          mark
        );
      attrs.forEach((a, index) => {
        if (!isArgsSpread(a)) {
          return;
        }
        if (index === firstSpread && injected.length > 0) {
          edits.push({ start: a.start, end: a.end, text: pieces });
        } else {
          const start = index > 0 ? attrs[index - 1].end : tagEnd;
          edits.push({ start, end: a.end, text: index === firstSpread ? pieces : '' });
        }
      });

      // The `children` arg the story sets is the content of an element that has none.
      if (node.children.length === 0 && merged.children) {
        const name = code.slice(opening.name.start, opening.name.end);
        const children = childrenHole(merged.children, printAt(opening.start), mark);
        if (opening.selfClosing) {
          const start = attrs.length > 0 ? attrs[attrs.length - 1].end : tagEnd;
          edits.push({ start, end: opening.end, text: `>${children}</${name}>` });
        } else {
          edits.push({ start: opening.end, end: opening.end, text: children });
        }
      }
    }

    // Each attribute that reads an arg is a hole for it. A spread writes over the attributes before
    // it, so each of those is a hole for the arg it names, which the spread then leaves out, and
    // prints that arg where the story sets it.
    const lastSpread = attrs.findLastIndex(isArgsSpread);
    attrs.forEach((a, index) => {
      if (a.type !== 'JSXAttribute' || a.name.type !== 'JSXIdentifier') {
        return;
      }
      const name = a.name.name;
      const key =
        a.value?.type === 'JSXExpressionContainer' ? getArgsMemberKey(a.value.expression) : null;
      const arg = index < lastSpread ? name : key;
      if (arg === null) {
        return;
      }
      const read = [arg, key].find((k): k is string => k !== null && Object.hasOwn(merged, k));
      const set = read !== undefined;
      const text = set ? toAttr(name, merged[read], printAt(a.start)) : code.slice(a.start, a.end);
      edits.push({
        start: a.start,
        end: a.end,
        text: mark({ kind: 'attr', arg, ...(arg !== name && { name }) }, text),
      });
      changed ||= set;
    });
  }

  for (const child of node.children) {
    if (isJsx(child)) {
      changed = rewriteJsx(code, child, merged, edits, mark) || changed;
    } else if (child.type === 'JSXExpressionContainer') {
      // A read of an arg the story sets is filled in; one of an arg it does not set stays as written.
      const key = getArgsMemberKey(child.expression);
      if (key === null) {
        continue;
      }
      const set = Object.hasOwn(merged, key);
      const text = set
        ? toJsxChildren(merged[key], printAt(child.start))
        : code.slice(child.start, child.end);
      edits.push({
        start: child.start,
        end: child.end,
        text: mark({ kind: 'text', arg: key }, text),
      });
      changed ||= set;
    }
  }

  return changed;
}
