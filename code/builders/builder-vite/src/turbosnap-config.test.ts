import * as fs from 'node:fs';

import { fs as memoryFs, vol } from 'memfs';
import { resolve } from 'pathe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ConfigEvidence, digest } from './turbosnap-config.ts';
import { pluginWebpackStats } from './plugins/webpack-stats-plugin.ts';

vi.mock('node:fs', { spy: true });
vi.mock('storybook/internal/common', () => ({
  findConfigFile: vi.fn(),
  versions: { '@storybook/builder-vite': '11.0.0' },
}));

const project = resolve('/project');
const configDir = `${project}/.storybook`;
const main = `${configDir}/main.ts`;
const fixture = `${configDir}/fixture.json`;
const preset = `${project}/preset.js`;
const compilerFiles = {
  esbuild: `${project}/node_modules/esbuild/package.json`,
  rollup: `${project}/node_modules/rollup/package.json`,
};
const modules = [
  { name: '/virtual:/@storybook/builder-vite/project-annotations.js', reasons: [] },
  {
    name: './.storybook/preview.ts',
    reasons: [{ moduleName: '/virtual:/@storybook/builder-vite/project-annotations.js' }],
  },
];

function evidence(customCompiler = false) {
  const result = new ConfigEvidence({
    workingDir: project,
    configDir,
    mainFile: main,
    presetFiles: [main, preset],
    supportedPresetFiles: [main, preset],
    compilerFiles,
    customCompiler,
  });
  result.resolved({
    root: project,
    mode: 'production',
    configFile: false,
    env: {},
    define: {},
    css: {},
  });
  return result;
}

beforeEach(() => {
  vol.reset();
  vol.fromJSON({
    [main]: `import type { StorybookConfig } from '@storybook/html-vite';
      const config: StorybookConfig = { framework: '@storybook/html-vite', stories: ['../src/*.stories.ts'], addons: [] };
      export default config;`,
    [fixture]: '{"label":"Before"}',
    [`${configDir}/preview.ts`]: 'export default {};',
    [`${project}/src/Button.stories.ts`]: 'export const Default = {};',
    [preset]: 'export const core = {};',
    [`${project}/package.json`]: '{"name":"example","type":"module"}',
    [compilerFiles.esbuild]: '{"version":"0.28.1"}',
    [compilerFiles.rollup]: '{"version":"4.53.2"}',
  });
  vi.spyOn(fs, 'existsSync').mockImplementation(memoryFs.existsSync);
  vi.spyOn(fs, 'readFileSync').mockImplementation(memoryFs.readFileSync as typeof fs.readFileSync);
  vi.spyOn(fs, 'readdirSync').mockImplementation(memoryFs.readdirSync as typeof fs.readdirSync);
  vi.spyOn(fs, 'realpathSync').mockImplementation(memoryFs.realpathSync as typeof fs.realpathSync);
});

afterEach(() => vi.restoreAllMocks());

