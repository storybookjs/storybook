import type { ConfigFile } from 'storybook/internal/csf-tools';
import { type StoriesEntry, type StorybookConfigRaw } from 'storybook/internal/types';

import { ProjectType } from '../../../core/src/cli/projectTypes.ts';
import { SupportedBuilder } from '../../../core/src/types/modules/builders.ts';

export type TemplateType = Pick<Template, 'inDevelopment' | 'skipTasks' | 'typeCheck'>;
export type AllTemplatesKey = keyof typeof allTemplates;
export type AllTemplatesType = Record<AllTemplatesKey, TemplateType>;

export type SkippableTask =
  | 'smoke-test'
  | 'test-runner'
  | 'test-runner-dev'
  | 'vitest-integration'
  | 'chromatic'
  | 'e2e-tests'
  | 'e2e-tests-dev'
  | 'bench';

export type TemplateKey =
  | keyof typeof baseTemplates
  | keyof typeof internalTemplates
  | keyof typeof benchTemplates;

export type Cadence = keyof typeof templatesByCadence;

// Some properties e.g. experimentalTestSyntax are only available in framework specific types for StorybookConfig, therefore we loosen the type here otherwise it would always fail
type LoosenedStorybookConfig = Omit<Partial<StorybookConfigRaw>, 'features'> & {
  features?:
    | (Partial<NonNullable<StorybookConfigRaw['features']>> & Record<string, unknown>)
    | undefined;
};

export type Template = {
  /**
   * Readable name for the template, which will be used for feedback and the status page Follows the
   * naming scheme when it makes sense: <framework> <"v"version|"Latest"|"Prerelease">
   * (<"Webpack"|"Vite"> | <"JavaScript"|"TypeScript">) React Latest - Webpack (TS) Next.js v12 (JS)
   * Angular CLI Prerelease
   */
  name: string;
  /**
   * Script used to generate the base project of a template. The Storybook CLI will then initialize
   * Storybook on top of that template. This is used to generate projects which are pushed to
   * https://github.com/storybookjs/sandboxes
   */
  script: string;
  /** Environment variables to set when running the script. */
  env?: Record<string, unknown>;
  /**
   * Used to assert various things about the generated template. If the template is generated with a
   * different expected framework, it will fail, detecting a possible regression.
   */
  expected: {
    framework: string;
    renderer: string;
    builder: string;
  };

  expectedFailures?: Array<{
    feature: string;
    issues: string[];
  }>;

  unsupportedFeatures?: Array<{
    feature: string;
    issues: string[];
  }>;
  /**
   * Some sandboxes might not work properly in specific tasks temporarily, but we might still want
   * to run the other tasks. Set the ones to skip in this property.
   */
  skipTasks?: SkippableTask[];
  /**
   * Should the sandbox be type checked after build. Not part of skipTasks as the default answer
   * will be 'no', at least initially
   */
  typeCheck?: boolean;
  /**
   * Set this only while developing a newly created framework, to avoid using it in CI. NOTE: Make
   * sure to always add a TODO comment to remove this flag in a subsequent PR.
   */
  inDevelopment?: boolean;
  /**
   * Some sandboxes might need extra modifications in the initialized Storybook, such as extend
   * main.js, for setting specific feature flags.
   */
  modifications?: {
    skipTemplateStories?: boolean;
    skipMocking?: boolean;
    mainConfig?: LoosenedStorybookConfig | ((config: ConfigFile) => LoosenedStorybookConfig);
    testBuild?: boolean;
    disableDocs?: boolean;
    extraDependencies?: string[];
    extraDevDependencies?: string[];
    removeDependencies?: string[];
    removeDevDependencies?: string[];
    resolutions?: Record<string, string>;
    editAddons?: (addons: string[]) => string[];
    useCsfFactory?: boolean;
    /**
     * Name of a `template/stories_<variant>` fixture folder to link instead of the one derived
     * from this template's key, so a derived template can share its base template's stories.
     */
    storiesVariant?: string;
  };
  /** Additional CI steps in case this template has special needs during CI. */
  extraCiSteps?: {
    // Some sandboxes (e.g. Angular) rely on Node 22.22.3 as minimum supported version and threfore it needs enforcing, even if the CI image comes with a different node version.
    ensureMinNodeVersion?: boolean;
  };
  /**
   * Package names or glob patterns exempted from the sandbox `npmMinimalAgeGate`,
   * for templates that deliberately track a prerelease line. The gate still
   * applies to every other dependency, so only the packages named here can be
   * installed fresh.
   *
   * The gate is enforced transitively, so this has to name the whole family of
   * packages published in lockstep with the prerelease, not just the direct
   * dependency. Stable templates should leave this unset.
   */
  minAgeGateExemptions?: string[];
  /** Additional options to pass to the initiate command when initializing Storybook. */
  initOptions?: {
    builder?: SupportedBuilder;
    type?: ProjectType;
    [key: string]: unknown;
  };
  /**
   * Flag to indicate that this template is a secondary template, which is used mainly to test
   * rather specific features. This means the template might be hidden from the Storybook status
   * page or the repro CLI command.
   */
  isInternal?: boolean;
};

type BaseTemplates = Template & {
  name: `${string} ${`v${number}` | 'Latest' | 'Prerelease'} (${'Webpack' | 'Vite' | 'RsBuild'} | ${
    | 'JavaScript'
    | 'TypeScript'})`;
};

