import { execFileSync } from 'node:child_process';
import {
  appendFileSync,
  copyFileSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  statfsSync,
  writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { claudeCode, codex, Output, run, StructuredOutputError } from '@ai-hero/sandcastle';
import { bwrap } from '@ai-hero/sandcastle/sandboxes/bwrap';
import { docker } from '@ai-hero/sandcastle/sandboxes/docker';
import { noSandbox } from '@ai-hero/sandcastle/sandboxes/no-sandbox';
import { seatbelt } from '@ai-hero/sandcastle/sandboxes/seatbelt';
import { join, relative, resolve } from 'pathe';
import { z } from 'zod';

import { checksFor, renderChecklist } from './checks.ts';
import { answerFromLog } from './lib/answer.ts';
import { loadCatalogEntry } from './lib/catalog.ts';
import { cycleBranchName, cycleRepo, versionLine } from './lib/cycle.ts';
import { runFake } from './lib/fake-run.ts';
import {
  agentOutput,
  Effort,
  Engine,
  SandboxKind,
  Tier,
  type CatalogEntry,
  type Os,
  type RunResultFile,
} from './lib/schema.ts';
import { writeStepSummary } from './lib/step-summary.ts';
import type { Outcome, RunRequest } from './lib/types.ts';
import { redactTree } from './lib/redact.ts';
import { upgraded } from './lib/results.ts';
import { usageFromStream } from './lib/usage.ts';

const HELP = `Usage: node ecosystem-qa/run.ts --repo <catalog id> --version <storybook version> --engine <claude|codex> --sandbox <docker|bwrap|seatbelt|none> --out <dir>

Options:
  --model <id>        Model id (default: claude-haiku-5-5 for claude, gpt-6.1-sol for codex)
  --effort <level>    low, medium or high (default: low)
  --tier <tier>       must (default) runs the checks every sweep needs; extended runs all of them
  --clone-dir <dir>   Where to clone the catalog repo (default: <tmpdir>/ecosystem-qa/work/<id>)
  --image <name>      Docker image for --sandbox docker (default: sb-ecosystem-qa)

Writes <out>/result.json and exits 0 whenever it did, findings or not.
Set ECOSYSTEM_QA_FAKE=1 and pass --fake to write a canned result for --engine without running an agent;
the result records fake: true and costs $0.`;

// The cheapest configuration that found every known mealdrop finding in the bake-off (SB-2504).
const DEFAULT_MODEL: Record<Engine, string> = {
  claude: 'claude-haiku-5-5',
  codex: 'gpt-6.1-sol',
};

// The first variable that is set wins. CLAUDE_CODE_OAUTH_TOKEN (from `claude setup-token`) bills a
// subscription, for local runs; CI passes the API key.
const CREDENTIAL_ENV: Record<Engine, string[]> = {
  claude: ['ANTHROPIC_API_KEY', 'CLAUDE_CODE_OAUTH_TOKEN'],
  codex: ['CODEX_API_KEY'],
};

const INSTALL_COMMAND: Record<CatalogEntry['packageManager'], string> = {
  npm: 'npm ci',
  pnpm: 'pnpm install --frozen-lockfile',
  yarn: 'yarn install --immutable',
  bun: 'bun install --frozen-lockfile',
};

const STORYBOOK_CLI: Record<CatalogEntry['packageManager'], (version: string) => string> = {
  npm: (version) => `npx storybook@${version}`,
  pnpm: (version) => `pnpm dlx storybook@${version}`,
  yarn: (version) => `yarn dlx storybook@${version}`,
  bun: (version) => `bunx storybook@${version}`,
};

// The upgrade must rewrite the lockfile, but GitHub runners set CI and GITHUB_ACTIONS, which make
// yarn and pnpm default to a frozen install. Both detect CI with ci-info, which treats CI=false as
// not CI even when GITHUB_ACTIONS is set; an empty CI is still detected through GITHUB_ACTIONS.
const UPGRADE_ENV = {
  CI: 'false',
  YARN_ENABLE_IMMUTABLE_INSTALLS: 'false',
  npm_config_frozen_lockfile: 'false',
  // The version under test is usually days old, and the sandbox exists to run code nobody has
  // reviewed, so a project's release-age gate must not stop the upgrade.
  YARN_NPM_MINIMAL_AGE_GATE: '0',
  pnpm_config_minimum_release_age: '0',
  npm_config_min_release_age: '0',
};

// The real path, because git writes real paths into a worktree's gitdir pointer and the sandboxes
// bind-mount whatever path they are given: on macOS tmpdir() is a symlink under /private.
const scratchDir = () => join(realpathSync(tmpdir()), 'ecosystem-qa');

const HOST_OS: Partial<Record<NodeJS.Platform, Os>> = {
  linux: 'linux',
  win32: 'windows',
  darwin: 'macos',
};

const QA_DIR = fileURLToPath(new URL('.', import.meta.url));
const PROMPT_FILE = join(QA_DIR, 'prompts/upgrade.md');
const DOCKER_HOME = '/home/agent';

const fail = (message: string): never => {
  console.error(`${message}\n\n${HELP}`);
  process.exit(1);
};

const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

const parseRequest = () => {
  const { values } = parseArgs({
    options: {
      repo: { type: 'string' },
      version: { type: 'string' },
      engine: { type: 'string' },
      sandbox: { type: 'string' },
      out: { type: 'string' },
      model: { type: 'string' },
      effort: { type: 'string', default: 'low' },
      tier: { type: 'string', default: 'must' },
      'clone-dir': { type: 'string' },
      image: { type: 'string', default: 'sb-ecosystem-qa' },
      fake: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
  });

  if (values.help) {
    console.log(HELP);
    process.exit(0);
  }

  const { repo, version, out } = values;

  if (!repo || !version || !out || !values.engine || !values.sandbox) {
    return fail('Missing one of --repo, --version, --engine, --sandbox, --out.');
  }

  try {
    versionLine(version);
  } catch (error) {
    return fail((error as Error).message);
  }

  const os = HOST_OS[process.platform] ?? fail(`Unsupported platform ${process.platform}.`);

  if (values.fake && process.env.ECOSYSTEM_QA_FAKE !== '1') {
    return fail('--fake needs ECOSYSTEM_QA_FAKE=1.');
  }

  const engine = Engine.parse(values.engine);
  const entry = loadCatalogEntry(repo);
  const outDir = resolve(out);
  const request: RunRequest = {
    entry,
    version,
    engine,
    model: values.model ?? DEFAULT_MODEL[engine],
    effort: Effort.parse(values.effort),
    tier: Tier.parse(values.tier),
    sandbox: SandboxKind.parse(values.sandbox),
    os,
    fake: values.fake,
    outDir,
    monorepoDir: resolve(QA_DIR, '..'),
  };
  // Outside the monorepo: yarn and npm read every .yarnrc and .npmrc above the clone, and a native
  // sandbox denies the monorepo's own config files to the agent.
  const cloneDir = resolve(values['clone-dir'] ?? join(scratchDir(), 'work', entry.id));

  return { request, cloneDir, image: values.image };
};

const clone = (entry: CatalogEntry, cloneDir: string): string => {
  if (existsSync(cloneDir)) {
    return fail(`${cloneDir} already exists. Delete it or pass another --clone-dir.`);
  }
  // The larger catalog repos have several GB of history and a run only needs the start commit.
  git(process.cwd(), 'init', '--quiet', cloneDir);
  git(cloneDir, 'remote', 'add', 'origin', `https://github.com/${cycleRepo(entry)}`);
  git(cloneDir, 'fetch', '--quiet', '--depth', '1', 'origin', entry.ref);
  git(cloneDir, 'checkout', '--quiet', '-B', 'qa/start', 'FETCH_HEAD');
  git(cloneDir, 'config', 'user.name', 'Storybook Ecosystem QA');
  git(cloneDir, 'config', 'user.email', 'ecosystem-qa@storybook.js.org');
  appendFileSync(join(cloneDir, '.git/info/exclude'), '\n.sandcastle/\nqa-artifacts/\n*.log\n');
  return git(cloneDir, 'rev-parse', 'HEAD');
};

interface SandboxPlan {
  provider: Parameters<typeof run>[0]['sandbox'];
  toolsDir: string;
  migrationFile: string;
  evidenceDir: string;
  // Extra variables the agent process needs inside this sandbox.
  agentEnv: Record<string, string>;
}

const planSandbox = (
  request: RunRequest,
  cloneDir: string,
  evidenceDir: string,
  image: string
): SandboxPlan => {
  const toolsDir = join(QA_DIR, 'tools');
  const migrationFile = join(request.monorepoDir, 'MIGRATION.md');
  const identity = (path: string, readonly: boolean) => ({
    hostPath: path,
    sandboxPath: path,
    readonly,
  });
  const toolMounts = [identity(toolsDir, true), identity(join(QA_DIR, 'node_modules'), true)];
  // Package managers read every rc file from the working directory up to the root, and the yarn 1
  // shim reads the real home's .yarnrc rather than the sandbox's private home. The agent's worktree
  // sits under the clone, so the native sandboxes expose those files read-only, one by one: a
  // read-only mount of the whole clone would also deny writes inside the worktree. The home .npmrc
  // stays hidden, it can hold a registry token.
  // Playwright looks for its browsers under the home it is given, so the host's cache comes along,
  // read-only, or every browser-backed check in the sandbox reports a missing executable.
  const rcMounts = [
    join(homedir(), '.yarnrc'),
    join(homedir(), 'Library/Caches/ms-playwright'),
    join(homedir(), '.cache/ms-playwright'),
    ...['.yarnrc', '.yarnrc.yml', '.npmrc'].map((name) => join(cloneDir, name)),
  ]
    .filter((path) => existsSync(path))
    .map((path) => identity(path, true));
  // Claude Code keeps its own state under /tmp/claude-<uid> on the host whatever TMPDIR says, which
  // a native sandbox denies, so it gets a directory of its own that the sandbox can write.
  const agentTmp = join(scratchDir(), 'agent-tmp', request.entry.id);
  mkdirSync(agentTmp, { recursive: true });
  const nativeMounts = [
    ...toolMounts,
    ...rcMounts,
    identity(migrationFile, true),
    identity(evidenceDir, false),
    identity(agentTmp, false),
  ];
  const nativeEnv = { CLAUDE_CODE_TMPDIR: agentTmp };
  switch (request.sandbox) {
    case 'docker': {
      const sandboxMigration = `${DOCKER_HOME}/qa-input/MIGRATION.md`;
      const sandboxEvidence = `${DOCKER_HOME}/qa-evidence`;
      return {
        provider: docker({
          imageName: image,
          mounts: [
            ...toolMounts,
            { hostPath: migrationFile, sandboxPath: sandboxMigration, readonly: true },
            { hostPath: evidenceDir, sandboxPath: sandboxEvidence },
          ],
        }),
        toolsDir,
        migrationFile: sandboxMigration,
        evidenceDir: sandboxEvidence,
        agentEnv: {},
      };
    }
    case 'bwrap':
      return {
        provider: bwrap({ mounts: nativeMounts }),
        toolsDir,
        migrationFile,
        evidenceDir,
        agentEnv: nativeEnv,
      };
    case 'seatbelt':
      return {
        provider: seatbelt({ mounts: nativeMounts }),
        toolsDir,
        migrationFile,
        evidenceDir,
        agentEnv: nativeEnv,
      };
    case 'none':
      return { provider: noSandbox(), toolsDir, migrationFile, evidenceDir, agentEnv: {} };
  }
};

const agentFor = (request: RunRequest, agentEnv: Record<string, string>) => {
  const names = CREDENTIAL_ENV[request.engine];
  const keyName =
    names.find((name) => process.env[name]) ?? fail(`None of ${names.join(', ')} is set.`);
  const options = {
    effort: request.effort,
    env: { ...UPGRADE_ENV, ...agentEnv, [keyName]: process.env[keyName]! },
  };
  return request.engine === 'claude'
    ? claudeCode(request.model, options)
    : codex(request.model, options);
};

const statusOf = (error: unknown): Outcome['status'] => {
  if (error instanceof StructuredOutputError) {
    return 'output-invalid';
  }
  return error instanceof Object && '_tag' in error && error._tag === 'AgentIdleTimeoutError'
    ? 'timeout'
    : 'agent-failed';
};

const runSandcastle = async (
  request: RunRequest,
  cloneDir: string,
  image: string
): Promise<Outcome> => {
  const evidenceDir = join(request.outDir, 'evidence');
  const cycleBranch = cycleBranchName(request.version, request.os, request.engine);
  const startSha = clone(request.entry, cloneDir);
  const { packageManager, storybookDir, repo } = request.entry;
  const stream = createWriteStream(join(request.outDir, 'agent-stream.jsonl'));

  let sessionSource: string | undefined;
  let output: Outcome['output'];
  let failure: { status: Outcome['status']; error: string } | undefined;
  const answerSchema = agentOutput(checksFor(request.tier).map((check) => check.id));

  try {
    const plan = planSandbox(request, cloneDir, evidenceDir, image);
    const agent = agentFor(request, plan.agentEnv);
    // Only the Docker image carries `n`.
    const useNodeFlag =
      request.sandbox === 'docker'
        ? `--use-node${request.entry.node ? `=${request.entry.node}` : ''}`
        : '';
    const result = await run({
      cwd: cloneDir,
      agent,
      sandbox: plan.provider,
      name: `${request.entry.id}-${request.os}-${request.engine}`,
      branchStrategy: { type: 'branch', branch: cycleBranch },
      promptFile: PROMPT_FILE,
      promptArgs: {
        REPO: repo,
        VERSION: request.version,
        MAJOR: versionLine(request.version).split('.')[0]!,
        STORYBOOK_DIR: storybookDir,
        PACKAGE_MANAGER: packageManager,
        INSTALL_COMMAND: INSTALL_COMMAND[packageManager],
        UPGRADE_COMMAND: `${STORYBOOK_CLI[packageManager](request.version)} upgrade --yes`,
        STORYBOOK_CLI: STORYBOOK_CLI[packageManager](request.version),
        OS: request.os,
        MIGRATION_FILE: plan.migrationFile,
        TOOLS_DIR: plan.toolsDir,
        EVIDENCE_DIR: plan.evidenceDir,
        CHECKLIST: renderChecklist(request.tier),
        OUTPUT_SCHEMA: JSON.stringify(z.toJSONSchema(answerSchema), null, 2),
      },
      output: Output.object({ tag: 'qa-result', schema: answerSchema, maxRetries: 2 }),
      hooks: {
        ...(request.sandbox === 'docker'
          ? { host: { onSandboxReady: [{ command: `node "${plan.toolsDir}/cap-memory.mjs"` }] } }
          : {}),
        sandbox: {
          onSandboxReady: [
            {
              command: `node "${plan.toolsDir}/timed.mjs" ${useNodeFlag} "${plan.evidenceDir}/install-seconds.txt" ${INSTALL_COMMAND[packageManager]}`,
              timeoutMs: 25 * 60_000,
            },
          ],
        },
      },
      idleTimeoutSeconds: 900,
      logging: {
        type: 'file',
        path: join(request.outDir, 'run.log'),
        onAgentStreamEvent: (event) => {
          if (event.type === 'raw') {
            stream.write(`${event.line}\n`);
          } else if (event.type === 'text') {
            console.log(event.message.trim());
          } else if (event.type === 'toolCall') {
            console.log(
              `▶ ${event.name}(${event.formattedArgs.replace(/\s+/g, ' ').slice(0, 300)})`
            );
          }
        },
      },
    });
    output = result.output;
    sessionSource = result.iterations.at(-1)?.sessionFilePath;
  } catch (error) {
    failure = { status: statusOf(error), error: String(error) };
    if (error instanceof StructuredOutputError) {
      sessionSource = error.sessionFilePath;
    } else {
      const logFile = join(request.outDir, 'run.log');
      const answer = existsSync(logFile)
        ? answerFromLog(readFileSync(logFile, 'utf8'), answerSchema)
        : undefined;
      if (answer) {
        output = answer;
        failure = {
          status: 'ok',
          error: `The agent finished; the sandbox wrapper failed afterwards: ${failure.error}`,
        };
      }
    }
  } finally {
    await new Promise((done) => stream.end(done));
  }

  const branchRef = `refs/heads/${cycleBranch}`;
  const head = git(cloneDir, 'for-each-ref', '--format=%(objectname)', branchRef);
  const headSha = head && head !== startSha ? head : null;
  if (headSha) {
    git(
      cloneDir,
      'bundle',
      'create',
      join(request.outDir, 'cycle.bundle'),
      `${startSha}..${branchRef}`
    );
  }
  return {
    status: failure?.status ?? 'ok',
    ...(failure ? { error: failure.error } : {}),
    ...(output ? { output } : {}),
    startSha,
    headSha,
    ...(sessionSource ? { sessionSource } : {}),
    ...(headSha ? { bundle: 'cycle.bundle' } : {}),
  };
};

const readInstallSeconds = (file: string): number | undefined => {
  const seconds = existsSync(file) ? Number(readFileSync(file, 'utf8')) : Number.NaN;
  return Number.isFinite(seconds) ? seconds : undefined;
};

const freeDiskMb = (dir: string): number => {
  const stats = statfsSync(dir);
  return Math.round((stats.bavail * stats.bsize) / 1024 / 1024);
};

const writeResult = (request: RunRequest, outcome: Outcome, startedAt: Date) => {
  const finishedAt = new Date();
  const { outDir } = request;
  const streamFile = join(outDir, 'agent-stream.jsonl');
  if (outcome.sessionSource && existsSync(outcome.sessionSource)) {
    copyFileSync(outcome.sessionSource, join(outDir, 'session.jsonl'));
  }
  const counted = usageFromStream(streamFile, request.engine, request.model);
  const usage = request.fake ? { ...counted, usd: 0, priceSource: 'agent' as const } : counted;
  if (usage.usd === null) {
    console.warn(`No price for model "${request.model}" in the shared price table; usd is null.`);
  }
  const installSeconds = readInstallSeconds(join(outDir, 'evidence/install-seconds.txt'));
  const { outDir: _out, monorepoDir: _monorepo, ...recorded } = request;
  const result: RunResultFile = {
    request: recorded,
    storybookVersionBefore: outcome.output?.storybookVersionBefore ?? null,
    storybookVersionInstalled: outcome.output?.storybookVersionInstalled ?? null,
    startSha: outcome.startSha,
    headSha: outcome.headSha,
    checks: outcome.output?.checks ?? [],
    findings: outcome.output?.findings ?? [],
    usage,
    timing: {
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      wallSeconds: Math.round((finishedAt.getTime() - startedAt.getTime()) / 1000),
      ...(installSeconds === undefined ? {} : { installSeconds }),
    },
    machine: { node: process.version, freeDiskMbAtEnd: freeDiskMb(outDir) },
    paths: {
      runLog: 'run.log',
      evidenceDir: 'evidence',
      ...(existsSync(join(outDir, 'session.jsonl')) ? { session: 'session.jsonl' } : {}),
      ...(outcome.bundle ? { bundle: outcome.bundle } : {}),
    },
    status: outcome.status,
    ...(outcome.error ? { error: outcome.error } : {}),
  };
  // Written to a sibling first: an interrupted write must never leave a truncated result.json.
  const resultFile = join(outDir, 'result.json');
  writeFileSync(`${resultFile}.tmp`, `${JSON.stringify(result, null, 2)}\n`);
  renameSync(`${resultFile}.tmp`, resultFile);
  return result;
};

const engineLabel = ({ request }: RunResultFile) =>
  request.fake ? `${request.engine} (fake)` : request.engine;

const summarize = (result: RunResultFile, resultPath: string): string => {
  const failed = result.checks.filter((check) => check.state === 'fail').length;
  const usd =
    result.usage.usd === null
      ? 'unpriced'
      : `$${result.usage.usd.toFixed(2)}${result.usage.priceSource === 'table' ? ' (priced from the shared price table, not from the agent)' : ''}`;
  return [
    `${result.request.entry.repo} on ${result.request.os} with ${engineLabel(result)} (${result.request.model}) finished with status ${result.status} in ${result.timing.wallSeconds}s.`,
    `${
      upgraded(result)
        ? `Storybook ${result.storybookVersionInstalled} installed`
        : `The upgrade to ${result.request.version} did not happen; Storybook is on ${result.storybookVersionInstalled ?? 'an unknown version'}`
    }${result.timing.installSeconds === undefined ? '' : ` (the project install took ${result.timing.installSeconds}s)`}, ${result.checks.length} checks reported, ${failed} failed, ${result.findings.length} findings.`,
    `Usage was ${result.usage.inputTokens} input, ${result.usage.outputTokens} output, ${result.usage.cacheReadTokens ?? 0} cache-read and ${result.usage.cacheWriteTokens ?? 0} cache-write tokens, ${usd}.`,
    `Cycle branch ${cycleBranchName(result.request.version, result.request.os, result.request.engine)} head ${result.headSha ?? 'has no commits'}.${result.machine.freeDiskMbAtEnd === undefined ? '' : ` ${result.machine.freeDiskMbAtEnd} MB disk free at the end.`} Result: ${resultPath}.`,
    ...(result.error ? [`Error: ${result.error}`] : []),
  ].join(' ');
};

const { request, cloneDir, image } = parseRequest();
const startedAt = new Date();
mkdirSync(join(request.outDir, 'evidence'), { recursive: true });
const outcome = request.fake ? runFake(request) : await runSandcastle(request, cloneDir, image);
const result = writeResult(request, outcome, startedAt);
// The whole output directory becomes a public artifact, agent stream and session included, and the
// agent holds the provider key, so nothing with a credential shape may stay in it.
redactTree(request.outDir);
const summary = summarize(result, relative(process.cwd(), join(request.outDir, 'result.json')));
console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY) {
  writeStepSummary(
    [
      `### ${result.request.entry.repo} on ${result.request.os} with ${engineLabel(result)}`,
      '',
      summary,
      '',
      ...result.checks.map(
        (check) => `- \`${check.id}\`: ${check.state}${check.note ? ` (${check.note})` : ''}`
      ),
      '',
    ].join('\n')
  );
}
