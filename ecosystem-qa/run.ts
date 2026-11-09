import { execFileSync } from 'node:child_process';
import {
  appendFileSync,
  copyFileSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  statfsSync,
  writeFileSync,
} from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { claudeCode, codex, Output, run, StructuredOutputError } from '@ai-hero/sandcastle';
import { bwrap } from '@ai-hero/sandcastle/sandboxes/bwrap';
import { docker } from '@ai-hero/sandcastle/sandboxes/docker';
import { noSandbox } from '@ai-hero/sandcastle/sandboxes/no-sandbox';
import { seatbelt } from '@ai-hero/sandcastle/sandboxes/seatbelt';
import { join, relative, resolve } from 'pathe';
import { z } from 'zod';

import { renderChecklist } from './checks.ts';
import { loadCatalogEntry } from './lib/catalog.ts';
import { runFake } from './lib/fake-run.ts';
import { AgentOutput, Effort, Engine, RunResultFile, SandboxKind } from './lib/schema.ts';
import type { CatalogEntry, Os, Outcome, RunRequest } from './lib/types.ts';
import { usageFromStream } from './lib/usage.ts';

const HELP = `Usage: node ecosystem-qa/run.ts --repo <catalog id> --version <storybook version> --engine <claude|codex> --sandbox <docker|bwrap|seatbelt|none> --out <dir>

Options:
  --model <id>        Model id (default: claude-sonnet-5-5 for claude, gpt-6.1-sol for codex)
  --effort <level>    low, medium or high (default: medium)
  --clone-dir <dir>   Where to clone the catalog repo (default: <out>/../../../work/<id>)
  --image <name>      Docker image for --sandbox docker (default: sb-ecosystem-qa)

Writes <out>/result.json and exits 0 whenever it did, findings or not.
Set ECOSYSTEM_QA_FAKE=1 and pass --engine fake to write a canned result without running an agent.`;

const DEFAULT_MODEL: Record<z.infer<typeof Engine>, string> = {
  claude: 'claude-sonnet-5-5',
  codex: 'gpt-6.1-sol',
};

const API_KEY_ENV: Record<z.infer<typeof Engine>, string> = {
  claude: 'ANTHROPIC_API_KEY',
  codex: 'CODEX_API_KEY',
};

const INSTALL_COMMAND: Record<CatalogEntry['packageManager'], string> = {
  npm: 'npm ci',
  pnpm: 'pnpm install --frozen-lockfile',
  yarn: 'yarn install --immutable',
};

const STORYBOOK_CLI: Record<CatalogEntry['packageManager'], (version: string) => string> = {
  npm: (version) => `npx storybook@${version}`,
  pnpm: (version) => `pnpm dlx storybook@${version}`,
  yarn: (version) => `yarn dlx storybook@${version}`,
};

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
      effort: { type: 'string', default: 'medium' },
      'clone-dir': { type: 'string' },
      image: { type: 'string', default: 'sb-ecosystem-qa' },
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
  const [major, minor] = version.split('.');
  if (!major || !minor) {
    return fail(`--version "${version}" is not a Storybook version.`);
  }
  const os = HOST_OS[process.platform] ?? fail(`Unsupported platform ${process.platform}.`);
  const isFake = values.engine === 'fake';
  if (isFake && process.env.ECOSYSTEM_QA_FAKE !== '1') {
    return fail('--engine fake needs ECOSYSTEM_QA_FAKE=1.');
  }
  const engine = isFake ? 'claude' : Engine.parse(values.engine);
  const entry = loadCatalogEntry(repo);
  const outDir = resolve(out);
  const request: RunRequest = {
    entry,
    version,
    engine,
    model: values.model ?? DEFAULT_MODEL[engine],
    effort: Effort.parse(values.effort),
    sandbox: SandboxKind.parse(values.sandbox),
    os,
    outDir,
    monorepoDir: resolve(QA_DIR, '..'),
    // One branch per os and engine, so parallel runs of the same cycle never race on a push.
    cycleBranch: `qa/sb-${major}.${minor}/${os}-${engine}`,
  };
  const cloneDir = resolve(values['clone-dir'] ?? join(outDir, '../../../work', entry.id));
  return { request, isFake, cloneDir, image: values.image };
};

