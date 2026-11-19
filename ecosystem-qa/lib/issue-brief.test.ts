import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  readSync,
  writeFileSync,
} from 'node:fs';

import { fs as memfs, vol } from 'memfs';
import { dirname, join } from 'pathe';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { gh, ghJson } from '../../scripts/utils/gh.ts';
import { cycleBranchName } from './cycle.ts';
import { ENTRY, finding, loaded, RUN_URL, VERSION } from './fixtures.ts';
import { fetchIssue, UNTRUSTED } from './issue-brief.ts';
import {
  groupFindings,
  renderCommentBody,
  renderIssueBody,
  toProposal,
  type QaIssue,
} from './proposals.ts';
import { discoveredEntries, parsePlan } from './qa-plan.ts';
import type { CatalogEntry, Finding } from './schema.ts';

vi.mock('node:fs', { spy: true });
vi.mock('../../scripts/utils/gh.ts', () => ({ gh: vi.fn(), ghJson: vi.fn() }));

// Read before the file system is redirected to memfs.
const PLAN_TEXT = readFileSync(new URL('./plan.fixture.md', import.meta.url), 'utf8');
const PLAN = parsePlan(PLAN_TEXT);
const PRIMER = discoveredEntries(PLAN)[0]!;

const REPO = 'storybookjs/storybook';
const OUT = '/out';

beforeEach(() => {
  vol.reset();
  vi.mocked(closeSync).mockImplementation(memfs.closeSync as typeof closeSync);
  vi.mocked(existsSync).mockImplementation(memfs.existsSync as typeof existsSync);
  vi.mocked(mkdirSync).mockImplementation(memfs.mkdirSync as typeof mkdirSync);
  vi.mocked(openSync).mockImplementation(memfs.openSync as typeof openSync);
  vi.mocked(readdirSync).mockImplementation(memfs.readdirSync as typeof readdirSync);
  vi.mocked(readFileSync).mockImplementation(memfs.readFileSync as typeof readFileSync);
  vi.mocked(readSync).mockImplementation(memfs.readSync as typeof readSync);
  vi.mocked(writeFileSync).mockImplementation(memfs.writeFileSync as typeof writeFileSync);
});

interface Artifact {
  name: string;
  expired?: boolean;
  // The files of the artifact, by their path inside it.
  files?: Record<string, string>;
}

interface GitHub {
  issue: { body: string; labels?: string[]; title?: string };
  comments?: string[];
  runs: Record<string, Artifact[]>;
  assets?: Record<string, string>;
}

const write = (path: string, content: string) => {
  memfs.mkdirSync(dirname(path), { recursive: true });
  memfs.writeFileSync(path, content);
};

// Answers the gh calls of the brief from `github`, and fails on any other, so a write would fail.
const serve = (github: GitHub) => {
  const artifactsOf = (run: string) => github.runs[run] ?? [];
  vi.mocked(ghJson).mockImplementation((args: string[]) => {
    const path = args.at(-1)!;
    const run = /actions\/runs\/(\d+)/.exec(path)?.[1] ?? '';
    if (path === `repos/${REPO}/issues/1`) {
      return {
        number: 1,
        title: github.issue.title ?? '[SB 11 QA]: A finding',
        state: 'open',
        labels: (github.issue.labels ?? ['bug', 'internal-qa']).map((name) => ({ name })),
        body: github.issue.body,
        comments: github.comments?.length ?? 0,
      };
    }
    if (path.startsWith(`repos/${REPO}/issues/1/comments`)) {
      return [
        (github.comments ?? []).map((body) => ({ body, user: { login: 'github-actions[bot]' } })),
      ];
    }
    if (path.endsWith('/artifacts?per_page=100')) {
      return [
        {
          artifacts: artifactsOf(run).map(({ name, expired = false }) => ({
            name,
            expired,
            expires_at: '2026-12-03T11:58:28Z',
          })),
        },
      ];
    }
    if (path === `repos/${REPO}/actions/runs/${run}`) {
      return { head_sha: 'f'.repeat(40) };
    }
    if (path.startsWith(`repos/${REPO}/contents/assets/`) && github.assets) {
      const dir = path.slice(`repos/${REPO}/contents/`.length, path.indexOf('?'));
      return Object.keys(github.assets).map((name) => ({
        name,
        type: 'file',
        path: `${dir}/${name}`,
      }));
    }
    throw new Error(`gh api ${path}: HTTP 404`);
  });
  vi.mocked(gh).mockImplementation((args: string[]) => {
    if (args[0] === 'run' && args[1] === 'download') {
      const name = args[args.indexOf('--name') + 1]!;
      const dir = args[args.indexOf('--dir') + 1]!;
      const artifact = artifactsOf(args[2]!).find((candidate) => candidate.name === name);
      for (const [path, content] of Object.entries(artifact?.files ?? {})) {
        write(join(dir, path), content);
      }
      return '';
    }
    const path = args.at(-1)!;
    if (path.includes('/contents/ecosystem-qa/plans/11.0.md?ref=')) {
      return PLAN_TEXT;
    }
    const asset = Object.entries(github.assets ?? {}).find(([name]) =>
      path.includes(`/${name}?ref=qa-assets`)
    );
    if (asset) {
      return Buffer.from(asset[1]);
    }
    throw new Error(`gh ${args.join(' ')}: HTTP 404`);
  });
};

