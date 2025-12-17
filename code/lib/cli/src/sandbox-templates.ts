import type { StorybookConfig } from '@storybook/types';

export type SkippableTask =
  | 'smoke-test'
  | 'test-runner'
  | 'test-runner-dev'
  | 'chromatic'
  | 'e2e-tests'
  | 'e2e-tests-dev'
  | 'bench';

export type TemplateKey =
  | keyof typeof baseTemplates
  | keyof typeof internalTemplates
  | keyof typeof benchTemplates;
export type Cadence = keyof typeof templatesByCadence;

export type Template = {
  /**
   * Readable name for the template, which will be used for feedback and the status page
   * Follows the naming scheme when it makes sense:
   * <framework> <"v"version|"Latest"|"Prerelease"> (<"Webpack"|"Vite"> | <"JavaScript"|"TypeScript">)
   * React Latest - Webpack (TS)
   * Next.js v12 (JS)
   * Angular CLI Prerelease
   */
  name: string;
  /**
   * Script used to generate the base project of a template.
   * The Storybook CLI will then initialize Storybook on top of that template.
   * This is used to generate projects which are pushed to https://github.com/storybookjs/sandboxes
   */
  script: string;
  /**
   * Used to assert various things about the generated template.
   * If the template is generated with a different expected framework, it will fail, detecting a possible regression.
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
   * Some sandboxes might not work properly in specific tasks temporarily, but we might
   * still want to run the other tasks. Set the ones to skip in this property.
   */
  skipTasks?: SkippableTask[];
  /**
   * Set this only while developing a newly created framework, to avoid using it in CI.
   * NOTE: Make sure to always add a TODO comment to remove this flag in a subsequent PR.
   */
  inDevelopment?: boolean;
  /**
   * Some sandboxes might need extra modifications in the initialized Storybook,
   * such as extend main.js, for setting specific feature flags like storyStoreV7, etc.
   */
  modifications?: {
    skipTemplateStories?: boolean;
    mainConfig?: Partial<StorybookConfig>;
    testBuild?: boolean;
    disableDocs?: boolean;
  };
  /**
   * Flag to indicate that this template is a secondary template, which is used mainly to test rather specific features.
   * This means the template might be hidden from the Storybook status page or the repro CLI command.
   * */
  isInternal?: boolean;
};

type BaseTemplates = Template & {
  name: `${string} ${`v${number}` | 'Latest' | 'Prerelease'} (${'Webpack' | 'Vite'} | ${
    | 'JavaScript'
    | 'TypeScript'})`;
};

