import { BigQuery } from '@google-cloud/bigquery';
import { InvalidArgumentError, program } from 'commander';
import detectFreePort from 'detect-port';
import { mkdir, readdir, rm, stat, writeFile } from 'fs/promises';
import pLimit from 'p-limit';
import { join } from 'path';
import picocolors from 'picocolors';
import { x } from 'tinyexec';

import versions from '../../code/core/src/common/versions';
import { runRegistry } from '../tasks/run-registry';
import { maxConcurrentTasks } from '../utils/concurrency';
import { esMain } from '../utils/esmain';

const Thresholds = {
  SELF_SIZE_RATIO: 0.1,
  SELF_SIZE_ABSOLUTE: 10_000,
  DEPS_SIZE_RATIO: 0.1,
  DEPS_SIZE_ABSOLUTE: 10_000,
  DEPS_COUNT_ABSOLUTE: 1,
} as const;

const BENCH_PACKAGES_PATH = join(__dirname, '..', '..', 'bench', 'packages');
const REGISTRY_PORT = 6001;
const GCP_CREDENTIALS = JSON.parse(process.env.GCP_CREDENTIALS || '{}');
const bigQueryBenchTable = new BigQuery({
  projectId: GCP_CREDENTIALS.project_id,
  credentials: GCP_CREDENTIALS,
})
  .dataset('benchmark_results')
  .table('package_bench');

type PackageName = keyof typeof versions;
type Result = {
  package: PackageName;
  dependencyCount: number;
  selfSize: number;
  dependencySize: number;
};
type HumanReadableResult = {
  package: PackageName;
  dependencyCount: string;
  selfSize: string;
  dependencySize: string;
  totalSize: string;
};
type ResultMap = Record<PackageName, Result>;
type HumanReadableResultMap = Record<PackageName, HumanReadableResult>;

let registryController: AbortController | undefined;

/**
 * This function benchmarks the size of Storybook packages and their dependencies. For each package,
 * the steps are:
 *
 * 1. Create a temporary directory in /bench/packages and create a package.json file that only depends
 *    on that one package
 * 2. Install the package and its dependencies, without peer dependencies
 * 3. Measure the size of the package and its dependencies, and count the number of dependencies
 *    (including transitive)
 * 4. Print and return the results
 */
