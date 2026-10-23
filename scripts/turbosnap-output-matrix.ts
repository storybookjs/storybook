import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  closeSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { logger } from 'storybook/internal/node-logger';
import type { TurbosnapOutput } from 'storybook/internal/types';

import { dirname, join, resolve } from 'pathe';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argument = (name: string) => {
  const position = process.argv.indexOf(name);
  return position === -1 ? undefined : process.argv[position + 1];
};
const selected = argument('--framework');
const cli = argument('--cli');
const destination = argument('--output') ?? mkdtempSync(join(tmpdir(), 'storybook-output-matrix-'));
const frameworks = ['react-vite', 'nextjs-vite', 'react-webpack5', 'nextjs'].filter(
  (name) => !selected || name === selected
);
assert(frameworks.length, 'Unknown framework');

const publishedPackages = new Set([
  'storybook',
  '@storybook/builder-vite',
  '@storybook/builder-webpack5',
  '@storybook/core-webpack',
  '@storybook/react',
  '@storybook/react-vite',
  '@storybook/react-webpack5',
  '@storybook/preset-react-webpack',
  '@storybook/nextjs',
  '@storybook/nextjs-vite',
  'vite-plugin-storybook-nextjs',
  '@storybook/addon-docs',
]);

function dependencies(source: string, target: string, scope = '') {
  mkdirSync(target, { recursive: true });
  for (const name of readdirSync(source)) {
    if (name.startsWith('.')) continue;
    const from = join(source, name);
    const to = join(target, name);
    if (name.startsWith('@')) {
      dependencies(from, to, `${name}/`);
      continue;
    }
    if (existsSync(to)) continue;
    if (!publishedPackages.has(`${scope}${name}`)) {
      symlinkSync(from, to, 'dir');
      continue;
    }
    mkdirSync(to, { recursive: true });
    for (const entry of readdirSync(from)) {
      if (
        [
          'dist',
          'assets',
          'input',
          'templates',
          'package.json',
          'preset.js',
          'manager.js',
        ].includes(entry)
      )
        cpSync(join(from, entry), join(to, entry), { recursive: true, dereference: true });
    }
    assert(existsSync(join(to, 'dist')), `Compile ${scope}${name} before running the matrix`);
  }
}

function write(root: string, file: string, content: string) {
  mkdirSync(dirname(join(root, file)), { recursive: true });
  writeFileSync(join(root, file), content);
}

type Scenario =
  | 'base'
  | 'helper'
  | 'preview'
  | 'css'
  | 'static'
  | 'hidden-base'
  | 'hidden-helper'
  | 'mock-base'
  | 'mock-helper'
  | 'plain-a-base'
  | 'plain-a-helper'
  | 'plain-b-base'
  | 'plain-b-helper'
  | 'eager'
  | 'late';

