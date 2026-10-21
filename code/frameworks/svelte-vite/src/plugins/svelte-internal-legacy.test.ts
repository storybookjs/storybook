import type { Plugin } from 'vite';
import { parseAst } from 'vite';
import { describe, expect, it, vi } from 'vitest';
import { logger } from 'storybook/internal/node-logger';

import { svelteInternalLegacy } from './svelte-internal-legacy.ts';

vi.mock('storybook/internal/node-logger', () => ({
  logger: { warn: vi.fn() },
}));

const RESOLVED_VIRTUAL_PREFIX = '\0virtual:svelte-internal-legacy';

type TransformHook = {
  handler: (
    this: { parse: typeof parseAst },
    code: string,
    id: string
  ) => { code: string; map: string } | null;
};

type LoadHook = {
  handler: (id: string) => string;
};

type ConfigHook = () => { optimizeDeps: { exclude: string[] } };

type TransformOutput = { code: string; map: string };

function plugin(): Plugin {
  const instance = svelteInternalLegacy();
  (instance.configResolved as (config: { root: string }) => void)({ root: '/project' });
  return instance;
}

function transform(code: string, id = '/project/src/Thing.svelte') {
  const { handler } = plugin().transform as unknown as TransformHook;
  return handler.call({ parse: parseAst }, code, id);
}

function virtualQuery(result: { code: string }): URLSearchParams {
  const match = result.code.match(/'virtual:svelte-internal-legacy\?([^']+)'/);
  expect(match, result.code).toBeTruthy();
  return new URLSearchParams(match![1]);
}

function loadGenerated(id: string): string {
  const { handler } = plugin().load as unknown as LoadHook;
  return handler(id);
}

function evaluateModule(code: string): { default: unknown } {
  const factory = new Function(code.replace('export default', 'return'));
  return { default: factory() };
}

// The chain a dev server runs: transform rewrote the import to a virtual id, load serves the stub
// module for that id, and the stub module is evaluated.
function stubFor(transformed: TransformOutput): unknown {
  return evaluateModule(
    loadGenerated(`${RESOLVED_VIRTUAL_PREFIX}?${virtualQuery(transformed).toString()}`)
  ).default;
}

// Evaluates the transformed module body against the evaluated stub: the rewritten virtual import
// is resolved to the stub, `export default` returns the module's value.
function evaluateTransformedModule(
  transformed: TransformOutput,
  stub: unknown,
  expression?: string
): unknown {
  const body = transformed.code
    .replace(/import (\w+) from 'virtual:svelte-internal-legacy\?[^']*';?/g, 'const $1 = stub;')
    .replace('export default', 'return');
  return new Function('stub', expression ? `${body}\nreturn (${expression});` : body)(stub);
}

