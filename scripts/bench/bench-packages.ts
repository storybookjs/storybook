import { BigQuery } from '@google-cloud/bigquery';
import { InvalidArgumentError, program } from 'commander';
import detectFreePort from 'detect-port';
import { mkdir, readdir, rm, stat, writeFile } from 'fs/promises';
import pLimit from 'p-limit';
import { join } from 'path';
import picocolors from 'picocolors';
import { x } from 'tinyexec';
import dedent from 'ts-dedent';

import versions from '../../code/core/src/common/versions';
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
type ComparisonResult = {
  package: PackageName;
  dependencyCount: {
    base: number;
    new: number;
    diff: number;
  };
  selfSize: {
    base: number;
    new: number;
    diff: number;
  };
  dependencySize: {
    base: number;
    new: number;
    diff: number;
  };
};
type ResultMap = Record<PackageName, Result>;
type ComparisonResultMap = Record<PackageName, ComparisonResult>;

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
        dependencies: {
          [packageName]: versions[packageName],
        },
        // Overrides ensures that Storybook packages outside the monorepo are using the versions we have in the monorepo
        overrides: versions,
      },
      null,
      2
    )
  );

  const npmInstallResult = await x(
    'npm',
    `install --registry http://localhost:6001 --omit peer --json`.split(' '),
    {
      nodeOptions: { cwd: tmpBenchPackagePath },
    }
  );

  const { added } = JSON.parse(npmInstallResult.stdout) as { added: number };
  // -1 of reported packages added because we shouldn't count the actual package as a dependency
  const dependencyCount = added - 1;

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

const toHumanReadable = (result: Partial<Result> | Partial<ComparisonResult>) => {
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
    if (diff && bytes > 0) {
      return `+${formattedSize}`;
    }
    return formattedSize;
  };

  if (typeof result.dependencyCount === 'number') {
    const { dependencyCount, selfSize, dependencySize } = result as Result;
    return {
      package: result.package,
      dependencyCount: dependencyCount.toString(),
      selfSize: formatBytes(selfSize),
      dependencySize: formatBytes(dependencySize),
      totalSize: formatBytes(selfSize + dependencySize),
    };
  }
  const { dependencyCount, selfSize, dependencySize } = result as ComparisonResult;

  return {
    package: result.package,
    dependencyCount: {
      base: dependencyCount.base.toString(),
      new: dependencyCount.new.toString(),
      diff: `${dependencyCount.diff > 0 ? '+' : dependencyCount.diff < 0 ? '-' : ''}${dependencyCount.diff}`,
    },
    selfSize: {
      base: formatBytes(selfSize.base),
      new: formatBytes(selfSize.new),
      diff: formatBytes(selfSize.diff, true),
    },
    dependencySize: {
      base: formatBytes(dependencySize.base),
      new: formatBytes(dependencySize.new),
      diff: formatBytes(dependencySize.diff, true),
    },
    totalSize: {
      base: formatBytes(selfSize.base + dependencySize.base),
      new: formatBytes(selfSize.new + dependencySize.new),
      diff: formatBytes(selfSize.diff + dependencySize.diff, true),
    },
  };
};

const saveLocally = async ({
  results,
  filename,
}: {
  results: Partial<ResultMap | ComparisonResultMap>;
  filename: string;
  diff?: boolean;
}) => {
  const resultPath = join(BENCH_PACKAGES_PATH, filename);
  console.log(`Saving results to ${picocolors.magenta(resultPath)}...`);

  const humanReadableResults = Object.entries(results).reduce(
    (acc, [packageName, result]) => {
      acc[packageName as PackageName] = toHumanReadable(result);
      return acc;
    },
    {} as Record<PackageName, ReturnType<typeof toHumanReadable>>
  );
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

  const comparisonResults = {} as ComparisonResultMap;
  for (const result of Object.values(results)) {
    let baseResult = baseResults.find((row) => row.package === result.package);
    if (!baseResult) {
      console.warn(
        `No base result found for ${picocolors.blue(result.package)}, comparing with zero values.`
      );
      baseResult = {
        package: result.package,
        dependencyCount: 0,
        selfSize: 0,
        dependencySize: 0,
      };
    }

    comparisonResults[result.package] = {
      package: result.package,
      dependencyCount: {
        base: baseResult.dependencyCount,
        new: result.dependencyCount,
        diff: result.dependencyCount - baseResult.dependencyCount,
      },
      selfSize: {
        base: baseResult.selfSize,
        new: result.selfSize,
        diff: result.selfSize - baseResult.selfSize,
      },
      dependencySize: {
        base: baseResult.dependencySize,
        new: result.dependencySize,
        diff: result.dependencySize - baseResult.dependencySize,
      },
    };
  }
  console.log(picocolors.green('Done comparing results'));
  return comparisonResults;
};

