import { describe, expect, it } from 'vitest';

import { loaded } from './fixtures.ts';
import { USD_PER_RUN } from './qa-plan.ts';
import {
  attemptOf,
  findingsOf,
  startNext,
  batchCommentOf,
  batchReport,
  carriedRuns,
  chainEndComment,
  collectOf,
  costOf,
  dryFiling,
  batchDispatch,
  nextStep,
  renderBatchComment,
  renderTrackingThread,
  resultsExpireOn,
  spentUsd,
  trackBatch,
  trackingThreadsOf,
  type BatchInput,
  type BatchReport,
  type CollectInput,
  type PlannedJob,
  type ReportedResult,
  type Written,
} from './tracking.ts';

const HASH = '3f9c2a7b10de';
const HARNESS = { __typename: 'Bot', login: 'github-actions' };
const PERSON = { __typename: 'User', login: 'someone' };

const job = (repo: string, part = 1): PlannedJob => ({ repo, part, os: 'linux', engine: 'claude' });

const result = (
  repo: string,
  { part = 1, usd = 1.25 as number | null, startedAt = '2026-11-16T10:00:00Z' } = {}
): ReportedResult => ({
  request: { entry: { id: repo }, os: 'linux', engine: 'claude', plan: { part } },
  timing: { startedAt },
  usage: { usd },
  status: 'ok',
  checks: [{ state: 'pass' }, { state: 'fail' }],
});

const input = (overrides: Partial<BatchInput> = {}): BatchInput => ({
  plan: { file: '11.0.md', hash: HASH },
  ref: 'qa/plans',
  batch: 1,
  batches: 2,
  version: '11.0.0-beta.3',
  runs: ['43900000001'],
  attempt: 1,
  filing: 'dry',
  planned: [job('mealdrop'), job('mealdrop', 2), job('mantine')],
  results: [result('mealdrop'), result('mealdrop', { part: 2, usd: null })],
  findings: [{ kind: 'issue', title: '[SB 11 QA]: Dev server crashes' }],
  ...overrides,
});

let comments = 0;
const comment = (
  body: string,
  author = HARNESS,
  editor: typeof HARNESS | null = null
): Written => ({
  id: `DC_${++comments}`,
  url: `https://github.com/storybookjs/storybook/discussions/1#discussioncomment-${comments}`,
  body,
  author,
  editor,
});

const posted = (report: BatchReport, author = HARNESS) =>
  comment(
    renderBatchComment(report, {
      spend: spentUsd([], HASH, report),
      cost: costOf([], report),
      capUsd: 250,
      next: { start: 2 },
      expiresOn: '2027-02-14',
      carried: [],
      short: false,
    }),
    author
  );

describe('renderTrackingThread and trackingThreadsOf', () => {
  const thread = renderTrackingThread({
    file: '11.0.md',
    hash: HASH,
    line: '11.0',
    version: '11.0.0-beta.3',
  });
  const discussion = (number: number, body: string, author = HARNESS) => ({
    ...comment(body, author),
    number,
  });

  it('titles the discussion by the major and the plan', () => {
    expect(thread.title).toBe('[SB 11 QA] Dynamic sweep 11.0.md');
  });

  it('lists the discussions the workflow wrote for the hash, oldest first', () => {
    const found = trackingThreadsOf(
      [discussion(9, thread.body), discussion(7, thread.body), discussion(8, 'unrelated')],
      HASH
    );

    expect(found.map(({ number }) => number)).toEqual([7, 9]);
  });

  it('ignores a discussion by another account, a marker below the first line, and another hash', () => {
    expect(
      trackingThreadsOf(
        [
          discussion(1, thread.body, PERSON),
          discussion(2, `Notes\n${thread.body}`),
          discussion(3, thread.body.replace(HASH, 'aaaaaaaaaaaa')),
        ],
        HASH
      )
    ).toEqual([]);
  });

  it('names the manual QA discussion of the plan in a new discussion only when it has one', () => {
    const linked = renderTrackingThread({
      file: '11.0.md',
      hash: HASH,
      line: '11.0',
      version: '11.0.0-beta.3',
      manualDiscussion: 37627,
    });

    expect(linked.body).toContain('by hand are in #37627.');
    expect(thread.body).not.toContain('by hand');
    expect(trackingThreadsOf([discussion(5, linked.body)], HASH)[0]?.number).toBe(5);
  });

  it('reads a marker in a body that an edit in the browser saved with CRLF', () => {
    expect(
      trackingThreadsOf([discussion(4, thread.body.replaceAll('\n', '\r\n'))], HASH)[0]?.number
    ).toBe(4);
  });
});

