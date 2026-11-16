import { describe, expect, it } from 'vitest';

import { loaded } from './fixtures.ts';
import { USD_PER_RUN } from './qa-plan.ts';
import {
  batchCommentOf,
  batchReport,
  nextStep,
  renderBatchComment,
  renderTrackingThread,
  resultsExpireOn,
  spentUsd,
  trackingThreadOf,
  type BatchInput,
  type BatchReport,
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
  plan: { file: 'ecosystem-qa/plans/11.0.md', hash: HASH },
  batch: 1,
  batches: 2,
  version: '11.0.0-beta.3',
  runs: ['43900000001'],
  dry: true,
  planned: [job('mealdrop'), job('mealdrop', 2), job('mantine')],
  results: [result('mealdrop'), result('mealdrop', { part: 2, usd: null })],
  findings: [{ kind: 'issue', title: '[SB 11 QA]: Dev server crashes' }],
  ...overrides,
});

const comment = (
  body: string,
  author = HARNESS,
  editor: typeof HARNESS | null = null
): Written => ({
  url: `https://github.com/storybookjs/storybook/discussions/1#discussioncomment-${body.length}`,
  body,
  author,
  editor,
});

const posted = (report: BatchReport, author = HARNESS) =>
  comment(
    renderBatchComment(report, {
      spend: spentUsd([], HASH, report),
      capUsd: 250,
      next: { start: 2 },
      expiresOn: '2027-02-14',
    }),
    author
  );

describe('renderTrackingThread and trackingThreadOf', () => {
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

  it('finds the oldest discussion the workflow wrote for the hash', () => {
    const found = trackingThreadOf(
      [discussion(9, thread.body), discussion(7, thread.body), discussion(8, 'unrelated')],
      HASH
    );

    expect(found?.number).toBe(7);
  });

  it('ignores a discussion by another account, a marker below the first line, and another hash', () => {
    expect(
      trackingThreadOf(
        [
          discussion(1, thread.body, PERSON),
          discussion(2, `Notes\n${thread.body}`),
          discussion(3, thread.body.replace(HASH, 'aaaaaaaaaaaa')),
        ],
        HASH
      )
    ).toBeUndefined();
  });

  it('reads a marker in a body that an edit in the browser saved with CRLF', () => {
    expect(
      trackingThreadOf([discussion(4, thread.body.replaceAll('\n', '\r\n'))], HASH)?.number
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

      Spent on this plan: $6.43 for 3 runs, of a cap of $250.00. Batch 2 is started next.

      Dry run, so nothing was filed. To file this batch, run \`gh workflow run ecosystem-qa.yml --ref qa/plans -f plan=ecosystem-qa/plans/11.0.md -f batch=1 -f version=11.0.0-beta.3 -f from_runs=43900000001 -f dry=false\` before its artifacts expire on 2027-02-14.
      "
    `);
  });

  it('round-trips: the spend read back from the comment is the dollars it was written with', () => {
    const report = batchReport(input());

    const spend = spentUsd([posted(report)], HASH);

    expect(spend.usd).toBeCloseTo(1.25 + 2 * USD_PER_RUN);
    expect(spend.runs).toBe(3);
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

  it('names the issue each finding was filed as or commented on', () => {
    const report = batchReport(
      input({
        dry: false,
        findings: [
          { kind: 'issue', title: 'Crash', issue: 37400 },
          { kind: 'comment', title: 'Seen again', issue: 37364 },
          { kind: 'suppressed', title: 'Known', issue: 37365 },
          { kind: 'skipped', title: 'Not a bug' },
        ],
      })
    );

    expect(posted(report).body).toContain(
      [
        '- filed as #37400: Crash',
        '- comment on #37364: Seen again',
        '- known as #37365: Known',
        '- skipped: Not a bug',
      ].join('\n')
    );
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

  it('takes the report it is about to write in place of the comment of that batch', () => {
    const recollected = batchReport(input({ planned: [job('mealdrop'), job('mealdrop', 2)] }));

    expect(spentUsd([posted(first)], HASH, recollected).usd).toBeCloseTo(1.25 + USD_PER_RUN);
  });

  it('ignores a comment by another account and a ledger that does not open the comment', () => {
    const forged = posted(batchReport(input({ runs: ['1'] })), PERSON);
    const buried = comment(`Copied:\n${posted(batchReport(input({ runs: ['2'] }))).body}`);

    expect(spentUsd([forged, buried], HASH)).toEqual({ usd: 0, runs: 0, editedComments: [] });
  });

  it('reads none of the visible text, so a changed table changes no sum', () => {
    const body = posted(first).body.replace('| ok | 1.25 |', '| ok | 0.01 |');

    expect(spentUsd([comment(body)], HASH).usd).toBeCloseTo(1.25 + 2 * USD_PER_RUN);
  });

  it('leaves out and names a comment that someone else edited', () => {
    const edited = comment(posted(first).body, HARNESS, PERSON);
    const selfEdited = comment(posted(first).body, HARNESS, HARNESS);

    expect(spentUsd([edited], HASH)).toEqual({ usd: 0, runs: 0, editedComments: [edited.url] });
    expect(spentUsd([selfEdited], HASH).editedComments).toEqual([]);
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
    reportedBefore = false
  ) => {
    const report = batchReport(input(overrides));
    return nextStep({ report, spend: spentUsd([], HASH, report), capUsd, chain, reportedBefore });
  };

  it('starts the batch after this one', () => {
    expect(step()).toEqual({ start: 2 });
  });

  it('stops at the cap and names the spent amount and the cap', () => {
    expect(step({}, 0.1)).toEqual({
      stop: 'Batch 2 was not started, because $6.43 is spent and the cap is $0.10.',
    });
  });

  it('stops after the last batch', () => {
    expect(step({ batch: 2 })).toEqual({ stop: 'Batch 2 is the last batch of the plan.' });
  });

  it('stops when the run does not chain', () => {
    expect(step({}, 250, false)).toEqual({
      stop: 'Batch 2 was not started, because this run does not chain.',
    });
  });

  it('starts no batch twice when a batch is reported again, whether or not the run chains', () => {
    const stop = {
      stop: 'Batch 2 is not started from this report, because batch 1 was reported before and its first report decided that.',
    };

    expect(step({}, 250, true, true)).toEqual(stop);
    expect(step({}, 250, false, true)).toEqual(stop);
  });

  it('stops when the batch left no result', () => {
    expect(step({ results: [] })).toEqual({
      stop: 'Batch 2 was not started, because batch 1 left no result.',
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
        reportedBefore: false,
      })
    ).toEqual({
      stop: `Batch 3 was not started, because someone other than the workflow edited ${edited.url}, so its dollars are not counted.`,
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
