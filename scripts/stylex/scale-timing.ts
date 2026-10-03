/**
 * Times a Vite Storybook with many StyleX components (STO-85 AC3).
 *
 * Generates `--count` StyleX components with one story each, plus a themed story, into a StyleX
 * sandbox, starts `storybook dev` with a cold cache `--runs` times, and measures how long the
 * first, the last and the themed story take to render styled. The generated files are always
 * removed afterwards, so they never reach a Chromatic build.
 *
 * Usage: yarn --cwd scripts jiti stylex/scale-timing.ts --count 250 --runs 3
 */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

// eslint-disable-next-line depend/ban-dependencies
import { execa } from 'execa';
import { chromium } from 'playwright';

import type { types as t } from '../../code/core/src/babel/index.ts';
import { babelParse, generate } from '../../code/core/src/babel/index.ts';
import { writeConfig } from '../../code/core/src/csf-tools/index.ts';
import { SANDBOX_DIRECTORY } from '../utils/constants.ts';
import { readConfig } from '../utils/main-js.ts';

const FIXTURE_DIRECTORY = join('src', 'stylex-scale');
const PRIMARY = { hex: '#0f766e', rgb: 'rgb(15, 118, 110)' };
const THEMED_PRIMARY = { hex: '#b45309', rgb: 'rgb(180, 83, 9)' };
const RENDER_TIMEOUT = 30_000;

/** The generated files, by path relative to the sandbox. */
export function generateScaleFixture(count: number): Record<string, string> {
  const files: Record<string, string> = {
    'tokens.stylex.ts': `import * as stylex from '@stylexjs/stylex';

export const colors = stylex.defineVars({ primary: '${PRIMARY.hex}', bg: '#f0fdfa' });
`,
    'themes.ts': `import * as stylex from '@stylexjs/stylex';

import { colors } from './tokens.stylex';

export const warm = stylex.createTheme(colors, { primary: '${THEMED_PRIMARY.hex}', bg: '#fffbeb' });
`,
    'Themed.stories.tsx': `import React from 'react';

import * as stylex from '@stylexjs/stylex';

import { C1 } from './C1';
import { warm } from './themes';

export default { title: 'StyleXScale/Themed', component: C1 };

export const Default = {
  decorators: [
    (Story: React.ComponentType) => (
      <div {...stylex.props(warm)}>
        <Story />
      </div>
    ),
  ],
};
`,
  };

  for (let i = 1; i <= count; i++) {
    files[`C${i}.tsx`] = `import React from 'react';

import * as stylex from '@stylexjs/stylex';

import { colors } from './tokens.stylex';

const styles = stylex.create({
  root: { color: colors.primary, backgroundColor: colors.bg, padding: ${i}, borderRadius: 4 },
});

export const C${i} = () => <div data-testid="scale" {...stylex.props(styles.root)}>Component ${i}</div>;
`;
    files[`C${i}.stories.tsx`] = `import { C${i} } from './C${i}';

export default { title: 'StyleXScale/C${i}', component: C${i} };

export const Default = {};
`;
  }

  return Object.fromEntries(
    Object.entries(files).map(([name, source]) => [join(FIXTURE_DIRECTORY, name), source])
  );
}

type Probe = { name: string; storyId: string; color: string; padding: string };
type ProbeResult = Probe & {
  ms: number;
  styled: boolean;
  actual: { color: string; padding: string };
};

async function getFreePort() {
  return new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
  });
}

async function waitForServer(url: string, timeout: number) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      if ((await fetch(url)).ok) {
        return;
      }
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Storybook did not start within ${timeout} ms`);
}

/** Wraps `viteFinal` in the sandbox's main config to set `optimizeDeps.holdUntilCrawlEnd`. */
async function setHoldUntilCrawlEnd(sandboxDir: string, value: boolean) {
  const mainConfig = await readConfig({ fileName: 'main', cwd: sandboxDir });
  const original = await readFile(mainConfig.fileName!, 'utf8');
  const existing = mainConfig.getFieldNode(['viteFinal']);
  const existingCode = existing ? generate(existing).code : '(config) => config';
  const viteFinal = babelParse(`(async (config, options) => {
    const finalConfig = await (${existingCode})(config, options);
    return {
      ...finalConfig,
      optimizeDeps: { ...finalConfig.optimizeDeps, holdUntilCrawlEnd: ${value} },
    };
  })`).program.body[0] as t.ExpressionStatement;
  mainConfig.set(['viteFinal'], viteFinal.expression);
  await writeConfig(mainConfig);
  return () => writeFile(mainConfig.fileName!, original);
}

async function runOnce(sandboxDir: string, probes: Probe[]) {
  await rm(join(sandboxDir, 'node_modules', '.cache'), { recursive: true, force: true });
  const port = await getFreePort();
  const start = Date.now();
  // Run the binary directly, in its own process group, so stopping it stops every child process
  const storybook = execa(
    join(sandboxDir, 'node_modules', '.bin', 'storybook'),
    ['dev', '--ci', '--port', String(port)],
    {
      cwd: sandboxDir,
      env: { NODE_ENV: 'development', STORYBOOK_DISABLE_TELEMETRY: '1' },
      detached: true,
      reject: false,
    }
  );
  const browser = await chromium.launch();
  try {
    await waitForServer(`http://localhost:${port}/index.json`, 120_000);
    const startupMs = Date.now() - start;
    const page = await browser.newPage();
    const results: ProbeResult[] = [];
    for (const probe of probes) {
      const probeStart = Date.now();
      await page.goto(`http://localhost:${port}/iframe.html?id=${probe.storyId}&viewMode=story`);
      // Wait until the story is not only rendered but styled; unplugin's dev CSS can arrive late
      const styled = await page
        .waitForFunction(
          (expected) => {
            const element = document.querySelector('[data-testid="scale"]');
            if (!element) {
              return false;
            }
            const style = getComputedStyle(element);
            return style.color === expected.color && style.padding === expected.padding;
          },
          { color: probe.color, padding: probe.padding },
          { timeout: RENDER_TIMEOUT }
        )
        .then(() => true)
        .catch(() => false);
      const ms = Date.now() - probeStart;
      const actual = await page.evaluate(() => {
        const element = document.querySelector('[data-testid="scale"]');
        return element
          ? { color: getComputedStyle(element).color, padding: getComputedStyle(element).padding }
          : { color: 'not rendered', padding: 'not rendered' };
      });
      results.push({ ...probe, ms, actual, styled });
    }
    return { startupMs, results };
  } finally {
    await browser.close();
    process.kill(-storybook.pid!, 'SIGTERM');
    await storybook;
  }
}

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