describe('batchReport and renderBatchComment', () => {
  it('renders the runs planned and lost, the dollars of each, the checks, and the findings', () => {
    const report = batchReport(input());

    expect(posted(report).body).toMatchInlineSnapshot(`
      "<!-- sb-qa-batch 3f9c2a7b10de batch=1 version=11.0.0-beta.3 runs=43900000001 -->
      <!-- sb-qa-run mealdrop/1/linux/claude/2026-11-16T10:00:00.000Z usd=1.250000 -->
      <!-- sb-qa-run mealdrop/2/linux/claude/2026-11-16T10:00:00.000Z usd=2.590000 -->
      <!-- sb-qa-run mantine/1/linux/claude/lost-43900000001 usd=2.590000 -->
      <!-- sb-qa-total usd=6.430000 runs=3 -->
      ### Batch 1 of 2 on Storybook 11.0.0-beta.3

      3 runs planned, 2 finished, 1 without a result, from workflow run 43900000001.

      | Run | Outcome | Dollars |
      | --- | --- | --- |
      | \`mealdrop\` part 1, linux, claude | ok | 1.25 |
      | \`mealdrop\` part 2, linux, claude | ok | 2.59 (flat) |
      | \`mantine\` part 1, linux, claude | no result | 2.59 (flat) |

      A run without a result or without a price counts as the flat $2.59 of a run.

      Checks: 2 pass, 2 fail.

      Findings:

      - new issue: [SB 11 QA]: Dev server crashes

      Batch 1 cost $6.43 for 3 runs.
      The plan cost $6.43 for 3 runs up to batch 1, of a cap of $250.00.

      Next: Batch 2 is started.

      Dry run, so nothing was filed. To file this batch, run \`gh workflow run ecosystem-qa.yml --ref qa/plans -f plan=11.0.md -f batch=1 -f plan_hash=3f9c2a7b10de -f version=11.0.0-beta.3 -f engines=claude -f from_runs=43900000001 -f dry=false\` before its artifacts expire on 2027-02-14.
      "
    `);
  });

  it('round-trips: the spend read back from the comment is the dollars it was written with', () => {
    const report = batchReport(input());

    const spend = spentUsd([posted(report)], HASH);

    expect(spend.usd).toBeCloseTo(1.25 + 2 * USD_PER_RUN);
    expect(spend.runs).toBe(3);
  });

  it('counts one planned run as one run', () => {
    expect(
      posted(batchReport(input({ planned: [job('mealdrop')], results: [result('mealdrop')] }))).body
    ).toContain('1 run planned, 1 finished, 0 without a result');
  });

  it('takes a run record as the collector loads it, and keeps its text out of the ledger', () => {
    const record = loaded('linux', 'claude', []).result;
    const report = batchReport(
      input({
        planned: [job('mealdrop')],
        results: [{ ...record, timing: { ...record.timing, startedAt: 'x usd=999 -->' } }],
      })
    );

    expect(report.lines).toEqual([
      expect.objectContaining({ key: 'mealdrop/1/linux/claude/unknown-start', usd: 0 }),
    ]);
  });

  it('names the issue each finding was filed as or commented on, and a finding left unfiled', () => {
    const report = batchReport(
      input({
        filing: 'filed',
        findings: [
          { kind: 'issue', title: 'Crash', issue: 37400 },
          { kind: 'issue', title: 'Hang' },
          { kind: 'comment', title: 'Seen again', issue: 37364 },
          { kind: 'suppressed', title: 'Known', issue: 37365 },
          { kind: 'skipped', title: 'Not a bug' },
        ],
      })
    );

    expect(posted(report).body).toContain(
      [
        '- filed as #37400: Crash',
        '- not filed: Hang',
        '- comment on #37364: Seen again',
        '- known as #37365: Known',
        '- skipped: Not a bug',
      ].join('\n')
    );
  });

  it('says before the filing of a run that files that its file job files the batch next', () => {
    const body = posted(batchReport(input({ filing: 'pending' }))).body;

    expect(body).toContain('- new issue: [SB 11 QA]: Dev server crashes');
    expect(body).toContain('The file job of this run files the batch next');
    expect(body).not.toContain('Filed.');
    expect(body).not.toContain('Dry run');
  });

  it('prints no dispatch to file results that no workflow run holds', () => {
    const body = posted(batchReport(input({ runs: [] }))).body;

    expect(body).not.toContain('gh workflow run');
    expect(body).toContain('Dry run of local results');
  });

  it('mentions nobody that a finding title names', () => {
    const body = posted(
      batchReport(input({ findings: [{ kind: 'issue', title: 'Broken with @someone/pkg' }] }))
    ).body;

    expect(body).not.toMatch(/@someone/);
  });

  it('finds the comment it wrote for the same batch, version and runs, to edit it', () => {
    const report = batchReport(input());
    const mine = posted(report);
    const others = [posted(report, PERSON), posted(batchReport(input({ runs: ['43900000002'] })))];

    expect(batchCommentOf([...others, mine], report)).toBe(mine);
    expect(batchCommentOf(others.slice(0, 1), report)).toBeUndefined();
  });
});

