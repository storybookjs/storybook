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

describe('svelteInternalLegacy', () => {
  it('applies only in serve mode, keeping the native missing-export failure in builds', () => {
    expect(plugin().apply).toBe('serve');
  });

  it('keeps svelte/internal out of dep pre-bundling', () => {
    const config: { optimizeDeps?: { exclude: string[] } } = {};
    (plugin().config as (config: object) => void)(config);
    expect(config.optimizeDeps!.exclude).toContain('svelte/internal');
  });

  it('rewrites a named import to the shared stub module and destructures the binding', () => {
    const result = transform(
      `import { get_current_component } from 'svelte/internal';\nexport default {};`
    );
    expect(result!.code).toMatch(
      /import __sbSvelteInternalLegacy0 from 'virtual:svelte-internal-legacy\?/
    );
    expect(result!.code).toContain(
      `const { "get_current_component": get_current_component } = __sbSvelteInternalLegacy0;`
    );
    expect(result!.code).not.toMatch(/from ['"]svelte\/internal/);
    expect(virtualQuery(result!).get('importer')).toBe('src/Thing.svelte');
  });

  it('rewrites default, namespace, aliased and string-named specifiers as bindings on the stub', () => {
    const defaultImport = transform(`import internal from 'svelte/internal';`);
    expect(defaultImport!.code).toContain(
      `const { "default": internal } = __sbSvelteInternalLegacy0;`
    );

    const namespace = transform(`import * as internal from 'svelte/internal';`);
    expect(namespace!.code).toContain(`const internal = __sbSvelteInternalLegacy0;`);

    const aliased = transform(`import { get_current_component as gcc } from 'svelte/internal';`);
    expect(aliased!.code).toContain(
      `const { "get_current_component": gcc } = __sbSvelteInternalLegacy0;`
    );

    const stringNamed = transform(`import { "a-b" as x } from 'svelte/internal';`);
    expect(stringNamed!.code).toContain(`const { "a-b": x } = __sbSvelteInternalLegacy0;`);
  });

  it('uses one stub binding per import declaration when a file has several legacy imports', () => {
    const result = transform(
      `import { a } from 'svelte/internal';\nexport const x = 1;\nimport { b } from 'svelte/internal';`
    );
    expect(result!.code).toContain(`import __sbSvelteInternalLegacy0 from`);
    expect(result!.code).toContain(`import __sbSvelteInternalLegacy1 from`);
    expect(result!.code).not.toContain(`const { "b": b } = __sbSvelteInternalLegacy0;`);
  });

  it('leaves modules that do not import exactly svelte/internal untouched', () => {
    const subpath = `import * as $ from 'svelte/internal/client';\nimport { onMount } from 'svelte';`;
    expect(transform(subpath)).toBeNull();

    const commented = `// import { x } from 'svelte/internal';\nexport const y = 1;`;
    expect(transform(commented)).toBeNull();
  });

  it('reaches pre-bundled dependencies and names their file as the importer', () => {
    const result = transform(
      `import { get_current_component } from 'svelte/internal';`,
      '/project/node_modules/.vite/deps/fake-svelte4-lib.js'
    );
    expect(virtualQuery(result!).get('importer')).toBe(
      'node_modules/.vite/deps/fake-svelte4-lib.js'
    );
  });

  it('warns once per importing file', () => {
    const instance = plugin();
    const { handler } = instance.transform as unknown as TransformHook;
    const run = () =>
      handler.call(
        { parse: parseAst },
        `import { a } from 'svelte/internal';`,
        '/project/src/A.svelte'
      );

    expect(vi.mocked(logger.warn)).not.toHaveBeenCalled();
    run();
    run();
    expect(vi.mocked(logger.warn)).toHaveBeenCalledTimes(1);

    handler.call(
      { parse: parseAst },
      `import { a } from 'svelte/internal';`,
      '/project/src/B.svelte'
    );
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