const baseTemplates = {
  'cra/default-js': {
    name: 'Create React App Latest (Webpack | JavaScript)',
    script: 'npx create-react-app {{beforeDir}}',
    expected: {
      // TODO: change this to @storybook/cra once that package is created
      framework: '@storybook/react-webpack5',
      renderer: '@storybook/react',
      builder: '@storybook/builder-webpack5',
    },
    skipTasks: ['e2e-tests-dev', 'bench'],
  },
  'cra/default-ts': {
    name: 'Create React App Latest (Webpack | TypeScript)',
    script: 'npx create-react-app {{beforeDir}} --template typescript',
    // Re-enable once https://github.com/storybookjs/storybook/issues/19351 is fixed.
    skipTasks: ['smoke-test', 'bench'],
    expected: {
      // TODO: change this to @storybook/cra once that package is created
      framework: '@storybook/react-webpack5',
      renderer: '@storybook/react',
      builder: '@storybook/builder-webpack5',
    },
  },
  'nextjs/default-js': {
    name: 'Next.js Latest (Webpack | JavaScript)',
    script:
      'yarn create next-app {{beforeDir}} --javascript --eslint --tailwind --app --import-alias="@/*" --src-dir',
    expected: {
      framework: '@storybook/nextjs',
      renderer: '@storybook/react',
      builder: '@storybook/builder-webpack5',
    },
    skipTasks: ['e2e-tests-dev', 'bench'],
  },
  'nextjs/default-ts': {
    name: 'Next.js Latest (Webpack | TypeScript)',
    script:
      'yarn create next-app {{beforeDir}} --typescript --eslint --tailwind --app --import-alias="@/*" --src-dir',
    expected: {
      framework: '@storybook/nextjs',
      renderer: '@storybook/react',
      builder: '@storybook/builder-webpack5',
    },
    skipTasks: ['e2e-tests-dev', 'bench'],
  },
  'nextjs/prerelease': {
    name: 'Next.js Prerelease (Webpack | TypeScript)',
    script:
      'npx create-next-app@canary {{beforeDir}} --typescript --eslint --tailwind --app --import-alias="@/*" --src-dir',
    expected: {
      framework: '@storybook/nextjs',
      renderer: '@storybook/react',
      builder: '@storybook/builder-webpack5',
    },
    skipTasks: ['e2e-tests-dev', 'bench'],
  },
  'react-vite/default-js': {
    name: 'React Latest (Vite | JavaScript)',
    script: 'npm create vite --yes {{beforeDir}} -- --template react',
    expected: {
      framework: '@storybook/react-vite',
      renderer: '@storybook/react',
      builder: '@storybook/builder-vite',
    },
    skipTasks: ['e2e-tests-dev', 'bench'],
  },
  'react-vite/default-ts': {
    name: 'React Latest (Vite | TypeScript)',
    script: 'npm create vite --yes {{beforeDir}} -- --template react-ts',
    expected: {
      framework: '@storybook/react-vite',
      renderer: '@storybook/react',
      builder: '@storybook/builder-vite',
    },
    skipTasks: ['bench'],
  },
  'react-webpack/18-ts': {
    name: 'React Latest (Webpack | TypeScript)',
    script: 'yarn create webpack5-react {{beforeDir}}',
    expected: {
      framework: '@storybook/react-webpack5',
      renderer: '@storybook/react',
      builder: '@storybook/builder-webpack5',
    },
    skipTasks: ['e2e-tests-dev', 'bench'],
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
    skipTasks: ['e2e-tests-dev', 'bench'],
  },
  'solid-vite/default-js': {
    name: 'SolidJS Latest (Vite | JavaScript)',
    script: 'npx degit solidjs/templates/js {{beforeDir}}',
    expected: {
      framework: 'storybook-solidjs-vite',
      renderer: 'storybook-solidjs',
      builder: '@storybook/builder-vite',
    },
    // TODO: remove this once solid-vite framework is released
    inDevelopment: true,
    skipTasks: ['e2e-tests-dev', 'bench'],
  },
  'solid-vite/default-ts': {
    name: 'SolidJS Latest (Vite | TypeScript)',
    script: 'npx degit solidjs/templates/ts {{beforeDir}}',
    expected: {
      framework: 'storybook-solidjs-vite',
      renderer: 'storybook-solidjs',
      builder: '@storybook/builder-vite',
    },
    // TODO: remove this once solid-vite framework is released
    inDevelopment: true,
    skipTasks: ['e2e-tests-dev', 'bench'],
  },
  'vue3-vite/default-js': {
    name: 'Vue v3 (Vite | JavaScript)',
    script: 'npm create vite --yes {{beforeDir}} -- --template vue',
    expected: {
      framework: '@storybook/vue3-vite',
      renderer: '@storybook/vue3',
      builder: '@storybook/builder-vite',
    },
    skipTasks: ['e2e-tests-dev', 'bench'],
  },
  'vue3-vite/default-ts': {
    name: 'Vue v3 (Vite | TypeScript)',
    script: 'npm create vite --yes {{beforeDir}} -- --template vue-ts',
    expected: {
      framework: '@storybook/vue3-vite',
      renderer: '@storybook/vue3',
      builder: '@storybook/builder-vite',
    },
    skipTasks: ['e2e-tests-dev', 'bench'],
  },
  'vue2-vite/2.7-js': {
    name: 'Vue v2 (Vite | JavaScript)',
    script: 'npx create-vue@2 {{beforeDir}} --default',
    expected: {
      framework: '@storybook/vue-vite',
      renderer: '@storybook/vue',
      builder: '@storybook/builder-vite',
    },
    // Remove smoke-test from the list once https://github.com/storybookjs/storybook/issues/19351 is fixed.
    skipTasks: ['smoke-test', 'e2e-tests-dev', 'bench'],
  },
  'html-webpack/default': {
    name: 'HTML Latest (Webpack | JavaScript)',
    script: 'yarn create webpack5-html {{beforeDir}}',
    expected: {
      framework: '@storybook/html-webpack5',
      renderer: '@storybook/html',
      builder: '@storybook/builder-webpack5',
    },
    skipTasks: ['e2e-tests-dev', 'bench'],
  },
  'html-vite/default-js': {
    name: 'HTML Latest (Vite | JavaScript)',
    script:
      'npm create vite --yes {{beforeDir}} -- --template vanilla && cd {{beforeDir}} && echo "export default {}" > vite.config.js',
    expected: {
      framework: '@storybook/html-vite',
      renderer: '@storybook/html',
      builder: '@storybook/builder-vite',
    },
    skipTasks: ['e2e-tests-dev', 'bench'],
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
    skipTasks: ['e2e-tests-dev', 'bench'],
  },
  'svelte-vite/default-js': {
    name: 'Svelte Latest (Vite | JavaScript)',
    script: 'npm create vite --yes {{beforeDir}} -- --template svelte',
    expected: {
      framework: '@storybook/svelte-vite',
      renderer: '@storybook/svelte',
      builder: '@storybook/builder-vite',
    },
    skipTasks: ['e2e-tests-dev', 'bench'],
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
    skipTasks: ['smoke-test', 'e2e-tests-dev', 'bench'],
  },
  'angular-cli/prerelease': {
    name: 'Angular CLI Prerelease (Webpack | TypeScript)',
    script:
      'npx -p @angular/cli@next ng new angular-v16 --directory {{beforeDir}} --routing=true --minimal=true --style=scss --strict --skip-git --skip-install --package-manager=yarn --ssr',
    expected: {
      framework: '@storybook/angular',
      renderer: '@storybook/angular',
      builder: '@storybook/builder-webpack5',
    },
    skipTasks: ['e2e-tests-dev', 'bench'],
  },
  'angular-cli/default-ts': {
    name: 'Angular CLI Latest (Webpack | TypeScript)',
    script:
      'npx -p @angular/cli ng new angular-latest --directory {{beforeDir}} --routing=true --minimal=true --style=scss --strict --skip-git --skip-install --package-manager=yarn --ssr',
    expected: {
      framework: '@storybook/angular',
      renderer: '@storybook/angular',
      builder: '@storybook/builder-webpack5',
    },
    skipTasks: ['e2e-tests-dev', 'bench'],
  },
  'angular-cli/15-ts': {
    name: 'Angular CLI v15 (Webpack | TypeScript)',
    script:
      'npx -p @angular/cli@15 ng new angular-v15 --directory {{beforeDir}} --routing=true --minimal=true --style=scss --strict --skip-git --skip-install --package-manager=yarn',
    expected: {
      framework: '@storybook/angular',
      renderer: '@storybook/angular',
      builder: '@storybook/builder-webpack5',
    },
    skipTasks: ['e2e-tests-dev', 'bench'],
  },
  'svelte-kit/skeleton-js': {
    name: 'SvelteKit Latest (Vite | JavaScript)',
    script:
      'yarn create svelte-with-args --name=svelte-kit/skeleton-js --directory={{beforeDir}} --template=skeleton --types=null --no-prettier --no-eslint --no-playwright --no-vitest --no-svelte5',
    expected: {
      framework: '@storybook/sveltekit',
      renderer: '@storybook/svelte',
      builder: '@storybook/builder-vite',
    },
    skipTasks: ['e2e-tests-dev', 'bench'],
  },
  'svelte-kit/skeleton-ts': {
    name: 'SvelteKit Latest (Vite | TypeScript)',
    script:
      'yarn create svelte-with-args --name=svelte-kit/skeleton-ts --directory={{beforeDir}} --template=skeleton --types=typescript --no-prettier --no-eslint --no-playwright --no-vitest --no-svelte5',
    expected: {
      framework: '@storybook/sveltekit',
      renderer: '@storybook/svelte',
      builder: '@storybook/builder-vite',
    },
    skipTasks: ['e2e-tests-dev', 'bench'],
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
    skipTasks: ['smoke-test', 'e2e-tests-dev', 'bench'],
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
    skipTasks: ['smoke-test', 'e2e-tests-dev', 'bench'],
  },
  'vue-cli/default-js': {
    name: 'Vue CLI v3 (Webpack | JavaScript)',
    script:
      'npx -p @vue/cli vue create {{beforeDir}} --default --packageManager=yarn --force --merge && cd {{beforeDir}} && echo "module.exports = {}" > webpack.config.js',
    expected: {
      framework: '@storybook/vue3-webpack5',
      renderer: '@storybook/vue3',
      builder: '@storybook/builder-webpack5',
    },
    // Remove smoke-test from the list once https://github.com/storybookjs/storybook/issues/19351 is fixed.
    skipTasks: ['smoke-test', 'e2e-tests-dev', 'bench'],
  },
  'preact-webpack5/default-js': {
    name: 'Preact CLI Latest (Webpack | JavaScript)',
    script:
      'npx preact-cli create default {{beforeDir}} --name preact-app --yarn --no-install && cd {{beforeDir}} && echo "module.exports = {}" > webpack.config.js',
    expected: {
      framework: '@storybook/preact-webpack5',
      renderer: '@storybook/preact',
      builder: '@storybook/builder-webpack5',
    },
    skipTasks: ['e2e-tests-dev', 'bench'],
  },
  'preact-webpack5/default-ts': {
    name: 'Preact CLI Latest (Webpack | TypeScript)',
    script:
      'npx preact-cli create typescript {{beforeDir}} --name preact-app --yarn --no-install && cd {{beforeDir}} && echo "module.exports = {}" > webpack.config.js',
    expected: {
      framework: '@storybook/preact-webpack5',
      renderer: '@storybook/preact',
      builder: '@storybook/builder-webpack5',
    },
    skipTasks: ['e2e-tests-dev', 'bench'],
  },
  'preact-vite/default-js': {
    name: 'Preact Latest (Vite | JavaScript)',
    script: 'npm create vite --yes {{beforeDir}} -- --template preact',
    expected: {
      framework: '@storybook/preact-vite',
      renderer: '@storybook/preact',
      builder: '@storybook/builder-vite',
    },
    skipTasks: ['e2e-tests-dev', 'bench'],
  },
  'preact-vite/default-ts': {
    name: 'Preact Latest (Vite | TypeScript)',
    script: 'npm create vite --yes {{beforeDir}} -- --template preact-ts',
    expected: {
      framework: '@storybook/preact-vite',
      renderer: '@storybook/preact',
      builder: '@storybook/builder-vite',
    },
    skipTasks: ['e2e-tests-dev', 'bench'],
  },
  'qwik-vite/default-ts': {
    name: 'Qwik CLI Latest (Vite | TypeScript)',
    script: 'yarn create qwik basic {{beforeDir}}',
    // TODO: The community template does not provide standard stories, which is required for e2e tests. Reenable once it does.
    inDevelopment: true,
    expected: {
      framework: 'storybook-framework-qwik',
      renderer: 'storybook-framework-qwik',
      builder: 'storybook-framework-qwik',
    },
    // TODO: The community template does not provide standard stories, which is required for e2e tests.
    skipTasks: ['e2e-tests', 'e2e-tests-dev', 'bench'],
  },
} satisfies Record<string, BaseTemplates>;

