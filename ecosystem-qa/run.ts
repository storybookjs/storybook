import { execFileSync } from 'node:child_process';
import {
  appendFileSync,
  copyFileSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  statfsSync,
  writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { claudeCode, codex, createSandbox, type LoggingOption } from '@ai-hero/sandcastle';
import { bwrap } from '@ai-hero/sandcastle/sandboxes/bwrap';
import { docker } from '@ai-hero/sandcastle/sandboxes/docker';
import { noSandbox } from '@ai-hero/sandcastle/sandboxes/no-sandbox';
import { seatbelt } from '@ai-hero/sandcastle/sandboxes/seatbelt';
import { join, relative, resolve } from 'pathe';
import { z } from 'zod';

import { checksFor, renderChecklist } from './checks.ts';
import { answerAfterRepairs, answerOfFinishedAgent, type Reading } from './lib/answer.ts';
import { loadCatalogEntry } from './lib/catalog.ts';
import { shipsSandcastleFiles } from './lib/clone-guard.ts';
import { cycleBranchName, cycleRepo, versionLine } from './lib/cycle.ts';
import { runFake } from './lib/fake-run.ts';
import { outputOf, sampleLine, watchHost, type Report } from './lib/host-watch.ts';
import { forJobLog, liveLine } from './lib/live-log.ts';
import { memoryGuard } from './lib/memory-guard.ts';
import { CHECKOUT_GUIDE, guideFor } from './lib/migration-guide.ts';
import { budgetRecord, msUntilHardStop, parseBudget, type RunBudget } from './lib/run-budget.ts';
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
import { unsandboxedRefusal } from './lib/sandbox-policy.ts';
import { stopChildren } from './lib/stop-children.ts';
import { usageFromStream } from './lib/usage.ts';
import {
  saveStoppedClaudeSession,
  stopAfterSilence,
  stopAtTimeLimit,
  within,
  WRAP_UP_MINUTES,
  wrapUpPrompt,
  type Stop,
} from './lib/wrap-up.ts';

const HELP = `Usage: node ecosystem-qa/run.ts --repo <catalog id> --version <storybook version> --engine <claude|codex> --sandbox <docker|bwrap|seatbelt|none> --out <dir>

Options:
  --model <id>        Model id (default: claude-haiku-5-5 for claude, gpt-6.1-sol for codex)
  --effort <level>    low, medium or high (default: low)
  --tier <tier>       must (default) runs the checks every sweep needs; extended runs all of them
  --clone-dir <dir>   Where to clone the catalog repo (default: <tmpdir>/ecosystem-qa/work/<id>)
  --image <name>      Docker image for --sandbox docker (default: sb-ecosystem-qa)
  --budget-minutes <n>     Minutes the agent is asked to answer within, from the start of the run (default: 90)
  --hard-stop-minutes <n>  Minute at which the runner stops the agent and asks it for its answer (default: 15 after the budget)

Writes <out>/result.json and exits 0 whenever it did, findings or not. <out> must be empty or new.
Set ECOSYSTEM_QA_FAKE=1 and pass --fake to write a canned result for --engine without running an agent;
the result records fake: true and costs $0.`;

// The cheapest configuration that found every known mealdrop finding in the bake-off.
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

const INSTALL_LIMIT_SECONDS = 25 * 60;

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
// Where Sandcastle's Docker sandbox mounts the worktree.
const DOCKER_WORKSPACE = `${DOCKER_HOME}/workspace`;

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
      'budget-minutes': { type: 'string' },
      'hard-stop-minutes': { type: 'string' },
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
  const budget = parseBudget(values['budget-minutes'], values['hard-stop-minutes']);
  if (typeof budget === 'string') {
    return fail(budget);
  }

  if (values.fake && process.env.ECOSYSTEM_QA_FAKE !== '1') {
    return fail('--fake needs ECOSYSTEM_QA_FAKE=1.');
  }

  const engine = Engine.parse(values.engine);
  const entry = loadCatalogEntry(repo);
  const sandbox = SandboxKind.parse(values.sandbox);
  // A fake run starts no agent and runs nothing of the repo.
  const refusal = sandbox === 'none' && !values.fake ? unsandboxedRefusal(entry, os) : undefined;
  if (refusal) {
    return fail(refusal);
  }
  const outDir = resolve(out);
  // A run owns its output directory: the log, the agent stream and the evidence of an earlier run
  // would otherwise be read as this run's.
  if (existsSync(outDir) && readdirSync(outDir).length > 0) {
    return fail(`${outDir} is not empty. Delete it or pass another --out.`);
  }
  const request: RunRequest = {
    entry,
    version,
    engine,
    model: values.model ?? DEFAULT_MODEL[engine],
    effort: Effort.parse(values.effort),
    tier: Tier.parse(values.tier),
    sandbox,
    os,
    fake: values.fake,
    outDir,
    monorepoDir: resolve(QA_DIR, '..'),
  };
  // Outside the monorepo: yarn and npm read every .yarnrc and .npmrc above the clone, and a native
  // sandbox denies the monorepo's own config files to the agent.
  const cloneDir = resolve(values['clone-dir'] ?? join(scratchDir(), 'work', entry.id));

  return { request, cloneDir, image: values.image, budget };
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
  if (shipsSandcastleFiles(cloneDir)) {
    return fail(
      `${cycleRepo(entry)} ships a .sandcastle directory. Sandcastle would give the agent the variables of its .env file, so this repo cannot run.`
    );
  }
  git(cloneDir, 'config', 'user.name', 'Storybook Ecosystem QA');
  git(cloneDir, 'config', 'user.email', 'ecosystem-qa@storybook.js.org');
  appendFileSync(join(cloneDir, '.git/info/exclude'), '\n.sandcastle/\nqa-artifacts/\n*.log\n');
  return git(cloneDir, 'rev-parse', 'HEAD');
};

