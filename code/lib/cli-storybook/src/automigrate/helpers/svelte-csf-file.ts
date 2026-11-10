import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

import { HandledError } from 'storybook/internal/common';
import { isValidPreviewPath } from 'storybook/internal/csf';
import {
  type ESTree as E,
  type ESTreeNode as Node,
  SourceEditor,
  lineIndent,
  reindent,
  unwrapExpression,
} from 'storybook/internal/csf-tools';

import { resolve } from 'pathe';

// Where `defineMeta` comes from: the frameworks, the renderer, and the addon before Storybook 11
const DEFINE_META_SOURCES = [
  '@storybook/addon-svelte-csf',
  '@storybook/svelte',
  '@storybook/svelte-vite',
  '@storybook/sveltekit',
];

interface Span {
  start: number;
  end: number;
}

// The parts of Svelte's modern AST that this module reads
interface ExpressionTag extends Span {
  type: 'ExpressionTag';
  expression: Span & { type: string; value?: unknown };
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

const span = ({ start, end }: Span): Span => ({ start, end });

// JavaScript in a Svelte file, parsed on its own: a script, or an attribute's expression
export interface ParsedRegion {
  editor: SourceEditor;
  // Maps an offset in `editor.code` to one in the file
  toFile: (index: number) => number;
}

// A `<Story>` attribute whose value is one expression. An expression that the methods add is
// written at indent 0, and its later lines get the indent of the attribute's line
export interface StoryAttribute extends ParsedRegion {
  node: Node;
  remove(): void;
  replaceWith(name: string, expression: string): void;
  // On a line of its own when this attribute starts one
  insertAfter(name: string, expression: string): void;
}

export interface SvelteCsfStory {
  start: number;
  name?: string;
  // The names of the stories it extends, the nearest first
  ancestors: string[];
  attributes: Map<string, StoryAttribute>;
  // Spread attributes can set any of the others
  spreads: boolean;
}

// A Svelte CSF file, parsed with the project's own `svelte/compiler`. `toString()` puts back the
// edits of the regions and the attributes, and keeps the rest of the file as written
export interface SvelteCsfFile {
  module?: ParsedRegion;
  instance?: ParsedRegion;
  // `defineMeta({…})` or `preview.meta({…})`
  meta?: { object?: E.ObjectExpression };
  stories: SvelteCsfStory[];
  // Where a global `pattern` matches outside the parsed code and the HTML comments
  unparsed(pattern: RegExp): number[];
  // The file with its edits, without the content of `<script module>`
  markup(): string;
  toString(): string;
}

// The project's own Svelte, which `storybook upgrade` does not change
const loadSvelteCompiler = async (file: string): Promise<SvelteCompiler> => {
  let path: string;
  try {
    path = createRequire(resolve(file)).resolve('svelte/compiler');
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

// The text of an attribute such as `name="Primary"` or `name={'Primary'}`
const textAttribute = (component: SvelteComponent, name: string) => {
  const attribute = component.attributes.find((candidate) => candidate.name === name);
  const { value } = attribute ?? {};
  if (Array.isArray(value) && value.length === 1 && value[0].type === 'Text') {
    return value[0].data;
  }
  const expression = attribute && expressionTag(attribute)?.expression;
  return expression?.type === 'Literal' && typeof expression.value === 'string'
    ? expression.value
    : undefined;
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
            DEFINE_META_SOURCES.includes(declaration.source.value) &&
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
          (declaration, specifier) =>
            specifier.type === 'ImportDefaultSpecifier' &&
            isValidPreviewPath(declaration.source.value)
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

// A part that the file doesn't have, or that can't be read statically, is `undefined`
export const loadSvelteCsf = async (code: string, id: string): Promise<SvelteCsfFile> => {
  const { parse } = await loadSvelteCompiler(id);
  const root = parse(code, { modern: true });
  const lang = isTypeScript(root.module) || isTypeScript(root.instance) ? 'ts' : 'js';

  // The parsed code, with where its edits go back into the file
  const regions: {
    span: Span;
    editor: SourceEditor;
    attribute?: SvelteAttribute;
    print(): string;
  }[] = [];
  const parsedSpans: Span[] = [];
  const splices: Splice[] = [];
  // Attributes that a splice replaces as a whole, so their own edits don't go back in
  const replaced = new Set<SvelteAttribute>();

  const script = (node: SvelteScript | null): ParsedRegion | undefined => {
    if (!node) {
      return undefined;
    }
    const { start, end } = node.content;
    const editor = new SourceEditor(code.slice(start, end), `script.${lang}`);
    regions.push({ span: node.content, editor, print: () => editor.toString() });
    parsedSpans.push(node.content);
    return { editor, toFile: (index) => index + start };
  };

  const expression = (attribute: SvelteAttribute, tag: ExpressionTag): StoryAttribute => {
    // Indented like its line in the file, so moved code keeps its relative indent. The right side of
    // an assignment, so no parentheses wrap the expression
    const prefix = `${lineIndent(code, tag.expression.start)}_ = `;
    const suffix = '\n;';
    const source = code.slice(tag.expression.start, tag.expression.end);
    const editor = new SourceEditor(`${prefix}${source}${suffix}`, `attribute.${lang}`);
    const statement = editor.program.body[0] as E.ExpressionStatement;
    const text = () => editor.toString().slice(prefix.length, -suffix.length);
    // `{beforeEach}` is written without a name
    const shorthand = code[attribute.start] === '{';
    regions.push({
      span: shorthand ? attribute : tag.expression,
      editor,
      attribute,
      print: () => (shorthand ? `${attribute.name}={${text()}}` : text()),
    });
    parsedSpans.push(tag.expression);
    const printed = (name: string, expression: string) =>
      `${name}={${reindent(expression, '', lineIndent(code, attribute.start))}}`;
    return {
      editor,
      node: (statement.expression as E.AssignmentExpression).right,
      toFile: (index) => index - prefix.length + tag.expression.start,
      remove() {
        replaced.add(attribute);
        const space = /\s*$/.exec(code.slice(0, attribute.start))![0].length;
        splices.push({ start: attribute.start - space, end: attribute.end, text: '' });
      },
      replaceWith(name, expression) {
        replaced.add(attribute);
        splices.push({ ...span(attribute), text: printed(name, expression) });
      },
      insertAfter(name, expression) {
        const ownLine = /\n[ \t]*$/.test(code.slice(0, attribute.start));
        const before = ownLine ? `\n${lineIndent(code, attribute.start)}` : ' ';
        splices.push({
          start: attribute.end,
          end: attribute.end,
          text: before + printed(name, expression),
        });
      },
    };
  };

  const story = (component: SvelteComponent): SvelteCsfStory => {
    const attributes = new Map<string, StoryAttribute>();
    for (const attribute of component.attributes) {
      const tag = attribute.type === 'Attribute' ? expressionTag(attribute) : undefined;
      if (tag && attribute.name) {
        attributes.set(attribute.name, expression(attribute, tag));
      }
    }
    return {
      start: component.start,
      name: textAttribute(component, 'name'),
      ancestors: [],
      attributes,
      spreads: component.attributes.some((attribute) => attribute.type === 'SpreadAttribute'),
    };
  };

  const module = script(root.module);
  const instance = script(root.instance);
  const meta = module && findMeta(module.editor);
  const components = meta ? findComponents(root.fragment, meta.storyName) : [];
  const stories = components.map(story);
  const parents = new Map<string, string>();
  const extended = components.map((component) => textAttribute(component, 'extend'));
  stories.forEach(({ name }, index) => {
    if (name && extended[index]) {
      parents.set(name, extended[index]);
    }
  });
  // A cycle, which the renderer rejects, stops at the story itself
  for (const [index, { name, ancestors }] of stories.entries()) {
    for (
      let parent = extended[index];
      parent && parent !== name && !ancestors.includes(parent);
      parent = parents.get(parent)
    ) {
      ancestors.push(parent);
    }
  }

  const print = (withModule: boolean) => {
    const all = [...splices];
    for (const region of regions) {
      if (region.span === root.module?.content && !withModule) {
        all.push({ ...span(region.span), text: '' });
      } else if (region.editor.pending && !(region.attribute && replaced.has(region.attribute))) {
        all.push({ ...span(region.span), text: region.print() });
      }
    }
    // From the end, so earlier offsets stay right; a removal before an insertion at the same offset
    return all
      .sort((a, b) => b.start - a.start || b.end - a.end)
      .reduce(
        (result, { start, end, text }) => result.slice(0, start) + text + result.slice(end),
        code
      );
  };

  return {
    module,
    instance,
    meta: meta && { object: meta.object },
    stories,
    unparsed(pattern) {
      const comments = [...code.matchAll(/<!--[\s\S]*?-->/g)].map((match) => ({
        start: match.index!,
        end: match.index! + match[0].length,
      }));
      const skipped = [...parsedSpans, ...comments];
      return [...code.matchAll(pattern)]
        .map((match) => match.index!)
        .filter((index) => !skipped.some(({ start, end }) => start <= index && index < end));
    },
    markup: () => print(false),
    toString: () => print(true),
  };
};
