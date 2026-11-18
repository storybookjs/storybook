import MagicString from 'magic-string';
import type { Plugin } from 'vite';

import type { VueDocgenEngine } from './vue-component-meta.ts';

export async function vueDocgen(engine: VueDocgenEngine): Promise<Plugin> {
  const { parse } = await engine.vueDocgenApi();
  const { createFilter } = await import('vite');

  const include = /\.(vue)$/;
  const filter = createFilter(include);

  return {
    name: 'storybook:vue-docgen-plugin',
    transform: {
      order: 'post',
      filter: { id: include },
      async handler(src, id) {
        if (!filter(id)) {
          return undefined;
        }

        const metaData = await parse(id);

        const s = new MagicString(src);

        s.append(`;_sfc_main.__docgenInfo = Object.assign({
        displayName: _sfc_main.name ?? _sfc_main.__name
      }, ${JSON.stringify(metaData)});`);

        return {
          code: s.toString(),
          map: s.generateMap({ hires: true, source: id }).toString(),
        };
      },
    },
  };
}
