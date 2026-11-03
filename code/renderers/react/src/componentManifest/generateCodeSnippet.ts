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
  unresolvedWarning,
  walk,
} from 'storybook/internal/csf-tools';
import {
  defaultWord,
  hasHoleBracket,
  hole,
  holeWord,
  withHoleSpace,
} from 'storybook/internal/docs-tools';

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
  /** Imports the snippet needs beyond the component, from arg values that kept a name. */
  imports: ImportRef[];
  /** What a static pass could not read, in the source text it was written as. */
  unresolved: string[];
  /**
   * The same printer's output with a hole wherever it prints an arg, for the preview to fill; see
   * `StoryDoc.template`.
   */
  template?: string;
  /** The code the story writes each arg with, as the snippet prints it; see `StoryDoc.argCode`. */
  argCode?: Record<string, string>;
  /** What the filled `template` leaves out; see `StoryDoc.templateWarning`. */
  templateWarning?: string;
}

/**
 * The story's snippet, printed once with its args and once with a hole wherever the printer writes
 * an arg. Both prints make every decision the same way, so the template has the snippet's form.
 */
export function getCodeSnippet(
  csf: CsfFile,
  storyName: string,
  componentName?: string,
  resolver: StoryArgsResolver = createStoryArgsResolver(csf)
): CodeSnippet {
  const { args, imports, unresolved } = resolver.resolve(storyName);
  const importedBind = importedBoundStory(csf, storyName, args);
  const printed = importedBind ?? buildSnippet(csf, storyName, componentName, args, resolver);
  const needs = {
    imports: importedBind ? [...imports, importedBind.importRef] : imports,
    unresolved,
  };
  // Holes written in code that already holds a hole bracket could not be found again.
  if (hasHoleBracket(csf.editor.code)) {
    return { snippet: printed.snippet, ...needs };
  }
  const warning = unresolvedWarning(unresolved);
  return {
    snippet: printed.snippet,
    template: withHoleSpace(printed.template, takesSpace),
    argCode: writtenArgs(args, importedBind !== undefined),
    ...(warning === undefined ? {} : { templateWarning: warning }),
    ...needs,
  };
}

type Args = Record<string, Node>;

/** The snippet printed with the args, and the template printed with holes in their place. */
interface Printed {
  snippet: string;
  template: string;
}

// An edit the printer makes with the args, `value`, and with holes, `hole`. `undefined` leaves the
// code as written in that print. A hole can take the code it replaces, without the indentation
// the snippet drops, as the code it prints for an unset arg.
interface Edit {
  start: number;
  end: number;
  value?: string;
  hole?: string | ((dedent: (code: string) => string) => string);
}

// The code of each arg the printer writes as the story writes it, for the filler to print the same
// while the arg is unchanged: every arg but a boolean or a string it prints as an attribute or text,
// or, as the args of a bound story, every arg.
const writtenArgs = (args: Args, everyArg = false): Record<string, string> =>
  Object.fromEntries(
    Object.entries(args)
      .filter(([key, node]) => everyArg || !printsAsValue(key, node))
      .map(([key, node]) => [key, detachedTextOf(node)])
  );

