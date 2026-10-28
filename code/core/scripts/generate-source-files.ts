import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { isNotNil } from 'es-toolkit/predicate';
import { format } from 'oxfmt';
import { dedent } from 'ts-dedent';

import { writeGeneratedFile } from '../../../scripts/build/utils/write-generated-file.ts';
import { getWorkspace } from '../../../scripts/utils/tools.ts';

const CODE_DIR = join(import.meta.dirname, '..', '..', '..', 'code');
const CORE_ROOT_DIR = join(CODE_DIR, 'core');

// read code/frameworks subfolders and generate a list of available frameworks
// save this list into ./code/core/src/types/frameworks.ts and export it as a union type.
// The name of the type is `SupportedFrameworks`. Add additionally 'qwik' and `solid` to that list.
export const generateSourceFiles = async () => {
  await Promise.all([generateFrameworksFile(), generateVersionsFile()]);
};

async function generateVersionsFile(): Promise<void> {
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

  const { code: formatted } = await format(
    'versions.ts',
    dedent`
      // auto generated file, do not edit
      export default ${versions};
    `,
    { singleQuote: true }
  );

  await writeGeneratedFile(destination, formatted);
}

async function generateFrameworksFile(): Promise<void> {
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

  const { code: formatted } = await format(
    'frameworks.ts',
    dedent`
      // auto generated file, do not edit
      export enum SupportedFramework {
        // CORE
        ${coreFrameworks},
        // COMMUNITY
        ${communityFrameworks}
      }
    `,
    { singleQuote: true }
  );

  await writeGeneratedFile(destination, formatted);
}

generateSourceFiles();
