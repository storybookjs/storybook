import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import pLimit from 'p-limit';
import type { Project } from './lib/projects.ts';
import { PROJECTS } from './lib/projects.ts';
import { createLogger } from './lib/utils.ts';

const DEFAULT_DB_PATH = resolve(import.meta.dirname, '.cache', 'eval-pr-data.sqlite');
const GH_PAGE_SIZE = 200;

interface PullRequestListItem {
  number?: number;
  title?: string;
  body?: string;
  state?: string;
  isDraft?: boolean;
  createdAt?: string;
  headRefName?: string;
  headRefOid?: string;
  files?: Array<{
    path?: string;
  }>;
  headRepository?: {
    name?: string;
  } | null;
  headRepositoryOwner?: {
    login?: string;
  } | null;
  statusCheckRollup?: StatusCheck[];
}

type StatusCheck = CheckRun | StatusContext;

interface CheckRun {
  __typename: 'CheckRun';
  name?: string;
  workflowName?: string;
  status?: string;
  conclusion?: string;
  startedAt?: string;
  completedAt?: string;
  detailsUrl?: string;
}

interface StatusContext {
  __typename: 'StatusContext';
  context?: string;
  state?: string;
  startedAt?: string;
  targetUrl?: string;
}

interface EvalDataPayload {
  schemaVersion?: number;
  id?: string;
  timestamp?: string;
  prompt?: {
    name?: string;
    content?: string;
  };
  baselineCommit?: string;
  variant?: {
    agent?: string;
    model?: string;
    effort?: string;
  };
  environment?: {
    nodeVersion?: string;
    evalBranch?: string;
    evalCommit?: string;
  };
  execution?: {
    cost?: number;
    duration?: number;
    durationApi?: number;
    turns?: number;
    terminalResultSubtype?: string;
  };
  grade?: {
    buildSuccess?: boolean;
    typeCheckErrors?: number;
    baselinePreviewStories?: StoryRenderSummaryPayload;
    storyRender?: StoryRenderSummaryPayload;
    baselineGhostStories?: GhostSummaryPayload;
    ghostStories?: GhostSummaryPayload;
    fileChanges?: FileChangePayload[];
  };
  screenshots?: unknown[];
  transcript?: unknown[];
  artifacts?: {
    buildOutput?: {
      path?: string;
    };
    typecheckOutput?: {
      path?: string;
    };
    screenshotOutput?: {
      path?: string;
    };
  };
}

interface GhostSummaryPayload {
  candidateCount?: number;
  total?: number;
  passed?: number;
}

interface StoryRenderSummaryPayload {
  total?: number;
  passed?: number;
  emptyRenderFailures?: number;
}

interface FileChangePayload {
  path?: string;
  previousPath?: string;
  gitStatus?: string;
}

interface NormalizedGhostSummary {
  candidateCount: number;
  total: number;
  passed: number;
}

interface NormalizedStoryRenderSummary {
  total: number;
  passed: number;
  emptyRenderFailures: number | null;
}

interface NormalizedFileChange {
  path: string;
  previousPath: string | null;
  gitStatus: GitStatus;
}

interface NormalizedTrialData {
  promptName: string;
  promptContent: string;
  trialTimestamp: string;
  dataSchemaVersion: number;
  baselineCommit: string;
  agent: string;
  model: string;
  effort: string;
  buildSuccess: 0 | 1;
  typecheckErrors: number;
  costUsd: number | null;
  durationS: number;
  durationApiS: number | null;
  turns: number;
  terminalResultSubtype: string | null;
  ghostBefore: NormalizedGhostSummary | null;
  ghostAfter: NormalizedGhostSummary | null;
  storyBefore: NormalizedStoryRenderSummary | null;
  storyAfter: NormalizedStoryRenderSummary | null;
  nodeVersion: string;
  evalBranch: string;
  evalCommit: string;
  buildOutputPath: string | null;
  typecheckOutputPath: string | null;
  fileChanges: NormalizedFileChange[];
  transcriptJson: string;
}

interface CollectorSummary {
  insertedTrials: number;
  skippedTrials: number;
  skippedWithoutDataJson: number;
  failedTrials: number;
  backfilledTrialCosts: number;
  failedTrialCostBackfills: number;
}

interface CollectPullRequestOptions {
  db: DatabaseSync;
  project: Project;
  projectId: number;
  pullRequest: PullRequestListItem;
}

type PullRequestState = 'all' | 'open';

type CollectPullRequestResult =
  | 'inserted'
  | 'skipped-existing'
  | 'skipped-without-data-json'
  | 'failed';

type GitStatus = 'A' | 'M' | 'D' | 'R';

const logger = createLogger('eval-collect');

export async function main() {
  const args = parseCliArgs();
  const projects = resolveProjects(args.project);
  const dbPath = resolve(args.dbPath);

  mkdirSync(dirname(dbPath), { recursive: true });
  logger.logStep(`Opening SQLite database at ${dbPath}`);

  const db = new DatabaseSync(dbPath);

  try {
    configureDatabase(db);
    ensureSchema(db, dbPath);

    const summary: CollectorSummary = {
      insertedTrials: 0,
      skippedTrials: 0,
      skippedWithoutDataJson: 0,
      failedTrials: 0,
      backfilledTrialCosts: 0,
      failedTrialCostBackfills: 0,
    };

    for (const project of projects) {
      logger.logStep(`Collecting ${project.name} (${project.githubSlug})`);
      const projectId = upsertProject(db, project);
      const pullRequests = await listEvalPullRequests(project.githubSlug, args.limit, args.prState);

      for (const pullRequest of pullRequests) {
        const result = await collectPullRequest({
          db,
          project,
          projectId,
          pullRequest,
        });

        if (result === 'inserted') {
          summary.insertedTrials += 1;
        } else if (result === 'skipped-existing') {
          summary.skippedTrials += 1;
        } else if (result === 'skipped-without-data-json') {
          summary.skippedWithoutDataJson += 1;
        } else {
          summary.failedTrials += 1;
        }
      }
    }

    const trialCostBackfill = await backfillMissingTrialCosts(db);
    summary.backfilledTrialCosts = trialCostBackfill.backfilled;
    summary.failedTrialCostBackfills = trialCostBackfill.failed;

    logger.logSuccess(
      `Inserted ${summary.insertedTrials} trials, skipped ${summary.skippedTrials} existing trials, skipped ${summary.skippedWithoutDataJson} PRs without usable data.json, failed ${summary.failedTrials}, backfilled ${summary.backfilledTrialCosts} trial costs, failed ${summary.failedTrialCostBackfills} trial cost backfills`
    );
  } finally {
    db.close();
  }
}