const printsAsValue = (key: string, node: Node) =>
  key === 'children'
    ? isStringLiteral(node) && !/[{}<>&\r\n]/.test(node.value)
    : isValidJsxAttrName(key) &&
      ((node.type === 'Literal' && typeof node.value === 'boolean') ||
        (isStringLiteral(node) && !/["&\r\n]/.test(node.value)));

// `Story = helper.bind({})` with `helper` imported: the snippet calls the bound helper with the args.
function importedBoundStory(
  csf: CsfFile,
  storyName: string,
  args: Args
): (Printed & { importRef: ImportRef }) | undefined {
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
  const values = Object.entries(args).map(
    ([key, value]) => `    ${JSON.stringify(key)}: ${print(value)}`
  );
  const argsObject = values.length ? `{\n${values.join(',\n')}\n}` : '{}';
  const bound = textOf(declaration.init);
  const call = (values: string) => `const ${storyName} = () => ${bound}(${values});`;
  return {
    snippet: call(argsObject),
    template: call(hole('args')),
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
  resolver: StoryArgsResolver
): Printed {
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
      merged
    );
  }

  // No function: synthesize `<Component {...attrs}/>`
  invariant(componentName, 'Could not generate snippet without component name.');
  const print = valuePrinter('');
  const attrs = injectedAttributes(merged, new Set(), print);
  const children = toJsxChildren(merged.children, print);
  const opening = [componentName, ...attrs].join(' ');
  const element = children ? `<${opening}>${children}</${componentName}>` : `<${opening} />`;
  return {
    snippet: `const ${storyName} = () => ${element};`,
    template: `const ${storyName} = () => ${hole('element', holeWord(componentName))};`,
  };
}

const isMethod = (parent: Node | null) =>
  parent?.type === 'Property' && (parent.method || parent.kind !== 'init');

// The story function renamed to the story, with the args it reads inlined into its JSX.
function functionSnippet(
  code: string,
  storyName: string,
  fn: FunctionNode,
  method: boolean,
  merged: Args
): Printed {
  const asyncPrefix = fn.async ? 'async ' : '';
  const params = fn.params.length
    ? code.slice(fn.params[0].start, fn.params[fn.params.length - 1].end)
    : '';
  const edits: Edit[] = [];
  const both = (print: (holes: boolean) => string): Printed => ({
    snippet: print(false),
    template: print(true),
  });

  if (fn.type === 'ArrowFunctionExpression' && isJsx(fn.body)) {
    if (rewriteJsx(code, fn.body, merged, edits)) {
      const body = fn.body;
      // Whether the snippet keeps the parameter is decided once, by the snippet.
      const kept = readsArgs(`${asyncPrefix}() => (${printRange(code, body, edits, false)});`)
        ? params
        : '';
      return both(
        (holes) =>
          `const ${storyName} = ${asyncPrefix}(${kept}) => ${printRange(code, body, edits, holes)};`
      );
    }
  } else if (fn.body?.type === 'BlockStatement') {
    let changed = false;
    for (const statement of fn.body.body) {
      if (statement.type === 'ReturnStatement' && isJsx(statement.argument)) {
        changed = rewriteJsx(code, statement.argument, merged, edits) || changed;
      }
    }
    if (changed) {
      const body = fn.body;
      const head = `${asyncPrefix}function${fn.generator ? '*' : ''}`;
      const kept = readsArgs(`${head} f() ${printRange(code, body, edits, false)}`) ? params : '';
      return both((holes) =>
        fn.type === 'FunctionDeclaration'
          ? `${head} ${storyName}(${kept}) ${printRange(code, body, edits, holes)}`
          : `const ${storyName} = ${asyncPrefix}(${kept}) => ${printRange(code, body, edits, holes)};`
      );
    }
  }

  // The story as written; an arg it reads but does not set is still a hole in the template.
  const unchanged = (holes: boolean) => {
    if (fn.type === 'FunctionDeclaration' && fn.body) {
      return `${asyncPrefix}function${fn.generator ? '*' : ''} ${storyName}(${params}) ${printRange(code, fn.body, edits, holes)}`;
    }
    if (method && fn.body) {
      return `const ${storyName} = ${asyncPrefix}(${params}) => ${printRange(code, fn.body, edits, holes)};`;
    }
    return `const ${storyName} = ${printRange(code, fn, edits, holes)};`;
  };
  return both(unchanged);
}

const isJsx = (node: Node | null | undefined): node is E.JSXElement | E.JSXFragment =>
  node?.type === 'JSXElement' || node?.type === 'JSXFragment';

// Dedents continuation lines so the snippet does not carry the story file's nesting.
function printRange(
  code: string,
  range: { start: number; end: number },
  edits: Edit[],
  holes: boolean
): string {
  // Holes do not parse, and dedenting reads the code to keep template literal lines as written, so
  // each hole is a name that parses in its place until then: an attribute, text, or for `⟦close⟧`
  // the end of a self-closing element.
  const placeholders: string[] = [];
  const dedent = (text: string) => {
    const from = lineIndent(code, range.start);
    return text.replaceAll(`\n${from}`, '\n');
  };
  const placeholder = (written: NonNullable<Edit['hole']>) => {
    const hole = typeof written === 'string' ? written : written(dedent);
    const name = `__storybook_hole_${placeholders.push(hole) - 1}__`;
    return hole.startsWith('⟦close') ? ` ${name} />` : name;
  };
  let text = '';
  let cursor = range.start;
  const applied = edits.filter((edit) => (holes ? edit.hole : edit.value) !== undefined);
  for (const edit of applied.sort((a, b) => a.start - b.start || a.end - b.end)) {
    text += code.slice(cursor, edit.start) + (holes ? placeholder(edit.hole!) : edit.value);
    cursor = edit.end;
  }
  text += code.slice(cursor, range.end);

  return placeholders.reduce(
    (printed, hole, index) =>
      printed.replace(
        hole.startsWith('⟦close')
          ? ` __storybook_hole_${index}__ />`
          : `__storybook_hole_${index}__`,
        () => hole
      ),
    reindent(text, lineIndent(code, range.start), '')
  );
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

const isValidJsxAttrName = (n: string) => /^[A-Za-z_][A-Za-z0-9_:-]*$/.test(n);

const toAttr = (key: string, value: Node, print: ValuePrinter) => {
  if (value.type === 'Literal' && typeof value.value === 'boolean') {
    return value.value ? key : `${key}={false}`;
  }
  // A JSX attribute string has no escapes, decodes entities and folds line breaks, so a value it
  // cannot hold as written stays an expression.
  if (isStringLiteral(value) && !/["&\r\n]/.test(value.value)) {
    return `${key}="${value.value}"`;
  }
  return `${key}={${print(value)}}`;
};

// Attributes for every arg not already set by name, with invalid names collected in a spread.
function injectedAttributes(
  merged: Args,
  existing: ReadonlySet<string>,
  print: ValuePrinter
): string[] {
  const entries = Object.entries(merged).filter(
    ([k, v]) => v != null && k !== 'children' && !existing.has(k)
  );
  const attrs = entries.filter(([k]) => isValidJsxAttrName(k)).map(([k, v]) => toAttr(k, v, print));
  const invalid = entries.filter(([k]) => !isValidJsxAttrName(k));
  if (invalid.length > 0) {
    const members = invalid.map(([k, v]) => `${JSON.stringify(k)}: ${print(v)}`);
    attrs.push(`{...{ ${members.join(', ')} }}`);
  }
  return attrs;
}

// JSX text cannot hold braces or tags, decodes entities and folds line breaks.
const toJsxChildren = (node: Node | null | undefined, print: ValuePrinter) =>
  !node
    ? ''
    : isStringLiteral(node) && !/[{}<>&\r\n]/.test(node.value)
      ? node.value
      : isJsx(node)
        ? print(node)
        : `{${print(node)}}`;

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

// Records edits expanding `{...args}` and inlining `args.foo` reads; returns whether the snippet
// changes. A read of an arg the story does not set is a hole only, with the read as its default.
function rewriteJsx(
  code: string,
  node: E.JSXElement | E.JSXFragment,
  merged: Args,
  edits: Edit[]
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
      // The spread passes every arg but the attributes written next to it, and `children` passes
      // as content.
      const props = hole(
        'props',
        ...[...new Set([...existing, 'children'])].map((name) => holeWord(`-${name}`))
      );
      attrs.forEach((a, index) => {
        if (!isArgsSpread(a)) {
          return;
        }
        const remove = { start: index > 0 ? attrs[index - 1].end : tagEnd, end: a.end };
        if (index !== firstSpread) {
          edits.push({ ...remove, value: '', hole: '' });
        } else if (pieces) {
          edits.push({ start: a.start, end: a.end, value: pieces, hole: props });
        } else {
          edits.push({ ...remove, value: '' }, { start: a.start, end: a.end, hole: props });
        }
      });

      if (node.children.length === 0) {
        // `⟦close Button⟧` ends the element with the `children` arg as content, or self-closing.
        const name = code.slice(opening.name.start, opening.name.end);
        const children = merged.children
          ? toJsxChildren(merged.children, printAt(opening.start))
          : undefined;
        const lastEnd = attrs.length > 0 ? attrs[attrs.length - 1].end : tagEnd;
        // Without children the element ends as the story writes it.
        // Content is indented as the line the element opens on, as the snippet prints it.
        const close = (end: number) => (dedent: (code: string) => string) => {
          const indent = dedent(`\n${lineIndent(code, opening.start)}`).slice(1);
          return hole(
            'close',
            holeWord(name),
            ...(indent ? [holeWord(`^${indent}`)] : []),
            defaultWord(dedent(code.slice(lastEnd, end)))
          );
        };
        if (opening.selfClosing) {
          edits.push({
            start: lastEnd,
            end: opening.end,
            value: children === undefined ? undefined : `>${children}</${name}>`,
            hole: close(opening.end),
          });
        } else {
          if (children !== undefined) {
            edits.push({ start: opening.end, end: opening.end, value: children });
          }
          edits.push({ start: lastEnd, end: node.end, hole: close(node.end) });
        }
      }
    }

    for (const a of attrs) {
      if (
        a.type !== 'JSXAttribute' ||
        a.name.type !== 'JSXIdentifier' ||
        a.value?.type !== 'JSXExpressionContainer'
      ) {
        continue;
      }
      const key = getArgsMemberKey(a.value.expression);
      if (key === null) {
        continue;
      }
      const name = a.name.name;
      if (Object.hasOwn(merged, key)) {
        edits.push({
          start: a.start,
          end: a.end,
          value: toAttr(name, merged[key], printAt(a.start)),
          hole: hole('attr', holeWord(name), holeWord(key)),
        });
        changed = true;
      } else {
        // The snippet keeps the read as written while the story does not set the arg.
        const { start, end } = a;
        edits.push({
          start,
          end,
          hole: (dedent) =>
            hole(
              'attr',
              holeWord(name),
              holeWord(key),
              defaultWord(dedent(code.slice(start, end)))
            ),
        });
      }
    }
  }

  for (const child of node.children) {
    if (isJsx(child)) {
      changed = rewriteJsx(code, child, merged, edits) || changed;
    } else if (
      child.type === 'JSXExpressionContainer' &&
      getArgsMemberKey(child.expression) === 'children'
    ) {
      const { start, end } = child;
      if (merged.children) {
        edits.push({
          start,
          end,
          value: toJsxChildren(merged.children, printAt(start)),
          hole: hole('text', 'children'),
        });
        changed = true;
      } else {
        edits.push({
          start,
          end,
          hole: (dedent) => hole('text', 'children', defaultWord(dedent(code.slice(start, end)))),
        });
      }
    }
  }

  return changed;
}

// An attribute that prints nothing leaves no gap, and no hole leaves an empty line.
const takesSpace = (kind: string, space: string) =>
  kind === 'attr' || kind === 'props' || space.includes('\n');