const brief = (catalog: CatalogEntry[] = [ENTRY]) =>
  fetchIssue({ repo: REPO, issue: 1, out: OUT, catalog });

const lines = (catalog?: CatalogEntry[]) => {
  const result = brief(catalog);
  if (result.kind !== 'brief') {
    throw new Error(`refused: ${result.reason}`);
  }
  return result.lines;
};

const runUrl = (run: string) => RUN_URL.replace(/\d+$/, run);

const onEntry = (entry: CatalogEntry, findings: Finding[], headSha: string | null) => {
  const base = loaded('linux', 'claude', findings, headSha);
  return {
    ...base,
    result: { ...base.result, request: { ...base.result.request, entry } },
    cycle: {
      repo: entry.pushTo ?? entry.repo,
      branch: cycleBranchName(VERSION, 'linux', 'claude'),
      startSha: entry.ref,
      headSha,
      bundle: null,
    },
  };
};

const filedBody = (result: ReturnType<typeof loaded>, run = '1') => {
  const [group] = groupFindings([result]);
  const proposal = toProposal({ lead: group!, members: [group!] }, [], {
    runUrl: runUrl(run),
    plan: PLAN,
  });
  if (proposal.kind !== 'issue') {
    throw new Error(proposal.kind);
  }
  return renderIssueBody(proposal, (name) => `https://example.test/${name}`);
};

const resultFiles = (result: ReturnType<typeof loaded>, prefix: string) => ({
  [`${prefix}/result.json`]: JSON.stringify(result.result),
  [`${prefix}/session.jsonl`]: '{}',
  [`${prefix}/run.log`]: 'log',
  [`${prefix}/evidence/dev.log`]: 'dev',
});