export const benchPackage = async (packageName: PackageName) => {
  console.log(`Benching ${picocolors.blue(packageName)}...`);
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

  const npmInstallResult = await x(
    'npm',
    `install --save-exact --registry http://localhost:6001 --omit peer ${packageName}@${versions[packageName]}`.split(
      ' '
    ),
    {
      nodeOptions: { cwd: tmpBenchPackagePath },
    }
  );

  // -1 of reported packages added because we shouldn't count the actual package as a dependency
  const dependencyCount =
    Number.parseInt(npmInstallResult.stdout.match(/added (\d+) packages?/)?.[1] ?? '') - 1;

  const nodeModulesSize = await getDirSize(join(tmpBenchPackagePath, 'node_modules'));
  const selfSize = await getDirSize(join(tmpBenchPackagePath, 'node_modules', packageName));
  const dependencySize = nodeModulesSize - selfSize;

  const result: Result = {
    package: packageName,
    dependencyCount,
    selfSize,
    dependencySize,
  };
  console.log(`Done benching ${picocolors.blue(packageName)}`);
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

const toHumanReadable = (result: Result, diff = false): HumanReadableResult => {
  return {
    package: result.package,
    dependencyCount: `${diff && result.dependencyCount > 0 ? '+' : ''}${result.dependencyCount}`,
    selfSize: formatBytes(result.selfSize, diff),
    dependencySize: formatBytes(result.dependencySize, diff),
    totalSize: formatBytes(result.selfSize + result.dependencySize, diff),
  };
};

const formatBytes = (bytes: number, diff = false) => {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = Math.abs(bytes);
  let unitIndex = 0;

  while (size >= 1000 && unitIndex < units.length - 1) {
    size /= 1000;
    unitIndex++;
  }

  // B, KB = 0 decimal places
  // MB, GB, TB = 2 decimal places
  const decimals = unitIndex < 2 ? 0 : 2;
  const formattedSize = `${size.toFixed(decimals)} ${units[unitIndex]}`;

  if (bytes < 0) {
    return `-${formattedSize}`;
  }
  if (diff) {
    return `+${formattedSize}`;
  }
  return formattedSize;
};

const saveLocally = async ({
  results,
  filename,
  diff = false,
}: {
  results: Partial<ResultMap>;
  filename: string;
  diff?: boolean;
}) => {
  const resultPath = join(BENCH_PACKAGES_PATH, filename);
  console.log(`Saving results to ${picocolors.magenta(resultPath)}...`);

  const humanReadableResults = Object.entries(results).reduce((acc, [packageName, result]) => {
    acc[packageName as PackageName] = toHumanReadable(result, diff);
    return acc;
  }, {} as HumanReadableResultMap);
  await writeFile(resultPath, JSON.stringify(humanReadableResults, null, 2));
};

const compareResults = async ({
  results,
  baseBranch,
}: {
  results: ResultMap;
  baseBranch: string;
}) => {
  console.log(`Comparing results with base branch ${picocolors.magenta(baseBranch)}...`);
  const [baseResults] = await bigQueryBenchTable.query({
    query: `
      WITH
        latest_packages AS (
        SELECT *,
          ROW_NUMBER() OVER (PARTITION BY package ORDER BY benchmarkedAt DESC) AS row_number
        FROM
          \`storybook-benchmark.benchmark_results.package_bench\`
        WHERE
          branch = @baseBranch
          AND package IN UNNEST(@packages)
          AND benchmarkedAt > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY) )
      SELECT *
      FROM latest_packages
      WHERE row_number = 1;`,
    params: { baseBranch, packages: Object.keys(results) },
  });

  const comparisonResults = {} as ResultMap;
  for (const result of Object.values(results)) {
    let baseResult = baseResults.find((row) => row.package === result.package);
    if (!baseResult) {
      console.warn(
        `No base result found for ${picocolors.blue(result.package)}, skipping comparison.`
      );
      continue;
    }
    if (Math.random() > 0.5) {
      console.log('LOG: faking base results', baseResult.package);
      baseResult = {
        package: baseResult.package,
        dependencyCount: Math.floor(baseResult.dependencyCount * Math.random()),
        selfSize: Math.floor(baseResult.selfSize * Math.random()),
        dependencySize: Math.floor(baseResult.dependencySize * Math.random()),
      };
    }

    comparisonResults[result.package] = {
      package: result.package,
      dependencyCount: result.dependencyCount - baseResult.dependencyCount,
      selfSize: result.selfSize - baseResult.selfSize,
      dependencySize: result.dependencySize - baseResult.dependencySize,
    };
  }
  console.log(picocolors.green('Done comparing results'));
  return comparisonResults;
};

const filterResultsByThresholds = ({
  currentResults,
  comparisonResults,
}: {
  currentResults: ResultMap;
  comparisonResults: ResultMap;
}) => {
  const filteredResults: Partial<ResultMap> = {};
  for (const comparisonResult of Object.values(comparisonResults)) {
    const currentResult = currentResults[comparisonResult.package];

    const exceedsThresholds =
      Math.abs(comparisonResult.selfSize) > Thresholds.SELF_SIZE_ABSOLUTE ||
      Math.abs(comparisonResult.selfSize) / currentResult.selfSize > Thresholds.SELF_SIZE_RATIO ||
      Math.abs(comparisonResult.dependencySize) > Thresholds.DEPS_SIZE_ABSOLUTE ||
      Math.abs(comparisonResult.dependencySize) / currentResult.dependencySize >
        Thresholds.DEPS_SIZE_RATIO ||
      Math.abs(comparisonResult.dependencyCount) > Thresholds.DEPS_COUNT_ABSOLUTE;

    if (exceedsThresholds) {
      filteredResults[comparisonResult.package] = comparisonResult;
    }
  }

  const amountAboveThreshold = Object.keys(filteredResults).length;
  const color = amountAboveThreshold === 0 ? picocolors.green : picocolors.red;
  console.log(color(`${amountAboveThreshold} packages exceeded the thresholds`));

  return filteredResults;
};

const uploadToBigQuery = async (results: ResultMap) => {
  console.log('Uploading results to BigQuery...');
  const commonFields = {
    branch:
      process.env.CIRCLE_BRANCH ||
      (await x('git', 'rev-parse --abbrev-ref HEAD'.split(' '))).stdout.trim(),
    commit: process.env.CIRCLE_SHA1 || (await x('git', 'rev-parse HEAD'.split(' '))).stdout.trim(),
    benchmarkedAt: new Date(),
  };
  const rows = Object.values(results).map((result) => ({
    ...commonFields,
    package: result.package,
    selfSize: result.selfSize,
    dependencySize: result.dependencySize,
    dependencyCount: result.dependencyCount,
  }));

  await bigQueryBenchTable.insert(rows);
};

const uploadToGithub = async ({
  results,
  pullRequest,
}: {
  results: Partial<ResultMap>;
  pullRequest: number;
}) => {
  if (Object.keys(results).length === 0) {
    console.log('No results to upload to GitHub, skipping.');
    return;
  }

  console.log('Uploading results to GitHub...');
  const response = await fetch('https://storybook-benchmark-bot.vercel.app/package-bench', {
    method: 'POST',
    body: JSON.stringify({
      owner: 'storybookjs',
      repo: 'storybook',
      issueNumber: pullRequest,
      results,
    }),
  });
  if (response.status < 200 || response.status >= 400) {
    const body = await response.text();
    throw new Error(`Failed to upload results to GitHub.
      STATUS: ${response.status} - ${response.statusText}
      BODY:
      ${body}`);
  }
};

const run = async () => {
  program
    .option(
      '-b, --baseBranch <string>',
      'The base branch to compare the results with. Requires GCP_CREDENTIALS env var'
    )
    .option(
      '-p, --pull-request <number>',
      'The PR number to add compare results to. Only used together with --baseBranch',
      function parseInt(value) {
        const parsedValue = Number.parseInt(value);
        if (Number.isNaN(parsedValue)) {
          throw new InvalidArgumentError('Must be a number');
        }
        return parsedValue;
      }
    )
    .option('-u, --upload', 'Upload results to BigQuery. Requires GCP_CREDENTIALS env var')
    .argument(
      '[packages...]',
      'which packages to bench. If omitted, all packages are benched',
      function parsePackages(value) {
        const parsedValue = value.split(' ');
        parsedValue.forEach((packageName) => {
          if (!Object.keys(versions).includes(packageName)) {
            throw new InvalidArgumentError(`Package '${packageName}' not found in the monorepo`);
          }
        });
        return parsedValue;
      }
    );
  program.parse(process.argv);

  const packages = (
    program.args.length > 0 ? program.args : Object.keys(versions)
  ) as PackageName[];
  const options = program.opts<{ pullRequest?: number; baseBranch?: string; upload?: boolean }>();

  if (options.upload || options.baseBranch) {
    if (!GCP_CREDENTIALS.project_id) {
      throw new Error(
        'GCP_CREDENTIALS env var is required to upload to BigQuery or compare against a base branch'
      );
    }
  }

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
      `Benching status: ${picocolors.red(limit.pendingCount)} pending, ${picocolors.yellow(limit.activeCount)} running, ${picocolors.green(doneCount)} done...`
    );
  }, 2_000);
  const resultsArray = await Promise.all(
    packages.map((packageName) => limit(() => benchPackage(packageName)))
  );
  const results = resultsArray.reduce((acc, result) => {
    acc[result.package] = result;
    return acc;
  }, {} as ResultMap);
  await saveLocally({
    filename: `results.json`,
    results,
  });
  if (options.upload) {
    await uploadToBigQuery(results);
  }

  if (options.baseBranch) {
    const comparisonResults = await compareResults({ results, baseBranch: options.baseBranch });
    await saveLocally({
      filename: `compare-with-${options.baseBranch}.json`,
      results: comparisonResults,
      diff: true,
    });
    const resultsAboveThreshold = filterResultsByThresholds({
      currentResults: results,
      comparisonResults,
    });
    await saveLocally({
      filename: `comparisons-above-threshold-with-${options.baseBranch}.json`,
      results: resultsAboveThreshold,
      diff: true,
    });
    if (options.pullRequest) {
      await uploadToGithub({ results: resultsAboveThreshold, pullRequest: options.pullRequest });
    }
  }

  console.log(picocolors.green('Done benching all packages'));
  registryController?.abort();
};

if (esMain(import.meta.url)) {
  run().catch((err) => {
    registryController?.abort();
    console.error(err);
    process.exit(1);
  });
}
