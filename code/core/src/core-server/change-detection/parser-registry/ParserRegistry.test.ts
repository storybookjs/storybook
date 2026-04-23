import { beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from 'storybook/internal/node-logger';

import { ParserRegistry } from './ParserRegistry.ts';
import { builtinImportParsers } from './builtins.ts';
import type { ImportParser } from './types.ts';

vi.mock('storybook/internal/node-logger', { spy: true });

describe('ParserRegistry', () => {
  beforeEach(() => {
    vi.mocked(logger.debug).mockImplementation(() => undefined);
  });

  it('registers default parsers and looks them up by extension', () => {
    const registry = new ParserRegistry({
      defaultParsers: builtinImportParsers,
      pluginParsers: [],
    });

    expect(registry.parserFor('/tmp/a.ts')).toBeDefined();
    expect(registry.parserFor('/tmp/a.tsx')).toBeDefined();
    expect(registry.parserFor('/tmp/a.mdx')).toBeDefined();
  });

  it('lets a plugin parser override a default parser and logs a debug line', () => {
    const pluginParse = vi.fn(async () => []);
    const plugin: ImportParser = {
      extensions: ['.ts'],
      parse: pluginParse,
    };

    const registry = new ParserRegistry({
      defaultParsers: builtinImportParsers,
      pluginParsers: [plugin],
    });

    expect(registry.parserFor('/tmp/a.ts')).toBe(pluginParse);
    expect(vi.mocked(logger.debug)).toHaveBeenCalledWith(
      expect.stringContaining('.ts parser overridden')
    );
  });

  it('returns undefined from parserFor for an unknown extension', () => {
    const registry = new ParserRegistry({
      defaultParsers: builtinImportParsers,
      pluginParsers: [],
    });

    expect(registry.parserFor('/tmp/a.unknown')).toBeUndefined();
  });

  it('returns null from parse for an unknown extension (not empty array, not throw)', async () => {
    const registry = new ParserRegistry({
      defaultParsers: builtinImportParsers,
      pluginParsers: [],
    });

    await expect(registry.parse('/tmp/a.unknown', 'anything')).resolves.toBeNull();
  });

  it('matches extensions case-insensitively (.TSX matches a .tsx plugin)', () => {
    const plugin: ImportParser = {
      extensions: ['.tsx'],
      parse: vi.fn(async () => []),
    };
    const registry = new ParserRegistry({
      defaultParsers: [],
      pluginParsers: [plugin],
    });

    expect(registry.parserFor('/tmp/COMP.TSX')).toBe(plugin.parse);
  });

  it('lowercases the extensions a plugin registers so subsequent lookups match', () => {
    const plugin: ImportParser = {
      extensions: ['.FOO'],
      parse: vi.fn(async () => []),
    };
    const registry = new ParserRegistry({
      defaultParsers: [],
      pluginParsers: [plugin],
    });

    expect(registry.parserFor('/tmp/a.foo')).toBe(plugin.parse);
    expect(registry.walkableExtensions().has('.foo')).toBe(true);
  });

  it('walkableExtensions returns the union of every registered extension', () => {
    const plugin: ImportParser = {
      extensions: ['.vue'],
      parse: vi.fn(async () => []),
    };
    const registry = new ParserRegistry({
      defaultParsers: builtinImportParsers,
      pluginParsers: [plugin],
    });

    const exts = registry.walkableExtensions();
    expect(exts.has('.ts')).toBe(true);
    expect(exts.has('.tsx')).toBe(true);
    expect(exts.has('.js')).toBe(true);
    expect(exts.has('.jsx')).toBe(true);
    expect(exts.has('.mjs')).toBe(true);
    expect(exts.has('.cjs')).toBe(true);
    expect(exts.has('.mdx')).toBe(true);
    expect(exts.has('.vue')).toBe(true);
  });

  it('exposes parseScriptWithOxc to plugins via the context, returning import edges', async () => {
    let observedEdges: unknown;
    const sfcPlugin: ImportParser = {
      extensions: ['.sfc'],
      async parse(_args, ctx) {
        observedEdges = await ctx.parseScriptWithOxc(
          `import x from 'y'; export { a } from 'b';`,
          '/tmp/virtual.ts'
        );
        return observedEdges as { specifier: string; kind: 'static' | 'dynamic' | 'require' }[];
      },
    };
    const registry = new ParserRegistry({
      defaultParsers: [],
      pluginParsers: [sfcPlugin],
    });

    const edges = await registry.parse('/tmp/component.sfc', 'ignored-by-plugin');

    expect(edges).toEqual([
      { specifier: 'y', kind: 'static' },
      { specifier: 'b', kind: 'static' },
    ]);
    expect(observedEdges).toEqual(edges);
  });

  it('dispatches a known extension to the registered parser and returns its edges', async () => {
    const pluginParse = vi.fn(async () => [{ specifier: 'foo', kind: 'static' as const }]);
    const plugin: ImportParser = {
      extensions: ['.foo'],
      parse: pluginParse,
    };
    const registry = new ParserRegistry({
      defaultParsers: [],
      pluginParsers: [plugin],
    });

    const edges = await registry.parse('/tmp/a.foo', 'some source');

    expect(edges).toEqual([{ specifier: 'foo', kind: 'static' }]);
    expect(pluginParse).toHaveBeenCalledWith(
      { filePath: '/tmp/a.foo', source: 'some source' },
      expect.objectContaining({ parseScriptWithOxc: expect.any(Function) })
    );
  });
});