/**
 * Internal templates reuse config from other templates and add extra config on top.
 * They must contain an id that starts with 'internal/' and contain "isInternal: true".
 * They will be hidden by default in the Storybook status page.
 */
const internalTemplates = {
  'internal/swc-webpack': {
    ...baseTemplates['react-webpack/18-ts'],
    name: 'SWC (react-webpack/18-ts)',
    isInternal: true,
    inDevelopment: true,
    modifications: {
      mainConfig: {
        framework: {
          name: '@storybook/react-webpack5',
          options: {
            builder: {
              useSWC: true,
            },
          },
        },
      },
    },
    skipTasks: ['bench'],
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
    skipTasks: ['bench'],
  },
  // 'internal/pnp': {
  //   ...baseTemplates['cra/default-ts'],
  //   name: 'PNP (cra/default-ts)',
  //   script: 'yarn create react-app . --use-pnp',
  //   isInternal: true,
  //   inDevelopment: true,
  // },
} satisfies Record<`internal/${string}`, Template & { isInternal: true }>;

const benchTemplates = {
  'bench/react-vite-default-ts': {
    ...baseTemplates['react-vite/default-ts'],
    name: 'Bench (react-vite/default-ts)',
    isInternal: true,
    modifications: {
      skipTemplateStories: true,
    },
    skipTasks: ['e2e-tests-dev', 'test-runner', 'test-runner-dev', 'e2e-tests', 'chromatic'],
  },
  'bench/react-webpack-18-ts': {
    ...baseTemplates['react-webpack/18-ts'],
    name: 'Bench (react-webpack/18-ts)',
    isInternal: true,
    modifications: {
      skipTemplateStories: true,
    },
    skipTasks: ['e2e-tests-dev', 'test-runner', 'test-runner-dev', 'e2e-tests', 'chromatic'],
  },
  'bench/react-vite-default-ts-nodocs': {
    ...baseTemplates['react-vite/default-ts'],
    name: 'Bench (react-vite/default-ts, no docs)',
    isInternal: true,
    modifications: {
      skipTemplateStories: true,
      disableDocs: true,
    },
    skipTasks: ['e2e-tests-dev', 'test-runner', 'test-runner-dev', 'e2e-tests', 'chromatic'],
  },
  'bench/react-vite-default-ts-test-build': {
    ...baseTemplates['react-vite/default-ts'],
    name: 'Bench (react-vite/default-ts, test-build)',
    isInternal: true,
    modifications: {
      skipTemplateStories: true,
      testBuild: true,
    },
    skipTasks: ['e2e-tests-dev', 'test-runner', 'test-runner-dev', 'e2e-tests'],
  },
  'bench/react-webpack-18-ts-test-build': {
    ...baseTemplates['react-webpack/18-ts'],
    name: 'Bench (react-webpack/18-ts, test-build)',
    isInternal: true,
    modifications: {
      skipTemplateStories: true,
      testBuild: true,
    },
    skipTasks: ['e2e-tests-dev', 'test-runner', 'test-runner-dev', 'e2e-tests'],
  },
} satisfies Record<string, Template & { isInternal: true }>;

