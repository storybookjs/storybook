/** Choose how preview code reads environment variables. */
export type PreviewDefineTarget =
  | { env: 'process.env' }
  | {
      env: 'import.meta.env';
      /** Expose variables with these prefixes in addition to Storybook's and Vite's own. */
      envPrefix?: string | readonly string[];
    };

/** Describe the environment exposed to preview code. */
export interface PreviewDefineInput {
  env: Record<string, string>;
  /** Force `NODE_ENV` to `development` in a production build. */
  developmentModeForBuild: boolean;
}

const IMPORT_META_ENV_KEYS = ['STORYBOOK', 'BASE_URL', 'MODE', 'DEV', 'PROD', 'SSR'];

/** Compute bundler define replacements that expose the environment to preview code. */
export function getPreviewDefine(
  input: PreviewDefineInput,
  target: PreviewDefineTarget
): Record<string, string> {
  if (target.env === 'process.env') {
    return {
      'process.env': `(${JSON.stringify(input.env)})`,
      ...Object.fromEntries(
        Object.entries(input.env).map(([key, value]) => [
          `process.env.${key}`,
          JSON.stringify(value),
        ])
      ),
      NODE_ENV: JSON.stringify(
        input.developmentModeForBuild ? 'development' : process.env.NODE_ENV
      ),
    };
  }
  const prefixes = [target.envPrefix ?? []].flat();
  const env = Object.fromEntries(
    Object.entries(input.env).filter(
      ([key]) =>
        IMPORT_META_ENV_KEYS.includes(key) || prefixes.some((prefix) => key.startsWith(prefix))
    )
  );
  return {
    ...Object.fromEntries(
      Object.entries(env).map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)])
    ),
    'import.meta.env': JSON.stringify(
      Object.fromEntries(Object.entries(env).map(([key, value]) => [key, JSON.stringify(value)]))
    ),
    ...(input.developmentModeForBuild
      ? { 'process.env.NODE_ENV': JSON.stringify('development') }
      : {}),
  };
}
