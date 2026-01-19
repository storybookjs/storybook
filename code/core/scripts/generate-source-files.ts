import { existsSync } from 'node:fs';
import { mkdirSync } from 'node:fs';
import { readdir, realpath, writeFile } from 'node:fs/promises';
import os from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { isNotNil } from 'es-toolkit/predicate';
import * as esbuild from 'esbuild';
import * as prettier from 'prettier';
import { dedent } from 'ts-dedent';

import { getWorkspace } from '../../../scripts/utils/tools';
import { BROWSER_TARGETS, SUPPORTED_FEATURES } from '../src/shared/constants/environments-support';

GlobalRegistrator.register({ url: 'http://localhost:3000', width: 1920, height: 1080 });

const CODE_DIR = join(import.meta.dirname, '..', '..', '..', 'code');
const CORE_ROOT_DIR = join(CODE_DIR, 'core');
const tempDir = () => realpath(os.tmpdir());
const getPath = async (prefix = '') =>
  join(await tempDir(), prefix + (Math.random() + 1).toString(36).substring(7));

async function temporaryDirectory({ prefix = '' } = {}) {
  const directory = await getPath(prefix);
  mkdirSync(directory);
  return directory;
}
async function temporaryFile({ name, extension }: { name?: string; extension?: string } = {}) {
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
  const prettierConfig = await prettier.resolveConfig(join(CORE_ROOT_DIR, 'src'));

  await Promise.all([
    generateFrameworksFile(prettierConfig),
    generateVersionsFile(prettierConfig),
    generateExportsFile(prettierConfig),
  ]);
};

async function generateVersionsFile(prettierConfig: prettier.Options | null): Promise<void> {
  const destination = join(CORE_ROOT_DIR, 'src', 'common', 'versions.ts');

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
    destination,
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
  const thirdPartyFrameworks = [
    'html-rsbuild',
    'nuxt',
    'qwik',
    'react-rsbuild',
    'solid',
    'vue3-rsbuild',
    'web-components-rsbuild',
  ];
  const destination = join(CORE_ROOT_DIR, 'src', 'types', 'modules', 'frameworks.ts');
  const frameworksDirectory = join(CODE_DIR, 'frameworks');

  const readFrameworks = (await readdir(frameworksDirectory)).filter((framework) =>
    existsSync(join(frameworksDirectory, framework, 'package.json'))
  );

  const formatFramework = (framework: string) => {
    const typedName = framework.replace(/-/g, '_').toUpperCase();
    return `${typedName} = '${framework}'`;
  };

  const coreFrameworks = readFrameworks.sort().map(formatFramework).join(',\n');
  const communityFrameworks = thirdPartyFrameworks.sort().map(formatFramework).join(',\n');

  await writeFile(
    destination,
    await prettier.format(
      dedent`
        // auto generated file, do not edit
        export enum SupportedFramework {
          // CORE
          ${coreFrameworks},
          // COMMUNITY
          ${communityFrameworks}
        }
      `,
      {
        ...prettierConfig,
        parser: 'typescript',
      }
    )
  );
}

const localAlias = {
  'storybook/internal': join(CORE_ROOT_DIR, 'src'),
  'storybook/theming': join(CORE_ROOT_DIR, 'src', 'theming'),
  'storybook/test': join(CORE_ROOT_DIR, 'src', 'test'),
  'storybook/test/preview': join(CORE_ROOT_DIR, 'src', 'test', 'preview'),
  'storybook/actions': join(CORE_ROOT_DIR, 'src', 'actions'),
  'storybook/preview-api': join(CORE_ROOT_DIR, 'src', 'preview-api'),
  'storybook/manager-api': join(CORE_ROOT_DIR, 'src', 'manager-api'),
  storybook: join(CORE_ROOT_DIR, 'src'),
};
async function generateExportsFile(prettierConfig: prettier.Options | null): Promise<void> {
  function removeDefault(input: string) {
    return input !== 'default';
  }

  const destination = join(CORE_ROOT_DIR, 'src', 'manager', 'globals', 'exports.ts');

  const entryFile = join(CORE_ROOT_DIR, 'src', 'manager', 'globals', 'runtime.ts');
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

  const { globalsNameValueMap: data } = await import(pathToFileURL(outFile).href);

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
    destination,
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

generateSourceFiles().catch((error) => {
  console.error('Error during prebuild:', error);
  process.exit(1);
});
