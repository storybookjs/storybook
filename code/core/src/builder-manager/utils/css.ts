import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

import { dirname, join } from 'pathe';
import { type AtRule, parse } from 'postcss';
import valueParser, { type FunctionNode, type Node as ValueNode } from 'postcss-value-parser';
import type { Plugin, PluginContext } from 'rolldown';

// An escape is a backslash before a character, or before the hexadecimal number of one.
const unescape = (path: string) =>
  path.replace(/\\(?:([\da-f]{1,6})\s?|(.))/gi, (_, hex, character) =>
    hex ? String.fromCodePoint(parseInt(hex, 16)) : character
  );

// A URL with a scheme, a path from the root of the site or a fragment names no file to bundle.
const isBundled = (reference: string) => !/^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(reference);

// The path that a string or the content of a `url()` names. A browser reads a path without quotes
// only when it holds no space, quote or parenthesis.
const readPath = (nodes: ValueNode[]) => {
  const isString = nodes.length === 1 && nodes[0].type === 'string';
  const text = isString ? nodes[0].value : valueParser.stringify(nodes).trim();
  return { path: unescape(text), isReadable: isString || !/(?:^|[^\\])[\s"'()]/.test(text) };
};

const isCalled = (node: ValueNode | undefined, name: string): node is FunctionNode =>
  node?.type === 'function' && node.value.toLowerCase() === name;

// The rules that stand for the conditions of an `@import`: a layer, a `supports()` and a media
// query, in that order.
const rulesOf = (conditions: ValueNode[]) => {
  const nodes = [...conditions];
  const rules: string[] = [];
  const skipSpace = () => {
    while (nodes[0]?.type === 'space') {
      nodes.shift();
    }
  };
  skipSpace();
  const [layer] = nodes;
  if (isCalled(layer, 'layer') || (layer?.type === 'word' && layer.value === 'layer')) {
    rules.push(`@layer ${layer.type === 'function' ? valueParser.stringify(layer.nodes) : ''}`);
    nodes.shift();
    skipSpace();
  }
  const [supports] = nodes;
  if (isCalled(supports, 'supports')) {
    rules.push(`@supports (${valueParser.stringify(supports.nodes)})`);
    nodes.shift();
    skipSpace();
  }
  const media = valueParser.stringify(nodes).trim();
  return media ? [...rules, `@media ${media}`] : rules;
};

// Stands between the text of two style elements. A string of JSON holds no such character.
const NEXT_STYLE_ELEMENT = '\0';

// The `url()` of an asset or the `@import` of a stylesheet, which has conditions, with its place in
// the text.
interface Reference {
  start: number;
  end: number;
  path: ValueNode[];
  conditions?: ValueNode[];
}

// The references of a stylesheet in the order of the text. A browser reads an `@import` only before
// the rules, where a `@charset` and a `@layer` without a block may precede it.
const referencesOf = (context: PluginContext, css: string, file: string) => {
  const root = (() => {
    try {
      return parse(css, { from: file });
    } catch (error) {
      return context.error(String(error));
    }
  })();
  const references: Reference[] = [];
  let isBeforeRules = true;
  root.walk((node) => {
    const start = node.source!.start!.offset;
    if (node.type === 'decl') {
      const value = node.raws.value?.raw ?? node.value;
      const valueStart = css.indexOf(value, start + node.prop.length);
      if (valueStart < 0) {
        context.error(`Could not find the value of ${node.prop} in ${file}`);
      }
      valueParser(value).walk((called) => {
        if (isCalled(called, 'url')) {
          references.push({
            start: valueStart + called.sourceIndex,
            end: valueStart + called.sourceEndIndex,
            path: called.nodes,
          });
        }
      });
    } else if (node.parent === root && node.type !== 'comment') {
      const name = node.type === 'atrule' && !node.nodes ? node.name.toLowerCase() : undefined;
      if (name === 'import' && isBeforeRules) {
        const [target, ...conditions] = valueParser((node as AtRule).params).nodes;
        const path = isCalled(target, 'url') ? target.nodes : [target];
        references.push({ start, end: node.source!.end!.offset, path, conditions });
      }
      isBeforeRules &&= name === 'charset' || name === 'import' || name === 'layer';
    }
  });
  return references;
};

// The text of each style element for a stylesheet, as a JavaScript expression, and the name of the
// import of each asset. A stylesheet that it imports takes the place of its `@import`, as in CSS.
const bundle = async (context: PluginContext, entry: string) => {
  const assets = new Map<string, string>();
  let hasStylesheet = false;

  const inline = async (
    file: string,
    importers: string[],
    isConditional: boolean
  ): Promise<string[]> => {
    // A byte order mark would become part of the first selector.
    const css = (await readFile(file, 'utf-8')).replace(/^\uFEFF/, '');

    // CSS resolves a bare path against the stylesheet; a bundler also finds it in a package.
    const resolve = async (path: string) => {
      const relative = join(dirname(file), path);
      if (existsSync(relative)) {
        return relative;
      }
      const resolved = await context.resolve(path, file);
      return resolved?.id ?? context.error(`Could not resolve ${path} in ${file}`);
    };

    const parts: string[] = [];
    let end = 0;
    for (const reference of referencesOf(context, css, file)) {
      const { start, conditions } = reference;
      const { path, isReadable } = readPath(reference.path);
      if (!path) {
        continue;
      }
      if (!isBundled(path)) {
        if (conditions && isConditional) {
          context.error(
            `${file} is imported with a condition, so its @import of ${path} cannot be bundled into the manager`
          );
        }
        // After a stylesheet, a browser reads an `@import` only at the start of a style element.
        if (conditions && hasStylesheet) {
          parts.push(JSON.stringify(css.slice(end, start)), NEXT_STYLE_ELEMENT);
          end = start;
          hasStylesheet = false;
        }
        continue;
      }
      // Left as it is, the browser would look for the file next to the page.
      if (!isReadable) {
        context.error(`Could not read ${css.slice(start, reference.end)} in ${file}`);
      }
      parts.push(JSON.stringify(css.slice(end, start)));
      end = reference.end;
      // A fragment without a query names a part of the asset, such as `sprite.svg#icon`.
      const [, pathname, fragment = ''] = /^([^?#]*)(?:\?.*|(#.*))?$/.exec(path)!;
      const resolved = await resolve(pathname);
      if (!conditions) {
        const name = assets.get(resolved) ?? `asset${assets.size}`;
        assets.set(resolved, name);
        parts.push(`'url(' + JSON.stringify(${name} + ${JSON.stringify(fragment)}) + ')'`);
      } else if (!importers.includes(resolved) && resolved !== file) {
        const rules = rulesOf(conditions);
        parts.push(
          JSON.stringify(rules.map((rule) => `${rule} {\n`).join('')),
          ...(await inline(resolved, [...importers, file], isConditional || rules.length > 0)),
          JSON.stringify('}\n'.repeat(rules.length))
        );
        hasStylesheet = true;
      }
    }
    return [...parts, JSON.stringify(css.slice(end))];
  };

  const text = (await inline(entry, [], false)).join(' + ');
  return { assets, styles: text.split(` + ${NEXT_STYLE_ELEMENT} + `) };
};

// Rolldown bundles no CSS. A stylesheet becomes a module that adds its text in style elements, and
// its assets become imports of that module, so Rolldown inlines them as it does for a script.
export const cssAsStyleElement = (): Plugin => ({
  name: 'storybook:manager-css',
  load: {
    filter: { id: /\.css$/ },
    async handler(id) {
      if (id.endsWith('.module.css')) {
        this.error('CSS modules cannot be bundled into the manager');
      }
      const { assets, styles } = await bundle(this, id);
      return {
        moduleType: 'js',
        code: [
          ...[...assets].map(([path, name]) => `import ${name} from ${JSON.stringify(path)};`),
          ...styles.map(
            (text) =>
              `document.head.append(Object.assign(document.createElement('style'), { textContent: ${text} }));`
          ),
          `export default {};`,
        ].join('\n'),
      };
    },
  },
});
