// chromaui/chromatic webapp: nextjs-vite, ~490 story files, ~3.8k stories, addon-vitest.
//
// One git worktree per build at <chromatic>.worktrees/perf-harness-<build key>, detached at a pinned
// commit. Preparing a worktree points every Storybook monorepo package at the build (dependencies
// plus root `resolutions`), runs `yarn install`, installs the Playwright Chromium that Vitest
// browser mode needs, and commits the result locally so change detection starts from a clean tree.
// The main checkout is never touched.
import { existsSync, readFileSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';

import { log, run, sh } from '../lib/util.mjs';
import { componentsFromIndex, spreadTargets } from './shared.mjs';

// chromaui/chromatic main on 2026-09-23, the commit SB-2057 measured.
export const DEFAULT_CHROMATIC_REF = '4d8379e124247e9ef08ff1afcde097a05f7e7d63';

// Every storybookjs/storybook monorepo package the checkout resolves, directly or transitively.
// `@storybook/addon-mcp` and `eslint-plugin-storybook` stay on Chromatic's own versions.
export const monorepoPackages = [
  'storybook',
  '@storybook/addon-a11y',
  '@storybook/addon-docs',
  '@storybook/addon-links',
  '@storybook/addon-vitest',
  '@storybook/builder-vite',
  '@storybook/builder-webpack5',
  '@storybook/core-webpack',
  '@storybook/nextjs-vite',
  '@storybook/preset-server-webpack',
  '@storybook/react',
  '@storybook/react-dom-shim',
  '@storybook/react-vite',
  '@storybook/server',
  '@storybook/server-webpack5',
  'vite-plugin-storybook-nextjs',
];

const workspaceManifests = [
  'package.json',
  'lib/git-provider-content/package.json',
  'services/index/package.json',
  'services/webapp/package.json',
];

export async function ensureProject({ build, chromaticDir, chromaticRef }) {
  const dir = `${chromaticDir}.worktrees/perf-harness-${build.key}`;
  const buildMarker = join(dir, 'node_modules/.perf-harness-build');
  const want = `${build.key} ${chromaticRef}`;
  if (existsSync(buildMarker) && (await readFile(buildMarker, 'utf8')) === want) {
    return dir;
  }
  if (!existsSync(dir)) {
    sh('git', ['-C', chromaticDir, 'fetch', '--quiet', 'origin'], {});
    sh('git', ['-C', chromaticDir, 'worktree', 'add', '--detach', dir, chromaticRef]);
  } else {
    sh('git', ['-C', dir, 'reset', '--hard', '--quiet', chromaticRef]);
  }
  log(`preparing Chromatic worktree ${dir} for ${build.label}`);
  for (const manifest of workspaceManifests) {
    const path = join(dir, manifest);
    const pkg = JSON.parse(await readFile(path, 'utf8'));
    for (const field of ['dependencies', 'devDependencies']) {
      for (const name of Object.keys(pkg[field] ?? {})) {
        if (monorepoPackages.includes(name)) {
          pkg[field][name] = build.spec(name);
        }
      }
    }
    if (manifest === 'package.json') {
      pkg.resolutions = {
        ...pkg.resolutions,
        ...Object.fromEntries(monorepoPackages.map((name) => [name, build.spec(name)])),
      };
    }
    await writeFile(path, JSON.stringify(pkg, null, 2) + '\n');
  }

  // The docgen workload turns on the docgen server with an environment variable, so one install
  // serves every workload.
  const mainPath = join(dir, '.storybook/main.ts');
  const main = await readFile(mainPath, 'utf8');
  const anchor = '    componentsManifest: true,\n';
  if (!main.includes(anchor)) {
    throw new Error(`Cannot find the features block in ${mainPath}`);
  }
  await writeFile(
    mainPath,
    main.replace(
      anchor,
      `${anchor}    experimentalDocgenServer: process.env.PERF_HARNESS_DOCGEN_SERVER === '1',\n`
    )
  );

  await run('yarn', ['install'], {
    cwd: dir,
    env: { ...process.env, YARN_ENABLE_IMMUTABLE_INSTALLS: 'false' },
  });
  // Vitest browser mode launches Chromium through the worktree's own Playwright version.
  await run('npx', ['--no-install', 'playwright', 'install', 'chromium'], { cwd: dir });
  sh('git', ['-C', dir, 'add', '-A']);
  sh('git', [
    '-C',
    dir,
    '-c',
    'user.name=perf-harness',
    '-c',
    'user.email=perf-harness@localhost',
    'commit',
    '-q',
    '--no-verify',
    '-m',
    `perf-harness: ${build.label}`,
  ]);
  await writeFile(buildMarker, want);
  return dir;
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Offset just inside `<FileName>Props {`, or -1.
function propsInsertion(source, componentFile) {
  const base = basename(componentFile, extname(componentFile));
  const match = new RegExp(
    `(?:interface\\s+${escape(base)}Props\\b[^{]*|type\\s+${escape(base)}Props\\b[^=]*=\\s*)\\{`
  ).exec(source);
  return match ? match.index + match[0].length : -1;
}

// Adapter used by run.mjs.
export async function createProject(dir) {
  const project = {
    dir,
    // The docgen worker path runs out of the default heap on this project (SB-2057).
    nodeArgs: ['--max-old-space-size=8192'],
    searchQuery: 'button',
    prepare(index) {
      const stories = Object.values(index.entries).filter((e) => e.type === 'story');
      project.index = index;
      project.firstStoryId = stories[0].id;
      project.storyIdsAll = stories.map((e) => e.id);
      project.components = componentsFromIndex(index)
        .filter((c) => c.componentPath && /\.tsx?$/.test(c.componentPath))
        .map((c) => ({ ...c, file: join(dir, c.componentPath) }))
        .filter((c) => {
          try {
            return propsInsertion(readFileSync(c.file, 'utf8'), c.file) !== -1;
          } catch {
            return false;
          }
        })
        .map((c) => ({
          ...c,
          apply: (source, marker) => {
            const at = propsInsertion(source, c.file);
            return `${source.slice(0, at)}\n  /** Bench marker. */\n  benchRevision?: '${marker}';${source.slice(at)}`;
          },
        }));
      project.componentCount = componentsFromIndex(index).length;
      project.lastComponentId = project.components.at(-1).componentId;
    },
    editTargets: (sizes) => spreadTargets(project.components, sizes),
    // Only one docs entry exists, so visiting docs here means moving between stories.
    docsEntryIds: (n) => {
      const firstStoryPerComponent = new Map();
      for (const e of Object.values(project.index.entries)) {
        const componentId = e.id.split('--')[0];
        if (e.type === 'story' && !firstStoryPerComponent.has(componentId)) {
          firstStoryPerComponent.set(componentId, e.id);
        }
      }
      const ids = [...firstStoryPerComponent.values()];
      const step = Math.max(1, Math.floor(ids.length / n));
      return ids.filter((_, i) => i % step === 0).slice(0, n);
    },
    storyIds: (n) => project.storyIdsAll.slice(0, n),
  };
  return project;
}
