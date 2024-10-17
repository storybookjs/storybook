import { program } from 'commander';
import detectFreePort from 'detect-port';
import { mkdir, readdir, rm, stat, writeFile } from 'fs/promises';
import pLimit from 'p-limit';
import { join } from 'path';
import { x } from 'tinyexec';

import versions from '../../code/core/src/common/versions';
import { runRegistry } from '../tasks/run-registry';
import { maxConcurrentTasks } from '../utils/concurrency';
import { esMain } from '../utils/esmain';

const BENCH_PACKAGES_PATH = join(__dirname, '..', '..', 'bench', 'packages');
const REGISTRY_PORT = 6001;

type PackageName = keyof typeof versions;
type Result = {
  package: PackageName;
  dependencies: number;
  selfSize: string;
  dependencySize: string;
  totalSize: string;
};
/**
 * This script is used to bench the size of Storybook packages and their dependencies. For each
 * package, the steps are:
 *
 * 1. Create a temporary directory in /bench/packages and create a package.json file that only depends
 *    on that one package
 * 2. Install the package and its dependencies, without peer dependencies
 * 3. Measure the size of the package and its dependencies, and count the number of dependencies
 *    (including transitive)
 * 4. Print the results
 */

export const benchPackage = async (packageName: PackageName) => {
  console.log(`Benching ${packageName}...`);
  const tmpBenchPackagePath = join(BENCH_PACKAGES_PATH, packageName.replace('@storybook', ''));

  await rm(tmpBenchPackagePath, { recursive: true }).catch(() => {});
  await mkdir(tmpBenchPackagePath, { recursive: true });

  await writeFile(
    join(tmpBenchPackagePath, 'package.json'),
    JSON.stringify(
      {
        name: `${packageName}-bench`,
        version: '1.0.0',
        // Overrides ensures that Storybook packages outside the monorepo are using the versions we have in the monorepo
        overrides: versions,
      },
      null,
      2
    )
  );

  await x(
    'npm',
    `install --save-exact --registry http://localhost:6001 --omit peer ${packageName}@${versions[packageName]}`.split(
      ' '
    ),
    {
      nodeOptions: { cwd: tmpBenchPackagePath },
    }
  );

  const npmLsResult = await x('npm', `ls --all --parseable`.split(' '), {
    nodeOptions: { cwd: tmpBenchPackagePath },
  });

  // the first line is the temporary benching package itself, don't count it
  // the second line is the package we're benching, don't count it
  const amountOfDependencies = npmLsResult.stdout.trim().split('\n').length - 2;

  const nodeModulesSize = await getDirSize(join(tmpBenchPackagePath, 'node_modules'));
  const selfSize = await getDirSize(join(tmpBenchPackagePath, 'node_modules', packageName));
  const dependencySize = nodeModulesSize - selfSize;

  const result: Result = {
    package: packageName,
    dependencies: amountOfDependencies,
    selfSize: formatBytes(selfSize),
    dependencySize: formatBytes(dependencySize),
    totalSize: formatBytes(nodeModulesSize),
  };
  console.log(result);
  return result;
};

const getDirSize = async (path: string) => {
  const entities = await readdir(path, {
    recursive: true,
    withFileTypes: true,
  });
  const stats = await Promise.all(
    entities
      .filter((entity) => entity.isFile())
      .map((entity) => stat(join(entity.parentPath, entity.name)))
  );
  return stats.reduce((acc, { size }) => acc + size, 0);
};

const formatBytes = (bytes: number) => {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1000 && unitIndex < units.length - 1) {
    size /= 1000;
    unitIndex++;
  }

  // B, KB = 0 decimal places
  // MB, GB, TB = 2 decimal places
  const decimals = unitIndex < 2 ? 0 : 2;
  return `${size.toFixed(decimals)} ${units[unitIndex]}`;
};

const saveResults = async (results: Result[]) => {
  console.log('Saving results...');
  const allResults: Record<string, Omit<Result, 'package'>> = {};
  for (const result of results) {
    const { package: packageName, ...withoutPackage } = result;
    allResults[result.package] = withoutPackage;
  }
  await writeFile(
    join(BENCH_PACKAGES_PATH, 'package-bench-results.json'),
    JSON.stringify(allResults, null, 2)
  );
};

const run = async () => {
  program.argument(
    '[packages...]',
    'which packages to bench. If omitted, all packages are benched'
  );
  program.parse(process.argv);

  const packages = (
    program.args.length > 0 ? program.args : Object.keys(versions)
  ) as PackageName[];

  packages.forEach((packageName) => {
    if (!Object.keys(versions).includes(packageName)) {
      throw new Error(`Package '${packageName}' not found`);
    }
  });

  let registryController: AbortController | undefined;
  if ((await detectFreePort(REGISTRY_PORT)) === REGISTRY_PORT) {
    console.log('Starting local registry...');
    registryController = await runRegistry({ dryRun: false, debug: false });
  }

  // The amount of VCPUs for this task in CI is 2 (medium resource)
  const amountOfVCPUs = 2;
  const concurrentLimt = process.env.CI ? amountOfVCPUs - 1 : maxConcurrentTasks;
  const limit = pLimit(concurrentLimt);

  const progressIntervalId = setInterval(() => {
    const doneCount = packages.length - limit.activeCount - limit.pendingCount;
    if (doneCount === packages.length) {
      clearInterval(progressIntervalId);
      return;
    }
    console.log(
      `Currently benching ${limit.activeCount} packages, ${limit.pendingCount} pending, ${doneCount} done...`
    );
  }, 2_000);
  const results = await Promise.all(
    packages.map((packageName) => limit(() => benchPackage(packageName)))
  );
  await saveResults(results);

  console.log('Done benching all packages');
  registryController?.abort();
};

if (esMain(import.meta.url)) {
  run().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
