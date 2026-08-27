import { parseDefaultImports, parseLocalBindings } from 'storybook/internal/oxc-parser';

import MagicString from 'magic-string';
import type { ModuleNode, Plugin } from 'vite';

import type { experimental_vueDocgenEngine } from '@storybook/vue3/preset';

/** The renderer's shared vue-component-meta engine, applied through the preset chain. */
export type VueDocgenEngine = Awaited<ReturnType<typeof experimental_vueDocgenEngine>>;

export async function vueComponentMeta(
  engine: VueDocgenEngine,
  tsconfigPath = 'tsconfig.json'
): Promise<Plugin> {
  const { collectComponentMetaSources, createVueComponentMetaChecker } =
    await engine.componentMeta();
  const { createFilter } = await import('vite');

  // exclude stories, ids carrying a query (e.g. plugin-vue's `?vue&type=script&lang.ts`
  // sub-requests, which end in `.ts` but are not files), virtual modules and storybook internals
  const exclude =
    /\.stories\.(ts|tsx|js|jsx)$|\?|^\0\/virtual:|^\/virtual:|\.storybook\/.*\.(ts|js)$/;
  const include = /\.(vue|ts|js|tsx|jsx)$/;
  const filter = createFilter(include, exclude);

  const checker = await createVueComponentMetaChecker(tsconfigPath);

  return {
    name: 'storybook:vue-component-meta-plugin',
    transform: {
      order: 'post',
      filter: { id: { include, exclude } },
      async handler(src, id) {
        if (!filter(id)) {
          return undefined;
        }

        try {
          const metaSources = await collectComponentMetaSources(checker, id);

          // if there is no component meta, return undefined
          if (metaSources.length === 0) {
            return undefined;
          }

          const s = new MagicString(src);

          // Names with a local binding in this module that we can safely attach "__docgenInfo" to.
          // Re-exports (e.g. "export { default as MyComponent } from './MyComponent.vue'" or
          // "export * from './Tabs'") resolve via checker.getExportNames but have no local binding
          // here, so attaching to them would reference an undefined variable at runtime.
          const localBindings = await parseLocalBindings(id, src);

          // Production SFCs can import `_sfc_main` from their virtual script module
          // instead of declaring it locally.
          const sfcMainImportSource = (await parseDefaultImports(id, src)).get('_sfc_main');
          const sfcMainQuery = new URLSearchParams(sfcMainImportSource?.split('?')[1]);
          const hasImportedSfcMain =
            id.endsWith('.vue') && sfcMainQuery.has('vue') && sfcMainQuery.get('type') === 'script';

          metaSources.forEach((meta) => {
            const isDefaultExport = meta.exportName === 'default';
            const name = isDefaultExport ? '_sfc_main' : meta.exportName;

            if (!localBindings.has(name) && !(isDefaultExport && hasImportedSfcMain)) {
              return;
            }

            if (!id.endsWith('.vue') && isDefaultExport) {
              // we can not add the __docgenInfo if the component is default exported directly
              // so we need to safe it to a variable instead and export default it instead
              s.replace('export default ', 'const _sfc_main = ');
              s.append('\nexport default _sfc_main;');
            }

            s.append(`\n;${name}.__docgenInfo = Object.assign({
            displayName: ${name}.name ?? ${name}.__name
          }, ${JSON.stringify(meta)})`);
          });

          return {
            code: s.toString(),
            map: s.generateMap({ hires: true, source: id }).toString(),
          };
        } catch (e) {
          return undefined;
        }
      },
    },
    // handle hot updates to update the component meta on file changes
    async handleHotUpdate({ file, read, server, modules, timestamp }) {
      const content = await read();
      checker.updateFile(file, content);
      // Invalidate modules manually
      const invalidatedModules = new Set<ModuleNode>();

      for (const mod of modules) {
        server.moduleGraph.invalidateModule(mod, invalidatedModules, timestamp, true);
      }

      server.ws.send({ type: 'full-reload' });
      return [];
    },
  };
}
