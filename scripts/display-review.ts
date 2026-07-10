import { readFile } from 'node:fs/promises';
import process from 'node:process';

import { program } from 'commander';

import { esMain } from './utils/esmain.ts';

const DEFAULT_STORYBOOK_URL = process.env.STORYBOOK_URL ?? 'http://localhost:6006';
const MCP_PATH = '/mcp';
const REQUEST_TIMEOUT_MS = 15_000;

interface StoryIndexEntry {
  id: string;
  name: string;
  title: string;
  importPath: string;
}

interface StoryIndex {
  entries: Record<string, StoryIndexEntry>;
}

interface ReviewCollection {
  title: string;
  rationale: string;
  storyIds: string[];
}

interface ReviewPayload {
  title: string;
  description: string;
  collections: ReviewCollection[];
  changedFiles?: string[];
}

const BADGE_COMPONENT_IMPORT_PATHS = ['./core/src/components/components/Badge/Badge.stories.tsx'];

const STATUS_BADGE_IMPORT_PATHS = [
  './core/src/component-testing/components/StatusBadge.stories.tsx',
];

/** Story files that render Badge directly, with the exports that actually show it. */
const BADGE_DIRECT_USAGE: Array<{ importPaths: string[]; storyNames: string[] }> = [
  {
    importPaths: ['./core/src/components/components/ActionList/ActionList.stories.tsx'],
    storyNames: ['Default'],
  },
  {
    importPaths: ['./core/src/manager/components/panel/Panel.stories.tsx'],
    storyNames: ['JSX Titles'],
  },
];

/** Manager surfaces where Badge appears in sidebar, filters, or error UI. */
const BADGE_MANAGER_SURFACES: Array<{ importPaths: string[]; storyNames: string[] }> = [
  {
    importPaths: ['./core/src/manager/components/sidebar/Filter.stories.tsx'],
    storyNames: ['With Selection'],
  },
  {
    importPaths: ['./core/src/manager/components/sidebar/FilterPanel.stories.tsx'],
    storyNames: ['With Statuses', 'With Statuses Included'],
  },
  {
    importPaths: ['./core/src/manager/components/error-boundary/ManagerErrorBoundary.stories.tsx'],
    storyNames: ['With Error'],
  },
];

/** Addon panels that use compact Badge for tab counts and status. */
const BADGE_ADDON_PANELS: Array<{ importPaths: string[]; storyNames: string[] }> = [
  {
    importPaths: ['./addons/a11y/src/components/A11YPanel.stories.tsx'],
    storyNames: ['Manual', 'Ready With Results'],
  },
  {
    importPaths: ['./core/src/component-testing/components/InteractionsPanel.stories.tsx'],
    storyNames: ['Passing', 'Failed'],
  },
];

/** A11y report rows where Badge marks violation impact. */
const BADGE_A11Y_REPORT: Array<{ importPaths: string[]; storyNames: string[] }> = [
  {
    importPaths: ['./addons/a11y/src/components/Report/Report.stories.tsx'],
    storyNames: ['Violations', 'Incomplete'],
  },
];

/** Review surfaces that render Badge for story status. */
const BADGE_REVIEW_SURFACES: Array<{ importPaths: string[]; storyNames: string[] }> = [
  {
    importPaths: [
      './core/src/manager/components/review/components/ReviewToolbarHeader.stories.tsx',
    ],
    storyNames: ['New Story'],
  },
];

function normalizeStorybookUrl(url: string): string {
  return url.replace(/\/$/, '');
}

