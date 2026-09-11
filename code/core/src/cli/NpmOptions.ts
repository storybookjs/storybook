import type { JsPackageManager } from '../common/js-package-manager/JsPackageManager.ts';

export type NpmOptions = Parameters<JsPackageManager['addDependencies']>[0];
