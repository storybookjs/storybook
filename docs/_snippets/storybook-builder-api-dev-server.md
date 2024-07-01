```ts filename="server.ts" renderer="common" language="ts"
import { createServer } from 'vite';

export async function createViteServer(options: ExtendedOptions, devServer: Server) {
  const { port } = options;
  // Remainder server configuration

  // Creates the server.
  return createServer({
    // The server configuration goes here
    server: {
      middlewareMode: true,
      hmr: {
        port,
        server: devServer,
      },
    },
  });
}
```

