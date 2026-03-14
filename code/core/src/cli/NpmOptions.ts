import type { JsPackageManager } from '../common/js-package-manager/JsPackageManager';

export type NpmOptions = Parameters<JsPackageManager['addDependencies']>[0];
