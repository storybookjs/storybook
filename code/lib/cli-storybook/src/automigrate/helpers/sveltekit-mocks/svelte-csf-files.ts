import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

import { HandledError } from 'storybook/internal/common';
import {
  type ESTree as E,
  type ESTreeNode as Node,
  SourceEditor,
  lineIndent,
  objectList,
  objectProperty,
  reindent,
  removeFromList,
  unwrapExpression,
} from 'storybook/internal/csf-tools';

import { resolve } from 'pathe';

import {
  type PreviewMocks,
  failWith,
  findUnmigrated,
  migratedKeys,
  readContext,
  styleOf,
  takenNames,
} from './csf-files.ts';
import {
  type ObjectSite,
  addInlineFalseToMeta,
  arrowFunction,
  editObjectSite,
  findObjectSite,
  hasAutodocs,
  prependToBeforeEach,
  setsInline,
  SPREAD_PROBLEM,
  spreadsBeforeEach,
} from './edit-levels.ts';
import { MockImports, aliasedImports, readsName } from './mock-imports.ts';
import {
  KEY,
  type LevelMocks,
  type Problem,
  type Span,
  keepSpies,
  mergeKeys,
  readMocks,
} from './mock-statements.ts';
import { printMocks } from './print-mocks.ts';

const SVELTE_CSF_SOURCES = [
  '@storybook/addon-svelte-csf',
  '@storybook/svelte',
  '@storybook/svelte-vite',
  '@storybook/sveltekit',
];

// The parts of Svelte's modern AST that the fix reads
interface ExpressionTag extends Span {
  type: 'ExpressionTag';
  expression: Span;
}
interface Text extends Span {
  type: 'Text';
  data: string;
}
interface SvelteAttribute extends Span {
  type: 'Attribute' | 'SpreadAttribute' | 'BindDirective' | 'OnDirective' | 'UseDirective';
  name?: string;
  value?: true | ExpressionTag | (ExpressionTag | Text)[];
}
interface SvelteComponent extends Span {
  type: 'Component';
  name: string;
  attributes: SvelteAttribute[];
}
interface SvelteScript extends Span {
  content: Span;
  attributes: SvelteAttribute[];
}
interface SvelteRoot {
  module: SvelteScript | null;
  instance: SvelteScript | null;
  fragment: unknown;
}
interface SvelteCompiler {
  parse(source: string, options: { modern: true }): SvelteRoot;
}
interface Splice extends Span {
  text: string;
}

// The project's own Svelte, which `storybook upgrade` does not change
const loadSvelteCompiler = async (storyFile: string): Promise<SvelteCompiler> => {
  let path: string;
  try {
    path = createRequire(resolve(storyFile)).resolve('svelte/compiler');
  } catch (error) {
    throw new HandledError(
      `Could not find \`svelte/compiler\` from this file, which the fix needs to read Svelte CSF: ${error instanceof Error ? error.message : error}`
    );
  }
  const module = await import(pathToFileURL(path).href);
  return 'parse' in module ? module : module.default;
};

const isTypeScript = (script: SvelteScript | null) =>
  !!script?.attributes.some(
    ({ name, value }) =>
      name === 'lang' &&
      Array.isArray(value) &&
      value.some(
        (part) =>
          part.type === 'Text' && /^(ts|typescript)$/.test((part as { data?: string }).data ?? '')
      )
  );

const expressionTag = (attribute: SvelteAttribute): ExpressionTag | undefined => {
  const { value } = attribute;
  if (value && value !== true && !Array.isArray(value) && value.type === 'ExpressionTag') {
    return value;
  }
  return Array.isArray(value) && value.length === 1 && value[0].type === 'ExpressionTag'
    ? (value[0] as ExpressionTag)
    : undefined;
};

// An attribute's expression, parsed on its own, with a map from its offsets to the file's.
interface ParsedExpression {
  attribute: SvelteAttribute;
  tag: ExpressionTag;
  editor: SourceEditor;
  node: Node;
  toFile: (index: number) => number;
  text: () => string;
}

