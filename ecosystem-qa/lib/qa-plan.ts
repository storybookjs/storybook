import { createHash } from 'node:crypto';

import { z } from 'zod';

import { SEMVER } from './cycle.ts';
import { CatalogEntry, CheckId } from './schema.ts';
import type { QaStatus, Window, WindowPr } from './window.ts';

// GitHub renders a plan's text as Markdown, where a tag can fold every row after it into a closed
// block, and a character reference, a blank or filler character, or an empty tag shows a cell as
// empty. Where a code span or a link starts depends on GitHub's parser, so the rule holds for the
// whole text, inside code spans too.
const PlainText = z
  .string()
  .regex(/^\S(?:.*\S)?$/, 'expected one line of text')
  .regex(/^[ -~]*$/, 'expected printable ASCII only')
  .regex(/^[^<>]*$/, 'expected no "<" and no ">"')
  .regex(
    /^(?!.*&(?:#\d+|#x[\da-f]+|[a-z][a-z\d]*);)/i,
    'expected no character reference such as "&nbsp;"'
  );
// A link or an image shows its text or nothing, while the agent reads its address too.
const NO_LINK = 'expected no Markdown link or image: write the address out';
const Text = PlainText.regex(/^(?!.*\]\()/, NO_LINK);
const Reason = Text.refine(
  (text) => (text.match(/[a-z]/gi)?.length ?? 0) >= 3,
  'expected at least three letters'
);
// A group source may link the issue or PR it comes from, in the form the plan links a PR.
const Source = PlainText.refine(
  (source) =>
    !source
      .replace(/!?\[#(\d+)\]\([^)]*\)/g, (link, number) =>
        [prCell, issueLink].some((cell) => cell(Number(number)) === link) ? '' : link
      )
      .includes(']('),
  NO_LINK
);
const RepoDir = Text.refine(
  (dir) => !dir.startsWith('/') && !dir.includes('\\') && !dir.split('/').includes('..'),
  'expected a relative path inside the repository'
);
const Slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'expected lower case letters, digits, and hyphens')
  .refine(
    (slug) => CheckId.safeParse(planCheckId(slug)).success,
    'expected a slug short enough for the check id plan.<slug>'
  );
const RepoId = CatalogEntry.shape.id;
const Sha = z.string().regex(/^[0-9a-f]{40}$/, 'expected a full commit SHA');
const PrNumber = z.int().positive();

// A decision cell of a group holds a manual check and its reason as `manual: <check> Why: <why>`,
// after the entries that test the group in part as `<entries>; manual for the rest: <check> Why: <why>`.
const WHY = ' Why: ';
const REST = '; manual for the rest: ';
const ManualCheck = Reason.refine((check) => !check.includes(WHY), `expected no "${WHY.trim()}"`);
const TestedBy = z.strictObject({ entries: z.array(Slug).min(1) });
const ByHand = z.strictObject({ manual: ManualCheck, why: Reason });
const NoQa = z.strictObject({ none: Reason });

// A PR outside a group that an entry tests in part needs no decision of both kinds: the entries
// list it, and its decision is the manual check of the rest.
const PrDecision = z.union([TestedBy, ByHand, NoQa]);
export const Decision = z.union([TestedBy, ByHand, TestedBy.extend(ByHand.shape), NoQa]).nullable();
export type Decision = z.infer<typeof Decision>;

const SKIP_IS_GONE =
  '"skip" is no decision: choose "manual" with the check a person does, or "none" with the reason no QA is needed';
const withoutSkip = <T extends z.ZodType>(schema: T) =>
  z
    .custom((value) => !(value && typeof value === 'object' && 'skip' in value), {
      error: SKIP_IS_GONE,
    })
    .pipe(schema);
const DraftDecision = withoutSkip(PrDecision);

const unique = (values: unknown[]) => new Set(values).size === values.length;
const PrList = z.array(PrNumber).refine(unique, 'a PR is listed twice');
const SomePrs = z.array(PrNumber).min(1).refine(unique, 'a PR is listed twice');

// The checklist and the issue print the line after the word "add".
const Probe = Text.refine(
  (probe) => !/^adds?\s/i.test(probe),
  'expected the line to name what is added, because it reads after "add": drop the leading "add" or "adds"'
);

export const PlanEntry = z.strictObject({
  slug: Slug,
  title: Text,
  prs: SomePrs,
  batch: z.int().min(1),
  // What the run adds to the project after the upgrade, and where.
  probe: Probe.optional(),
  repos: z
    .array(z.strictObject({ id: RepoId, reason: Reason }))
    .min(1)
    .refine((repos) => unique(repos.map((repo) => repo.id)), 'a repo is listed twice'),
  steps: z.array(Text).min(1),
  expected: Text,
});
export type PlanEntry = z.infer<typeof PlanEntry>;

export const DiscoveredRepo = z.strictObject({
  id: RepoId,
  repo: CatalogEntry.shape.repo,
  commit: Sha,
  packageManager: CatalogEntry.shape.packageManager,
  storybookDir: RepoDir,
  major: z.int().positive(),
  stars: z.int().min(0),
  pushedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/, 'expected a time like 2026-11-16T14:42:00Z'),
  reason: Reason,
});
export type DiscoveredRepo = z.infer<typeof DiscoveredRepo>;

// The row without a check holds the PRs that no entry tests and the draft has not decided yet.
const ManualRow = z.union([
  z.strictObject({ check: ManualCheck, why: Reason, prs: SomePrs }),
  z.strictObject({ check: z.null(), why: z.null(), prs: SomePrs }),
]);
type ManualRow = z.infer<typeof ManualRow>;
const NoQaRow = z.strictObject({ reason: Reason, prs: SomePrs });
type NoQaRow = z.infer<typeof NoQaRow>;

const GroupOfDraft = z.strictObject({ slug: Slug, source: Source, decision: Decision });
const GroupOfDraftInput = GroupOfDraft.extend({
  decision: withoutSkip(Decision.unwrap()).nullable(),
});
const Group = GroupOfDraft.extend({ prs: PrList });
// The PRs marked qa:skip that the draft has not put into a group yet share one row without a group.
const GroupRow = z.union([Group, z.strictObject({ slug: z.null(), prs: SomePrs })]);
type GroupRow = z.infer<typeof GroupRow>;

const WindowBound = z.strictObject({ tag: z.string().regex(/^\S+$/), sha: Sha });

const Meta = z.strictObject({
  line: z.string().regex(/^\d+\.\d+$/, 'expected a line like 11.0'),
  version: z.string().regex(SEMVER, 'expected a version like 11.0.0-beta.3'),
  start: WindowBound,
  end: WindowBound,
  entriesPerRun: z.int().min(1),
});

export const Plan = Meta.extend({
  entries: z.array(PlanEntry),
  manual: z.array(ManualRow),
  none: z.array(NoQaRow),
  groups: z.array(GroupRow),
  discovered: z.array(DiscoveredRepo),
});
export type Plan = z.infer<typeof Plan>;

type TableKey = Exclude<keyof Plan, keyof z.infer<typeof Meta> | 'entries'>;

const code = (value: string) => `\`${value}\``;
const uncode = (cell: string): string => {
  const match = /^`([^`]+)`$/.exec(cell);
  if (!match) {
    throw new Error(`expected a value in backticks, found "${cell}"`);
  }
  return match[1]!;
};
// GitHub links no bare `#36137` in a Markdown file, so every reference carries its URL.
const githubLink = (kind: 'pull' | 'issues') => (number: number) =>
  `[#${number}](https://github.com/storybookjs/storybook/${kind}/${number})`;