function configure(root: string, framework: string, scenario: Scenario) {
  const vite = framework.endsWith('vite');
  const next = framework.startsWith('nextjs');
  const hidden = scenario.startsWith('hidden');
  const mock = scenario.startsWith('mock');
  const plain = scenario.startsWith('plain');
  const helperInB = scenario.startsWith('plain-b');
  const changedHelper = scenario.endsWith('helper');
  const transform = `{
    name:'fixture-hidden-input',
    transform(code,id) { if(id.endsWith('/B.stories.jsx')) return code.replace('HIDDEN_MARKER',JSON.parse(readFileSync(new URL('./fixture.json',import.meta.url),'utf8')).label); }
  }`;
  const lateVite = `{name:'fixture-late-write',writeBundle:{order:'post',handler(options,bundle){const file=Object.keys(bundle).find(name=>name.endsWith('.js'));appendFileSync(join(options.dir,file),'\\n;globalThis.lateMutation=true;');}}}`;
  const hiddenWebpack = `{apply(compiler){compiler.hooks.thisCompilation.tap('Hidden',compilation=>compilation.hooks.processAssets.tap({name:'Hidden',stage:100},()=>{const chunk=[...compilation.chunks].find(value=>value.name?.startsWith('B-stories'));const file=[...chunk.files].find(name=>name.endsWith('.js'));const data=readFileSync(new URL('./fixture.json',import.meta.url),'utf8');compilation.updateAsset(file,asset=>new compiler.webpack.sources.RawSource(asset.source()+';globalThis.hidden='+data+';'));}));}}`;
  const lateWebpack = `{apply(compiler){compiler.hooks.afterEmit.tap('Late',compilation=>{const chunk=[...compilation.chunks].find(value=>value.name==='main');const file=[...chunk.files].find(name=>name.endsWith('.js'));appendFileSync(join(compiler.outputPath,file),'\\n;globalThis.lateMutation=true;');});}}`;
  const eagerWebpack = `{apply(compiler){compiler.hooks.thisCompilation.tap('Eager',compilation=>compilation.hooks.processAssets.tap({name:'Eager',stage:compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_REPORT},()=>{const chunks=[...compilation.chunks];const main=chunks.find(chunk=>chunk.name==='main');const story=chunks.find(chunk=>chunk.name?.startsWith('A-stories'));const module=[...compilation.modules].find(module=>module.nameForCondition()?.endsWith('/A.stories.jsx'));const call='__webpack_require__.e('+JSON.stringify(story.id)+').then(__webpack_require__.bind(__webpack_require__,'+JSON.stringify(compilation.chunkGraph.getModuleId(module))+'));';const file=[...main.files].find(name=>name.endsWith('.js'));compilation.updateAsset(file,asset=>{const before=asset.source().toString();const after=before.replace('__webpack_require__.O(',call+'__webpack_require__.O(');if(before===after)throw new Error('Missing Webpack startup');return new compiler.webpack.sources.RawSource(after);});}));}}`;
  const reactWebpack =
    framework === 'react-webpack5'
      ? `config.module.rules.push({test:/\\.[jt]sx?$/,exclude:/node_modules/,use:{loader:require.resolve('babel-loader'),options:{babelrc:false,configFile:false,presets:[[require.resolve('@babel/preset-react'),{runtime:'automatic'}]]}}});`
      : '';
  const final = vite
    ? `viteFinal(config){config.plugins.push(${hidden ? transform : scenario === 'late' ? lateVite : ''});return config;}`
    : `webpackFinal(config){${reactWebpack}config.plugins.push(${hidden ? hiddenWebpack : scenario === 'late' ? lateWebpack : scenario === 'eager' ? eagerWebpack : ''});return config;}`;
  write(
    root,
    '.storybook/main.ts',
    `import {createRequire} from 'node:module';import {readFileSync,appendFileSync} from 'node:fs';import {join} from 'node:path';const require=createRequire(import.meta.url);export default {framework:'@storybook/${framework}',stories:['../src/*.stories.jsx'],addons:${plain ? '[]' : "['@storybook/addon-docs']"},staticDirs:['../public'],${final}};`
  );
  write(
    root,
    '.storybook/preview.jsx',
    plain
      ? "import '../src/global.css';export default {};"
      : `import React from 'react';import '../src/global.css';${mock ? "import { sb } from 'storybook/test';sb.mock(import('../src/service.js'));" : ''}export default {decorators:[Story=><div data-layout="${scenario === 'preview' ? 'changed' : 'base'}"><Story/></div>]};`
  );
  write(
    root,
    '.storybook/fixture.json',
    JSON.stringify({ label: changedHelper ? 'after' : 'before' })
  );
  write(
    root,
    'src/Button.jsx',
    `import React from 'react';/** A fixture button. */ export function Button({children,...props}) { return <button {...props}>{children}</button>; }`
  );
  write(
    root,
    'src/OtherButton.jsx',
    `import React from 'react';/** Another fixture button. */ export function Button({children,...props}) { return <button {...props}>{children}</button>; }`
  );
  write(
    root,
    'src/A.stories.jsx',
    `import React from 'react';import {Button} from './Button.jsx';${helperInB ? '' : "import data from '../.storybook/fixture.json';"}${mock ? "import { label } from './service.js';" : ''}${next ? "import Link from 'next/link';" : ''}export default {title:'A',component:Button};export const Example={render:()=>${next ? '<Link href="/example">' : '<Button>'}${helperInB ? 'unchanged' : '{data.label}'}${mock ? '{label}' : ''}${next ? '</Link>' : '</Button>'}};`
  );
  write(
    root,
    'src/B.stories.jsx',
    `import React from 'react';import {Button} from './${scenario.startsWith('plain-a') ? 'Button' : 'OtherButton'}.jsx';${helperInB ? "import data from '../.storybook/fixture.json';" : ''}export default {title:'B',component:Button};export const Example={render:()=> <Button data-hidden="HIDDEN_MARKER">${helperInB ? '{data.label}' : 'unchanged'}</Button>};`
  );
  write(root, 'src/service.js', 'export const label="real service";');
  write(root, 'src/__mocks__/service.js', 'export const label="mock service";');
  write(
    root,
    'src/global.css',
    `body {color:${scenario === 'css' ? 'blue' : 'red'}; background-image:url('../public/logo.svg');}`
  );
  write(
    root,
    'public/logo.svg',
    `<svg xmlns="http://www.w3.org/2000/svg"><path fill="${scenario === 'static' ? 'blue' : 'red'}" d="M0 0h8v8z"/></svg>`
  );
  if (vite)
    write(
      root,
      'vite.config.ts',
      "import react from '@vitejs/plugin-react';export default {plugins:[react()]};"
    );
  if (next) write(root, 'next.config.mjs', 'export default {reactStrictMode:true};');
}