export const allTemplates: Record<TemplateKey, Template> = {
  ...baseTemplates,
  ...internalTemplates,
  ...benchTemplates,
};

export const normal: TemplateKey[] = [
  'cra/default-ts',
  'react-vite/default-ts',
  'angular-cli/default-ts',
  'vue3-vite/default-ts',
  'lit-vite/default-ts',
  'svelte-vite/default-ts',
  'svelte-kit/skeleton-ts',
  'nextjs/default-ts',
  'bench/react-vite-default-ts',
  'bench/react-webpack-18-ts',
  'bench/react-vite-default-ts-nodocs',
  'bench/react-vite-default-ts-test-build',
  'bench/react-webpack-18-ts-test-build',
];
export const merged: TemplateKey[] = [
  ...normal,
  'react-webpack/18-ts',
  'react-webpack/17-ts',
  // 'angular-cli/15-ts',
  'preact-webpack5/default-ts',
  'preact-vite/default-ts',
  'html-webpack/default',
  'html-vite/default-ts',
];
export const daily: TemplateKey[] = [
  ...merged,
  // 'angular-cli/prerelease',
  'cra/default-js',
  'react-vite/default-js',
  'vue3-vite/default-js',
  // 'vue2-vite/2.7-js',
  'vue-cli/default-js',
  'lit-vite/default-js',
  'svelte-kit/skeleton-js',
  'svelte-vite/default-js',
  'nextjs/default-js',
  'nextjs/prerelease',
  'qwik-vite/default-ts',
  'preact-webpack5/default-js',
  'preact-vite/default-js',
  'html-vite/default-js',
];

export const templatesByCadence = { normal, merged, daily };
