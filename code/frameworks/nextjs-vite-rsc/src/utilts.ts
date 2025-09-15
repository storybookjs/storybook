import { ESModulesEvaluator, ModuleRunner } from 'vite/module-runner';

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

export const importReactClient = runner.import.bind(runner);
