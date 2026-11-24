import { dedent } from 'ts-dedent';

/** Explains why this addon can't run with the `storybook` package it loaded, if it can't. */
export function getIncompatibleStorybookMessage(
  addonVersion: string,
  coreVersion: string
): string | undefined {
  const addonMajor = Number.parseInt(addonVersion, 10);
  const coreMajor = Number.parseInt(coreVersion, 10);
  // Canaries are versioned `0.0.0-…`, and an unreadable version proves nothing.
  if (!addonMajor || !coreMajor || addonMajor === coreMajor) {
    return undefined;
  }
  return dedent`
    @storybook/addon-vitest@${addonVersion} is not compatible with storybook@${coreVersion}.

    Several versions of Storybook are installed, for example when only some packages of a monorepo were upgraded.
    Run "npm ls storybook" to see which ones, then use the same version for every "storybook" and "@storybook/*" dependency.
  `;
}
