/**
 * Compares the glob results of `glob` / `globby` (Storybook 10) with the `tinyglobby` code that
 * replaced them in Storybook 11, for every call site in `code/core`, on generated fixture trees.
 *
 * Run with `node scripts/glob-migration/compare-globs.ts`. Symlinks need a file system that
 * supports them (macOS or Linux).
 */
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';

// eslint-disable-next-line depend/ban-dependencies
import { glob as globV10, globSync as globSyncV10 } from 'glob';
// eslint-disable-next-line depend/ban-dependencies
import { globby } from 'globby';
// eslint-disable-next-line depend/ban-dependencies
import slash from 'slash';

import {
  commonGlobOptions,
  expandDirectoryPattern,
  globCaseSensitiveMatch,
} from '../../code/core/src/common/utils/common-glob-options.ts';

// Resolve tinyglobby the way code/core does, so the comparison includes core's patched copy.
const tinyglobby: typeof import('tinyglobby') = createRequire(
  join(import.meta.dirname, '../../code/core/package.json')
)('tinyglobby');

const FILES = [
  'package.json',
  'dist/package.json',
  'node_modules/x/package.json',
  'node_modules/pkg/Foo.stories.tsx',
  'packages/a/package.json',
  'packages/b/package.json',
  'packages/c/PACKAGE.JSON',
  'packages/.hidden/package.json',
  'packages/a/src/A.stories.tsx',
  'external/package.json',
  'external/Ext.stories.tsx',
  'external/Ext.tsx',
  '.storybook/main.ts',
  '.storybook/Main.JS',
  '.storybook/preview.ts',
  'src/Button.stories.tsx',
  'src/Button.tsx',
  'src/Button.test.tsx',
  'src/Button.d.ts',
  'src/Intro.mdx',
  'src/Readme.MDX',
  'src/Header.stories.js',
  'src/Header.stories.mjs',
  'src/Header.stories.jsx',
  'src/Page.stories.ts',
  'src/UPPER.STORIES.TSX',
  'src/Mixed.Stories.tsx',
  'src/v1.stories.tsx',
  'src/v2.stories.tsx',
  'src/v3.stories.tsx',
  'src/stories.tsx',
  'src/.dotfile.stories.tsx',
  'src/.hidden/Hidden.stories.tsx',
  'src/nested/deep/Card.stories.ts',
  'src/nested/Card.test.tsx',
  'src/nested/Comp.tsx',
  'src/node_modules/lib/Inner.stories.tsx',
  'src/(group)/Grouped.stories.tsx',
  'src/(group)/Grouped.tsx',
  'src/[id]/Param.stories.tsx',
  'src/{curly}/Curly.stories.tsx',
  'src/with space/Space.stories.tsx',
  'src/dirlike.stories.tsx/inner.js',
  'src/dirlike.mdx/inner.mdx',
  'src/plain/a.js',
  'src/plain/b.stories.tsx',
  'src/plain/sub/c.ts',
  'src/stories/Button.tsx',
  'src/stories/Header.jsx',
  'src/stories/Other.tsx',
  'src/__mocks__/m.tsx',
  'src/build/b.tsx',
  'src/x.config.tsx',
  'src/x.spec.tsx',
  'other/Linked.stories.tsx',
  'other/package.json',
  'other/Comp.tsx',
  'storybook-static/s.tsx',
];

const SYMLINKS: Array<[target: string, path: string]> = [
  ['../other', 'src/linked'],
  ['../nowhere.stories.tsx', 'src/broken.stories.tsx'],
  ['../other/Linked.stories.tsx', 'src/fileLink.stories.tsx'],
  ['../external', 'packages/linked-pkg'],
  ['../other/package.json', 'packages/a/sub-package.json'],
  ['../../other/package.json', 'packages/fileLinkPkg/package.json'],
];

