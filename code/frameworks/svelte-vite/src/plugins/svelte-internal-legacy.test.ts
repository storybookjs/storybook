import type { ResolvedConfig } from 'vite';
import { parseAst } from 'vite';
import { describe, expect, it, vi } from 'vitest';

import { generateVirtualModule, svelteInternalLegacy } from './svelte-internal-legacy.ts';

vi.mock('storybook/internal/node-logger', () => ({
  logger: { info: vi.fn() },
}));

type FilteredHook = {
  filter: { id: RegExp };
  handler: (this: unknown, code: string, id: string) => unknown;
};

function pluginFor(command: 'serve' | 'build' = 'serve') {
  const plugin = svelteInternalLegacy();
  (plugin.configResolved as (config: Partial<ResolvedConfig>) => void)({
    command,
    root: '/project',
  } as ResolvedConfig);
  return plugin;
}

function transform(
  code: string,
  id = '/project/src/Thing.svelte',
  command: 'serve' | 'build' = 'serve'
) {
  const { handler } = pluginFor(command).transform as FilteredHook;
  return handler.call({ parse: parseAst }, code, id) as { code: string; map: string } | null;
}

function virtualImportSource(result: { code: string }): URL {
  const match = result.code.match(/'(virtual:svelte-internal-legacy\?[^']+)'/);
  expect(match, result.code).toBeTruthy();
  return new URL(`http://x/${match![1]}`);
}

describe('svelteInternalLegacy', () => {
  it('rewrites a named import to a stub module that names the importer', async () => {
    const result = await transform(
      `import { get_current_component } from 'svelte/internal';\nexport default {};`
    );
    expect(result).toBeTruthy();
    expect(result!.code).not.toContain(`from 'svelte/internal'`);
    const source = virtualImportSource(result!);
    expect(source.searchParams.get('mode')).toBe('names');
    expect(source.searchParams.get('apis')).toBe('get_current_component');
    expect(source.searchParams.get('importer')).toBe('src/Thing.svelte');
  });

  it('rewrites default, namespace, bare and mixed imports to their matching guard modes', async () => {
    const bare = await transform(`import 'svelte/internal';`);
    expect(virtualImportSource(bare!).searchParams.get('mode')).toBe('sideeffect');

    const namespace = await transform(`import * as internal from 'svelte/internal';`);
    expect(virtualImportSource(namespace!).searchParams.get('mode')).toBe('proxy');
    expect(namespace!.code).toContain(`import { default as internal } from`);

    const mixed = await transform(
      `import internal, { get_current_component } from 'svelte/internal';`
    );
    expect(virtualImportSource(mixed!).searchParams.get('apis')).toBe(
      'default,get_current_component'
    );
    expect(mixed!.code).toContain(`import { default as internal, get_current_component } from`);
  });

  it('leaves everything that does not import exactly svelte/internal alone', async () => {
    const subpath = `import * as $ from 'svelte/internal/client';\nimport { onMount } from 'svelte';`;
    expect(await transform(subpath)).toBeNull();

    // A mention inside a comment must not be rewritten into an import
    const commented = `// import { x } from 'svelte/internal';\nexport const y = 1;`;
    expect(await transform(commented)).toBeNull();
  });

  it('stays inert in production builds, keeping the loud missing-export failure', async () => {
    const result = await transform(
      `import { get_current_component } from 'svelte/internal';`,
      '/project/src/Thing.svelte',
      'build'
    );
    expect(result).toBeNull();
  });

  it('skips non-JS virtual modules like extracted component CSS, so they load instead of failing', async () => {
    // Regression: the transform's id filter matches `Thing.svelte?...&type=style&lang.css`, and
    // parsing that CSS content as JavaScript threw, failing the module load with a 404 and killing
    // every story that shared the preview graph.
    const result = await transform(
      '.thing { color: red; }',
      '/project/src/Thing.svelte?svelte&type=style&lang.css'
    );
    expect(result).toBeNull();
  });

  it('keeps svelte/internal out of dep pre-bundling in dev', () => {
    const config: { optimizeDeps?: { exclude: string[] } } = {};
    (pluginFor().config as (config: object, env: { command: string }) => void)(config, {
      command: 'serve',
    });
    expect(config.optimizeDeps!.exclude).toContain('svelte/internal');

    const buildConfig: { optimizeDeps?: { exclude: string[] } } = {};
    (pluginFor('build').config as (config: object, env: { command: string }) => void)(buildConfig, {
      command: 'build',
    });
    expect(buildConfig.optimizeDeps).toBeUndefined();
  });
});

describe('generateVirtualModule (graph isolation regression)', () => {
  it('exports every requested API and never imports the export-less shim, so the preview graph links', () => {
    const query = new URLSearchParams({ importer: 'src/Box.svelte', mode: 'names' });
    query.set('apis', 'get_current_component,bad_thing');
    const module = generateVirtualModule(query, 'src/Box.svelte');

    for (const api of ['get_current_component', 'bad_thing']) {
      expect(module).toContain(
        `export { __sbLegacySvelteInternal${api === 'get_current_component' ? 0 : 1} as ${api} };`
      );
      expect(module).toContain(api);
    }
    // The module must not statically import anything: a link to the real, export-less
    // svelte/internal shim is what killed the whole preview graph.
    expect(module).not.toMatch(/^\s*import\s/m);
    // No top-level throw either: the module must evaluate cleanly, so the failure stays local
    // to the component that actually calls the removed API.
    expect(module).not.toMatch(/^\s*throw\s/m);
    // Every use still throws, with the importing file in the message.
    expect(module).toContain('src/Box.svelte imports');
    expect(module).toContain('no longer exists in Svelte 5');
  });

  it('throws on evaluation for bare side-effect imports and on access for namespace imports', () => {
    const sideeffect = generateVirtualModule(
      new URLSearchParams({ mode: 'sideeffect' }),
      'src/X.svelte'
    );
    expect(sideeffect).toMatch(/^throw /m);

    const proxy = generateVirtualModule(new URLSearchParams({ mode: 'proxy' }), 'src/X.svelte');
    expect(proxy).toContain('new Proxy');
    expect(proxy).toContain('export default');
  });
});
