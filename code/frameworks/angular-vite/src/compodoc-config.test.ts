import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { DEFAULT_COMPODOC_ARGS, resolveCompodocConfig } from './compodoc-config.ts';

const hostOptions = (framework: unknown, extra: Record<string, unknown> = {}) => ({
  presets: {
    apply: async (key: string, fallback?: unknown) => (key === 'framework' ? framework : fallback),
  },
  ...extra,
});

const configFor = (
  frameworkOptions: Record<string, unknown>,
  extra: Record<string, unknown> = {}
) =>
  resolveCompodocConfig(
    hostOptions(
      { options: frameworkOptions },
      { angularBuilderContext: { workspaceRoot: '/nx-workspace' }, ...extra }
    )
  );

describe('resolveCompodocConfig', () => {
  it('prefers the Angular builder workspace root over Vite`s root and cwd', async () => {
    await expect(
      resolveCompodocConfig(
        hostOptions({ options: {} }, { angularBuilderContext: { workspaceRoot: '/nx-workspace' } }),
        { viteRoot: '/vite-root' }
      )
    ).resolves.toMatchObject({ workspaceRoot: '/nx-workspace' });

    await expect(
      resolveCompodocConfig(hostOptions({ options: {} }), { viteRoot: '/vite-root' })
    ).resolves.toMatchObject({ workspaceRoot: '/vite-root' });

    await expect(resolveCompodocConfig(hostOptions({ options: {} }))).resolves.toMatchObject({
      workspaceRoot: process.cwd(),
    });
  });

  // Only `viteFinal` can pass Vite's root along; the docgen preset that tells the worker where to
  // read has no access to it. Deriving the same directory from `configDir` is what keeps the two
  // pointed at one place when Storybook is started from anywhere but the project directory.
  it('agrees with builder-vite`s root when only `configDir` is known', async () => {
    // Rooted under the working directory so the last assertion is definitionally meaningful: the
    // derived root is a child of cwd, and so can never coincidentally equal it.
    const configDir = resolve(process.cwd(), 'a-library-project/.storybook');
    const viteRoot = resolve(configDir, '..');

    const [fromWriter, fromReader] = await Promise.all([
      resolveCompodocConfig(hostOptions({ options: {} }, { configDir }), { viteRoot }),
      resolveCompodocConfig(hostOptions({ options: {} }, { configDir })),
    ]);

    expect(fromReader.workspaceRoot).toBe(viteRoot);
    expect(fromReader.outputDir).toBe(fromWriter.outputDir);
    expect(fromReader.workspaceRoot).not.toBe(process.cwd());
  });

  it('falls back through the tsconfig chain the Compodoc run uses', async () => {
    const tsconfigOf = async (frameworkOptions: Record<string, unknown>, extra = {}) =>
      (await configFor(frameworkOptions, extra)).tsconfig;

    expect(await tsconfigOf({ tsconfig: 'tsconfig.doc.json' })).toBe('tsconfig.doc.json');
    expect(await tsconfigOf({}, { tsConfig: 'tsconfig.app.json' })).toBe('tsconfig.app.json');
    expect(await tsconfigOf({}, { angularBuilderOptions: { tsConfig: 'tsconfig.b.json' } })).toBe(
      'tsconfig.b.json'
    );
    // With nothing configured, the same upward walk the builders use wins over assuming the
    // workspace root, so Compodoc gets the tsconfig the Angular build would have picked.
    const fixtures = join(dirname(fileURLToPath(import.meta.url)), 'docgen/__testfixtures__');
    expect(await tsconfigOf({}, { configDir: fixtures })).toBe(join(fixtures, 'tsconfig.json'));

    expect(await tsconfigOf({})).toBe(resolve('/nx-workspace', 'tsconfig.json'));
  });

  // The output directory is the one answer generation and reading must agree on, and it comes out
  // of Compodoc's own argument list.
  it.each([
    ['the default invocation', undefined, resolve('/nx-workspace')],
    ['`-d`', ['-e', 'json', '-d', 'dist/docs'], resolve('/nx-workspace', 'dist/docs')],
    ['`--output`', ['--output', 'docs'], resolve('/nx-workspace', 'docs')],
    // A later flag wins on the command line; a malformed one does not end the scan.
    ['a repeated flag', ['-d', 'first', '-d', 'second'], resolve('/nx-workspace', 'second')],
    [
      'a malformed later flag',
      ['-d', 'dist/docs', '--output', '-p'],
      resolve('/nx-workspace', 'dist/docs'),
    ],
    ['a flag with no value at all', ['-d'], resolve('/nx-workspace')],
  ])(
    'resolves the output directory of %s against the workspace root',
    async (_name, compodocArgs, expected) => {
      await expect(configFor(compodocArgs ? { compodocArgs } : {})).resolves.toMatchObject({
        outputDir: expected,
      });
    }
  );

  it('reports the opt-out, and survives a framework entry that is a bare string', async () => {
    await expect(configFor({})).resolves.toMatchObject({
      enabled: true,
      compodocArgs: DEFAULT_COMPODOC_ARGS,
    });
    await expect(configFor({ compodoc: false })).resolves.toMatchObject({ enabled: false });

    await expect(
      resolveCompodocConfig(hostOptions('@storybook/angular-vite'))
    ).resolves.toMatchObject({ enabled: true, compodocArgs: DEFAULT_COMPODOC_ARGS });
    await expect(resolveCompodocConfig()).resolves.toMatchObject({ enabled: true });
  });
});
