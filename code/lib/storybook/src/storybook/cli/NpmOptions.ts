import type { JsPackageManager } from '@storybook/core/internal/common';

export type NpmOptions = Parameters<JsPackageManager['addDependencies']>[0];
