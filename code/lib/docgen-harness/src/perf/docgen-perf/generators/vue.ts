/**
 * Generator for a synthetic Vue 3 project shaped like the monorepos where vue-component-meta
 * struggles: a `packages/*` workspace with per-package tsconfigs (`extends` + `paths` aliases, root
 * `references`), cross-package prop-type import chains, and an optional fake heavy `.d.ts` library
 * inside the generated tree's own node_modules (hermetic - no npm install).
 *
 * Structure levers:
 *   - packages: workspace width. Each `packages/pkg{p}` extends the previous package's props type,
 *     so the type chain across packages has depth = packages. `packages/types` holds the shared
 *     base type every package extends - the type the base-type-touch scenario mutates.
 *   - chainDepth: intra-package type-alias hops between a package's props interface and its parent.
 *   - fanOut: auxiliary types from `packages/types` referenced by every package's props.
 *   - heavyLib: emits a fake `(at)bench/heavy-ui` package with a large `.d.ts` surface; package
 *     props reference it when enabled.
 *
 * Run directly, from code/lib/docgen-harness (--out defaults into the sandbox directory):
 *   node src/perf/docgen-perf/generators/vue.ts --packages 4 --components-per-package 10
 */
import { createRequire } from 'node:module';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

import { z } from 'zod';

import { countOption, parseHarnessOptions } from '../../docgen-shared/args.ts';
import { SANDBOX_DIRECTORY } from '../../docgen-shared/paths.ts';

const require = createRequire(import.meta.url);

export interface VueGenerateOptions {
  outDir: string;
  /** Workspace packages (excluding the shared `types` package). 1 = flat single-package layout. */
  packages: number;
  componentsPerPackage: number;
  /** Type-alias hops between each package's props interface and the type it extends. */
  chainDepth: number;
  /** Auxiliary types from the shared types package referenced by every package's props. */
  fanOut: number;
  /** Emit and reference the fake heavy `.d.ts` library. */
  heavyLib: boolean;
}

/** Everything that shapes the generated tree. The output directory is not part of it. */
export type VueProjectShape = Omit<VueGenerateOptions, 'outDir'>;

export interface GeneratedVueProject {
  outDir: string;
  /** Per-package tsconfig paths, in package order. */
  packageConfigPaths: string[];
  /** Path of the shared base-type module (the base-type-touch scenario's save target). */
  baseTypesPath: string;
  /** Absolute SFC paths, in (package, component) order. */
  componentPaths: string[];
}

/** Components in the fake heavy library; each carries a fat literal-union prop surface. */
const HEAVY_LIB_COMPONENTS = 40;
const HEAVY_LIB_PROPS = 20;
const HEAVY_LIB_UNION_MEMBERS = 30;

/** Copy the minimal node_modules packages the checker needs for Vue type resolution. */
function copyVueNodeModules(projectDir: string): void {
  const dest = path.join(projectDir, 'node_modules');
  const rootNodeModules = path.resolve(require.resolve('vue/package.json'), '../..');
  fs.mkdirSync(path.join(dest, '@vue'), { recursive: true });

  for (const pkg of ['vue', 'csstype']) {
    fs.cpSync(path.join(rootNodeModules, pkg), path.join(dest, pkg), {
      recursive: true,
      dereference: true,
    });
  }
  for (const pkg of ['runtime-core', 'runtime-dom', 'shared', 'reactivity', 'compiler-dom']) {
    fs.cpSync(path.join(rootNodeModules, '@vue', pkg), path.join(dest, '@vue', pkg), {
      recursive: true,
      dereference: true,
    });
  }
}

function heavyLibSource(): string {
  const components: string[] = [];
  for (let c = 0; c < HEAVY_LIB_COMPONENTS; c++) {
    const props: string[] = [];
    for (let p = 0; p < HEAVY_LIB_PROPS; p++) {
      const members = Array.from(
        { length: HEAVY_LIB_UNION_MEMBERS },
        (_, m) => `'hc${c}_p${p}_v${m}'`
      ).join(' | ');
      props.push(`  prop${p}?: ${members};`);
    }
    components.push(
      `export interface HeavyComponent${c}Props {\n${props.join('\n')}\n}\n` +
        `export declare const HeavyComponent${c}: (props: HeavyComponent${c}Props) => unknown;`
    );
  }
  return `${components.join('\n\n')}\n`;
}

