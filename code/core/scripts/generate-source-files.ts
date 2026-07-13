import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { isNotNil } from 'es-toolkit/predicate';
import { format } from 'oxfmt';
import { rolldown } from 'rolldown';
import { dedent } from 'ts-dedent';

import { getWorkspace } from '../../../scripts/utils/tools.ts';

const CODE_DIR = join(import.meta.dirname, '..', '..', '..', 'code');
const CORE_ROOT_DIR = join(CODE_DIR, 'core');

// read code/frameworks subfolders and generate a list of available frameworks
// save this list into ./code/core/src/types/frameworks.ts and export it as a union type.
// The name of the type is `SupportedFrameworks`. Add additionally 'qwik' and `solid` to that list.
export const generateSourceFiles = async () => {
  // generateExportsFile scans core source (including the two files written
  // below) with rolldown; run the writers first so the scan never observes
  // them mid-rewrite.
  await Promise.all([generateFrameworksFile(), generateVersionsFile()]);
  await generateExportsFile();
};

/**
 * Generated sources are read concurrently by other build steps (the rolldown
 * export scan below, and parallel package builds whose declaration emit
 * type-checks core source), and `fs.writeFile` truncates before writing, so a
 * plain overwrite exposes readers to an empty or partial file. Skip identical
 * content (the steady state) and otherwise swap the new content in atomically
 * via rename.
 */
async function writeGeneratedFile(destination: string, content: string): Promise<void> {
  const existing = await readFile(destination, 'utf8').catch(() => null);
  if (existing === content) {
    return;
  }
  const temp = `${destination}.tmp-${process.pid}`;
  await writeFile(temp, content);
  try {
    await rename(temp, destination);
  } catch {
    // Windows can refuse to replace a file that another process holds open
    // without delete sharing; fall back to a plain overwrite there.
    await writeFile(destination, content);
  }
}

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

const localAlias = {
  'storybook/internal': join(CORE_ROOT_DIR, 'src'),
  'storybook/theming': join(CORE_ROOT_DIR, 'src', 'theming'),
  'storybook/test': join(CORE_ROOT_DIR, 'src', 'test'),
  'storybook/test/preview': join(CORE_ROOT_DIR, 'src', 'test', 'preview'),
  'storybook/actions': join(CORE_ROOT_DIR, 'src', 'actions'),
  'storybook/preview-api': join(CORE_ROOT_DIR, 'src', 'preview-api'),
  'storybook/manager-api': join(CORE_ROOT_DIR, 'src', 'manager-api'),
  'storybook/open-service': join(CORE_ROOT_DIR, 'src', 'shared', 'open-service'),
  storybook: join(CORE_ROOT_DIR, 'src'),
};
async function generateExportsFile(): Promise<void> {
  const destination = join(CORE_ROOT_DIR, 'src', 'manager', 'globals', 'exports.ts');
  const require = createRequire(join(CORE_ROOT_DIR, 'package.json'));

  // Get the module list from the globals reference map (the source of truth)
  const { globalPackages } = await import('../src/manager/globals/globals.ts');

  // Extract named exports using a single rolldown build with virtual entry per module.
  // Rolldown statically resolves exports without evaluating any code.
  // For CJS modules (e.g. react) that don't expose ESM exports, fall back to require().
  const input: Record<string, string> = {};
  const virtualModules: Record<string, string> = {};

  for (const mod of globalPackages) {
    const key = mod.replace(/[/@]/g, '_');
    input[key] = `\0${key}`;
    virtualModules[`\0${key}`] = `export * from '${mod}'`;
  }

  const bundle = await rolldown({
    input,
    resolve: { alias: localAlias },
    platform: 'browser',
    logLevel: 'silent',
    plugins: [
      {
        name: 'virtual',
        resolveId(id) {
          if (id.startsWith('\0')) return id;
        },
        load(id) {
          if (virtualModules[id]) return virtualModules[id];
        },
      },
    ],
  });

  const { output } = await bundle.generate({ format: 'esm' });

  const data: Record<string, string[]> = {};

  for (const chunk of output) {
    if (chunk.type !== 'chunk' || !chunk.isEntry) continue;
    const mod = globalPackages.find((m: string) => m.replace(/[/@]/g, '_') === chunk.name);
    if (!mod) continue;

    let exports = chunk.exports.filter((e: string) => e !== 'default').sort();

    // CJS modules don't expose ESM exports — fall back to require()
    if (exports.length === 0) {
      try {
        exports = Object.keys(require(mod))
          .filter((k) => k !== 'default' && k !== '__esModule')
          .sort();
      } catch {
        // ignore — module may not be requireable
      }
    }

    data[mod] = exports;
  }

  // Preserve key order from globalsNameReferenceMap for deterministic output
  const ordered = Object.fromEntries(globalPackages.map((mod: string) => [mod, data[mod]]));

  const { code: formatted } = await format(
    'exports.ts',
    dedent`
      // this file is generated by sourcefiles.ts
      // this is done to prevent runtime dependencies from making it's way into the build/start script of the manager
      // the manager builder needs to know which dependencies are 'globalized' in the ui

      export default ${JSON.stringify(ordered)} as const;
    `,
    { singleQuote: true }
  );

  await writeGeneratedFile(destination, formatted);
}

generateSourceFiles();