const parseExpression = (
  code: string,
  attribute: SvelteAttribute,
  tag: ExpressionTag,
  lang: string
): ParsedExpression => {
  // Indented like its line in the file, so moved code keeps its relative indent. The right side of
  // an assignment, so no parentheses wrap the expression
  const prefix = `${lineIndent(code, tag.expression.start)}_ = `;
  const suffix = '\n;';
  const source = code.slice(tag.expression.start, tag.expression.end);
  const editor = new SourceEditor(`${prefix}${source}${suffix}`, `attribute.${lang}`);
  const statement = editor.program.body[0] as E.ExpressionStatement;
  return {
    attribute,
    tag,
    editor,
    node: (statement.expression as E.AssignmentExpression).right,
    toFile: (index) => index - prefix.length + tag.expression.start,
    text: () => editor.toString().slice(prefix.length, -suffix.length),
  };
};

const findComponents = (node: unknown, name: string, found: SvelteComponent[] = []) => {
  if (Array.isArray(node)) {
    node.forEach((child) => findComponents(child, name, found));
  } else if (node && typeof node === 'object') {
    if ((node as SvelteComponent).type === 'Component' && (node as SvelteComponent).name === name) {
      found.push(node as SvelteComponent);
    }
    for (const [key, value] of Object.entries(node)) {
      if (key !== 'parent' && key !== 'metadata') {
        findComponents(value, name, found);
      }
    }
  }
  return found;
};

const importedFrom = (
  editor: SourceEditor,
  identifier: Node,
  test: (declaration: E.ImportDeclaration, specifier: Node) => boolean
) => {
  const binding = editor.scopes.bindingOf(identifier);
  return (
    binding?.kind === 'import' && test(binding.declaration as E.ImportDeclaration, binding.node)
  );
};

const destructuringOf = (editor: SourceEditor, name: string) => {
  for (const statement of editor.program.body) {
    if (statement.type !== 'VariableDeclaration') {
      continue;
    }
    for (const declarator of statement.declarations) {
      if (
        declarator.id.type === 'ObjectPattern' &&
        declarator.init?.type === 'Identifier' &&
        declarator.init.name === name
      ) {
        return declarator.id;
      }
    }
  }
  return undefined;
};

// `const { Story } = defineMeta({…})`, or `preview.meta({…})` in CSF factories
const findMeta = (editor: SourceEditor) => {
  for (const statement of editor.program.body) {
    if (statement.type !== 'VariableDeclaration') {
      continue;
    }
    for (const declarator of statement.declarations) {
      const call = declarator.init && unwrapExpression(declarator.init);
      if (call?.type !== 'CallExpression') {
        continue;
      }
      const { callee } = call;
      const isDefineMeta =
        callee.type === 'Identifier' &&
        importedFrom(
          editor,
          callee,
          (declaration, specifier) =>
            SVELTE_CSF_SOURCES.includes(declaration.source.value) &&
            specifier.type === 'ImportSpecifier' &&
            specifier.imported.type === 'Identifier' &&
            specifier.imported.name === 'defineMeta'
        );
      const isFactory =
        callee.type === 'MemberExpression' &&
        !callee.computed &&
        callee.property.type === 'Identifier' &&
        callee.property.name === 'meta' &&
        callee.object.type === 'Identifier' &&
        importedFrom(
          editor,
          callee.object,
          (_, specifier) => specifier.type === 'ImportDefaultSpecifier'
        );
      if (!isDefineMeta && !isFactory) {
        continue;
      }
      // `const { Story } = defineMeta(…)`, or `const meta = defineMeta(…)` and later `const { Story } = meta`
      const pattern =
        declarator.id.type === 'ObjectPattern'
          ? declarator.id
          : declarator.id.type === 'Identifier'
            ? destructuringOf(editor, declarator.id.name)
            : undefined;
      const story = pattern?.properties.find(
        (property): property is E.BindingProperty =>
          property.type === 'Property' &&
          property.key.type === 'Identifier' &&
          property.key.name === 'Story'
      );
      const argument = call.arguments[0] && unwrapExpression(call.arguments[0]);
      return {
        object: argument?.type === 'ObjectExpression' ? argument : undefined,
        storyName: story?.value.type === 'Identifier' ? story.value.name : 'Story',
      };
    }
  }
  return undefined;
};

interface StoryLevel {
  parameters: ParsedExpression;
  object: E.ObjectExpression;
  sveltekit: E.ObjectProperty;
  beforeEach?: ParsedExpression;
  mocks: LevelMocks;
}

