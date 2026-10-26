import type { JsPackageManager } from 'storybook/internal/common';

export interface InstructionsContext {
  configDir: string;
  docsUrl: (path: string) => string;
  mswInstall: string;
  packageManager: JsPackageManager;
  packageManagerName: string | undefined;
  tsx: string;
  ts: string;
}