const filterResultsByThresholds = (comparisonResults: ComparisonResultMap) => {
  const filteredResults: Partial<ComparisonResultMap> = {};
  for (const comparisonResult of Object.values(comparisonResults)) {
    const exceedsThresholds =
      Math.abs(comparisonResult.selfSize.diff) > Thresholds.SELF_SIZE_ABSOLUTE ||
      Math.abs(comparisonResult.selfSize.diff) / comparisonResult.selfSize.base >
        Thresholds.SELF_SIZE_RATIO ||
      Math.abs(comparisonResult.dependencySize.diff) > Thresholds.DEPS_SIZE_ABSOLUTE ||
      Math.abs(comparisonResult.dependencySize.diff) / comparisonResult.dependencySize.base >
        Thresholds.DEPS_SIZE_RATIO ||
      Math.abs(comparisonResult.dependencyCount.diff) > Thresholds.DEPS_COUNT_ABSOLUTE;

    if (exceedsThresholds) {
      filteredResults[comparisonResult.package] = comparisonResult;
    }
  }

  const amountAboveThreshold = Object.keys(filteredResults).length;
  const color = amountAboveThreshold === 0 ? picocolors.green : picocolors.red;
  console.log(color(`${amountAboveThreshold} packages exceeded the thresholds`));

  return filteredResults;
};

const uploadToBigQuery = async ({
  results,
  branch,
  commit,
  benchmarkedAt,
}: {
  results: ResultMap;
  branch: string;
  commit: string;
  benchmarkedAt: Date;
}) => {
  console.log('Uploading results to BigQuery...');
  const rows = Object.values(results).map((result) => ({
    branch,
    commit,
    benchmarkedAt,
    package: result.package,
    selfSize: result.selfSize,
    dependencySize: result.dependencySize,
    dependencyCount: result.dependencyCount,
  }));

  await bigQueryBenchTable.insert(rows);
};

const uploadToGithub = async ({
  results,
  headBranch,
  baseBranch,
  commit,
  benchmarkedAt,
  pullRequest,
}: {
  results: Partial<ComparisonResultMap>;
  headBranch: string;
  baseBranch: string;
  commit: string;
  benchmarkedAt: Date;
  pullRequest: number;
}) => {
  console.log('Uploading results to GitHub...');
  // const response = await fetch('http://localhost:3000/package-bench', {
  const response = await fetch('https://storybook-benchmark-bot.vercel.app/package-bench', {
    method: 'POST',
    body: JSON.stringify({
      owner: 'storybookjs',
      repo: 'storybook',
      issueNumber: pullRequest,
      headBranch,
      baseBranch,
      commit,
      benchmarkedAt: benchmarkedAt.toISOString(),
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

  const packageNames = (
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
    throw new Error(dedent`The local verdaccio registry must be running in the background for package benching to work,
      and packages must be published to it in --no-link mode with 'yarn --task publish --no-link'
      Then run the registry with 'yarn --task run-registry --no-link'`);
  }

  // The amount of VCPUs for this task in CI is 2 (medium resource)
  const amountOfVCPUs = 2;
  const concurrentLimit = process.env.CI ? amountOfVCPUs - 1 : maxConcurrentTasks;
  const limit = pLimit(concurrentLimit);

  const progressIntervalId = setInterval(() => {
    const doneCount = packageNames.length - limit.activeCount - limit.pendingCount;
    if (doneCount === packageNames.length) {
      clearInterval(progressIntervalId);
      return;
    }
    console.log(
      `Benching status: ${picocolors.red(limit.pendingCount)} pending, ${picocolors.yellow(limit.activeCount)} running, ${picocolors.green(doneCount)} done...`
    );
  }, 2_000);
  const resultsArray = await Promise.all(
    packageNames.map((packageName) => limit(() => benchPackage(packageName)))
  );
  const results = resultsArray.reduce((acc, result) => {
    acc[result.package] = result;
    return acc;
  }, {} as ResultMap);
  await saveLocally({
    filename: `results.json`,
    results,
  });

  const headBranch =
    process.env.CIRCLE_BRANCH ||
    (await x('git', 'rev-parse --abbrev-ref HEAD'.split(' '))).stdout.trim();
  const commit =
    process.env.CIRCLE_SHA1 || (await x('git', 'rev-parse HEAD'.split(' '))).stdout.trim();
  const benchmarkedAt = new Date();

  if (options.upload) {
    await uploadToBigQuery({ results, branch: headBranch, commit, benchmarkedAt });
  }

  if (options.baseBranch) {
    const comparisonResults = await compareResults({ results, baseBranch: options.baseBranch });
    const resultsAboveThreshold = filterResultsByThresholds(comparisonResults);
    await saveLocally({
      filename: `compare-with-${options.baseBranch}.json`,
      results: comparisonResults,
      diff: true,
    });
    await saveLocally({
      filename: `comparisons-above-threshold-with-${options.baseBranch}.json`,
      results: resultsAboveThreshold,
      diff: true,
    });
    if (options.pullRequest) {
      await uploadToGithub({
        results: resultsAboveThreshold,
        pullRequest: options.pullRequest,
        baseBranch: options.baseBranch,
        headBranch,
        commit,
        benchmarkedAt,
      });
    }
  }

  console.log(picocolors.green('Done benching all packages'));
};

if (esMain(import.meta.url)) {
  run().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