export const baseTemplates = {
  'cra/default-js': {
    name: 'Create React App Latest (Webpack | JavaScript)',
    script: `
      npx create-react-app {{beforeDir}} && cd {{beforeDir}} && \
      jq '.browserslist.production[0] = ">0.9%"' package.json > tmp.json && mv tmp.json package.json
    `,
    expected: {
      // TODO: change this to @storybook/cra once that package is created
      framework: '@storybook/react-webpack5',
      renderer: '@storybook/react',
      builder: '@storybook/builder-webpack5',
    },

    skipTasks: ['e2e-tests', 'bench', 'vitest-integration'],
    modifications: {
      useCsfFactory: true,
      extraDevDependencies: ['prop-types'],
      mainConfig: (config) => {
        const stories = config.getFieldValue<Array<StoriesEntry>>(['stories']);
        return {
          features: {
            experimentalTestSyntax: true,
          },
          stories: stories?.map((s) => {
            if (typeof s === 'string') {
              return s.replace(/\|(tsx?|ts)\b|\b(tsx?|ts)\|/g, '');
            } else {
              return s;
            }
          }),
        };
      },
    },
  },
  'cra/default-ts': {
    name: 'Create React App Latest (Webpack | TypeScript)',
    script: `
      npx create-react-app {{beforeDir}} --template typescript && cd {{beforeDir}} && \
      jq '.browserslist.production[0] = ">0.9%"' package.json > tmp.json && mv tmp.json package.json
    `,
    // Re-enable once https://github.com/storybookjs/storybook/issues/19351 is fixed.
    skipTasks: ['smoke-test', 'bench', 'vitest-integration'],
    expected: {
      // TODO: change this to @storybook/cra once that package is created
      framework: '@storybook/react-webpack5',
      renderer: '@storybook/react',
      builder: '@storybook/builder-webpack5',
    },
    modifications: {
      useCsfFactory: true,
      extraDevDependencies: ['prop-types'],
      mainConfig: {
        features: {
          experimentalTestSyntax: true,
        },
      },
    },
  },
  'nextjs/15-ts': {
    name: 'Next.js v15 (Webpack | TypeScript)',
    script:
      'npx create-next-app@^15.5 {{beforeDir}} --skip-install --eslint --tailwind --app --import-alias="@/*" --src-dir',
    expected: {
      framework: '@storybook/nextjs',
      renderer: '@storybook/react',
      builder: '@storybook/builder-webpack5',
    },
    modifications: {
      useCsfFactory: true,
      mainConfig: {
        features: {
          experimentalRSC: true,
          developmentModeForBuild: true,
          experimentalTestSyntax: true,
        },
      },
      extraDevDependencies: ['server-only', 'prop-types'],
    },
    initOptions: {
      builder: SupportedBuilder.WEBPACK5,
    },
    skipTasks: ['e2e-tests', 'bench', 'vitest-integration'],
  },
  'nextjs/default-ts': {
    name: 'Next.js Latest (Webpack | TypeScript)',
    script:
      'npx create-next-app {{beforeDir}} --skip-install --eslint --tailwind --app --import-alias="@/*" --src-dir',
    expected: {
      framework: '@storybook/nextjs',
      renderer: '@storybook/react',
      builder: '@storybook/builder-webpack5',
    },
    modifications: {
      useCsfFactory: true,
      mainConfig: {
        features: {
          experimentalRSC: true,
          developmentModeForBuild: true,
          experimentalTestSyntax: true,
          changeDetection: true,
        },
      },
      extraDevDependencies: ['server-only', 'prop-types'],
    },
    initOptions: {
      builder: SupportedBuilder.WEBPACK5,
    },
    skipTasks: ['bench', 'vitest-integration'],
  },
  'nextjs/prerelease': {
    name: 'Next.js Prerelease (Webpack | TypeScript)',
    script:
      'npx create-next-app@canary {{beforeDir}} --skip-install --eslint --tailwind --app --import-alias="@/*" --src-dir',
    // The point of this template is the canary line, and canaries are published
    // daily. `@next/*` covers the platform binaries, and `eslint-config-next`
    // is pinned to the same canary version by create-next-app.
    //
    // `@tailwindcss/turbopack` is not part of that line — `--tailwind` pulls it in,
    // and it is new enough that `^4` has only ever matched one release. Until it has
    // a second one, every release it makes is the sole candidate and the gate blocks
    // the whole template. Drop this entry once 4.x has some history.
    minAgeGateExemptions: ['next', '@next/*', 'eslint-config-next', '@tailwindcss/turbopack'],
    expected: {
      framework: '@storybook/nextjs',
      renderer: '@storybook/react',
      builder: '@storybook/builder-webpack5',
    },
    modifications: {
      useCsfFactory: true,
      mainConfig: {
        features: {
          experimentalRSC: true,
          developmentModeForBuild: true,
          experimentalTestSyntax: true,
        },
      },
      extraDevDependencies: ['server-only', 'prop-types'],
    },
    initOptions: {
      builder: SupportedBuilder.WEBPACK5,
    },
    skipTasks: ['e2e-tests', 'bench', 'vitest-integration'],
  },
  'nextjs-vite/15-ts': {
    name: 'Next.js v15 (Vite | TypeScript)',
    script:
      'npx create-next-app@^15 {{beforeDir}} --skip-install --eslint --tailwind --app --import-alias="@/*" --src-dir',
    expected: {
      framework: '@storybook/nextjs-vite',
      renderer: '@storybook/react',
      builder: '@storybook/builder-vite',
    },
    modifications: {
      useCsfFactory: true,
      mainConfig: {
        framework: '@storybook/nextjs-vite',
        features: {
          experimentalRSC: true,
          developmentModeForBuild: true,
          experimentalTestSyntax: true,
        },
      },
      extraDevDependencies: ['server-only', 'vite', 'prop-types'],
    },
    skipTasks: ['e2e-tests', 'bench'],
  },
  'nextjs-vite/default-ts': {
    name: 'Next.js Latest (Vite | TypeScript)',
    script:
      'npx create-next-app {{beforeDir}} --skip-install --eslint --no-tailwind --app --import-alias="@/*" --src-dir',
    expected: {
      framework: '@storybook/nextjs-vite',
      renderer: '@storybook/react',
      builder: '@storybook/builder-vite',
    },
    modifications: {
      useCsfFactory: true,
      mainConfig: {
        framework: '@storybook/nextjs-vite',
        features: {
          experimentalRSC: true,
          developmentModeForBuild: true,
          experimentalTestSyntax: true,
          changeDetection: true,
        },
      },
      extraDevDependencies: ['server-only', 'vite', 'prop-types'],
    },
    skipTasks: ['bench'],
  },
  'react-vite/default-js': {
    name: 'React Latest (Vite | JavaScript)',
    script: 'npm create vite --yes {{beforeDir}} -- --template react',
    expected: {
      framework: '@storybook/react-vite',
      renderer: '@storybook/react',
      builder: '@storybook/builder-vite',
    },
    modifications: {
      useCsfFactory: true,
      extraDevDependencies: ['prop-types'],
      mainConfig: {
        features: {
          developmentModeForBuild: true,
          experimentalTestSyntax: true,
        },
      },
    },
    skipTasks: ['e2e-tests', 'bench'],
  },
  'react-vite/default-ts': {
    name: 'React Latest (Vite | TypeScript)',
    script: 'npm create vite --yes {{beforeDir}} -- --template react-ts',
    expected: {
      framework: '@storybook/react-vite',
      renderer: '@storybook/react',
      builder: '@storybook/builder-vite',
    },
    modifications: {
      useCsfFactory: true,
      extraDevDependencies: ['prop-types', '@types/prop-types'],
      mainConfig: {
        features: {
          developmentModeForBuild: true,
          experimentalTestSyntax: true,
          changeDetection: true,
        },
      },
    },
    skipTasks: ['bench'],
    typeCheck: true,
  },
  'react-vite/prerelease-ts': {
    name: 'React Prerelease (Vite | TypeScript)',
    /**
     * Create a Vite project with the React template. The beta React, React-DOM and @types packages,
     * see https://react.dev/blog/2024/04/25/react-19-upgrade-guide#installing
     */
    script: 'npm create vite --yes {{beforeDir}} -- --template react-ts',
    // Beta React is applied after scaffold (extraDependencies / resolutions). The allowlist
    // still has to live on before-storybook so later installs under the 7-day gate can
    // resolve those packages. `scheduler` ships in lockstep with React releases.
    minAgeGateExemptions: ['react', 'react-dom', 'types-react', 'types-react-dom', 'scheduler'],
    expected: {
      framework: '@storybook/react-vite',
      renderer: '@storybook/react',
      builder: '@storybook/builder-vite',
    },
    modifications: {
      useCsfFactory: true,
      extraDependencies: ['react@beta', 'react-dom@beta'],
      extraDevDependencies: [
        'prop-types',
        '@types/react@npm:types-react@beta',
        '@types/react-dom@npm:types-react-dom@beta',
      ],
      resolutions: {
        '@types/react': 'npm:types-react@beta',
        '@types/react-dom': 'npm:types-react-dom@beta',
        react: 'npm:react@beta',
        'react-dom': 'npm:react-dom@beta',
      },
      mainConfig: {
        features: {
          developmentModeForBuild: true,
          experimentalTestSyntax: true,
        },
      },
    },
    skipTasks: ['e2e-tests', 'bench'],
  },
  'react-webpack/18-ts': {
    name: 'React Latest (Webpack | TypeScript)',
    script: 'npx create-webpack5-react {{beforeDir}}',
    expected: {
      framework: '@storybook/react-webpack5',
      renderer: '@storybook/react',
      builder: '@storybook/builder-webpack5',
    },
    modifications: {
      useCsfFactory: true,
      extraDevDependencies: ['prop-types'],
      mainConfig: {
        swc: { swcrc: false },
        features: {
          experimentalTestSyntax: true,
        },
      },
    },
    skipTasks: ['e2e-tests', 'bench', 'vitest-integration'],
  },
  'react-webpack/17-ts': {
    name: 'React v17 (Webpack | TypeScript)',
    script: 'npx create-webpack5-react {{beforeDir}} --version-react="17" --version-react-dom="17"',
    expected: {
      framework: '@storybook/react-webpack5',
      renderer: '@storybook/react',
      builder: '@storybook/builder-webpack5',
    },
    modifications: {
      useCsfFactory: true,
      extraDevDependencies: ['prop-types'],
      mainConfig: {
        swc: { swcrc: false },
        features: {
          experimentalTestSyntax: true,
        },
      },
    },
    skipTasks: ['e2e-tests', 'bench', 'vitest-integration'],
  },
  'react-webpack/prerelease-ts': {
    name: 'React Prerelease (Webpack | TypeScript)',
    /**
     * Create a Webpack project with React beta versions.
     * See https://react.dev/blog/2024/04/25/react-19-upgrade-guide#installing
     */
    script:
      'npx create-webpack5-react {{beforeDir}} --version-react="beta" --version-react-dom="beta"',
    // create-webpack5-react pins react@beta at scaffold time, so refresh must allow the
    // React beta family or the 7-day gate quarantines them. `types-react*` are the
    // packages behind the `@types/react@npm:types-react@beta` aliases; `scheduler`
    // ships in lockstep with React releases.
    minAgeGateExemptions: ['react', 'react-dom', 'types-react', 'types-react-dom', 'scheduler'],
    expected: {
      framework: '@storybook/react-webpack5',
      renderer: '@storybook/react',
      builder: '@storybook/builder-webpack5',
    },
    modifications: {
      useCsfFactory: true,
      extraDevDependencies: [
        'prop-types',
        '@types/react@npm:types-react@beta',
        '@types/react-dom@npm:types-react-dom@beta',
      ],
      resolutions: {
        '@types/react': 'npm:types-react@beta',
        '@types/react-dom': 'npm:types-react-dom@beta',
      },
      mainConfig: {
        swc: { swcrc: false },
        features: {
          experimentalTestSyntax: true,
        },
      },
    },
    skipTasks: ['e2e-tests', 'bench', 'vitest-integration'],
  },
  'react-rsbuild/default-ts': {
    name: 'React Latest (RsBuild | TypeScript)',
    script: 'npx create-rsbuild -d {{beforeDir}} -t react-ts --tools eslint',
    expected: {
      framework: 'storybook-react-rsbuild',
      renderer: '@storybook/react',
      builder: 'storybook-builder-rsbuild',
    },
    modifications: {
      extraDevDependencies: ['prop-types'],
      useCsfFactory: true,
      mainConfig: {
        features: {
          experimentalTestSyntax: true,
        },
      },
      skipMocking: true,
    },
    skipTasks: ['e2e-tests', 'e2e-tests-dev', 'bench', 'vitest-integration'],
  },
  'solid-vite/default-ts': {
    name: 'SolidJS Latest (Vite | TypeScript)',
    script: 'npx create-solid {{beforeDir}} --vanilla --ts --template=with-vitest',
    expected: {
      framework: 'storybook-solidjs-vite',
      renderer: 'storybook-solidjs-vite',
      builder: '@storybook/builder-vite',
    },
    skipTasks: ['e2e-tests', 'e2e-tests-dev', 'bench', 'vitest-integration'],
  },
  'tanstack-react-router/default-ts': {
    name: 'TanStack React Router Latest (Vite | TypeScript)',
    script: 'npx @tanstack/cli@latest create {{beforeDir}} --no-install --tailwind --router-only',
    expected: {
      framework: '@storybook/tanstack-react',
      renderer: '@storybook/react',
      builder: '@storybook/builder-vite',
    },
    modifications: {
      useCsfFactory: true,
      extraDevDependencies: ['prop-types'],
      mainConfig: {
        framework: '@storybook/tanstack-react',
        features: {
          experimentalTestSyntax: true,
        },
      },
    },
    skipTasks: ['bench'],
  },
  'tanstack-react-start/default-ts': {
    name: 'TanStack React Start Latest (Vite | TypeScript)',
    script: 'npx @tanstack/cli@latest create {{beforeDir}} --no-install --tailwind',
    expected: {
      framework: '@storybook/tanstack-react',
      renderer: '@storybook/react',
      builder: '@storybook/builder-vite',
    },
    modifications: {
      useCsfFactory: true,
      extraDevDependencies: ['prop-types'],
      mainConfig: {
        framework: '@storybook/tanstack-react',
        features: {
          experimentalTestSyntax: true,
        },
      },
    },
    skipTasks: ['bench'],
  },
  'vue3-vite/default-js': {
    name: 'Vue v3 (Vite | JavaScript)',
    script: 'npm create vite --yes {{beforeDir}} -- --template vue',
    // vue-component-meta@^3.3.9 pins @vue/language-core; both are inside the age gate.
    minAgeGateExemptions: ['vue-component-meta', '@vue/language-core'],
    expected: {
      framework: '@storybook/vue3-vite',
      renderer: '@storybook/vue3',
      builder: '@storybook/builder-vite',
    },
    modifications: {
      useCsfFactory: true,
    },
    skipTasks: ['e2e-tests', 'bench'],
  },
  'vue3-vite/default-ts': {
    name: 'Vue v3 (Vite | TypeScript)',
    script: 'npm create vite --yes {{beforeDir}} -- --template vue-ts',
    minAgeGateExemptions: ['vue-component-meta', '@vue/language-core'],
    expected: {
      framework: '@storybook/vue3-vite',
      renderer: '@storybook/vue3',
      builder: '@storybook/builder-vite',
    },
    modifications: {
      useCsfFactory: true,
    },
    skipTasks: ['bench'],
  },
  'vue3-vite/docgen-server-ts': {
    name: 'Vue Server Docgen v3 (Vite | TypeScript)',
    script: 'npm create vite --yes {{beforeDir}} -- --template vue-ts',
    minAgeGateExemptions: ['vue-component-meta', '@vue/language-core'],
    expected: {
      framework: '@storybook/vue3-vite',
      renderer: '@storybook/vue3',
      builder: '@storybook/builder-vite',
    },
    modifications: {
      extraDevDependencies: ['@storybook/addon-mcp'],
      editAddons: (addons) => [...addons, '@storybook/addon-mcp'],
      useCsfFactory: true,
      storiesVariant: 'vue3-vite-default-ts',
      mainConfig: {
        features: {
          experimentalDocgenServer: true,
          componentsManifest: true,
        },
      },
    },
    skipTasks: ['bench', 'chromatic', 'test-runner'],
  },
  'vue3-rsbuild/default-ts': {
    name: 'Vue Latest (RsBuild | TypeScript)',
    script: 'npx create-rsbuild -d {{beforeDir}} -t vue-ts --tools eslint',
    expected: {
      framework: 'storybook-vue3-rsbuild',
      renderer: '@storybook/vue3',
      builder: 'storybook-builder-rsbuild',
    },
    modifications: {
      extraDevDependencies: ['storybook-vue3-rsbuild@^3.0.0-beta.1'],
      mainConfig: {
        features: {
          experimentalTestSyntax: true,
        },
      },
      skipMocking: true,
    },
    skipTasks: ['e2e-tests', 'e2e-tests-dev', 'bench', 'vitest-integration'],
  },
  // 'nuxt-vite/default-ts': {
  //   name: 'Nuxt v3 (Vite | TypeScript)',
  //   script: 'npx nuxi init --packageManager yarn --gitInit false -M @nuxt/ui {{beforeDir}}',
  //   expected: {
  //     framework: '@storybook-vue/nuxt',
  //     renderer: '@storybook/vue3',
  //     builder: '@storybook/builder-vite',
  //   },
  //   skipTasks: ['e2e-tests', 'bench', 'vitest-integration'],
  // },
  'html-vite/default-js': {
    name: 'HTML Latest (Vite | JavaScript)',
    script:
      'npm create vite --yes {{beforeDir}} -- --template vanilla && cd {{beforeDir}} && echo "export default {}" > vite.config.js',
    expected: {
      framework: '@storybook/html-vite',
      renderer: '@storybook/html',
      builder: '@storybook/builder-vite',
    },
    skipTasks: ['e2e-tests', 'bench'],
    initOptions: {
      type: ProjectType.HTML,
    },
  },
  'html-vite/default-ts': {
    name: 'HTML Latest (Vite | TypeScript)',
    script:
      'npm create vite --yes {{beforeDir}} -- --template vanilla-ts && cd {{beforeDir}} && echo "export default {}" > vite.config.js',
    expected: {
      framework: '@storybook/html-vite',
      renderer: '@storybook/html',
      builder: '@storybook/builder-vite',
    },
    skipTasks: ['e2e-tests', 'bench'],
    initOptions: {
      type: ProjectType.HTML,
    },
  },
  'html-rsbuild/default-ts': {
    name: 'HTML Latest (RsBuild | TypeScript)',
    script: 'npx create-rsbuild -d {{beforeDir}} -t vanilla-ts --tools eslint',
    expected: {
      framework: 'storybook-html-rsbuild',
      renderer: '@storybook/html',
      builder: 'storybook-builder-rsbuild',
    },
    modifications: {
      skipMocking: true,
    },
    skipTasks: ['e2e-tests', 'e2e-tests-dev', 'bench', 'vitest-integration'],
    initOptions: {
      type: ProjectType.HTML,
    },
  },
  'svelte-vite/default-js': {
    name: 'Svelte Latest (Vite | JavaScript)',
    script: 'npm create vite --yes {{beforeDir}} -- --template svelte',
    expected: {
      framework: '@storybook/svelte-vite',
      renderer: '@storybook/svelte',
      builder: '@storybook/builder-vite',
    },
    skipTasks: ['e2e-tests', 'bench'],
  },
  'svelte-vite/default-ts': {
    name: 'Svelte Latest (Vite | TypeScript)',
    script: 'npm create vite --yes {{beforeDir}} -- --template svelte-ts',
    expected: {
      framework: '@storybook/svelte-vite',
      renderer: '@storybook/svelte',
      builder: '@storybook/builder-vite',
    },
    // Remove smoke-test from the list once https://github.com/storybookjs/storybook/issues/19351 is fixed.
    skipTasks: ['smoke-test', 'bench'],
  },
  'svelte-kit/skeleton-ts': {
    name: 'SvelteKit Latest (Vite | TypeScript)',
    script:
      'npx sv@latest create --template minimal --types ts --no-add-ons --no-install {{beforeDir}}',
    expected: {
      framework: '@storybook/sveltekit',
      renderer: '@storybook/svelte',
      builder: '@storybook/builder-vite',
    },
    skipTasks: ['e2e-tests', 'bench'],
  },
  'angular-cli/default-ts': {
    name: 'Angular CLI Latest (Webpack | TypeScript)',
    script:
      'npx -p @angular/cli ng new angular-latest --directory {{beforeDir}} --routing=true --minimal=true --style=scss --strict --skip-git --skip-install --package-manager=yarn --ssr',
    modifications: {
      // The latest CLI scaffolds Angular 22 but omits @angular/forms and @angular/animations. Match
      // the `^22` major `ng new` uses for the other @angular packages so every @angular/* aligns.
      // Also, Angular 22 needs TypeScript 6 or more recent.
      extraDependencies: ['@angular/forms@^22', '@angular/animations@^22', 'typescript@^6'],
      resolutions: {
        webpack: '5.107.2',
      },
      useCsfFactory: true,
    },
    extraCiSteps: {
      ensureMinNodeVersion: true,
    },
    expected: {
      framework: '@storybook/angular',
      renderer: '@storybook/angular',
      builder: '@storybook/builder-webpack5',
    },
    skipTasks: ['bench', 'vitest-integration'],
    initOptions: { builder: SupportedBuilder.WEBPACK5 },
  },
  'angular-vite/21-ts': {
    name: 'Angular CLI v21 (Vite | TypeScript)',
    script:
      'npx -p @angular/cli@21 ng new angular-v21 --directory {{beforeDir}} --routing=true --minimal=true --style=scss --strict --skip-git --skip-install --package-manager=yarn --ssr',
    modifications: {
      // Match the `^21.2.0` range `ng new` uses for the other @angular packages so every
      // @angular/* resolves to the same patch. An exact pin would leave forms a patch behind core.
      // See `angular-vite/default-ts` for why Compodoc is listed here.
      extraDependencies: [
        '@angular/forms@^21.2.0',
        '@angular/animations@^21.2.0',
        '@compodoc/compodoc',
      ],
      useCsfFactory: true,
    },
    extraCiSteps: {
      ensureMinNodeVersion: true,
    },
    expected: {
      framework: '@storybook/angular-vite',
      renderer: '@storybook/angular-vite',
      builder: '@storybook/builder-vite',
    },
    skipTasks: ['bench'],
    initOptions: { builder: SupportedBuilder.VITE },
  },
  'angular-vite/default-ts': {
    name: 'Angular CLI Latest (Vite | TypeScript)',
    script:
      'npx -p @angular/cli ng new angular-latest --directory {{beforeDir}} --routing=true --minimal=true --style=scss --strict --skip-git --skip-install --package-manager=yarn --ssr',
    modifications: {
      // The latest CLI scaffolds Angular 22 but omits @angular/forms and @angular/animations. Match
      // the `^22` major `ng new` uses for the other @angular packages so every @angular/* aligns.
      // Also, Angular 22 needs TypeScript 6 or more recent.
      // `@compodoc/compodoc` is no longer installed by `storybook init` for the Vite builder, but
      // the sandbox harness prepends its own `docs:json` Compodoc pass to every Angular sandbox
      // (see `sandbox-parts.ts`), so the sandboxes still have to carry the binary themselves.
      extraDependencies: [
        '@angular/forms@^22',
        '@angular/animations@^22',
        'typescript@^6',
        '@compodoc/compodoc',
      ],
      useCsfFactory: true,
      // `@storybook/angular-vite` turns the docgen server on by default, so guarding the browser
      // docgen path is now an explicit opt-out rather than the absence of a flag.
      mainConfig: {
        features: {
          experimentalDocgenServer: false,
        },
      },
    },
    extraCiSteps: {
      ensureMinNodeVersion: true,
    },
    expected: {
      framework: '@storybook/angular-vite',
      renderer: '@storybook/angular-vite',
      builder: '@storybook/builder-vite',
    },
    skipTasks: ['bench'],
    initOptions: { builder: SupportedBuilder.VITE },
  },
  'angular-vite/docgen-server-ts': {
    name: 'Angular CLI Server Docgen Latest (Vite | TypeScript)',
    // Identical to `angular-vite/default-ts` apart from the two feature flags below. Kept as its own
    // template so the stable Angular sandbox keeps guarding today's browser docgen while the server
    // path is proven separately, rather than both riding on one configuration.
    script:
      'npx -p @angular/cli ng new angular-latest --directory {{beforeDir}} --routing=true --minimal=true --style=scss --strict --skip-git --skip-install --package-manager=yarn --ssr',
    modifications: {
      // Compodoc is unused under the flag, but the sandbox harness runs it regardless.
      extraDependencies: [
        '@angular/forms@^22',
        '@angular/animations@^22',
        'typescript@^6',
        '@compodoc/compodoc',
      ],
      // The only Angular sandbox on the docgen-server path, so it is the only one that can prove
      // what an agent reads about an Angular component.
      extraDevDependencies: ['@storybook/addon-mcp'],
      editAddons: (addons) => [...addons, '@storybook/addon-mcp'],
      useCsfFactory: true,
      // These two flags are what brings a template into docgen baseline coverage; see
      // `docgenServerTemplates`.
      mainConfig: {
        features: {
          experimentalDocgenServer: true,
          componentsManifest: true,
        },
      },
    },
    extraCiSteps: {
      ensureMinNodeVersion: true,
    },
    expected: {
      framework: '@storybook/angular-vite',
      renderer: '@storybook/angular-vite',
      builder: '@storybook/builder-vite',
    },
    // This sandbox exists to guard the docgen baselines, and it differs from
    // `angular-vite/default-ts` only by two feature flags. Rendering, visual output and story
    // execution are already covered there on every run, so repeating them here would double the
    // Angular cost for no extra signal. `test-runner` goes with `chromatic`: skipping only the
    // latter swaps in a test-runner job rather than dropping one.
    skipTasks: ['bench', 'chromatic', 'test-runner'],
    initOptions: { builder: SupportedBuilder.VITE },
  },
  'lit-vite/default-js': {
    name: 'Lit Latest (Vite | JavaScript)',
    script:
      'npm create vite --yes {{beforeDir}} -- --template lit && cd {{beforeDir}} && echo "export default {}" > vite.config.js',
    expected: {
      framework: '@storybook/web-components-vite',
      renderer: '@storybook/web-components',
      builder: '@storybook/builder-vite',
    },
    modifications: {
      useCsfFactory: true,
    },
    // Remove smoke-test from the list once https://github.com/storybookjs/storybook/issues/19351 is fixed.
    skipTasks: ['smoke-test', 'e2e-tests', 'bench'],
  },
  'lit-vite/default-ts': {
    name: 'Lit Latest (Vite | TypeScript)',
    script:
      'npm create vite --yes {{beforeDir}} -- --template lit-ts && cd {{beforeDir}} && echo "export default {}" > vite.config.js',
    expected: {
      framework: '@storybook/web-components-vite',
      renderer: '@storybook/web-components',
      builder: '@storybook/builder-vite',
    },
    modifications: {
      useCsfFactory: true,
    },
    // Remove smoke-test from the list once https://github.com/storybookjs/storybook/issues/19351 is fixed.
    skipTasks: ['smoke-test', 'e2e-tests', 'bench'],
  },
  'lit-rsbuild/default-ts': {
    name: 'Web Components Latest (RsBuild | TypeScript)',
    script: 'npx create-rsbuild -d {{beforeDir}} -t lit-ts --tools eslint',
    expected: {
      framework: 'storybook-web-components-rsbuild',
      renderer: '@storybook/web-components',
      builder: 'storybook-builder-rsbuild',
    },
    modifications: {
      skipMocking: true,
    },
    skipTasks: ['e2e-tests', 'e2e-tests-dev', 'bench', 'vitest-integration'],
  },
  'preact-vite/default-js': {
    name: 'Preact Latest (Vite | JavaScript)',
    script: 'npm create vite --yes {{beforeDir}} -- --template preact',
    expected: {
      framework: '@storybook/preact-vite',
      renderer: '@storybook/preact',
      builder: '@storybook/builder-vite',
    },
    modifications: {
      extraDependencies: ['preact-render-to-string'],
    },
    skipTasks: ['e2e-tests', 'bench'],
  },
  'preact-vite/default-ts': {
    name: 'Preact Latest (Vite | TypeScript)',
    script: 'npm create vite --yes {{beforeDir}} -- --template preact-ts',
    expected: {
      framework: '@storybook/preact-vite',
      renderer: '@storybook/preact',
      builder: '@storybook/builder-vite',
    },
    modifications: {
      extraDependencies: ['preact-render-to-string'],
    },
    skipTasks: ['e2e-tests', 'bench'],
  },
  /** This is currently broken, we generate components and stories that do not work */
  // 'qwik-vite/default-ts': {
  //   name: 'Qwik CLI Latest (Vite | TypeScript)',
  //   script: 'npm create qwik playground {{beforeDir}}',
  //   // TODO: The community template does not provide standard stories, which is required for e2e tests. Reenable once it does.
  //   inDevelopment: true,
  //   expected: {
  //     framework: 'storybook-framework-qwik',
  //     renderer: 'storybook-framework-qwik',
  //     builder: 'storybook-framework-qwik',
  //   },
  //   // TODO: The community template does not provide standard stories, which is required for e2e tests.
  //   skipTasks: ['e2e-tests-dev', 'e2e-tests', 'bench', 'vitest-integration', 'chromatic'],
  // },
  'ember/3-js': {
    name: 'Ember v3 (Webpack | JavaScript)',
    script: 'npx --package ember-cli@3.28.1 ember new {{beforeDir}} --skip-install',
    inDevelopment: true,
    expected: {
      framework: '@storybook/ember',
      renderer: '@storybook/ember',
      builder: '@storybook/builder-webpack5',
    },
  },
  'ember/default-js': {
    name: 'Ember v4 (Webpack | JavaScript)',
    script:
      'npx --package ember-cli@4.12.1 ember new {{beforeDir}} --yarn && cd {{beforeDir}} && yarn add --dev @storybook/ember-cli-storybook && yarn build',
    inDevelopment: true,
    expected: {
      framework: '@storybook/ember',
      renderer: '@storybook/ember',
      builder: '@storybook/builder-webpack5',
    },
  },
  'react-native-web-vite/expo-ts': {
    // NOTE: create-expo-app installs React 18.2.0. But yarn portal
    // expects 18.3.1 (dunno why). Therefore to run this in dev you
    // must either:
    //  - edit the sandbox package.json to depend on react 18.3.1, OR
    //  - build/run the sandbox in --no-link mode, which is fine
    //
    // Users & CI won't see this limitation because they are not using
    // yarn portals.
    name: 'React Native Expo Latest (Vite | TypeScript)',
    script: 'npx create-expo-app -y --no-install {{beforeDir}}',
    // create-expo-app pins the current SDK, whose packages are released
    // together and are routinely younger than the gate window.
    // `babel-preset-expo` is part of that set despite not matching `expo-*`.
    // `multitars` is pulled in transitively by the Expo CLI toolchain.
    minAgeGateExemptions: [
      'expo',
      'expo-*',
      '@expo/*',
      'babel-preset-expo',
      'multitars',
      'react-native',
      '@react-native/*',
    ],
    expected: {
      framework: '@storybook/react-native-web-vite',
      renderer: '@storybook/react',
      builder: '@storybook/builder-vite',
    },
    modifications: {
      useCsfFactory: true,
      // The React renderer's template-stories (e.g. js-argtypes.stories.jsx) import
      // `prop-types`. Every other React-renderer sandbox declares it explicitly via
      // extraDevDependencies; this template was missing it.
      extraDevDependencies: ['prop-types'],
      mainConfig: {
        features: {
          experimentalTestSyntax: true,
        },
      },
    },
    skipTasks: ['bench', 'vitest-integration'],
    initOptions: {
      type: ProjectType.REACT_NATIVE_WEB,
    },
  },
  'react-native-web-vite/rn-cli-ts': {
    name: 'React Native CLI Latest (Vite | TypeScript)',
    script:
      'npx @react-native-community/cli@latest init --skip-install --install-pods=false --directory={{beforeDir}} rnapp',
    // The CLI downloads `@react-native-community/template` during init even with
    // --skip-install; those packages ship in lockstep with each RN release.
    minAgeGateExemptions: ['@react-native-community/*', 'react-native', '@react-native/*'],
    expected: {
      framework: '@storybook/react-native-web-vite',
      renderer: '@storybook/react',
      builder: '@storybook/builder-vite',
    },
    modifications: {
      // The React renderer's template-stories (e.g. js-argtypes.stories.jsx) import
      // `prop-types`. Every other React-renderer sandbox declares it explicitly via
      // extraDevDependencies; this template was missing it.
      extraDevDependencies: ['prop-types'],
    },
    skipTasks: ['e2e-tests', 'bench', 'vitest-integration'],
    initOptions: {
      type: ProjectType.REACT_NATIVE_WEB,
    },
  },
} satisfies Record<string, BaseTemplates>;