/**
 * The shared types package's module source. `extraBaseProps` grows `BaseProps` by one optional
 * prop per base-type-touch save, so every dependent package's props type genuinely changes.
 */
export function baseTypesSource(fanOut: number, extraBaseProps: number): string {
  const extras = Array.from(
    { length: extraBaseProps },
    (_, k) => `  /** Extra base prop ${k}. */\n  extraBase${k}?: string;`
  ).join('\n');
  const auxTypes = Array.from(
    { length: fanOut },
    (_, k) => `export interface Aux${k} {\n  aux${k}Value: string;\n  aux${k}Count?: number;\n}`
  ).join('\n\n');
  return `export interface BaseProps {
  /** Stable identifier. */
  id: string;
  /** Semantic kind token. */
  kind?: 'alpha' | 'beta' | 'gamma';
  /** Arbitrary metadata bag. */
  meta?: Record<string, unknown>;
${extras ? `${extras}\n` : ''}}

${auxTypes}
`;
}

function packageTypesSource(p: number, options: VueProjectShape): string {
  const auxNames = Array.from({ length: options.fanOut }, (_, k) => `Aux${k}`);
  const parentImport =
    p === 0
      ? `import type { BaseProps, ${auxNames.join(', ')} } from '@bench/types';`
      : `import type { Pkg${p - 1}Props } from '@bench/pkg${p - 1}';\nimport type { ${auxNames.join(', ')} } from '@bench/types';`;
  const heavyImport = options.heavyLib
    ? `import type { HeavyComponent${p % HEAVY_LIB_COMPONENTS}Props } from '@bench/heavy-ui';\n`
    : '';
  const parent = p === 0 ? 'BaseProps' : `Pkg${p - 1}Props`;

  const hops: string[] = [];
  let current = parent;
  for (let h = 0; h < options.chainDepth - 1; h++) {
    hops.push(`type Hop${h} = ${current};`);
    current = `Hop${h}`;
  }

  const fanProps = auxNames
    .map((aux, k) => `  /** Fan-out reference ${k}. */\n  pkg${p}Fan${k}?: ${aux};`)
    .join('\n');
  const heavyProp = options.heavyLib
    ? `\n  /** Heavy library surface reference. */\n  pkg${p}Heavy?: HeavyComponent${p % HEAVY_LIB_COMPONENTS}Props;`
    : '';

  return `${parentImport}
${heavyImport}
${hops.length ? `${hops.join('\n')}\n` : ''}
export interface Pkg${p}Props extends ${current} {
${fanProps}${heavyProp}
}
`;
}

/**
 * An SFC's source. `extraProps` grows the intersection type by one optional prop per save, so a
 * simulated save genuinely changes the component's type.
 */
export function vueComponentSource(p: number, i: number, extraProps: number): string {
  const extras = Array.from({ length: extraProps }, (_, k) => ` extra${k}?: string;`).join('');
  const propsType = extras ? `Pkg${p}Props & {${extras} }` : `Pkg${p}Props`;
  return `<script setup lang="ts">
import type { Pkg${p}Props } from '../types';

const props = defineProps<${propsType}>();
</script>

<template>
  <div :data-comp="'c${p}x${i}'">{{ props.id }}</div>
</template>
`;
}

const BASE_COMPILER_OPTIONS = {
  target: 'ESNext',
  module: 'ESNext',
  moduleResolution: 'Bundler',
  strict: true,
  skipLibCheck: true,
  jsx: 'preserve',
  lib: ['ESNext', 'DOM'],
};

/** The generated tree, as paths relative to the output directory. */
export interface VueProjectFiles {
  /** Every file the generator emits, keyed by its path relative to the output directory. */
  files: Record<string, string>;
  packageConfigPaths: string[];
  baseTypesPath: string;
  componentPaths: string[];
}

/**
 * The project as data, before anything touches disk. The cross-package type chain this generator
 * exists to build - each package's props extending the one below it, through `paths` aliases - is
 * spread over a workspace of small files, so it is far easier to read here than in a directory.
 *
 * The real Vue runtime types are the one thing missing: those are copied in, not generated.
 */