const STORY_PATTERNS = [
  '**/*.@(mdx|stories.@(js|jsx|mjs|ts|tsx))',
  '**/*.stories.tsx',
  '*.stories.tsx',
  '**/*.mdx',
  '*.mdx',
  '!(nested)/**/*.stories.*',
  '!**/*.test.tsx',
  '!(*.test).tsx',
  '**/*.stories.{ts,tsx}',
  '**/v{1..2}.stories.tsx',
  '**/*.stories.+(ts|tsx)',
  '**/?(*.)stories.tsx',
  '**/[A-C]*.stories.tsx',
  '**/[!A-C]*.stories.tsx',
  '**/*.STORIES.TSX',
  '**/*.Stories.tsx',
  'nested',
  'nested/',
  './nested',
  'nested/**',
  'Button.stories.tsx',
  'dirlike.stories.tsx',
  '**/dirlike.stories.tsx',
  '**/*.stories.tsx/**',
  'dirlike.mdx',
  '**/*',
  '**',
  '*',
  'linked/**',
  'linked/*.stories.tsx',
  '**/node_modules/**/*.stories.tsx',
  'node_modules/**/*.stories.tsx',
  '\\(group\\)/*.stories.tsx',
  '(group)/*.stories.tsx',
  '[id]/*.stories.tsx',
  '\\[id\\]/*.stories.tsx',
  '{curly}/*.stories.tsx',
  '\\{curly\\}/*.stories.tsx',
  'with space/*.stories.tsx',
  '**/with space/**',
  '../other/*.stories.tsx',
  '../**/Linked.stories.tsx',
  '.hidden/*.stories.tsx',
  '**/.hidden/*.stories.tsx',
  '.*.stories.tsx',
  '**/*.stories.@(js|jsx)',
  '**/Header.stories.@(js|mjs)',
  'plain',
  'plain/**/*.ts',
  '**/*.ts?(x)',
  '**/@(Button|Page).stories.*',
  '**/*.!(stories).tsx',
  '**/{Button,Page}.stories.{ts,tsx}',
  'nested/deep/Card.stories.ts',
  '**/nested/**/Card.stories.ts',
  'nested/loop/**/Card.stories.ts',
  '**/fileLink.stories.tsx',
  '**/broken.stories.tsx',
  '**/*.stories.ts*',
  '**/stories/*',
  'stories',
  'stories/',
  '**/*.stories.(tsx|ts)',
  '**/Button.(stories|test).tsx',
  '**/*.{stories,test}.tsx',
  '**/{,nested/}*.stories.ts*',
  'UPPER.STORIES.TSX',
  'upper.stories.tsx',
  'does-not-exist',
  '**/Grouped.stories.tsx',
  '**/(group)/**',
  'x.config.tsx',
  '*.{config,spec}.tsx',
  '**/[[:upper:]]*.stories.tsx',
  '{Nested,Plain}/**/*.ts',
];

const GHOST_IGNORE = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/__mocks__/**',
  '**/build/**',
  '**/storybook-static/**',
  '**/*.test.*',
  '**/*.d.*',
  '**/*.config.*',
  '**/*.spec.*',
  '**/*.stories.*',
  '**/stories/{Button,Header,Page}.*',
  '**/stories/{button,header,page}.*',
];

const MAIN_EXTENSIONS = '{.js,.mjs,.cjs,.jsx,.ts,.mts,.cts,.tsx}';

function makeFixture(root: string) {
  for (const file of FILES) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), '');
  }
  for (const [target, path] of SYMLINKS) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    symlinkSync(target, join(root, path));
  }
}

type Result = string[] | number | string;
type Difference = { callSite: string; label: string; old: Result; new: Result };

