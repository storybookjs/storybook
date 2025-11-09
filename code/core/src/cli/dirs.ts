import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream } from 'node:stream/web';
import { createGunzip } from 'node:zlib';

import { temporaryDirectory, versions } from 'storybook/internal/common';
import type { JsPackageManager } from 'storybook/internal/common';
import type { SupportedFrameworks, SupportedRenderers } from 'storybook/internal/types';

import getNpmTarballUrlDefault from 'get-npm-tarball-url';
import { unpackTar } from 'modern-tar/fs';
import invariant from 'tiny-invariant';

import { resolvePackageDir } from '../shared/utils/module';
import { externalFrameworks } from './project_types';

const resolveUsingBranchInstall = async (packageManager: JsPackageManager, request: string) => {
  const tempDirectory = await temporaryDirectory();
  const name = request as keyof typeof versions;

  // FIXME: this might not be the right version for community packages
  const version = versions[name] || (await packageManager.latestVersion(request));

  // an artifact of esbuild + type=commonjs + exportmap
  // @ts-expect-error (default export)
  const getNpmTarballUrl = getNpmTarballUrlDefault.default || getNpmTarballUrlDefault;

  const url = getNpmTarballUrl(request, version, {
    registry: await packageManager.getRegistryURL(),
  });

  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download tarball from ${url}`);
  }

  // this unzips the tarball into the temp directory
  await pipeline(
    Readable.fromWeb(response.body as ReadableStream<Uint8Array>),
    createGunzip(),
    unpackTar(tempDirectory)
  );

  return join(tempDirectory, 'package');
};

export async function getRendererDir(
  packageManager: JsPackageManager,
  renderer: SupportedFrameworks | SupportedRenderers
) {
  const externalFramework = externalFrameworks.find((framework) => framework.name === renderer);
  const frameworkPackageName =
    externalFramework?.packageName || externalFramework?.renderer || `@storybook/${renderer}`;

  const packageJsonPath = join(frameworkPackageName, 'package.json');

  const errors: Error[] = [];

  try {
    return resolvePackageDir(frameworkPackageName, process.cwd());
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