/**
 * Internal templates reuse config from other templates and add extra config on top. They must
 * contain an id that starts with 'internal/' and contain "isInternal: true". They will be hidden by
 * default in the Storybook status page.
 */
const internalTemplates = {
  'internal/react18-webpack-babel': {
    name: 'React with Babel Latest (Webpack | TypeScript)',
    script: 'npx create-webpack5-react {{beforeDir}}',
    expected: {
      framework: '@storybook/react-webpack5',
      renderer: '@storybook/react',
      builder: '@storybook/builder-webpack5',
    },
    modifications: {
      useCsfFactory: true,
      extraDevDependencies: ['@storybook/addon-webpack5-compiler-babel', 'prop-types'],
      removeDependencies: ['babel-preset-react-app'],
      resolutions: {
        '@babel/core': '^7',
        '@babel/preset-env': '^7',
        '@babel/preset-react': '^7',
        '@babel/preset-typescript': '^7',
      },
      editAddons: (addons) =>
        [...addons, '@storybook/addon-webpack5-compiler-babel'].filter(
          (a) => a !== '@storybook/addon-webpack5-compiler-swc'
        ),
      mainConfig: {
        swc: { swcrc: false },
        features: {
          experimentalTestSyntax: true,
        },
      },
    },
    isInternal: true,
    skipTasks: ['e2e-tests', 'bench', 'vitest-integration'],
  },
  'internal/server-webpack5': {
    name: 'Server Webpack5',
    script: 'yarn init -y && echo "module.exports = {}" > webpack.config.js',
    expected: {
      framework: '@storybook/server-webpack5',
      renderer: '@storybook/server',
      builder: '@storybook/builder-webpack5',
    },
    isInternal: true,
    skipTasks: ['bench', 'vitest-integration'],
    initOptions: {
      type: ProjectType.SERVER,
    },
  },
} satisfies Record<`internal/${string}`, Template & { isInternal: true }>;

