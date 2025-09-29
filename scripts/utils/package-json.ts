import { readFile, writeFile } from 'node:fs/promises';

import { join } from 'path';

export async function updatePackageScripts({ cwd, prefix }: { cwd: string; prefix: string }) {
  const packageJsonPath = join(cwd, 'package.json');
  const content = await readFile(packageJsonPath, 'utf-8');
  const packageJson = JSON.parse(content);
  packageJson.scripts = {
    ...packageJson.scripts,
    ...(packageJson.scripts.storybook && {
      storybook: `${prefix} ${packageJson.scripts.storybook}`,
      'build-storybook': `${prefix} ${packageJson.scripts['build-storybook']}`,
    }),
  };
  await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
}