describe('spentUsd', () => {
  const first = batchReport(input());

  it('counts a run once when the batch is collected again into another comment', () => {
    const planned = [job('mealdrop'), job('mealdrop', 2)];
    const once = batchReport(input({ planned }));
    const again = batchReport(input({ planned, runs: ['43900000001', '43900000009'] }));
    const spend = spentUsd([posted(once), posted(again)], HASH);

    expect(spend.runs).toBe(2);
    expect(spend.usd).toBeCloseTo(1.25 + USD_PER_RUN);
  });

  it('counts both runs when the batch runs a second time', () => {
    const second = batchReport(
      input({
        runs: ['43900000002'],
        planned: [job('mealdrop')],
        results: [result('mealdrop', { usd: 2, startedAt: '2026-11-17T09:00:00Z' })],
      })
    );

    expect(spentUsd([posted(first), posted(second)], HASH).usd).toBeCloseTo(
      1.25 + 2 * USD_PER_RUN + 2
    );
  });

  it('counts a run once when the comment of the batch is written again from the same results', () => {
    expect(spentUsd([posted(first)], HASH, first).usd).toBeCloseTo(1.25 + 2 * USD_PER_RUN);
  });

  it('keeps the runs of an earlier report of the batch that a job run again replaced', () => {
    const rerun = batchReport(
      input({
        results: [
          ...input().results,
          result('mantine', { usd: 4, startedAt: '2026-11-16T12:00:00Z' }),
        ],
      })
    );
    const earlier = posted(first);
    const rewritten = comment(
      renderBatchComment(rerun, {
        spend: spentUsd([earlier], HASH, rerun),
        cost: costOf([earlier], rerun),
        capUsd: 250,
        next: { stop: 'x' },
        expiresOn: '2027-02-14',
        carried: carriedRuns(earlier, rerun),
        short: false,
      })
    );
    const total = 1.25 + 2 * USD_PER_RUN + 4;

    expect(carriedRuns(earlier, rerun)).toEqual([
      { key: 'mantine/1/linux/claude/lost-43900000001', usd: USD_PER_RUN },
    ]);
    expect(spentUsd([earlier], HASH, rerun).usd).toBeCloseTo(total);
    expect(spentUsd([rewritten], HASH).usd).toBeCloseTo(total);
    expect(rewritten.body).toContain('The spend also counts 1 run of an earlier report');
  });

  it('ignores a comment by another account', () => {
    const forged = posted(batchReport(input({ runs: ['1'] })), PERSON);

    expect(spentUsd([forged], HASH)).toEqual({
      usd: 0,
      runs: 0,
      held: { usd: 0, runs: 0 },
      written: { usd: 0, runs: 0 },
      batches: [],
      started: [],
      unreadable: [],
    });
  });

  it('names a comment of the workflow whose first line is not the hidden line of a batch of the plan', () => {
    const buried = comment(`Copied:\n${posted(batchReport(input({ runs: ['2'] }))).body}`);
    const otherPlan = comment(posted(first).body.replace(HASH, 'aaaaaaaaaaaa'));

    expect(spentUsd([buried, otherPlan], HASH)).toEqual({
      usd: 0,
      runs: 0,
      held: { usd: 0, runs: 0 },
      written: { usd: 0, runs: 0 },
      batches: [],
      started: [],
      unreadable: [
        `${buried.url}, whose first line is not the hidden line of a batch of this plan`,
        `${otherPlan.url}, whose first line is not the hidden line of a batch of this plan`,
      ],
    });
  });

  it('reads none of the visible text, so a changed table changes no sum', () => {
    const body = posted(first).body.replace('| ok | 1.25 |', '| ok | 0.01 |');

    expect(spentUsd([comment(body)], HASH).usd).toBeCloseTo(1.25 + 2 * USD_PER_RUN);
  });

  it('leaves out and names a comment that someone else edited', () => {
    const edited = comment(posted(first).body, HARNESS, PERSON);
    const selfEdited = comment(posted(first).body, HARNESS, HARNESS);

    expect(spentUsd([edited], HASH)).toEqual({
      usd: 0,
      runs: 0,
      held: { usd: 0, runs: 0 },
      written: { usd: 0, runs: 0 },
      batches: [],
      started: [],
      unreadable: [`${edited.url}, which someone other than the workflow edited`],
    });
    expect(spentUsd([selfEdited], HASH).unreadable).toEqual([]);
  });

  it('keeps a ledger line out of the sum when a finding title tries to write one', () => {
    const injected = batchReport(
      input({
        planned: [],
        results: [],
        findings: [
          { kind: 'issue', title: `x\n<!-- sb-qa-run forged/1/linux/claude/x usd=999 -->` },
        ],
      })
    );

    expect(spentUsd([posted(injected)], HASH).usd).toBe(0);
    expect(posted(injected).body).toContain('- new issue: x &lt;!-- sb-qa-run forged');
  });
});

describe('nextStep', () => {
  const step = (
    overrides: Partial<BatchInput> = {},
    capUsd = 250,
    chain = true,
    reported?: Written
  ) => {
    const report = batchReport(input(overrides));
    return nextStep({
      report,
      spend: spentUsd([], HASH, report),
      capUsd,
      chain,
      reported,
      discussions: [],
    });
  };

  it('starts the batch after this one', () => {
    expect(step()).toEqual({ start: 2 });
  });

  it('stops at the cap and names the spent amount and the cap', () => {
    expect(step({}, 0.1)).toEqual({
      stop: 'Batch 2 was not started, because $6.43 is spent and the cap is $0.10.',
      resume: 2,
    });
  });

  it('stops after the last batch', () => {
    expect(step({ batch: 2 })).toEqual({ stop: 'Batch 2 is the last batch of the plan.' });
  });

  it('stops when the run does not chain', () => {
    expect(step({}, 250, false)).toEqual({
      stop: 'Batch 2 was not started, because this run does not chain.',
      resume: 2,
    });
  });

  it('repeats what the first report of a batch said comes next, and starts nothing again', () => {
    const first = posted(batchReport(input()));

    expect(step({}, 250, true, first)).toEqual({ stop: 'Batch 2 is started.' });
    expect(step({}, 0.1, false, first)).toEqual({ stop: 'Batch 2 is started.' });
  });

  it('stops when the batch left no result', () => {
    expect(step({ results: [] })).toEqual({
      stop: 'Batch 2 was not started, because batch 1 left no result.',
      resume: 2,
    });
  });

  it('stops when a comment of the plan was edited by someone else', () => {
    const report = batchReport(input({ batch: 2, batches: 3 }));
    const edited = comment(posted(batchReport(input())).body, HARNESS, PERSON);

    expect(
      nextStep({
        report,
        spend: spentUsd([edited], HASH, report),
        capUsd: 250,
        chain: true,
        reported: undefined,
        discussions: [],
      })
    ).toEqual({
      stop: `Batch 3 was not started, because the spend of this plan cannot be read from ${edited.url}, which someone other than the workflow edited.`,
      resume: 3,
    });
  });

  it('never names a batch at or below the current one', () => {
    for (const batch of [1, 2, 3, 4]) {
      const next = step({ batch, batches: 4 });
      expect('start' in next ? next.start : batch + 1).toBeGreaterThan(batch);
    }
  });
});

describe('a batch whose collect failed', () => {
  it('says that its findings were not collected instead of claiming none', () => {
    const body = posted(batchReport(input({ findings: null }))).body;

    expect(body).toContain('The findings were not collected, so this comment lists none.');
    expect(body).not.toContain('No findings.');
  });

  it('says that a run that files files nothing, since its file job does not run', () => {
    const body = posted(batchReport(input({ findings: null, filing: 'pending' }))).body;

    expect(body).toContain(
      'The findings were not collected, so this run files nothing. The artifacts of this batch expire on 2027-02-14.'
    );
    expect(body).not.toContain('The file job of this run files');
  });
});