const benchTemplates = {
  'bench/react-vite-default-ts': {
    ...baseTemplates['react-vite/default-ts'],
    name: 'Bench (react-vite/default-ts)',
    isInternal: true,
    modifications: {
      skipTemplateStories: true,
      skipMocking: true,
    },
    skipTasks: [
      'e2e-tests',
      'test-runner',
      'test-runner-dev',
      'e2e-tests-dev',
      'chromatic',
      'vitest-integration',
    ],
    typeCheck: false,
  },
  'bench/react-webpack-18-ts': {
    ...baseTemplates['react-webpack/18-ts'],
    name: 'Bench (react-webpack/18-ts)',
    isInternal: true,
    modifications: {
      skipTemplateStories: true,
      skipMocking: true,
    },
    skipTasks: [
      'e2e-tests',
      'test-runner',
      'test-runner-dev',
      'e2e-tests-dev',
      'chromatic',
      'vitest-integration',
    ],
  },
  'bench/react-vite-default-ts-nodocs': {
    ...baseTemplates['react-vite/default-ts'],
    name: 'Bench (react-vite/default-ts, no docs)',
    isInternal: true,
    modifications: {
      skipTemplateStories: true,
      disableDocs: true,
      skipMocking: true,
    },
    skipTasks: [
      'e2e-tests',
      'test-runner',
      'test-runner-dev',
      'e2e-tests-dev',
      'chromatic',
      'vitest-integration',
    ],
    typeCheck: false,
  },
  'bench/react-vite-default-ts-test-build': {
    ...baseTemplates['react-vite/default-ts'],
    name: 'Bench (react-vite/default-ts, test-build)',
    isInternal: true,
    modifications: {
      skipTemplateStories: true,
      testBuild: true,
      skipMocking: true,
    },
    skipTasks: [
      'e2e-tests',
      'test-runner',
      'test-runner-dev',
      'e2e-tests-dev',
      'vitest-integration',
    ],
    typeCheck: false,
  },
  'bench/react-webpack-18-ts-test-build': {
    ...baseTemplates['react-webpack/18-ts'],
    name: 'Bench (react-webpack/18-ts, test-build)',
    isInternal: true,
    modifications: {
      skipTemplateStories: true,
      testBuild: true,
      skipMocking: true,
    },
    skipTasks: [
      'e2e-tests',
      'test-runner',
      'test-runner-dev',
      'e2e-tests-dev',
      'vitest-integration',
    ],
  },
} satisfies Record<string, Template & { isInternal: true }>;