export function parseCliArgs(argv = process.argv.slice(2)) {
  const { values } = parseArgs({
    args: argv,
    options: {
      'db-path': { type: 'string' },
      project: { type: 'string' },
      limit: { type: 'string' },
      state: { type: 'string' },
    },
    strict: true,
    allowPositionals: false,
  });

  const limit = values.limit == null ? GH_PAGE_SIZE : Number(values.limit);
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error(`--limit must be a positive integer. Received: ${values.limit}`);
  }

  const rawPrState = values.state;
  if (rawPrState != null && rawPrState !== 'all' && rawPrState !== 'open') {
    throw new Error(`--state must be "all" or "open". Received: ${rawPrState}`);
  }
  const prState: PullRequestState = rawPrState === 'open' ? 'open' : 'all';

  return {
    dbPath: values['db-path'] ?? DEFAULT_DB_PATH,
    project: values.project ?? undefined,
    limit,
    prState,
  };
}

function resolveProjects(projectName?: string) {
  if (!projectName) {
    return PROJECTS;
  }

  const project = PROJECTS.find((entry) => entry.name === projectName);
  if (!project) {
    throw new Error(
      `Unknown project "${projectName}". Available: ${PROJECTS.map((entry) => entry.name).join(', ')}`
    );
  }

  return [project];
}

function configureDatabase(db: DatabaseSync) {
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
  `);
}

export function ensureSchema(db: DatabaseSync, dbPath = DEFAULT_DB_PATH) {
  failIfLegacyScreenshotSchema(db, dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY,
      github_slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      default_branch TEXT NOT NULL,
      project_dir TEXT
    );

    CREATE TABLE IF NOT EXISTS prompts (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      content TEXT NOT NULL,
      UNIQUE(name, content)
    );

    CREATE TABLE IF NOT EXISTS trials (
      trial_id TEXT PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id),
      prompt_id INTEGER NOT NULL REFERENCES prompts(id),
      trial_timestamp TEXT NOT NULL,
      data_schema_version INTEGER NOT NULL,
      pr_number INTEGER NOT NULL,
      pr_title TEXT NOT NULL,
      pr_created_at TEXT NOT NULL,
      pr_state TEXT NOT NULL,
      pr_is_draft INTEGER NOT NULL CHECK (pr_is_draft IN (0, 1)),
      head_ref_name TEXT NOT NULL,
      head_ref_oid TEXT NOT NULL,
      baseline_commit TEXT NOT NULL,
      agent TEXT NOT NULL,
      model TEXT NOT NULL,
      effort TEXT NOT NULL,
      build_success INTEGER NOT NULL CHECK (build_success IN (0, 1)),
      typecheck_errors INTEGER NOT NULL,
      cost_usd REAL,
      duration_s REAL NOT NULL,
      duration_api_s REAL,
      turns INTEGER NOT NULL,
      terminal_result_subtype TEXT,
      ghost_before_candidate_count INTEGER,
      ghost_before_total INTEGER,
      ghost_before_passed INTEGER,
      ghost_after_candidate_count INTEGER,
      ghost_after_total INTEGER,
      ghost_after_passed INTEGER,
      story_before_total INTEGER,
      story_before_passed INTEGER,
      story_before_empty INTEGER,
      story_after_total INTEGER,
      story_after_passed INTEGER,
      story_after_empty INTEGER,
      node_version TEXT NOT NULL,
      eval_branch TEXT NOT NULL,
      eval_commit TEXT NOT NULL,
      data_json_path TEXT NOT NULL,
      build_output_path TEXT,
      typecheck_output_path TEXT,
      ingested_at TEXT NOT NULL,
      UNIQUE(project_id, pr_number),
      UNIQUE(project_id, head_ref_oid)
    );

    CREATE TABLE IF NOT EXISTS trial_checks (
      trial_id TEXT NOT NULL REFERENCES trials(trial_id) ON DELETE CASCADE,
      seq INTEGER NOT NULL,
      check_type TEXT NOT NULL,
      name_or_context TEXT NOT NULL,
      workflow_name TEXT,
      status TEXT,
      conclusion_or_state TEXT,
      started_at TEXT,
      completed_at TEXT,
      details_url TEXT,
      target_url TEXT,
      PRIMARY KEY (trial_id, seq)
    );

    CREATE TABLE IF NOT EXISTS trial_file_changes (
      trial_id TEXT NOT NULL REFERENCES trials(trial_id) ON DELETE CASCADE,
      seq INTEGER NOT NULL,
      path TEXT NOT NULL,
      previous_path TEXT,
      git_status TEXT NOT NULL CHECK (git_status IN ('A', 'M', 'D', 'R')),
      PRIMARY KEY (trial_id, seq)
    );

    CREATE TABLE IF NOT EXISTS trial_transcripts (
      trial_id TEXT PRIMARY KEY REFERENCES trials(trial_id) ON DELETE CASCADE,
      transcript_json TEXT NOT NULL
    );
  `);

  ensureTableColumn(db, 'trials', 'story_before_total', 'INTEGER');
  ensureTableColumn(db, 'trials', 'story_before_passed', 'INTEGER');
  ensureTableColumn(db, 'trials', 'story_before_empty', 'INTEGER');
  ensureTableColumn(db, 'trials', 'story_after_total', 'INTEGER');
  ensureTableColumn(db, 'trials', 'story_after_passed', 'INTEGER');
  ensureTableColumn(db, 'trials', 'story_after_empty', 'INTEGER');
  ensureTableColumn(db, 'trials', 'cost_usd', 'REAL');
  ensureViews(db);
}

