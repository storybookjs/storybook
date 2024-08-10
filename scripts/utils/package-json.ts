import { join } from 'node:path';

import { readJSON, writeJSON } from '@ndelangen/fs-extra-unified';

export async function updatePackageScripts({ cwd, prefix }: { cwd: string; prefix: string }) {
  const packageJsonPath = join(cwd, 'package.json');
  const packageJson = await readJSON(packageJsonPath);
  packageJson.scripts = {
    ...packageJson.scripts,
    ...(packageJson.scripts.storybook && {
      storybook: `${prefix} ${packageJson.scripts.storybook}`,
      'build-storybook': `${prefix} ${packageJson.scripts['build-storybook']}`,
    }),
  };
  await writeJSON(packageJsonPath, packageJson, { spaces: 2 });
}