// Migrate the `sveltekit_experimental` parameters of a Svelte CSF file, or `null` for none.
export const migrateSvelteStories = async (code: string, id: string, preview: PreviewMocks) => {
  const { parse } = await loadSvelteCompiler(id);
  const root = parse(code, { modern: true });
  const lang = isTypeScript(root.module) || isTypeScript(root.instance) ? 'ts' : 'js';
  const problems: Problem[] = [];
  const parsedRegions: Span[] = [];

  const scriptEditor = (script: SvelteScript | null) => {
    if (!script) {
      return undefined;
    }
    parsedRegions.push(script.content);
    return new SourceEditor(code.slice(script.content.start, script.content.end), `script.${lang}`);
  };
  const module = scriptEditor(root.module);
  const instance = scriptEditor(root.instance);
  const moduleStart = root.module?.content.start ?? 0;
  const toModuleFile = (index: number) => index + moduleStart;
  const meta = module && findMeta(module);

  let metaSite: ObjectSite | undefined;
  let metaMocks: LevelMocks | undefined;
  if (module && meta?.object) {
    metaSite = findObjectSite(meta.object);
    if (metaSite) {
      metaMocks = readMocks(
        module,
        metaSite.sveltekit.value,
        readContext(module, module, preview.merged)
      );
      problems.push(
        ...metaMocks.problems.map((problem) => ({ ...problem, index: toModuleFile(problem.index) }))
      );
      if (spreadsBeforeEach(meta.object) && metaMocks.ops.length > 0) {
        problems.push({ index: toModuleFile(meta.object.start), message: SPREAD_PROBLEM });
      }
    }
  }
  if (module) {
    problems.push(
      ...findUnmigrated(module.program, new Set(metaSite ? [metaSite.sveltekit] : []), toModuleFile)
    );
  }
  if (instance) {
    const instanceStart = root.instance!.content.start;
    problems.push(...findUnmigrated(instance.program, new Set(), (index) => index + instanceStart));
  }

  const outer = mergeKeys(
    metaMocks ? mergeKeys(preview.merged, metaMocks.merged) : preview.merged,
    migratedKeys(module!, meta?.object && objectProperty(meta.object, 'beforeEach')?.value)
  );
  const components = module && meta ? findComponents(root.fragment, meta.storyName) : [];
  const stories: StoryLevel[] = [];
  for (const component of components) {
    const { attributes } = component;
    const parsed = new Map<string, ParsedExpression>();
    for (const attribute of attributes) {
      const tag = attribute.type === 'Attribute' ? expressionTag(attribute) : undefined;
      if (tag && attribute.name) {
        const expression = parseExpression(code, attribute, tag, lang);
        parsed.set(attribute.name, expression);
        parsedRegions.push(tag.expression);
      }
    }
    const parameters = parsed.get('parameters');
    const object = parameters && unwrapExpression(parameters.node);
    const sveltekit = object?.type === 'ObjectExpression' ? objectProperty(object, KEY) : undefined;
    for (const expression of parsed.values()) {
      const sites = new Set<Node>(expression === parameters && sveltekit ? [sveltekit] : []);
      problems.push(...findUnmigrated(expression.editor.program, sites, expression.toFile));
    }
    if (!parameters || !sveltekit) {
      continue;
    }
    if (attributes.some((attribute) => attribute.type === 'SpreadAttribute')) {
      problems.push({
        index: component.start,
        message:
          'The `<Story>` spreads attributes, which can set `beforeEach` and `parameters` too.',
      });
      continue;
    }
    const mocks = readMocks(
      parameters.editor,
      sveltekit.value,
      readContext(parameters.editor, module!, outer)
    );
    problems.push(
      ...mocks.problems.map((problem) => ({ ...problem, index: parameters.toFile(problem.index) }))
    );
    stories.push({
      parameters,
      object: object as E.ObjectExpression,
      sveltekit,
      beforeEach: parsed.get('beforeEach'),
      mocks,
    });
  }

  const comments = [...code.matchAll(/<!--[\s\S]*?-->/g)].map((match) => ({
    start: match.index!,
    end: match.index! + match[0].length,
  }));
  for (const match of code.matchAll(new RegExp(`\\b${KEY}\\b`, 'g'))) {
    const index = match.index!;
    const within = ({ start, end }: Span) => start <= index && index < end;
    if (!parsedRegions.some(within) && !comments.some(within)) {
      problems.push({
        index,
        message: `\`${KEY}\` is outside the \`<script module>\` and the \`<Story>\` attributes, so the fix can't tell which stories use it.`,
      });
    }
  }
  if (problems.length > 0) {
    failWith(code, problems);
  }
  if (!module || !meta || (!metaSite && stories.length === 0)) {
    return null;
  }

  const levels = [...(metaMocks ? [metaMocks] : []), ...stories.map(({ mocks }) => mocks)];
  const implemented = new Set([
    ...preview.merged.functions,
    ...levels.flatMap(({ merged }) => merged.functions),
  ]);
  const kept = new Set([...implemented, ...aliasedImports(module)]);
  levels.forEach((mocks) => keepSpies(mocks, kept));
  const spies = levels.flatMap(({ spies }) => spies);
  const instanceNames = instance ? [...instance.scopes.program.bindings.keys()] : [];
  const imports = new MockImports(
    module,
    [...takenNames(module, spies), ...instanceNames],
    instanceNames
  );
  const style = styleOf(module);
  const semicolon = style.semicolons ? ';' : '';
  const metaStatements = metaMocks ? printMocks(module, metaMocks, imports.local, style) : [];
  const storyStatements = stories.map((story) =>
    printMocks(story.parameters.editor, story.mocks, imports.local, style)
  );
  const inlineFalse =
    !!meta.object &&
    components.length >= 2 &&
    [metaStatements, ...storyStatements].some((statements) => statements.length > 0) &&
    hasAutodocs(meta.object, preview.autodocs) &&
    !setsInline(meta.object);

  if (metaSite) {
    editObjectSite(module, metaSite, metaStatements, { inlineFalse, semicolon });
  } else if (inlineFalse) {
    addInlineFalseToMeta(module, meta.object!);
  }
  const scriptModule = root.module!;
  // The markup, without the parameters that the fix removes
  const blank = (text: string, { start, end }: Span) =>
    text.slice(0, start) + ' '.repeat(end - start) + text.slice(end);
  const markup = stories
    .map(({ parameters, sveltekit }) => ({
      start: parameters.toFile(sveltekit.start),
      end: parameters.toFile(sveltekit.end),
    }))
    .reduce(blank, blank(code, scriptModule));
  imports.apply(
    spies,
    metaSite ? [metaSite.sveltekit] : [],
    (name) =>
      new RegExp(`\\b${name}\\b`).test(markup) ||
      readsName([...metaStatements, ...storyStatements.flat()], name)
  );

  const splices: Splice[] = [];
  if (module.pending) {
    splices.push({ ...scriptModule.content, text: module.toString() });
  }
  stories.forEach((story, index) =>
    splices.push(
      ...editStory(code, story, storyStatements[index], { semicolon, step: style.indent })
    )
  );
  return splices
    .sort((a, b) => b.start - a.start)
    .reduce(
      (result, { start, end, text }) => result.slice(0, start) + text + result.slice(end),
      code
    );
};

