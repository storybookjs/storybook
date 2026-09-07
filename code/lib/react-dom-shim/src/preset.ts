import { isAbsolute } from 'node:path';

import type { Options } from 'storybook/internal/types';

import { resolvePackageDir } from '../../../core/src/shared/utils/module.ts';

export const viteFinal = async (config: any, options: Options) => {
  const resolvedReact = await options.presets.apply<{ reactDom?: string }>('resolvedReact', {});
  const reactDom = resolvedReact.reactDom || resolvePackageDir('react-dom');

  // When react-dom is aliased to something else (e.g. preact/compat) the React root API must not
  // be pre-bundled. Every real react-dom resolution is React 18/19 (or a 0.0.0 canary), enforced
  // by the ^18 || ^19 peer ranges and the upgrade blocker.
  if (!isAbsolute(reactDom)) {
    return config;
  }

  return {
    ...config,
    optimizeDeps: {
      ...(config?.optimizeDeps ?? {}),
      include: [...(config.optimizeDeps?.include || []), 'react-dom/client'],
    },
  };
};
