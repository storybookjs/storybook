import semver from 'semver';

type VitestBrowserContext = typeof import('@vitest/browser/context');

type VitestServerContext = VitestBrowserContext & {
  server: {
    commands: typeof import('@vitest/browser/context').server.commands & {
      getInitialGlobals: () => Promise<Record<string, any>>;
    };
  };
};

/** Gets the Vitest browser context based on which version of Vitest is installed. */
export const getVitestBrowserContext = async (): Promise<VitestServerContext> => {
  const vitestVersion = await import('vitest/package.json', { with: { type: 'json' } }).then(
    (v) => v.version
  );

  if (semver.major(vitestVersion) >= 4) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore (vitest/browser is vitest 4 only, and we're using vitest 3 locally)
    return import('vitest/browser') as unknown as Promise<VitestServerContext>;
  }

  return import('@vitest/browser/context') as Promise<VitestServerContext>;
};