// Full transform -> load -> evaluate chain for a source, returning a runner that evaluates an
// expression in the module scope of the rewritten file.
function boundBindings(source: string, id?: string): (expression: string) => unknown {
  const transformed = transform(source, id);
  expect(transformed, source).toBeTruthy();
  expect(transformed!.code).not.toMatch(/from ['"]svelte\/internal['"]/);
  const stub = stubFor(transformed!);
  return (expression: string) => evaluateTransformedModule(transformed!, stub, expression);
}

describe('svelteInternalLegacy', () => {
  it('applies only in serve mode, keeping the native missing-export failure in builds', () => {
    expect(plugin().apply).toBe('serve');
  });

  it('returns the optimizeDeps exclude from the config hook for Vite to deep-merge', () => {
    const config = (plugin().config as ConfigHook)();
    expect(config).toEqual({ optimizeDeps: { exclude: ['svelte/internal'] } });
  });

  it('binds a named import to a stub that throws naming the API and the importer', () => {
    const run = boundBindings(`import { get_current_component } from 'svelte/internal';`);
    expect(() => run('get_current_component()')).toThrowError(/get_current_component/);
    expect(() => run('get_current_component()')).toThrowError(/src\/Thing\.svelte/);
  });

  it('binds a default import to a stub that throws naming the default API', () => {
    const run = boundBindings(`import internal from 'svelte/internal';`);
    expect(() => run('internal()')).toThrowError(/'default'/);
    expect(() => run('internal()')).toThrowError(/src\/Thing\.svelte/);
  });

  it('binds a namespace import to the stub itself, which throws naming the API on use and is not callable like a namespace object', () => {
    const run = boundBindings(`import * as internal from 'svelte/internal';`);
    expect(() => run('internal.get_current_component()')).toThrowError(/get_current_component/);
    expect(() => run('internal.get_current_component()')).toThrowError(/src\/Thing\.svelte/);
    expect(() => run('internal()')).toThrow(TypeError);
  });

  it('binds an aliased import to a stub that throws naming the original API, not the alias', () => {
    const run = boundBindings(`import { get_current_component as gcc } from 'svelte/internal';`);
    expect(() => run('gcc()')).toThrowError(/get_current_component/);
    expect(() => run('gcc()')).not.toThrowError(/gcc/);
    expect(() => run('gcc()')).toThrowError(/src\/Thing\.svelte/);
  });

  it('binds a string-named import to a stub that throws naming the string API', () => {
    const run = boundBindings(`import { "a-b" as x } from 'svelte/internal';`);
    expect(() => run('x()')).toThrowError(/a-b/);
    expect(() => run('x()')).toThrowError(/src\/Thing\.svelte/);
  });

  it('rewrites every legacy import declaration in a file, each binding throwing its own API name', () => {
    const run = boundBindings(
      `import { a } from 'svelte/internal';\nconst middle = 1;\nimport { b } from 'svelte/internal';`
    );
    expect(() => run('a()')).toThrowError(/'a'/);
    expect(() => run('b()')).toThrowError(/'b'/);
    expect(() => run('a()')).not.toThrowError(/'b'/);
  });

  it('links the Svelte 4 compiled shape end to end: evaluation succeeds and instantiation throws naming SvelteComponent and the importer', () => {
    const source = [
      `import { SvelteComponent, init } from 'svelte/internal';`,
      `export default class C extends SvelteComponent {`,
      `  constructor(options) {`,
      `    super();`,
      `    init(this, options);`,
      `  }`,
      `}`,
    ].join('\n');
    const transformed = transform(source);
    const stub = stubFor(transformed!);

    const evaluate = () =>
      evaluateTransformedModule(transformed!, stub) as new (options: unknown) => unknown;
    expect(evaluate).not.toThrow();
    const Component = evaluate();

    expect(() => new Component({})).toThrowError(/SvelteComponent/);
    expect(() => new Component({})).toThrowError(/src\/Thing\.svelte/);
  });

  it('rewrites a bare side-effect import so evaluation throws naming the importer', () => {
    const transformed = transform(`import 'svelte/internal';`);
    const query = virtualQuery(transformed!);
    expect(query.get('evaluate')).toBe('1');
    expect(query.get('importer')).toBe('src/Thing.svelte');
    const evaluate = () =>
      evaluateModule(loadGenerated(`${RESOLVED_VIRTUAL_PREFIX}?${query.toString()}`));
    expect(evaluate).toThrowError(/src\/Thing\.svelte/);
    expect(evaluate).toThrowError(/the module itself/);
  });

  it('leaves modules that do not import exactly svelte/internal untouched', () => {
    const subpath = `import * as $ from 'svelte/internal/client';\nimport { onMount } from 'svelte';`;
    expect(transform(subpath)).toBeNull();

    const commented = `// import { x } from 'svelte/internal';\nexport const y = 1;`;
    expect(transform(commented)).toBeNull();
  });

  it('names a pre-bundled dependency chunk as the importer', () => {
    const result = transform(
      `import { get_current_component } from 'svelte/internal';`,
      '/project/node_modules/.vite/deps/fake-svelte4-lib.js'
    );
    expect(virtualQuery(result!).get('importer')).toBe(
      'node_modules/.vite/deps/fake-svelte4-lib.js'
    );
  });

  it('warns once per importing file, ignoring re-optimization query changes', () => {
    const instance = plugin();
    const { handler } = instance.transform as unknown as TransformHook;
    const run = (id: string) =>
      handler.call({ parse: parseAst }, `import { a } from 'svelte/internal';`, id);

    expect(vi.mocked(logger.warn)).not.toHaveBeenCalled();
    run('/project/src/A.svelte');
    run('/project/src/A.svelte?v=abc');
    expect(vi.mocked(logger.warn)).toHaveBeenCalledTimes(1);

    run('/project/src/B.svelte');
    expect(vi.mocked(logger.warn)).toHaveBeenCalledTimes(2);
  });
});

describe('generated stub module (graph isolation regression)', () => {
  it('evaluates cleanly and throws naming the importer and the accessed API when a binding is used', () => {
    const module = evaluateModule(
      loadGenerated(`${RESOLVED_VIRTUAL_PREFIX}?importer=${encodeURIComponent('src/Box.svelte')}`)
    );
    const stub = module.default as Record<string, () => unknown>;

    expect(() => stub.get_current_component()).toThrowError(/src\/Box\.svelte/);
    expect(() => stub.get_current_component()).toThrowError(/get_current_component/);
  });

  it('serves every binding from the one stub, each naming its own API', () => {
    const module = evaluateModule(
      loadGenerated(`${RESOLVED_VIRTUAL_PREFIX}?importer=${encodeURIComponent('src/Box.svelte')}`)
    );
    const stub = module.default as Record<string, () => unknown>;

    expect(() => stub.onMount()).toThrowError(/onMount/);
    expect(() => stub.beforeUpdate()).toThrowError(/beforeUpdate/);
    expect(() => stub.onMount()).not.toThrowError(/beforeUpdate/);
  });

  it('throws at evaluation naming the importer for a bare side-effect import', () => {
    const module = loadGenerated(
      `${RESOLVED_VIRTUAL_PREFIX}?importer=${encodeURIComponent('src/X.svelte')}&evaluate=1`
    );
    expect(() => evaluateModule(module)).toThrowError(/src\/X\.svelte/);
    expect(() => evaluateModule(module)).toThrowError(/the module itself/);
  });

  it('fails loudly when the importer query parameter is missing', () => {
    expect(() => loadGenerated(RESOLVED_VIRTUAL_PREFIX)).toThrowError(/importer/);
  });
});