function ensureViews(db: DatabaseSync) {
  db.exec(`
    DROP VIEW IF EXISTS ghost_story_rate_by_project_model_effort;
    DROP VIEW IF EXISTS story_render_rate_by_project_model_effort;
    DROP VIEW IF EXISTS story_render_summary_by_project_model_effort;
    DROP VIEW IF EXISTS story_render_scores_by_trial;

    CREATE VIEW ghost_story_rate_by_project_model_effort AS
    SELECT
      p.name AS project,
      t.model AS model,
      t.effort AS effort,
      COUNT(*) AS trials,
      AVG(t.ghost_before_passed) AS avg_before_passed,
      AVG(t.ghost_before_total) AS avg_before_total,
      AVG(t.ghost_after_passed) AS avg_after_passed,
      AVG(t.ghost_after_total) AS avg_after_total,
      AVG(
        CASE
          WHEN t.ghost_before_total > 0
            THEN 1.0 * t.ghost_before_passed / t.ghost_before_total
          ELSE 0
        END
      ) AS before_rate,
      AVG(
        CASE
          WHEN t.ghost_after_total > 0
            THEN 1.0 * t.ghost_after_passed / t.ghost_after_total
          ELSE 0
        END
      ) AS after_rate,
      AVG(
        CASE
          WHEN t.ghost_before_total > 0 AND t.ghost_after_total > 0
            THEN (1.0 * t.ghost_after_passed / t.ghost_after_total) -
                 (1.0 * t.ghost_before_passed / t.ghost_before_total)
          ELSE 0
        END
      ) AS absolute_rate_gain,
      AVG(
        CASE
          WHEN t.ghost_before_total > 0
            AND t.ghost_after_total > 0
            AND t.ghost_before_passed < t.ghost_before_total
            THEN (
              (1.0 * t.ghost_after_passed / t.ghost_after_total) -
              (1.0 * t.ghost_before_passed / t.ghost_before_total)
            ) / (1.0 - (1.0 * t.ghost_before_passed / t.ghost_before_total))
          ELSE 0
        END
      ) AS normalized_rate_gain
    FROM trials t
    JOIN projects p ON p.id = t.project_id
    WHERE t.effort IN ('high', 'max', 'xhigh')
    GROUP BY p.name, t.model, t.effort
  `);

  db.exec(`
    CREATE VIEW story_render_rate_by_project_model_effort AS
    SELECT
      p.name AS project,
      t.model AS model,
      t.effort AS effort,
      COUNT(*) AS trials,
      AVG(t.story_before_passed) AS avg_before_passed,
      AVG(t.story_before_total) AS avg_before_total,
      AVG(t.story_before_empty) AS avg_before_empty,
      AVG(t.story_after_passed) AS avg_after_passed,
      AVG(t.story_after_total) AS avg_after_total,
      AVG(t.story_after_empty) AS avg_after_empty,
      AVG(t.cost_usd) AS avg_cost_usd,
      AVG(t.duration_s) AS avg_duration_s,
      AVG(t.turns) AS avg_turns,
      AVG(
        CASE
          WHEN t.story_before_total > 0
            THEN 1.0 * t.story_before_passed / t.story_before_total
          ELSE 0
        END
      ) AS before_rate,
      AVG(
        CASE
          WHEN t.story_after_total > 0
            THEN 1.0 * t.story_after_passed / t.story_after_total
          ELSE 0
        END
      ) AS after_rate,
      AVG(
        CASE
          WHEN t.story_before_total > 0
            AND t.story_after_total > 0
            AND t.story_before_passed < t.story_before_total
            THEN (
              (1.0 * t.story_after_passed / t.story_after_total) -
              (1.0 * t.story_before_passed / t.story_before_total)
            ) / (1.0 - (1.0 * t.story_before_passed / t.story_before_total))
          WHEN t.story_before_total > 0
            AND t.story_after_total > 0
            AND t.story_before_passed = t.story_before_total
            AND t.story_after_passed = t.story_after_total
            THEN 1.0
          ELSE 0
        END
      ) AS normalized_preview_gain
    FROM trials t
    JOIN projects p ON p.id = t.project_id
    WHERE t.effort IN ('high', 'max', 'xhigh')
      AND t.story_before_total IS NOT NULL
      AND t.story_after_total IS NOT NULL
    GROUP BY p.name, t.model, t.effort
  `);

  db.exec(`
    CREATE VIEW story_render_scores_by_trial AS
    SELECT
      p.name AS project,
      t.pr_number AS pr_number,
      t.trial_id AS trial_id,
      t.trial_timestamp AS trial_timestamp,
      t.model AS model,
      t.effort AS effort,
      t.story_before_passed AS before_passed,
      t.story_before_total AS before_total,
      printf('%d/%d', t.story_before_passed, t.story_before_total) AS before_quotient,
      CASE
        WHEN t.story_before_total > 0
          THEN 1.0 * t.story_before_passed / t.story_before_total
        ELSE NULL
      END AS before_rate,
      CASE
        WHEN t.story_before_total > 0
          THEN 100.0 * t.story_before_passed / t.story_before_total
        ELSE NULL
      END AS before_percent,
      t.story_after_passed AS after_passed,
      t.story_after_total AS after_total,
      printf('%d/%d', t.story_after_passed, t.story_after_total) AS after_quotient,
      CASE
        WHEN t.story_after_total > 0
          THEN 1.0 * t.story_after_passed / t.story_after_total
        ELSE NULL
      END AS after_rate,
      CASE
        WHEN t.story_after_total > 0
          THEN 100.0 * t.story_after_passed / t.story_after_total
        ELSE NULL
      END AS after_percent,
      CASE
        WHEN t.story_before_total > 0 AND t.story_after_total > 0
          THEN
            (1.0 * t.story_after_passed / t.story_after_total) -
            (1.0 * t.story_before_passed / t.story_before_total)
        ELSE NULL
      END AS absolute_rate_gain,
      CASE
        WHEN t.story_before_total > 0 AND t.story_after_total > 0
          THEN
            100.0 * (
              (1.0 * t.story_after_passed / t.story_after_total) -
              (1.0 * t.story_before_passed / t.story_before_total)
            )
        ELSE NULL
      END AS absolute_gain_percent,
      CASE
        WHEN t.story_before_total > 0
          AND t.story_after_total > 0
          AND t.story_before_passed < t.story_before_total
          THEN (
            (1.0 * t.story_after_passed / t.story_after_total) -
            (1.0 * t.story_before_passed / t.story_before_total)
          ) / (1.0 - (1.0 * t.story_before_passed / t.story_before_total))
        WHEN t.story_before_total > 0
          AND t.story_after_total > 0
          AND t.story_before_passed = t.story_before_total
          AND t.story_after_passed = t.story_after_total
          THEN 1.0
        ELSE 0
      END AS normalized_preview_gain,
      CASE
        WHEN t.story_before_total > 0
          AND t.story_after_total > 0
          AND t.story_before_passed < t.story_before_total
          THEN 100.0 * (
            (
              (1.0 * t.story_after_passed / t.story_after_total) -
              (1.0 * t.story_before_passed / t.story_before_total)
            ) / (1.0 - (1.0 * t.story_before_passed / t.story_before_total))
          )
        WHEN t.story_before_total > 0
          AND t.story_after_total > 0
          AND t.story_before_passed = t.story_before_total
          AND t.story_after_passed = t.story_after_total
          THEN 100.0
        ELSE 0
      END AS normalized_preview_gain_percent,
      CASE
        WHEN t.story_before_total > 0
          AND t.story_after_total > 0
          AND t.story_before_passed < t.story_before_total
          THEN (
            (1.0 * t.story_after_passed / t.story_after_total) -
            (1.0 * t.story_before_passed / t.story_before_total)
          ) / (1.0 - (1.0 * t.story_before_passed / t.story_before_total))
        WHEN t.story_before_total > 0
          AND t.story_after_total > 0
          AND t.story_before_passed = t.story_before_total
          AND t.story_after_passed = t.story_after_total
          THEN 1.0
        ELSE 0
      END AS score
    FROM trials t
    JOIN projects p ON p.id = t.project_id
    WHERE t.story_before_total IS NOT NULL
      AND t.story_after_total IS NOT NULL
  `);

  db.exec(`
    CREATE VIEW story_render_summary_by_project_model_effort AS
    SELECT
      project,
      model,
      effort,
      trials,
      before_rate AS before,
      after_rate AS after,
      normalized_preview_gain AS gain,
      avg_cost_usd,
      avg_duration_s,
      printf(
        '%dm %02ds',
        CAST(ROUND(avg_duration_s) / 60 AS INTEGER),
        CAST(ROUND(avg_duration_s) AS INTEGER) % 60
      ) AS avg_duration_m_s,
      avg_turns
    FROM story_render_rate_by_project_model_effort
    WHERE project <> 'baklava'
  `);
}