export const allTemplates: Record<TemplateKey, Template> = {
  ...baseTemplates,
  ...internalTemplates,
  ...benchTemplates,
};

export const normal: TemplateKey[] = [
  // TODO: Add this back once we resolve the React 19 issues
  // 'cra/default-ts',
  'react-vite/default-ts',
  'angular-cli/default-ts',
  'angular-vite/default-ts',
  'vue3-vite/default-ts',
  // 'nuxt-vite/default-ts', // temporarily disabled because it's broken
  'lit-vite/default-ts',
  'svelte-vite/default-ts',
  'svelte-kit/skeleton-ts',
  'nextjs/default-ts',
  'nextjs-vite/default-ts',
  'bench/react-vite-default-ts',
  'bench/react-webpack-18-ts',
  'bench/react-vite-default-ts-nodocs',
  'bench/react-vite-default-ts-test-build',
  'bench/react-webpack-18-ts-test-build',
  // 'ember/default-js',
  'react-rsbuild/default-ts',
  'tanstack-react-router/default-ts',
  'tanstack-react-start/default-ts',
  // The sandboxes that record docgen baselines. Running them daily meant a change to the
  // extraction could merge without ever touching them, which is how the props-table visibility
  // rules landed on a stale recording.
  // TODO(11.0): remove these templates. The standard sandboxes ship the new docgen approach by
  // default from then on, so the `default-ts` templates carry the baselines and these are
  // redundant.
  'angular-vite/docgen-server-ts',
  'vue3-vite/docgen-server-ts',
];