describe('chainEndComment', () => {
  const end = { file: '11.0.md', hash: HASH, batch: 3, run: '43900000007', now: 'aaaaaaaaaaaa' };

  it('says that the run ran nothing for its batch, and what it found', () => {
    expect(chainEndComment([], end)).toMatchInlineSnapshot(`
      "<!-- sb-qa-end 3f9c2a7b10de batch=3 run=43900000007 -->
      Workflow run 43900000007 ran nothing for batch 3 of this plan, because it found \`11.0.md\` with the hash \`aaaaaaaaaaaa\` where this sweep has the hash \`3f9c2a7b10de\`.
      A changed plan is a sweep of its own, with a discussion of its own.
      "
    `);
    expect(chainEndComment([], { ...end, now: undefined })).toContain(
      'ran nothing for batch 3 of this plan, because it found no `11.0.md` where this sweep has the hash'
    );
  });

  it('says it once for a run, and is no comment the spend cannot read', () => {
    const said = comment(chainEndComment([], end)!);

    expect(chainEndComment([said], end)).toBeUndefined();
    expect(chainEndComment([comment(said.body, PERSON)], end)).toBeDefined();
    expect(spentUsd([said], HASH)).toEqual({
      usd: 0,
      runs: 0,
      held: { usd: 0, runs: 0 },
      written: { usd: 0, runs: 0 },
      batches: [],
      started: [],
      unreadable: [],
    });
  });
});

describe('the last line of a batch comment', () => {
  const lastLine = (overrides: Partial<BatchInput>, expiresOn?: string) =>
    renderBatchComment(batchReport(input(overrides)), {
      spend: spentUsd([], HASH),
      cost: costOf([], batchReport(input(overrides))),
      capUsd: 250,
      next: { start: 2 },
      expiresOn,
      carried: [],
      short: false,
    })
      .trimEnd()
      .split('\n')
      .at(-1);

  it('says Filed only when every new issue was filed', () => {
    const filed = { kind: 'issue', title: 'Crash', issue: 37400 } as const;
    const unfiled = { kind: 'issue', title: 'Hang' } as const;

    expect(lastLine({ filing: 'filed', findings: [filed] }, '2027-02-14')).toBe(
      'Filed. The artifacts of this batch expire on 2027-02-14.'
    );
    expect(lastLine({ filing: 'filed', findings: [filed, unfiled] }, '2027-02-14')).toBe(
      '1 new issue was not filed, and the log of the file job says why. The artifacts of this batch expire on 2027-02-14.'
    );
    expect(lastLine({ filing: 'filed', findings: [unfiled, unfiled] })).toBe(
      '2 new issues were not filed, and the log of the file job says why.'
    );
  });

  it('says that the filing did not finish after a failed file step, also for a comment on a known issue', () => {
    const known = { kind: 'comment', title: 'Seen again', issue: 37490 } as const;
    const filed = { kind: 'issue', title: 'Crash', issue: 37400 } as const;

    expect(lastLine({ filing: 'failed', findings: [known] }, '2027-02-14')).toBe(
      'The filing did not finish, and the log of the file job says what was not filed. The artifacts of this batch expire on 2027-02-14.'
    );
    expect(lastLine({ filing: 'failed', findings: [filed] })).toBe(
      'The filing did not finish, and the log of the file job says what was not filed.'
    );
  });

  it.each(['filed', 'failed'] as const)(
    'says that nothing was filed when the findings of a %s batch were not collected',
    (filing) => {
      expect(lastLine({ filing, findings: null })).toBe(
        'The findings were not collected, so nothing was filed.'
      );
    }
  );

  it('names no day of expiry when the runs hold no result artifact', () => {
    expect(lastLine({})).toBe(
      'Dry run, so nothing was filed, and workflow run 43900000001 holds no result artifact to file.'
    );
    expect(lastLine({ filing: 'pending' })).toBe(
      'The file job of this run files the batch next and then names each issue here.'
    );
  });
});

describe('the filing line of a dry run', () => {
  const sweep = (overrides: Partial<CollectInput> = {}): CollectInput => ({
    ref: 'valentin/tier1-catalog',
    version: '11.0.0-beta.3',
    fromRuns: undefined,
    runId: '43846197088',
    groups: undefined,
    plan: undefined,
    ...overrides,
  });

  it('files a sweep with its branch, version and run, and with dry set to false', () => {
    expect(dryFiling(collectOf(sweep()), '2027-02-14')).toBe(
      'Dry run, so nothing was filed. To file this sweep, run `gh workflow run ecosystem-qa.yml --ref valentin/tier1-catalog -f version=11.0.0-beta.3 -f from_runs=43846197088 -f dry=false` before its artifacts expire on 2027-02-14.'
    );
  });

  it('repeats the groups document of a sweep as one shell word, in a code span that a backtick in it cannot end', () => {
    const groups = '{"groups":[{"fingerprints":["a"],"skip":"it\'s `next` only"}]}';

    expect(dryFiling(collectOf(sweep({ groups })), '2027-02-14')).toBe(
      'Dry run, so nothing was filed. To file this sweep, run `` gh workflow run ecosystem-qa.yml --ref valentin/tier1-catalog -f version=11.0.0-beta.3 -f groups=\'{"groups":[{"fingerprints":["a"],"skip":"it\'\\\'\'s `next` only"}]}\' -f from_runs=43846197088 -f dry=false `` before its artifacts expire on 2027-02-14.'
    );
  });

  it('names the runs a run collected with from_runs, not the run itself', () => {
    expect(
      dryFiling(collectOf(sweep({ fromRuns: '43900000002,43900000001' })), '2027-02-14')
    ).toContain('-f from_runs=43900000001,43900000002 -f dry=false');
  });

  it('prints the dispatch of the comment of the batch for a batch of a plan', () => {
    const batch = input({ planned: [{ ...job('mantine'), engine: 'codex' }, job('mealdrop')] });
    const comment = renderBatchComment(batchReport(batch), {
      spend: spentUsd([], HASH),
      cost: costOf([], batchReport(batch)),
      capUsd: 250,
      next: { start: 2 },
      expiresOn: '2027-02-14',
      carried: [],
      short: false,
    });
    const summary = dryFiling(
      collectOf({
        ref: batch.ref,
        version: batch.version,
        fromRuns: undefined,
        runId: batch.runs[0],
        groups: '{"groups":[]}',
        plan: { scope: { ...batch.plan, batch: batch.batch }, planned: batch.planned },
      }),
      '2027-02-14'
    );

    expect(summary).toContain('-f engines=claude,codex');
    expect(comment.trimEnd().split('\n').at(-1)).toBe(summary);
  });

  it('prints no dispatch for local results, nor for runs that hold no result artifact', () => {
    expect(dryFiling(collectOf(sweep({ runId: undefined })), '2027-02-14')).toBe(
      'Dry run of local results, so nothing was filed, and no workflow run holds them to file.'
    );
    expect(dryFiling(collectOf(sweep()), undefined)).toBe(
      'Dry run, so nothing was filed, and workflow run 43846197088 holds no result artifact to file.'
    );
  });
});