export const prCell = githubLink('pull');
const issueLink = githubLink('issues');
const unPr = (cell: string): number => {
  const number = Number(/^\[#(\d+)\]/.exec(cell)?.[1]);
  if (!number || cell !== prCell(number)) {
    throw new Error(`expected a PR like ${prCell(36137)}, found "${cell}"`);
  }
  return number;
};
const prsCell = (prs: number[]) => prs.map(prCell).join(', ');
const unPrs = (cell: string): number[] => (cell === '' ? [] : cell.split(/,\s*/).map(unPr));
const repoCell = (repo: string, commit: string) =>
  `[${repo}](https://github.com/${repo}/tree/${commit})`;
const unRepoCell = (cell: string): { repo: string; commit: string } => {
  const [, repo = '', commit = ''] = /^\[([^\]]*)\]\(.*\/tree\/([^/)]*)\)$/.exec(cell) ?? [];
  if (cell !== repoCell(repo, commit)) {
    throw new Error(
      `expected a repo linked to its commit like ${repoCell('owner/repo', '<commit>')}, found "${cell}"`
    );
  }
  return { repo, commit };
};
const fail = (message: string): never => {
  throw new Error(message);
};
const numberOrText = (cell: string): unknown => (/^\d+$/.test(cell) ? Number(cell) : cell);
const orNull = (cell: string) => (cell === '' ? null : cell);

const decisionCell = (decision: Decision): string => {
  if (decision === null) {
    return '';
  }
  if ('none' in decision) {
    return `none: ${decision.none}`;
  }
  const manual = 'manual' in decision ? `${decision.manual}${WHY}${decision.why}` : '';
  if (!('entries' in decision)) {
    return `manual: ${manual}`;
  }
  const entries = decision.entries.map(code).join(', ');
  return manual ? `${entries}${REST}${manual}` : entries;
};
const MANUAL_CELL = `"manual: <check>${WHY}<why the sweep cannot test it>"`;
const PART_CELL = `"<entries>${REST}<check>${WHY}<why the sweep cannot test it>"`;
const unManual = (text: string, form: string) => {
  const at = text.indexOf(WHY);
  return at > 0 && text.length > at + WHY.length
    ? { manual: text.slice(0, at), why: text.slice(at + WHY.length) }
    : fail(`expected a check and its reason, as ${form}`);
};
const unDecision = (cell: string): unknown => {
  if (cell === '') {
    return null;
  }
  const [, kind, rest = ''] = /^(skip|manual|none):\s*(.*)$/.exec(cell) ?? [];
  if (kind === 'skip') {
    throw new Error(
      `"skip:" is no decision: choose ${MANUAL_CELL} for a check a person does, or "none: <reason>" for a change that needs no QA`
    );
  }
  for (const separator of [WHY, REST]) {
    if (cell.split(separator).length > 2) {
      fail(`expected "${separator.trim()}" once in the decision, found it twice`);
    }
  }
  if (kind === 'none') {
    return rest ? { none: rest } : fail('expected the reason why no QA is needed after "none:"');
  }
  if (kind === 'manual') {
    return unManual(rest, MANUAL_CELL);
  }
  const at = cell.indexOf(REST);
  const slugs = at === -1 ? cell : cell.slice(0, at);
  let entries: string[];
  try {
    entries = slugs.split(/,\s*/).map(uncode);
  } catch {
    throw new Error(
      `expected entry slugs in backticks, ${PART_CELL}, ${MANUAL_CELL}, "none: <reason>", or an empty cell, found "${cell}"`
    );
  }
  return at === -1
    ? { entries }
    : { entries, ...unManual(cell.slice(at + REST.length), PART_CELL) };
};

type Table<Row> = {
  heading: string;
  columns: readonly string[];
  schema: z.ZodType<Row>;
  encode: (row: Row) => string[];
  decode: (cells: string[]) => unknown;
};

const TABLES: { [K in TableKey]: Table<Plan[K][number]> } = {
  manual: {
    heading: 'PRs that need manual QA',
    columns: ['Check', 'Why the sweep cannot test it', 'PRs'],
    schema: ManualRow,
    encode: (row) => [row.check ?? '', row.why ?? '', prsCell(row.prs)],
    decode: ([check, why, prs]) => {
      if (!check !== !why) {
        fail(
          check
            ? 'expected why the sweep cannot test it next to the check'
            : 'expected the check a person does next to why the sweep cannot test it'
        );
      }
      return { check: orNull(check!), why: orNull(why!), prs: unPrs(prs!) };
    },
  },
  none: {
    heading: 'PRs that need no QA',
    columns: ['Reason', 'PRs'],
    schema: NoQaRow,
    encode: (row) => [row.reason, prsCell(row.prs)],
    decode: ([reason, prs]) => ({
      reason: reason || fail('expected the reason why these PRs need no QA'),
      prs: unPrs(prs!),
    }),
  },
  groups: {
    heading: 'Groups of PRs marked qa:skip',
    columns: ['Group', 'Source', 'Decision', 'PRs'],
    schema: GroupRow,
    encode: (row) =>
      row.slug === null
        ? ['', '', '', prsCell(row.prs)]
        : [code(row.slug), row.source, decisionCell(row.decision), prsCell(row.prs)],
    decode: ([slug, source, decision, prs]) =>
      slug === ''
        ? { slug: null, prs: unPrs(prs!) }
        : { slug: uncode(slug!), source, decision: unDecision(decision!), prs: unPrs(prs!) },
  },
  discovered: {
    heading: 'Discovered repos',
    columns: [
      'Id',
      'Repo at its commit',
      'Package manager',
      'Storybook directory',
      'Storybook major',
      'Stars',
      'Pushed at',
      'Reason',
    ],
    schema: DiscoveredRepo,
    encode: (row) => [
      code(row.id),
      repoCell(row.repo, row.commit),
      row.packageManager,
      row.storybookDir,
      String(row.major),
      String(row.stars),
      row.pushedAt,
      row.reason,
    ],
    decode: ([id, repo, packageManager, storybookDir, major, stars, pushedAt, reason]) => ({
      id: uncode(id!),
      ...unRepoCell(repo!),
      packageManager,
      storybookDir,
      major: numberOrText(major!),
      stars: numberOrText(stars!),
      pushedAt,
      reason,
    }),
  },
};
const TABLE_KEYS = Object.keys(TABLES) as TableKey[];