export const merged: TemplateKey[] = [
  ...normal,
  'react-webpack/18-ts',
  'react-webpack/17-ts',
  'nextjs/15-ts',
  'nextjs-vite/15-ts',
  'preact-vite/default-ts',
  'html-vite/default-ts',
  'solid-vite/default-ts',
  'vue3-rsbuild/default-ts',
];

export const daily: TemplateKey[] = [
  ...merged,
  'angular-vite/21-ts',
  // TODO: Add this back once we resolve the React 19 issues
  // 'cra/default-js',
  'react-vite/default-js',
  'react-vite/prerelease-ts',
  'react-webpack/prerelease-ts',
  'vue3-vite/default-js',
  'lit-vite/default-js',
  'svelte-vite/default-js',
  'nextjs/prerelease',
  // 'qwik-vite/default-ts',
  'preact-vite/default-js',
  'html-vite/default-js',
  'internal/react18-webpack-babel',
  'react-native-web-vite/expo-ts',
  'lit-rsbuild/default-ts',
  'html-rsbuild/default-ts',
  // 'react-native-web-vite/rn-cli-ts',
];

export const templatesByCadence = { normal, merged, daily };

// Both are required: without `componentsManifest`, `experimentalDocgenServer` writes nothing to disk
// for the recorded baselines to read.
const DOCGEN_SERVER_FEATURES = ['experimentalDocgenServer', 'componentsManifest'] as const;

