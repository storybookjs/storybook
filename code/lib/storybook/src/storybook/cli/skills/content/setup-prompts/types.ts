import type { JsPackageManager } from '@storybook/core/internal/common';

export interface SetupInstructionsContext {
  configDir: string;
  docsUrl: (path: string) => string;
  mockDateInstall: string;
  mswInstall: string;
  needsUserOnboarding: boolean;
  packageManager: JsPackageManager;
  packageManagerName: string | undefined;
  tsx: string;
  ts: string;
}
