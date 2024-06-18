import { join } from 'path';
import { BigQuery } from '@google-cloud/bigquery';

import { execaCommand } from 'execa';
import type { BenchResults } from './bench/types';
import { loadBench } from './bench/utils';
import { SANDBOX_DIRECTORY } from './utils/constants';

const templateKey = process.argv[2];

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
    branch:
      process.env.CIRCLE_BRANCH ||
      (await execaCommand('git rev-parse --abbrev-ref HEAD', { cleanup: true })).stdout,
    commit:
      process.env.CIRCLE_SHA1 ||
      (await execaCommand('git rev-parse HEAD', { cleanup: true })).stdout,
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

  await appTable.insert([row]);
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