// Templates whose `mainConfig` is a function of the generated `ConfigFile`, so its features cannot be
// read without running the sandbox generator. Listed by name so a new function-form template throws
// below instead of silently dropping out of docgen baseline coverage.
const UNREADABLE_MAIN_CONFIG_TEMPLATES = new Set<string>(['cra/default-js']);

const enablesDocgenServer = (key: string, template: Template): boolean => {
  const { mainConfig } = template.modifications ?? {};
  if (typeof mainConfig === 'function') {
    if (!UNREADABLE_MAIN_CONFIG_TEMPLATES.has(key)) {
      // eslint-disable-next-line local-rules/no-uncategorized-errors
      throw new Error(
        `Template "${key}" declares mainConfig as a function, whose features cannot be read here. ` +
          `Move ${DOCGEN_SERVER_FEATURES.join(' and ')} into the object form to opt into docgen ` +
          `baseline coverage, or add the key to UNREADABLE_MAIN_CONFIG_TEMPLATES to stay out of it.`
      );
    }
    return false;
  }
  const features = mainConfig?.features;
  return DOCGEN_SERVER_FEATURES.every((feature) => features?.[feature] === true);
};

// Derived from the flags rather than kept as a second list, so turning them on for a template is all
// it takes to bring it into docgen baseline coverage.
export const docgenServerTemplates = (): TemplateKey[] =>
  (Object.entries(allTemplates) as [TemplateKey, Template][])
    .filter(([key, template]) => enablesDocgenServer(key, template))
    .map(([key]) => key);
