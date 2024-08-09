import { pathExists } from '@ndelangen/fs-extra-unified';
import dirSize from 'fast-folder-size';
import { join } from 'path';
import { promisify } from 'util';

import { now, saveBench } from '../bench/utils';
import type { Task } from '../task';
import { exec } from '../utils/exec';

export const build: Task = {
  description: 'Build the static version of the sandbox',
  dependsOn: ['sandbox'],
  async ready({ builtSandboxDir }) {
    return pathExists(builtSandboxDir);
  },
  async run({ sandboxDir, template }, { dryRun, debug }) {
    const start = now();

    await exec(
      `yarn build-storybook --quiet ${template.modifications?.testBuild ? '--test' : ''}`,
      { cwd: sandboxDir },
      { dryRun, debug }
    );

    const buildTime = now() - start;
    const dir = join(sandboxDir, 'storybook-static');
    const getSize = promisify(dirSize);
    const buildSize = await getSize(dir).catch(() => 0);
    const buildSbAddonsSize = await getSize(join(dir, 'sb-addons')).catch(() => 0);
    const buildSbCommonSize = await getSize(join(dir, 'sb-common-assets')).catch(() => 0);
    const buildSbManagerSize = await getSize(join(dir, 'sb-manager')).catch(() => 0);
    const buildSbPreviewSize = await getSize(join(dir, 'sb-preview')).catch(() => 0);
    const buildPrebuildSize =
      buildSbAddonsSize + buildSbCommonSize + buildSbManagerSize + buildSbPreviewSize;

    const buildStaticSize = await getSize(join(dir, 'static')).catch(() => 0);
    const buildPreviewSize = buildSize - buildPrebuildSize - buildStaticSize;

    await saveBench(
      'build',
      {
        buildTime,
        buildSize,
        buildSbAddonsSize,
        buildSbCommonSize,
        buildSbManagerSize,
        buildSbPreviewSize,
        buildStaticSize,
        buildPrebuildSize,
        buildPreviewSize,
      },
      { rootDir: sandboxDir }
    );
  },
};