interface SandboxPlan {
  provider: Parameters<typeof createSandbox>[0]['sandbox'];
  toolsDir: string;
  migrationFile: string;
  evidenceDir: string;
  // Extra variables the agent process needs inside this sandbox.
  agentEnv: Record<string, string>;
  hooks: NonNullable<Parameters<typeof createSandbox>[0]['hooks']>;
}

const planSandbox = (
  request: RunRequest,
  cloneDir: string,
  evidenceDir: string,
  image: string,
  migrationFile: string
): SandboxPlan => {
  const toolsDir = join(QA_DIR, 'tools');
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
  const rcMounts = [
    join(homedir(), '.yarnrc'),
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
  const { packageManager, node } = request.entry;
  const install = (evidence: string, nodeFlag: string[]) => ({
    command: [
      `node "${toolsDir}/timed.mjs"`,
      ...nodeFlag,
      `--limit-seconds=${INSTALL_LIMIT_SECONDS}`,
      `"${evidence}/install-seconds.txt"`,
      INSTALL_COMMAND[packageManager],
    ].join(' '),
  });
  const installHooks = { sandbox: { onSandboxReady: [install(evidenceDir, [])] } };
  if (request.sandbox !== 'docker' && node) {
    console.warn(
      `${request.entry.id} asks for Node ${node}, and only the Docker image can switch Node. This run uses the Node of the host.`
    );
  }
  switch (request.sandbox) {
    case 'docker': {
      const sandboxMigration = `${DOCKER_HOME}/qa-input/MIGRATION.md`;
      const sandboxEvidence = `${DOCKER_HOME}/qa-evidence`;
      return {
        provider: docker({
          imageName: image,
          env: UPGRADE_ENV,
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
        hooks: {
          host: {
            onSandboxReady: [
              {
                command: `node "${toolsDir}/cap-memory.mjs" "${evidenceDir}/memory-limit.txt" "${evidenceDir}/sandbox-container.txt"`,
              },
            ],
          },
          sandbox: {
            onSandboxReady: [install(sandboxEvidence, [`--use-node${node ? `=${node}` : ''}`])],
          },
        },
      };
    }
    case 'bwrap':
      return {
        provider: bwrap({ mounts: nativeMounts, env: UPGRADE_ENV }),
        toolsDir,
        migrationFile,
        evidenceDir,
        agentEnv: nativeEnv,
        hooks: installHooks,
      };
    case 'seatbelt':
      return {
        provider: seatbelt({ mounts: nativeMounts, env: UPGRADE_ENV }),
        toolsDir,
        migrationFile,
        evidenceDir,
        agentEnv: nativeEnv,
        hooks: installHooks,
      };
    case 'none':
      return {
        provider: noSandbox({ env: UPGRADE_ENV }),
        toolsDir,
        migrationFile,
        evidenceDir,
        agentEnv: {},
        hooks: installHooks,
      };
  }
};

const agentFor = (request: RunRequest, agentEnv: Record<string, string>) => {
  const names = CREDENTIAL_ENV[request.engine];
  const keyName =
    names.find((name) => process.env[name]) ?? fail(`None of ${names.join(', ')} is set.`);
  const options = {
    effort: request.effort,
    env: { ...agentEnv, [keyName]: process.env[keyName]! },
  };
  return request.engine === 'claude'
    ? claudeCode(request.model, options)
    : codex(request.model, options);
};

const IDLE_MINUTES = 15;

// Sandcastle hands the error of a sandbox run over in a wrapper that ends its name with the name
// of the error.
const isIdleTimeout = (error: unknown): boolean =>
  error instanceof Error && error.name.endsWith('AgentIdleTimeoutError');

const readNumber = (file: string): number | undefined => {
  const value = existsSync(file) ? Number(readFileSync(file, 'utf8')) : Number.NaN;
  return Number.isFinite(value) ? value : undefined;
};

const runSandcastle = async (
  request: RunRequest,
  cloneDir: string,
  image: string,
  startedAt: Date,
  budget: RunBudget
): Promise<Outcome> => {
  const evidenceDir = join(request.outDir, 'evidence');
  writeFileSync(join(evidenceDir, 'budget.json'), budgetRecord(startedAt, budget));
  const cycleBranch = cycleBranchName(request.version, request.os, request.engine);
  const startSha = clone(request.entry, cloneDir);
  const { packageManager, storybookDir, repo } = request.entry;
  const stream = createWriteStream(join(request.outDir, 'agent-stream.jsonl'));

  let sessionSource: string | undefined;
  let output: Outcome['output'];
  let failure: Pick<Outcome, 'status' | 'error'> | undefined;
  let recoveredFrom: string | undefined;
  let migrationGuide: string | undefined;
  let sandbox: Awaited<ReturnType<typeof createSandbox>> | undefined;
  let sessionId: string | undefined;
  let agentStarted = false;
  let cutShort: string | undefined;
  let stop:
    | {
        at: AbortSignal;
        ask: (why: Stop) => Promise<{
          reading: Reading<NonNullable<Outcome['output']>>;
          turn: { iterations: { sessionFilePath?: string }[] };
        }>;
      }
    | undefined;
  const logFile = join(request.outDir, 'run.log');
  const sandboxNameFile = join(evidenceDir, 'sandbox-container.txt');
  const probeGuard = memoryGuard({
    agent: request.engine,
    agentStarted: () => agentStarted,
    inSandbox: (container, command) => outputOf('docker', ['exec', container, ...command]),
    logFile: join(evidenceDir, 'memory-guard.log'),
    report: ({ line }) => console.log(line),
  });
  const report = ({ level, line }: Report) =>
    console.log(level === 'warning' && process.env.GITHUB_ACTIONS ? `::warning::${line}` : line);
  const watch = watchHost({
    file: join(evidenceDir, 'host-samples.jsonl'),
    startedAt,
    diskDir: request.outDir,
    // Sandcastle hands the sandbox over only after the project install, and the install is part of
    // what the watch is for.
    container: () =>
      sandbox?.sandboxId ??
      (existsSync(sandboxNameFile) ? readFileSync(sandboxNameFile, 'utf8').trim() : undefined),
    report,
    onSample: async (sample, container) => {
      console.log(
        `reading ${new Date().toISOString().slice(11, 19)}: ${sampleLine(sample)}, waiting now ${sample.container?.stalledNowPercent ?? '-'}%, cpu ${sample.container?.cpuPercent ?? '-'}%, late ${sample.lateSeconds ?? 0}s`
      );
      if (process.env.QA_PROBE_GUARD !== 'off') {
        await probeGuard(sample, container);
      }
    },
  });
  // One list for the schema, the checklist and the count the prompt names.
  const checks = checksFor(request.tier);
  const answerSchema = agentOutput(checks.map((check) => check.id));

  try {
    const guide = await guideFor(request.version, {
      checkout: join(request.monorepoDir, 'MIGRATION.md'),
      saveTo: join(scratchDir(), 'guides', `v${request.version}`, 'MIGRATION.md'),
    });
    migrationGuide = guide.ref;
    const plan = planSandbox(request, cloneDir, evidenceDir, image, guide.file);
    sandbox = await createSandbox({
      cwd: cloneDir,
      branch: cycleBranch,
      sandbox: plan.provider,
      hooks: plan.hooks,
    });
    // createSandbox does not look at how a hook ended, so the record of the install has to.
    const installExit = readNumber(join(evidenceDir, 'install-exit.txt'));
    if (installExit === undefined) {
      throw new Error('The project install did not run to its end: it left no exit status.');
    }
    if (existsSync(join(evidenceDir, 'install-stopped.txt'))) {
      throw new Error(
        `The project install did not finish within ${INSTALL_LIMIT_SECONDS / 60} minutes.`
      );
    }
    // The same signal goes to every repair turn, so the stop is one moment for the whole run.
    const hardStop = AbortSignal.timeout(msUntilHardStop(startedAt, budget));
    const agent = agentFor(request, plan.agentEnv);
    const name = `${request.entry.id}-${request.os}-${request.engine}`;
    const logging: LoggingOption = {
      type: 'file',
      path: logFile,
      onAgentStreamEvent: (event) => {
        if (event.type === 'raw') {
          stream.write(`${event.line}\n`);
          const started = agent
            .parseStreamLine(event.line)
            .find((parsed) => parsed.type === 'session_id');
          if (started?.type === 'session_id') {
            sessionId = started.sessionId;
          }
        } else if (event.type === 'text' || event.type === 'toolCall') {
          console.log(liveLine(event));
        }
      },
    };
    const box = sandbox;
    // An agent that is stopped in the middle of a turn has printed no answer. This ends what it
    // runs and asks it once, in the same session, for the answer with what it has.
    const askAfterStop = async (why: Stop) => {
      if (!sessionId) {
        throw new Error('it had not started a session.');
      }
      const hostFile = agent.sessionStorage?.hostSessionFilePath(cloneDir, sessionId);
      const container = box.sandboxId;
      if (request.sandbox === 'docker' && request.engine === 'claude' && hostFile && container) {
        await within(
          60,
          'Ending what the agent ran',
          box.exec('kill -TERM -1; sleep 3; kill -KILL -1; true')
        );
        saveStoppedClaudeSession({
          container,
          sessionId,
          sandboxCwd: DOCKER_WORKSPACE,
          sandboxHome: DOCKER_HOME,
          hostCwd: cloneDir,
          hostFile,
        });
        sessionSource = hostFile;
      } else if (request.sandbox === 'none') {
        stopChildren();
      } else {
        throw new Error(
          'only Claude Code in the Docker sandbox, or an agent without a sandbox, can be asked after a stop.'
        );
      }
      const turn = await box.run({
        agent,
        name,
        resumeSession: sessionId,
        prompt: wrapUpPrompt(why),
        signal: AbortSignal.timeout(WRAP_UP_MINUTES * 60_000),
        idleTimeoutSeconds: 300,
        logging,
      });
      return answerAfterRepairs(turn, answerSchema);
    };
    stop = { at: hardStop, ask: askAfterStop };
    agentStarted = true;
    const first = await sandbox.run({
      agent,
      signal: hardStop,
      name,
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
        CHECKLIST: renderChecklist(checks),
        CHECK_COUNT: String(checks.length),
        BUDGET_MINUTES: String(budget.minutes),
        HARD_STOP_MINUTES: String(budget.hardStopMinutes),
        OUTPUT_SCHEMA: JSON.stringify(z.toJSONSchema(answerSchema), null, 2),
      },
      idleTimeoutSeconds: IDLE_MINUTES * 60,
      logging,
    });
    sessionSource = first.iterations.at(-1)?.sessionFilePath;
    // The sandbox is still open here, so a repair is one more turn of the same session.
    const { reading, turn } = await answerAfterRepairs(first, answerSchema);
    sessionSource = turn.iterations.at(-1)?.sessionFilePath ?? sessionSource;
    if ('answer' in reading) {
      output = reading.answer;
    } else {
      failure = { status: 'output-invalid', error: reading.problem };
    }
  } catch (error) {
    // The sandbox can fail after an agent that had already answered, for example while it collects
    // the commits.
    const answer = existsSync(logFile)
      ? answerOfFinishedAgent(readFileSync(logFile, 'utf8'), answerSchema)
      : undefined;
    if (answer) {
      output = answer;
      recoveredFrom = String(error);
    } else if (stop && (stop.at.aborted || isIdleTimeout(error))) {
      const why = stop.at.aborted
        ? stopAtTimeLimit(budget.hardStopMinutes)
        : stopAfterSilence(IDLE_MINUTES);
      try {
        const { reading, turn } = await stop.ask(why);
        sessionSource = turn.iterations.at(-1)?.sessionFilePath ?? sessionSource;
        if ('answer' in reading) {
          output = reading.answer;
          cutShort = `${why.record} Asked for what it had, it gave this answer.`;
        } else {
          failure = {
            status: 'timeout',
            error: `${why.record} Asked for what it had, it gave no answer that could be used: ${reading.problem}`,
          };
        }
      } catch (problem) {
        failure = {
          status: 'timeout',
          error: `${why.record} It could not be asked for what it had: ${problem instanceof Error ? problem.message : String(problem)}`,
        };
      }
    } else {
      failure = { status: 'agent-failed', error: String(error) };
    }
  } finally {
    watch.stop();
    if (request.sandbox === 'none') {
      const stopped = stopChildren();
      if (stopped > 0) {
        console.warn(`Stopped ${stopped} process(es) that the run had left behind.`);
      }
    }
    // The answer is already read, so a sandbox that cannot be removed does not fail the run.
    if (sandbox) {
      await within(600, 'Closing the sandbox', sandbox.close()).catch((error: unknown) => {
        console.warn(forJobLog(`The sandbox could not be closed: ${String(error)}`));
        // A close that never returns keeps its docker process, and with it this one, alive. The
        // record is written within seconds from here.
        setTimeout(() => process.exit(), 60_000).unref();
      });
    }
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
    ...(recoveredFrom ? { recoveredFrom } : {}),
    ...(cutShort ? { cutShort } : {}),
    ...(migrationGuide ? { migrationGuide } : {}),
    ...(output ? { output } : {}),
    startSha,
    headSha,
    ...(sessionSource ? { sessionSource } : {}),
    ...(headSha ? { bundle: 'cycle.bundle' } : {}),
  };
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
  const installSeconds = readNumber(join(outDir, 'evidence/install-seconds.txt'));
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
    ...(outcome.recoveredFrom ? { recoveredFrom: outcome.recoveredFrom } : {}),
    ...(outcome.cutShort ? { cutShort: outcome.cutShort } : {}),
    ...(outcome.migrationGuide ? { migrationGuide: outcome.migrationGuide } : {}),
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
  const installed = upgraded(result)
    ? `Storybook ${result.storybookVersionInstalled} installed`
    : `The upgrade to ${result.request.version} did not happen; Storybook is on ${result.storybookVersionInstalled ?? 'an unknown version'}`;
  const installTime =
    result.timing.installSeconds === undefined
      ? ''
      : ` (the project install took ${result.timing.installSeconds}s)`;
  return [
    `${result.request.entry.repo} on ${result.request.os} with ${engineLabel(result)} (${result.request.model}) finished with status ${result.status} in ${result.timing.wallSeconds}s.`,
    `${installed}${installTime}, ${result.checks.length} checks reported, ${failed} failed, ${result.findings.length} findings.`,
    `Usage was ${result.usage.inputTokens} input, ${result.usage.outputTokens} output, ${result.usage.cacheReadTokens ?? 0} cache-read and ${result.usage.cacheWriteTokens ?? 0} cache-write tokens, ${usd}.`,
    `Cycle branch ${cycleBranchName(result.request.version, result.request.os, result.request.engine)} head ${result.headSha ?? 'has no commits'}.${result.machine.freeDiskMbAtEnd === undefined ? '' : ` ${result.machine.freeDiskMbAtEnd} MB disk free at the end.`} Result: ${resultPath}.`,
    ...(result.error ? [`Error: ${result.error}`] : []),
    ...(result.migrationGuide === CHECKOUT_GUIDE
      ? [
          `The agent read the migration guide of this checkout, because v${result.request.version} is not a tag of storybookjs/storybook.`,
        ]
      : []),
    ...(result.cutShort ? [result.cutShort] : []),
    ...(result.recoveredFrom
      ? [
          `The sandbox failed after the agent had finished, so the answer was read from the run log: ${result.recoveredFrom}`,
        ]
      : []),
  ].join(' ');
};

const { request, cloneDir, image, budget } = parseRequest();
const startedAt = new Date();
mkdirSync(join(request.outDir, 'evidence'), { recursive: true });
const outcome = request.fake
  ? runFake(request)
  : await runSandcastle(request, cloneDir, image, startedAt, budget);
const result = writeResult(request, outcome, startedAt);
// The whole output directory becomes a public artifact, agent stream and session included, and the
// agent holds the provider key, so nothing with a credential shape may stay in it.
redactTree(request.outDir);
const summary = forJobLog(
  summarize(result, relative(process.cwd(), join(request.outDir, 'result.json')))
);
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