async function fetchWithTimeout(input: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timed out after ${REQUEST_TIMEOUT_MS}ms: ${input}`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function parseMcpResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  const dataLine = text.split('\n').find((line) => line.startsWith('data: '));
  if (!dataLine) {
    throw new Error(`Invalid MCP response (expected SSE data line):\n${text.slice(0, 500)}`);
  }
  return JSON.parse(dataLine.replace(/^data: /, '').trim());
}

async function mcpCall(
  storybookUrl: string,
  method: string,
  params: Record<string, unknown> = {},
  id = 1
) {
  const endpoint = `${normalizeStorybookUrl(storybookUrl)}${MCP_PATH}`;
  const response = await fetchWithTimeout(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  });

  if (!response.ok) {
    throw new Error(`MCP request failed: ${response.status} ${response.statusText}`);
  }

  const payload = (await parseMcpResponse(response)) as {
    error?: { message: string };
    result?: { isError?: boolean; content?: Array<{ text?: string }>; structuredContent?: unknown };
  };

  if (payload.error) {
    throw new Error(payload.error.message);
  }
  if (payload.result?.isError) {
    throw new Error(payload.result.content?.[0]?.text ?? 'MCP tool returned an error');
  }

  return payload.result;
}

async function fetchStoryIndex(storybookUrl: string): Promise<StoryIndex> {
  const response = await fetchWithTimeout(`${normalizeStorybookUrl(storybookUrl)}/index.json`);
  if (!response.ok) {
    throw new Error(
      `Could not fetch story index from ${storybookUrl} (${response.status}). Is Storybook running?`
    );
  }
  return response.json() as Promise<StoryIndex>;
}

function storyIdsForImportPaths(
  index: StoryIndex,
  importPaths: string[],
  storyNames?: string[]
): string[] {
  const normalizedPaths = new Set(importPaths);
  const nameFilter = storyNames ? new Set(storyNames) : null;

  return Object.values(index.entries)
    .filter((entry) => normalizedPaths.has(entry.importPath))
    .filter((entry) => !nameFilter || nameFilter.has(entry.name))
    .map((entry) => entry.id)
    .sort();
}

function storyIdsForUsageSpecs(
  index: StoryIndex,
  specs: Array<{ importPaths: string[]; storyNames: string[] }>
): string[] {
  return specs.flatMap(({ importPaths, storyNames }) =>
    storyIdsForImportPaths(index, importPaths, storyNames)
  );
}

/**
 * Build a review payload for the Badge component and its known in-repo usages.
 * Story IDs are resolved from the live Storybook index so the review always
 * matches the running instance.
 */
export function buildBadgeReview(index: StoryIndex): ReviewPayload {
  const badgeStoryIds = storyIdsForImportPaths(index, BADGE_COMPONENT_IMPORT_PATHS);
  const statusBadgeStoryIds = storyIdsForImportPaths(index, STATUS_BADGE_IMPORT_PATHS);
  const directUsageStoryIds = storyIdsForUsageSpecs(index, BADGE_DIRECT_USAGE);
  const managerSurfaceStoryIds = storyIdsForUsageSpecs(index, BADGE_MANAGER_SURFACES);
  const addonPanelStoryIds = storyIdsForUsageSpecs(index, BADGE_ADDON_PANELS);
  const a11yReportStoryIds = storyIdsForUsageSpecs(index, BADGE_A11Y_REPORT);
  const reviewSurfaceStoryIds = storyIdsForUsageSpecs(index, BADGE_REVIEW_SURFACES);

  const collections: ReviewCollection[] = [
    {
      title: 'Badge all status variants',
      rationale:
        'Core Badge stories covering default styling, every status color, and compact mode.',
      storyIds: badgeStoryIds,
    },
    {
      title: 'StatusBadge test result states',
      rationale:
        'StatusBadge wraps Badge for component-testing UI; verify each test outcome state.',
      storyIds: statusBadgeStoryIds,
    },
    {
      title: 'Direct Badge importers',
      rationale:
        'Components that render Badge inline: ActionList item labels and addon Panel titles.',
      storyIds: directUsageStoryIds,
    },
    {
      title: 'Manager surfaces with Badge',
      rationale:
        'Sidebar tag filters, status filter chips, and the manager error boundary where Badge marks selection and errors.',
      storyIds: managerSurfaceStoryIds,
    },
    {
      title: 'Addon panels with Badge',
      rationale:
        'Accessibility and interactions addon panels that use compact Badge counts on tabs and toolbars.',
      storyIds: addonPanelStoryIds,
    },
    {
      title: 'A11y report impact badges',
      rationale:
        'Accessibility Report rows where Badge communicates violation severity and incomplete checks.',
      storyIds: a11yReportStoryIds,
    },
    {
      title: 'Review toolbar new story badge',
      rationale:
        'Review addon toolbar header showing the positive Badge label on newly added stories.',
      storyIds: reviewSurfaceStoryIds,
    },
  ].filter((collection) => collection.storyIds.length > 0);

  return {
    title: 'Badge component and usage locations',
    description:
      'Review **Badge** status variants, the **StatusBadge** wrapper, and the manager and addon surfaces where **Badge** appears in real UI context.',
    collections,
  };
}

export async function pushReview(storybookUrl: string, review: ReviewPayload) {
  const result = await mcpCall(storybookUrl, 'tools/call', {
    name: 'display-review',
    arguments: review,
  });

  const structured = result?.structuredContent as { reviewUrl?: string } | undefined;
  const reviewUrl = structured?.reviewUrl;

  return { reviewUrl, result };
}

async function parsePayloadArg(payloadArg: string): Promise<ReviewPayload> {
  const trimmed = payloadArg.trim();
  if (trimmed.startsWith('{')) {
    return JSON.parse(trimmed) as ReviewPayload;
  }
  return JSON.parse(await readFile(trimmed, 'utf8')) as ReviewPayload;
}

async function resolveReview(storybookUrl: string, payloadArg?: string): Promise<ReviewPayload> {
  if (payloadArg) {
    return parsePayloadArg(payloadArg);
  }
  const index = await fetchStoryIndex(storybookUrl);
  return buildBadgeReview(index);
}

async function run(options: { storybookUrl: string; payload?: string; dryRun: boolean }) {
  const review = await resolveReview(options.storybookUrl, options.payload);

  const storyCount = review.collections.reduce((n, c) => n + c.storyIds.length, 0);
  console.log(
    `Review: ${review.collections.length} collection(s), ${storyCount} stor${storyCount === 1 ? 'y' : 'ies'}`
  );
  for (const collection of review.collections) {
    console.log(`  • ${collection.title}: ${collection.storyIds.join(', ')}`);
  }

  if (options.dryRun) {
    console.log('\nDry run — review payload:');
    console.log(JSON.stringify(review, null, 2));
    return;
  }

  const { reviewUrl } = await pushReview(options.storybookUrl, review);
  console.log(`\nReview published: ${reviewUrl ?? '(no reviewUrl returned)'}`);
}

if (esMain(import.meta.url)) {
  program
    .name('display-review')
    .description(
      'Push a Storybook review via the display-review MCP tool (no agent required). ' +
        'Without a payload, publishes a built-in Badge review resolved from the live index.'
    )
    .argument('[payload]', 'Optional review payload as inline JSON or a path to a .json file')
    .option('--storybook-url <url>', 'Running Storybook origin', DEFAULT_STORYBOOK_URL)
    .option('--dry-run', 'Resolve story IDs and print the payload without publishing', false);

  program.parse(process.argv);
  const [payload] = program.args;
  const opts = program.opts<{ storybookUrl: string; dryRun: boolean }>();

  run({ ...opts, payload }).catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
