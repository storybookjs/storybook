// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - Needed for Angular sandbox running without --no-link option. Do NOT convert to @ts-expect-error!
import { nodePathsToArray } from './paths';

// Load environment variables starts with STORYBOOK_ to the client side.

export async function loadEnvs(options: { production?: boolean } = {}): Promise<{
  stringified: Record<string, string>;
  raw: Record<string, string>;
}> {
  const { getEnvironment } = await import('lazy-universal-dotenv');
  const defaultNodeEnv = options.production ? 'production' : 'development';

  const env: Record<string, string | undefined> = {
    // eslint-disable-next-line @typescript-eslint/dot-notation
    NODE_ENV: process.env['NODE_ENV'] || defaultNodeEnv,
    NODE_PATH: process.env['NODE_PATH'] || '',
    STORYBOOK: process.env['STORYBOOK'] || 'true',
    // This is to support CRA's public folder feature.
    // In production we set this to dot(.) to allow the browser to access these assets
    // even when deployed inside a subpath. (like in GitHub pages)
    // In development this is just empty as we always serves from the root.
    PUBLIC_URL: options.production ? '.' : '',
  };

  Object.keys(process.env)
    .filter((name) => /^STORYBOOK_/.test(name))
    .forEach((name) => {
      env[name] = process.env[name];
    });

  const base = Object.entries(env).reduce(
    (acc, [k, v]) => Object.assign(acc, { [k]: JSON.stringify(v) }),
    {} as Record<string, string>
  );

  const { stringified, raw } = getEnvironment({ nodeEnv: env['NODE_ENV'] });

  const fullRaw = { ...env, ...raw };

  fullRaw.NODE_PATH = nodePathsToArray(fullRaw.NODE_PATH || '');

  return {
    stringified: { ...base, ...stringified },
    raw: fullRaw,
  };
}

export const stringifyEnvs = (raw: Record<string, string>): Record<string, string> =>
  Object.entries(raw).reduce<Record<string, string>>((acc, [key, value]) => {
    acc[key] = JSON.stringify(value);
    return acc;
  }, {});

export const stringifyProcessEnvs = (raw: Record<string, string>): Record<string, string> => {
  const envs = Object.entries(raw).reduce<Record<string, string>>((acc, [key, value]) => {
    acc[`process.env.${key}`] = JSON.stringify(value);
    return acc;
  }, {});
  // FIXME: something like this is necessary to support destructuring like:
  //
  // const { foo } = process.env;
  //
  // However, it also means that process.env.foo = 'bar' will fail, so removing this:
  //
  // envs['process.env'] = JSON.stringify(raw);
  return envs;
};

export const optionalEnvToBoolean = (input: string | undefined): boolean | undefined => {
  if (input === undefined) {
    return undefined;
  }
  if (input.toUpperCase() === 'FALSE' || input === '0') {
    return false;
  }
  if (input.toUpperCase() === 'TRUE' || input === '1') {
    return true;
  }
  return Boolean(input);
};

/**
 * Consistently determine if we are in a CI environment
 *
 * Doing Boolean(process.env.CI) or !process.env.CI is not enough, because users might set CI=false
 * or CI=0, which would be truthy, and thus return true in those cases.
 */
export function isCI(): boolean | undefined {
  return optionalEnvToBoolean(process.env.CI);
}
