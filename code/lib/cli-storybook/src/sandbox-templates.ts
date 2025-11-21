import type { ConfigFile } from 'storybook/internal/csf-tools';
import { type StoriesEntry, type StorybookConfigRaw } from 'storybook/internal/types';

import { ProjectType } from '../../../core/src/cli/projectTypes';
import { SupportedBuilder } from '../../../core/src/types/modules/builders';

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
    editAddons?: (addons: string[]) => string[];
    useCsfFactory?: boolean;
  };
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
      extraDependencies: ['prop-types'],
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
      extraDependencies: ['prop-types'],
      mainConfig: {
        features: {
          experimentalTestSyntax: true,
        },
      },
    },
  },
  'nextjs/14-ts': {
    name: 'Next.js v14.2 (Webpack | TypeScript)',
    script:
      'yarn create next-app {{beforeDir}} -e https://github.com/vercel/next.js/tree/v14.2.17/examples/hello-world && cd {{beforeDir}} && npm pkg set "dependencies.next"="^14.2.17" && yarn && git add . && git commit --amend --no-edit && cd ..',
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
      extraDependencies: ['server-only', 'prop-types'],
    },
    initOptions: {
      builder: SupportedBuilder.WEBPACK5,
    },
    skipTasks: ['e2e-tests-dev', 'e2e-tests', 'bench', 'vitest-integration'],
  },
  'nextjs/15-ts': {
    name: 'Next.js v15 (Webpack | TypeScript)',
    script:
      'npx create-next-app@^15.5 {{beforeDir}} --eslint --tailwind --app --import-alias="@/*" --src-dir',
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
      extraDependencies: ['server-only', 'prop-types'],
    },
    initOptions: {
      builder: SupportedBuilder.WEBPACK5,
    },
    skipTasks: ['e2e-tests', 'bench', 'vitest-integration'],
  },
  'nextjs/default-ts': {
    name: 'Next.js Latest (Webpack | TypeScript)',
    script:
      'npx create-next-app {{beforeDir}} --eslint --tailwind --app --import-alias="@/*" --src-dir',
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
      extraDependencies: ['server-only', 'prop-types'],
    },
    initOptions: {
      builder: SupportedBuilder.WEBPACK5,
    },
    skipTasks: ['bench', 'vitest-integration'],
  },
  'nextjs/prerelease': {
    name: 'Next.js Prerelease (Webpack | TypeScript)',
    script:
      'npx create-next-app@canary {{beforeDir}} --eslint --tailwind --app --import-alias="@/*" --src-dir',
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
      extraDependencies: ['server-only', 'prop-types'],
    },
    initOptions: {
      builder: SupportedBuilder.WEBPACK5,
    },
    skipTasks: ['e2e-tests', 'bench', 'vitest-integration'],
  },
  'nextjs-vite/14-ts': {
    name: 'Next.js v14 (Vite | TypeScript)',
    script:
      'npx create-next-app@^14 {{beforeDir}} --eslint --tailwind --app --import-alias="@/*" --src-dir',
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
      extraDependencies: ['server-only', 'vite', 'prop-types'],
    },
    skipTasks: ['e2e-tests', 'bench'],
  },
  'nextjs-vite/15-ts': {
    name: 'Next.js v15 (Vite | TypeScript)',
    script:
      'npx create-next-app@^15 {{beforeDir}} --eslint --tailwind --app --import-alias="@/*" --src-dir',
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
      extraDependencies: ['server-only', 'vite', 'prop-types'],
    },
    skipTasks: ['e2e-tests', 'bench'],
  },
  'nextjs-vite/default-ts': {
    name: 'Next.js Latest (Vite | TypeScript)',
    script:
      'npx create-next-app {{beforeDir}} --eslint --no-tailwind --app --import-alias="@/*" --src-dir',
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
      extraDependencies: ['server-only', 'vite', 'prop-types'],
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
      extraDependencies: ['prop-types'],
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
      extraDependencies: ['prop-types', '@types/prop-types'],
      mainConfig: {
        features: {
          developmentModeForBuild: true,
          experimentalTestSyntax: true,
        },
      },
    },
    skipTasks: ['bench'],
    typeCheck: true,
  },
  'react-vite/prerelease-ts': {
    name: 'React Prerelease (Vite | TypeScript)',
    /**
     * 1. Create a Vite project with the React template
     * 2. Add React beta versions
     * 3. Add resolutions for react, react-dom,@types/react and @types/react-dom, see
     *    https://react.dev/blog/2024/04/25/react-19-upgrade-guide#installing
     * 4. Add @types/react and @types/react-dom pointing to the beta packages
     */
    script: `
      npm create vite --yes {{beforeDir}} -- --template react-ts && \
      cd {{beforeDir}} && \
      jq '.resolutions += {"@types/react": "npm:types-react@beta", "@types/react-dom": "npm:types-react-dom@beta", "react": "npm:react@beta", "react-dom": "npm:react-dom@beta"}' package.json > tmp.json && mv tmp.json package.json && \
      yarn add react@beta react-dom@beta && \
      yarn add --dev @types/react@npm:types-react@beta @types/react-dom@npm:types-react-dom@beta
      `,
    expected: {
      framework: '@storybook/react-vite',
      renderer: '@storybook/react',
      builder: '@storybook/builder-vite',
    },
    modifications: {
      useCsfFactory: true,
      extraDependencies: ['prop-types'],
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
    script: 'yarn create webpack5-react {{beforeDir}}',
    expected: {
      framework: '@storybook/react-webpack5',
      renderer: '@storybook/react',
      builder: '@storybook/builder-webpack5',
    },
    modifications: {
      useCsfFactory: true,
      extraDependencies: ['prop-types'],
      mainConfig: {
        features: {
          experimentalTestSyntax: true,
        },
      },
    },
    skipTasks: ['e2e-tests', 'bench', 'vitest-integration'],
  },
  'react-webpack/17-ts': {
    name: 'React v17 (Webpack | TypeScript)',
    script:
      'yarn create webpack5-react {{beforeDir}} --version-react="17" --version-react-dom="17"',
    expected: {
      framework: '@storybook/react-webpack5',
      renderer: '@storybook/react',
      builder: '@storybook/builder-webpack5',
    },
    modifications: {
      useCsfFactory: true,
      extraDependencies: ['prop-types'],
      mainConfig: {
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
     * 1. Create a Webpack project with React beta versions
     * 2. Add resolutions for @types/react and @types/react-dom, see
     *    https://react.dev/blog/2024/04/25/react-19-upgrade-guide#installing
     * 3. Add @types/react and @types/react-dom pointing to the beta packages
     */
    script: `
      yarn create webpack5-react {{beforeDir}} --version-react="beta" --version-react-dom="beta" && \
      cd {{beforeDir}} && \
      jq '.resolutions += {"@types/react": "npm:types-react@beta", "@types/react-dom": "npm:types-react-dom@beta"}' package.json > tmp.json && mv tmp.json package.json && \
      yarn add --dev @types/react@npm:types-react@beta @types/react-dom@npm:types-react-dom@beta
      `,
    expected: {
      framework: '@storybook/react-webpack5',
      renderer: '@storybook/react',
      builder: '@storybook/builder-webpack5',
    },
    modifications: {
      useCsfFactory: true,
      extraDependencies: ['prop-types'],
      mainConfig: {
        features: {
          experimentalTestSyntax: true,
        },
      },
    },
    skipTasks: ['e2e-tests', 'bench', 'vitest-integration'],
  },
  'react-rsbuild/default-ts': {
    name: 'React Latest (RsBuild | TypeScript)',
    script: 'yarn create rsbuild -d {{beforeDir}} -t react-ts --tools eslint',
    expected: {
      framework: 'storybook-react-rsbuild',
      renderer: '@storybook/react',
      builder: 'storybook-builder-rsbuild',
    },
    modifications: {
      extraDependencies: ['prop-types', 'storybook-react-rsbuild@^3.0.0-beta.1'],
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
    script: 'yarn create solid {{beforeDir}} --vanilla --ts --template=with-vitest',
    expected: {
      framework: 'storybook-solidjs-vite',
      renderer: 'storybook-solidjs-vite',
      builder: '@storybook/builder-vite',
    },
    skipTasks: ['e2e-tests', 'bench', 'vitest-integration'],
  },
  'vue3-vite/default-js': {
    name: 'Vue v3 (Vite | JavaScript)',
    script: 'npm create vite --yes {{beforeDir}} -- --template vue',
    expected: {
      framework: '@storybook/vue3-vite',
      renderer: '@storybook/vue3',
      builder: '@storybook/builder-vite',
    },
    skipTasks: ['e2e-tests', 'bench'],
  },
  'vue3-vite/default-ts': {
    name: 'Vue v3 (Vite | TypeScript)',
    script: 'npm create vite --yes {{beforeDir}} -- --template vue-ts',
    expected: {
      framework: '@storybook/vue3-vite',
      renderer: '@storybook/vue3',
      builder: '@storybook/builder-vite',
    },
    skipTasks: ['bench'],
  },
  'vue3-rsbuild/default-ts': {
    name: 'Vue Latest (RsBuild | TypeScript)',
    script: 'yarn create rsbuild -d {{beforeDir}} -t vue-ts --tools eslint',
    expected: {
      framework: 'storybook-vue3-rsbuild',
      renderer: '@storybook/vue3',
      builder: 'storybook-builder-rsbuild',
    },
    modifications: {
      extraDependencies: ['storybook-vue3-rsbuild@^3.0.0-beta.1'],
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
    skipTasks: ['e2e-tests', 'bench', 'vitest-integration'],
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
    skipTasks: ['e2e-tests', 'bench', 'vitest-integration'],
    initOptions: {
      type: ProjectType.HTML,
    },
  },
  'html-rsbuild/default-ts': {
    name: 'HTML Latest (RsBuild | TypeScript)',
    script: 'yarn create rsbuild -d {{beforeDir}} -t vanilla-ts --tools eslint',
    expected: {
      framework: 'storybook-html-rsbuild',
      renderer: '@storybook/html',
      builder: 'storybook-builder-rsbuild',
    },
    modifications: {
      extraDependencies: ['storybook-html-rsbuild@^3.0.0-beta.1'],
      skipMocking: true,
    },
    skipTasks: ['e2e-tests', 'e2e-tests-dev', 'bench', 'vitest-integration'],
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
  'angular-cli/prerelease': {
    name: 'Angular CLI Prerelease (Webpack | TypeScript)',
    script:
      'npx -p @angular/cli@next ng new angular-v16 --directory {{beforeDir}} --routing=true --minimal=true --style=scss --strict --skip-git --skip-install --package-manager=yarn --ssr',
    modifications: {
      // Angular 21 has introduced a peer dependency requirement on standard-schema via @angular/forms`
      extraDependencies: ['@standard-schema/spec@^1', '@angular/forms@next'],
    },
    expected: {
      framework: '@storybook/angular',
      renderer: '@storybook/angular',
      builder: '@storybook/builder-webpack5',
    },
    skipTasks: ['e2e-tests', 'bench', 'vitest-integration'],
  },
  'angular-cli/default-ts': {
    name: 'Angular CLI Latest (Webpack | TypeScript)',
    script:
      'npx -p @angular/cli ng new angular-latest --directory {{beforeDir}} --routing=true --minimal=true --style=scss --strict --skip-git --skip-install --package-manager=yarn --ssr',
    modifications: {
      extraDependencies: ['@angular/forms@latest'],
    },
    expected: {
      framework: '@storybook/angular',
      renderer: '@storybook/angular',
      builder: '@storybook/builder-webpack5',
    },
    skipTasks: ['bench', 'vitest-integration'],
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
  'lit-vite/default-js': {
    name: 'Lit Latest (Vite | JavaScript)',
    script:
      'npm create vite --yes {{beforeDir}} -- --template lit && cd {{beforeDir}} && echo "export default {}" > vite.config.js',
    expected: {
      framework: '@storybook/web-components-vite',
      renderer: '@storybook/web-components',
      builder: '@storybook/builder-vite',
    },
    // Remove smoke-test from the list once https://github.com/storybookjs/storybook/issues/19351 is fixed.
    skipTasks: ['smoke-test', 'e2e-tests', 'bench', 'vitest-integration'],
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
    // Remove smoke-test from the list once https://github.com/storybookjs/storybook/issues/19351 is fixed.
    skipTasks: ['smoke-test', 'e2e-tests', 'bench', 'vitest-integration'],
  },
  'lit-rsbuild/default-ts': {
    name: 'Web Components Latest (RsBuild | TypeScript)',
    script: 'yarn create rsbuild -d {{beforeDir}} -t lit-ts --tools eslint',
    expected: {
      framework: 'storybook-web-components-rsbuild',
      renderer: '@storybook/web-components',
      builder: 'storybook-builder-rsbuild',
    },
    modifications: {
      extraDependencies: ['storybook-web-components-rsbuild@^3.0.0-beta.1'],
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
  'qwik-vite/default-ts': {
    name: 'Qwik CLI Latest (Vite | TypeScript)',
    script: 'npm create qwik playground {{beforeDir}}',
    // TODO: The community template does not provide standard stories, which is required for e2e tests. Reenable once it does.
    inDevelopment: true,
    expected: {
      framework: 'storybook-framework-qwik',
      renderer: 'storybook-framework-qwik',
      builder: 'storybook-framework-qwik',
    },
    // TODO: The community template does not provide standard stories, which is required for e2e tests.
    skipTasks: ['e2e-tests-dev', 'e2e-tests', 'bench', 'vitest-integration'],
  },
  'ember/3-js': {
    name: 'Ember v3 (Webpack | JavaScript)',
    script: 'npx --package ember-cli@3.28.1 ember new {{beforeDir}}',
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
    script: 'npx create-expo-app -y {{beforeDir}}',
    expected: {
      framework: '@storybook/react-native-web-vite',
      renderer: '@storybook/react',
      builder: '@storybook/builder-vite',
    },
    modifications: {
      useCsfFactory: true,
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
    // NOTE: create-expo-app installs React 18.2.0. But yarn portal
    // expects 18.3.1 (dunno why). Therefore to run this in dev you
    // must either:
    //  - edit the sandbox package.json to depend on react 18.3.1, OR
    //  - build/run the sandbox in --no-link mode, which is fine
    //
    // Users & CI won't see this limitation because they are not using
    // yarn portals.
    name: 'React Native CLI Latest (Vite | TypeScript)',
    script:
      'npx @react-native-community/cli@latest init --install-pods=false --directory={{beforeDir}} rnapp',
    expected: {
      framework: '@storybook/react-native-web-vite',
      renderer: '@storybook/react',
      builder: '@storybook/builder-vite',
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
    script: 'yarn create webpack5-react {{beforeDir}}',
    expected: {
      framework: '@storybook/react-webpack5',
      renderer: '@storybook/react',
      builder: '@storybook/builder-webpack5',
    },
    modifications: {
      useCsfFactory: true,
      extraDependencies: ['@storybook/addon-webpack5-compiler-babel', 'prop-types'],
      editAddons: (addons) =>
        [...addons, '@storybook/addon-webpack5-compiler-babel'].filter(
          (a) => a !== '@storybook/addon-webpack5-compiler-swc'
        ),
      mainConfig: {
        features: {
          experimentalTestSyntax: true,
        },
      },
    },
    isInternal: true,
    skipTasks: ['e2e-tests', 'bench', 'vitest-integration'],
  },
  'internal/react16-webpack': {
    name: 'React 16 (Webpack | TypeScript)',
    script:
      'yarn create webpack5-react {{beforeDir}} --version-react=16 --version-react-dom=16 --version-@types/react=16 --version-@types/react-dom=16',
    expected: {
      framework: '@storybook/react-webpack5',
      renderer: '@storybook/react',
      builder: '@storybook/builder-webpack5',
    },
    modifications: {
      useCsfFactory: true,
      extraDependencies: ['prop-types'],
      mainConfig: {
        features: {
          experimentalTestSyntax: true,
        },
      },
    },
    skipTasks: ['e2e-tests', 'bench', 'vitest-integration'],
    isInternal: true,
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
  'ember/default-js',
  'react-rsbuild/default-ts',
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
  'angular-cli/prerelease',
  // TODO: Add this back once we resolve the React 19 issues
  // 'cra/default-js',
  'react-vite/default-js',
  'react-vite/prerelease-ts',
  'react-webpack/prerelease-ts',
  'nextjs-vite/14-ts',
  'nextjs/14-ts',
  'vue3-vite/default-js',
  'lit-vite/default-js',
  'svelte-vite/default-js',
  'nextjs/prerelease',
  'qwik-vite/default-ts',
  'preact-vite/default-js',
  'html-vite/default-js',
  'internal/react16-webpack',
  'internal/react18-webpack-babel',
  'react-native-web-vite/expo-ts',
  'lit-rsbuild/default-ts',
  'html-rsbuild/default-ts',
  // 'react-native-web-vite/rn-cli-ts',
];

export const templatesByCadence = { normal, merged, daily };
