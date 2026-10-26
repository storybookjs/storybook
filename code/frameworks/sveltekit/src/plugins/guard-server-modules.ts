import type { Plugin } from 'vite';

export function guardServerModules() {
  // SvelteKit's own guard only checks import chains that start at a route, so it misses stories.
  // See https://github.com/sveltejs/kit/blob/090496890cedbbff15d998695d48cd31e7d698b7/packages/kit/src/exports/vite/plugins/guard.js
  return {
    name: 'storybook:sveltekit-guard-server-modules',
    applyToEnvironment: (environment) => environment.config.consumer === 'client',
    load: {
      // The files behind `$app/env/private` and `$app/server`, see https://github.com/sveltejs/kit/blob/090496890cedbbff15d998695d48cd31e7d698b7/packages/kit/src/exports/vite/module_ids.js
      filter: { id: /\/src\/runtime\/app\/(env\/private|server)\/index\.js(\?|$)/ },
      handler() {
        this.error(
          '`$app/env/private` and `$app/server` are server-only modules. Storybook renders stories in the browser. Stories and the components that they render cannot import these modules. Mock the module that imports them with a mock file: https://storybook.js.org/docs/writing-stories/mocking-data-and-modules/mocking-modules#mock-files'
        );
      },
    },
  } satisfies Plugin;
}
