import {
  closeSync,
  existsSync,
  lstatSync,
  openSync,
  readdirSync,
  readFileSync,
  readSync,
  realpathSync,
} from 'node:fs';

import { fs as memfs, vol } from 'memfs';
import { dirname, join } from 'pathe';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { planFiling } from './filing.ts';
import {
  asIssue,
  DISCOVERED,
  ENTRY,
  finding,
  loaded,
  RUN_URL,
  single,
  VERSION,
} from './fixtures.ts';
import type { PlanScope } from './plan-scope.ts';
import { groupFindings, toProposal } from './proposals.ts';
import { parsePlan, planHash } from './qa-plan.ts';
import { downloadedRuns, loadResults, upgraded } from './results.ts';
import { Finding, type CatalogEntry, type PlanRecord, type RunResultFile } from './schema.ts';

vi.mock('node:fs', { spy: true });

// Read before the file system is redirected to memfs.
const PLAN_TEXT = readFileSync(new URL('./plan.fixture.md', import.meta.url), 'utf8');

beforeEach(() => {
  vol.reset();
  vi.mocked(closeSync).mockImplementation(memfs.closeSync as typeof closeSync);
  vi.mocked(existsSync).mockImplementation(memfs.existsSync as typeof existsSync);
  vi.mocked(lstatSync).mockImplementation(memfs.lstatSync as typeof lstatSync);
  vi.mocked(openSync).mockImplementation(memfs.openSync as typeof openSync);
  vi.mocked(readdirSync).mockImplementation(memfs.readdirSync as typeof readdirSync);
  vi.mocked(readFileSync).mockImplementation(memfs.readFileSync as typeof readFileSync);
  vi.mocked(readSync).mockImplementation(memfs.readSync as typeof readSync);
  vi.mocked(realpathSync).mockImplementation(memfs.realpathSync as typeof realpathSync);
});

const resultsDir = '/results';

const write = (path: string, content: string) => {
  memfs.mkdirSync(dirname(path), { recursive: true });
  memfs.writeFileSync(path, content);
};

const record = (overrides: Partial<RunResultFile> = {}): RunResultFile => ({
  ...loaded('linux', 'claude', [finding()]).result,
  ...overrides,
});

const writeRun = (dir: string, result: RunResultFile = record()) =>
  write(join(dir, 'result.json'), JSON.stringify(result));

const load = (resultsDir: string) => {
  const warnings: string[] = [];
  const results = loadResults(resultsDir, {
    version: VERSION,
    catalog: [ENTRY],
    warn: (message) => warnings.push(message),
  });
  return { results, warnings };
};

const artifactRun = (resultsDir: string) =>
  join(resultsDir, 'qa-result-mealdrop-linux-claude/mealdrop/linux/claude');