const OVERVIEW_COLUMNS = ['Entry', 'Batch', 'Repos', 'PRs'] as const;
const overviewCells = (entry: PlanEntry) => [
  `${entry.probe === undefined ? '' : 'Probe: '}${code(entry.slug)} ${entry.title}`,
  String(entry.batch),
  entry.repos.map((repo) => code(repo.id)).join(', '),
  String(entry.prs.length),
];

const META_FIELDS = {
  line: 'Line',
  version: 'Version',
  start: 'Window start',
  end: 'Window end',
  entriesPerRun: 'Entries per run',
} as const;
type MetaKey = keyof typeof META_FIELDS;

const boundCell = (bound: z.infer<typeof WindowBound>) => `${code(bound.tag)} ${bound.sha}`;
const unBound = (cell: string): unknown => {
  const match = /^`([^`]+)` (\S+)$/.exec(cell);
  return match ? { tag: match[1], sha: match[2] } : cell;
};

const tableRow = (cells: string[]) =>
  `| ${cells.map((cell) => cell.replaceAll('|', '\\|')).join(' | ')} |`;
const tableHead = (columns: readonly string[]) => [
  tableRow([...columns]),
  tableRow(columns.map(() => '---')),
];

const titleLine = (line: string) => `# QA plan for Storybook ${line}`;
const OVERVIEW_HEADING = '## Changes to test';
const STEPS_HEADING = '## Steps';

export type PlanLayout = {
  meta: Record<MetaKey, number>;
  overview: number[];
  entries: {
    heading: number;
    prs: number;
    batch: number;
    probe?: number;
    repos: number[];
    steps: number[];
    expected: number;
  }[];
  tables: Record<TableKey, { heading: number; rows: number[] }>;
};

export const layoutPlan = (plan: Plan): { lines: string[]; at: PlanLayout } => {
  const lines: string[] = [];
  const add = (text: string) => lines.push(text);

  add(titleLine(plan.line));
  add('');
  tableHead(['Field', 'Value']).forEach(add);
  const metaCells: Record<MetaKey, string> = {
    line: plan.line,
    version: plan.version,
    start: boundCell(plan.start),
    end: boundCell(plan.end),
    entriesPerRun: String(plan.entriesPerRun),
  };
  const meta = Object.fromEntries(
    (Object.keys(META_FIELDS) as MetaKey[]).map((key) => [
      key,
      add(tableRow([META_FIELDS[key], metaCells[key]])),
    ])
  ) as Record<MetaKey, number>;
  add('');

  add(OVERVIEW_HEADING);
  add('');
  tableHead(OVERVIEW_COLUMNS).forEach(add);
  const overview = plan.entries.map((entry) => add(tableRow(overviewCells(entry))));

  const tables = Object.fromEntries(
    TABLE_KEYS.map((key) => {
      const table = TABLES[key] as Table<unknown>;
      add('');
      const heading = add(`## ${table.heading}`);
      add('');
      tableHead(table.columns).forEach(add);
      const rows = plan[key].map((row) => add(tableRow(table.encode(row))));
      return [key, { heading, rows }];
    })
  ) as PlanLayout['tables'];

  add('');
  add(STEPS_HEADING);
  const entries = plan.entries.map((entry) => {
    add('');
    const heading = add(`### ${code(entry.slug)} ${entry.title}`);
    add('');
    return {
      heading,
      prs: add(`- PRs: ${prsCell(entry.prs)}`),
      batch: add(`- Batch: ${entry.batch}`),
      ...(entry.probe === undefined ? {} : { probe: add(`- Probe: ${entry.probe}`) }),
      repos: entry.repos.map((repo) => add(`- Repo ${code(repo.id)}: ${repo.reason}`)),
      steps: entry.steps.map((step) => add(`- Step: ${step}`)),
      expected: add(`- Expected: ${entry.expected}`),
    };
  });

  return { lines, at: { meta, overview, entries, tables } };
};

export const renderPlan = (plan: Plan): string => `${layoutPlan(plan).lines.join('\n')}\n`;

export class PlanSyntaxError extends Error {
  readonly line: number;

  constructor(line: number, message: string) {
    super(message);
    this.line = line;
  }
}

const firstIssue = (error: z.ZodError) => {
  const issue = error.issues[0]!;
  return issue.path.length ? `${issue.path.join('.')}: ${issue.message}` : issue.message;
};

