/**
 * Creates a typed `defineMain` function for a specific framework's StorybookConfig.
 *
 * Each framework package exports its own `defineMain` via this factory so the
 * identity-function implementation lives in one place.
 */
export function createDefineMain<TConfig>() {
  return function defineMain(config: TConfig): TConfig {
    return config
  }
}