describe('loadResults', () => {
  it('reads only the records the runner wrote, never one inside the evidence', () => {
    const runDir = artifactRun(resultsDir);
    writeRun(runDir);
    writeRun(join(runDir, 'evidence'));
    writeRun(join(resultsDir, 'qa-result-mealdrop-linux-claude/elsewhere'));
    writeRun(join(resultsDir, 'mealdrop/macos/claude'), {
      ...record(),
      request: { ...record().request, os: 'macos' },
    });

    const { results } = load(resultsDir);

    expect(results.map((result) => result.resultPath)).toEqual([
      join(runDir, 'result.json'),
      join(resultsDir, 'mealdrop/macos/claude/result.json'),
    ]);
  });

  it('ignores a record that names another version or os than the place it was found', () => {
    writeRun(artifactRun(resultsDir), {
      ...record(),
      request: { ...record().request, version: '11.0.0-beta.1', os: 'windows' },
    });

    const { results, warnings } = load(resultsDir);

    expect(results).toEqual([]);
    expect(warnings[0]).toMatch(/disagrees .* on os, version/);
  });

  it('ignores the run of a build, even one that installed the collected version', () => {
    const commit = '3435e27065c0fd8e123c0251783882de4db00c1f';
    writeRun(artifactRun(resultsDir), {
      ...record(),
      request: { ...record().request, build: commit },
    });

    const { results, warnings } = load(resultsDir);

    expect(results).toEqual([]);
    expect(warnings).toEqual([
      expect.stringContaining(`ran the build of commit ${commit}, which proves a fix`),
    ]);
  });

  it('takes the repository from the catalog and the head from the bundle, not from the record', () => {
    const runDir = artifactRun(resultsDir);
    const branch = `qa/sb-${VERSION}/linux-claude`;
    writeRun(runDir, {
      ...record(),
      request: {
        ...record().request,
        entry: { ...ENTRY, repo: 'storybookjs/storybook' },
      },
      headSha: 'f'.repeat(40),
    });
    write(
      join(runDir, 'cycle.bundle'),
      `# v2 git bundle\n-${'1'.repeat(40)} start\n${'2'.repeat(40)} refs/heads/${branch}\n${'3'.repeat(40)} refs/heads/main\n\nPACK`
    );

    const [result] = load(resultsDir).results;

    expect(result?.cycle).toEqual({
      repo: 'storybookjs/mealdrop',
      branch: `${branch}-${'2'.repeat(10)}`,
      startSha: '1'.repeat(40),
      headSha: '2'.repeat(40),
      bundle: join(runDir, 'cycle.bundle'),
    });
    expect(result?.result.request.entry.repo).toBe('storybookjs/mealdrop');
  });

  it('reports the fork that holds the baseline as the cycle repository', () => {
    const fork = { ...ENTRY, class: 'tier1' as const, pushTo: 'storybook-tmp/mealdrop' };
    writeRun(artifactRun(resultsDir));

    const [result] = loadResults(resultsDir, {
      version: VERSION,
      catalog: [fork],
      warn: () => {},
    });

    expect(result?.cycle.repo).toBe('storybook-tmp/mealdrop');
  });

  it('loads a record written before the starting version was recorded', () => {
    const { storybookVersionBefore: _newer, ...older } = record({
      storybookVersionBefore: '10.6.0',
    });
    writeRun(artifactRun(resultsDir), older);

    const { results, warnings } = load(resultsDir);

    expect(results).toHaveLength(1);
    expect(warnings).not.toContainEqual(expect.stringMatching(/not a valid result record/));
  });

  it('rejects a model id that could close the metadata fence in the issue body', () => {
    const base = record();
    writeRun(artifactRun(resultsDir), {
      ...base,
      request: { ...base.request, model: 'claude\n```\n@everyone' },
    });

    const { results, warnings } = load(resultsDir);

    expect(results).toHaveLength(0);
    expect(warnings).toContainEqual(expect.stringMatching(/not a valid result record/));
  });

  it('skips a truncated result.json and still collects the other runs', () => {
    write(
      join(resultsDir, 'qa-result-mealdrop-linux-codex/mealdrop/linux/codex/result.json'),
      '{"request": {'
    );
    writeRun(artifactRun(resultsDir));

    const { results, warnings } = load(resultsDir);

    expect(results).toHaveLength(1);
    expect(warnings).toContainEqual(expect.stringMatching(/result\.json is unreadable/));
  });

  it('treats a bundle without the cycle branch as no commits', () => {
    const runDir = artifactRun(resultsDir);
    writeRun(runDir);
    write(
      join(runDir, 'cycle.bundle'),
      `# v2 git bundle\n${'2'.repeat(40)} refs/heads/main\n\nPACK`
    );

    const { results, warnings } = load(resultsDir);

    expect(results[0]?.cycle).toMatchObject({ headSha: null, bundle: null });
    expect(warnings).toContainEqual(expect.stringMatching(/has no ref for/));
  });

  it('keeps regular evidence files and drops missing ones, symlinks and escapes', () => {
    const outside = '/outside';
    write(join(outside, 'secret.log'), 'token');
    const runDir = artifactRun(resultsDir);
    const evidence = join(runDir, 'evidence');
    write(join(evidence, 'hmr-frames/01.png'), 'png');
    write(join(evidence, 'dev.log'), 'log');
    memfs.symlinkSync(join(outside, 'secret.log'), join(evidence, 'link.log'));
    memfs.symlinkSync(outside, join(evidence, 'escape'));
    writeRun(
      runDir,
      record({
        findings: [
          finding({
            evidence: {
              png: 'hmr-frames/01.png',
              gif: 'missing.gif',
              logs: ['dev.log', 'link.log', 'escape/secret.log'],
            },
          }),
        ],
      })
    );

    const { results, warnings } = load(resultsDir);

    expect(results[0]?.result.findings[0]?.evidence).toEqual({
      png: 'hmr-frames/01.png',
      logs: ['dev.log'],
    });
    expect(warnings).toEqual([
      expect.stringMatching(/missing\.gif .*does not exist/),
      expect.stringMatching(/link\.log .*is a symlink/),
      expect.stringMatching(/escape\/secret\.log .*outside the evidence directory/),
    ]);
  });
});