describe('resultsExpireOn', () => {
  it('is the day the first result artifact expires, whatever the other artifacts say', () => {
    expect(
      resultsExpireOn([
        { name: 'qa-proposals', expires_at: '2026-11-20T08:00:00Z' },
        { name: 'qa-result-mealdrop-linux-claude-part-2', expires_at: '2026-11-30T23:30:00Z' },
        { name: 'qa-result-mantine-linux-claude-part-1', expires_at: '2026-11-29T10:00:00Z' },
      ])
    ).toBe('2026-11-29');
  });

  it('has no day when the runs hold no result artifact', () => {
    expect(
      resultsExpireOn([{ name: 'qa-proposals', expires_at: '2026-11-20T08:00:00Z' }])
    ).toBeUndefined();
  });
});

describe('trackBatch', () => {
  const batchOne = posted(
    batchReport(input({ planned: [job('mealdrop')], results: [result('mealdrop', { usd: 40 })] }))
  );
  const batchTwo = (usd: number, overrides: Partial<BatchInput> = {}) =>
    batchReport(
      input({
        batch: 2,
        batches: 3,
        runs: ['43900000002'],
        planned: [job('mantine')],
        results: [result('mantine', { usd })],
        ...overrides,
      })
    );
  const track = (
    report: BatchReport,
    comments: Written[],
    capUsd = 60,
    { chain = true, discussions = [] as string[] } = {}
  ) => {
    const tracked = trackBatch({
      report,
      comments,
      capUsd,
      chain,
      discussions,
      expiresOn: '2027-02-14',
    });
    if ('refuse' in tracked) {
      throw new Error(tracked.refuse);
    }
    return tracked;
  };

  it('stops the chain when the spend reaches the cap exactly, and starts it one cent below', () => {
    expect(track(batchTwo(20), [batchOne]).next).toEqual({
      stop: 'Batch 3 was not started, because $60.00 is spent and the cap is $60.00.',
      resume: 3,
    });
    expect(track(batchTwo(19.99), [batchOne]).next).toEqual({ start: 3 });
  });

  const costLines = (body: string) =>
    body.split('\n').filter((line) => /^(Batch \d+ cost|The plan cost) /.test(line));

  it('says what the batch cost and what the plan cost up to it', () => {
    const batchThree = batchReport(
      input({
        batch: 3,
        batches: 4,
        runs: ['43900000003'],
        planned: [job('primer-react')],
        results: [result('primer-react', { usd: 3 })],
      })
    );
    const second = comment(track(batchTwo(5), [batchOne], 250).body);

    expect(costLines(track(batchThree, [batchOne, second], 250).body)).toEqual([
      'Batch 3 cost $3.00 for 1 run.',
      'The plan cost $48.00 for 3 runs up to batch 3, of a cap of $250.00.',
    ]);
  });

  it('writes the same cost when the batch is reported again after later batches, also one whose cost may be short', () => {
    const later = (batch: number, attempt = 1) =>
      batchReport(
        input({
          batch,
          batches: 4,
          attempt,
          runs: [`4390000000${batch}`],
          planned: [job('primer-react')],
          results: [result('primer-react', { usd: batch })],
        })
      );
    const first = track(batchTwo(5), [batchOne], 250);
    const second = comment(first.body);
    const third = comment(track(later(3, 2), [batchOne, second], 250).body);
    const filed = track(batchTwo(5, { filing: 'filed' }), [batchOne, second, third], 250, {
      chain: false,
    });

    expect(costLines(third.body)).toContain(
      'The plan cost at least $48.00 for 3 runs up to batch 3, of a cap of $250.00.'
    );
    expect(filed.existing).toBe(second);
    expect(costLines(filed.body)).toEqual([
      'Batch 2 cost $5.00 for 1 run.',
      'The plan cost $45.00 for 2 runs up to batch 2, of a cap of $250.00.',
    ]);
    expect(costLines(filed.body)).toEqual(costLines(first.body));
  });

  it('sums every report of a batch that ran twice once, and counts a run collected again once', () => {
    const rerun = batchTwo(3, {
      version: '11.0.0-beta.4',
      runs: ['43900000012'],
      results: [result('mantine', { usd: 3, startedAt: '2026-11-17T09:00:00Z' })],
    });
    const both = batchTwo(3, {
      version: '11.0.0-beta.4',
      runs: ['43900000002', '43900000012'],
      results: [
        result('mantine', { usd: 5 }),
        result('mantine', { usd: 3, startedAt: '2026-11-17T09:00:00Z' }),
      ],
    });
    const second = comment(track(batchTwo(5), [batchOne], 250).body);
    const again = track(rerun, [batchOne, second], 250);

    expect(costLines(again.body)).toEqual([
      'Batch 2 cost $8.00 for 2 runs in 2 reports.',
      'The plan cost $48.00 for 3 runs up to batch 2, of a cap of $250.00.',
    ]);
    expect(costLines(track(both, [batchOne, second, comment(again.body)], 250).body)).toEqual([
      'Batch 2 cost $8.00 for 2 runs in 3 reports.',
      'The plan cost $48.00 for 3 runs up to batch 2, of a cap of $250.00.',
    ]);
  });

  it('stops at the cap on the cost of the whole plan, not on the cost of the batch', () => {
    const tracked = track(batchTwo(20), [batchOne]);

    expect(tracked.next).toEqual({
      stop: 'Batch 3 was not started, because $60.00 is spent and the cap is $60.00.',
      resume: 3,
    });
    expect(costLines(tracked.body)).toEqual([
      'Batch 2 cost $20.00 for 1 run.',
      'The plan cost $60.00 for 2 runs up to batch 2, of a cap of $60.00.',
    ]);
  });

  it('counts a run at the highest price any comment of the plan holds for it', () => {
    const report = (usd: number, runs: string[]) =>
      batchReport(
        input({ runs, planned: [job('mealdrop')], results: [result('mealdrop', { usd })] })
      );
    const high = posted(report(40, ['43900000001']));
    const low = posted(report(1, ['43900000001', '43900000009']));

    expect(track(batchTwo(19.99), [high, low]).next).toEqual({ start: 3 });
    expect(track(batchTwo(20), [high, low]).next).toMatchObject({ stop: expect.any(String) });
    expect(track(batchTwo(20), [low, high]).next).toMatchObject({ stop: expect.any(String) });
  });

  it('edits the comment of a batch that is reported again, and adds one for a new report', () => {
    const report = batchTwo(5);
    const first = track(report, [batchOne]);
    const reported = comment(first.body);

    expect(first.existing).toBeUndefined();
    expect(track(report, [batchOne, reported]).existing).toBe(reported);
  });

  it.each([
    ['adds a line above its hidden lines', (body: string) => `Reviewed, thanks.\n\n${body}`],
    ['removes its first hidden line', (body: string) => body.replace(/^.*\n/, '')],
    ['changes a hidden line', (body: string) => body.replace('usd=40.000000', 'usd=0.400000')],
  ])('stops the chain when a person %s of an earlier batch', (_, edit) => {
    const edited = comment(edit(batchOne.body), HARNESS, PERSON);
    const tracked = track(batchTwo(1), [edited], 250);

    expect(tracked.next).toEqual({
      stop: `Batch 3 was not started, because the spend of this plan cannot be read from ${edited.url}, which someone other than the workflow edited.`,
      resume: 3,
    });
    expect(tracked.body).toContain(
      'The plan cost at least $1.00 for 1 run up to batch 2, of a cap of $250.00.'
    );
  });

  it('writes nothing over a comment of the batch that someone else edited', () => {
    const report = batchTwo(5);
    const edited = comment(track(report, [batchOne]).body, HARNESS, PERSON);

    expect(
      trackBatch({
        report,
        comments: [batchOne, edited],
        capUsd: 250,
        chain: false,
        discussions: [],
        expiresOn: '2027-02-14',
      })
    ).toEqual({
      refuse: `Batch 2 is not reported again, because someone other than the workflow edited ${edited.url}, and writing over it would hide that edit. Every later batch of this plan stops at that comment.`,
    });
  });

  it('starts the next batch only when the discussion holds a report of every batch before this one', () => {
    const batchThree = batchReport(input({ batch: 3, batches: 4, runs: ['43900000003'] }));
    const missing = (batch: number) => ({
      stop: `Batch 4 was not started, because this discussion holds no report of batch ${batch}, so the spend of the plan is unknown.`,
      resume: 4,
    });
    const second = comment(track(batchTwo(1), [batchOne]).body);

    expect(track(batchThree, [batchOne, second], 250).next).toEqual({ start: 4 });
    expect(track(batchThree, [second], 250).next).toEqual(missing(1));
    expect(track(batchThree, [batchOne], 250).next).toEqual(missing(2));
    expect(track(batchTwo(1), [], 250).next).toEqual({
      stop: 'Batch 3 was not started, because this discussion holds no report of batch 1, so the spend of the plan is unknown.',
      resume: 3,
    });
    expect(track(batchThree, [], 250).next).toEqual({
      stop: 'Batch 4 was not started, because this discussion holds no report of batches 1 and 2, so the spend of the plan is unknown.',
      resume: 4,
    });
    expect(track(batchThree, [second], 250).body).toContain('The plan cost at least $');
  });

  it('starts no batch that a report in the discussion went past already', () => {
    const second = comment(track(batchTwo(1), [batchOne]).body);
    const lateFirst = batchReport(input({ runs: ['43900000009'] }));

    expect(track(lateFirst, [batchOne, second], 250).next).toEqual({
      stop: 'Batch 2 was not started, because this discussion holds a report of batch 2 already, so another run of the plan went on from here.',
    });
  });

  it('keeps the reason the chain stopped when the batch is reported again, for example when it is filed', () => {
    const report = batchTwo(25);
    const capped = comment(track(report, [batchOne]).body);
    const filed = batchTwo(25, { filing: 'filed' });
    const again = trackBatch({
      report: filed,
      comments: [batchOne, capped],
      capUsd: 1000,
      chain: false,
      discussions: [],
      expiresOn: '2027-02-14',
    });

    expect(again).toMatchObject({
      existing: capped,
      next: {
        stop: 'Batch 3 was not started, because $65.00 is spent and the cap is $60.00.',
        resume: 3,
      },
    });
    expect('body' in again && again.body).toContain(
      'Next: Batch 3 was not started, because $65.00 is spent and the cap is $60.00.'
    );
  });

  it('starts no second chain from a second run of the same batch', () => {
    const first = comment(track(batchTwo(1), [batchOne]).body);
    const rerun = batchTwo(1, { runs: ['5'] });

    expect(track(rerun, [batchOne, first]).next).toEqual({
      stop: 'Batch 3 was not started again, because an earlier report of batch 2 started it already.',
    });
  });

  it('starts a batch again after the report that stopped it, when a second run of the batch chains', () => {
    const lost = comment(track(batchTwo(1, { results: [] }), [batchOne]).body);

    expect(track(batchTwo(1, { runs: ['6'] }), [batchOne, lost]).next).toEqual({ start: 3 });
  });

  it('prices a job again that a second attempt of the run lost again, and once more when it finishes', () => {
    const planned = [job('mealdrop'), job('mantine')];
    const attempt = (number: number, results = [result('mealdrop', { usd: 5 })]) =>
      batchReport(input({ attempt: number, planned, results }));
    const reportOf = (report: BatchReport, comments: Written[]) => {
      const tracked = trackBatch({
        report,
        comments,
        capUsd: 250,
        chain: false,
        discussions: [],
        expiresOn: '2027-02-14',
      });
      if ('refuse' in tracked) {
        throw new Error(tracked.refuse);
      }
      return comment(tracked.body);
    };
    const first = reportOf(attempt(1), []);
    const second = reportOf(attempt(2), [first]);
    const third = reportOf(
      attempt(3, [
        result('mealdrop', { usd: 5 }),
        result('mantine', { usd: 4, startedAt: '2026-11-16T15:00:00Z' }),
      ]),
      [first]
    );

    expect(spentUsd([first], HASH).usd).toBeCloseTo(5 + USD_PER_RUN);
    expect(spentUsd([second], HASH).usd).toBeCloseTo(5 + 2 * USD_PER_RUN);
    expect(spentUsd([third], HASH).usd).toBeCloseTo(5 + USD_PER_RUN + 4);
  });

  it('reads the same runs collected in another order as the same report', () => {
    const forward = batchReport(input({ runs: ['43900000009', '43900000001'] }));
    const backward = batchReport(input({ runs: ['43900000001', '43900000009'] }));

    expect(forward.runs).toEqual(['43900000001', '43900000009']);
    expect(batchCommentOf([posted(forward)], backward)).toBeDefined();
    expect(spentUsd([posted(forward), posted(backward)], HASH).runs).toBe(3);
  });

  it('prints the dispatch that files a batch on its branch and with its engines, so the filing run plans the jobs that ran', () => {
    const report = batchReport(
      input({ ref: 'qa/try', planned: [{ ...job('mealdrop'), engine: 'codex' }], results: [] })
    );

    expect(track(report, []).body).toContain(
      '`gh workflow run ecosystem-qa.yml --ref qa/try -f plan=11.0.md -f batch=1 -f plan_hash=3f9c2a7b10de -f version=11.0.0-beta.3 -f engines=codex -f from_runs=43900000001 -f dry=false`'
    );
  });

  it('starts the next batch on the branch, engines and budget of this one', () => {
    const report = batchReport(
      input({
        ref: 'qa/try',
        budgetMinutes: '120',
        planned: [job('mealdrop'), { ...job('mealdrop'), engine: 'codex' }],
      })
    );

    expect(batchDispatch(report, 2)).toEqual([
      ...['workflow', 'run', 'ecosystem-qa.yml'],
      ...['--ref', 'qa/try', '-f', 'plan=11.0.md', '-f', 'batch=2', '-f', `plan_hash=${HASH}`],
      ...['-f', 'chain=true', '-f', 'version=11.0.0-beta.3', '-f', 'engines=claude,codex'],
      ...['-f', 'budget_minutes=120'],
    ]);
  });

  it('starts no batch from the first report of a later attempt of a run, whose earlier attempts may have spent', () => {
    const tracked = track(batchTwo(1, { attempt: 2 }), [batchOne], 250);
    const reported = comment(track(batchTwo(1), [batchOne], 250).body);

    expect(tracked.next).toEqual({
      stop: 'Batch 3 was not started, because attempt 2 of workflow run 43900000002 is its first report here, so what its earlier attempts spent, and whether one of them started batch 3, is unknown.',
      resume: 3,
    });
    expect(tracked.body).toContain('The plan cost at least $41.00 for 2 runs');
    expect(track(batchTwo(1, { attempt: 2 }), [batchOne, reported], 250).body).toContain(
      'The plan cost $41.00 for 2 runs'
    );
  });

  it('keeps saying "at least" when a batch whose spend may be short is reported again, for example when it is filed', () => {
    const stopped = comment(track(batchTwo(1, { attempt: 2 }), [batchOne], 250).body);
    const filed = track(batchTwo(1, { attempt: 2, filing: 'filed' }), [batchOne, stopped], 250, {
      chain: false,
    });

    expect(filed.existing).toBe(stopped);
    expect(filed.body).toContain(
      'Batch 2 cost $1.00 for 1 run.\nThe plan cost at least $41.00 for 2 runs up to batch 2, of a cap of $250.00.\n\nNext: Batch 3 was not started, because attempt 2 of workflow run 43900000002 is its first report here, so what its earlier attempts spent, and whether one of them started batch 3, is unknown.'
    );
  });

  it('stops the chain when a comment is gone that a later comment counted, also when its batch has another', () => {
    const again = batchReport(
      input({
        runs: ['43900000009'],
        planned: [job('mealdrop')],
        results: [result('mealdrop', { usd: 35, startedAt: '2026-11-17T09:00:00Z' })],
      })
    );
    const second = comment(track(again, [batchOne], 250, { chain: false }).body);
    const third = comment(track(batchTwo(1), [batchOne, second], 250).body);
    const batchThree = batchReport(
      input({ batch: 3, batches: 4, runs: ['43900000003'], planned: [job('primer-react')] })
    );
    const tracked = track(batchTwo(1), [second], 250);

    expect(track(batchTwo(1), [batchOne, second], 250).next).toEqual({ start: 3 });
    expect(tracked.next).toEqual({
      stop: 'Batch 3 was not started, because the comments of this discussion hold $35.00 for 1 run, where one of them was written with $75.00 for 2 runs, so a comment of the workflow is gone.',
      resume: 3,
    });
    expect(tracked.body).toContain('The plan cost at least $36.00 for 2 runs');
    expect(track(batchThree, [batchOne, second, third], 250).next).toEqual({ start: 4 });
    expect(track(batchThree, [batchOne, third], 250).next).toEqual({
      stop: 'Batch 4 was not started, because the comments of this discussion hold $41.00 for 2 runs, where one of them was written with $76.00 for 3 runs, so a comment of the workflow is gone.',
      resume: 4,
    });
  });

  it('keeps stopping the chain for a comment that is gone after the workflow writes again, by a filing or a start by hand', () => {
    const again = (filing: BatchInput['filing']) =>
      batchReport(
        input({
          runs: ['43900000009'],
          filing,
          planned: [job('mealdrop')],
          results: [result('mealdrop', { usd: 35, startedAt: '2026-11-17T09:00:00Z' })],
        })
      );
    const second = comment(track(again('dry'), [batchOne], 250, { chain: false }).body);
    const refiled = comment(track(again('filed'), [second], 250, { chain: false }).body);
    const stopped = track(batchTwo(1), [refiled], 250);
    const batchThree = batchReport(
      input({ batch: 3, batches: 4, runs: ['43900000003'], planned: [job('primer-react')] })
    );
    const byHand = track(batchThree, [refiled, comment(stopped.body)], 250);

    expect(stopped.next).toEqual({
      stop: 'Batch 3 was not started, because the comments of this discussion hold $35.00 for 1 run, where one of them was written with $75.00 for 2 runs, so a comment of the workflow is gone.',
      resume: 3,
    });
    expect(stopped.body).toContain('The plan cost at least $36.00 for 2 runs');
    expect(byHand.next).toEqual({
      stop: 'Batch 4 was not started, because the comments of this discussion hold $36.00 for 2 runs, where one of them was written with $76.00 for 3 runs, so a comment of the workflow is gone.',
      resume: 4,
    });
    expect(byHand.body).toContain('The plan cost at least $');
  });

  it('stops the chain and names the discussions when the plan has more than one', () => {
    const discussions = [
      'https://github.com/storybookjs/storybook/discussions/1',
      'https://github.com/storybookjs/storybook/discussions/3',
    ];
    const tracked = track(batchTwo(1), [batchOne], 250, { discussions });

    expect(tracked.next).toEqual({
      stop: `Batch 3 was not started, because the plan has 2 discussions, ${discussions[0]} and ${discussions[1]}, which share its spend.`,
      resume: 3,
    });
    expect(tracked.body).toContain('The plan cost at least $41.00');
    expect(track(batchTwo(1), [batchOne], 250, { discussions: [discussions[0]!] }).next).toEqual({
      start: 3,
    });
  });

  it('prints how to start the next batch by hand when the chain stops, and keeps it when the batch is reported again', () => {
    const lost = track(batchTwo(1, { results: [] }), [batchOne], 250);
    const line =
      'To start batch 3 by hand once the reason is gone, run `gh workflow run ecosystem-qa.yml --ref qa/plans -f plan=11.0.md -f batch=3 -f plan_hash=3f9c2a7b10de -f chain=true -f version=11.0.0-beta.3 -f engines=claude`.';
    const again = track(batchTwo(1, { attempt: 2 }), [batchOne, comment(lost.body)], 250);

    expect(lost.body).toContain(
      `Next: Batch 3 was not started, because batch 2 left no result.\n\n${line}`
    );
    expect(again.next).toEqual({
      stop: 'Batch 3 was not started, because batch 2 left no result.',
      resume: 3,
    });
    expect(again.body).toContain(line);
  });

  it('prints no start by hand for a batch that is started, that a report went past, or after the last batch', () => {
    const started = comment(track(batchTwo(1), [batchOne], 250).body);

    expect(started.body).not.toContain('by hand');
    expect(track(batchTwo(1, { runs: ['5'] }), [batchOne, started], 250).body).not.toContain(
      'by hand'
    );
    expect(track(batchTwo(1, { batches: 2 }), [batchOne], 250).body).not.toContain('by hand');
  });

  it('says that the next batch is started only once its dispatch went through', () => {
    const tracked = track(batchTwo(1), [batchOne], 250);
    const dispatched: number[] = [];
    const failed = startNext(tracked, () => {
      throw new Error('HTTP 403: Resource not accessible by integration');
    });

    expect(startNext(tracked, (batch) => dispatched.push(batch))).toEqual({ body: tracked.body });
    expect(dispatched).toEqual([3]);
    expect(tracked.body).toContain('Next: Batch 3 is started.');
    expect(failed.failure).toBe(
      'Batch 3 was not started, because its dispatch failed: HTTP 403: Resource not accessible by integration'
    );
    expect(failed.body).toContain(
      'Next: Batch 3 was not started, because its dispatch failed: HTTP 403: Resource not accessible by integration\n\nTo start batch 3 by hand'
    );
    expect(failed.body).not.toContain('is started');
  });

  it('dispatches nothing when the chain stops', () => {
    const tracked = track(batchTwo(1), [batchOne], 1);
    const dispatched: number[] = [];

    expect(startNext(tracked, (batch) => dispatched.push(batch))).toEqual({ body: tracked.body });
    expect(dispatched).toEqual([]);
  });
});

