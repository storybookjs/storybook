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
  fillStoryTemplate,
  isCanonicalCsf2BindCall,
  isStringLiteral,
  lineIndent,
  metaObject,
  normalizeStoryDeclaration,
  parseModule,
  reindent,
  resolveRenderFunction,
  resolveSpreadMeta,
  storyShapeError,
  unresolvedWarning,
  walk,
} from 'storybook/internal/csf-tools';
import { hasHoleBracket, hole, holeWord } from 'storybook/internal/docs-tools';

import { fillTemplate } from '../docs/fill-template.ts';
import { buildStoryTemplate } from './storyTemplate.ts';
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
  /** The story with a hole wherever it reads an arg, for the preview to fill; see `StoryDoc.template`. */
  template?: string;
  /** The code the story writes each arg with; see `StoryDoc.argCode`. */
  argCode?: Record<string, string>;
  /** What the filled `template` leaves out; see `StoryDoc.templateWarning`. */
  templateWarning?: string;
}

export function getCodeSnippet(
  csf: CsfFile,
  storyName: string,
  componentName?: string,
  resolver: StoryArgsResolver = createStoryArgsResolver(csf)
): CodeSnippet {
  const { args, imports, unresolved } = resolver.resolve(storyName);
  const bound = importedBoundStory(csf, storyName);
  const story = bound ? undefined : findStoryFunction(csf, storyName, resolver);
  const needs = {
    imports: bound ? [...imports, bound.importRef] : imports,
    unresolved,
  };
  // The story printed with its args filled in, or with `holes`, a hole wherever it fills one in.
  const print = (holes: boolean) =>
    bound
      ? boundStorySnippet(storyName, bound.callee, args, holes)
      : buildSnippet(storyName, story, componentName, args, holes);
  // Holes written in code that already holds a hole bracket could not be found again.
  if (hasHoleBracket(csf.editor.code)) {
    return { snippet: print(false), ...needs };
  }
  // The story as written where a hole stands for each arg it reads, else as printed. A render
  // function from another file has no source in this one to keep as written.
  const template =
    (story && story.editor === csf.editor
      ? buildStoryTemplate(storyName, story.fn, story.editor, args)
      : undefined) ?? closeHoles(print(true));
  const filled = fillStoryTemplate(template, args, fillTemplate, unresolvedWarning(unresolved));
  // Each arg the story writes is a literal or its code as written, which the filler always prints.
  invariant(filled, `Could not fill the template of ${storyName} with its own args`);
  return { ...filled, ...needs };
}

type Args = Record<string, Node>;

interface Edit {
  start: number;
  end: number;
  text: string;
}

// `Story = helper.bind({})` with `helper` imported: the snippet calls the bound helper with the args.
function importedBoundStory(
  csf: CsfFile,
  storyName: string
): { callee: string; importRef: ImportRef } | undefined {
  const declaration = csf._storyExports[storyName];
  if (declaration?.type !== 'VariableDeclarator' || !isCanonicalCsf2BindCall(declaration.init)) {
    return undefined;
  }
  const local = declaration.init.callee.object.name;
  const binding = collectImportBindings(csf.program).get(local);
  if (!binding) {
    return undefined;
  }

  return {
    callee: textOf(declaration.init),
    importRef: {
      localImportName: local,
      importId: binding.importId,
      importName: binding.importName,
      ...(binding.importName === '*' ? { namespace: local } : {}),
    },
  };
}

function boundStorySnippet(storyName: string, callee: string, args: Args, holes: boolean) {
  if (holes) {
    return `const ${storyName} = () => ${callee}(${hole('args')});`;
  }
  const print = valuePrinter('    ');
  const values = Object.entries(args).map(
    ([key, value]) => `    ${JSON.stringify(key)}: ${print(value)}`
  );
  const argsObject = values.length ? `{\n${values.join(',\n')}\n}` : '{}';
  return `const ${storyName} = () => ${callee}(${argsObject});`;
}

/** A story function and the source it is written in, which is another file's for a spread meta. */
interface StoryFunction {
  fn: FunctionNode;
  editor: CsfFile['editor'];
}

/** The story function itself, its own `render`, or the meta `render` it falls back to. */
function findStoryFunction(
  csf: CsfFile,
  storyName: string,
  resolver: StoryArgsResolver
): StoryFunction | undefined {
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
  if (!storyFn) {
    return undefined;
  }
  // A render the meta takes from the meta of another story file is written in that file.
  const source =
    editor.parentOf(storyFn) === null ? resolveSpreadMeta(csf, resolver.ctx)?.ctx.editor : editor;
  invariant(source, `Could not find the source of the render function of ${storyName}`);
  return { fn: storyFn, editor: source };
}

// An element whose children a spread passes ends in `>⟦close⟧</Button>` as printed, for a
// `⟦close Button⟧` that ends it with them as content, or as self-closing without.
const closeHoles = (template: string) =>
  template.replace(/>⟦close⟧<\/([^>]+)>/g, (_, name: string) => hole('close', holeWord(name)));

