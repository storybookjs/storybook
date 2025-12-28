import MagicString from 'magic-string';
import type { Plugin } from 'vite';
import { parse } from 'vue-docgen-api';

export async function vueDocgen(): Promise<Plugin> {
  const { createFilter } = await import('vite');

  const include = /\.(vue)$/;
  const filter = createFilter(include);

  return {
    name: 'storybook:vue-docgen-plugin',
    async transform(src, id) {
      if (!filter(id)) {
        return undefined;
      }

      const metaData = await parse(id);

      const s = new MagicString(src);
      s.append(`;_sfc_main.__docgenInfo = Object.assign(${JSON.stringify(metaData)}, {
        displayName: _sfc_main.name ?? _sfc_main.__name ?? ${JSON.stringify(metaData.displayName)}
      });`);

      return {
        code: s.toString(),
        map: s.generateMap({ hires: true, source: id }),
      };
    },
  };
}