async function compareFixture(root: string) {
  const counts: Record<string, { same: number; different: number }> = {};
  const differences: Difference[] = [];

  const normalize = (result: Result) =>
    Array.isArray(result) ? result.map((path) => path.split(root).join('<root>')).sort() : result;
  const run = async (fn: () => Result | Promise<Result>): Promise<Result> => {
    try {
      return normalize(await fn());
    } catch (error) {
      return `error: ${(error as Error).message.split('\n')[0]}`;
    }
  };
  const compare = async (
    callSite: string,
    label: string,
    oldFn: () => Result | Promise<Result>,
    newFn: () => Result | Promise<Result>
  ) => {
    const [oldResult, newResult] = [await run(oldFn), await run(newFn)];
    counts[callSite] ??= { same: 0, different: 0 };
    if (JSON.stringify(oldResult) === JSON.stringify(newResult)) {
      counts[callSite].same++;
    } else {
      counts[callSite].different++;
      differences.push({ callSite, label, old: oldResult, new: newResult });
    }
  };

  for (const dir of [
    'src',
    '.',
    'src/(group)',
    'src/with space',
    'src/linked',
    'src/nested',
    'packages',
    'src/[id]',
  ]) {
    const globCwd = slash(resolve(root, dir));
    for (const files of STORY_PATTERNS) {
      const pattern = files.startsWith('!') ? `./${files}` : files;
      await compare(
        'StoryIndexGenerator',
        `cwd=${dir} files=${files}`,
        () =>
          globby(pattern, {
            absolute: true,
            cwd: globCwd,
            ...commonGlobOptions(pattern),
            onlyFiles: true,
          }),
        () =>
          tinyglobby.glob(expandDirectoryPattern(pattern, globCwd), {
            absolute: true,
            cwd: globCwd,
            ...commonGlobOptions(pattern),
            expandDirectories: false,
          })
      );
    }
  }

  for (const dir of [
    'src',
    'src/nested',
    'src/(group)',
    'src/with space',
    'src/linked',
    'src/[id]',
    'src/{curly}',
    'node_modules',
    'src/node_modules',
  ]) {
    const absolutePath = resolve(root, dir);
    for (const files of STORY_PATTERNS) {
      const oldDirGlob = join(absolutePath, '**', basename(files));
      const newDirGlob = `**/${basename(files)}`;
      await compare(
        'watchStorySpecifiers',
        `added dir=${dir} files=${files}`,
        () => globby(slash(oldDirGlob), commonGlobOptions(oldDirGlob)),
        () =>
          tinyglobby.glob(newDirGlob, {
            ...commonGlobOptions(join(absolutePath, newDirGlob)),
            cwd: absolutePath,
            absolute: true,
            expandDirectories: false,
          })
      );
    }
  }

  const scanPatterns = [
    '**/*.{mjs,cjs,js,jsx,ts,tsx,mdx}',
    'src',
    'src/',
    'src/plain',
    'src/**/*.tsx',
    'src/Button.tsx',
    '**/*',
    '!src/**',
    resolve(root, 'src'),
    `${resolve(root, 'src')}/**/*.mdx`,
    'other',
    '.storybook',
    '**/.storybook/*',
    'src/(group)',
    'src/linked',
    ...STORY_PATTERNS,
  ];
  for (const pattern of scanPatterns) {
    await compare(
      'scanAndTransformFiles',
      `pattern=${pattern.split(root).join('<root>')}`,
      () =>
        globby([pattern], {
          ...commonGlobOptions(''),
          ignore: ['**/node_modules/**'],
          dot: true,
          cwd: root,
          absolute: true,
        }),
      () =>
        tinyglobby.glob(expandDirectoryPattern(pattern, root), {
          ...commonGlobOptions(''),
          ignore: ['**/node_modules/**'],
          dot: true,
          cwd: root,
          absolute: true,
          expandDirectories: false,
        })
    );
  }

  const configDir = join(root, '.storybook');
  const mdxSpecifiers: Array<[directory: string, files: string]> = [
    ['../src', '**/*.@(mdx|stories.@(js|jsx|mjs|ts|tsx))'],
    ['../src', '**/*.mdx'],
    ['../src', '*.@(mdx|tsx)'],
    ['../src', '**/*.stories.tsx'],
    ['../src', '!(nested)/**/*.stories.*'],
    ['../src/(group)', '*'],
    ['../src/with space', '*'],
    ['../src', '**/*.STORIES.TSX'],
    ['../src', '**/*.Stories.tsx'],
    ['../src', '**/*.MDX'],
    ['../src', 'linked/**'],
    ['../src', '**/Linked.stories.tsx'],
    ['..', 'node_modules/**/*.stories.tsx'],
    ['..', '**/*.stories.tsx'],
    ['../src', 'nested'],
    ['../src', '**/Card.stories.ts'],
    ['../src', 'dirlike.mdx'],
    ['../src', '**/.hidden/*.stories.tsx'],
    [resolve(root, 'src'), '**/*.mdx'],
  ];
  for (const [directory, files] of mdxSpecifiers) {
    await compare(
      'removeMDXEntries',
      `directory=${directory.split(root).join('<root>')} files=${files}`,
      async () => {
        const pattern = join(directory, files);
        const absolutePattern = isAbsolute(pattern) ? pattern : join(configDir, pattern);
        const absoluteDirectory = isAbsolute(directory) ? directory : join(configDir, directory);
        const found = await globV10(slash(absolutePattern), {
          ...commonGlobOptions(absolutePattern),
          follow: true,
        });
        return found.map((file) => relative(absoluteDirectory, file));
      },
      async () => {
        const absoluteDirectory = resolve(configDir, directory);
        const found = await tinyglobby.glob(files, {
          ...commonGlobOptions(join(absoluteDirectory, files)),
          cwd: absoluteDirectory,
          absolute: true,
          caseSensitiveMatch: globCaseSensitiveMatch,
          expandDirectories: false,
        });
        return found.map((file) => relative(absoluteDirectory, file));
      }
    );
  }

  for (const projectRoot of [root, join(root, 'packages'), join(root, 'src')]) {
    const ignore = ['**/node_modules/**', '**/dist/**'];
    await compare(
      'JsPackageManager',
      `projectRoot=${relative(root, projectRoot) || '.'}`,
      () => globSyncV10('**/package.json', { cwd: projectRoot, absolute: true, ignore }),
      () =>
        tinyglobby.globSync('**/package.json', {
          cwd: projectRoot,
          absolute: true,
          ignore,
          caseSensitiveMatch: globCaseSensitiveMatch,
          followSymbolicLinks: false,
          expandDirectories: false,
        })
    );
  }

  const workspaces = [
    ['packages/*'],
    ['packages/*', '!packages/b'],
    ['packages/**'],
    ['./packages/*'],
    ['packages/*/'],
    ['Packages/*'],
    ['packages/{a,b}'],
    ['packages/linked-pkg'],
    ['packages/*', '!packages/linked-pkg'],
    ['src/*'],
    ['external', 'other'],
  ];
  for (const patterns of workspaces) {
    const positive = patterns.filter((p) => !p.startsWith('!')).map((p) => `${p}/package.json`);
    const ignore = patterns
      .filter((p) => p.startsWith('!'))
      .map((p) => `${p.slice(1)}/package.json`);
    await compare(
      'NPMProxy',
      `workspaces=${JSON.stringify(patterns)}`,
      () => globSyncV10(positive, { cwd: root, absolute: true, ignore }).map((path) => slash(path)),
      () =>
        tinyglobby.globSync(positive, {
          cwd: root,
          absolute: true,
          ignore,
          caseSensitiveMatch: globCaseSensitiveMatch,
          expandDirectories: false,
        })
    );
  }

  for (const cwd of [root, join(root, 'src')]) {
    for (const pattern of ['**/*.{tsx,jsx}', '**/*.tsx', 'src/**/*.tsx']) {
      await compare(
        'ghost stories',
        `cwd=${relative(root, cwd) || '.'} pattern=${pattern}`,
        () => globV10(pattern, { cwd, absolute: true, ignore: GHOST_IGNORE }),
        () =>
          tinyglobby.glob(pattern, {
            cwd,
            absolute: true,
            ignore: GHOST_IGNORE,
            caseSensitiveMatch: globCaseSensitiveMatch,
            followSymbolicLinks: false,
            expandDirectories: false,
          })
      );
    }
  }

  for (const dir of ['.storybook', 'src', 'src/(group)', 'src/[id]', 'missing']) {
    await compare(
      'validateConfigurationFiles',
      `configDir=${dir} (number of main files)`,
      async () =>
        (await globV10(slash(resolve(root, dir, `main${MAIN_EXTENSIONS}`)), { cwd: root })).length,
      async () =>
        (
          await tinyglobby.glob(`main${MAIN_EXTENSIONS}`, {
            cwd: resolve(root, dir),
            caseSensitiveMatch: globCaseSensitiveMatch,
            expandDirectories: false,
          })
        ).length
    );
  }

  return { counts, differences };
}

const workDir = mkdtempSync(join(tmpdir(), 'storybook-glob-migration-'));
try {
  for (const rootName of ['project', 'project (copy) [1]']) {
    const root = join(workDir, rootName);
    makeFixture(root);
    const { counts, differences } = await compareFixture(root);

    console.log(`\n# Fixture root "${rootName}" on ${process.platform}\n`);
    for (const [callSite, { same, different }] of Object.entries(counts)) {
      console.log(
        `${callSite.padEnd(28)} same ${String(same).padStart(4)}  different ${String(different).padStart(4)}`
      );
    }
    for (const difference of differences) {
      console.log(`\n${difference.callSite}: ${difference.label}`);
      if (Array.isArray(difference.old) && Array.isArray(difference.new)) {
        const before = difference.old;
        const after = difference.new;
        console.log(
          `  only before: ${JSON.stringify(before.filter((path) => !after.includes(path)))}`
        );
        console.log(
          `  only after:  ${JSON.stringify(after.filter((path) => !before.includes(path)))}`
        );
      } else {
        console.log(
          `  before: ${JSON.stringify(difference.old)}\n  after:  ${JSON.stringify(difference.new)}`
        );
      }
    }
  }
} finally {
  rmSync(workDir, { recursive: true, force: true });
}