describe('loadResults of a plan batch', () => {
  const scope = (batch = 1): PlanScope => ({
    file: 'plan.fixture.md',
    hash: planHash(PLAN_TEXT),
    plan: parsePlan(PLAN_TEXT),
    batch,
    tier: 'gate',
  });
  const partOne: PlanRecord = {
    file: 'plan.fixture.md',
    hash: planHash(PLAN_TEXT),
    batch: 1,
    part: 1,
    entries: [
      { id: 'story-sort-in-main', prs: [36137] },
      { id: 'preview-animations', prs: [31900] },
    ],
  };
  const planRun = (plan: PlanRecord = partOne, checkId = 'plan.story-sort-in-main') =>
    record({
      request: { ...record().request, tier: 'gate', plan },
      checks: [
        { id: 'upgrade.command', label: 'Upgrade', state: 'pass' },
        { id: checkId, label: 'Entry', state: 'fail' },
      ],
      findings: [finding({ checkId, evidence: { logs: [] } })],
    });
  const partDir = (part: number) => join(resultsDir, `mealdrop/linux/claude/part-${part}`);
  const loadWith = (plan?: PlanScope, catalog = [ENTRY]) => {
    const warnings: string[] = [];
    const results = loadResults(resultsDir, {
      version: VERSION,
      catalog,
      ...(plan ? { plan } : {}),
      warn: (message) => warnings.push(message),
    });
    return { paths: results.map((result) => result.resultPath), warnings };
  };

  it('loads each part of a repo from a local run and from an artifact', () => {
    const artifactPart = join(
      resultsDir,
      'qa-result-mealdrop-linux-claude-part-2/mealdrop/linux/claude/part-2'
    );
    writeRun(partDir(1), planRun());
    writeRun(
      artifactPart,
      planRun(
        { ...partOne, part: 2, entries: [{ id: 'csf-factory-namespaces', prs: [35658] }] },
        'plan.csf-factory-namespaces'
      )
    );

    expect(loadWith(scope())).toEqual({
      paths: [join(partDir(1), 'result.json'), join(artifactPart, 'result.json')],
      warnings: [],
    });
  });

  it('ignores a record with a check id the plan does not have', () => {
    writeRun(partDir(1), planRun(partOne, 'plan.invented'));

    expect(loadWith(scope())).toEqual({
      paths: [],
      warnings: [
        expect.stringMatching(
          /reports plan\.invented, which is neither a check of the tier gate nor a plan check/
        ),
      ],
    });
  });

  it('ignores a gate run that reports a static check outside the gate', () => {
    writeRun(partDir(1), planRun(partOne, 'core.story-render'));

    expect(loadWith(scope()).warnings).toEqual([
      expect.stringMatching(
        /reports core\.story-render, which is neither a check of the tier gate/
      ),
    ]);
  });

  it('ignores a record that says it ran another tier than the collect, whatever checks it reports', () => {
    const extended = planRun(partOne, 'core.story-render');
    writeRun(partDir(1), { ...extended, request: { ...extended.request, tier: 'extended' } });

    expect(loadWith(scope())).toEqual({
      paths: [],
      warnings: [
        expect.stringMatching(
          /it says it ran the tier extended, and this collect is of the tier gate/
        ),
      ],
    });
  });

  it('ignores a gate record of a part that the batch does not have', () => {
    writeRun(partDir(3), planRun({ ...partOne, part: 3 }, 'upgrade.command'));

    expect(loadWith(scope())).toEqual({
      paths: [],
      warnings: [expect.stringMatching(/batch 1 of the plan has no part 3 for mealdrop/)],
    });
  });

  it('ignores a gate record of a repo that the batch does not list', () => {
    const twenty: CatalogEntry = { ...ENTRY, id: 'twenty', repo: 'storybook-tmp/twenty' };
    const gateOnly = planRun(partOne, 'upgrade.command');
    writeRun(join(resultsDir, 'twenty/linux/claude/part-1'), {
      ...gateOnly,
      request: { ...gateOnly.request, entry: twenty },
    });

    expect(loadWith(scope(), [ENTRY, twenty])).toEqual({
      paths: [],
      warnings: [expect.stringMatching(/batch 1 of the plan has no part 1 for twenty/)],
    });
  });

  it('ignores a record that reports a check outside its part only among its checks', () => {
    const run = planRun();
    writeRun(partDir(1), {
      ...run,
      checks: [...run.checks, { id: 'plan.invented', label: 'Invented', state: 'pass' }],
    });

    expect(loadWith(scope()).warnings).toEqual([
      expect.stringMatching(/reports plan\.invented, which is neither/),
    ]);
  });

  it('takes the plan checks of a part from the plan file, not from the record', () => {
    writeRun(
      partDir(1),
      planRun(
        { ...partOne, entries: [{ id: 'csf-factory-namespaces', prs: [35658] }] },
        'plan.csf-factory-namespaces'
      )
    );

    expect(loadWith(scope()).warnings).toEqual([
      expect.stringMatching(/reports plan\.csf-factory-namespaces, which is neither/),
    ]);
  });

  it('ignores a record of another plan', () => {
    writeRun(partDir(1), planRun({ ...partOne, hash: '0123456789ab' }));

    expect(loadWith(scope()).warnings).toEqual([
      expect.stringMatching(/ran the plan plan\.fixture\.md 0123456789ab, not plan\.fixture\.md/),
    ]);
  });

  it('ignores a record of another batch', () => {
    writeRun(partDir(1), planRun());

    expect(loadWith(scope(2)).warnings).toEqual([
      expect.stringMatching(/ran batch 1 of the plan, not batch 2/),
    ]);
  });

  it('ignores a static record in the collect of a plan', () => {
    writeRun(join(resultsDir, 'mealdrop/linux/claude'));

    expect(loadWith(scope()).warnings).toEqual([expect.stringMatching(/it ran no plan/)]);
  });

  it('ignores a record of a plan run, and a plan check of a static run, when no plan is given', () => {
    writeRun(partDir(1), planRun());
    writeRun(
      join(resultsDir, 'mealdrop/macos/claude'),
      record({
        request: { ...record().request, os: 'macos' },
        findings: [finding({ checkId: 'plan.story-sort-in-main' })],
      })
    );

    expect(loadWith()).toEqual({
      paths: [],
      warnings: [
        expect.stringMatching(
          /ran batch 1 of the plan plan\.fixture\.md .*, and no plan was given/
        ),
        expect.stringMatching(/reports plan\.story-sort-in-main, which is no check of checks\.ts/),
      ],
    });
  });

  it('ignores a record that names another part than its directory', () => {
    writeRun(partDir(2), planRun());

    expect(loadWith(scope()).warnings).toEqual([expect.stringMatching(/disagrees .* on part/)]);
  });

  const baselinesOf = (plan: PlanScope, checkId: string) => {
    writeRun(
      partDir(1),
      record({
        ...planRun({ ...partOne, batch: plan.batch }, checkId),
        findings: (['pass', 'fail'] as const).map((baseline) =>
          finding({ checkId, baseline, evidence: { logs: [] } })
        ),
      })
    );
    return loadResults(resultsDir, { version: VERSION, catalog: [ENTRY], plan, warn: () => {} })
      .flatMap(({ result }) => result.findings)
      .map(({ baseline }) => baseline);
  };

  it('takes a probe finding as not captured on the baseline, whatever its record says', () => {
    expect(baselinesOf(scope(3), 'plan.animation-probe')).toEqual(['not-captured', 'not-captured']);
  });

  it('keeps the baseline of a normal finding as its record says', () => {
    expect(baselinesOf(scope(), 'plan.story-sort-in-main')).toEqual(['pass', 'fail']);
  });
});