const editStory = (
  code: string,
  { parameters, object, sveltekit, beforeEach }: StoryLevel,
  statements: string[],
  style: { semicolon: string; step: string }
) => {
  const splices: Splice[] = [];
  const { attribute } = parameters;
  const indent = lineIndent(code, attribute.start);
  const added = `beforeEach={${reindent(arrowFunction(statements, style.step), '', indent)}}`;
  if (statements.length > 0 && beforeEach) {
    prependToBeforeEach(beforeEach.editor, beforeEach.node, statements, style);
    // `{beforeEach}` is written without a name
    const shorthand = code[beforeEach.attribute.start] === '{';
    splices.push(
      shorthand
        ? { ...beforeEach.attribute, text: `beforeEach={${beforeEach.text()}}` }
        : { ...beforeEach.tag.expression, text: beforeEach.text() }
    );
  }
  if (object.properties.length > 1) {
    removeFromList(parameters.editor, objectList(parameters.editor, object), [sveltekit]);
    splices.push({ ...parameters.tag.expression, text: parameters.text() });
    if (statements.length > 0 && !beforeEach) {
      const before = code.slice(0, attribute.start);
      const ownLine = /\n[ \t]*$/.test(before);
      splices.push({
        start: attribute.end,
        end: attribute.end,
        text: `${ownLine ? `\n${indent}` : ' '}${added}`,
      });
    }
  } else if (statements.length > 0 && !beforeEach) {
    splices.push({ start: attribute.start, end: attribute.end, text: added });
  } else {
    const space = /\s*$/.exec(code.slice(0, attribute.start))![0].length;
    splices.push({ start: attribute.start - space, end: attribute.end, text: '' });
  }
  return splices;
};
