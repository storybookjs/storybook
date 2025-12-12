import MagicString from 'magic-string';
import type { Plugin } from 'vite';

/**
 * This plugin removes HMR `accept` calls in story files. Stories should not be treated as hmr
 * boundaries, but vite has a bug which causes them to be treated as boundaries
 * (https://github.com/vitejs/vite/issues/9869).
 */
export async function stripStoryHMRBoundary(): Promise<Plugin> {
  const storyFilePattern = /\.stories\.(tsx?|jsx?|svelte|vue)$/;

  return {
    name: 'storybook:strip-hmr-boundary-plugin',
    enforce: 'post' as const,
    transform: {
      // Use filter to pre-filter story files on the Rust side
      filter: {
        id: storyFilePattern,
       // Only process files that contain HMR accept calls
       code: /import\.meta\.hot\.accept/,
     },
      async handler(src: string, id: string, meta?: any) {
       // Fallback check for compatibility with older Vite versions
       if (!storyFilePattern.test(id)) {
         return undefined;
       }

        // Use native MagicString if available (Rolldown optimization)
        const magicString = meta?.magicString;
        const s = magicString || new MagicString(src);
        
       s.replace(/import\.meta\.hot\.accept\w*/, '(function hmrBoundaryNoop(){})');

       return {
          code: magicString ? s : s.toString(),
          map: magicString ? undefined : s.generateMap({ hires: true, source: id }),
       };
     },
    },
  };
}
