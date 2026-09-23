import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const shimPackage = '@storybook/react-dom-shim';
const shimPreset = '@storybook/react-dom-shim/preset';
const internalClient = 'storybook/internal/react-dom-client';
const preactRange = '^10.7.1 || >= 11.0.0-0';
const unsafeManifestPath = 'packages/shim-consumer/package.json';
const unsafeSourcePath = 'packages/shim-consumer/src/index.ts';
const unsafeConfigPath = 'packages/dynamic-config/vitest.config.ts';

type PackageManifest = {
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

type RemovalContractInput = {
  projectDir: string;
  repositoryRoot: string;
  upgradeOutput: string;
};

type RefusalContractInput = {
  projectDir: string;
  manifestBefore: string;
  sourceBefore: string;
  configBefore: string;
  upgradeOutput: string;
};

async function readManifest(path: string): Promise<PackageManifest> {
  return JSON.parse(await readFile(path, 'utf8'));
}

function dependencyVersion(manifest: PackageManifest, packageName: string) {
  return manifest.dependencies?.[packageName] ?? manifest.devDependencies?.[packageName];
}

function requireCondition(failures: string[], condition: boolean, message: string) {
  if (!condition) {
    failures.push(message);
  }
}

async function pathExists(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function assertOrdinaryReactDomShimSeed(projectDir: string) {
  const manifest = await readManifest(join(projectDir, 'package.json'));
  const mainConfig = await readFile(join(projectDir, '.storybook/main.ts'), 'utf8');

  const failures: string[] = [];
  requireCondition(
    failures,
    dependencyVersion(manifest, shimPackage) === undefined,
    'The ordinary project must use the shim only transitively'
  );
  requireCondition(
    failures,
    !mainConfig.includes(shimPackage),
    'The ordinary project must not configure the shim directly'
  );

  if (failures.length > 0) {
    throw new Error(`Invalid ordinary react-dom-shim seed:\n- ${failures.join('\n- ')}`);
  }
}

export async function assertSafeReactDomShimSeed(projectDir: string) {
  const manifest = await readManifest(join(projectDir, 'package.json'));
  const mainConfig = await readFile(join(projectDir, '.storybook/main.ts'), 'utf8');
  const staticAlias = await readFile(join(projectDir, 'vitest.config.ts'), 'utf8');

  const failures: string[] = [];
  requireCondition(
    failures,
    dependencyVersion(manifest, shimPackage) === '10.5.10',
    'The safe seed must pin an explicit v10 shim dependency'
  );
  requireCondition(failures, mainConfig.includes(shimPreset), 'The static shim preset is missing');
  requireCondition(
    failures,
    staticAlias.includes("'@storybook/react-dom-shim/dist/react-16'"),
    'The literal legacy alias is missing'
  );
  requireCondition(
    failures,
    !(await pathExists(join(projectDir, '.storybook/preview.ts'))) &&
      !(await pathExists(join(projectDir, unsafeSourcePath))) &&
      !(await pathExists(join(projectDir, unsafeManifestPath))),
    'The safe seed must not contain a direct or custom shim API consumer'
  );

  if (failures.length > 0) {
    throw new Error(`Invalid safe react-dom-shim seed:\n- ${failures.join('\n- ')}`);
  }
}

export async function assertUnsafeReactDomShimSeed(projectDir: string) {
  const manifest = await readManifest(join(projectDir, unsafeManifestPath));
  const directConsumer = await readFile(join(projectDir, unsafeSourcePath), 'utf8');
  const dynamicConfig = await readFile(join(projectDir, unsafeConfigPath), 'utf8');

  const failures: string[] = [];
  requireCondition(
    failures,
    dependencyVersion(manifest, shimPackage) === '10.5.10',
    'The unsafe consumer must pin its explicit v10 shim dependency'
  );
  requireCondition(
    failures,
    directConsumer.includes('renderElement, unmountElement'),
    'The third-party direct imports are missing'
  );
  requireCondition(
    failures,
    dynamicConfig.includes('[shimPackage]: legacyEntry'),
    'The computed alias fixture is missing'
  );

  if (failures.length > 0) {
    throw new Error(`Invalid unsafe react-dom-shim seed:\n- ${failures.join('\n- ')}`);
  }
}

export async function assertReactDomShimRemovalContract(input: RemovalContractInput) {
  const manifest = await readManifest(join(input.projectDir, 'package.json'));
  const mainConfig = await readFile(join(input.projectDir, '.storybook/main.ts'), 'utf8');
  const staticAlias = await readFile(join(input.projectDir, 'vitest.config.ts'), 'utf8');
  const reactRenderer = await readFile(
    join(input.repositoryRoot, 'code/renderers/react/src/renderToCanvas.tsx'),
    'utf8'
  );
  const docsRenderer = await readFile(
    join(input.repositoryRoot, 'code/addons/docs/src/DocsRenderer.tsx'),
    'utf8'
  );
  const preactRenderer = await readManifest(
    join(input.repositoryRoot, 'code/renderers/preact/package.json')
  );
  const preactFramework = await readManifest(
    join(input.repositoryRoot, 'code/frameworks/preact-vite/package.json')
  );

  const failures: string[] = [];
  requireCondition(
    failures,
    dependencyVersion(manifest, shimPackage) === undefined,
    'The safe seed explicit dependency was not removed'
  );
  requireCondition(failures, !mainConfig.includes(shimPreset), 'The static preset was not removed');
  requireCondition(
    failures,
    !staticAlias.includes(shimPackage),
    'The literal legacy alias was not removed'
  );
  requireCondition(
    failures,
    !/@storybook\/react-dom-shim@[^\s]*11(?:\.|-)/.test(input.upgradeOutput),
    'The upgrade requested a nonexistent v11 shim release'
  );
  requireCondition(
    failures,
    !(await pathExists(
      join(input.projectDir, 'node_modules/@storybook/react-dom-shim/package.json')
    )),
    'The safely migrated install still contains react-dom-shim'
  );
  requireCondition(
    failures,
    reactRenderer.includes(internalClient) && !reactRenderer.includes(shimPackage),
    'The React renderer does not use the approved internal client entry'
  );
  requireCondition(
    failures,
    docsRenderer.includes(internalClient) && !docsRenderer.includes(shimPackage),
    'The docs renderer does not use the approved internal client entry'
  );
  requireCondition(
    failures,
    preactRenderer.peerDependencies?.preact === preactRange,
    `The Preact renderer peer range is not ${preactRange}`
  );
  requireCondition(
    failures,
    preactFramework.peerDependencies?.preact === preactRange,
    `The Preact framework peer range is not ${preactRange}`
  );

  if (failures.length > 0) {
    throw new Error(`Unmet safe react-dom-shim removal contract:\n- ${failures.join('\n- ')}`);
  }
}

export async function assertReactDomShimRefusalContract(input: RefusalContractInput) {
  const manifestPath = join(input.projectDir, unsafeManifestPath);
  const sourcePath = join(input.projectDir, unsafeSourcePath);
  const configPath = join(input.projectDir, unsafeConfigPath);
  const manifest = await readManifest(manifestPath);
  const installedManifest = await readManifest(
    join(input.projectDir, 'node_modules/@storybook/react-dom-shim/package.json')
  );

  const failures: string[] = [];
  requireCondition(
    failures,
    (await readFile(manifestPath, 'utf8')) === input.manifestBefore,
    `${unsafeManifestPath} changed instead of retaining its explicit dependency`
  );
  requireCondition(
    failures,
    dependencyVersion(manifest, shimPackage) === '10.5.10',
    'The unsafe consumer did not retain its v10 shim dependency'
  );
  requireCondition(
    failures,
    installedManifest.version === '10.5.10',
    'The unsafe consumer did not keep the installable v10 shim release'
  );
  requireCondition(
    failures,
    (await readFile(sourcePath, 'utf8')) === input.sourceBefore,
    `${unsafeSourcePath} changed even though no supported automatic replacement exists`
  );
  requireCondition(
    failures,
    input.upgradeOutput.includes(unsafeSourcePath) && /manual/i.test(input.upgradeOutput),
    `The upgrade output did not give file-specific manual guidance for ${unsafeSourcePath}`
  );
  requireCondition(
    failures,
    (await readFile(configPath, 'utf8')) === input.configBefore,
    `${unsafeConfigPath} changed instead of being refused unchanged`
  );
  requireCondition(
    failures,
    input.upgradeOutput.includes(unsafeConfigPath) &&
      /computed|dynamic|manual|refus/i.test(input.upgradeOutput),
    `The upgrade output did not give file-specific manual guidance for ${unsafeConfigPath}`
  );
  requireCondition(
    failures,
    !/@storybook\/react-dom-shim@[^\s]*11(?:\.|-)/.test(input.upgradeOutput),
    'The unsafe upgrade requested a nonexistent v11 shim release'
  );

  if (failures.length > 0) {
    throw new Error(`Unmet unsafe react-dom-shim refusal contract:\n- ${failures.join('\n- ')}`);
  }
}
