import { parseLocalBindings } from 'storybook/internal/oxc-parser';

import MagicString from 'magic-string';
import type { ModuleNode, Plugin } from 'vite';
import { type ComponentMeta, type MetaCheckerOptions, TypeMeta } from 'vue-component-meta';

import {
  applyTempFixForEventDescriptions,
  createVueComponentMetaChecker,
  filterExposed,
  getFilenameWithoutExtension,
  stripNestedSchemas,
} from './vue-component-meta-checker.ts';

type MetaSource = {
  exportName: string;
  displayName: string;
  sourceFiles: string;
} & ComponentMeta &
  MetaCheckerOptions['schema'];

export async function vueComponentMeta(tsconfigPath = 'tsconfig.json'): Promise<Plugin> {
  const { createFilter } = await import('vite');

  // exclude stories, virtual modules and storybook internals
  const exclude = /\.stories\.(ts|tsx|js|jsx)$|^\0\/virtual:|^\/virtual:|\.storybook\/.*\.(ts|js)$/;
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
          const exportNames = checker.getExportNames(id);
          let componentsMeta = exportNames.map((name) => checker.getComponentMeta(id, name));
          componentsMeta = await applyTempFixForEventDescriptions(id, componentsMeta);

          const metaSources: MetaSource[] = [];

          componentsMeta.forEach((meta, index) => {
            // filter out empty meta
            const isEmpty =
              !meta.props.length &&
              !meta.events.length &&
              !meta.slots.length &&
              !meta.exposed.length;

            if (isEmpty || meta.type === TypeMeta.Unknown) {
              return;
            }

            const exportName = exportNames[index];

            // we remove nested object schemas here since they are not used inside Storybook (we don't generate controls for object properties)
            // and they can cause "out of memory" issues for large/complex schemas (e.g. HTMLElement)
            // it also reduced the bundle size when running "storybook build" when such schemas are used
            stripNestedSchemas(meta);

            const exposed = filterExposed(meta);

            metaSources.push({
              exportName,
              displayName: exportName === 'default' ? getFilenameWithoutExtension(id) : exportName,
              ...meta,
              exposed,
              sourceFiles: id,
            });
          });

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

          metaSources.forEach((meta) => {
            const isDefaultExport = meta.exportName === 'default';
            const name = isDefaultExport ? '_sfc_main' : meta.exportName;

            if (!localBindings.has(name)) {
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
            map: s.generateMap({ hires: true, source: id }),
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
