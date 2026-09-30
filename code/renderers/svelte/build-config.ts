import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { x as exec } from 'tinyexec';

import type { BuildEntries } from '../../../scripts/build/utils/entry-utils.ts';

// Svelte CSF's runtime ships as uncompiled `.svelte` files, `.svelte.js` rune modules and
// `.svelte.d.ts` types, so the user's Svelte compiler compiles it. esbuild can't produce that, so
// we package these files with `svelte-package`.
const SVELTE_CSF_RUNTIME_FILES = [
  'index.ts',
  'types.ts',
  'constants.ts',
  'legacy-types.d.ts',
  'utils/identifier-utils.ts',
  'runtime',
];
const SVELTE_CSF_STAGING_DIR = '.svelte-csf-staging';
const SVELTE_CSF_OUTPUT_DIR = 'dist/svelte-csf';

async function packageSvelteCsfRuntime(cwd: string) {
  const sourceDir = path.join(cwd, 'src', 'svelte-csf');
  const stagingDir = path.join(cwd, SVELTE_CSF_STAGING_DIR);
  const outputDir = path.join(cwd, SVELTE_CSF_OUTPUT_DIR);

  await rm(stagingDir, { recursive: true, force: true });
  for (const file of SVELTE_CSF_RUNTIME_FILES) {
    await cp(path.join(sourceDir, file), path.join(stagingDir, file), {
      recursive: true,
      filter: (source) => !/\.test\.[jt]s$/.test(source),
    });
  }

  // The monorepo imports with `.ts` extensions, but the packaged files must import `.js`.
  // svelte-package doesn't rewrite them, so rewrite them in the staged copy.
  for (const file of await readdir(stagingDir, { recursive: true })) {
    if (!/\.ts$/.test(file) || file.endsWith('.d.ts')) {
      continue;
    }
    const filePath = path.join(stagingDir, file);
    const code = await readFile(filePath, 'utf8');
    await writeFile(
      filePath,
      code.replace(/(from\s+|import\()(['"])(\.{1,2}\/[^'"]+?)(?<!\.d)\.ts\2/g, '$1$2$3.js$2')
    );
  }

  try {
    await exec(
      'svelte-package',
      [
        '-i',
        SVELTE_CSF_STAGING_DIR,
        '-o',
        SVELTE_CSF_OUTPUT_DIR,
        '--types',
        '--tsconfig',
        './tsconfig.json',
      ],
      { nodeOptions: { cwd, stdio: 'inherit' }, throwOnError: true }
    );
  } finally {
    await rm(stagingDir, { recursive: true, force: true });
    // svelte-package keeps its temporary files in .svelte-kit, which this package doesn't use
    await rm(path.join(cwd, '.svelte-kit'), { recursive: true, force: true });
  }

  // svelte-package leaves its temporary files in the output, and emits declarations for renderer
  // files that the runtime reaches through its `@storybook/svelte` import. Keep only the runtime.
  const keptEntries = new Set(
    SVELTE_CSF_RUNTIME_FILES.map((file) => file.split('/')[0].split('.')[0])
  );
  for (const entry of await readdir(outputDir)) {
    if (!keptEntries.has(entry.split('.')[0])) {
      await rm(path.join(outputDir, entry), { recursive: true, force: true });
    }
  }
}

const config: BuildEntries = {
  prebuild: async (cwd) => {
    await mkdir(path.join(cwd, 'dist'), { recursive: true });
    await packageSvelteCsfRuntime(cwd);
  },
  entries: {
    browser: [
      {
        exportEntries: ['.'],
        entryPoint: './src/index.ts',
      },
      {
        exportEntries: ['./entry-preview'],
        entryPoint: './src/entry-preview.ts',
        dts: false,
      },
      {
        exportEntries: ['./entry-preview-docs'],
        entryPoint: './src/entry-preview-docs.ts',
        dts: false,
      },
    ],
    node: [
      {
        exportEntries: ['./preset'],
        entryPoint: './src/preset.ts',
        dts: false,
      },
      {
        exportEntries: ['./internal/docgen-worker'],
        entryPoint: './src/docgen/docgen-worker.ts',
        dts: false,
      },
      {
        exportEntries: ['./internal/svelte-csf/indexer'],
        entryPoint: './src/svelte-csf/indexer/index.ts',
      },
      {
        exportEntries: ['./internal/svelte-csf/vite-plugins'],
        entryPoint: './src/svelte-csf/compiler/plugins.ts',
      },
    ],
  },
  extraOutputs: {
    './internal/PreviewRender.svelte': './static/PreviewRender.svelte',
    './internal/DecoratorHandler.svelte': './static/DecoratorHandler.svelte',
    './internal/AddStorybookIdDecorator.svelte': './static/AddStorybookIdDecorator.svelte',
    './internal/createReactiveProps': './static/createReactiveProps.svelte.js',
    './csf': {
      types: './dist/svelte-csf/index.d.ts',
      code: './src/svelte-csf/index.ts',
      svelte: './dist/svelte-csf/index.js',
      default: './dist/svelte-csf/index.js',
    },
    './internal/svelte-csf/create-runtime-stories': {
      types: './dist/svelte-csf/runtime/create-runtime-stories.d.ts',
      code: './src/svelte-csf/runtime/create-runtime-stories.ts',
      default: './dist/svelte-csf/runtime/create-runtime-stories.js',
    },
  },
};

export default config;
