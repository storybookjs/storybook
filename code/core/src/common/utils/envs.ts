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

  const baseEnv: Record<string, string> = {
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

  const dotenv = getEnvironment({ nodeEnv: baseEnv['NODE_ENV'] });

  const envEntries = Object.fromEntries<string>(
    Object.entries<string>({
      // TODO: it seems wrong that dotenv overrides process.env, but that's how it has always worked
      ...process.env,
      ...dotenv.raw,
    }).filter(([name]) => /^STORYBOOK_/.test(name))
  );

  const raw: Record<string, string> = { ...baseEnv, ...envEntries };
  (raw as any).NODE_PATH = nodePathsToArray((raw.NODE_PATH as string) || '');

  const stringified = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, JSON.stringify(value)])
  );
  return { raw, stringified };
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