const clone = (entry: CatalogEntry, cloneDir: string): string => {
  if (existsSync(cloneDir)) {
    return fail(`${cloneDir} already exists. Delete it or pass another --clone-dir.`);
  }
  git(process.cwd(), 'clone', '--quiet', `https://github.com/${entry.repo}`, cloneDir);
  git(cloneDir, 'checkout', '--quiet', '-B', 'qa/start', entry.ref);
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
}

const planSandbox = (request: RunRequest, evidenceDir: string, image: string): SandboxPlan => {
  const toolsDir = join(QA_DIR, 'tools');
  const migrationFile = join(request.monorepoDir, 'MIGRATION.md');
  const identity = (path: string, readonly: boolean) => ({
    hostPath: path,
    sandboxPath: path,
    readonly,
  });
  const toolMounts = [identity(toolsDir, true), identity(join(QA_DIR, 'node_modules'), true)];
  const nativeMounts = [...toolMounts, identity(migrationFile, true), identity(evidenceDir, false)];
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
      };
    }
    case 'bwrap':
      return {
        provider: bwrap({ mounts: nativeMounts }),
        toolsDir,
        migrationFile,
        evidenceDir,
      };
    case 'seatbelt':
      return {
        provider: seatbelt({ mounts: nativeMounts }),
        toolsDir,
        migrationFile,
        evidenceDir,
      };
    case 'none':
      return { provider: noSandbox(), toolsDir, migrationFile, evidenceDir };
  }
};

const agentFor = (request: RunRequest) => {
  const keyName = API_KEY_ENV[request.engine];
  const key = process.env[keyName] || fail(`${keyName} is not set.`);
  return request.engine === 'claude'
    ? claudeCode(request.model, { effort: request.effort, env: { ANTHROPIC_API_KEY: key } })
    : codex(request.model, { effort: request.effort, env: { CODEX_API_KEY: key } });
};

const statusOf = (error: unknown): Outcome['status'] => {
  if (error instanceof StructuredOutputError) {
    return 'output-invalid';
  }
  const tag = (error as { _tag?: unknown } | null)?._tag;
  return tag === 'AgentIdleTimeoutError' ? 'timeout' : 'agent-failed';
};

