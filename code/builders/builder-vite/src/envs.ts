import { stringifyEnvs } from 'storybook/internal/common';
import type { UserConfig as ViteConfig } from 'vite';
import type { Builder_EnvsRaw, Options } from 'storybook/internal/types';

// Allowed env variables on the client
const allowedEnvVariables = [
  'STORYBOOK',
  // Vite `import.meta.env` default variables
  // @see https://github.com/vitejs/vite/blob/6b8d94dca2a1a8b4952e3e3fcd0aed1aedb94215/packages/vite/types/importMeta.d.ts#L68-L75
  'BASE_URL',
  'MODE',
  'DEV',
  'PROD',
  'SSR',
];

/**
 * Customized version of stringifyProcessEnvs from @storybook/core-common which
 * uses import.meta.env instead of process.env and checks for allowed variables.
 */
export function stringifyProcessEnvs(raw: Builder_EnvsRaw, envPrefix: ViteConfig['envPrefix']) {
  const updatedRaw: Builder_EnvsRaw = {};
  const envs = Object.entries(raw).reduce((acc: Builder_EnvsRaw, [key, value]) => {
    // Only add allowed values OR values from array OR string started with allowed prefixes
    if (
      allowedEnvVariables.includes(key) ||
      (Array.isArray(envPrefix) && !!envPrefix.find((prefix) => key.startsWith(prefix))) ||
      (typeof envPrefix === 'string' && key.startsWith(envPrefix))
    ) {
      acc[`import.meta.env.${key}`] = JSON.stringify(value);
      updatedRaw[key] = value;
    }
    return acc;
  }, {});
  // support destructuring like
  // const { foo } = import.meta.env;
  envs['import.meta.env'] = JSON.stringify(stringifyEnvs(updatedRaw));

  return envs;
}

// Sanitize environment variables if needed
export async function sanitizeEnvVars(options: Options, config: ViteConfig) {
  const { presets } = options;
  const envsRaw = await presets.apply<Promise<Builder_EnvsRaw>>('env');
  let { define } = config;
  if (Object.keys(envsRaw).length) {
    // Stringify env variables after getting `envPrefix` from the  config
    const envs = stringifyProcessEnvs(envsRaw, config.envPrefix);
    define = {
      ...define,
      ...envs,
    };
  }
  return {
    ...config,
    define,
  } as ViteConfig;
}