describe('evidence names in a finding', () => {
  it.each(['../result.json', '/etc/passwd', '.env', 'a/../b.log', 'a/b/c.png', 'C:\\x.png'])(
    'rejects %s',
    (name) => {
      expect(Finding.safeParse(finding({ evidence: { logs: [name] } })).success).toBe(false);
    }
  );

  it('accepts a file name and one directory level', () => {
    expect(
      Finding.safeParse(finding({ evidence: { png: 'hmr-frames/01.png', logs: ['dev.log'] } }))
        .success
    ).toBe(true);
  });
});

describe('system info', () => {
  it('strips the colour codes and the box prefix the CLI prints', () => {
    const runDir = artifactRun(resultsDir);
    writeRun(runDir);
    write(
      join(runDir, 'evidence/storybook-info.txt'),
      'yarn dlx noise\n\x1b[1mStorybook Environment Info:\x1b[22m\n\x1b[90m│\x1b[39m\n\x1b[90m│\x1b[39m  System:\n\x1b[90m│\x1b[39m  OS: Linux\n'
    );

    const { results } = load(resultsDir);

    expect(results[0]?.systemInfo).toBe('Storybook Environment Info:\n\nSystem:\nOS: Linux');
  });

  it('treats a capture without the report as no info', () => {
    const runDir = artifactRun(resultsDir);
    writeRun(runDir);
    write(
      join(runDir, 'evidence/storybook-info.txt'),
      'yarn dlx noise\nEPERM: operation not permitted\n'
    );

    const { results } = load(resultsDir);

    expect(results[0]?.systemInfo).toBeUndefined();
  });
});

