import { readFileSync } from 'node:fs';

import { dedent } from 'ts-dedent';
import type { ResolvedConfig } from 'vite';

export const VIRTUAL_MODULE_MOCKER_BUILD_INTERCEPTOR = 'virtual:module-mocker-build-interceptor';
export const __STORYBOOK_GLOBAL_THIS_ACCESSOR__ = '__vitest_mocker__';

export const runtimeCode = (command: ResolvedConfig['command']) => {
  if (command === 'serve') {
    return dedent`
      import { ModuleMockerServerInterceptor } from "@vitest/mocker/browser";
      import { registerModuleMocker } from "@vitest/mocker/register";
      globalThis.__STORYBOOK_MOCKER__ = registerModuleMocker(() => new ModuleMockerServerInterceptor());

      if (import.meta.hot) {
        import.meta.hot.on('invalidate-mocker', (payload) => {
          globalThis.${__STORYBOOK_GLOBAL_THIS_ACCESSOR__}.invalidate();
        });
      }
    `;
  } else {
    return readFileSync(
      require.resolve('../../../templates/mocker-runtime-build-code.template.js'),
      'utf-8'
    );
  }
};