export function vueProjectFiles(options: VueProjectShape): VueProjectFiles {
  const files: Record<string, string> = {};

  if (options.heavyLib) {
    files['node_modules/@bench/heavy-ui/package.json'] = JSON.stringify(
      { name: '@bench/heavy-ui', version: '1.0.0', types: 'index.d.ts' },
      null,
      2
    );
    files['node_modules/@bench/heavy-ui/index.d.ts'] = heavyLibSource();
  }

  const baseTypesPath = 'packages/types/index.ts';
  files[baseTypesPath] = baseTypesSource(options.fanOut, 0);

  const paths: Record<string, string[]> = { '@bench/types': ['packages/types/index.ts'] };
  for (let p = 0; p < options.packages; p++) {
    paths[`@bench/pkg${p}`] = [`packages/pkg${p}/types.ts`];
  }
  files['tsconfig.base.json'] = JSON.stringify(
    { compilerOptions: { ...BASE_COMPILER_OPTIONS, baseUrl: '.', paths } },
    null,
    2
  );

  const componentPaths: string[] = [];
  const packageConfigPaths: string[] = [];

  for (let p = 0; p < options.packages; p++) {
    files[`packages/pkg${p}/types.ts`] = packageTypesSource(p, options);

    const pkgConfigPath = `packages/pkg${p}/tsconfig.json`;
    files[pkgConfigPath] = JSON.stringify(
      { extends: '../../tsconfig.base.json', include: ['types.ts', 'src/**/*.ts', 'src/**/*.vue'] },
      null,
      2
    );
    packageConfigPaths.push(pkgConfigPath);

    for (let i = 0; i < options.componentsPerPackage; i++) {
      const componentPath = `packages/pkg${p}/src/Comp${p}x${i}.vue`;
      files[componentPath] = vueComponentSource(p, i, 0);
      componentPaths.push(componentPath);
    }
  }

  // The root config declares `references` but no package sets `composite`, so `tsc -b` would reject
  // this tree. It is here because the production Vite plugin branches on `references` being present.
  files['tsconfig.json'] = JSON.stringify(
    {
      files: [],
      references: Array.from({ length: options.packages }, (_, p) => ({
        path: `./packages/pkg${p}`,
      })),
    },
    null,
    2
  );

  return { files, packageConfigPaths, baseTypesPath, componentPaths };
}

export function generateVueProject(options: VueGenerateOptions): GeneratedVueProject {
  const outDir = path.resolve(options.outDir);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  copyVueNodeModules(outDir);

  const { files, packageConfigPaths, baseTypesPath, componentPaths } = vueProjectFiles(options);
  for (const [relativePath, contents] of Object.entries(files)) {
    const filePath = path.join(outDir, relativePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, contents);
  }

  const absolute = (relativePath: string) => path.join(outDir, relativePath);
  return {
    outDir,
    packageConfigPaths: packageConfigPaths.map(absolute),
    baseTypesPath: absolute(baseTypesPath),
    componentPaths: componentPaths.map(absolute),
  };
}

function parseOptions(argv: string[]): VueGenerateOptions {
  return parseHarnessOptions<VueGenerateOptions>(
    argv,
    {
      out: { type: 'string' },
      packages: { type: 'string' },
      'components-per-package': { type: 'string' },
      'chain-depth': { type: 'string' },
      'fan-out': { type: 'string' },
      'heavy-lib': { type: 'boolean' },
    } as const,
    z.object({
      outDir: z.string().default(path.join(SANDBOX_DIRECTORY, 'docgen-perf-vue')),
      packages: countOption(4),
      componentsPerPackage: countOption(10),
      chainDepth: countOption(3),
      fanOut: countOption(4),
      heavyLib: z.boolean().default(false),
    }),
    (values) => ({ ...values, outDir: values.out })
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const options = parseOptions(process.argv.slice(2));
  const start = Date.now();
  const result = generateVueProject(options);
  console.log(
    `Generated ${options.packages}×${options.componentsPerPackage} Vue components ` +
      `into ${result.outDir} in ${Date.now() - start}ms`
  );
}