async function collectPullRequest(
  opts: CollectPullRequestOptions
): Promise<CollectPullRequestResult> {
  try {
    const prNumber = getRequiredInteger(opts.pullRequest.number, 'pullRequest.number');
    const dataJsonPath = findEvalDataJsonPath(opts.pullRequest.files);
    const headRepositorySlug = resolveHeadRepositorySlug(opts.pullRequest, opts.project.githubSlug);

    if (!dataJsonPath) {
      return logSkippedWithoutUsableDataJson(
        opts.project.githubSlug,
        prNumber,
        'missing data.json change'
      );
    }

    const trialId = extractTrialId(opts.pullRequest);
    if (!trialId) {
      return logSkippedWithoutUsableDataJson(
        opts.project.githubSlug,
        prNumber,
        'could not infer trial id'
      );
    }

    const headRefName = getRequiredString(opts.pullRequest.headRefName, 'pullRequest.headRefName');
    const headRefOid = getRequiredString(opts.pullRequest.headRefOid, 'pullRequest.headRefOid');

    const existingTrialId = findExistingTrialId(
      opts.db,
      opts.projectId,
      trialId,
      prNumber,
      headRefOid
    );

    if (existingTrialId) {
      logger.logStep(
        `Skipped existing ${opts.project.githubSlug}#${prNumber} (${existingTrialId})`
      );
      return 'skipped-existing';
    }

    const rawData = fetchDataJson(headRepositorySlug, dataJsonPath, headRefOid);
    if (!rawData) {
      return logSkippedWithoutUsableDataJson(
        opts.project.githubSlug,
        prNumber,
        'could not read data.json from PR head'
      );
    }

    let normalized: NormalizedTrialData;
    try {
      normalized = normalizeTrialData({
        data: rawData,
        trialId,
      });
    } catch (error) {
      return logSkippedWithoutUsableDataJson(
        opts.project.githubSlug,
        prNumber,
        `invalid data.json: ${formatError(error)}`
      );
    }

    insertTrial(opts.db, {
      projectId: opts.projectId,
      trialId,
      prNumber,
      prTitle: getRequiredString(opts.pullRequest.title, 'pullRequest.title'),
      prCreatedAt: getRequiredString(opts.pullRequest.createdAt, 'pullRequest.createdAt'),
      prState: getRequiredString(opts.pullRequest.state, 'pullRequest.state'),
      prIsDraft: getRequiredBoolean(opts.pullRequest.isDraft, 'pullRequest.isDraft') ? 1 : 0,
      headRefName,
      headRefOid,
      dataJsonPath,
      ingestedAt: new Date().toISOString(),
      pullRequest: opts.pullRequest,
      normalized,
    });

    logger.logSuccess(`Inserted ${opts.project.githubSlug}#${prNumber} (${trialId})`);
    return 'inserted';
  } catch (error) {
    logger.logError(
      `Failed ${opts.project.githubSlug}#${formatPullRequestNumber(opts.pullRequest.number)}: ${formatError(error)}`
    );
    return 'failed';
  }
}

