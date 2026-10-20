import { isAbsolute } from 'pathe';

export type ReactAliasTarget = {
  react: string;
  reactDom: string;
};

export const reactResolveAlias = ({ react, reactDom }: ReactAliasTarget) => ({
  react,
  ...(isAbsolute(reactDom) ? { 'react-dom/server': `${reactDom}/server.browser.js` } : {}),
  'react-dom': reactDom,
});

/**
 * Vite merges object aliases with a spread, which keeps our key position while another plugin
 * replaces the value. A string key is a prefix match, so `react` pointing at a file would turn
 * `react/jsx-runtime` into `<file>/jsx-runtime`. Anchored regexes with an explicit subpath capture
 * keep each entry self-contained no matter how they are merged.
 */
export const reactViteAlias = ({ react, reactDom }: ReactAliasTarget) => [
  ...(isAbsolute(reactDom)
    ? [{ find: /^react-dom\/server$/, replacement: `${reactDom}/server.browser.js` }]
    : []),
  { find: /^react-dom(\/.*)?$/, replacement: `${reactDom}$1` },
  { find: /^react(\/.*)?$/, replacement: `${react}$1` },
];

export const reactDedupeVitePlugin = (target: ReactAliasTarget) => ({
  name: 'storybook:react-dedupe',
  enforce: 'pre' as const,
  config: () => ({
    resolve: {
      alias: reactViteAlias(target),
    },
  }),
});

type ViteAliasConfig = {
  plugins?: unknown[];
};

// Prepend so a later framework plugin can replace the alias. Next.js points react at its compiled build.
export const prependReactDedupePlugin = <T extends ViteAliasConfig>(
  config: T,
  target: ReactAliasTarget
): T => ({
  ...config,
  plugins: [reactDedupeVitePlugin(target), ...(config.plugins ?? [])],
});

type WebpackAliasConfig = {
  resolve?: {
    alias?: Record<string, string> | Array<{ name: string; alias: string }>;
  };
};

export const aliasReactInWebpack = <T extends WebpackAliasConfig>(
  config: T,
  target: ReactAliasTarget
): T => {
  const alias = reactResolveAlias(target);
  const current = config.resolve?.alias;
  const nextAlias = Array.isArray(current)
    ? [
        ...current,
        ...Object.entries(alias).map(([name, aliasPath]) => ({ name, alias: aliasPath })),
      ]
    : { ...current, ...alias };

  return {
    ...config,
    resolve: {
      ...config.resolve,
      alias: nextAlias,
    },
  };
};
