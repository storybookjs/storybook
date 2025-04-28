import { basename, relative } from 'node:path';

import type AST from 'estree';
import MagicString from 'magic-string';
import type { JSDocType, SvelteComponentDoc, SvelteDataItem } from 'sveltedoc-parser';
import type { PluginOption } from 'vite';

import { type Docgen, type Type, createDocgenCache, generateDocgen } from './generateDocgen';

/**
 * It access the AST output of _compiled_ Svelte component file. To read the name of the default
 * export - which is source of truth.
 *
 * In Svelte prior to `v4` component is a class. From `v5` is a function.
 */
function getComponentName(ast: AST.Program): string {
  // NOTE: Assertion, because rollup returns a type `AcornNode` for some reason, which doesn't overlap with `Program` from estree
  const exportDefaultDeclaration = ast.body.find((n) => n.type === 'ExportDefaultDeclaration') as
    | AST.ExportDefaultDeclaration
    | undefined;

  if (!exportDefaultDeclaration) {
    throw new Error('Unreachable - no default export found');
  }

  // NOTE: Output differs based on svelte version and dev/prod mode

  if (exportDefaultDeclaration.declaration.type === 'Identifier') {
    return exportDefaultDeclaration.declaration.name;
  }

  if (
    exportDefaultDeclaration.declaration.type !== 'ClassDeclaration' &&
    exportDefaultDeclaration.declaration.type !== 'FunctionDeclaration'
  ) {
    throw new Error('Unreachable - not a class or a function');
  }

  if (!exportDefaultDeclaration.declaration.id) {
    throw new Error('Unreachable - unnamed class/function');
  }

  return exportDefaultDeclaration.declaration.id.name;
}

function transformToSvelteDocParserType(type: Type): JSDocType {
  switch (type.type) {
    case 'string':
      return { kind: 'type', type: 'string', text: 'string' };
    case 'number':
      return { kind: 'type', type: 'number', text: 'number' };
    case 'boolean':
      return { kind: 'type', type: 'boolean', text: 'boolean' };
    case 'symbol':
      return { kind: 'type', type: 'other', text: 'symbol' };
    case 'null':
      return { kind: 'type', type: 'other', text: 'null' };
    case 'undefined':
      return { kind: 'type', type: 'other', text: 'undefined' };
    case 'void':
      return { kind: 'type', type: 'other', text: 'void' };
    case 'any':
      return { kind: 'type', type: 'any', text: 'any' };
    case 'object':
      return { kind: 'type', type: 'object', text: type.text };
    case 'array':
      return { kind: 'type', type: 'array', text: type.text };
    case 'function':
      return { kind: 'function', text: type.text };
    case 'literal':
      return { kind: 'const', type: typeof type.value, value: type.value, text: type.text };
    case 'union': {
      const nonNull = type.types.filter((t) => t.type !== 'null'); // ignore null
      const text = nonNull.map((t): string => transformToSvelteDocParserType(t).text).join(' | ');
      const types = nonNull.map((t) => transformToSvelteDocParserType(t));
      return types.length === 1 ? types[0] : { kind: 'union', type: types, text };
    }
    case 'intersection': {
      const text = type.types
        .map((t): string => transformToSvelteDocParserType(t).text)
        .join(' & ');
      return { kind: 'type', type: 'intersection', text };
    }
  }
}

/** Mimic sveltedoc-parser's props data structure */
function transformToSvelteDocParserDataItems(docgen: Docgen): SvelteDataItem[] {
  return docgen.props.map((p) => {
    const required = p.optional === false && p.defaultValue === undefined;
    return {
      name: p.name,
      visibility: 'public',
      description: p.description,
      keywords: required ? [{ name: 'required', description: '' }] : [],
      kind: 'let',
      type: p.type ? transformToSvelteDocParserType(p.type) : undefined,
      static: false,
      readonly: false,
      importPath: undefined,
      originalName: undefined,
      localName: undefined,
      defaultValue: p.defaultValue ? p.defaultValue.text : undefined,
    } satisfies SvelteDataItem;
  });
}

export async function svelteDocgen(): Promise<PluginOption> {
  const cwd = process.cwd();
  const include = /\.svelte$/;
  const exclude = /node_modules\/.*/;
  const { createFilter } = await import('vite');

  const filter = createFilter(include, exclude);
  const sourceFileCache = createDocgenCache();

  return {
    name: 'storybook:svelte-docgen-plugin',
    async transform(src: string, id: string) {
      if (id.startsWith('\0') || !filter(id)) {
        return undefined;
      }

      const resource = relative(cwd, id);

      // Get props information
      const docgen = generateDocgen(resource, sourceFileCache);
      const data = transformToSvelteDocParserDataItems(docgen);

      const componentDoc: SvelteComponentDoc & { keywords?: string[] } = {
        data: data,
        name: basename(resource),
      };

      const s = new MagicString(src);
      const outputAst = this.parse(src);
      const componentName = getComponentName(outputAst as unknown as AST.Program);
      s.append(`\n;${componentName}.__docgen = ${JSON.stringify(componentDoc)}`);

      return {
        code: s.toString(),
        map: s.generateMap({ hires: true, source: id }),
      };
    },
  };
}
