type PlatformScriptName = 'ios' | 'android';

export interface StorybookPlatformScriptDerivationResult {
  scriptsToAdd: Partial<Record<'storybook:ios' | 'storybook:android', string>>;
  missingBaseScripts: PlatformScriptName[];
}

const STORYBOOK_ENV_PREFIX = 'cross-env STORYBOOK_ENABLED=true';

const withStorybookEnv = (scriptValue: string) => {
  return `${STORYBOOK_ENV_PREFIX} ${scriptValue}`.trim();
};

export const deriveStorybookPlatformScripts = (
  scripts: Record<string, unknown> | undefined
): StorybookPlatformScriptDerivationResult => {
  const scriptsToAdd: StorybookPlatformScriptDerivationResult['scriptsToAdd'] = {};
  const missingBaseScripts: PlatformScriptName[] = [];

  const iosScript = typeof scripts?.ios === 'string' ? scripts.ios.trim() : '';
  if (iosScript) {
    scriptsToAdd['storybook:ios'] = withStorybookEnv(iosScript);
  } else {
    missingBaseScripts.push('ios');
  }

  const androidScript = typeof scripts?.android === 'string' ? scripts.android.trim() : '';
  if (androidScript) {
    scriptsToAdd['storybook:android'] = withStorybookEnv(androidScript);
  } else {
    missingBaseScripts.push('android');
  }

  return { scriptsToAdd, missingBaseScripts };
};