async function main() {
  const { values } = parseArgs({
    options: {
      sandbox: { type: 'string', default: join(SANDBOX_DIRECTORY, 'internal-react-vite-stylex') },
      count: { type: 'string', default: '250' },
      runs: { type: 'string', default: '3' },
      'hold-until-crawl-end': { type: 'string' },
    },
  });
  const sandboxDir = values.sandbox;
  const count = Number(values.count);
  const runs = Number(values.runs);

  const probes: Probe[] = [
    { name: 'C1', storyId: 'stylexscale-c1--default', color: PRIMARY.rgb, padding: '1px' },
    {
      name: `C${count}`,
      storyId: `stylexscale-c${count}--default`,
      color: PRIMARY.rgb,
      padding: `${count}px`,
    },
    {
      name: 'Themed',
      storyId: 'stylexscale-themed--default',
      color: THEMED_PRIMARY.rgb,
      padding: '1px',
    },
  ];

  const fixtureDir = join(sandboxDir, FIXTURE_DIRECTORY);
  let restoreMain: (() => Promise<void>) | undefined;
  const cleanUp = async () => {
    await rm(fixtureDir, { recursive: true, force: true });
    await restoreMain?.();
  };
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => cleanUp().finally(() => process.exit(1)));
  }
  const allRuns: Awaited<ReturnType<typeof runOnce>>[] = [];
  try {
    await mkdir(fixtureDir, { recursive: true });
    for (const [file, source] of Object.entries(generateScaleFixture(count))) {
      await writeFile(join(sandboxDir, file), source);
    }
    if (values['hold-until-crawl-end'] !== undefined) {
      restoreMain = await setHoldUntilCrawlEnd(
        sandboxDir,
        values['hold-until-crawl-end'] === 'true'
      );
    }
    for (let run = 1; run <= runs; run++) {
      console.error(`Run ${run}/${runs}…`);
      allRuns.push(await runOnce(sandboxDir, probes));
    }
  } finally {
    await cleanUp();
  }

  const { stdout: viteVersion } = await execa(
    'node',
    ['-p', "require('vite/package.json').version"],
    {
      cwd: sandboxDir,
    }
  );
  const header = `${count} StyleX components, Vite ${viteVersion}, holdUntilCrawlEnd: ${
    values['hold-until-crawl-end'] ?? 'default (true)'
  }, cold cache\n\n`;
  const table = [
    `| Run | Dev server ready | ${probes.map((p) => p.name).join(' | ')} | All styled |`,
    `| --- | --- | ${probes.map(() => '---').join(' | ')} | --- |`,
    ...allRuns.map(
      ({ startupMs, results }, i) =>
        `| ${i + 1} | ${seconds(startupMs)} | ${results.map((r) => seconds(r.ms)).join(' | ')} | ${
          results.every((r) => r.styled) ? 'yes' : 'no'
        } |`
    ),
  ].join('\n');
  console.log(header + table);
  await writeFile(
    join(sandboxDir, 'scale-timing.json'),
    JSON.stringify(
      { count, viteVersion, holdUntilCrawlEnd: values['hold-until-crawl-end'], runs: allRuns },
      null,
      2
    )
  );

  const failed = allRuns.some(({ results }) =>
    results.some((r) => !r.styled || r.ms >= RENDER_TIMEOUT)
  );
  process.exit(failed ? 1 : 0);
}

if (process.argv[1]?.endsWith('scale-timing.ts')) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