const ENTRY_FIELDS: [RegExp, (raw: RawEntry, value: string, key?: string) => void][] = [
  [
    /^- PRs: (.*)$/,
    (raw, value) => {
      raw.prs = unPrs(value);
    },
  ],
  [
    /^- Batch: (.*)$/,
    (raw, value) => {
      raw.batch = numberOrText(value);
    },
  ],
  [
    /^- Probe: (.*)$/,
    (raw, value) => {
      const probe = Probe.safeParse(value);
      raw.probe = probe.success ? probe.data : fail(`probe: ${firstIssue(probe.error)}`);
    },
  ],
  [
    /^- Repo `([^`]+)`: (.*)$/,
    (raw, id, reason) => {
      raw.repos.push({ id, reason });
    },
  ],
  [
    /^- Step: (.*)$/,
    (raw, value) => {
      raw.steps.push(value);
    },
  ],
  [
    /^- Expected: (.*)$/,
    (raw, value) => {
      raw.expected = value;
    },
  ],
];
type RawEntry = {
  slug: string;
  title: string;
  prs?: unknown;
  batch?: unknown;
  probe?: string;
  repos: { id: string; reason?: string }[];
  steps: string[];
  expected?: string;
};

// The overview table is derived from the entries, so the parser skips its rows, and checkPlanText
// refuses a file in which they differ from what render writes for the entries.
export const parsePlan = (text: string): Plan => {
  const lines = text.replace(/\n$/, '').split('\n');
  let i = 0;
  const fail = (message: string, line = i + 1): never => {
    throw new PlanSyntaxError(line, message);
  };
  const attempt = <T>(read: () => T, line: number): T => {
    try {
      return read();
    } catch (error) {
      if (error instanceof PlanSyntaxError) {
        throw error;
      }
      return fail(error instanceof Error ? error.message : String(error), line);
    }
  };
  const valid = <T>(schema: z.ZodType<T>, value: unknown, line: number): T => {
    const result = schema.safeParse(value);
    return result.success ? result.data : fail(firstIssue(result.error), line);
  };
  const skipBlank = () => {
    while (i < lines.length && lines[i]!.trim() === '') {
      i++;
    }
  };
  const expectLine = (want: string) => {
    skipBlank();
    if (lines[i]?.trim() !== want) {
      fail(`expected "${want}"`);
    }
    i++;
  };
  const cellsOf = (expected: number): string[] => {
    const line = lines[i]!.trim();
    if (!line.startsWith('|') || !line.endsWith('|') || line.endsWith('\\|')) {
      fail('expected a table row that starts and ends with "|"');
    }
    const cells = line
      .slice(1, -1)
      .split(/(?<!\\)\|/)
      .map((cell) => cell.trim().replaceAll('\\|', '|'));
    if (cells.length !== expected) {
      fail(`expected ${expected} cells, found ${cells.length}`);
    }
    return cells;
  };
  const readTable = (columns: readonly string[]): { cells: string[]; line: number }[] => {
    skipBlank();
    if (!lines[i]?.startsWith('|') || cellsOf(columns.length).join('|') !== columns.join('|')) {
      fail(`expected the columns ${columns.join(', ')}`);
    }
    i++;
    if (!lines[i]?.startsWith('|') || !cellsOf(columns.length).every((c) => /^:?-+:?$/.test(c))) {
      fail('expected the separator row of the table');
    }
    i++;
    const rows = [];
    while (i < lines.length && lines[i]!.startsWith('|')) {
      rows.push({ cells: cellsOf(columns.length), line: i + 1 });
      i++;
    }
    return rows;
  };

  if (!/^# QA plan for Storybook \S+$/.test(lines[0] ?? '')) {
    fail('expected "# QA plan for Storybook <line>"');
  }
  i++;

  const metaLines: Partial<Record<MetaKey, number>> = {};
  const metaValues: Record<string, unknown> = {};
  const fieldKeys = new Map(
    (Object.entries(META_FIELDS) as [MetaKey, string][]).map(([key, name]) => [name, key])
  );
  for (const { cells, line } of readTable(['Field', 'Value'])) {
    const key = fieldKeys.get(cells[0]!) ?? fail(`unknown field "${cells[0]}"`, line);
    metaLines[key] = line;
    metaValues[key] =
      key === 'start' || key === 'end'
        ? unBound(cells[1]!)
        : key === 'entriesPerRun'
          ? numberOrText(cells[1]!)
          : cells[1];
  }
  const metaResult = Meta.safeParse(metaValues);
  if (!metaResult.success) {
    const issue = metaResult.error.issues[0]!;
    fail(firstIssue(metaResult.error), metaLines[issue.path[0] as MetaKey] ?? i);
  }

  expectLine(OVERVIEW_HEADING);
  readTable(OVERVIEW_COLUMNS);

  const tables = Object.fromEntries(
    TABLE_KEYS.map((key) => {
      const table = TABLES[key] as Table<unknown>;
      expectLine(`## ${table.heading}`);
      const rows = readTable(table.columns).map(({ cells, line }) =>
        valid(
          table.schema,
          attempt(() => table.decode(cells), line),
          line
        )
      );
      return [key, rows];
    })
  );

  expectLine(STEPS_HEADING);
  const entries: PlanEntry[] = [];
  for (skipBlank(); lines[i]?.startsWith('### '); skipBlank()) {
    const headingLine = i + 1;
    const heading =
      /^### `([^`]*)` (.*)$/.exec(lines[i]!) ?? fail('expected "### `<slug>` <title>"');
    const raw: RawEntry = { slug: heading[1]!, title: heading[2]!, repos: [], steps: [] };
    i++;
    skipBlank();
    while (i < lines.length && lines[i]!.startsWith('- ')) {
      const line = lines[i]!;
      const field = ENTRY_FIELDS.find(([pattern]) => pattern.test(line));
      if (!field) {
        fail(
          'expected one of "- PRs:", "- Batch:", "- Probe:", "- Repo `<id>`:", "- Step:", "- Expected:"'
        );
      }
      const [pattern, apply] = field!;
      const [, value, extra] = pattern.exec(line)!;
      attempt(() => apply(raw, value!, extra), i + 1);
      i++;
    }
    entries.push(valid(PlanEntry, raw, headingLine));
  }

  if (i < lines.length) {
    fail('unexpected line after the last entry');
  }
  return Plan.parse({ ...metaResult.data, entries, ...tables });
};

export type Problem = { line: number; message: string };

export type CheckContext = { catalog: CatalogEntry[]; window?: Window };

type RuleInput = CheckContext & { plan: Plan; at: PlanLayout; lines: string[] };
type Rule = (input: RuleInput) => Problem[];

// Every place of a PR in the plan: the entries that test it, and its one row in a table.
export type Place = { line: number } & (
  | { kind: 'entry'; slug: string }
  | { kind: 'manual'; row: ManualRow }
  | { kind: 'none'; row: NoQaRow }
  | { kind: 'group'; group: GroupRow }
);

export const placesOf = (plan: Plan, at: PlanLayout): Map<number, Place[]> => {
  const places = new Map<number, Place[]>();
  const put = (pr: number, place: Place) => places.set(pr, [...(places.get(pr) ?? []), place]);
  plan.entries.forEach((entry, index) =>
    entry.prs.forEach((pr) =>
      put(pr, { kind: 'entry', slug: entry.slug, line: at.entries[index]!.prs })
    )
  );
  plan.manual.forEach((row, index) =>
    row.prs.forEach((pr) => put(pr, { kind: 'manual', row, line: at.tables.manual.rows[index]! }))
  );
  plan.none.forEach((row, index) =>
    row.prs.forEach((pr) => put(pr, { kind: 'none', row, line: at.tables.none.rows[index]! }))
  );
  plan.groups.forEach((group, index) =>
    group.prs.forEach((pr) =>
      put(pr, { kind: 'group', group, line: at.tables.groups.rows[index]! })
    )
  );
  return places;
};

const prList = (prs: number[]) => prs.map((pr) => `#${pr}`).join(', ');
const names = (decision: Decision, slug: string) =>
  !!decision && 'entries' in decision && decision.entries.includes(slug);

const unknownSlugs = (decision: Decision, slugs: Set<string>): string[] =>
  decision && 'entries' in decision ? decision.entries.filter((slug) => !slugs.has(slug)) : [];

const duplicates = <Key>(keys: Key[], lines: number[], message: (key: Key) => string): Problem[] =>
  keys.flatMap((key, index) =>
    keys.indexOf(key) < index ? [{ line: lines[index]!, message: message(key) }] : []
  );

const namesAreUnique: Rule = ({ plan, at }) => [
  ...duplicates(
    plan.entries.map((entry) => entry.slug),
    at.entries.map((entry) => entry.heading),
    (slug) => `the slug \`${slug}\` is used twice`
  ),
  ...duplicates(
    plan.groups.map((group) => group.slug),
    at.tables.groups.rows,
    (slug) =>
      slug === null ? 'a second row of PRs without a group' : `the group \`${slug}\` is used twice`
  ),
  ...duplicates(
    plan.discovered.map((repo) => repo.id),
    at.tables.discovered.rows,
    (id) => `the id \`${id}\` is used twice`
  ),
  ...duplicates(
    plan.manual.map((row) => row.check),
    at.tables.manual.rows,
    (check) =>
      check === null
        ? 'a second row of PRs without a decision'
        : `the check "${check}" has a row already`
  ),
  ...duplicates(
    plan.none.map((row) => row.reason),
    at.tables.none.rows,
    (reason) => `the reason "${reason}" has a row already`
  ),
];

