import { readFile } from 'node:fs/promises';
import process from 'node:process';

import { program } from 'commander';

import { esMain } from './utils/esmain.ts';

const DEFAULT_STORYBOOK_URL = process.env.STORYBOOK_URL ?? 'http://localhost:6006';
const MCP_PATH = '/mcp';

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
const BADGE_USAGE_IMPORT_PATHS = [
  './core/src/components/components/ActionList/ActionList.stories.tsx',
  './core/src/manager/components/panel/Panel.stories.tsx',
];
const PAGES_IMPORT_PATHS = ['./core/src/pages/GuidePage/GuidePage.stories.tsx'];

function normalizeStorybookUrl(url: string): string {
  return url.replace(/\/$/, '');
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
  const response = await fetch(endpoint, {
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
  const response = await fetch(`${normalizeStorybookUrl(storybookUrl)}/index.json`);
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

/**
 * Build a review payload for the Badge component and its known in-repo usages.
 * Story IDs are resolved from the live Storybook index so the review always
 * matches the running instance.
 */
export function buildBadgeReview(index: StoryIndex): ReviewPayload {
  const badgeStoryIds = storyIdsForImportPaths(index, BADGE_COMPONENT_IMPORT_PATHS);
  const usageStoryIds = storyIdsForImportPaths(index, BADGE_USAGE_IMPORT_PATHS, [
    'Default',
    'JSX Titles',
  ]);
  const pagesStoryIds = storyIdsForImportPaths(index, PAGES_IMPORT_PATHS, ['Default']);

  const collections: ReviewCollection[] = [
    {
      title: 'Badge variants',
      rationale: 'The core Badge component across its status and compact variants.',
      storyIds: badgeStoryIds,
    },
  ];

  if (usageStoryIds.length > 0) {
    collections.push({
      title: 'Usages of Badge',
      rationale: 'Components that use Badge in real UI context.',
      storyIds: usageStoryIds,
    });
  }

  if (pagesStoryIds.length > 0) {
    collections.push({
      title: 'Screens that use Badge',
      rationale: 'Screens that use Badge.',
      storyIds: pagesStoryIds,
    });
  }

  return {
    title: 'Badge component overview',
    description:
      'A curated selection of Badge variants and the UI surfaces where Badge appears in context.',
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
