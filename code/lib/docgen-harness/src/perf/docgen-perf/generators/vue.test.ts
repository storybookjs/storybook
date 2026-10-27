import { describe, expect, it } from 'vitest';

import { vueProjectFiles } from './vue.ts';

/**
 * These snapshots are the generator's documentation. What makes this project hard for
 * vue-component-meta is not any one file but how they reference each other: an SFC reaches its
 * package's props, which extends the package below it through a `paths` alias, down to a shared
 * base type. That chain is the measured work, and it is invisible in the generator's source.
 *
 * The project is asserted as data rather than generated to disk, so nothing here writes a file or
 * copies the Vue runtime.
 */
const tree = (files: Record<string, string>) => Object.keys(files).sort().join('\n');

/** The smallest workspace that still has a package extending another one. */
const workspace = {
  packages: 2,
  componentsPerPackage: 1,
  chainDepth: 1,
  fanOut: 1,
  heavyLib: false,
};

describe('vueProjectFiles', () => {
  it('lays out a packages/* workspace', () => {
    expect(tree(vueProjectFiles(workspace).files)).toMatchInlineSnapshot(`
      "packages/pkg0/src/Comp0x0.vue
      packages/pkg0/tsconfig.json
      packages/pkg0/types.ts
      packages/pkg1/src/Comp1x0.vue
      packages/pkg1/tsconfig.json
      packages/pkg1/types.ts
      packages/types/index.ts
      tsconfig.base.json
      tsconfig.json"
    `);
  });

  it('collapses to a single package for the flat scenario', () => {
    // `packages: 1` is what the flat scenario generates: no cross-package chain to follow.
    expect(tree(vueProjectFiles({ ...workspace, packages: 1 }).files)).toMatchInlineSnapshot(`
      "packages/pkg0/src/Comp0x0.vue
      packages/pkg0/tsconfig.json
      packages/pkg0/types.ts
      packages/types/index.ts
      tsconfig.base.json
      tsconfig.json"
    `);
  });

  it('aliases every package through tsconfig paths, which is what the checker resolves', () => {
    // vue-docgen-api does not resolve these aliases and vue-component-meta does, which is most of
    // why the two report such different member counts on the same project.
    expect(vueProjectFiles(workspace).files['tsconfig.base.json']).toMatchInlineSnapshot(`
      "{
        "compilerOptions": {
          "target": "ESNext",
          "module": "ESNext",
          "moduleResolution": "Bundler",
          "strict": true,
          "skipLibCheck": true,
          "jsx": "preserve",
          "lib": [
            "ESNext",
            "DOM"
          ],
          "baseUrl": ".",
          "paths": {
            "@bench/types": [
              "packages/types/index.ts"
            ],
            "@bench/pkg0": [
              "packages/pkg0/types.ts"
            ],
            "@bench/pkg1": [
              "packages/pkg1/types.ts"
            ]
          }
        }
      }"
    `);
  });

  it('declares references from the root config, which the production plugin branches on', () => {
    expect(vueProjectFiles(workspace).files['tsconfig.json']).toMatchInlineSnapshot(`
      "{
        "files": [],
        "references": [
          {
            "path": "./packages/pkg0"
          },
          {
            "path": "./packages/pkg1"
          }
        ]
      }"
    `);
  });

  it('extends each package config from the base, and includes .vue', () => {
    expect(vueProjectFiles(workspace).files['packages/pkg0/tsconfig.json']).toMatchInlineSnapshot(`
        "{
          "extends": "../../tsconfig.base.json",
          "include": [
            "types.ts",
            "src/**/*.ts",
            "src/**/*.vue"
          ]
        }"
      `);
  });

  it('roots the chain in a shared base type plus fan-out aux types', () => {
    // packages/types is the module the base-type-touch scenario rewrites on every save, so a change
    // here invalidates every package above it at once.
    expect(vueProjectFiles(workspace).files['packages/types/index.ts']).toMatchInlineSnapshot(`
      "export interface BaseProps {
        /** Stable identifier. */
        id: string;
        /** Semantic kind token. */
        kind?: 'alpha' | 'beta' | 'gamma';
        /** Arbitrary metadata bag. */
        meta?: Record<string, unknown>;
      }

      export interface Aux0 {
        aux0Value: string;
        aux0Count?: number;
      }
      "
    `);
  });

  it('extends the base type in the first package and the package below in the next', () => {
    const { files } = vueProjectFiles(workspace);
    // pkg0 reaches the shared base directly...
    expect(files['packages/pkg0/types.ts']).toMatchInlineSnapshot(`
      "import type { BaseProps, Aux0 } from '@bench/types';


      export interface Pkg0Props extends BaseProps {
        /** Fan-out reference 0. */
        pkg0Fan0?: Aux0;
      }
      "
    `);
    // ...and pkg1 reaches pkg0, so the chain deepens by one per package.
    expect(files['packages/pkg1/types.ts']).toMatchInlineSnapshot(`
      "import type { Pkg0Props } from '@bench/pkg0';
      import type { Aux0 } from '@bench/types';


      export interface Pkg1Props extends Pkg0Props {
        /** Fan-out reference 0. */
        pkg1Fan0?: Aux0;
      }
      "
    `);
  });

  it('inserts one type-alias hop per chainDepth above the first', () => {
    // The hops are what a checker has to walk through before it reaches a real member.
    expect(vueProjectFiles({ ...workspace, chainDepth: 3 }).files['packages/pkg0/types.ts'])
      .toMatchInlineSnapshot(`
        "import type { BaseProps, Aux0 } from '@bench/types';

        type Hop0 = BaseProps;
        type Hop1 = Hop0;

        export interface Pkg0Props extends Hop1 {
          /** Fan-out reference 0. */
          pkg0Fan0?: Aux0;
        }
        "
      `);
  });

  it('references the fake heavy library only when heavyLib is on', () => {
    const heavy = vueProjectFiles({ ...workspace, heavyLib: true });
    expect(heavy.files['packages/pkg0/types.ts']).toMatchInlineSnapshot(`
      "import type { BaseProps, Aux0 } from '@bench/types';
      import type { HeavyComponent0Props } from '@bench/heavy-ui';


      export interface Pkg0Props extends BaseProps {
        /** Fan-out reference 0. */
        pkg0Fan0?: Aux0;
        /** Heavy library surface reference. */
        pkg0Heavy?: HeavyComponent0Props;
      }
      "
    `);
    // The library itself is emitted into the project's own node_modules, so the tree stays hermetic.
    expect(Object.keys(heavy.files).filter((p) => p.startsWith('node_modules/')))
      .toMatchInlineSnapshot(`
        [
          "node_modules/@bench/heavy-ui/package.json",
          "node_modules/@bench/heavy-ui/index.d.ts",
        ]
      `);
  });

  it('points every SFC at its own package types, and nothing further', () => {
    // The SFC import is deliberately shallow: everything deeper is reached through the props type,
    // so the depth an engine resolves is the thing being measured.
    expect(vueProjectFiles(workspace).files['packages/pkg1/src/Comp1x0.vue'])
      .toMatchInlineSnapshot(`
        "<script setup lang="ts">
        import type { Pkg1Props } from '../types';

        const props = defineProps<Pkg1Props>();
        </script>

        <template>
          <div :data-comp="'c1x0'">{{ props.id }}</div>
        </template>
        "
      `);
  });

  it('reports the paths the harness drives the run from', () => {
    const { componentPaths, packageConfigPaths, baseTypesPath } = vueProjectFiles({
      ...workspace,
      componentsPerPackage: 2,
    });
    // The harness measures the deepest package's components and mutates baseTypesPath, so these
    // orderings are load-bearing rather than incidental.
    expect({ componentPaths, packageConfigPaths, baseTypesPath }).toMatchInlineSnapshot(`
      {
        "baseTypesPath": "packages/types/index.ts",
        "componentPaths": [
          "packages/pkg0/src/Comp0x0.vue",
          "packages/pkg0/src/Comp0x1.vue",
          "packages/pkg1/src/Comp1x0.vue",
          "packages/pkg1/src/Comp1x1.vue",
        ],
        "packageConfigPaths": [
          "packages/pkg0/tsconfig.json",
          "packages/pkg1/tsconfig.json",
        ],
      }
    `);
  });
});