describe('upgraded', () => {
  it('is true when the installed version is the requested one', () => {
    expect(upgraded(record({ storybookVersionInstalled: VERSION }))).toBe(true);
  });

  it('is false when another version is installed', () => {
    expect(upgraded(record({ storybookVersionInstalled: '10.6.3' }))).toBe(false);
  });

  it('is false when the installed version is unknown', () => {
    expect(upgraded(record({ storybookVersionInstalled: null }))).toBe(false);
  });
});

describe('the cycle of a run that left a bundle', () => {
  const branch = `qa/sb-${VERSION}/linux-claude`;
  const FORK = { ...DISCOVERED, pushTo: 'storybook-tmp/vue-dsfr', ref: 'qa/base' };

  const loadRunOf = (entry: CatalogEntry) => {
    const runDir = join(resultsDir, `qa-result-${entry.id}-linux-claude/${entry.id}/linux/claude`);
    writeRun(runDir, { ...record(), request: { ...record().request, entry } });
    write(
      join(runDir, 'cycle.bundle'),
      `# v2 git bundle\n-${'1'.repeat(40)} start\n${'2'.repeat(40)} refs/heads/${branch}\n\nPACK`
    );
    const [result] = loadResults(resultsDir, {
      version: VERSION,
      catalog: [entry],
      warn: () => {},
    });
    const [group] = groupFindings([result!]);
    const steps = planFiling(asIssue(toProposal(single(group), [], { runUrl: RUN_URL })), {
      repo: 'storybookjs/storybook',
      evidenceLinks: 'assets',
    });
    return { cycle: result?.cycle, steps };
  };

  it('starts a repo without a push target at its pinned upstream commit and pushes nothing', () => {
    const { cycle, steps } = loadRunOf(DISCOVERED);

    expect(cycle).toEqual({
      repo: 'dnum-mi/vue-dsfr',
      branch,
      startSha: DISCOVERED.ref,
      headSha: null,
      bundle: null,
    });
    expect(steps.map((step) => step.kind)).toEqual(['create-issue']);
    expect(steps.flatMap((step) => (step.kind === 'create-issue' ? [step.body] : []))[0]).toContain(
      `https://github.com/dnum-mi/vue-dsfr/tree/${DISCOVERED.ref}`
    );
  });

  it('pushes the cycle of a tier 2 fork to the fork', () => {
    const { steps } = loadRunOf(FORK);

    expect(steps[0]).toMatchObject({
      kind: 'push-cycle',
      repo: 'storybook-tmp/vue-dsfr',
      headSha: '2'.repeat(40),
    });
  });
});

describe('downloadedRuns', () => {
  it('maps each catalog run of a download to its place in a local results directory', () => {
    const download = '/download';
    writeRun(artifactRun(download));
    writeRun(join(artifactRun(download), 'evidence'));
    writeRun(
      join(download, 'qa-result-not-in-the-catalog-linux-claude/not-in-the-catalog/linux/claude')
    );
    writeRun(join(download, 'qa-result-linux-claude/mealdrop/linux/claude'));
    writeRun(join(download, 'another-artifact/mealdrop/linux/claude'));

    expect(downloadedRuns(download, '/out', [ENTRY])).toEqual([
      {
        artifact: 'qa-result-mealdrop-linux-claude',
        from: artifactRun(download),
        to: '/out/mealdrop/linux/claude',
        label: 'mealdrop linux claude',
      },
    ]);
  });

  it('keeps the parts of a plan run apart', () => {
    const download = '/download';
    for (const part of [1, 2]) {
      writeRun(
        join(
          download,
          `qa-result-mealdrop-linux-claude-part-${part}/mealdrop/linux/claude/part-${part}`
        )
      );
    }

    expect(downloadedRuns(download, '/out', [ENTRY]).map(({ to, label }) => [to, label])).toEqual([
      ['/out/mealdrop/linux/claude/part-1', 'mealdrop part 1 linux claude'],
      ['/out/mealdrop/linux/claude/part-2', 'mealdrop part 2 linux claude'],
    ]);
  });
});