function build(root: string, scenario: Scenario) {
  const log = openSync(join(root, `${scenario}.log`), 'w');
  try {
    execFileSync(process.execPath, [join(root, 'run.mjs')], {
      cwd: root,
      stdio: ['ignore', log, log],
    });
  } finally {
    closeSync(log);
  }
  const source = readFileSync(join(root, 'storybook-static/preview-stats.json'), 'utf8');
  write(root, `${scenario}.stats.json`, source);
  const evidence: TurbosnapOutput = JSON.parse(source).turbosnapOutput;
  return evidence;
}

interface Manifest {
  configAnalysis: { mode: 'output' | 'directory'; reason: string; storyScopedCandidates: string[] };
  configCoverage?: {
    version: 1;
    stableConfigHash: string;
    globalOutputHash: string;
    storyOutputHashes: Record<string, string>;
  };
  storybookConfigHashes: Record<string, string>;
  storyFiles: Record<string, string>;
}

function runCli(root: string, label: string, extra: string[] = []): Manifest | undefined {
  if (!cli) return undefined;
  const result = execFileSync(
    process.execPath,
    [
      resolve(cli),
      'turbosnap-manifest',
      '--stats-file',
      'storybook-static/preview-stats.json',
      '--storybook-build-dir',
      'storybook-static',
      '--static-dir',
      'public',
      ...extra,
    ],
    { cwd: root, encoding: 'utf8' }
  );
  write(root, `${label}.manifest.json`, result);
  return JSON.parse(result);
}

function verifyCli(root: string, scenario: Scenario, fallback: boolean) {
  const manifest = runCli(root, scenario);
  if (!manifest) return {};
  const statsPath = join(root, 'storybook-static/preview-stats.json');
  const original = readFileSync(statsPath, 'utf8');
  const { turbosnapOutput: _output, ...legacyStats } = JSON.parse(original);
  try {
    writeFileSync(statsPath, JSON.stringify(legacyStats));
    const legacy = runCli(root, `${scenario}-legacy`);
    assert(legacy);
    assert.equal(legacy.configAnalysis.mode, 'directory');
    assert.equal(legacy.configCoverage, undefined);
    assert.deepEqual(manifest.storybookConfigHashes, legacy.storybookConfigHashes);
    assert.deepEqual(manifest.storyFiles, legacy.storyFiles);
  } finally {
    writeFileSync(statsPath, original);
  }
  if (fallback) {
    assert.equal(manifest.configAnalysis.mode, 'directory');
    assert.equal(manifest.configCoverage, undefined);
  } else {
    assert.equal(manifest.configAnalysis.mode, 'output', manifest.configAnalysis.reason);
    assert(manifest.configCoverage);
    assert.deepEqual(
      Object.keys(manifest.configCoverage.storyOutputHashes).sort(),
      Object.keys(manifest.storyFiles).sort()
    );
    assert(manifest.configAnalysis.storyScopedCandidates.includes('./.storybook/fixture.json'));
  }
  if (scenario === 'base' || scenario === 'helper') {
    const excluded = runCli(root, `${scenario}-untraced`, ['--untraced', '.storybook/**']);
    const narrowExcluded = runCli(root, `${scenario}-untraced-helper`, [
      '--untraced',
      '.storybook/fixture.json',
    ]);
    if (scenario === 'base') {
      const stalePath = join(root, 'storybook-static/added-after-build.txt');
      try {
        writeFileSync(stalePath, 'The upload inventory no longer matches the producer.');
        const stale = runCli(root, 'stale-output');
        assert(stale);
        assert.equal(stale.configAnalysis.mode, 'directory');
        assert.equal(stale.configAnalysis.reason, 'stale-output-evidence');
        assert.equal(stale.configCoverage, undefined);
        assert.deepEqual(stale.storybookConfigHashes, manifest.storybookConfigHashes);
        assert.deepEqual(stale.storyFiles, manifest.storyFiles);
      } finally {
        unlinkSync(stalePath);
      }
    }
    return { manifest, excluded, narrowExcluded };
  }
  return { manifest };
}

