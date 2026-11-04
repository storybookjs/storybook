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
  withHoleSpace,
} from 'storybook/internal/docs-tools';

import {
  type JsxValue,
  type Mark,
  type ReactHolePlace,
  printArgsEntry,
  printArgsObject,
  printAttribute,
  printAttributes,
  printChildren,
  printClose,
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
  // The snippet with each place an arg prints as a hole, when asked for; see `ProvidedStoryDoc`.
  template?: SnippetTemplate<ReactHolePlace>;
  /** Imports the snippet needs beyond the component, from arg values that kept a name. */
  imports: ImportRef[];
  /** What a static pass could not read, in the source text it was written as. */
  unresolved: string[];
}

export function getCodeSnippet(
  csf: CsfFile,
  storyName: string,
  componentName?: string,
  resolver: StoryArgsResolver = createStoryArgsResolver(csf),
  withTemplate = false
): CodeSnippet {
  const { args, imports, unresolved } = resolver.resolve(storyName);
  const importedBind = importedBoundStory(csf, storyName, args);
  const print = (mark?: Mark) =>
    importedBind
      ? importedBind.print(mark)
      : buildSnippet(csf, storyName, componentName, args, resolver, mark);
  const snippet = print();
  const template = withTemplate ? printTemplate(print, [csf.editor.code, snippet]) : undefined;
  return {
    snippet,
    ...(template && { template }),
    imports: importedBind ? [...imports, importedBind.importRef] : imports,
    unresolved,
  };
}

type Args = Record<string, Node>;

// The template is the snippet printed with each place an arg prints marked by a comment, which
// parses and reindents wherever the place stands, and the marks then turned into holes. `sources`
// is all code the snippet prints, so none of it is read as a mark.
function printTemplate(
  print: (mark: Mark) => string,
  sources: string[]
): SnippetTemplate<ReactHolePlace> | undefined {
  const marks = createHoleMarks<ReactHolePlace>(sources, (mark) => `/*${mark}*/`);
  const template: SnippetTemplate<ReactHolePlace> | undefined = marks
    .toTemplate(print(marks.mark))
    ?.map((segment) =>
      // While neither arg it follows changes, an `overridden` hole prints the attribute as written.
      typeof segment !== 'string' && segment.kind === 'overridden'
        ? { ...segment, written: segment.text }
        : segment
    );
  // An attribute a control clears leaves no gap or empty line.
  return (
    template &&
    withHoleSpace(template, (hole) => hole.kind === 'attr' || hole.kind === 'overridden')
  );
}

// `value` is the snippet's code from `start` to `end`, or the code as written when `undefined`;
// `marked` is the template's, with the places in it marked, or `value` when `undefined`.
interface Edit {
  start: number;
  end: number;
  value?: string;
  marked?: string;
}

// `Story = helper.bind({})` with `helper` imported: the snippet calls the bound helper with the args.
function importedBoundStory(
  csf: CsfFile,
  storyName: string,
  args: Args
): { print: (mark?: Mark) => string; importRef: ImportRef } | undefined {
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
  const entries = Object.entries(args);
  // The args a control adds go after the story's, or make the object when it has none.
  const argsObject = (mark?: Mark) => {
    if (!mark) {
      return printArgsObject(entries.map(([key, value]) => [key, print(value)]));
    }
    if (entries.length === 0) {
      return mark({ kind: 'object', spread: true }, '{}');
    }
    const values = entries.map(([key, value]) =>
      printArgsEntry([key, mark({ kind: 'value', arg: key }, print(value))])
    );
    const keys = entries.map(([key]) => key);
    return `{\n${values.join(',\n')}${mark({ kind: 'entries', spread: true, except: keys }, '')}\n}`;
  };
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
  mark: Mark | undefined
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
  const children = toJsxChildren(merged.children, print);
  const end = children ? printClose(componentName, children) : ' />';
  const added = addedAttributes(injectedNames(merged, new Set()), mark);
  const element = `<${[componentName, ...attrs].join(' ')}${added}${closeHole(componentName, end, mark)}`;
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
  mark: Mark | undefined
): string {
  const asyncPrefix = fn.async ? 'async ' : '';
  const params = fn.params.length
    ? code.slice(fn.params[0].start, fn.params[fn.params.length - 1].end)
    : '';
  const edits: Edit[] = [];

  if (fn.type === 'ArrowFunctionExpression' && isJsx(fn.body)) {
    if (rewriteJsx(code, fn.body, merged, edits, mark)) {
      // The static snippet decides whether the parameter stays, for the template too.
      const kept = readsArgs(`${asyncPrefix}() => (${printRange(code, fn.body, edits)});`)
        ? params
        : '';
      const body = printRange(code, fn.body, edits, mark);
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
      const head = `${asyncPrefix}function${fn.generator ? '*' : ''}`;
      const kept = readsArgs(`${head} f() ${printRange(code, fn.body, edits)}`) ? params : '';
      const body = printRange(code, fn.body, edits, mark);
      return fn.type === 'FunctionDeclaration'
        ? `${asyncPrefix}function${fn.generator ? '*' : ''} ${storyName}(${kept}) ${body}`
        : `const ${storyName} = ${asyncPrefix}(${kept}) => ${body};`;
    }
  }

  // The story as written, but for the reads of args it does not set, which the template marks.
  if (fn.type === 'FunctionDeclaration' && fn.body) {
    return `${asyncPrefix}function${fn.generator ? '*' : ''} ${storyName}(${params}) ${printRange(code, fn.body, edits, mark)}`;
  }
  if (method && fn.body) {
    return `const ${storyName} = ${asyncPrefix}(${params}) => ${printRange(code, fn.body, edits, mark)};`;
  }
  return `const ${storyName} = ${printRange(code, fn, edits, mark)};`;
}