// A PR has at most one row. An entry that tests a PR leaves it no row of no QA, but a row of manual
// QA for the part that no entry tests, and a PR marked qa:skip keeps its row in a group, whose decision
// then names every entry that lists the PR.
const prsHaveOnePlace: Rule = ({ plan, at }) =>
  [...placesOf(plan, at)].flatMap(([pr, places]) => {
    const rows = places.filter((place) => place.kind !== 'entry');
    const [row] = rows;
    return [
      ...rows.slice(1).map((place) => ({
        line: place.line,
        message: `#${pr} has a row already, at line ${row!.line}`,
      })),
      ...places.flatMap((place) => {
        if (place.kind !== 'entry' || !row || (row.kind === 'manual' && row.row.check !== null)) {
          return [];
        }
        if (row.kind !== 'group') {
          return [
            {
              line: row.line,
              message: `#${pr} is tested by \`${place.slug}\`, so it has no row in "${TABLES[row.kind].heading}"`,
            },
          ];
        }
        return row.group.slug === null || names(row.group.decision, place.slug)
          ? []
          : [
              {
                line: place.line,
                message: `#${pr} is listed here, but its group \`${row.group.slug}\` does not name \`${place.slug}\``,
              },
            ];
      }),
    ];
  });

const versionIsOnLine: Rule = ({ plan, at }) => {
  const [, major, minor] = SEMVER.exec(plan.version)!;
  return `${major}.${minor}` === plan.line
    ? []
    : [{ line: at.meta.version, message: `version ${plan.version} is not on line ${plan.line}` }];
};

const entryRepos = ({ plan, at }: RuleInput) =>
  plan.entries.flatMap((entry, index) =>
    entry.repos.map(({ id }, repo) => ({ id, line: at.entries[index]!.repos[repo]! }))
  );

const reposAreKnown: Rule = (input) => {
  const { plan, at, catalog } = input;
  const cataloged = new Set(catalog.map((entry) => entry.id));
  const discovered = new Set(plan.discovered.map((repo) => repo.id));
  return [
    ...plan.discovered.flatMap((repo, index) =>
      cataloged.has(repo.id)
        ? [
            {
              line: at.tables.discovered.rows[index]!,
              message: `\`${repo.id}\` is a catalog id, so it cannot be a discovered repo too`,
            },
          ]
        : []
    ),
    ...entryRepos(input)
      .filter(({ id }) => !cataloged.has(id) && !discovered.has(id))
      .map(({ id, line }) => ({
        line,
        message: `\`${id}\` is no catalog id and no id of "${TABLES.discovered.heading}"`,
      })),
  ];
};

const reposAreCurrent: Rule = (input) => {
  const { plan, catalog } = input;
  const oldest = Number(plan.line.split('.')[0]) - 1;
  const majors = new Map<string, number | undefined>([
    ...catalog.map((entry) => [entry.id, entry.tags?.major] as const),
    ...plan.discovered.map((repo) => [repo.id, repo.major] as const),
  ]);
  return entryRepos(input).flatMap(({ id, line }) => {
    const major = majors.get(id);
    return major !== undefined && major < oldest
      ? [
          {
            line,
            message: `\`${id}\` is on Storybook ${major}, more than one major behind ${plan.line}`,
          },
        ]
      : [];
  });
};

const rowsAreDecided: Rule = ({ plan, at }) =>
  plan.manual.flatMap(({ check, prs }, index) =>
    check === null
      ? [
          {
            line: at.tables.manual.rows[index]!,
            message: `${prList(prs)} ${prs.length === 1 ? 'has' : 'have'} no decision`,
          },
        ]
      : []
  );

const batchesHaveNoGap: Rule = ({ plan, at }) => {
  const batches = [...new Set(plan.entries.map((entry) => entry.batch))].sort((a, b) => a - b);
  const gap = batches.findIndex((batch, index) => batch !== index + 1);
  if (gap === -1) {
    return [];
  }
  const missing = gap + 1;
  const index = plan.entries.findIndex((entry) => entry.batch > missing);
  return [{ line: at.entries[index]!.batch, message: `batch ${missing} has no entry` }];
};

// A run that tests the project itself never holds the files of a probe.
const probesHaveOwnBatches: Rule = ({ plan, at }) =>
  plan.entries.flatMap((entry, index) => {
    const first = plan.entries.find((other) => other.batch === entry.batch)!;
    const isProbe = (it: PlanEntry) => it.probe !== undefined;
    if (isProbe(first) === isProbe(entry)) {
      return [];
    }
    const [probe, other] = isProbe(entry) ? [entry, first] : [first, entry];
    return [
      {
        line: at.entries[index]!.batch,
        message: `batch ${entry.batch} holds the probe \`${probe.slug}\` and the entry \`${other.slug}\`, which is no probe: a batch holds probes only or no probe`,
      },
    ];
  });

// The run and a reader take a text that says "Probe:" for the mark of a probe, so the token stands
// only in the "- Probe:" line of one. An overview row repeats its entry's title, which is checked
// at the entry's heading.
// GitHub shows `Probe\:` as `Probe:`.
const PROBE_TOKEN = /probe\s*\\?:/i;
const probeTokenMarksProbesOnly: Rule = ({ lines, at }) => {
  const exempt = new Set([...at.overview, ...at.entries.flatMap(({ probe }) => probe ?? [])]);
  return lines.flatMap((text, index) => {
    const line = index + 1;
    const token = exempt.has(line) ? undefined : PROBE_TOKEN.exec(text)?.[0];
    return token === undefined
      ? []
      : [
          {
            line,
            message: `holds "${token}", which marks a probe and stands only in the "- Probe:" line of one: reword the text`,
          },
        ];
  });
};

const stepsNameEntryPrs: Rule = ({ plan, at }) =>
  plan.entries.flatMap((entry, index) => {
    const steps = entry.steps.map((step) => readStep(step).prs);
    const named = steps.some((prs) => prs.length > 0);
    return steps.flatMap((prs, step) => {
      const line = at.entries[index]!.steps[step]!;
      if (named && prs.length === 0) {
        return [
          {
            line,
            message: `another step of \`${entry.slug}\` names its PRs, so this one does too: start it with the PRs whose change it tests, as "#${entry.prs[0]}: "`,
          },
        ];
      }
      return prs
        .filter((pr) => !entry.prs.includes(pr))
        .map((pr) => ({
          line,
          message: `the step names #${pr}, which is no PR of \`${entry.slug}\``,
        }));
    });
  });

