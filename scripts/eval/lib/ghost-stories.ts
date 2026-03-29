/**
 * Ghost stories: discover component candidates and run vitest-based
 * ghost story tests to measure how many components render successfully.
 *
 * Self-contained — does not import from code/core. Uses the same vitest
 * + STORYBOOK_COMPONENT_PATHS approach that core-server uses internally,
 * but decoupled so eval has no cross-package source imports.
 */

import { existsSync } from "node:fs";
import { glob, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { x } from "tinyexec";

const COMPONENT_GLOB = "**/*.{tsx,jsx}";
const IGNORE_PATTERNS = [
  "**/node_modules/**",
  "**/.git/**",
  "**/dist/**",
  "**/__mocks__/**",
  "**/build/**",
  "**/storybook-static/**",
  "**/*.test.*",
  "**/*.spec.*",
  "**/*.stories.*",
  "**/*.story.*",
  "**/*.d.*",
  "**/*.config.*",
  "**/stories/{Button,Header,Page}.*",
  "**/stories/{button,header,page}.*",
];

/**
 * Find component files that are candidates for ghost story testing.
 * Uses glob-based discovery — sufficient for eval grading purposes.
 */
export async function findComponentCandidates(opts: {
  cwd: string;
  sampleSize?: number;
}): Promise<{ candidates: string[]; error?: string }> {
  const { cwd, sampleSize = 20 } = opts;
  try {
    const files = await Array.fromAsync(glob(COMPONENT_GLOB, {
      cwd,
      exclude: IGNORE_PATTERNS,
    }));
    return { candidates: files.map((file) => resolve(cwd, file)).slice(0, sampleSize) };
  } catch {
    return { candidates: [], error: "Failed to find component candidates" };
  }
}

export interface GhostStoryOutput {
  total: number;
  passed: number;
  successRate: number;
  runError?: string;
}

/**
 * Run ghost stories by executing vitest with STORYBOOK_COMPONENT_PATHS.
 *
 * The storybook vitest plugin auto-generates and tests stories for the
 * specified component files. Non-zero exit from vitest is expected when
 * some stories fail — we parse the JSON report for actual results.
 */
export async function runGhostStories(
  candidates: string[],
  opts: { cwd: string },
): Promise<GhostStoryOutput> {
  const outputFile = join(tmpdir(), `ghost-stories-${Date.now()}.json`);

  const result = await x("npx", [
    "vitest", "run",
    "--reporter=json",
    "--testTimeout=1000",
    `--outputFile=${outputFile}`,
    ...candidates,
  ], {
    throwOnError: false,
    timeout: 300_000,
    nodeOptions: {
      cwd: opts.cwd,
      env: {
        ...process.env,
        STORYBOOK_COMPONENT_PATHS: candidates.join(";"),
      },
    },
  });

  const stderr = (result.stderr ?? "").toLowerCase();
  if (stderr.includes("browsertype.launch")) {
    return { total: 0, passed: 0, successRate: 0, runError: "Playwright not installed" };
  }
  if (stderr.includes("no tests found")) {
    return { total: 0, passed: 0, successRate: 0, runError: "No tests found" };
  }

  if (!existsSync(outputFile)) {
    return { total: 0, passed: 0, successRate: 0, runError: "JSON report not found" };
  }

  try {
    const report = JSON.parse(await readFile(outputFile, "utf-8"));
    if (!report.testResults?.length) {
      return { total: 0, passed: 0, successRate: 0, runError: "No test results in report" };
    }
    const total: number = report.numTotalTests ?? 0;
    const passed: number = report.numPassedTests ?? 0;
    const successRate = total > 0 ? parseFloat((passed / total).toFixed(2)) : 0;
    return { total, passed, successRate };
  } catch {
    return { total: 0, passed: 0, successRate: 0, runError: "Failed to parse vitest report" };
  }
}