const isJsx = (node: Node | null | undefined): node is E.JSXElement | E.JSXFragment =>
  node?.type === 'JSXElement' || node?.type === 'JSXFragment';

// Dedents continuation lines so the snippet does not carry the story file's nesting. With `mark`,
// prints the template's code, with its places marked.
function printRange(
  code: string,
  range: { start: number; end: number },
  edits: Edit[],
  mark?: Mark
): string {
  let text = '';
  let cursor = range.start;
  for (const edit of [...edits].sort((a, b) => a.start - b.start || a.end - b.end)) {
    const printed = mark ? (edit.marked ?? edit.value) : edit.value;
    if (printed === undefined) {
      continue;
    }
    text += code.slice(cursor, edit.start) + printed;
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
  mark?: Mark
) =>
  printAttributes(
    injectedArgs(merged, existing).map(([k, v]) => [k, toJsxValue(v, print)]),
    mark
  );

// Where a spread passes the args a control sets, but those the element prints by name, and
// `children`, which the element ends with; see `closeHole`.
const addedAttributes = (printed: string[], mark: Mark | undefined) =>
  mark ? mark({ kind: 'attrs', spread: true, except: [...printed, 'children'] }, '') : '';

// The end of an element the args pass `children` to: `end` as the snippet prints it.
const closeHole = (name: string, end: string, mark: Mark | undefined) =>
  mark ? mark({ kind: 'close', arg: 'children', element: name }, end) : end;

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
  mark: Mark | undefined
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
      const pieces = injectedAttributes(merged, existing, print).join(' ');
      const marked =
        mark &&
        injectedAttributes(merged, existing, print, mark).join(' ') +
          addedAttributes([...existing, ...injectedNames(merged, existing)], mark);
      attrs.forEach((a, index) => {
        if (!isArgsSpread(a)) {
          return;
        }
        if (index === firstSpread && pieces) {
          edits.push({ start: a.start, end: a.end, value: pieces, marked });
        } else {
          const start = index > 0 ? attrs[index - 1].end : tagEnd;
          edits.push({
            start,
            end: a.end,
            value: '',
            marked: index === firstSpread ? marked : '',
          });
        }
      });

      if (node.children.length === 0) {
        const name = code.slice(opening.name.start, opening.name.end);
        const children = merged.children
          ? toJsxChildren(merged.children, printAt(opening.start))
          : undefined;
        // The element ends as written, with the `children` arg as content when the story sets it.
        const [start, end] = opening.selfClosing
          ? [attrs.length > 0 ? attrs[attrs.length - 1].end : tagEnd, opening.end]
          : [opening.end - 1, node.end];
        const value =
          children === undefined
            ? undefined
            : opening.selfClosing
              ? printClose(name, children)
              : `>${children}${code.slice(opening.end, node.end)}`;
        edits.push({
          start,
          end,
          value,
          marked: closeHole(name, value ?? code.slice(start, end), mark),
        });
      }
    }

    // Each attribute that reads an arg is a hole for it. A spread writes over the attributes before
    // it, so each of those follows the arg it names too, and one that reads another arg follows
    // both, as an `overridden` hole.
    const lastSpread = attrs.findLastIndex(isArgsSpread);
    attrs.forEach((a, index) => {
      if (a.type !== 'JSXAttribute' || a.name.type !== 'JSXIdentifier') {
        return;
      }
      const name = a.name.name;
      const beforeSpread = index < lastSpread;
      const key =
        a.value?.type === 'JSXExpressionContainer' ? getArgsMemberKey(a.value.expression) : null;
      if (key === null) {
        if (beforeSpread && mark) {
          edits.push({
            start: a.start,
            end: a.end,
            marked: mark({ kind: 'attr', arg: name }, code.slice(a.start, a.end)),
          });
        }
        return;
      }
      const value = Object.hasOwn(merged, key)
        ? toAttr(name, merged[key], printAt(a.start))
        : undefined;
      const written = value ?? code.slice(a.start, a.end);
      edits.push({
        start: a.start,
        end: a.end,
        value,
        marked: mark?.(
          key === name
            ? { kind: 'attr', arg: key }
            : beforeSpread
              ? // `printTemplate` sets `written` to the hole's text.
                { kind: 'overridden', spread: true, name, reads: key, written: '' }
              : { kind: 'attr', arg: key, name },
          written
        ),
      });
      changed ||= value !== undefined;
    });
  }

  for (const child of node.children) {
    if (isJsx(child)) {
      changed = rewriteJsx(code, child, merged, edits, mark) || changed;
    } else if (child.type === 'JSXExpressionContainer') {
      // The snippet inlines only `children` as content; a read of another arg stays as written.
      const key = getArgsMemberKey(child.expression);
      if (key === null) {
        continue;
      }
      const value =
        key === 'children' && merged.children
          ? toJsxChildren(merged.children, printAt(child.start))
          : undefined;
      edits.push({
        start: child.start,
        end: child.end,
        value,
        marked: mark?.({ kind: 'text', arg: key }, value ?? code.slice(child.start, child.end)),
      });
      changed ||= value !== undefined;
    }
  }

  return changed;
}
