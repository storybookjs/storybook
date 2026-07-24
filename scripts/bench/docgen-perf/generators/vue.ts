/**
 * Generator for a synthetic Vue 3 project shaped like the monorepos where vue-component-meta
 * struggles: a `packages/*` workspace with per-package tsconfigs (`extends` + `paths` aliases, root
 * `references`), cross-package prop-type import chains, and an optional fake heavy `.d.ts` library
 * inside the generated tree's own node_modules (hermetic - no npm install).
 *
 * Structure levers:
 *   - packages: workspace width; each `packages/pkg{p}` extends the previous package's props type,
 *     so the type chain across packages has depth = packages. `packages/types` holds the shared
 *     base type every package ultimately extends - the widely-imported type the base-type-touch
 *     scenario mutates.
 *   - chainDepth: intra-package type-alias hops between a package's props interface and its parent
 *     type, adding resolution steps without new files.
 *   - fanOut: distinct auxiliary types from `packages/types` referenced by every package's props.
 *   - heavyLib: emits `node_modules/(at)bench/heavy-ui` with a large generated `.d.ts` surface
 *     imitating a vuetify-scale component library; package props reference it when enabled.
 *
 * Generated trees are bench-time scratch output (under the sandbox directory); only this generator
 * and the scenario configs are committed.
 *
 * Run directly:
 *   node --import jiti/register scripts/bench/docgen-perf/generators/vue.ts --out ../storybook-sandboxes/docgen-perf-vue --packages 4 --components-per-package 10
 */
import { createRequire } from 'node:module';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

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

export interface GeneratedVueProject {
  outDir: string;
  /** Root tsconfig (references only). Absent in flat layout. */
  rootConfigPath?: string;
  /** Per-package tsconfig paths, in package order. Absent in flat layout. */
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

function emitHeavyLib(projectDir: string): void {
  const libDir = path.join(projectDir, 'node_modules', '@bench', 'heavy-ui');
  fs.mkdirSync(libDir, { recursive: true });
  fs.writeFileSync(
    path.join(libDir, 'package.json'),
    JSON.stringify({ name: '@bench/heavy-ui', version: '1.0.0', types: 'index.d.ts' }, null, 2)
  );
  fs.writeFileSync(path.join(libDir, 'index.d.ts'), heavyLibSource());
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

function packageTypesSource(p: number, options: VueGenerateOptions): string {
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

export function generateVueProject(options: VueGenerateOptions): GeneratedVueProject {
  const outDir = path.resolve(options.outDir);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  copyVueNodeModules(outDir);
  if (options.heavyLib) {
    emitHeavyLib(outDir);
  }

  const typesDir = path.join(outDir, 'packages', 'types');
  fs.mkdirSync(typesDir, { recursive: true });
  const baseTypesPath = path.join(typesDir, 'index.ts');
  fs.writeFileSync(baseTypesPath, baseTypesSource(options.fanOut, 0));

  const paths: Record<string, string[]> = { '@bench/types': ['packages/types/index.ts'] };
  for (let p = 0; p < options.packages; p++) {
    paths[`@bench/pkg${p}`] = [`packages/pkg${p}/types.ts`];
  }
  fs.writeFileSync(
    path.join(outDir, 'tsconfig.base.json'),
    JSON.stringify({ compilerOptions: { ...BASE_COMPILER_OPTIONS, baseUrl: '.', paths } }, null, 2)
  );

  const componentPaths: string[] = [];
  const packageConfigPaths: string[] = [];

  for (let p = 0; p < options.packages; p++) {
    const pkgDir = path.join(outDir, 'packages', `pkg${p}`);
    fs.mkdirSync(path.join(pkgDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(pkgDir, 'types.ts'), packageTypesSource(p, options));

    const pkgConfigPath = path.join(pkgDir, 'tsconfig.json');
    fs.writeFileSync(
      pkgConfigPath,
      JSON.stringify(
        {
          extends: '../../tsconfig.base.json',
          include: ['types.ts', 'src/**/*.ts', 'src/**/*.vue'],
        },
        null,
        2
      )
    );
    packageConfigPaths.push(pkgConfigPath);

    for (let i = 0; i < options.componentsPerPackage; i++) {
      const componentPath = path.join(pkgDir, 'src', `Comp${p}x${i}.vue`);
      fs.writeFileSync(componentPath, vueComponentSource(p, i, 0));
      componentPaths.push(componentPath);
    }
  }

  const rootConfigPath = path.join(outDir, 'tsconfig.json');
  fs.writeFileSync(
    rootConfigPath,
    JSON.stringify(
      {
        files: [],
        references: Array.from({ length: options.packages }, (_, p) => ({
          path: `./packages/pkg${p}`,
        })),
      },
      null,
      2
    )
  );

  return { outDir, rootConfigPath, packageConfigPaths, baseTypesPath, componentPaths };
}

function parseArgs(argv: string[]): VueGenerateOptions {
  const get = (flag: string, fallback: string) => {
    const idx = argv.indexOf(flag);
    return idx >= 0 && argv[idx + 1] ? argv[idx + 1] : fallback;
  };
  return {
    outDir: get('--out', '../storybook-sandboxes/docgen-perf-vue'),
    packages: Number(get('--packages', '4')),
    componentsPerPackage: Number(get('--components-per-package', '10')),
    chainDepth: Number(get('--chain-depth', '3')),
    fanOut: Number(get('--fan-out', '4')),
    heavyLib: argv.includes('--heavy-lib'),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const options = parseArgs(process.argv.slice(2));
  const start = Date.now();
  const result = generateVueProject(options);
  console.log(
    `Generated ${options.packages}×${options.componentsPerPackage} Vue components ` +
      `into ${result.outDir} in ${Date.now() - start}ms`
  );
}
