import MagicString from 'magic-string';
import type { Plugin } from 'vite';

/**
 * This plugin removes HMR `accept` calls in story files.  Stories should not be treated
 * as hmr boundaries, but vite has a bug which causes them to be treated as boundaries
 * (https://github.com/vitejs/vite/issues/9869).
 */
export async function stripStoryHMRBoundary(): Promise<Plugin> {
  const { createFilter } = await import('vite');

  const filter = createFilter(/\.stories\.([tj])sx?$/);
  return {
    name: 'storybook:strip-hmr-boundary-plugin',
    enforce: 'post',
    async transform(src: string, id: string) {
      if (!filter(id)) return undefined;

      const s = new MagicString(src);
      s.replace(/import\.meta\.hot\.accept\(\);/, '');

      return {
        code: s.toString(),
        map: s.generateMap({ hires: true, source: id }),
      };
    },
  };
}
