import { BigQuery } from '@google-cloud/bigquery';
// eslint-disable-next-line depend/ban-dependencies
import { execaCommand } from 'execa';
import { join } from 'path';

import type { BenchResults } from './bench/types';
import { loadBench } from './bench/utils';
import { SANDBOX_DIRECTORY } from './utils/constants';

const templateKey = process.argv[2];
const prNumber = process.argv[3];
const baseBranch = process.argv[4];

const GCP_CREDENTIALS = JSON.parse(process.env.GCP_CREDENTIALS || '{}');
const sandboxDir = process.env.SANDBOX_ROOT || SANDBOX_DIRECTORY;
const templateSandboxDir = templateKey && join(sandboxDir, templateKey.replace('/', '-'));

const defaults: Record<keyof BenchResults, null> = {
  branch: null,
  commit: null,
  timestamp: null,
  label: null,

  createTime: null,
  generateTime: null,
  initTime: null,
  createSize: null,
  generateSize: null,
  initSize: null,
  diffSize: null,
  buildTime: null,
  buildSize: null,
  buildSbAddonsSize: null,
  buildSbCommonSize: null,
  buildSbManagerSize: null,
  buildSbPreviewSize: null,
  buildStaticSize: null,
  buildPrebuildSize: null,
  buildPreviewSize: null,
  testBuildTime: null,
  testBuildSize: null,
  testBuildSbAddonsSize: null,
  testBuildSbCommonSize: null,
  testBuildSbManagerSize: null,
  testBuildSbPreviewSize: null,
  testBuildStaticSize: null,
  testBuildPrebuildSize: null,
  testBuildPreviewSize: null,
  devPreviewResponsive: null,
  devManagerResponsive: null,
  devManagerHeaderVisible: null,
  devManagerIndexVisible: null,
  devStoryVisible: null,
  devStoryVisibleUncached: null,
  devAutodocsVisible: null,
  devMDXVisible: null,
  buildManagerHeaderVisible: null,
  buildManagerIndexVisible: null,
  buildAutodocsVisible: null,
  buildStoryVisible: null,
  buildMDXVisible: null,
};

const uploadBench = async () => {
  const results = await loadBench({ rootDir: templateSandboxDir });

  const row = {
    ...defaults,
    branch: await getBranchName(),
    commit: await getCommitHash(),
    timestamp: new Date().toISOString(),
    label: templateKey,
    ...results,
  } as BenchResults;

  const store = new BigQuery({
    projectId: GCP_CREDENTIALS.project_id,
    credentials: GCP_CREDENTIALS,
  });
  const dataset = store.dataset('benchmark_results');
  const appTable = dataset.table('bench2');

  async function uploadToGithub() {
    if (
      !prNumber ||
      !baseBranch ||
      prNumber === '0' ||
      templateKey !== 'bench/react-vite-default-ts'
    ) {
      console.log('skip uploading results to github');
      return;
    }
    const [base]: any[] = await appTable.query({
      query: `SELECT * FROM \`storybook-benchmark.benchmark_results.bench2\` WHERE branch=@baseBranch AND label=@templateKey ORDER BY timestamp DESC LIMIT 20;`,
      params: { baseBranch, templateKey },
    });

    return prNumber && prNumber !== '0'
      ? fetch('https://storybook-benchmark-bot.vercel.app/description', {
          method: 'POST',
          body: JSON.stringify({
            owner: 'storybookjs',
            repo: 'storybook',
            issueNumber: prNumber,
            base: base.map((b: any) => ({ ...defaults, ...b })),
            head: row,
          }),
        })
      : Promise.resolve();
  }

  function uploadToBigQuery() {
    return appTable.insert([row]);
  }

  await Promise.all([uploadToGithub(), uploadToBigQuery()]);
};

uploadBench()
  .catch((err) => {
    console.error(err);
    if (err.errors) {
      err.errors.forEach((elt: any) => {
        console.log(elt);
      });
    }
    process.exit(1);
  })
  .then(() => {
    console.log('done');
  });

async function getCommitHash(): Promise<string> {
  return (
    process.env.CIRCLE_SHA1 || (await execaCommand('git rev-parse HEAD', { cleanup: true })).stdout
  );
}

async function getBranchName(): Promise<string> {
  return (
    process.env.CIRCLE_BRANCH ||
    (await execaCommand('git rev-parse --abbrev-ref HEAD', { cleanup: true })).stdout
  );
}
