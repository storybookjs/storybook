import assert from 'node:assert/strict';
import { once } from 'node:events';
import { promisify } from 'node:util';
import type { CurrentRun, StoreState, StoreEvent } from '../../code/addons/vitest/src/types.ts';
import { fork, execFile, type ChildProcess } from 'node:child_process';
import { mkdir, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Channel, type ChannelEvent } from 'storybook/internal/channels';
import {
  experimental_UniversalStore as UniversalStore,
  internal_universalStatusStore,
  internal_universalTestProviderStore,
} from 'storybook/internal/core-server';
import { loadCsf } from 'storybook/internal/csf-tools';
import { storeOptions } from '@storybook/addon-vitest/constants';

const environment = JSON.parse(await readFile('environment.json', 'utf8'));
const version = JSON.parse(await readFile('node_modules/vitest/package.json', 'utf8')).version;
assert.equal(version, environment.version);
assert.equal(process.versions.node, '22.22.3');
const configDir = resolve('.storybook');
await mkdir(configDir, { recursive: true });
await writeFile(
  '.storybook/main.js',
  `export default { stories: ['../*.stories.jsx'], addons: [], features: { experimentalTestSyntax: true }, framework: '@storybook/react-vite', core: { disableTelemetry: true } };`
);
await writeFile(
  '.storybook/preview.js',
  `import { __definePreview } from '@storybook/react'; export default __definePreview({});`
);
await writeFile(
  'Button.jsx',
  `import React from 'react';
export const unused = () => {
  return 'Uncovered';
};
export const Button = () => <button>Ready</button>;`
);
const stories = `import { Button } from './Button.jsx';
import preview from './.storybook/preview.js';
import { expect } from 'storybook/test';
const meta = preview.meta({ title: 'Compatibility', component: Button });
export const Primary = meta.story({ name: 'Primary (button)' });
Primary.test('renders [ready]', async ({ canvas }) => { await expect(canvas.getByRole('button')).toHaveTextContent('Ready'); });
Primary.test('renders [ready] again', async ({ canvas }) => { await expect(canvas.getByRole('button')).toHaveTextContent('Ready'); });
export const PrimaryMobile = meta.story({ name: 'Primary (button) Mobile', play: async ({ canvas }) => { await expect(canvas.getByRole('button')).toHaveTextContent('Ready'); } });
`;
await writeFile('Button.stories.jsx', stories);
await writeFile(
  'vitest.config.mjs',
  `import { defineConfig } from 'vitest/config';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
${version.startsWith('3.') ? '' : "import { playwright } from '@vitest/browser-playwright';"}
export default defineConfig({ test: { coverage: { provider: 'v8', include: ['Button.jsx'], watermarks: { statements: [90, 100] }, reporter: ['json-summary'], reportsDirectory: './coverage-cli' }, ${version === '3.0.0' ? 'workspace' : 'projects'}: [{ extends: true, optimizeDeps: { include: ['@storybook/react'] }, plugins: [storybookTest({ configDir: ${JSON.stringify(configDir)} })], test: { name: 'storybook', browser: { enabled: true, headless: true, provider: ${version.startsWith('3.') ? "'playwright'" : 'playwright()'}, instances: [{ browser: 'chromium' }] } } }] } });`
);
let child: ChildProcess | undefined;
const channel = new Channel({ async: true });
UniversalStore.__prepare(channel, UniversalStore.Environment.SERVER);
const inputs = loadCsf(stories, {
  fileName: resolve('Button.stories.jsx'),
  makeTitle: (title) => title,
}).parse().indexInputs;
const entries = Object.fromEntries(
  inputs.map((input) => {
    assert(input.type === 'story' && input.__id && input.name && input.title);
    return [
      input.__id,
      {
        id: input.__id,
        name: input.name,
        title: input.title,
        type: 'story' as const,
        subtype: input.subtype,
        parent: input.parent,
        importPath: './Button.stories.jsx',
        tags: ['test'],
      },
    ];
  })
);
const childId = inputs.find((input) => input.name === 'renders [ready]').__id;
const store = UniversalStore.create<StoreState, StoreEvent>({
  ...storeOptions,
  leader: true,
  initialState: { ...storeOptions.initialState, index: { v: 5, entries } },
});
function bridge<State, CustomEvent extends { type: string }>(
  source: UniversalStore<State, CustomEvent>,
  id: string
) {
  source.subscribe((event, eventInfo) =>
    child?.send({ type: `UNIVERSAL_STORE:${id}`, args: [{ event, eventInfo }], from: 'server' })
  );
}
bridge(store, 'storybook/test');
bridge(internal_universalStatusStore, 'storybook/status');
bridge(internal_universalTestProviderStore, 'storybook/test-provider');
const events: StoreEvent[] = [];
store.subscribe((event) => {
  if (event.type === 'FATAL_ERROR' || event.type === 'TEST_RUN_COMPLETED') events.push(event);
});
function waitFor(predicate: () => boolean, label: string) {
  return new Promise<void>((accept, reject) => {
    const timer = setTimeout(() => {
      clearInterval(poll);
      reject(new Error(`Timeout: ${label}\n${JSON.stringify(events.slice(-5))}`));
    }, 90000);
    const poll = setInterval(() => {
      const fatal = events.find((event) => event.type === 'FATAL_ERROR');
      if (fatal || predicate()) {
        clearTimeout(timer);
        clearInterval(poll);
        if (fatal) reject(new Error(JSON.stringify(fatal)));
        else accept();
      }
    }, 50);
  });
}
let ready = false;
await rm('native-coverage', { recursive: true, force: true });
try {
  child = fork(fileURLToPath(import.meta.resolve('@storybook/addon-vitest/vitest')), [], {
    env: {
      ...process.env,
      VITEST: 'true',
      TEST: 'true',
      VITEST_CHILD_PROCESS: 'true',
      STORYBOOK_DISABLE_TELEMETRY: '1',
      STORYBOOK_CONFIG_DIR: configDir,
      NODE_V8_COVERAGE: resolve('native-coverage'),
    },
    stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
  });
  child.on('message', (message) => {
    const event = message as ChannelEvent & {
      payload: Extract<StoreEvent, { type: 'FATAL_ERROR' }>['payload'];
    };
    if (event.type === 'ready') ready = true;
    else if (event.type === 'uncaught-error')
      events.push({ type: 'FATAL_ERROR', payload: event.payload });
    else channel.receive(event);
  });
  await waitFor(() => ready, 'backend startup');
  assert.equal(events.filter((event) => event.type === 'TEST_RUN_COMPLETED').length, 0);
  const results: CurrentRun[] = [];
  async function run(storyIds?: string[], coverage = false) {
    const before = events.length;
    store.send({
      type: 'TRIGGER_RUN',
      payload: { storyIds, triggeredBy: 'run-all', configOverride: { coverage, a11y: false } },
    });
    await waitFor(
      () => events.slice(before).some((event) => event.type === 'TEST_RUN_COMPLETED'),
      'test completion'
    );
    const result = events
      .slice(before)
      .find((event) => event.type === 'TEST_RUN_COMPLETED')!.payload;
    assert.deepEqual(result.unhandledErrors, []);
    assert.equal(result.componentTestCount.error, 0);
    results.push(result);
    return result;
  }
  assert.equal((await run()).componentTestCount.success, 4);
  const selected = await run([childId]);
  assert.equal(selected.componentTestCount.success, 1);
  assert.equal(selected.totalTestCount, 1);
  assert.equal((await run(['compatibility--primary'])).componentTestCount.success, 3);
  const covered = await run(undefined, true);
  assert(covered.coverageSummary);
  assert(covered.coverageSummary.percentage > 0 && covered.coverageSummary.percentage < 90);
  assert.equal(covered.coverageSummary.status, 'negative');
  assert.equal((await run()).coverageSummary, undefined);
  store.setState((state) => ({ ...state, watching: true }));
  const before = events.length;
  await writeFile(
    'Button.jsx',
    `import React from 'react';
export const unused = () => {
  return 'Uncovered';
};
export const Button = () => <button>Changed</button>;`
  );
  await waitFor(
    () =>
      events
        .slice(before)
        .some(
          (event) =>
            event.type === 'TEST_RUN_COMPLETED' && event.payload.componentTestCount.error === 3
        ),
    'watch failure'
  );
  const failed = events.length;
  await writeFile(
    'Button.jsx',
    `import React from 'react';
export const unused = () => {
  return 'Uncovered';
};
export const Button = () => <button>Ready</button>;`
  );
  await waitFor(
    () =>
      events
        .slice(failed)
        .some(
          (event) =>
            event.type === 'TEST_RUN_COMPLETED' && event.payload.componentTestCount.success === 4
        ),
    'watch recovery'
  );
  await writeFile('results.json', JSON.stringify({ environment, results, events }, null, 2));
  process.stdout.write(
    `PASS Vitest ${version}: startup, filtering, coverage off/on/off, watch pass/fail/pass\n`
  );
} finally {
  if (child) {
    const exited = once(child, 'exit');
    child.kill('SIGTERM');
    await exited;
  }
  channel.removeAllListeners();
}

