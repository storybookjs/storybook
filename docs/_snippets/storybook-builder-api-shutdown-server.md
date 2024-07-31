```ts filename="index.ts" renderer="common" language="ts"
import { createViteServer } from './vite-server';

let server: ViteDevServer;
export async function bail(): Promise<void> {
  return server?.close();
}

export const start: ViteBuilder['start'] = async ({ options, server: devServer }) => {
  // Remainder implementation goes here
  server = await createViteServer(options as ExtendedOptions, devServer);

  return {
    bail,
    totalTime: process.hrtime(startTime),
  };
};
```

