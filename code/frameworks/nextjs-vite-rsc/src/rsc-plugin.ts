import { type PluginApi, getPluginApi, vitePluginRscMinimal } from '@vitejs/plugin-rsc/plugin';
import { type Plugin } from 'vite';

export function rscBrowserModePlugin(): Plugin[] {
  let manager: PluginApi['manager'];

  return [
    ...vitePluginRscMinimal({
      environment: {
        rsc: 'client',
        browser: 'react_client',
      },
    }),
    {
      name: 'rsc-browser-mode',
      async config(userConfig, env) {
        const { defaultClientConditions } = await import('vite');

        return {
          define: {
            'import.meta.env.__vite_rsc_build__': JSON.stringify(env.command === 'build'),
          },
          environments: {
            client: {
              keepProcessEnv: false,
              resolve: {
                conditions: ['react-server', ...defaultClientConditions],
              },
              optimizeDeps: {
                include: [
                  'react',
                  'react-dom',
                  'react-dom/client',
                  'react/jsx-runtime',
                  'react/jsx-dev-runtime',
                  '@vitejs/plugin-rsc/vendor/react-server-dom/server.edge',
                  '@vitejs/plugin-rsc/vendor/react-server-dom/client.edge',
                ],
                exclude: ['vite', '@vitejs/plugin-rsc'],
              },
              build: {
                outDir: 'dist/client',
              },
            },
            react_client: {
              keepProcessEnv: false,
              resolve: {
                conditions: [...defaultClientConditions],
                noExternal: true,
              },
              optimizeDeps: {
                include: [
                  'react',
                  'react-dom',
                  'react-dom/client',
                  'react/jsx-runtime',
                  'react/jsx-dev-runtime',
                  '@vitejs/plugin-rsc/vendor/react-server-dom/client.browser',
                ],
                exclude: ['@vitejs/plugin-rsc'],
                esbuildOptions: {
                  platform: 'browser',
                },
              },
              build: {
                outDir: 'dist/react_client',
                copyPublicDir: false,
                emitAssets: true,
                rollupOptions: {
                  input: {
                    index: './src/framework/entry.browser.tsx',
                  },
                },
              },
            },
          },
          builder: {
            sharedPlugins: true,
            sharedConfigBuild: true,
          },
          build: {
            // packages/common/warning.ts
            rollupOptions: {
              onwarn(warning, defaultHandler) {
                if (
                  warning.code === 'MODULE_LEVEL_DIRECTIVE' &&
                  (warning.message.includes('use client') || warning.message.includes('use server'))
                ) {
                  return;
                }
                // https://github.com/vitejs/vite/issues/15012
                if (
                  warning.code === 'SOURCEMAP_ERROR' &&
                  warning.message.includes('resolve original location') &&
                  warning.pos === 0
                ) {
                  return;
                }
                if (userConfig.build?.rollupOptions?.onwarn) {
                  userConfig.build.rollupOptions.onwarn(warning, defaultHandler);
                } else {
                  defaultHandler(warning);
                }
              },
            },
          },
        };
      },
      configResolved(config) {
        manager = getPluginApi(config)!.manager;
      },
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const url = new URL(req.url ?? '/', 'https://any.local');
          if (url.pathname === '/@vite/invoke-react-client') {
            const payload = JSON.parse(url.searchParams.get('data')!);
            const result = await server.environments['react_client']!.hot.handleInvoke(payload);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(result));
            return;
          }
          next();
        });
      },
      hotUpdate(ctx) {
        if (this.environment.name === 'react_client') {
          if (ctx.modules.length > 0) {
            ctx.server.environments.client.hot.send({
              type: 'full-reload',
              path: ctx.file,
            });
          }
        }
      },
      async buildApp(builder) {
        const reactServer = builder.environments.client!;
        const reactClient = builder.environments['react_client']!;
        manager.isScanBuild = true;
        reactServer.config.build.write = false;
        await builder.build(reactServer);
        manager.isScanBuild = false;
        reactServer.config.build.write = true;
        await builder.build(reactClient);
        await builder.build(reactServer);
      },
    },
    {
      name: 'rsc-browser-mode:load-client',
      resolveId(source) {
        if (source === 'virtual:vite-rsc-browser-mode/load-client') {
          if (this.environment.mode === 'dev') {
            return this.resolve('/src/framework/load-client-dev');
          }
          return '\0' + source;
        }
      },
      load(id) {
        if (id === '\0virtual:vite-rsc-browser-mode/load-client') {
          if (manager.isScanBuild) {
            return `export default async () => {}`;
          } else {
            return `export default async () => import("/dist/react_client/index.js")`;
          }
        }
      },
    },
    {
      name: 'rsc-browser-mode:build-client-references',
      resolveId(source) {
        if (source === 'virtual:vite-rsc-browser-mode/build-client-references') {
          return '\0' + source;
        }
      },
      load(id) {
        if (id === '\0virtual:vite-rsc-browser-mode/build-client-references') {
          if (this.environment.mode === 'dev') {
            return `export default {}`; // no-op during dev
          }
          let code = '';
          for (const meta of Object.values(manager.clientReferenceMetaMap)) {
            code += `${JSON.stringify(meta.referenceKey)}: () => import(${JSON.stringify(meta.importId)}),`;
          }
          return `export default {${code}}`;
        }
      },
    },
    {
      name: 'rsc-browser-mode:build-server-references',
      resolveId(source) {
        if (source === 'virtual:vite-rsc-browser-mode/build-server-references') {
          return '\0' + source;
        }
      },
      load(id) {
        if (id === '\0virtual:vite-rsc-browser-mode/build-server-references') {
          if (this.environment.mode === 'dev') {
            return `export default {}`; // no-op during dev
          }
          let code = '';
          for (const meta of Object.values(manager.serverReferenceMetaMap)) {
            code += `${JSON.stringify(meta.referenceKey)}: () => import(${JSON.stringify(meta.importId)}),`;
          }
          return `export default {${code}}`;
        }
      },
    },
  ];
}