describe('TurboSnap config evidence', () => {
  it('binds the supported HTML pipeline without making its story fixtures global', () => {
    const collector = evidence();
    collector.module(`${project}/src/Button.stories.ts`);
    collector.module(fixture);
    const result = collector.finish(modules);
    expect(result.status).toBe('complete');
    expect(result.modulesHash).toBe(digest(JSON.stringify(modules)));
    expect(result.configFiles).toEqual([
      './.storybook/fixture.json',
      './.storybook/main.ts',
      './.storybook/preview.ts',
    ]);
    expect(result.files['./.storybook/fixture.json']).toEqual({
      hash: digest('{"label":"Before"}'),
      realPath: './.storybook/fixture.json',
      dependencies: [],
    });
    expect(result.roots).toContain('./.storybook/main.ts');
    expect(result.roots).not.toContain('./.storybook/fixture.json');
    expect(result.absentFiles).toContain('./vite.config.ts');
    expect(result.absentFiles).toContain('./src/tsconfig.json');
    expect(result.absentFiles).toContain('./.storybook/postcss.config.js');
  });

  it('records relative JSON compiler inheritance as edges even for a story-shared fixture', () => {
    memoryFs.writeFileSync(
      `${project}/tsconfig.json`,
      '{ // compiler options\n "extends": "./.storybook/fixture.json", "compilerOptions": { "target": "ES2022", }, }'
    );
    const collector = evidence();
    collector.module(fixture);
    const result = collector.finish(modules);
    expect(result.status).toBe('complete');
    expect(result.roots).toContain('./tsconfig.json');
    expect(result.files['./tsconfig.json'].dependencies).toEqual(['./.storybook/fixture.json']);
  });

  it.each(['esbuild', 'rollup'] as const)('rejects an unvalidated %s version', (compiler) => {
    memoryFs.writeFileSync(compilerFiles[compiler], '{"version":"999.0.0"}');
    expect(evidence().finish(modules)).toMatchObject({
      status: 'incomplete',
      reason: 'unsupported-compiler-version',
    });
  });

  it('binds compiler identities and dependency lockfiles', () => {
    memoryFs.writeFileSync(`${project}/yarn.lock`, 'lockfile contents');
    const result = evidence().finish(modules);
    expect(result.roots).toContain('./node_modules/esbuild/package.json');
    expect(result.roots).toContain('./node_modules/rollup/package.json');
    expect(result.roots).toContain('./yarn.lock');
    expect(result.absentFiles).toContain('./pnpm-lock.yaml');
  });

  it('rejects a compiler executable override', () => {
    expect(evidence(true).finish(modules)).toMatchObject({
      status: 'incomplete',
      reason: 'custom-compiler',
    });
  });

  it.each([
    ['vite.config.ts', 'export default {};', 'custom-vite-config'],
    ['postcss.config.js', 'export default {};', 'unsupported-style-config'],
    ['package.json', '{"postcss": {}}', 'unsupported-style-config'],
    ['tsconfig.json', '{"extends":"compiler-preset"}', 'unsupported-tsconfig'],
    ['tsconfig.json', '{"references":[{"path":"./.storybook"}]}', 'unsupported-tsconfig'],
  ])('retains fallback for %s', (name, contents, reason) => {
    memoryFs.writeFileSync(`${project}/${name}`, contents);
    expect(evidence().finish(modules)).toMatchObject({ status: 'incomplete', reason });
  });

  it('does not guess extensionless compiler inheritance resolution', () => {
    memoryFs.writeFileSync(`${project}/tsconfig.json`, '{"extends":"./base"}');
    memoryFs.writeFileSync(`${project}/base.js`, '{"extends":"./.storybook/fixture.json"}');
    memoryFs.writeFileSync(`${project}/base.json`, '{}');
    expect(evidence().finish(modules)).toMatchObject({
      status: 'incomplete',
      reason: 'unsupported-tsconfig',
    });
  });

  it('does not authorize a declarative main when another preset executes build code', () => {
    const result = new ConfigEvidence({
      workingDir: project,
      configDir,
      mainFile: main,
      presetFiles: [main, preset],
      supportedPresetFiles: [main],
      compilerFiles,
    });
    expect(result.finish(modules)).toMatchObject({
      status: 'incomplete',
      reason: 'unsupported-preset',
    });
  });

  it('leaves raw HTML references and copied static files outside the supported profile', () => {
    memoryFs.writeFileSync(`${configDir}/preview-head.html`, '<script src="/fixture.js"></script>');
    expect(evidence().finish(modules)).toMatchObject({
      status: 'incomplete',
      reason: 'opaque-html-input',
    });
    memoryFs.unlinkSync(`${configDir}/preview-head.html`);
    memoryFs.writeFileSync(
      main,
      `export default {framework:'@storybook/html-vite',staticDirs:['.']};`
    );
    expect(evidence().finish(modules).status).toBe('incomplete');
  });

  it('tracks the absence of a public directory and rejects existing copied content', () => {
    const collector = evidence();
    const config = {
      root: project,
      mode: 'production',
      configFile: false as const,
      env: {},
      css: {},
      publicDir: `${project}/public`,
    };
    collector.resolved(config);
    expect(collector.finish(modules).absentFiles).toContain('./public');
    memoryFs.mkdirSync(`${project}/public`);
    expect(collector.finish(modules).status).toBe('incomplete');
    const next = evidence();
    next.resolved(config);
    expect(next.finish(modules)).toMatchObject({
      status: 'incomplete',
      reason: 'unsupported-static-input',
    });
  });

  it('adds evidence without changing the existing module graph', () => {
    const ordinary = pluginWebpackStats({ workingDir: project });
    const bound = pluginWebpackStats({ workingDir: project, configEvidence: evidence() });
    for (const plugin of [ordinary, bound]) {
      const moduleParsed = plugin.moduleParsed as unknown as (module: {
        id: string;
        importedIds: string[];
        dynamicallyImportedIds: string[];
      }) => void;
      moduleParsed({
        id: `${project}/src/Button.stories.ts`,
        importedIds: [fixture],
        dynamicallyImportedIds: [],
      });
    }
    const oldStats = ordinary.storybookGetStats().toJson();
    const newStats = bound.storybookGetStats().toJson();
    expect(newStats.modules).toEqual(oldStats.modules);
    expect(newStats.turbosnapConfig?.modulesHash).toBe(digest(JSON.stringify(oldStats.modules)));
  });

  it('retains fallback for executable main configuration', () => {
    memoryFs.writeFileSync(
      main,
      `import './fixture.json'; export default {framework:'@storybook/html-vite'};`
    );
    expect(evidence().finish(modules)).toMatchObject({
      status: 'incomplete',
      reason: 'unsupported-main-config',
    });
  });

  it('does not treat an individual type specifier as an erased import declaration', () => {
    memoryFs.writeFileSync(
      main,
      `import { type Config } from './side-effect'; export default {framework:'@storybook/html-vite'};`
    );
    expect(evidence().finish(modules)).toMatchObject({
      status: 'incomplete',
      reason: 'unsupported-main-config',
    });
  });

  it.each([
    'const asset = new URL("./fixture.json", import.meta.url);',
    'sb.mock("./fixture.json");',
    'const load = (name) => import(name);',
  ])('does not claim runtime side reads are ordinary import edges: %s', (source) => {
    memoryFs.writeFileSync(`${project}/src/Button.stories.ts`, source);
    const collector = evidence();
    collector.module(`${project}/src/Button.stories.ts`);
    expect(collector.finish(modules)).toMatchObject({
      status: 'incomplete',
      reason: 'opaque-runtime-input',
    });
  });

  it('keeps stylesheet processing outside the supported profile', () => {
    memoryFs.writeFileSync(`${configDir}/style.css`, 'body { color: red; }');
    const collector = evidence();
    collector.module(`${configDir}/style.css`);
    expect(collector.finish(modules)).toMatchObject({
      status: 'incomplete',
      reason: 'unsupported-runtime-input',
    });
  });

  it.each(['worker', 'sharedworker', 'raw', 'url', 'custom'])(
    'rejects queried runtime modules whose dependencies may use a separate graph: %s',
    (query) => {
      const collector = evidence();
      collector.module(`${project}/src/Button.stories.ts?${query}`);
      expect(collector.finish(modules)).toMatchObject({
        status: 'incomplete',
        reason: 'unsupported-runtime-query',
      });
    }
  );

  it('rejects missing filesystem inputs but permits the generated Storybook HTML entry', () => {
    const collector = evidence();
    collector.module(`${project}/iframe.html`);
    collector.module(`${project}/iframe.html?html-proxy&inline-css&index=0.css`);
    expect(collector.finish(modules).status).toBe('complete');
    collector.module(`${project}/missing.ts`);
    expect(collector.finish(modules)).toMatchObject({
      status: 'incomplete',
      reason: 'missing-runtime-input',
    });
    const queriedEntry = evidence();
    queriedEntry.module(`${project}/iframe.html?worker`);
    expect(queriedEntry.finish(modules).reason).toBe('unsupported-runtime-query');
  });

  it('detects hidden asset reads even in a package shared by the preview', () => {
    const dependency = `${project}/node_modules/example/index.js`;
    memoryFs.mkdirSync(`${project}/node_modules/example`, { recursive: true });
    memoryFs.writeFileSync(
      dependency,
      'export const asset = new URL("../../.storybook/fixture.json", import.meta.url).href;'
    );
    const collector = evidence();
    collector.module(dependency);
    expect(collector.finish(modules)).toMatchObject({
      status: 'incomplete',
      reason: 'opaque-runtime-input',
    });
  });

  it('allows the production hot-reload guard used by Storybook runtime', () => {
    const dependency = `${project}/node_modules/example/index.js`;
    memoryFs.mkdirSync(`${project}/node_modules/example`, { recursive: true });
    memoryFs.writeFileSync(
      dependency,
      'const hot = import.meta.hot || {}; function Constructor() { return new.target; }'
    );
    const collector = evidence();
    collector.module(dependency);
    expect(collector.finish(modules).status).toBe('complete');
  });

  it('rejects package stylesheet transforms that can hide shared config assets', () => {
    const dependency = `${project}/node_modules/example/style.css`;
    memoryFs.mkdirSync(`${project}/node_modules/example`, { recursive: true });
    memoryFs.writeFileSync(dependency, '@import "../../.storybook/theme.json";');
    const collector = evidence();
    collector.module(dependency);
    expect(collector.finish(modules)).toMatchObject({
      status: 'incomplete',
      reason: 'unsupported-runtime-input',
    });
  });

  it.each(['modify', 'add', 'delete'])(
    'rejects a config inventory that changes during the build: %s',
    (operation) => {
      const collector = evidence();
      if (operation === 'modify') memoryFs.writeFileSync(fixture, '{}');
      if (operation === 'add') memoryFs.writeFileSync(`${configDir}/new.ts`, 'export {};');
      if (operation === 'delete') memoryFs.unlinkSync(fixture);
      expect(collector.finish(modules)).toMatchObject({
        status: 'incomplete',
        reason: 'inputs-changed-during-build',
      });
    }
  );

  it('does not claim completeness when the preview composition graph is missing', () => {
    expect(evidence().finish([])).toMatchObject({
      status: 'incomplete',
      reason: 'missing-preview-composition',
    });
  });

  it('rejects newly discovered compiler controls during the build', () => {
    const collector = evidence();
    memoryFs.writeFileSync(`${project}/tsconfig.json`, '{}');
    expect(collector.finish(modules)).toMatchObject({
      status: 'incomplete',
      reason: 'inputs-changed-during-build',
    });
  });

  it('records environment identity without exposing injected values', () => {
    memoryFs.writeFileSync(`${project}/.env.production`, 'VITE_LABEL=example');
    const collector = evidence();
    collector.resolved({
      root: project,
      mode: 'production',
      configFile: false,
      env: { VITE_LABEL: 'example' },
      define: {},
      css: {},
    });
    const result = collector.finish(modules);
    expect(result.roots).toContain('./.env.production');
    expect(result.environmentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(result)).not.toContain('VITE_LABEL');
  });
});
