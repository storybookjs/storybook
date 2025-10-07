import { ESModulesEvaluator, ModuleRunner } from 'vite/module-runner';

export default async function loadClient() {
  const runner = new ModuleRunner(
    {
      sourcemapInterceptor: false,
      transport: {
        invoke: async (payload) => {
          const response = await fetch(
            '/@vite/invoke-react-client?' +
              new URLSearchParams({
                data: JSON.stringify(payload),
              })
          );
          return response.json();
        },
      },
      hmr: false,
    },
    new ESModulesEvaluator()
  );
  return await runner.import<typeof import('@storybook/nextjs-vite-rsc/react-client')>(
    '@storybook/nextjs-vite-rsc/react-client'
  );
}