const runSandcastle = async (
  request: RunRequest,
  cloneDir: string,
  image: string
): Promise<Outcome> => {
  const agent = agentFor(request);
  const evidenceDir = join(request.outDir, 'evidence');
  const startSha = clone(request.entry, cloneDir);
  const { packageManager, storybookDir, repo } = request.entry;
  const stream = createWriteStream(join(request.outDir, 'agent-stream.jsonl'));
  let sessionSource: string | undefined;
  let output: Outcome['output'];
  let failure: { status: Outcome['status']; error: string } | undefined;

  try {
    const plan = planSandbox(request, evidenceDir, image);
    const result = await run({
      cwd: cloneDir,
      agent,
      sandbox: plan.provider,
      name: `${request.entry.id}-${request.os}-${request.engine}`,
      branchStrategy: { type: 'branch', branch: request.cycleBranch },
      promptFile: PROMPT_FILE,
      promptArgs: {
        REPO: repo,
        VERSION: request.version,
        STORYBOOK_DIR: storybookDir,
        PACKAGE_MANAGER: packageManager,
        INSTALL_COMMAND: INSTALL_COMMAND[packageManager],
        UPGRADE_COMMAND: `${STORYBOOK_CLI[packageManager](request.version)} upgrade --yes`,
        STORYBOOK_CLI: STORYBOOK_CLI[packageManager](request.version),
        OS: request.os,
        MIGRATION_FILE: plan.migrationFile,
        TOOLS_DIR: plan.toolsDir,
        EVIDENCE_DIR: plan.evidenceDir,
        CHECKLIST: renderChecklist(),
        OUTPUT_SCHEMA: JSON.stringify(z.toJSONSchema(AgentOutput), null, 2),
      },
      output: Output.object({ tag: 'qa-result', schema: AgentOutput, maxRetries: 2 }),
      hooks: {
        sandbox: {
          onSandboxReady: [
            {
              command: `node "${plan.toolsDir}/timed.mjs" "${plan.evidenceDir}/install-seconds.txt" ${INSTALL_COMMAND[packageManager]}`,
              timeoutMs: 20 * 60_000,
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
    }
  } finally {
    await new Promise((done) => stream.end(done));
  }

  const branchRef = `refs/heads/${request.cycleBranch}`;
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
  if (!existsSync(streamFile)) {
    writeFileSync(streamFile, '');
  }
  if (outcome.sessionSource && existsSync(outcome.sessionSource)) {
    copyFileSync(outcome.sessionSource, join(outDir, 'session.jsonl'));
  }
  const usage = usageFromStream(streamFile, request.engine, request.model);
  if (usage.usd === null) {
    console.warn(`No price for model "${request.model}" in pricing.json; usd is null.`);
  }
  const installSeconds = readInstallSeconds(join(outDir, 'evidence/install-seconds.txt'));
  const { outDir: _out, monorepoDir: _monorepo, ...recorded } = request;
  const result = RunResultFile.parse({
    request: recorded,
    storybookVersionInstalled: outcome.output?.storybookVersionInstalled ?? null,
    startSha: outcome.startSha,
    cycleBranch: request.cycleBranch,
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
    machine: { os: request.os, node: process.version, freeDiskMbAtEnd: freeDiskMb(outDir) },
    paths: {
      runLog: 'run.log',
      evidenceDir: 'evidence',
      ...(existsSync(join(outDir, 'session.jsonl')) ? { session: 'session.jsonl' } : {}),
      ...(outcome.bundle ? { bundle: outcome.bundle } : {}),
    },
    status: outcome.status,
    ...(outcome.error ? { error: outcome.error } : {}),
  });
  writeFileSync(join(outDir, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);
  return result;
};

const summarize = (result: z.infer<typeof RunResultFile>, resultPath: string): string => {
  const failed = result.checks.filter((check) => check.state === 'fail').length;
  const { ratesVerifiedOn } = result.usage;
  const usd =
    result.usage.usd === null
      ? 'unpriced'
      : `$${result.usage.usd.toFixed(2)}${ratesVerifiedOn ? ` (priced with rates verified on ${ratesVerifiedOn})` : ''}`;
  return [
    `${result.request.entry.repo} on ${result.request.os} with ${result.request.engine} (${result.request.model}) finished with status ${result.status} in ${result.timing.wallSeconds}s.`,
    `Storybook ${result.storybookVersionInstalled ?? 'version unknown'} installed, ${result.checks.length} checks reported, ${failed} failed, ${result.findings.length} findings.`,
    `Usage was ${result.usage.inputTokens} input, ${result.usage.outputTokens} output, ${result.usage.cacheReadTokens ?? 0} cache-read and ${result.usage.cacheWriteTokens ?? 0} cache-write tokens, ${usd}.`,
    `Cycle branch ${result.cycleBranch} head ${result.headSha ?? 'has no commits'}. Result: ${resultPath}.`,
    ...(result.error ? [`Error: ${result.error}`] : []),
  ].join(' ');
};

const { request, isFake, cloneDir, image } = parseRequest();
const startedAt = new Date();
mkdirSync(join(request.outDir, 'evidence'), { recursive: true });
const outcome = isFake ? runFake(request) : await runSandcastle(request, cloneDir, image);
const result = writeResult(request, outcome, startedAt);
console.log(summarize(result, relative(process.cwd(), join(request.outDir, 'result.json'))));