function upsertProject(db: DatabaseSync, project: Project) {
  db.prepare(`
    INSERT INTO projects (
      github_slug,
      name,
      default_branch,
      project_dir
    ) VALUES (?, ?, ?, ?)
    ON CONFLICT(github_slug) DO UPDATE SET
      name = excluded.name,
      default_branch = excluded.default_branch,
      project_dir = excluded.project_dir
  `).run(project.githubSlug, project.name, project.branch, project.projectDir ?? null);

  const row = db.prepare('SELECT id FROM projects WHERE github_slug = ?').get(project.githubSlug) as
    | { id?: unknown }
    | undefined;

  return getRequiredInteger(row?.id, `projects.id for ${project.githubSlug}`);
}

function upsertPrompt(db: DatabaseSync, promptName: string, promptContent: string) {
  db.prepare(`
    INSERT INTO prompts (name, content)
    VALUES (?, ?)
    ON CONFLICT(name, content) DO NOTHING
  `).run(promptName, promptContent);

  const row = db
    .prepare('SELECT id FROM prompts WHERE name = ? AND content = ?')
    .get(promptName, promptContent) as { id?: unknown } | undefined;

  return getRequiredInteger(row?.id, `prompts.id for ${promptName}`);
}

export async function listEvalPullRequests(
  repoSlug: string,
  limit: number,
  state: PullRequestState = 'all'
) {
  try {
    return runGhJsonOrThrow<PullRequestListItem[]>([
      'pr',
      'list',
      '--repo',
      repoSlug,
      '--state',
      state,
      '--search',
      'label:eval',
      '--limit',
      String(limit),
      '--json',
      [
        'number',
        'title',
        'body',
        'state',
        'isDraft',
        'createdAt',
        'headRefName',
        'headRefOid',
        'files',
        'headRepository',
        'headRepositoryOwner',
        'statusCheckRollup',
      ].join(','),
    ]);
  } catch (error) {
    throw new Error(`Failed to list eval PRs for ${repoSlug}: ${formatError(error)}`);
  }
}

function fetchDataJson(repoSlug: string, dataJsonPath: string, headRefOid: string) {
  const blobBuffer = fetchRepositoryBlob(repoSlug, dataJsonPath, headRefOid);
  if (!blobBuffer) {
    return null;
  }

  try {
    return JSON.parse(blobBuffer.toString('utf8')) as EvalDataPayload;
  } catch (error) {
    logger.logError(
      `Failed to decode ${repoSlug}:${dataJsonPath}@${headRefOid}: ${formatError(error)}`
    );
    return null;
  }
}

function fetchRepositoryBlob(repoSlug: string, filePath: string, ref: string) {
  return runGhBytes(
    [
      'api',
      '-H',
      'Accept: application/vnd.github.raw',
      `repos/${repoSlug}/contents/${filePath}?ref=${ref}`,
    ],
    null
  );
}

function runGhJsonOrThrow<T>(args: string[]): T {
  try {
    const stdout = execFileSync('gh', args, {
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024,
    }).trim();
    return JSON.parse(stdout) as T;
  } catch (error) {
    throw new Error(`gh ${args.join(' ')} failed: ${formatError(error)}`);
  }
}

function runGhBytes(args: string[], fallback: Buffer | null) {
  try {
    return execFileSync('gh', args, {
      encoding: 'buffer',
      maxBuffer: 50 * 1024 * 1024,
    });
  } catch (error) {
    logger.logError(`gh ${args.join(' ')} failed: ${formatError(error)}`);
    return fallback;
  }
}

function ensureTableColumn(
  db: DatabaseSync,
  tableName: string,
  columnName: string,
  columnDefinition: string
) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name?: unknown }>;
  const hasColumn = columns.some((column) => column.name === columnName);

  if (!hasColumn) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
  }
}

function failIfLegacyScreenshotSchema(db: DatabaseSync, dbPath: string) {
  const hasLegacyScreenshotTable = tableExists(db, 'trial_screenshots');
  const hasLegacyScreenshotColumn = tableHasColumn(db, 'trials', 'screenshot_output_path');

  if (!hasLegacyScreenshotTable && !hasLegacyScreenshotColumn) {
    return;
  }

  throw new Error(
    `Legacy screenshot-era eval collector DB schema detected at ${dbPath}. Delete .cache/eval-pr-data.sqlite (or the custom DB file you passed in) and rerun scripts/eval/collect-pr-data.ts to regenerate it.`
  );
}

function tableExists(db: DatabaseSync, tableName: string) {
  const row = db
    .prepare(
      `
        SELECT name
        FROM sqlite_master
        WHERE type = 'table' AND name = ?
      `
    )
    .get(tableName) as { name?: unknown } | undefined;

  return typeof row?.name === 'string';
}

function tableHasColumn(db: DatabaseSync, tableName: string, columnName: string) {
  if (!tableExists(db, tableName)) {
    return false;
  }

  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name?: unknown }>;
  return columns.some((column) => column.name === columnName);
}

function findExistingTrialId(
  db: DatabaseSync,
  projectId: number,
  trialId: string,
  prNumber: number,
  headRefOid: string
) {
  const row = db
    .prepare(`
      SELECT trial_id
      FROM trials
      WHERE trial_id = ?
         OR (project_id = ? AND pr_number = ?)
         OR (project_id = ? AND head_ref_oid = ?)
      LIMIT 1
    `)
    .get(trialId, projectId, prNumber, projectId, headRefOid) as { trial_id?: unknown } | undefined;

  return getOptionalString(row?.trial_id);
}