type ScriptCoverage = {
  url: string;
  functions: {
    functionName: string;
    ranges: { startOffset: number; endOffset: number; count: number }[];
  }[];
};
const nativeCoverage: { result: ScriptCoverage[] }[] = await Promise.all(
  (await readdir('native-coverage')).map(async (file) =>
    JSON.parse(await readFile(resolve('native-coverage', file), 'utf8'))
  )
);
const api = version.startsWith('5.') ? 'standalone' : 'init';
if (version.startsWith('5.')) {
  for (const script of nativeCoverage
    .flatMap((coverage) => coverage.result)
    .filter((script) => script.url.includes('/vitest/dist/'))) {
    const source = await readFile(fileURLToPath(script.url), 'utf8');
    for (const fn of script.functions.filter((fn) => fn.functionName === 'init')) {
      const range = fn.ranges[0];
      if (
        source.slice(range.startOffset, range.endOffset).includes('`vitest.init()` is deprecated.')
      ) {
        assert.equal(range.count, 0, 'Deprecated Vitest.init() was called');
      }
    }
  }
}

const executions = nativeCoverage
  .flatMap((coverage) => coverage.result)
  .filter((script) => script.url.includes('/vitest/dist/'))
  .flatMap((script) =>
    script.functions
      .filter((fn) => fn.functionName === api && fn.ranges[0].count === 3)
      .map((fn) => ({ url: script.url, ...fn }))
  );
assert.equal(
  executions.length,
  1,
  `Expected three real ${api} calls: initial startup and two coverage restarts`
);
await writeFile('lifecycle.json', JSON.stringify(executions, null, 2));
await promisify(execFile)(
  process.execPath,
  ['node_modules/vitest/vitest.mjs', 'run', '--project=storybook', '--coverage'],
  { timeout: 90000, maxBuffer: 10 * 1024 * 1024 }
);
const summary = JSON.parse(await readFile('coverage-cli/coverage-summary.json', 'utf8'));
assert(summary.total.statements.total > 0);
const results = JSON.parse(await readFile('results.json', 'utf8'));
const coveredRun = results.results.find((run: CurrentRun) => run.coverageSummary);
assert.equal(Math.round(summary.total.statements.pct), coveredRun.coverageSummary.percentage);
process.stdout.write(`PASS Vitest ${version}: CLI coverage and real ${api} execution evidence\n`);
