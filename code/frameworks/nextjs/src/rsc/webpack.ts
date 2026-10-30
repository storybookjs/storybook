import { fileURLToPath } from 'node:url';

import type { Configuration as WebpackConfig } from 'webpack';

const tryResolve = (id: string) => {
  try {
    return fileURLToPath(import.meta.resolve(id));
  } catch {
    return undefined;
  }
};

/**
 * Resolve the JSX runtime the app would use without our alias: the React bundled in Next.js when
 * available (see `../config/webpack.ts`), otherwise the app's React.
 */
const resolveOriginalJsxRuntime = (runtime: 'jsx-runtime' | 'jsx-dev-runtime') =>
  tryResolve(`next/dist/compiled/react/${runtime}`) ?? tryResolve(`react/${runtime}`);

export const configureRSC = (baseConfig: WebpackConfig): void => {
  const resolve = baseConfig.resolve ?? {};
  const originalJsxRuntime = resolveOriginalJsxRuntime('jsx-runtime');
  const originalJsxDevRuntime = resolveOriginalJsxRuntime('jsx-dev-runtime');

  resolve.alias = {
    // The exact-match aliases must come before the scoped `react` alias set in `configureConfig`,
    // webpack picks the first alias that resolves.
    ...(originalJsxRuntime && {
      'react/jsx-runtime$': fileURLToPath(import.meta.resolve('@storybook/nextjs/rsc/jsx-runtime')),
      'sb-original/react/jsx-runtime$': originalJsxRuntime,
    }),
    ...(originalJsxDevRuntime && {
      'react/jsx-dev-runtime$': fileURLToPath(
        import.meta.resolve('@storybook/nextjs/rsc/jsx-dev-runtime')
      ),
      'sb-original/react/jsx-dev-runtime$': originalJsxDevRuntime,
    }),
    ...resolve.alias,
    'server-only$': fileURLToPath(import.meta.resolve('@storybook/nextjs/rsc/server-only')),
  };
  baseConfig.resolve = resolve;
};
