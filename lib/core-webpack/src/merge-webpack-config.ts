import type {
  WebpackConfiguration as Configuration,
  ModuleConfig,
  ResolveConfig,
  RulesConfig,
} from './types';

function mergePluginsField(
  defaultPlugins: Required<Configuration>['plugins'] = [],
  customPlugins: Required<Configuration>['plugins'] = []
): Required<Configuration>['plugins'] {
  return [...defaultPlugins, ...customPlugins];
}

function mergeRulesField(
  defaultRules: RulesConfig[] = [],
  customRules: RulesConfig[] = []
): ModuleConfig['rules'] {
  return [...defaultRules, ...customRules];
}

function mergeExtensionsField(
  { extensions: defaultExtensions = [] }: ResolveConfig,
  { extensions: customExtensions = [] }: ResolveConfig
): ResolveConfig['extensions'] {
  return [...defaultExtensions, ...customExtensions];
}

function mergeAliasField(
  { alias: defaultAlias = {} }: ResolveConfig,
  { alias: customAlias = {} }: ResolveConfig
): ResolveConfig['alias'] {
  return {
    ...defaultAlias,
    ...customAlias,
  };
}

function mergeModuleField(a: ModuleConfig, b: ModuleConfig): ModuleConfig {
  return {
    ...a,
    ...b,
    rules: mergeRulesField(a.rules || [], b.rules || []),
  };
}

function mergeResolveField(
  { resolve: defaultResolve = {} }: Configuration,
  { resolve: customResolve = {} }: Configuration
): ResolveConfig {
  return {
    ...defaultResolve,
    ...customResolve,
    alias: mergeAliasField(defaultResolve, customResolve),
    extensions: mergeExtensionsField(defaultResolve, customResolve),
  };
}

function mergeOptimizationField(
  { optimization: defaultOptimization = {} }: Configuration,
  { optimization: customOptimization = {} }: Configuration
): Configuration['optimization'] {
  return {
    ...defaultOptimization,
    ...customOptimization,
  };
}

export function mergeConfigs(config: Configuration, customConfig: Configuration): Configuration {
  return {
    // We'll always load our configurations after the custom config.
    // So, we'll always load the stuff we need.
    ...customConfig,
    ...config,
    devtool: customConfig.devtool || config.devtool,
    plugins: mergePluginsField(config.plugins, customConfig.plugins),
    module: mergeModuleField(config.module || {}, customConfig.module || {}),
    resolve: mergeResolveField(config, customConfig),
    optimization: mergeOptimizationField(config, customConfig),
  };
}
