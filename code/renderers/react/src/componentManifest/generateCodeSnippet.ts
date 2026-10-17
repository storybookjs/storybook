import {
  type CsfFile,
  type ESTree as E,
  type ESTreeNode as Node,
  type FunctionNode,
  type ImportRef,
  type RenderResolution,
  type StoryArgsResolver,
  codeOf,
  collectImportBindings,
  createStoryArgsResolver,
  isCanonicalCsf2BindCall,
  isStringLiteral,
  lineIndent,
  metaObject,
  normalizeStoryDeclaration,
  parseModule,
  placeableTextOf,
  reindent,
  resolveRenderFunction,
  storyShapeError,
  walk,
} from 'storybook/internal/csf-tools';

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
  code: string;
  /** Imports the snippet needs beyond the component, from arg values that kept a name. */
  imports: ImportRef[];
  /** What a static pass could not read, in the source text it was written as. */
  unresolved: string[];
}

export function getCodeSnippet(
  csf: CsfFile,
  storyName: string,
  componentName?: string,
  resolver: StoryArgsResolver = createStoryArgsResolver(csf)
): CodeSnippet {
  const { args, imports, unresolved } = resolver.resolve(storyName);
  const importedBind = importedBoundStory(csf, storyName, args);
  if (importedBind) {
    return {
      code: importedBind.code,
      imports: [...imports, importedBind.importRef],
      unresolved,
    };
  }
  return {
    code: buildSnippet(csf, storyName, componentName, args, resolver),
    imports,
    unresolved,
  };
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
  storyName: string,
  args: Args
): { code: string; importRef: ImportRef } | undefined {
  const declaration = csf._storyExports[storyName];
  if (declaration?.type !== 'VariableDeclarator' || !isCanonicalCsf2BindCall(declaration.init)) {
    return undefined;
  }
  const local = declaration.init.callee.object.name;
  const binding = collectImportBindings(csf._program).get(local);
  if (!binding) {
    return undefined;
  }

  const values = Object.entries(args).map(
    ([key, value]) => `    ${JSON.stringify(key)}: ${placeableTextOf(value)}`
  );
  const argsObject = values.length ? `{\n${values.join(',\n')}\n}` : '{}';
  return {
    code: `const ${storyName} = () => ${codeOf(declaration.init)}(${argsObject});`,
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
): string {
  const editor = csf._editor;
  const storyDeclaration = csf._storyExports[storyName];

  if (!storyDeclaration) {
    const message = 'Expected story to be a function or variable declaration';
    const statement = csf._program.body.find(
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
  const attrs = injectedAttributes(merged, new Set());
  const children = toJsxChildren(merged.children);
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
  merged: Args
): string {
  const asyncPrefix = fn.async ? 'async ' : '';
  const params = fn.params.length
    ? code.slice(fn.params[0].start, fn.params[fn.params.length - 1].end)
    : '';
  const edits: Edit[] = [];

  if (fn.type === 'ArrowFunctionExpression' && isJsx(fn.body)) {
    if (rewriteJsx(code, fn.body, merged, edits)) {
      const body = printRange(code, fn.body, edits);
      const kept = readsArgs(`${asyncPrefix}() => (${body});`) ? params : '';
      return `const ${storyName} = ${asyncPrefix}(${kept}) => ${body};`;
    }
  } else if (fn.body?.type === 'BlockStatement') {
    let changed = false;
    for (const statement of fn.body.body) {
      if (statement.type === 'ReturnStatement' && isJsx(statement.argument)) {
        changed = rewriteJsx(code, statement.argument, merged, edits) || changed;
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

const isValidJsxAttrName = (n: string) => /^[A-Za-z_][A-Za-z0-9_:-]*$/.test(n);

const toAttr = (key: string, value: Node) => {
  if (value.type === 'Literal' && typeof value.value === 'boolean') {
    return value.value ? key : `${key}={false}`;
  }
  if (isStringLiteral(value) && !value.value.includes('"')) {
    return `${key}="${value.value}"`;
  }
  return `${key}={${placeableTextOf(value)}}`;
};

// Attributes for every arg not already set by name, with invalid names collected in a spread.
function injectedAttributes(merged: Args, existing: ReadonlySet<string>): string[] {
  const entries = Object.entries(merged).filter(
    ([k, v]) => v != null && k !== 'children' && !existing.has(k)
  );
  const attrs = entries.filter(([k]) => isValidJsxAttrName(k)).map(([k, v]) => toAttr(k, v));
  const invalid = entries.filter(([k]) => !isValidJsxAttrName(k));
  if (invalid.length > 0) {
    const members = invalid.map(([k, v]) => `${JSON.stringify(k)}: ${placeableTextOf(v)}`);
    attrs.push(`{...{ ${members.join(', ')} }}`);
  }
  return attrs;
}

const toJsxChildren = (node: Node | null | undefined) =>
  !node
    ? ''
    : isStringLiteral(node)
      ? node.value
      : isJsx(node)
        ? codeOf(node)
        : `{${placeableTextOf(node)}}`;

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
  edits: Edit[]
): boolean {
  let changed = false;

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
      const pieces = injectedAttributes(merged, existing).join(' ');
      attrs.forEach((a, index) => {
        if (!isArgsSpread(a)) {
          return;
        }
        if (index === firstSpread && pieces) {
          edits.push({ start: a.start, end: a.end, text: pieces });
        } else {
          edits.push({ start: index > 0 ? attrs[index - 1].end : tagEnd, end: a.end, text: '' });
        }
      });

      if (node.children.length === 0 && merged.children) {
        const children = toJsxChildren(merged.children);
        if (opening.selfClosing) {
          const name = code.slice(opening.name.start, opening.name.end);
          const lastEnd = attrs.length > 0 ? attrs[attrs.length - 1].end : tagEnd;
          edits.push({ start: lastEnd, end: opening.end, text: `>${children}</${name}>` });
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
      if (key && key in merged) {
        edits.push({ start: a.start, end: a.end, text: toAttr(a.name.name, merged[key]) });
        changed = true;
      }
    }
  }

  for (const child of node.children) {
    if (isJsx(child)) {
      changed = rewriteJsx(code, child, merged, edits) || changed;
    } else if (
      child.type === 'JSXExpressionContainer' &&
      getArgsMemberKey(child.expression) === 'children' &&
      merged.children
    ) {
      edits.push({ start: child.start, end: child.end, text: toJsxChildren(merged.children) });
      changed = true;
    }
  }

  return changed;
}