describe('fetchIssue', () => {
  it('names the fork ref of a filed issue and downloads its result and evidence', () => {
    const result = loaded('linux', 'claude', [finding()]);
    serve({
      issue: { body: filedBody(result) },
      runs: {
        1: [
          {
            name: 'qa-result-mealdrop-linux-claude',
            files: resultFiles(result, 'mealdrop/linux/claude'),
          },
        ],
      },
      assets: { 'dev.log': 'the dev log' },
    });

    const printed = lines();

    expect(printed).toContain(
      `  git fetch https://github.com/storybookjs/mealdrop refs/qa/sb-${VERSION}/linux-claude && git checkout FETCH_HEAD`
    );
    expect(printed).toContain(
      `- ${VERSION} storybookjs/mealdrop linux claude, run 1, from the issue body: downloaded qa-result-mealdrop-linux-claude, which expires on 2026-12-03.`
    );
    expect(printed).toContain(
      '  session       runs/1/qa-result-mealdrop-linux-claude/mealdrop/linux/claude/session.jsonl'
    );
    expect(printed).toContain(
      `  run again     node ecosystem-qa/run.ts --repo mealdrop --version ${VERSION} --engine claude --model claude-sonnet-5-5 --effort medium --sandbox docker --tier must --out /out/before --clone-dir /out/before-clone`
    );
    expect(printed).toContain('                It runs every check of the tier must again.');
    expect(printed).toContain(
      '  run a build   node ecosystem-qa/run.ts --repo mealdrop --build <full SHA> --engine claude --model claude-sonnet-5-5 --effort medium --sandbox docker --tier must --out /out/after --clone-dir /out/after-clone'
    );
    expect(printed).toContain('  1. yarn storybook --port 6006');
    expect(printed.at(-1)).toBe(UNTRUSTED);
    expect(memfs.readFileSync('/out/qa-assets/dev.log', 'utf8')).toBe('the dev log');
  });

  it('says what a probe added and points at the copy in the part that carries the fingerprint', () => {
    const probe = loaded('linux', 'claude', [finding({ checkId: 'plan.animation-probe' })]);
    const other = loaded('linux', 'claude', [
      finding({ title: 'Another finding', actual: 'other' }),
    ]);
    serve({
      issue: { body: filedBody(probe) },
      runs: {
        1: [
          {
            name: 'qa-earlier-results',
            files: {
              ...resultFiles(other, 'mealdrop/linux/claude/part-1'),
              ...resultFiles(probe, 'mealdrop/linux/claude/part-2'),
              'mealdrop/linux/claude/part-2/evidence/animation-probe-added/src/AnimationProbe.stories.tsx':
                'x',
            },
          },
        ],
      },
    });

    const printed = lines();

    expect(printed[2]).toMatch(/^Probe: yes\. This finding comes from a probe/);
    expect(printed).toContain(
      '  probe added   runs/1/qa-earlier-results/mealdrop/linux/claude/part-2/evidence/animation-probe-added'
    );
    expect(printed.join('\n')).not.toContain('part-1');
  });

  it('saves the plan of the run, prints the entry of the finding, lists the evidence of its check first, and names the command that runs its part again', () => {
    const probe = loaded('linux', 'claude', [finding({ checkId: 'plan.animation-probe' })]);
    probe.result.request.plan = {
      file: '11.0.md',
      hash: '0123456789ab',
      batch: 3,
      part: 1,
      entries: [{ id: 'animation-probe', prs: [31900] }],
    };
    const part = 'mealdrop/linux/claude/part-1';
    serve({
      issue: { body: filedBody(probe) },
      runs: {
        1: [
          {
            name: 'qa-earlier-results',
            files: {
              ...resultFiles(probe, part),
              [`${part}/evidence/baseline-dev.log`]: 'baseline',
              [`${part}/evidence/core.dev-server-cause.md`]: 'cause',
              [`${part}/evidence/plan-animation-probe-dev.log`]: 'dev',
              [`${part}/evidence/animation-probe-shot.png`]: 'png',
            },
          },
        ],
      },
    });

    const printed = lines();

    expect(memfs.readFileSync('/out/plans/1/11.0.md', 'utf8')).toBe(PLAN_TEXT);
    expect(printed).toContain(`  result        runs/1/qa-earlier-results/${part}/result.json`);
    expect(printed).toContain(
      '                first  animation-probe-shot.png, core.dev-server-cause.md, plan-animation-probe-dev.log'
    );
    expect(printed).toContain('                then   baseline-dev.log, dev.log');
    const entry = printed.findIndex((line) => line.startsWith('  plan entry'));
    expect(printed.slice(entry, entry + 9)).toEqual([
      "  plan entry    plans/1/11.0.md, line 86: animation-probe, A new story's animation pauses in the preview",
      '                Probe: a story file src/AnimationProbe.stories.tsx with one story Fade In whose box fades in with a CSS animation of two seconds',
      '                Repo mealdrop: owned, and its React and Vite setup loads a story file next to its components',
      '                Step: Open the story animation-probe--fade-in and take a screenshot after the play function ends.',
      '                Expected: The screenshot shows the box fully visible, the end state of the animation.',
      `  run again     node ecosystem-qa/run.ts --repo mealdrop --version ${VERSION} --engine claude --model claude-sonnet-5-5 --effort medium --sandbox docker --tier must --plan /out/plans/1/11.0.md --batch 3 --part 1 --out /out/before --clone-dir /out/before-clone`,
      '                It runs every entry of part 1 of batch 3 again: animation-probe.',
      '  run a build   node ecosystem-qa/run.ts --repo mealdrop --build <full SHA> --engine claude --model claude-sonnet-5-5 --effort medium --sandbox docker --tier must --plan /out/plans/1/11.0.md --batch 3 --part 1 --out /out/after --clone-dir /out/after-clone',
      '                It runs the same on the build of a fix, with the full SHA of its commit in place of <full SHA>.',
    ]);
  });

  it('finds a discovered repo through the plan of the run and names its bundle as the only upgraded state', () => {
    const result = onEntry(PRIMER, [finding({ checkId: 'plan.sidebar-tree' })], null);
    const bundle = `# v2 git bundle\n-${PRIMER.ref}\n${'d'.repeat(40)} refs/heads/qa/sb-${VERSION}/linux-claude\n\n`;
    serve({
      issue: { body: filedBody(result) },
      runs: {
        1: [
          {
            name: 'qa-result-primer-react-linux-claude-part-1',
            files: {
              ...resultFiles(result, 'primer-react/linux/claude/part-1'),
              'primer-react/linux/claude/part-1/cycle.bundle': bundle,
            },
          },
        ],
      },
    });

    const printed = lines();

    expect(printed).toContain(
      `Upgraded state: primer/react has no fork, so the upgraded state exists only as the cycle.bundle in the artifact of the run, listed below. The run started from https://github.com/primer/react/tree/${PRIMER.ref}.`
    );
    expect(printed).toContain(
      `                in a clone of https://github.com/primer/react at ${PRIMER.ref}: git fetch /out/runs/1/qa-result-primer-react-linux-claude-part-1/primer-react/linux/claude/part-1/cycle.bundle refs/heads/qa/sb-${VERSION}/linux-claude && git checkout FETCH_HEAD`
    );
  });

  it('lists a sighting from a comment of the workflow with its own run, and still fetches the rest when one artifact expired', () => {
    const first = loaded('linux', 'claude', [finding()]);
    const again = loaded('macos', 'claude', [finding()]);
    const body = filedBody(first);
    const filed: QaIssue = {
      number: 1,
      title: 't',
      state: 'open',
      labels: ['internal-qa'],
      body,
      comments: [],
    };
    const [group] = groupFindings([again]);
    const comment = toProposal({ lead: group!, members: [group!] }, [filed], {
      runUrl: runUrl('2'),
    });
    if (comment.kind !== 'comment') {
      throw new Error(comment.kind);
    }
    serve({
      issue: { body },
      comments: [renderCommentBody(comment)],
      runs: {
        1: [{ name: 'qa-result-mealdrop-linux-claude', expired: true }],
        2: [
          {
            name: 'qa-result-mealdrop-macos-claude',
            files: resultFiles(again, 'mealdrop/macos/claude'),
          },
        ],
      },
    });

    const printed = lines();

    expect(printed).toContain(
      `- ${VERSION} storybookjs/mealdrop linux claude, run 1, from the issue body: gone, because qa-result-mealdrop-linux-claude expired on 2026-12-03. Its session, logs, evidence and bundle no longer exist.`
    );
    expect(printed).toContain(
      `- ${VERSION} storybookjs/mealdrop macos claude, run 2, from comment 1 of the workflow: downloaded qa-result-mealdrop-macos-claude, which expires on 2026-12-03.`
    );
    expect(
      memfs.existsSync(
        '/out/runs/2/qa-result-mealdrop-macos-claude/mealdrop/macos/claude/session.jsonl'
      )
    ).toBe(true);
  });

  it('refuses an issue without the internal-qa label, and one without the metadata block', () => {
    serve({
      issue: { body: filedBody(loaded('linux', 'claude', [finding()])), labels: ['bug'] },
      runs: {},
    });
    expect(brief()).toEqual({
      kind: 'refused',
      reason: '#1 is no QA finding: it has no internal-qa label.',
    });

    serve({ issue: { body: 'A bug a person filed.' }, runs: {} });
    expect(brief()).toEqual({
      kind: 'refused',
      reason: '#1 has no metadata block of the workflow, so it names no run.',
    });
    expect(vi.mocked(gh)).not.toHaveBeenCalled();
  });
});