for (const framework of frameworks) {
  const root = resolve(destination, framework);
  assert(!existsSync(root), `Use a fresh output directory: ${root}`);
  mkdirSync(root, { recursive: true });
  dependencies(join(repository, 'node_modules'), join(root, 'node_modules'));
  if (!existsSync(join(root, 'node_modules/next')))
    symlinkSync(join(repository, 'code/node_modules/next'), join(root, 'node_modules/next'), 'dir');
  write(
    root,
    'package.json',
    JSON.stringify({
      name: 'storybook-output-fixture',
      private: true,
      type: 'module',
      dependencies: {
        ...Object.fromEntries(
          ['storybook', `@storybook/${framework}`, 'react', 'react-dom'].map((name) => [
            name,
            JSON.parse(readFileSync(join(root, 'node_modules', name, 'package.json'), 'utf8'))
              .version,
          ])
        ),
      },
    })
  );
  write(
    root,
    'tsconfig.json',
    JSON.stringify({
      compilerOptions: {
        jsx: 'react-jsx',
        allowJs: true,
        moduleResolution: 'bundler',
        module: 'esnext',
        target: 'ES2022',
      },
      include: ['src'],
    })
  );
  write(
    root,
    '.gitignore',
    'node_modules/\nstorybook-static/\n*.log\n*.stats.json\n*.manifest.json\n'
  );
  write(
    root,
    'run.mjs',
    `process.argv=[process.argv[0],${JSON.stringify(join(root, 'node_modules/storybook/dist/bin/core.js'))},'build','--config-dir','.storybook','--output-dir','storybook-static','--stats-json','--disable-telemetry'];await import(${JSON.stringify(join(root, 'node_modules/storybook/dist/bin/core.js'))});`
  );
  configure(root, framework, 'base');
  execFileSync('git', ['init', '--initial-branch=main'], { cwd: root });
  execFileSync(
    'git',
    ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'add', '.'],
    { cwd: root }
  );
  execFileSync(
    'git',
    [
      '-c',
      'user.name=Fixture',
      '-c',
      'user.email=fixture@example.invalid',
      'commit',
      '-m',
      'Initialize output verification fixture',
    ],
    { cwd: root }
  );
  let baseline: TurbosnapOutput | undefined;
  let baselineManifest: Manifest | undefined;
  let baselineExcluded: Manifest | undefined;
  let baselineNarrowExcluded: Manifest | undefined;
  for (const scenario of [
    'base',
    'helper',
    'preview',
    'css',
    'static',
    'hidden-base',
    'hidden-helper',
    'mock-base',
    'mock-helper',
    ...(framework.endsWith('vite')
      ? []
      : (['plain-a-base', 'plain-a-helper', 'plain-b-base', 'plain-b-helper', 'eager'] as const)),
    'late',
  ] satisfies Scenario[]) {
    configure(root, framework, scenario);
    const fallback =
      scenario === 'late' ||
      scenario === 'eager' ||
      (!framework.endsWith('vite') && scenario.startsWith('hidden'));
    // Core services may initialize caches on the first build after changing configuration.
    // Both final outputs are still validated; comparisons use a settled baseline.
    if (scenario.endsWith('base')) {
      assert.equal(build(root, scenario).status, fallback ? 'incomplete' : 'complete');
    }
    const evidence = build(root, scenario);
    const { manifest, excluded, narrowExcluded } = verifyCli(root, scenario, fallback);
    if (fallback) {
      assert.equal(
        evidence.status,
        'incomplete',
        `${framework}/${scenario}: late output changes must invalidate evidence`
      );
      if (scenario === 'eager') assert.equal(evidence.reason, 'unrecognized-webpack-final-output');
    } else {
      assert.equal(evidence.status, 'complete', `${framework}/${scenario}: ${evidence.reason}`);
      if (scenario.endsWith('base')) {
        baseline = evidence;
        baselineManifest = manifest;
        baselineExcluded = excluded;
        baselineNarrowExcluded = narrowExcluded;
      } else if (scenario.endsWith('helper')) {
        assert(baseline);
        if (scenario !== 'hidden-helper')
          assert.equal(
            evidence.globalOutputHash,
            baseline.globalOutputHash,
            `${framework}/${scenario}: helper must leave global output unchanged`
          );
        const changedStory =
          scenario === 'plain-b-helper' ? './src/B.stories.jsx' : './src/A.stories.jsx';
        const otherStory =
          scenario === 'plain-b-helper' ? './src/A.stories.jsx' : './src/B.stories.jsx';
        if (manifest) {
          assert(baselineManifest?.configCoverage && manifest.configCoverage);
          const { storybookConfigFiles: beforeConfig, ...beforeGlobals } =
            baselineManifest.storybookConfigHashes;
          const { storybookConfigFiles: afterConfig, ...afterGlobals } =
            manifest.storybookConfigHashes;
          assert.notEqual(beforeConfig, afterConfig);
          assert.deepEqual(beforeGlobals, afterGlobals);
          assert.equal(
            manifest.configCoverage.stableConfigHash,
            baselineManifest.configCoverage.stableConfigHash
          );
          if (scenario !== 'hidden-helper')
            assert.equal(
              manifest.configCoverage.globalOutputHash,
              baselineManifest.configCoverage.globalOutputHash
            );
          assert.notEqual(
            manifest.storyFiles[changedStory],
            baselineManifest.storyFiles[changedStory]
          );
          assert.equal(manifest.storyFiles[otherStory], baselineManifest.storyFiles[otherStory]);
          assert.deepEqual(manifest.configCoverage.storyOutputHashes, evidence.storyOutputHashes);
        }
        if (scenario === 'helper' && manifest) {
          assert(excluded && baselineExcluded && narrowExcluded && baselineNarrowExcluded);
          assert.deepEqual(excluded.storybookConfigHashes, baselineExcluded.storybookConfigHashes);
          assert.deepEqual(excluded.storyFiles, baselineExcluded.storyFiles);
          assert.deepEqual(
            narrowExcluded.storybookConfigHashes,
            baselineNarrowExcluded.storybookConfigHashes
          );
          assert.deepEqual(narrowExcluded.storyFiles, baselineNarrowExcluded.storyFiles);
        }
        assert.notEqual(
          evidence.storyOutputHashes[changedStory],
          baseline.storyOutputHashes[changedStory]
        );
        if (scenario === 'hidden-helper')
          assert.notEqual(
            evidence.storyOutputHashes[otherStory],
            baseline.storyOutputHashes[otherStory],
            `${framework}/${scenario}: shared chunk must widen story coverage`
          );
        else if (scenario !== 'plain-a-helper' || framework === 'react-webpack5')
          assert.equal(
            evidence.storyOutputHashes[otherStory],
            baseline.storyOutputHashes[otherStory],
            `${framework}/${scenario}: unrelated story must remain unchanged`
          );
      } else {
        assert(baseline);
        assert.notEqual(
          evidence.globalOutputHash,
          baseline.globalOutputHash,
          `${framework}/${scenario}: global change must veto inheritance`
        );
      }
    }
    logger.info(`${framework}/${scenario}: ${evidence.status} (${root})`);
  }
}
logger.info(`Output evidence saved in ${destination}`);