function insertTrial(
  db: DatabaseSync,
  input: {
    projectId: number;
    trialId: string;
    prNumber: number;
    prTitle: string;
    prCreatedAt: string;
    prState: string;
    prIsDraft: 0 | 1;
    headRefName: string;
    headRefOid: string;
    dataJsonPath: string;
    ingestedAt: string;
    pullRequest: PullRequestListItem;
    normalized: NormalizedTrialData;
  }
) {
  db.exec('BEGIN');

  try {
    const promptId = upsertPrompt(db, input.normalized.promptName, input.normalized.promptContent);

    db.prepare(`
      INSERT INTO trials (
        trial_id,
        project_id,
        prompt_id,
        trial_timestamp,
        data_schema_version,
        pr_number,
        pr_title,
        pr_created_at,
        pr_state,
        pr_is_draft,
        head_ref_name,
        head_ref_oid,
        baseline_commit,
        agent,
        model,
        effort,
        build_success,
        typecheck_errors,
        cost_usd,
        duration_s,
        duration_api_s,
        turns,
        terminal_result_subtype,
        ghost_before_candidate_count,
        ghost_before_total,
        ghost_before_passed,
        ghost_after_candidate_count,
        ghost_after_total,
        ghost_after_passed,
        story_before_total,
        story_before_passed,
        story_before_empty,
        story_after_total,
        story_after_passed,
        story_after_empty,
        node_version,
        eval_branch,
        eval_commit,
        data_json_path,
        build_output_path,
        typecheck_output_path,
        ingested_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.trialId,
      input.projectId,
      promptId,
      input.normalized.trialTimestamp,
      input.normalized.dataSchemaVersion,
      input.prNumber,
      input.prTitle,
      input.prCreatedAt,
      input.prState,
      input.prIsDraft,
      input.headRefName,
      input.headRefOid,
      input.normalized.baselineCommit,
      input.normalized.agent,
      input.normalized.model,
      input.normalized.effort,
      input.normalized.buildSuccess,
      input.normalized.typecheckErrors,
      input.normalized.costUsd,
      input.normalized.durationS,
      input.normalized.durationApiS,
      input.normalized.turns,
      input.normalized.terminalResultSubtype,
      input.normalized.ghostBefore?.candidateCount ?? null,
      input.normalized.ghostBefore?.total ?? null,
      input.normalized.ghostBefore?.passed ?? null,
      input.normalized.ghostAfter?.candidateCount ?? null,
      input.normalized.ghostAfter?.total ?? null,
      input.normalized.ghostAfter?.passed ?? null,
      input.normalized.storyBefore?.total ?? null,
      input.normalized.storyBefore?.passed ?? null,
      input.normalized.storyBefore?.emptyRenderFailures ?? null,
      input.normalized.storyAfter?.total ?? null,
      input.normalized.storyAfter?.passed ?? null,
      input.normalized.storyAfter?.emptyRenderFailures ?? null,
      input.normalized.nodeVersion,
      input.normalized.evalBranch,
      input.normalized.evalCommit,
      input.dataJsonPath,
      input.normalized.buildOutputPath,
      input.normalized.typecheckOutputPath,
      input.ingestedAt
    );

    insertTrialChecks(db, input.trialId, input.pullRequest.statusCheckRollup);
    insertTrialFileChanges(db, input.trialId, input.normalized.fileChanges);
    insertTrialTranscript(db, input.trialId, input.normalized.transcriptJson);

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function insertTrialChecks(
  db: DatabaseSync,
  trialId: string,
  statusCheckRollup: PullRequestListItem['statusCheckRollup']
) {
  const statement = db.prepare(`
    INSERT INTO trial_checks (
      trial_id,
      seq,
      check_type,
      name_or_context,
      workflow_name,
      status,
      conclusion_or_state,
      started_at,
      completed_at,
      details_url,
      target_url
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const [index, check] of (statusCheckRollup ?? []).entries()) {
    if (check.__typename === 'CheckRun') {
      statement.run(
        trialId,
        index + 1,
        check.__typename,
        check.name ?? 'unknown',
        getOptionalString(check.workflowName),
        getOptionalString(check.status),
        getOptionalString(check.conclusion),
        getOptionalString(check.startedAt),
        getOptionalString(check.completedAt),
        getOptionalString(check.detailsUrl),
        null
      );
      continue;
    }

    statement.run(
      trialId,
      index + 1,
      check.__typename,
      check.context ?? 'unknown',
      null,
      null,
      getOptionalString(check.state),
      getOptionalString(check.startedAt),
      null,
      null,
      getOptionalString(check.targetUrl)
    );
  }
}

function insertTrialFileChanges(
  db: DatabaseSync,
  trialId: string,
  fileChanges: NormalizedFileChange[]
) {
  const statement = db.prepare(`
    INSERT INTO trial_file_changes (
      trial_id,
      seq,
      path,
      previous_path,
      git_status
    ) VALUES (?, ?, ?, ?, ?)
  `);

  for (const [index, change] of fileChanges.entries()) {
    statement.run(trialId, index + 1, change.path, change.previousPath, change.gitStatus);
  }
}

function insertTrialTranscript(db: DatabaseSync, trialId: string, transcriptJson: string) {
  db.prepare(`
    INSERT INTO trial_transcripts (
      trial_id,
      transcript_json
    ) VALUES (?, ?)
  `).run(trialId, transcriptJson);
}

async function backfillMissingTrialCosts(db: DatabaseSync) {
  const rows = db
    .prepare(`
    SELECT
      t.trial_id,
      t.data_json_path,
      t.head_ref_oid,
      p.github_slug
    FROM trials t
    INNER JOIN projects p ON p.id = t.project_id
    WHERE t.cost_usd IS NULL
    ORDER BY t.trial_timestamp DESC
  `)
    .all() as Array<{
    trial_id?: unknown;
    data_json_path?: unknown;
    head_ref_oid?: unknown;
    github_slug?: unknown;
  }>;

  if (rows.length === 0) {
    logger.logStep('No trial costs need backfill.');
    return { backfilled: 0, failed: 0 };
  }

  logger.logStep(`Backfilling ${rows.length} trial cost(s)...`);
  const limit = pLimit(8);
  const statement = db.prepare(`
    UPDATE trials
    SET cost_usd = ?
    WHERE trial_id = ?
  `);

  let backfilled = 0;
  let failed = 0;

  await Promise.all(
    rows.map((row) =>
      limit(async () => {
        try {
          const data = fetchDataJson(
            getRequiredString(row.github_slug, 'trials.github_slug'),
            getRequiredString(row.data_json_path, 'trials.data_json_path'),
            getRequiredString(row.head_ref_oid, 'trials.head_ref_oid')
          );

          if (!data) {
            failed += 1;
            return;
          }

          const execution = getOptionalObject(data.execution);
          const costUsd = getOptionalNumber(execution?.cost, 'data.json.execution.cost');

          if (costUsd == null) {
            return;
          }

          statement.run(costUsd, getRequiredString(row.trial_id, 'trials.trial_id'));
          backfilled += 1;
        } catch (error) {
          logger.logError(`Failed to backfill trial cost: ${formatError(error)}`);
          failed += 1;
        }
      })
    )
  );

  logger.logSuccess(
    `Backfilled ${backfilled} trial cost(s), failed ${failed} trial cost fetch(es)`
  );
  return { backfilled, failed };
}

export function normalizeTrialData(opts: {
  data: EvalDataPayload;
  trialId: string;
}): NormalizedTrialData {
  const dataId = getRequiredString(opts.data.id, 'data.json.id');
  if (dataId !== opts.trialId) {
    throw new Error(`data.json.id ${dataId} does not match inferred trial_id ${opts.trialId}`);
  }

  const dataSchemaVersion = getEvalDataSchemaVersion(opts.data.schemaVersion);
  assertSupportedScreenshotFields(opts.data, dataSchemaVersion);
  const prompt = getRequiredObject(opts.data.prompt, 'data.json.prompt');
  const variant = getRequiredObject(opts.data.variant, 'data.json.variant');
  const environment = getRequiredObject(opts.data.environment, 'data.json.environment');
  const execution = getRequiredObject(opts.data.execution, 'data.json.execution');
  const grade = getRequiredObject(opts.data.grade, 'data.json.grade');
  const artifacts = getOptionalObject(opts.data.artifacts);

  return {
    promptName: getRequiredString(prompt.name, 'data.json.prompt.name'),
    promptContent: getRequiredString(prompt.content, 'data.json.prompt.content'),
    trialTimestamp: getRequiredString(opts.data.timestamp, 'data.json.timestamp'),
    dataSchemaVersion,
    baselineCommit: getRequiredString(opts.data.baselineCommit, 'data.json.baselineCommit'),
    agent: getRequiredString(variant.agent, 'data.json.variant.agent'),
    model: getRequiredString(variant.model, 'data.json.variant.model'),
    effort: getRequiredString(variant.effort, 'data.json.variant.effort'),
    buildSuccess: getRequiredBoolean(grade.buildSuccess, 'data.json.grade.buildSuccess') ? 1 : 0,
    typecheckErrors: getRequiredInteger(grade.typeCheckErrors, 'data.json.grade.typeCheckErrors'),
    costUsd: getOptionalNumber(execution.cost, 'data.json.execution.cost'),
    durationS: getRequiredNumber(execution.duration, 'data.json.execution.duration'),
    durationApiS: getOptionalNumber(execution.durationApi, 'data.json.execution.durationApi'),
    turns: getRequiredInteger(execution.turns, 'data.json.execution.turns'),
    terminalResultSubtype: getOptionalString(execution.terminalResultSubtype),
    ghostBefore: normalizeGhostSummary(
      grade.baselineGhostStories,
      'data.json.grade.baselineGhostStories'
    ),
    ghostAfter: normalizeGhostSummary(grade.ghostStories, 'data.json.grade.ghostStories'),
    storyBefore: normalizeStoryRenderSummary(
      grade.baselinePreviewStories,
      'data.json.grade.baselinePreviewStories'
    ),
    storyAfter: normalizeStoryRenderSummary(grade.storyRender, 'data.json.grade.storyRender'),
    nodeVersion: getRequiredString(environment.nodeVersion, 'data.json.environment.nodeVersion'),
    evalBranch: getRequiredString(environment.evalBranch, 'data.json.environment.evalBranch'),
    evalCommit: getRequiredString(environment.evalCommit, 'data.json.environment.evalCommit'),
    buildOutputPath: getOptionalArtifactPath(
      artifacts?.buildOutput,
      'data.json.artifacts.buildOutput'
    ),
    typecheckOutputPath: getOptionalArtifactPath(
      artifacts?.typecheckOutput,
      'data.json.artifacts.typecheckOutput'
    ),
    fileChanges: normalizeFileChanges(grade.fileChanges),
    transcriptJson: stringifyTranscript(opts.data.transcript),
  };
}

function getEvalDataSchemaVersion(value: unknown): 3 | 4 {
  const schemaVersion = getRequiredInteger(value, 'data.json.schemaVersion');

  if (schemaVersion !== 3 && schemaVersion !== 4) {
    throw new Error(`data.json.schemaVersion must be 3 or 4`);
  }

  return schemaVersion;
}

function assertSupportedScreenshotFields(data: EvalDataPayload, schemaVersion: 3 | 4) {
  if (schemaVersion !== 4) {
    return;
  }

  const legacyFields: string[] = [];
  if (hasOwn(data, 'screenshots')) {
    legacyFields.push('data.json.screenshots');
  }

  const artifacts = getOptionalObject(data.artifacts);
  if (artifacts && hasOwn(artifacts, 'screenshotOutput')) {
    legacyFields.push('data.json.artifacts.screenshotOutput');
  }

  if (legacyFields.length > 0) {
    throw new Error(
      `data.json.schemaVersion 4 must not include screenshot-era fields: ${legacyFields.join(', ')}`
    );
  }
}

function normalizeGhostSummary(value: unknown, label: string): NormalizedGhostSummary | null {
  if (value == null) {
    return null;
  }

  const summary = getRequiredObject(value, label);
  return {
    candidateCount: getRequiredInteger(summary.candidateCount, `${label}.candidateCount`),
    total: getRequiredInteger(summary.total, `${label}.total`),
    passed: getRequiredInteger(summary.passed, `${label}.passed`),
  };
}

function normalizeStoryRenderSummary(
  value: unknown,
  label: string
): NormalizedStoryRenderSummary | null {
  if (value == null) {
    return null;
  }

  const summary = getRequiredObject(value, label);
  return {
    total: getRequiredInteger(summary.total, `${label}.total`),
    passed: getRequiredInteger(summary.passed, `${label}.passed`),
    emptyRenderFailures: getOptionalInteger(summary.emptyRenderFailures, `${label}.emptyRenderFailures`),
  };
}

function normalizeFileChanges(value: unknown): NormalizedFileChange[] {
  const fileChanges = getRequiredArray(value, 'data.json.grade.fileChanges');

  return fileChanges.map((entry, index) => {
    const fileChange = getRequiredObject(entry, `data.json.grade.fileChanges[${index}]`);
    const gitStatus = getRequiredString(
      fileChange.gitStatus,
      `data.json.grade.fileChanges[${index}].gitStatus`
    );

    if (!isGitStatus(gitStatus)) {
      throw new Error(`data.json.grade.fileChanges[${index}].gitStatus must be one of A, M, D, R`);
    }

    return {
      path: getRequiredString(fileChange.path, `data.json.grade.fileChanges[${index}].path`),
      previousPath: getOptionalString(fileChange.previousPath),
      gitStatus,
    };
  });
}

function stringifyTranscript(value: unknown) {
  return JSON.stringify(getRequiredArray(value, 'data.json.transcript'));
}

function getOptionalArtifactPath(value: unknown, label: string) {
  const artifact = getOptionalObject(value);
  return artifact ? getRequiredString(artifact.path, `${label}.path`) : null;
}

function extractTrialId(pullRequest: PullRequestListItem) {
  const body = getOptionalString(pullRequest.body) ?? '';

  const explicitId = extractBacktickValue(body, 'ID');
  if (explicitId) {
    return explicitId;
  }

  const legacyId = extractBacktickValue(body, 'Trial ID');
  if (legacyId) {
    return legacyId;
  }

  const title = getOptionalString(pullRequest.title) ?? '';
  const match = title.match(/^\[eval\]\s+\S+\s+(.+)$/);
  return match?.[1] ?? '';
}

function extractBacktickValue(body: string, label: string) {
  const match = body.match(new RegExp(`^- ${escapeRegExp(label)}: ` + '`([^`]*)`', 'm'));
  return match?.[1] ?? '';
}

function findEvalDataJsonPath(files: PullRequestListItem['files']) {
  return files?.find(
    (file) => file.path?.endsWith('data.json') && file.path.includes('eval-results')
  )?.path;
}

function resolveHeadRepositorySlug(pullRequest: PullRequestListItem, fallbackSlug: string) {
  const owner = getOptionalString(pullRequest.headRepositoryOwner?.login);
  const repo = getOptionalString(pullRequest.headRepository?.name);
  return owner && repo ? `${owner}/${repo}` : fallbackSlug;
}

function getRequiredObject(value: unknown, label: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }

  return value as Record<string, unknown>;
}

function getOptionalObject(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function hasOwn(value: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function getRequiredArray(value: unknown, label: string) {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }

  return value;
}

function getRequiredString(value: unknown, label: string) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }

  return value;
}

