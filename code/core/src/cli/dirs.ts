import { dirname, join } from 'node:path';

import type { JsPackageManager } from '@storybook/core/common';
import { temporaryDirectory, versions } from '@storybook/core/common';
import type { SupportedFrameworks } from '@storybook/core/types';

import downloadTarballDefault from '@ndelangen/get-tarball';
import getNpmTarballUrlDefault from 'get-npm-tarball-url';
import invariant from 'tiny-invariant';

import { externalFrameworks } from './project_types';
import type { SupportedRenderers } from './project_types';

const resolveUsingBranchInstall = async (packageManager: JsPackageManager, request: string) => {
  const tempDirectory = await temporaryDirectory();
  const name = request as keyof typeof versions;

  // FIXME: this might not be the right version for community packages
  const version = versions[name] || (await packageManager.latestVersion(request));

  // an artifact of esbuild + type=commonjs + exportmap
  // @ts-expect-error (default export)
  const getNpmTarballUrl = getNpmTarballUrlDefault.default || getNpmTarballUrlDefault;
  // @ts-expect-error (default export)
  const downloadTarball = downloadTarballDefault.default || downloadTarballDefault;

  const url = getNpmTarballUrl(request, version, {
    registry: await packageManager.getRegistryURL(),
  });

  // this unzips the tarball into the temp directory
  await downloadTarball({ url, dir: tempDirectory });

  return join(tempDirectory, 'package');
};

export async function getRendererDir(
  packageManager: JsPackageManager,
  renderer: SupportedFrameworks | SupportedRenderers
) {
  const externalFramework = externalFrameworks.find((framework) => framework.name === renderer);
  const frameworkPackageName =
    externalFramework?.renderer || externalFramework?.packageName || `@storybook/${renderer}`;

  const packageJsonPath = join(frameworkPackageName, 'package.json');

  const errors: Error[] = [];

  try {
    return dirname(
      require.resolve(packageJsonPath, {
        paths: [process.cwd()],
      })
    );
  } catch (e) {
    invariant(e instanceof Error);
    errors.push(e);
  }

  try {
    return await resolveUsingBranchInstall(packageManager, frameworkPackageName);
  } catch (e) {
    invariant(e instanceof Error);
    errors.push(e);
  }

  throw new Error(`Cannot find ${packageJsonPath}, ${errors.map((e) => e.stack).join('\n\n')}`);
}
