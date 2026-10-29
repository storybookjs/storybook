import { resolvePackageDir } from '@storybook/core/internal/deep/utils/module';

import { join } from 'pathe';

/** Resolve a built-in feature's bundled browser entry in the installed `storybook` package. */
export function featureEntry(feature: string, entry: 'manager' | 'preview'): string {
  return join(resolvePackageDir('storybook'), 'dist/features', feature, `${entry}.js`);
}

/** Resolve a bundled browser file of another Storybook package. */
export function packageEntry(pkg: string, path: string): string {
  return join(resolvePackageDir(pkg), 'dist', path);
}