export function vitestPluginNext(): Plugin[] {
  return [
    {
      name: 'next-rsc-plugin',
      config() {
        return {
          define: {
            'process.env': JSON.stringify({}),
            __dirname: JSON.stringify(null),
          },
          optimizeDeps: {
            include: ['next/dist/client/components/is-next-router-error'],
          },
          resolve: {
            alias: {
              'next/link': 'next/dist/client/app-dir/link',
              'next/navigation': 'vitest-plugin-rsc/dist/nextjs/navigation',
              'next/headers': 'vitest-plugin-rsc/nextjs/headers',
              'next/cache': 'vitest-plugin-rsc/nextjs/cache',
              '@vercel/turbopack-ecmascript-runtime/browser/dev/hmr-client/hmr-client.ts':
                'next/dist/client/dev/noop-turbopack-hmr',
              'react-server-dom-webpack/client':
                '@vitejs/plugin-rsc/vendor/react-server-dom/client.edge',
              'react-server-dom-webpack/client.edge':
                '@vitejs/plugin-rsc/vendor/react-server-dom/client.edge',
            },
          },
          environments: {
            react_client: {
              resolve: {},
              optimizeDeps: {
                include: [
                  'next/link',
                  'next/dist/client/components/router-reducer/create-initial-router-state',
                  'next/dist/shared/lib/app-router-context.shared-runtime',
                  'next/dist/shared/lib/hooks-client-context.shared-runtime',
                  'next/dist/client/components/use-action-queue',
                  'next/dist/client/components/redirect-boundary',
                  'next/dist/client/components/router-reducer/compute-changed-path',
                  'next/dist/client/components/app-router-instance',
                  'next/dist/server/app-render/types',
                ],
              },
            },
          },
        };
      },
    },
  ];
}
