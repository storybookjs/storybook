export function getPublicPackageManagerEnv(
  overrides: Record<string, string | undefined> = {}
): Record<string, string | undefined> {
  const env = { ...process.env } as Record<string, string | undefined>;

  env.npm_config_registry = 'https://registry.npmjs.org/';
  env.YARN_ENABLE_IMMUTABLE_INSTALLS = overrides.YARN_ENABLE_IMMUTABLE_INSTALLS ?? 'false';

  for (const key of Object.keys(env)) {
    if (key.startsWith('npm_config_') && key !== 'npm_config_registry') {
      delete env[key];
    }
  }

  return {
    ...env,
    ...overrides,
  };
}
