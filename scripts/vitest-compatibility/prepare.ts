import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
assert.equal(process.versions.node, (await readFile(join(root, '.nvmrc'), 'utf8')).trim());
const [destination, version = '5.0.1', framework = 'react'] = process.argv.slice(2);
assert(
  destination,
  'Usage: node scripts/vitest-compatibility/prepare.ts DIRECTORY VERSION FRAMEWORK'
);
assert(['react', 'vue3', 'svelte'].includes(framework));
const directory = resolve(destination);
type Manifest = {
  name: string;
  version: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
};
const packages = new Map<string, { path: string; manifest: Manifest }>();
for (const category of ['.', 'addons', 'builders', 'frameworks', 'renderers', 'lib']) {
  const parent = join(root, 'code', category);
  for (const entry of await readdir(parent, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const path = join(parent, entry.name);
    try {
      const manifest = JSON.parse(await readFile(join(path, 'package.json'), 'utf8'));
      packages.set(manifest.name, { path, manifest });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
}
await mkdir(directory, { recursive: true });
const dependencies: Record<string, string> = {};
async function pack(name: string) {
  if (dependencies[name]) return;
  const pkg = packages.get(name);
  assert(pkg, `Missing local package ${name}`);
  const staging = join(directory, '.packages', name.replaceAll('/', '-'));
  await mkdir(staging, { recursive: true });
  dependencies[name] = '';
  const manifest = structuredClone(pkg.manifest);
  delete manifest.devDependencies;
  delete manifest.scripts;
  for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies'] as const) {
    for (const [dependency, range] of Object.entries(manifest[field] ?? {})) {
      if (String(range).startsWith('workspace:')) {
        manifest[field][dependency] = packages.get(dependency)!.manifest.version;
        await pack(dependency);
      }
    }
  }
  await writeFile(join(staging, 'package.json'), JSON.stringify(manifest, null, 2));
  await cp(join(pkg.path, 'dist'), join(staging, 'dist'), { recursive: true });
  for (const entry of await readdir(pkg.path)) {
    if (['templates', 'assets', 'static'].includes(entry) || /\.(mjs|cjs|js|ts)$/.test(entry)) {
      await cp(join(pkg.path, entry), join(staging, entry), { recursive: true });
    }
  }
  const result = JSON.parse(
    execFileSync('npm', ['pack', '--ignore-scripts', '--json'], { cwd: staging, encoding: 'utf8' })
  );
  dependencies[name] = `file:${join(staging, result[0].filename)}`;
}
await pack('@storybook/addon-vitest');
await pack(`@storybook/${framework}-vite`);
Object.assign(dependencies, {
  vitest: version,
  '@vitest/coverage-v8': version,
  [version.startsWith('3.') ? '@vitest/browser' : '@vitest/browser-playwright']: version,
  playwright: '1.58.2',
  vite: version.startsWith('5.') ? '7.3.1' : '6.3.6',
  typescript: '6.0.3',
  ...(framework === 'react'
    ? { react: '18.3.1', 'react-dom': '18.3.1', '@vitejs/plugin-react': '4.7.0' }
    : {}),
  ...(framework === 'vue3' ? { vue: '3.5.30', '@vitejs/plugin-vue': '6.0.5' } : {}),
  ...(framework === 'svelte' ? { svelte: '5.53.12', '@sveltejs/vite-plugin-svelte': '6.2.4' } : {}),
});
await writeFile(
  join(directory, 'package.json'),
  JSON.stringify(
    { name: 'storybook-vitest-compatibility', private: true, type: 'module', dependencies },
    null,
    2
  )
);
execFileSync('npm', ['install', '--legacy-peer-deps', '--no-audit', '--no-fund'], {
  cwd: directory,
  stdio: 'inherit',
});
await cp(join(import.meta.dirname, 'run.ts'), join(directory, 'run.ts'));
await cp(join(import.meta.dirname, 'ui.ts'), join(directory, 'ui.ts'));
await writeFile(
  join(directory, 'environment.json'),
  JSON.stringify(
    {
      sha: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
      node: process.versions.node,
      version,
      framework,
      dependencies,
    },
    null,
    2
  )
);
