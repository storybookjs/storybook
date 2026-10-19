import { isAbsolute } from 'node:path';

export type ReactAliasTarget = {
  react: string;
  reactDom: string;
};

export const reactResolveAlias = ({ react, reactDom }: ReactAliasTarget) => ({
  react,
  ...(isAbsolute(reactDom) ? { 'react-dom/server': `${reactDom}/server.browser.js` } : {}),
  'react-dom': reactDom,
});

export const reactDedupeVitePlugin = (target: ReactAliasTarget) => ({
  name: 'storybook:react-dedupe',
  enforce: 'pre' as const,
  config: () => ({
    resolve: {
      alias: reactResolveAlias(target),
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
