import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import type { ResolvedConfig } from 'vite';

const ENTRY_PATH = '/vite-inject-mocker-entry.js';

export const viteInjectMockerRuntime = (options: {
  previewConfigPath?: string | null;
}): import('vite').Plugin => {
  // Get the actual file path so Vite can resolve relative imports
  const mockerRuntimePath = fileURLToPath(
    import.meta.resolve('storybook/internal/mocking-utils/mocker-runtime')
  );

  let viteConfig: ResolvedConfig;
  let cachedRuntimeContent: string | null = null;

  const getRuntimeContent = () => {
    if (cachedRuntimeContent === null) {
      cachedRuntimeContent = readFileSync(mockerRuntimePath, 'utf-8');
    }
    return cachedRuntimeContent;
  };

  return {
    name: 'vite:storybook-inject-mocker-runtime',
    enforce: 'pre',
    buildStart() {
      if (viteConfig.command === 'build') {
        this.emitFile({
          type: 'chunk',
          id: mockerRuntimePath,
          fileName: ENTRY_PATH.slice(1),
        });
      }
    },
    configResolved(config) {
      viteConfig = config;
    },
    configureServer(server) {
      if (options.previewConfigPath) {
        server.watcher.on('change', (file) => {
          if (file === options.previewConfigPath) {
            server.ws.send({
              type: 'custom',
              event: 'invalidate-mocker',
            });
          }
        });
      }

      // Serve the pre-bundled mocker runtime directly in dev mode to avoid
      // Vite 7's transform pipeline deadlock. Previously, `resolveId` routed
      // this URL through Vite's full module transform pipeline which could
      // deadlock on Vite 7 due to how the pipeline processes this module.
      // By intercepting the request here (before Vite's transform middleware),
      // we serve the already-bundled content directly, matching the approach
      // used by the webpack builder.
      server.middlewares.use((req, res, next) => {
        if (req.url === ENTRY_PATH) {
          res.setHeader('Content-Type', 'application/javascript');
          res.end(getRuntimeContent());
          return;
        }
        next();
      });
    },
    resolveId(source) {
      // Only used in build mode — in dev mode the configureServer middleware
      // serves the pre-bundled content directly, bypassing this hook entirely.
      if (source === ENTRY_PATH && viteConfig?.command === 'build') {
        return mockerRuntimePath;
      }
      return undefined;
    },
    transformIndexHtml(html: string) {
      const headTag = html.match(/<head[^>]*>/);

      if (headTag) {
        // Use a relative path for production builds so the script loads
        // correctly when artifacts are hosted at non-root paths (e.g.,
        // GitHub Pages subdirectories).  In dev mode, the absolute path
        // is required so Vite's dev server can match it in resolveId.
        const src = viteConfig.command === 'build' ? `.${ENTRY_PATH}` : ENTRY_PATH;
        const entryCode = `<script type="module" src="${src}"></script>`;
        const headTagIndex = html.indexOf(headTag[0]);
        const newHtml =
          html.slice(0, headTagIndex + headTag[0].length) +
          entryCode +
          html.slice(headTagIndex + headTag[0].length);
        return newHtml;
      }
    },
  };
};