const groupsAreDecided: Rule = ({ plan, at }) => {
  const slugs = new Set(plan.entries.map((entry) => entry.slug));
  return plan.groups.flatMap((group, index) => {
    const line = at.tables.groups.rows[index]!;
    if (group.slug === null) {
      return [
        {
          line,
          message: `${prList(group.prs)} ${group.prs.length === 1 ? 'is' : 'are'} in no group`,
        },
      ];
    }
    return group.decision === null
      ? [{ line, message: `the group \`${group.slug}\` has no decision` }]
      : unknownSlugs(group.decision, slugs).map((slug) => ({
          line,
          message: `the group \`${group.slug}\` names \`${slug}\`, which is no entry of this plan`,
        }));
  });
};

const PRIVATE_LINK = /\b(?:linear\.app|notion\.(?:so|site|com)|(?:[\w-]+\.)*slack\.com)\b/i;

const noPrivateLinks: Rule = ({ lines }) =>
  lines.flatMap((text, index) =>
    PRIVATE_LINK.test(text)
      ? [{ line: index + 1, message: 'links to Linear, Notion, or Slack, which the plan must not' }]
      : []
  );

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);

// A scheme starts at the first letter of every run of letters, so `see:http://x`, `1.http://x`, and
// `-xhttp://x` each hold a URL. Punctuation at the end belongs to the sentence around the URL.
const URL_AT = /(?<![a-z])(?=([a-z][a-z\d+.-]*:[^ ]*))/gi;
const TRAILING_PUNCTUATION = /[.,;:!?'"`)\]}>]+$/;

// The URL parser reads a backslash as a slash and curl reads it as a character, so
// `http://localhost\@example.com` is localhost to one and example.com to the other.
const readingsOf = (url: string) => [url, url.replaceAll('\\', '%5C')].map((it) => URL.parse(it));

const offLocalhost = (text: string): string[] =>
  [...text.matchAll(URL_AT)].flatMap(([, candidate]) => {
    const url = candidate!.replace(TRAILING_PUNCTUATION, '');
    if (!url.includes(':')) {
      return [];
    }
    const readings = readingsOf(url);
    const host = readings.map((reading) => reading?.hostname).find((it) => it && !LOOPBACK.has(it));
    if (host) {
      return [`${url} has the host ${host}, not localhost`];
    }
    return readings.includes(null) ? [`${url} is a URL that the URL parser cannot read`] : [];
  });

const textsOf = (decision: Decision): string[] => {
  if (decision === null) {
    return [];
  }
  if ('none' in decision) {
    return [decision.none];
  }
  return 'manual' in decision ? [decision.manual, decision.why] : [];
};

const decisionTexts = ({ plan, at }: RuleInput) => [
  ...plan.manual.flatMap((row, index) =>
    [row.check ?? '', row.why ?? ''].map((text) => ({ text, line: at.tables.manual.rows[index]! }))
  ),
  ...plan.none.map((row, index) => ({ text: row.reason, line: at.tables.none.rows[index]! })),
  ...plan.groups.flatMap((group, index) =>
    group.slug === null
      ? []
      : textsOf(group.decision).map((text) => ({ text, line: at.tables.groups.rows[index]! }))
  ),
];

const textStaysOnLocalhost: Rule = (input) =>
  [
    ...input.plan.entries.flatMap((entry, index) => {
      const layout = input.at.entries[index]!;
      return [
        { text: entry.title, line: layout.heading },
        ...(entry.probe === undefined ? [] : [{ text: entry.probe, line: layout.probe! }]),
        ...entry.repos.map((repo, n) => ({ text: repo.reason, line: layout.repos[n]! })),
        ...entry.steps.map((text, step) => ({ text, line: layout.steps[step]! })),
        { text: entry.expected, line: layout.expected },
      ];
    }),
    ...decisionTexts(input),
  ].flatMap(({ text, line }) => offLocalhost(text).map((message) => ({ line, message })));

export type ManualCheckRow = { manual: string; why: string; line: number; prs: number[] };

export const manualChecksOf = (plan: Plan, at: PlanLayout): ManualCheckRow[] => [
  ...plan.manual.flatMap((row, index) =>
    row.check === null
      ? []
      : [{ manual: row.check, why: row.why, prs: row.prs, line: at.tables.manual.rows[index]! }]
  ),
  ...plan.groups.flatMap((group, index) =>
    group.slug !== null && group.decision && 'manual' in group.decision
      ? [
          {
            manual: group.decision.manual,
            why: group.decision.why,
            prs: group.prs,
            line: at.tables.groups.rows[index]!,
          },
        ]
      : []
  ),
];

// The manual checks go into an issue, where a mention notifies a person and a reference posts on a
// PR, and a check that points to a PR cannot be followed without that PR open. Whether GitHub
// links a form depends on its parser, so none of them may stand anywhere, in a code span either. An
// `@` after a letter or a digit cannot follow markup, so it starts no mention.
const REFERENCE = /(?<![a-z\d])@|#\d|GH-\d|(?:pull|issues)\/\d/i;

const manualChecksStayInert: Rule = ({ plan, at }) =>
  manualChecksOf(plan, at).flatMap(({ manual, why, line }) =>
    [manual, why].some((text) => REFERENCE.test(text))
      ? [
          {
            line,
            message:
              'a manual check names no person, PR, or issue, in a code span either: write out what to do, and name a package in words, such as "the Storybook React package"',
          },
        ]
      : []
  );

const VERIFIED = 'verified by hand';
const needsDecision = (status: QaStatus) => status === 'needed' || status === 'undeclared';
const needsGroup = (pr: WindowPr) => pr.status === 'skip';

// Each needed or undeclared PR of the window is tested or has a row of manual QA or of no QA, each
// PR marked qa:skip has a row in a group, and no other PR has a place.
const matchesWindow: Rule = ({ plan, at, window }) => {
  if (!window) {
    return [];
  }
  const bounds = (
    [
      ['start', { tag: window.from, sha: window.fromSha }],
      ['end', { tag: window.to, sha: window.toSha }],
    ] as const
  ).flatMap(([key, bound]) =>
    plan[key].tag === bound.tag && plan[key].sha === bound.sha
      ? []
      : [{ line: at.meta[key], message: `the window has ${boundCell(bound)}` }]
  );

  const places = placesOf(plan, at);
  const ofWindow = new Map(window.prs.map((pr) => [pr.number, pr]));
  const groupsHeading = TABLES.groups.heading;
  const prs = window.prs.flatMap((pr): Problem[] => {
    const own = places.get(pr.number) ?? [];
    const rows = own.filter((place) => place.kind !== 'entry');
    if (needsGroup(pr)) {
      return rows.length === 0
        ? [
            {
              line: at.tables.groups.heading,
              message: `#${pr.number} of the window is in no row of "${groupsHeading}"`,
            },
          ]
        : rows.flatMap((place) =>
            place.kind === 'group'
              ? []
              : [
                  {
                    line: place.line,
                    message: `#${pr.number} is marked qa:skip, so it belongs in a group`,
                  },
                ]
          );
    }
    if (!needsDecision(pr.status)) {
      return own.map((place) => ({
        line: place.line,
        message: `#${pr.number} is ${VERIFIED} in the window, so the plan does not decide it`,
      }));
    }
    if (own.length === 0) {
      return [
        {
          line: at.tables.manual.heading,
          message: `#${pr.number} of the window is in no entry and no row of "${TABLES.manual.heading}" or "${TABLES.none.heading}"`,
        },
      ];
    }
    return rows.flatMap((place) =>
      place.kind === 'group'
        ? [
            {
              line: place.line,
              message: `#${pr.number} is not marked qa:skip, so it belongs in no group`,
            },
          ]
        : []
    );
  });
  const strangers = [...places]
    .filter(([pr]) => !ofWindow.has(pr))
    .flatMap(([pr, own]) =>
      own.map((place) => ({ line: place.line, message: `#${pr} is not in the window` }))
    );
  return [...bounds, ...prs, ...strangers];
};

const RULES: Rule[] = [
  namesAreUnique,
  prsHaveOnePlace,
  versionIsOnLine,
  reposAreKnown,
  reposAreCurrent,
  rowsAreDecided,
  batchesHaveNoGap,
  probesHaveOwnBatches,
  probeTokenMarksProbesOnly,
  stepsNameEntryPrs,
  groupsAreDecided,
  noPrivateLinks,
  textStaysOnLocalhost,
  manualChecksStayInert,
  matchesWindow,
];

export const checkPlan = (plan: Plan, context: CheckContext): Problem[] => {
  const { lines, at } = layoutPlan(plan);
  return RULES.flatMap((rule) => rule({ ...context, plan, at, lines })).sort(
    (a, b) => a.line - b.line
  );
};

export const checkPlanText = (
  text: string,
  context: CheckContext
): { plan: Plan; problems: Problem[] } | { plan: null; problems: Problem[] } => {
  let plan: Plan;
  try {
    plan = parsePlan(text);
  } catch (error) {
    if (error instanceof PlanSyntaxError) {
      return { plan: null, problems: [{ line: error.line, message: error.message }] };
    }
    throw error;
  }
  const have = text.split('\n');
  const want = renderPlan(plan).split('\n');
  const index = want.findIndex((line, i) => have[i] !== line);
  if (index !== -1 || have.length !== want.length) {
    const at = index === -1 ? want.length - 1 : index;
    const expected =
      at === want.length - 1 ? 'the end of the file after a newline' : `"${want[at]}"`;
    return {
      plan: null,
      problems: [{ line: at + 1, message: `not in its rendered form, expected ${expected}` }],
    };
  }
  return { plan, problems: checkPlan(plan, context) };
};

const STATUS_LABEL: Record<QaStatus, string> = {
  needed: 'qa:needed',
  undeclared: 'no QA label',
  skip: 'qa:skip',
  verified: 'qa:success',
};

const placeText = (place: Place): string => {
  switch (place.kind) {
    case 'entry':
      return `tested by \`${place.slug}\``;
    case 'group':
      return place.group.slug === null
        ? 'in no group yet'
        : `group \`${place.group.slug}\`: ${decisionCell(place.group.decision) || 'no decision yet'}`;
    case 'manual':
      return place.row.check === null ? 'no decision yet' : `manual QA: ${place.row.check}`;
    case 'none':
      return `no QA: ${place.row.reason}`;
  }
};

// Where each PR of the window ended up, for a reader who looks one PR up.
export const renderLedger = (plan: Plan, window: Window): string => {
  const { at } = layoutPlan(plan);
  const places = placesOf(plan, at);
  const rows = window.prs.map((pr) => {
    const own = places.get(pr.number) ?? [];
    const where = own.length
      ? own.map(placeText).join('; ')
      : pr.status === 'verified'
        ? VERIFIED
        : 'nowhere';
    return tableRow([String(pr.number), STATUS_LABEL[pr.status], pr.area ?? '', pr.title, where]);
  });
  return [
    `# Where each PR of the window of the QA plan for Storybook ${plan.line} is`,
    '',
    ...tableHead(['PR', 'Status', 'Area', 'Title', 'Where']),
    ...rows,
    '',
  ].join('\n');
};

export const discoveredEntries = (plan: Plan): CatalogEntry[] =>
  plan.discovered.map((repo): CatalogEntry => ({
    id: repo.id,
    repo: repo.repo,
    ref: repo.commit,
    class: 'tier2',
    packageManager: repo.packageManager,
    storybookDir: repo.storybookDir,
    windows: false,
  }));

export const planHash = (content: string | Uint8Array): string =>
  createHash('sha256').update(content).digest('hex').slice(0, 12);

const STEP_PRS = /^((?:#[1-9]\d*, )*#[1-9]\d*): /;

/** Split a step into the PRs it starts with, as in `#36421, #36436: <text>`, and its text. */
export const readStep = (step: string): { prs: number[]; text: string } => {
  const match = STEP_PRS.exec(step);
  return match
    ? {
        prs: match[1]!.split(', ').map((pr) => Number(pr.slice(1))),
        text: step.slice(match[0].length),
      }
    : { prs: [], text: step };
};

export const planCheckId = (slug: string): string => `plan.${slug}`;

// Where the run keeps a copy of the files that a probe added, inside its evidence directory.
export const probeCopyDir = (slug: string): string => `${slug}-added`;

export const isProbeCheck = (
  entries: Pick<PlanEntry, 'slug' | 'probe'>[] = [],
  checkId: string
): boolean =>
  entries.some(({ slug, probe }) => probe !== undefined && planCheckId(slug) === checkId);

export const renderPlanChecks = (entries: PlanEntry[], repo: string): string =>
  entries
    .map((entry) => {
      const { reason } = entry.repos.find(({ id }) => id === repo)!;
      return [
        `- \`${planCheckId(entry.slug)}\` (plan): ${entry.title}. Why this repo: ${reason}.`,
        ...(entry.probe === undefined
          ? []
          : [
              `  Probe: after the upgrade, add ${entry.probe}. Keep a copy of each added file, and a diff of each file you added a line to, in \`${probeCopyDir(entry.slug)}/\` in the evidence directory. Before the next check, remove the added files and restore each file you added a line to.`,
            ]),
        ...entry.steps.map((step, index) => `  ${index + 1}. ${step}`),
        `  Expected: ${entry.expected}`,
      ].join('\n');
    })
    .join('\n');

export const planBatches = (plan: Plan): number[] =>
  Array.from({ length: Math.max(0, ...plan.entries.map((entry) => entry.batch)) }, (_, i) => i + 1);

export type PlanRun = { repo: string; part: number; entries: string[] };

export const planRuns = (plan: Plan, batch: number): PlanRun[] => {
  const slugsOfRepo = new Map<string, string[]>();
  for (const entry of plan.entries.filter((candidate) => candidate.batch === batch)) {
    for (const { id } of entry.repos) {
      slugsOfRepo.set(id, [...(slugsOfRepo.get(id) ?? []), entry.slug]);
    }
  }
  return [...slugsOfRepo].flatMap(([repo, slugs]) =>
    Array.from({ length: Math.ceil(slugs.length / plan.entriesPerRun) }, (_, index) => ({
      repo,
      part: index + 1,
      entries: slugs.slice(index * plan.entriesPerRun, (index + 1) * plan.entriesPerRun),
    }))
  );
};

const PrKey = z.string().regex(/^[1-9]\d*$/, 'expected a PR number');

export const PlanDraft = z.strictObject({
  entries: z.array(PlanEntry).default([]),
  discovered: z.array(DiscoveredRepo).default([]),
  decisions: z.record(PrKey, DraftDecision).default({}),
  groups: z.array(GroupOfDraftInput).default([]),
  groupOf: z.record(PrKey, Slug).default({}),
});
export type PlanDraft = z.infer<typeof PlanDraft>;

export const draftOfPlan = (plan: Plan): PlanDraft => {
  const grouped = new Set(plan.groups.flatMap((group) => group.prs));
  const decisions = new Map<number, NonNullable<Decision>>();
  for (const entry of plan.entries) {
    for (const pr of entry.prs.filter((it) => !grouped.has(it))) {
      const decision = decisions.get(pr);
      const slugs = decision && 'entries' in decision ? decision.entries : [];
      decisions.set(pr, { entries: [...slugs, entry.slug] });
    }
  }
  for (const row of plan.manual) {
    if (row.check !== null) {
      row.prs.forEach((pr) => decisions.set(pr, { manual: row.check, why: row.why }));
    }
  }
  for (const { reason, prs } of plan.none) {
    prs.forEach((pr) => decisions.set(pr, { none: reason }));
  }
  const named = plan.groups.flatMap((group) => (group.slug === null ? [] : [group]));
  return {
    entries: plan.entries,
    discovered: plan.discovered,
    decisions: Object.fromEntries([...decisions].map(([pr, decision]) => [String(pr), decision])),
    groups: named.map(({ slug, source, decision }) => ({ slug, source, decision })),
    groupOf: Object.fromEntries(
      named.flatMap((group) => group.prs.map((pr) => [String(pr), group.slug]))
    ),
  };
};

export const ENTRIES_PER_RUN = 4;

export const USD_PER_RUN = 2.59;

const trackingIssueOf = (pr: WindowPr) =>
  pr.issues
    .map((issue) =>
      issue.parent?.qaHeading ? issue.parent : issue.subIssues > 0 && issue.qaHeading ? issue : null
    )
    .find((issue) => issue !== null);

const slugList = (slugs: string[]) => (slugs.length ? slugs.map(code).join(', ') : 'none');

export const planFromWindow = (window: Window, draft: PlanDraft): Plan => {
  const version = window.to.replace(/^v/, '');
  const [, major, minor] = SEMVER.exec(version) ?? [];
  if (!major) {
    throw new Error(`The window ends at ${window.to}, which names no version.`);
  }
  const testedBy = (pr: number) =>
    draft.entries.filter((entry) => entry.prs.includes(pr)).map((entry) => entry.slug);

  const skipPrs = window.prs.filter(needsGroup);
  const tracked = new Map<string, number>();
  const groupOf = new Map(
    skipPrs.map((pr) => {
      const issue = trackingIssueOf(pr);
      if (issue) {
        tracked.set(`issue-${issue.number}`, issue.number);
      }
      return [pr.number, draft.groupOf[pr.number] ?? (issue ? `issue-${issue.number}` : null)];
    })
  );
  const usedGroups = new Set(groupOf.values());
  const groups = [
    ...draft.groups,
    ...[...tracked]
      .filter(
        ([slug]) => usedGroups.has(slug) && !draft.groups.some((group) => group.slug === slug)
      )
      .map(([slug, number]) => ({ slug, source: issueLink(number), decision: null })),
  ];
  const membersOf = (slug: string | null) =>
    skipPrs.filter((pr) => groupOf.get(pr.number) === slug).map((pr) => pr.number);

  const statusOf = new Map(window.prs.map((pr) => [pr.number, pr.status]));
  const groupable = new Set(skipPrs.map((pr) => pr.number));
  const misplaced = [
    ...Object.keys(draft.decisions)
      .filter((pr) => !['needed', 'undeclared'].includes(statusOf.get(Number(pr)) ?? ''))
      .map((pr) => `The draft decides #${pr}, which is no needed or undeclared PR of the window.`),
    ...Object.entries(draft.decisions).flatMap(([pr, decision]) => {
      const slugs = testedBy(Number(pr));
      if ('manual' in decision) {
        return [];
      }
      if ('none' in decision) {
        return slugs.length
          ? [`The draft gives #${pr} no QA, and the entries ${slugList(slugs)} list it.`]
          : [];
      }
      const same =
        slugs.length === decision.entries.length &&
        decision.entries.every((slug) => slugs.includes(slug));
      return same
        ? []
        : [
            `The draft decides #${pr} for ${slugList(decision.entries)}, and the entries that list it are ${slugList(slugs)}.`,
          ];
    }),
    ...Object.keys(draft.groupOf)
      .filter((pr) => !groupable.has(Number(pr)))
      .map((pr) => `The draft groups #${pr}, which is not marked qa:skip in the window.`),
    ...Object.entries(draft.groupOf)
      .filter(([, slug]) => !groups.some((group) => group.slug === slug))
      .map(
        ([pr, slug]) => `The draft groups #${pr} into \`${slug}\`, which is no group of the draft.`
      ),
  ];
  if (misplaced.length) {
    throw new Error(misplaced.join('\n'));
  }

  const manual = new Map<string, ManualRow>();
  const none = new Map<string, NoQaRow>();
  const add = <Row extends { prs: number[] }>(rows: Map<string, Row>, key: string, row: Row) =>
    rows.set(key, { ...row, prs: [...(rows.get(key)?.prs ?? []), ...row.prs] });
  for (const pr of window.prs) {
    if (!needsDecision(pr.status)) {
      continue;
    }
    const decision = draft.decisions[pr.number];
    if (decision && 'none' in decision) {
      add(none, decision.none, { reason: decision.none, prs: [pr.number] });
    } else if (decision && 'manual' in decision) {
      const { manual: check, why } = decision;
      add(manual, JSON.stringify([check, why]), { check, why, prs: [pr.number] });
    } else if (testedBy(pr.number).length === 0) {
      add(manual, '', { check: null, why: null, prs: [pr.number] });
    }
  }
  const ungrouped = membersOf(null);

  return Plan.parse({
    line: `${major}.${minor}`,
    version,
    start: { tag: window.from, sha: window.fromSha },
    end: { tag: window.to, sha: window.toSha },
    entriesPerRun: ENTRIES_PER_RUN,
    entries: draft.entries,
    manual: [...manual.values()],
    none: [...none.values()],
    groups: [
      ...groups.map((group) => ({ ...group, prs: membersOf(group.slug) })),
      ...(ungrouped.length ? [{ slug: null, prs: ungrouped }] : []),
    ],
    discovered: draft.discovered,
  });
};
