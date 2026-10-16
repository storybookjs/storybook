import { describe, expect, it } from 'vitest';

import { serverCodeEliminationPlugin } from './server-code-elimination.ts';

type TransformResult = { code: string; map?: unknown } | null;

async function transform(
  code: string,
  id = '/project/src/file.ts',
  options?: { excludeFiles?: string[] }
): Promise<TransformResult> {
  const plugin = serverCodeEliminationPlugin(options);
  const transformOpt = plugin.transform as any;
  const handler = typeof transformOpt === 'function' ? transformOpt : transformOpt.handler;
  // Handler is called with a Rollup PluginContext; the plugin doesn't use `this`.
  return (await handler.call({}, code, id)) as TransformResult;
}

describe('serverCodeEliminationPlugin', () => {
  describe('skipping (returns null)', () => {
    it('skips non-JS/TS file extensions', async () => {
      const code = `import { createServerFn } from '@tanstack/react-start';\ncreateServerFn().handler(() => 1);`;
      const result = await transform(code, '/project/src/file.css');
      expect(result).toBeNull();
    });

    it('skips files matching excludeFiles', async () => {
      const code = `import { createServerFn } from '@tanstack/react-start';\ncreateServerFn().handler(() => 1);`;
      const result = await transform(code, '/project/src/export-mocks/start.ts', {
        excludeFiles: ['export-mocks'],
      });
      expect(result).toBeNull();
    });

    it('skips files that do not match any tanstack pattern', async () => {
      const code = `export const x = 1;\nconst y = () => x + 1;`;
      const result = await transform(code);
      expect(result).toBeNull();
    });

    it('returns null when nothing actually gets transformed', async () => {
      // contains a string that happens to match the regex but no real calls
      const code = `const s = "createServerFn was here";`;
      const result = await transform(code);
      expect(result).toBeNull();
    });
  });

  describe('createServerOnlyFn', () => {
    it('replaces createServerOnlyFn(fn) with a no-op spy', async () => {
      const code = [
        `import { createServerOnlyFn } from '@tanstack/react-start';`,
        `export const f = createServerOnlyFn(() => 42);`,
      ].join('\n');
      const result = await transform(code);
      expect(result).not.toBeNull();
      expect(result!.code).toContain(`import { fn as __sb_fn } from "storybook/test"`);
      expect(result!.code).toContain('__sb_fn()');
      expect(result!.code).not.toContain('createServerOnlyFn');
    });
  });

  describe('createClientOnlyFn', () => {
    it('wraps original impl in a spy', async () => {
      const code = [
        `import { createClientOnlyFn } from '@tanstack/react-start';`,
        `export const f = createClientOnlyFn((x) => x + 1);`,
      ].join('\n');
      const result = await transform(code);
      expect(result).not.toBeNull();
      expect(result!.code).toMatch(/__sb_fn\(\s*\(?x\)?\s*=>\s*x\s*\+\s*1\s*\)/);
      expect(result!.code).not.toContain('createClientOnlyFn');
    });
  });

  describe('createServerFn().handler()', () => {
    it('replaces inline handler argument with no-op spy', async () => {
      const code = [
        `import { createServerFn } from '@tanstack/react-start';`,
        `export const f = createServerFn().handler(async () => ({ ok: true }));`,
      ].join('\n');
      const result = await transform(code);
      expect(result).not.toBeNull();
      expect(result!.code).toContain('__sb_fn()');
      expect(result!.code).not.toMatch(/async\s*\(\)\s*=>\s*\(\{\s*ok:\s*true/);
    });

    it('removes the dead binding when handler arg is an identifier referenced once', async () => {
      const code = [
        `import { createServerFn } from '@tanstack/react-start';`,
        `const handler = async () => ({ ok: true });`,
        `export const f = createServerFn().handler(handler);`,
      ].join('\n');
      const result = await transform(code);
      expect(result).not.toBeNull();
      expect(result!.code).toContain('__sb_fn()');
      expect(result!.code).not.toContain('const handler');
    });

    it('handles chained .middleware().handler()', async () => {
      const code = [
        `import { createServerFn } from '@tanstack/react-start';`,
        `const mw = {};`,
        `export const f = createServerFn().middleware([mw]).handler(() => 1);`,
      ].join('\n');
      const result = await transform(code);
      expect(result).not.toBeNull();
      expect(result!.code).toContain('__sb_fn()');
    });
  });

  describe('createMiddleware()', () => {
    it('strips .server(fn) from the chain', async () => {
      const code = [
        `import { createMiddleware } from '@tanstack/react-start';`,
        `export const m = createMiddleware().server(async () => { secret(); });`,
      ].join('\n');
      const result = await transform(code);
      expect(result).not.toBeNull();
      expect(result!.code).not.toContain('.server(');
      expect(result!.code).not.toContain('secret()');
      expect(result!.code).toContain('createMiddleware()');
    });

    it('strips .inputValidator(fn) from the chain', async () => {
      const code = [
        `import { createMiddleware } from '@tanstack/react-start';`,
        `export const m = createMiddleware().inputValidator((v) => v);`,
      ].join('\n');
      const result = await transform(code);
      expect(result).not.toBeNull();
      expect(result!.code).not.toContain('.inputValidator(');
    });
  });

  describe('createIsomorphicFn()', () => {
    it('wraps .client(fn) with a spy carrying the original impl', async () => {
      const code = [
        `import { createIsomorphicFn } from '@tanstack/react-start';`,
        `export const f = createIsomorphicFn().server(() => 's').client(() => 'c');`,
      ].join('\n');
      const result = await transform(code);
      expect(result).not.toBeNull();
      expect(result!.code).toMatch(/__sb_fn\(\s*\(\)\s*=>\s*['"]c['"]\s*\)/);
    });

    it('replaces .server(fn) with no-op spy when no .client follows', async () => {
      const code = [
        `import { createIsomorphicFn } from '@tanstack/react-start';`,
        `export const f = createIsomorphicFn().server(() => 's');`,
      ].join('\n');
      const result = await transform(code);
      expect(result).not.toBeNull();
      expect(result!.code).toContain('__sb_fn()');
      expect(result!.code).not.toMatch(/['"]s['"]/);
    });
  });

  describe('route factories', () => {
    it('strips the server property from createFileRoute options', async () => {
      const code = [
        `import { createFileRoute } from '@tanstack/react-router';`,
        `export const Route = createFileRoute('/users')({`,
        `  component: Comp,`,
        `  server: { handler: async () => ({}) },`,
        `});`,
        `function Comp() { return null; }`,
      ].join('\n');
      const result = await transform(code);
      expect(result).not.toBeNull();
      expect(result!.code).not.toMatch(/\bserver:\s*\{/);
      expect(result!.code).toContain('component: Comp');
    });

    it('strips server from createRootRoute', async () => {
      const code = [
        `import { createRootRoute } from '@tanstack/react-router';`,
        `export const Route = createRootRoute({ component: C, server: { handler: () => 1 } });`,
        `function C() { return null; }`,
      ].join('\n');
      const result = await transform(code);
      expect(result).not.toBeNull();
      expect(result!.code).not.toMatch(/\bserver:\s*\{/);
    });

    it('strips server from createRootRouteWithContext curried call', async () => {
      const code = [
        `import { createRootRouteWithContext } from '@tanstack/react-router';`,
        `export const Route = createRootRouteWithContext()({ component: C, server: {} });`,
        `function C() { return null; }`,
      ].join('\n');
      const result = await transform(code);
      expect(result).not.toBeNull();
      expect(result!.code).not.toMatch(/\bserver:\s*\{/);
    });

    it('strips server from createRoute', async () => {
      const code = [
        `import { createRoute } from '@tanstack/react-router';`,
        `export const Route = createRoute({ component: C, server: { handler: () => 1 } });`,
        `function C() { return null; }`,
      ].join('\n');
      const result = await transform(code);
      expect(result).not.toBeNull();
      expect(result!.code).not.toMatch(/\bserver:\s*\{/);
    });

    it('does not strip computed `server` property', async () => {
      const code = [
        `import { createRoute } from '@tanstack/react-router';`,
        `const k = 'server';`,
        `export const Route = createRoute({ [k]: { handler: () => 1 }, component: C });`,
        `function C() { return null; }`,
      ].join('\n');
      const result = await transform(code);
      // Should be null because no transformation occurred for the computed prop
      // and createRoute itself wasn't changed.
      expect(result).toBeNull();
    });
  });

  describe('aliased imports', () => {
    it('handles `import { createServerFn as csf }`', async () => {
      const code = [
        `import { createServerFn as csf } from '@tanstack/react-start';`,
        `export const f = csf().handler(() => 1);`,
      ].join('\n');
      const result = await transform(code);
      expect(result).not.toBeNull();
      expect(result!.code).toContain('__sb_fn()');
    });

    it('handles aliased createServerOnlyFn', async () => {
      const code = [
        `import { createServerOnlyFn as sOnly } from '@tanstack/react-start';`,
        `export const f = sOnly(() => 1);`,
      ].join('\n');
      const result = await transform(code);
      expect(result).not.toBeNull();
      expect(result!.code).toContain('__sb_fn()');
    });
  });

  describe('dead import elimination', () => {
    it('removes unused tanstack imports after transform', async () => {
      const code = [
        `import { createServerOnlyFn } from '@tanstack/react-start';`,
        `export const f = createServerOnlyFn(() => 1);`,
      ].join('\n');
      const result = await transform(code);
      expect(result).not.toBeNull();
      expect(result!.code).not.toContain('@tanstack/react-start');
    });

    it('preserves side-effect-only imports', async () => {
      const code = [
        `import './styles.css';`,
        `import { createServerOnlyFn } from '@tanstack/react-start';`,
        `export const f = createServerOnlyFn(() => 1);`,
      ].join('\n');
      const result = await transform(code);
      expect(result).not.toBeNull();
      expect(result!.code).toMatch(/import\s+['"]\.\/styles\.css['"]/);
    });

    it('treeshake unused variables if the var is only referenced in the server-only code that gets stripped', async () => {
      const code = [
        `import { createServerFn } from '@tanstack/react-start';`,
        `const secret = () => 1;`,
        `export const f = createServerFn().handler(secret);`,
      ].join('\n');
      const result = await transform(code);
      expect(result).not.toBeNull();
      expect(result!.code).not.toContain('secret');
    });

    it('treeshake unused functions if they are only called in the server-only code that gets stripped', async () => {
      const code = [
        `import { createServerFn } from '@tanstack/react-start';`,
        `function secret() { return 1; }`,
        `export const f = createServerFn().handler(() => secret());`,
      ].join('\n');
      const result = await transform(code);
      expect(result).not.toBeNull();
      expect(result!.code).not.toContain('secret');
    });

    it('keeps imports only referenced in JSX after stripping the server option', async () => {
      const code = [
        `import { createFileRoute } from '@tanstack/react-router';`,
        `import { ImportedPanel } from '../components/ImportedPanel';`,
        `export const Route = createFileRoute('/demo')({`,
        `  component: RouteComponent,`,
        `  server: { handlers: { default: async () => new Response('ok') } },`,
        `});`,
        `function RouteComponent() {`,
        `  return <ImportedPanel />;`,
        `}`,
      ].join('\n');
      const result = await transform(code, '/project/src/routes/demo.tsx');
      expect(result).not.toBeNull();
      expect(result!.code).not.toMatch(/\bserver:\s*\{/);
      expect(result!.code).toMatch(/import\s*\{\s*ImportedPanel\s*\}\s*from/);
    });

    it('keeps same-file components referenced only from JSX', async () => {
      const code = [
        `import { createFileRoute } from '@tanstack/react-router';`,
        `import { createMiddleware } from '@tanstack/react-start';`,
        `const noopMiddleware = createMiddleware().server(async ({ next }) => next());`,
        `export const Route = createFileRoute('/fails')({`,
        `  component: Component,`,
        `  server: { middleware: [noopMiddleware] },`,
        `});`,
        `function Component() {`,
        `  return <NestedComponent />;`,
        `}`,
        `function NestedComponent() {`,
        `  return <div>Nested Component</div>;`,
        `}`,
      ].join('\n');
      const result = await transform(code, '/project/src/routes/fails.tsx');
      expect(result).not.toBeNull();
      expect(result!.code).toContain('function NestedComponent');
    });

    it('keeps imports referenced via a JSX member expression (Namespace.Child)', async () => {
      const code = [
        `import { createFileRoute } from '@tanstack/react-router';`,
        `import { UI } from '../components/ui';`,
        `export const Route = createFileRoute('/demo')({`,
        `  component: RouteComponent,`,
        `  server: { handler: async () => ({}) },`,
        `});`,
        `function RouteComponent() {`,
        `  return <UI.Panel />;`,
        `}`,
      ].join('\n');
      const result = await transform(code, '/project/src/routes/demo.tsx');
      expect(result).not.toBeNull();
      expect(result!.code).toMatch(/import\s*\{\s*UI\s*\}\s*from/);
    });

    it('keeps still-referenced imports from a partially-used declaration', async () => {
      const code = [
        `import { createServerOnlyFn, useSomething } from '@tanstack/react-start';`,
        `export const f = createServerOnlyFn(() => 1);`,
        `export const g = useSomething();`,
      ].join('\n');
      const result = await transform(code);
      expect(result).not.toBeNull();
      expect(result!.code).toContain('useSomething');
      expect(result!.code).not.toContain('createServerOnlyFn');
    });
  });
});
