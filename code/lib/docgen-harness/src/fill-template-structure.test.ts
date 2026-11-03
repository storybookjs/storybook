import { readFileSync, readdirSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { type ESTreeNode as Node, parseModule, walk } from 'storybook/internal/csf-tools';

import { join, relative } from 'pathe';

// The rules of SB-2250 that a reviewer cannot be trusted to keep: the browser only fills holes, and
// it prints each value with the module the server prints the static snippet with.

const code = join(import.meta.dirname, '../../..');

const FRAMEWORKS = [
  {
    name: 'react',
    filler: 'renderers/react/src/docs/fill-template.ts',
    values: 'renderers/react/src/snippet-values.ts',
    server: 'renderers/react/src/componentManifest',
    runtime: [],
  },
  {
    name: 'vue3',
    filler: 'renderers/vue3/src/docs/fill-template.ts',
    values: 'renderers/vue3/src/snippet-values.ts',
    server: 'renderers/vue3/src/docgen',
    runtime: ['vue'],
  },
  {
    name: 'svelte',
    filler: 'renderers/svelte/src/docs/fill-template.ts',
    values: 'renderers/svelte/src/snippet-values.ts',
    server: 'renderers/svelte/src/docgen',
    runtime: [],
  },
  {
    name: 'web-components',
    filler: 'renderers/web-components/src/docs/fill-template.ts',
    values: 'renderers/web-components/src/snippet-values.ts',
    server: 'renderers/web-components/src/docgen',
    runtime: [],
  },
  {
    name: 'angular-vite',
    filler: 'frameworks/angular-vite/src/client/docs/fill-template.ts',
    values: 'frameworks/angular-vite/src/snippet-values.ts',
    server: 'frameworks/angular-vite/src/docgen',
    runtime: [],
  },
];

const BROWSER_SAFE = ['storybook/internal/docs-tools', 'storybook/internal/types'];

const read = (file: string) => readFileSync(join(code, file), 'utf8');

const imports = (file: string) => {
  const { program } = parseModule(read(file), file);
  return program.body.flatMap((statement) =>
    statement.type === 'ImportDeclaration'
      ? [
          {
            source: statement.source.value,
            names: statement.specifiers.flatMap((specifier) =>
              specifier.type === 'ImportSpecifier' && specifier.importKind !== 'type'
                ? [specifier.local.name]
                : []
            ),
          },
        ]
      : []
  );
};

const resolves = (from: string, source: string, to: string) =>
  source.startsWith('.') && relative(code, join(code, from, '..', source)) === to;

const serverFiles = (dir: string): string[] =>
  readdirSync(join(code, dir), { recursive: true, encoding: 'utf8' })
    .filter((file) => /\.ts$/.test(file) && !/\.test(-d|-helpers)?\.ts$/.test(file))
    .map((file) => join(dir, file));

// A comparison with a length is a layout threshold, which only the server may apply.
const layoutThresholds = (file: string) => {
  const { program, code: source } = parseModule(read(file), file);
  const found: string[] = [];
  walk(program, (node) => {
    if (
      node.type === 'BinaryExpression' &&
      ['<', '<=', '>', '>='].includes(node.operator) &&
      /length/i.test(source.slice(node.start, node.end))
    ) {
      found.push(source.slice(node.start, node.end));
    }
  });
  return found;
};

describe.each(FRAMEWORKS)('the $name filler', ({ filler, values, server, runtime }) => {
  it('fills holes from fillHoles alone, and never reads the template around them', () => {
    const { program } = parseModule(read(filler), filler);
    const declaration = program.body.find(
      (statement) =>
        statement.type === 'ExportNamedDeclaration' &&
        statement.declaration?.type === 'VariableDeclaration' &&
        statement.declaration.declarations[0]?.id.type === 'Identifier' &&
        statement.declaration.declarations[0].id.name === 'fillTemplate'
    );
    const init =
      declaration?.type === 'ExportNamedDeclaration' &&
      declaration.declaration?.type === 'VariableDeclaration'
        ? declaration.declaration.declarations[0]?.init
        : undefined;
    expect(init?.type).toBe('ArrowFunctionExpression');
    if (init?.type !== 'ArrowFunctionExpression') {
      return;
    }
    const [template] = init.params;
    expect(template?.type).toBe('Identifier');
    const name = template?.type === 'Identifier' ? template.name : '';
    const body = init.body as Node;
    expect(body.type === 'CallExpression' && body.callee.type === 'Identifier').toBe(true);
    if (body.type !== 'CallExpression' || body.callee.type !== 'Identifier') {
      return;
    }
    expect(body.callee.name).toBe('fillHoles');
    const [first] = body.arguments;
    expect(first?.type === 'Identifier' && first.name).toBe(name);

    let reads = 0;
    walk(program, (node) => {
      if (node.type === 'Identifier' && node.name === name && node !== template) {
        reads++;
      }
    });
    expect(reads, `\`${name}\` is read only to pass it to fillHoles`).toBe(1);
  });

  it('imports nothing but the hole contract, its value printers and its runtime', () => {
    for (const { source } of imports(filler)) {
      expect(
        BROWSER_SAFE.includes(source) || runtime.includes(source) || resolves(filler, source, values),
        source
      ).toBe(true);
    }
  });

  it('prints values with the module the server prints the static snippet with', () => {
    const fromValues = imports(filler)
      .filter(({ source }) => resolves(filler, source, values))
      .flatMap(({ names }) => names);
    expect(fromValues.length, 'the filler imports value printers').toBeGreaterThan(0);

    const serverNames = new Set(
      serverFiles(server).flatMap((file) =>
        imports(file)
          .filter(({ source }) => resolves(file, source, values))
          .flatMap(({ names }) => names)
      )
    );
    for (const imported of fromValues) {
      expect(serverNames.has(imported), `the server prints with \`${imported}\` too`).toBe(true);
    }
  });

  it('keeps the value printers safe for the browser', () => {
    for (const { source } of imports(values)) {
      expect(BROWSER_SAFE.includes(source) || source.startsWith('.'), source).toBe(true);
    }
  });

  it('applies no layout threshold in the filler or its value printers', () => {
    for (const file of [filler, values]) {
      expect(layoutThresholds(file), file).toEqual([]);
    }
  });
});