function getOptionalString(value: unknown) {
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function getRequiredNumber(value: unknown, label: string) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }

  return value;
}

function getOptionalNumber(value: unknown, label: string) {
  if (value == null) {
    return null;
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number when present`);
  }

  return value;
}

function getRequiredInteger(value: unknown, label: string) {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new Error(`${label} must be an integer`);
  }

  return value;
}

function getOptionalInteger(value: unknown, label: string) {
  if (value == null) {
    return null;
  }

  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new Error(`${label} must be an integer when present`);
  }

  return value;
}

function getRequiredBoolean(value: unknown, label: string) {
  if (typeof value !== 'boolean') {
    throw new Error(`${label} must be a boolean`);
  }

  return value;
}

function isGitStatus(value: string): value is GitStatus {
  return value === 'A' || value === 'M' || value === 'D' || value === 'R';
}

function logSkippedWithoutUsableDataJson(repoSlug: string, prNumber: number, reason: string) {
  logger.logStep(`Skipped without usable data.json ${repoSlug}#${prNumber}: ${reason}`);
  return 'skipped-without-data-json' as const;
}

function formatPullRequestNumber(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) ? String(value) : 'unknown';
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatError(error: unknown) {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const code =
    'code' in error && typeof error.code === 'string'
      ? error.code
      : 'status' in error && typeof error.status === 'number'
        ? String(error.status)
        : null;
  const stderr = 'stderr' in error ? formatCommandOutput(error.stderr) : null;
  const stdout = 'stdout' in error ? formatCommandOutput(error.stdout) : null;
  const details = [
    code ? `code ${code}` : null,
    stderr ? `stderr: ${stderr}` : null,
    !stderr && stdout ? `stdout: ${stdout}` : null,
  ]
    .filter((value): value is string => Boolean(value))
    .join(' | ');

  return details ? `${error.message} | ${details}` : error.message;
}

function formatCommandOutput(value: unknown) {
  const text =
    typeof value === 'string' ? value : value instanceof Buffer ? value.toString('utf8') : null;

  if (!text) {
    return null;
  }

  const normalized = text.replace(/\s+/g, ' ').trim();
  return normalized.length > 300 ? `${normalized.slice(0, 297)}...` : normalized;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await main();
  } catch (error) {
    logger.logError(`Collector failed: ${formatError(error)}`);
    process.exitCode = 1;
  }
}
