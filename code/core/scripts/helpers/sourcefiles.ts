import { existsSync } from 'node:fs';
import { mkdirSync } from 'node:fs';
import { readdir, realpath, writeFile } from 'node:fs/promises';
import os from 'node:os';
import { join } from 'node:path';

import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { isNotNil } from 'es-toolkit';
import uniqueString from 'unique-string';

import { dedent, esbuild, getWorkspace, prettier } from '../../../../scripts/prepare/tools';
import {
  BROWSER_TARGETS,
  SUPPORTED_FEATURES,
} from '../../src/shared/constants/environments-support';

GlobalRegistrator.register({ url: 'http://localhost:3000', width: 1920, height: 1080 });

const tempDir = () => realpath(os.tmpdir());
const getPath = async (prefix = '') => join(await tempDir(), prefix + uniqueString());

export async function temporaryDirectory({ prefix = '' } = {}) {
  const directory = await getPath(prefix);
  mkdirSync(directory);
  return directory;
}
export async function temporaryFile({
  name,
  extension,
}: { name?: string; extension?: string } = {}) {
  if (name) {
    if (extension !== undefined && extension !== null) {
      // eslint-disable-next-line local-rules/no-uncategorized-errors
      throw new Error('The `name` and `extension` options are mutually exclusive');
    }

    return join(await temporaryDirectory(), name);
  }

  return (
    (await getPath()) +
    (extension === undefined || extension === null ? '' : '.' + extension.replace(/^\./, ''))
  );
}

// read code/frameworks subfolders and generate a list of available frameworks
// save this list into ./code/core/src/types/frameworks.ts and export it as a union type.
// The name of the type is `SupportedFrameworks`. Add additionally 'qwik' and `solid` to that list.
export const generateSourceFiles = async () => {
  const location = join(__dirname, '..', '..', 'src');
  const prettierConfig = await prettier.resolveConfig(location);

  await Promise.all([
    //
    generateFrameworksFile(prettierConfig),
    generateVersionsFile(prettierConfig),
    generateExportsFile(prettierConfig),
  ]);
};

async function generateVersionsFile(prettierConfig: prettier.Options | null): Promise<void> {
  const location = join(__dirname, '..', '..', 'src', 'common', 'versions.ts');

  const workspace = (await getWorkspace()).filter(isNotNil);

  const versions = JSON.stringify(
    workspace
      .sort((a, b) => a.path.localeCompare(b.path))
      .reduce<Record<string, string>>((acc, i) => {
        if (i.publishConfig && i.publishConfig.access === 'public') {
          acc[i.name] = i.version;
        }
        return acc;
      }, {})
  );

  await writeFile(
    location,
    await prettier.format(
      dedent`
        // auto generated file, do not edit
        export default ${versions};
      `,
      {
        ...prettierConfig,
        parser: 'typescript',
      }
    )
  );
}

async function generateFrameworksFile(prettierConfig: prettier.Options | null): Promise<void> {
  const thirdPartyFrameworks = ['qwik', 'solid', 'nuxt', 'react-rsbuild', 'vue3-rsbuild'];
  const location = join(__dirname, '..', '..', 'src', 'types', 'modules', 'frameworks.ts');
  const frameworksDirectory = join(__dirname, '..', '..', '..', 'frameworks');

  const readFrameworks = (await readdir(frameworksDirectory)).filter((framework) =>
    existsSync(join(frameworksDirectory, framework, 'project.json'))
  );
  const frameworks = [...readFrameworks.sort(), ...thirdPartyFrameworks]
    .map((framework) => `'${framework}'`)
    .join(' | ');

  await writeFile(
    location,
    await prettier.format(
      dedent`
        // auto generated file, do not edit
        export type SupportedFrameworks = ${frameworks};
      `,
      {
        ...prettierConfig,
        parser: 'typescript',
      }
    )
  );
}

const localAlias = {
  '@storybook/core': join(__dirname, '..', '..', 'src'),
  'storybook/internal': join(__dirname, '..', '..', 'src'),
  'storybook/theming': join(__dirname, '..', '..', 'src', 'theming'),
  'storybook/test': join(__dirname, '..', '..', 'src', 'test'),
  'storybook/test/preview': join(__dirname, '..', '..', 'src', 'test', 'preview'),
  'storybook/actions': join(__dirname, '..', '..', 'src', 'actions'),
  'storybook/preview-api': join(__dirname, '..', '..', 'src', 'preview-api'),
  'storybook/manager-api': join(__dirname, '..', '..', 'src', 'manager-api'),
  storybook: join(__dirname, '..', '..', 'src'),
};
async function generateExportsFile(prettierConfig: prettier.Options | null): Promise<void> {
  function removeDefault(input: string) {
    return input !== 'default';
  }

  const location = join(__dirname, '..', '..', 'src', 'manager', 'globals', 'exports.ts');

  const entryFile = join(__dirname, '..', '..', 'src', 'manager', 'globals', 'runtime.ts');
  const outFile = await temporaryFile({ extension: 'js' });

  await esbuild.build({
    entryPoints: [entryFile],
    bundle: true,
    format: 'esm',
    drop: ['console'],
    outfile: outFile,
    alias: localAlias,
    legalComments: 'none',
    splitting: false,
    platform: 'browser',
    target: BROWSER_TARGETS,
    supported: SUPPORTED_FEATURES,
  });

  const { globalsNameValueMap: data } = await import(outFile);

  // loop over all values of the keys of the data object and remove the default key
  for (const key in data) {
    const value = data[key];
    if (typeof value === 'object') {
      data[key] = Object.keys(
        Object.fromEntries(Object.entries(value).filter(([k]) => removeDefault(k)))
      ).sort();
    }
  }

  await writeFile(
    location,
    await prettier.format(
      dedent`
      // this file is generated by sourcefiles.ts
      // this is done to prevent runtime dependencies from making it's way into the build/start script of the manager
      // the manager builder needs to know which dependencies are 'globalized' in the ui
      
      export default ${JSON.stringify(data)} as const;
    `,
      {
        ...prettierConfig,
        parser: 'typescript',
      }
    )
  );
}