describe('findingsOf', () => {
  it('names the filed issue of a new issue, and the known issue of a comment or a suppressed finding', () => {
    expect(
      findingsOf(
        [
          { kind: 'issue', title: 'Crash', fingerprint: 'a' },
          { kind: 'issue', title: 'Hang', fingerprint: 'b' },
          { kind: 'comment', title: 'Seen again', existingIssue: 37364 },
          { kind: 'suppressed', title: 'Known', existingIssue: 37365 },
          { kind: 'skipped', title: 'Not a bug' },
        ],
        new Map([['a', 37400]])
      )
    ).toEqual([
      { kind: 'issue', title: 'Crash', issue: 37400 },
      { kind: 'issue', title: 'Hang' },
      { kind: 'comment', title: 'Seen again', issue: 37364 },
      { kind: 'suppressed', title: 'Known', issue: 37365 },
      { kind: 'skipped', title: 'Not a bug' },
    ]);
  });
});

describe('attemptOf', () => {
  it('is the attempt of the run that reports its own batch, and 1 for a collect of other runs', () => {
    const env = { GITHUB_RUN_ID: '43900000002', GITHUB_RUN_ATTEMPT: '3' };

    expect(attemptOf(['43900000002'], env)).toBe(3);
    expect(attemptOf(['43900000001'], env)).toBe(1);
    expect(attemptOf(['43900000001', '43900000002'], env)).toBe(1);
    expect(attemptOf(['43900000002'], { GITHUB_RUN_ID: '43900000002' })).toBe(1);
  });
});
