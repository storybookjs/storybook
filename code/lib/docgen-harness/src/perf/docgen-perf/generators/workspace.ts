// Generator for a synthetic component project shaped like the monorepos where type-based docgen
// struggles: a `packages/*` workspace with per-package tsconfigs (`extends` + `paths` aliases, root
// `references`), cross-package prop-type import chains, and an optional fake heavy `.d.ts` library
// inside the generated tree's own node_modules (hermetic - no npm install).
//
// The tree is the same for every framework; only the component files differ, so the Vue and Svelte
// rows measure their engines over identical type graphs.
//
// Structure levers:
//   - packages: workspace width. Each `packages/pkg{p}` extends the previous package's props type,
//     so the type chain across packages has depth = packages. `packages/types` holds the shared
//     base type every package extends - the type the base-type-touch scenario mutates.
//   - chainDepth: intra-package type-alias hops between a package's props interface and its parent.
//   - fanOut: auxiliary types from `packages/types` referenced by every package's props.
//   - heavyLib: emits a fake `(at)bench/heavy-ui` package with a large `.d.ts` surface; package
//     props reference it when enabled.
//   - libModules: extra `.d.ts` modules the heavy library's index references, so the program holds
//     thousands of dependency files, as a real app's does.
import * as fs from 'node:fs';
import * as path from 'pathe';

export interface WorkspaceGenerateOptions {
  outDir: string;
  // Workspace packages (excluding the shared `types` package). 1 = flat single-package layout.
  packages: number;
  componentsPerPackage: number;
  // Type-alias hops between each package's props interface and the type it extends.
  chainDepth: number;
  // Auxiliary types from the shared types package referenced by every package's props.
  fanOut: number;
  // Emit and reference the fake heavy `.d.ts` library.
  heavyLib: boolean;
  // Extra `.d.ts` modules the heavy library references. Needs `heavyLib`.
  libModules?: number;
}

// Everything that shapes the generated tree. The output directory is not part of it.
export type WorkspaceProjectShape = Omit<WorkspaceGenerateOptions, 'outDir'>;

export interface GeneratedWorkspaceProject {
  outDir: string;
  // Per-package tsconfig paths, in package order.
  packageConfigPaths: string[];
  // Path of the shared base-type module (the base-type-touch scenario's save target).
  baseTypesPath: string;
  // Absolute component paths, in (package, component) order.
  componentPaths: string[];
}

// What a framework contributes: its component file extension and the component's source.
export interface WorkspaceComponent {
  extension: string;
  // `extraProps` grows the component's props type by one optional prop per save, so a simulated
  // save genuinely changes the component's type.
  source(p: number, i: number, extraProps: number): string;
}

// What a framework's harness passes to the scenario: how to write its project, and its component.
export interface WorkspaceFramework {
  generate(options: WorkspaceGenerateOptions): GeneratedWorkspaceProject;
  componentSource: WorkspaceComponent['source'];
}

// Every framework's component grows by the same props per save, so their rows stay comparable.
export function grownPropsType(p: number, extraProps: number): string {
  const extras = Array.from({ length: extraProps }, (_, k) => ` extra${k}?: string;`).join('');
  return extras ? `Pkg${p}Props & {${extras} }` : `Pkg${p}Props`;
}

// Components in the fake heavy library; each carries a fat literal-union prop surface.
const HEAVY_LIB_COMPONENTS = 40;
const HEAVY_LIB_PROPS = 20;
const HEAVY_LIB_UNION_MEMBERS = 30;

function heavyLibSource(libModules: number): string {
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
  // Referenced rather than re-exported: in a real app most dependency files are in the program
  // without any component's props resolving through them.
  const references = Array.from(
    { length: libModules },
    (_, k) => `/// <reference path="./modules/m${k}.d.ts" />\n`
  ).join('');
  return `${references}${components.join('\n\n')}\n`;
}

// The shared types package's module source. `extraBaseProps` grows `BaseProps` by one optional
// prop per base-type-touch save, so every dependent package's props type genuinely changes.
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

function packageTypesSource(p: number, options: WorkspaceProjectShape): string {
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

const BASE_COMPILER_OPTIONS = {
  target: 'ESNext',
  module: 'ESNext',
  moduleResolution: 'Bundler',
  strict: true,
  skipLibCheck: true,
  jsx: 'preserve',
  lib: ['ESNext', 'DOM'],
};

// The generated tree, as paths relative to the output directory.
export interface WorkspaceProjectFiles {
  // Every file the generator emits, keyed by its path relative to the output directory.
  files: Record<string, string>;
  packageConfigPaths: string[];
  baseTypesPath: string;
  componentPaths: string[];
}

// The project as data, before anything touches disk. The cross-package type chain this generator
// exists to build - each package's props extending the one below it, through `paths` aliases - is
// spread over a workspace of small files, so it is far easier to read here than in a directory.
//
// The framework's runtime types are the one thing missing: those are copied in, not generated.
export function workspaceProjectFiles(
  options: WorkspaceProjectShape,
  component: WorkspaceComponent
): WorkspaceProjectFiles {
  const files: Record<string, string> = {};

  if (options.heavyLib) {
    files['node_modules/@bench/heavy-ui/package.json'] = JSON.stringify(
      { name: '@bench/heavy-ui', version: '1.0.0', types: 'index.d.ts' },
      null,
      2
    );
    files['node_modules/@bench/heavy-ui/index.d.ts'] = heavyLibSource(options.libModules ?? 0);
    for (let k = 0; k < (options.libModules ?? 0); k++) {
      files[`node_modules/@bench/heavy-ui/modules/m${k}.d.ts`] =
        `export interface Module${k}Props {\n  m${k}Value?: string;\n}\n`;
    }
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
      {
        extends: '../../tsconfig.base.json',
        include: ['types.ts', 'src/**/*.ts', `src/**/*.${component.extension}`],
      },
      null,
      2
    );
    packageConfigPaths.push(pkgConfigPath);

    for (let i = 0; i < options.componentsPerPackage; i++) {
      const componentPath = `packages/pkg${p}/src/Comp${p}x${i}.${component.extension}`;
      files[componentPath] = component.source(p, i, 0);
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

// Writes the project into a fresh `outDir`. `copyRuntime` copies the framework's own packages into
// the tree's node_modules before the generated files land.
export function generateWorkspaceProject(
  options: WorkspaceGenerateOptions,
  component: WorkspaceComponent,
  copyRuntime: (projectDir: string) => void
): GeneratedWorkspaceProject {
  const outDir = path.resolve(options.outDir);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  copyRuntime(outDir);

  const { files, packageConfigPaths, baseTypesPath, componentPaths } = workspaceProjectFiles(
    options,
    component
  );
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