// The story printed with its args filled in wherever it spreads them, reads one in an attribute or
// as children, or has no function to print. With `holes`, each of those is a hole.
function buildSnippet(
  storyName: string,
  story: StoryFunction | undefined,
  componentName: string | undefined,
  merged: Args,
  holes: boolean
): string {
  if (story) {
    const { fn, editor } = story;
    return functionSnippet(
      editor.code,
      storyName,
      fn,
      isMethod(editor.parentOf(fn)),
      merged,
      holes
    );
  }

  // No function: synthesize `<Component {...attrs}/>`
  invariant(componentName, 'Could not generate snippet without component name.');
  if (holes) {
    return `const ${storyName} = () => ${hole('element', holeWord(componentName))};`;
  }
  const print = valuePrinter('');
  const attrs = injectedAttributes(merged, new Set(), print);
  const children = toJsxChildren(merged.children, print);
  const opening = [componentName, ...attrs].join(' ');
  const element = children ? `<${opening}>${children}</${componentName}>` : `<${opening} />`;
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
  holes: boolean
): string {
  const asyncPrefix = fn.async ? 'async ' : '';
  const params = fn.params.length
    ? code.slice(fn.params[0].start, fn.params[fn.params.length - 1].end)
    : '';
  const edits: Edit[] = [];

  if (fn.type === 'ArrowFunctionExpression' && isJsx(fn.body)) {
    if (rewriteJsx(code, fn.body, merged, edits, holes)) {
      const body = printRange(code, fn.body, edits);
      const kept = readsArgs(`${asyncPrefix}() => (${body});`) ? params : '';
      return `const ${storyName} = ${asyncPrefix}(${kept}) => ${body};`;
    }
  } else if (fn.body?.type === 'BlockStatement') {
    let changed = false;
    for (const statement of fn.body.body) {
      if (statement.type === 'ReturnStatement' && isJsx(statement.argument)) {
        changed = rewriteJsx(code, statement.argument, merged, edits, holes) || changed;
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

  if (fn.type === 'FunctionDeclaration' && fn.body) {
    return `${asyncPrefix}function${fn.generator ? '*' : ''} ${storyName}(${params}) ${printRange(code, fn.body, [])}`;
  }
  if (method && fn.body) {
    return `const ${storyName} = ${asyncPrefix}(${params}) => ${printRange(code, fn.body, [])};`;
  }
  return `const ${storyName} = ${printRange(code, fn, [])};`;
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

// Whether code still reads the `args` parameter, so the snippet has to keep declaring it. A hole
// reads as a name, which stands wherever one can: as an attribute, as JSX text, or as a value.
function readsArgs(code: string): boolean {
  const source = code.replace(/⟦[^⟧]*⟧/g, '_');
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

// Records edits expanding `{...args}` and inlining `args.foo` reads; returns whether any were made.
function rewriteJsx(
  code: string,
  node: E.JSXElement | E.JSXFragment,
  merged: Args,
  edits: Edit[],
  holes: boolean
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
      const pieces = holes
        ? hole('props', ...[...new Set([...existing, 'children'])].map((n) => holeWord(`-${n}`)))
        : injectedAttributes(merged, existing, print).join(' ');
      attrs.forEach((a, index) => {
        if (!isArgsSpread(a)) {
          return;
        }
        if (index === firstSpread && pieces) {
          edits.push({ start: a.start, end: a.end, text: pieces });
        } else {
          edits.push({
            start: index > 0 ? attrs[index - 1].end : tagEnd,
            end: a.end,
            text: '',
          });
        }
      });

      if (node.children.length === 0 && (holes || merged.children)) {
        const children = holes
          ? hole('close')
          : toJsxChildren(merged.children, printAt(opening.start));
        if (opening.selfClosing) {
          const name = code.slice(opening.name.start, opening.name.end);
          const lastEnd = attrs.length > 0 ? attrs[attrs.length - 1].end : tagEnd;
          edits.push({
            start: lastEnd,
            end: opening.end,
            text: `>${children}</${name}>`,
          });
        } else {
          edits.push({ start: opening.end, end: opening.end, text: children });
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
      if (key !== null && Object.hasOwn(merged, key)) {
        edits.push({
          start: a.start,
          end: a.end,
          text: holes
            ? hole('attr', holeWord(a.name.name), holeWord(key))
            : toAttr(a.name.name, merged[key], printAt(a.start)),
        });
        changed = true;
      }
    }
  }

  for (const child of node.children) {
    if (isJsx(child)) {
      changed = rewriteJsx(code, child, merged, edits, holes) || changed;
    } else if (
      child.type === 'JSXExpressionContainer' &&
      getArgsMemberKey(child.expression) === 'children' &&
      merged.children
    ) {
      edits.push({
        start: child.start,
        end: child.end,
        text: holes
          ? hole('text', 'children')
          : toJsxChildren(merged.children, printAt(child.start)),
      });
      changed = true;
    }
  }

  return changed;
}
