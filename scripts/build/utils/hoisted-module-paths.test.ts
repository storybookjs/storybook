import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';

import * as esbuild from 'esbuild';
import { join } from 'pathe';
import { type OutputChunk, type Plugin as RolldownPlugin, rolldown } from 'rolldown';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  esbuildHoistedModulePaths,
  hoistEsbuildModulePaths,
  hoistModulePath,
  rolldownHoistedModulePaths,
} from './hoisted-module-paths.ts';

// A dependency that was itself bundled with esbuild under pnpm, as some published packages are.
const upstreamKey = '"node_modules/.pnpm/es-errors@1.3.0/node_modules/es-errors/index.js"';

describe('hoistModulePath', () => {
  it('drops the pnpm store segment of plain, scoped and peer-suffixed packages', () => {
    expect(
      hoistModulePath('../../node_modules/.pnpm/ejs@3.1.10/node_modules/ejs/lib/utils.js')
    ).toBe('../../node_modules/ejs/lib/utils.js');
    expect(
      hoistModulePath(
        'node_modules/.pnpm/@radix-ui+react-slot@1.2.3_@types+react@18.3.28_react@18.3.1/node_modules/@radix-ui/react-slot/dist/index.d.mts'
      )
    ).toBe('node_modules/@radix-ui/react-slot/dist/index.d.mts');
  });

  it('leaves workspace paths alone', () => {
    expect(hoistModulePath('../core/src/index.ts')).toBe('../core/src/index.ts');
  });
});

describe('hoistEsbuildModulePaths', () => {
  it('rewrites only the given module paths', () => {
    const path = '../../node_modules/.pnpm/semver@7.8.5/node_modules/semver/index.js';
    const code = [`// ${path}`, `var require_semver = __commonJS({`, `  "${path}"(exports, module) {`];
    code.push(`    var x = __commonJS({ ${upstreamKey}(exports, module) {} });`);

    expect(hoistEsbuildModulePaths(code.join('\n'), new Set([path])).split('\n')).toEqual([
      '// ../../node_modules/semver/index.js',
      'var require_semver = __commonJS({',
      '  "../../node_modules/semver/index.js"(exports, module) {',
      `    var x = __commonJS({ ${upstreamKey}(exports, module) {} });`,
    ]);
  });
});

describe('esbuildHoistedModulePaths', () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'hoisted-module-paths-'));
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('rewrites the comments and wrapper keys esbuild writes for pnpm store paths', async () => {
    const store = join(root, 'node_modules/.pnpm/dep@1.0.0/node_modules/dep');
    await mkdir(store, { recursive: true });
    await writeFile(
      join(store, 'index.js'),
      `module.exports = { key: ${upstreamKey} };\nrequire('./other.js');`
    );
    await writeFile(join(store, 'other.js'), 'module.exports = 2;');
    await mkdir(join(root, 'pkg/node_modules'), { recursive: true });
    // A junction needs no privileges on Windows; other platforms ignore the type.
    await symlink(store, join(root, 'pkg/node_modules/dep'), 'junction');
    await writeFile(join(root, 'pkg/entry.js'), `export { default } from 'dep';`);

    await esbuild.build({
      absWorkingDir: join(root, 'pkg'),
      entryPoints: ['./entry.js'],
      outdir: 'dist',
      bundle: true,
      format: 'esm',
      platform: 'node',
      logLevel: 'silent',
      plugins: [esbuildHoistedModulePaths],
    });
    const output = await readFile(join(root, 'pkg/dist/entry.js'), 'utf8');

    expect(output).toContain('// ../node_modules/dep/index.js\n');
    expect(output).toContain('"../node_modules/dep/other.js"(exports, module)');
    expect(output).toContain(upstreamKey);
    expect(output).not.toContain('../node_modules/.pnpm/');
  });
});

describe('rolldownHoistedModulePaths', () => {
  const sources: Record<string, string> = {
    entry: `import { value } from 'shared'; export const lazy = () => import('lazy'); value();`,
    '/repo/src/lazy.js': `import { value } from 'shared'; value();`,
    '/repo/node_modules/.pnpm/shared@1.0.0/node_modules/shared/index.js': `export const value = () => globalThis.value;`,
  };
  const ids: Record<string, string> = {
    entry: 'entry',
    lazy: '/repo/src/lazy.js',
    shared: '/repo/node_modules/.pnpm/shared@1.0.0/node_modules/shared/index.js',
  };

  const bundle = async (plugins: RolldownPlugin[]) => {
    const build = await rolldown({
      cwd: '/repo',
      input: { entry: 'entry' },
      logLevel: 'silent',
      plugins: [
        { name: 'virtual-modules', resolveId: (id) => ids[id], load: (id) => sources[id] },
        ...plugins,
      ],
    });
    try {
      const { output } = await build.generate({ format: 'es', chunkFileNames: '[name]-[hash].js' });
      return Object.fromEntries(output.map((chunk) => [chunk.name, chunk])) as Record<
        string,
        OutputChunk
      >;
    } finally {
      await build.close();
    }
  };

  it('rewrites region comments before the chunks are hashed', async () => {
    const before = await bundle([]);
    const after = await bundle([rolldownHoistedModulePaths]);

    expect(before.shared.code).toContain(
      '//#region node_modules/.pnpm/shared@1.0.0/node_modules/shared/index.js\n'
    );
    expect(after.shared.code).toBe(
      before.shared.code.replace('.pnpm/shared@1.0.0/node_modules/', '')
    );
    expect(after.shared.fileName).not.toBe(before.shared.fileName);
    expect(after.lazy.code).toContain(`from "./${after.shared.fileName}"`);
  });
});
