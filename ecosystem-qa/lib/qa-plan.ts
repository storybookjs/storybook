import { createHash } from 'node:crypto';

import { z } from 'zod';

import { SEMVER } from './cycle.ts';
import { CatalogEntry } from './schema.ts';
import { needsGroup, type Window, type WindowPr } from './window.ts';

const Text = z.string().regex(/^\S(?:[^\n\r]*\S)?$/, 'expected one line of text');
// `plan.` and the slug make a check id, which may have at most 80 characters.
const Slug = z
  .string()
  .max(75)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'expected lower case letters, digits, and hyphens');
const RepoId = CatalogEntry.shape.id;
const Sha = z.string().regex(/^[0-9a-f]{40}$/, 'expected a full commit SHA');
const PrNumber = z.int().positive();

export const Decision = z
  .union([z.strictObject({ entries: z.array(Slug).min(1) }), z.strictObject({ skip: Text })])
  .nullable();
export type Decision = z.infer<typeof Decision>;

const unique = (values: unknown[]) => new Set(values).size === values.length;

export const PlanEntry = z.strictObject({
  slug: Slug,
  title: Text,
  prs: z.array(PrNumber).min(1).refine(unique, 'a PR is listed twice'),
  batch: z.int().min(1),
  repos: z
    .array(z.strictObject({ id: RepoId, reason: Text }))
    .min(1)
    .refine((repos) => unique(repos.map((repo) => repo.id)), 'a repo is listed twice'),
  steps: z.array(Text).min(1),
  expected: Text,
});
export type PlanEntry = z.infer<typeof PlanEntry>;

// Every field but the id and the reason is a value of one line of `pin.ts` output, as it prints it.
export const DiscoveredRepo = z.strictObject({
  id: RepoId,
  repo: CatalogEntry.shape.repo,
  commit: Sha,
  packageManager: CatalogEntry.shape.packageManager,
  storybookDir: Text,
  major: z.int().positive(),
  stars: z.int().min(0),
  pushedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/, 'expected a time like 2026-11-16T14:42:00Z'),
  reason: Text,
});
export type DiscoveredRepo = z.infer<typeof DiscoveredRepo>;

const PrRow = z.strictObject({ pr: PrNumber, area: Text.nullable(), title: Text });
const DecisionRow = PrRow.extend({ decision: Decision });
const GroupedRow = PrRow.extend({ group: Slug.nullable() });
const Group = z.strictObject({ slug: Slug, source: Text, decision: Decision });

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
  discovered: z.array(DiscoveredRepo),
  needed: z.array(DecisionRow),
  undeclared: z.array(DecisionRow),
  groups: z.array(Group),
  maintainerSkips: z.array(GroupedRow),
  verified: z.array(PrRow),
  skipped: z.array(PrRow),
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
const prCell = githubLink('pull');
const issueLink = githubLink('issues');
const unPr = (cell: string): number => {
  const number = Number(/^\[#(\d+)\]/.exec(cell)?.[1]);
  if (!number || cell !== prCell(number)) {
    throw new Error(`expected a PR like ${prCell(36137)}, found "${cell}"`);
  }
  return number;
};
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
const numberOrText = (cell: string): unknown => (/^\d+$/.test(cell) ? Number(cell) : cell);
const orNull = (cell: string) => (cell === '' ? null : cell);

const decisionCell = (decision: Decision): string =>
  decision === null
    ? ''
    : 'skip' in decision
      ? `skip: ${decision.skip}`
      : decision.entries.map(code).join(', ');
const unDecision = (cell: string): unknown => {
  if (cell === '') {
    return null;
  }
  const skip = /^skip: (.*)$/.exec(cell);
  if (skip) {
    return { skip: skip[1] };
  }
  try {
    return { entries: cell.split(/,\s*/).map(uncode) };
  } catch {
    throw new Error(
      `expected entry slugs in backticks, "skip: <reason>", or an empty cell, found "${cell}"`
    );
  }
};

type Table<Row> = {
  heading: string;
  columns: readonly string[];
  schema: z.ZodType<Row>;
  encode: (row: Row) => string[];
  decode: (cells: string[]) => unknown;
};

const prCells = (row: z.infer<typeof PrRow>) => [prCell(row.pr), row.area ?? '', row.title];
const unPrCells = ([pr, area, title]: string[]) => ({ pr: unPr(pr!), area: orNull(area!), title });

const decisionTable = (heading: string): Table<z.infer<typeof DecisionRow>> => ({
  heading,
  columns: ['PR', 'Area', 'Title', 'Decision'],
  schema: DecisionRow,
  encode: (row) => [...prCells(row), decisionCell(row.decision)],
  decode: (cells) => ({ ...unPrCells(cells), decision: unDecision(cells[3]!) }),
});

const recordTable = (heading: string): Table<z.infer<typeof PrRow>> => ({
  heading,
  columns: ['PR', 'Area', 'Title'],
  schema: PrRow,
  encode: prCells,
  decode: unPrCells,
});

const TABLES: { [K in TableKey]: Table<Plan[K][number]> } = {
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
  needed: decisionTable('PRs that need QA'),
  undeclared: decisionTable('Undeclared PRs'),
  groups: {
    heading: 'Groups of maintainer PRs marked qa:skip',
    columns: ['Group', 'Source', 'Decision'],
    schema: Group,
    encode: (row) => [code(row.slug), row.source, decisionCell(row.decision)],
    decode: ([slug, source, decision]) => ({
      slug: uncode(slug!),
      source,
      decision: unDecision(decision!),
    }),
  },
  maintainerSkips: {
    heading: 'Maintainer PRs marked qa:skip',
    columns: ['PR', 'Area', 'Title', 'Group'],
    schema: GroupedRow,
    encode: (row) => [...prCells(row), row.group === null ? '' : code(row.group)],
    decode: (cells) => ({
      ...unPrCells(cells),
      group: cells[3] === '' ? null : uncode(cells[3]!),
    }),
  },
  verified: recordTable('PRs verified by hand'),
  skipped: recordTable('PRs marked qa:skip'),
};
const TABLE_KEYS = Object.keys(TABLES) as TableKey[];

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

export type PlanLayout = {
  meta: Record<MetaKey, number>;
  entries: {
    heading: number;
    prs: number;
    batch: number;
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

  add('## Changes to test');
  add('');
  const entries = plan.entries.map((entry) => {
    const heading = add(`### ${code(entry.slug)} ${entry.title}`);
    add('');
    const at = {
      heading,
      prs: add(`- PRs: ${entry.prs.map(prCell).join(', ')}`),
      batch: add(`- Batch: ${entry.batch}`),
      repos: entry.repos.map((repo) => add(`- Repo ${code(repo.id)}: ${repo.reason}`)),
      steps: entry.steps.map((step) => add(`- Step: ${step}`)),
      expected: add(`- Expected: ${entry.expected}`),
    };
    add('');
    return at;
  });

  const tables = Object.fromEntries(
    TABLE_KEYS.map((key, index) => {
      const table = TABLES[key] as Table<unknown>;
      if (index > 0) {
        add('');
      }
      const heading = add(`## ${table.heading}`);
      add('');
      tableHead(table.columns).forEach(add);
      const rows = plan[key].map((row) => add(tableRow(table.encode(row))));
      return [key, { heading, rows }];
    })
  ) as PlanLayout['tables'];

  return { lines, at: { meta, entries, tables } };
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
      raw.prs = value.split(/,\s*/).map(unPr);
    },
  ],
  [
    /^- Batch: (.*)$/,
    (raw, value) => {
      raw.batch = numberOrText(value);
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
  repos: { id: string; reason?: string }[];
  steps: string[];
  expected?: string;
};

/**
 * Read a plan file into its model.
 *
 * @throws {PlanSyntaxError} With the line at which the file stops following the format.
 */
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

  expectLine('## Changes to test');
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
        fail('expected one of "- PRs:", "- Batch:", "- Repo `<id>`:", "- Step:", "- Expected:"');
      }
      const [pattern, apply] = field!;
      const [, value, extra] = pattern.exec(line)!;
      attempt(() => apply(raw, value!, extra), i + 1);
      i++;
    }
    entries.push(valid(PlanEntry, raw, headingLine));
  }

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

  skipBlank();
  if (i < lines.length) {
    fail('unexpected line after the last table');
  }
  return Plan.parse({ ...metaResult.data, entries, ...tables });
};

export type Problem = { line: number; message: string };

export type CheckContext = { catalog: CatalogEntry[]; window?: Window };

type RuleInput = CheckContext & { plan: Plan; at: PlanLayout; lines: string[] };
type Rule = (input: RuleInput) => Problem[];

const DECISION_TABLES = ['needed', 'undeclared'] as const;

const decisionRows = ({ plan, at }: RuleInput) =>
  DECISION_TABLES.flatMap((key) =>
    plan[key].map((row, index) => ({ row, line: at.tables[key].rows[index]! }))
  );

const unknownSlugs = (decision: Decision, slugs: Set<string>): string[] =>
  decision && 'entries' in decision ? decision.entries.filter((slug) => !slugs.has(slug)) : [];

const slugsAreUnique: Rule = ({ plan, at }) => {
  const seen = (items: { slug: string }[], lineOf: (index: number) => number, what: string) => {
    const first = new Set<string>();
    return items.flatMap(({ slug }, index) => {
      if (first.has(slug)) {
        return [{ line: lineOf(index), message: `${what} \`${slug}\` is used twice` }];
      }
      first.add(slug);
      return [];
    });
  };
  return [
    ...seen(plan.entries, (index) => at.entries[index]!.heading, 'the slug'),
    ...seen(plan.groups, (index) => at.tables.groups.rows[index]!, 'the group'),
  ];
};

const versionIsOnLine: Rule = ({ plan, at }) => {
  const [, major, minor] = SEMVER.exec(plan.version)!;
  return `${major}.${minor}` === plan.line
    ? []
    : [{ line: at.meta.version, message: `version ${plan.version} is not on line ${plan.line}` }];
};

const discoveredIdsAreUnique: Rule = ({ plan, at }) =>
  plan.discovered.flatMap((repo, index) =>
    plan.discovered.findIndex((other) => other.id === repo.id) < index
      ? [
          {
            line: at.tables.discovered.rows[index]!,
            message: `the id \`${repo.id}\` is used twice`,
          },
        ]
      : []
  );

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
    ...catalog.map((entry) => [entry.id, entry.tags?.storybook] as const),
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

const entryPrsHaveRows: Rule = (input) => {
  const { plan, at } = input;
  const rows = decisionRows(input);
  const groups = new Map(plan.groups.map((group) => [group.slug, group]));
  const names = (decision: Decision | undefined, slug: string) =>
    !!decision && 'entries' in decision && decision.entries.includes(slug);
  return plan.entries.flatMap((entry, index) =>
    entry.prs.flatMap((pr) => {
      const row = rows.find(({ row }) => row.pr === pr)?.row;
      const grouped = plan.maintainerSkips.find((skip) => skip.pr === pr);
      const ok = row
        ? names(row.decision, entry.slug)
        : grouped?.group != null && names(groups.get(grouped.group)?.decision, entry.slug);
      if (ok) {
        return [];
      }
      const message =
        row || grouped
          ? `#${pr} is listed here, but its row does not name \`${entry.slug}\``
          : `#${pr} has no row in "PRs that need QA" or "Undeclared PRs"`;
      return [{ line: at.entries[index]!.prs, message }];
    })
  );
};

const rowsAreDecided: Rule = (input) => {
  const slugs = new Set(input.plan.entries.map((entry) => entry.slug));
  return decisionRows(input).flatMap(({ row, line }) =>
    row.decision === null
      ? [{ line, message: `#${row.pr} has no decision` }]
      : unknownSlugs(row.decision, slugs).map((slug) => ({
          line,
          message: `#${row.pr} names \`${slug}\`, which is no entry of this plan`,
        }))
  );
};

const batchesHaveNoGap: Rule = ({ plan, at }) => {
  const batches = new Set(plan.entries.map((entry) => entry.batch));
  const missing = planBatches(plan).find((batch) => !batches.has(batch));
  if (missing === undefined) {
    return [];
  }
  const index = plan.entries.findIndex((entry) => entry.batch > missing);
  return [{ line: at.entries[index]!.batch, message: `batch ${missing} has no entry` }];
};

const groupsAreDecided: Rule = ({ plan, at }) => {
  const slugs = new Set(plan.entries.map((entry) => entry.slug));
  const groups = new Set(plan.groups.map((group) => group.slug));
  return [
    ...plan.maintainerSkips.flatMap((row, index) => {
      const line = at.tables.maintainerSkips.rows[index]!;
      if (row.group === null) {
        return [{ line, message: `#${row.pr} names no group` }];
      }
      return groups.has(row.group)
        ? []
        : [{ line, message: `#${row.pr} names the group \`${row.group}\`, which has no row` }];
    }),
    ...plan.groups.flatMap((group, index) => {
      const line = at.tables.groups.rows[index]!;
      return group.decision === null
        ? [{ line, message: `the group \`${group.slug}\` has no decision` }]
        : unknownSlugs(group.decision, slugs).map((slug) => ({
            line,
            message: `the group \`${group.slug}\` names \`${slug}\`, which is no entry of this plan`,
          }));
    }),
  ];
};

const PRIVATE_LINK = /\b(?:linear\.app|notion\.so|notion\.site|(?:[\w-]+\.)*slack\.com)\b/i;

const noPrivateLinks: Rule = ({ lines }) =>
  lines.flatMap((text, index) =>
    PRIVATE_LINK.test(text)
      ? [{ line: index + 1, message: 'links to Linear, Notion, or Slack, which the plan must not' }]
      : []
  );

const URL_HOST = /\b[a-z][\w+.-]*:\/\/(?:[^\s/@]*@)?([^\s/:?#`'")<>\]]+)/gi;

const stepsStayOnLocalhost: Rule = ({ plan, at }) =>
  plan.entries.flatMap((entry, index) => {
    const layout = at.entries[index]!;
    return [
      ...entry.steps.map((text, step) => ({ text, line: layout.steps[step]! })),
      { text: entry.expected, line: layout.expected },
    ].flatMap(({ text, line }) =>
      [...text.matchAll(URL_HOST)]
        .filter((match) => match[1]!.toLowerCase() !== 'localhost')
        .map((match) => ({ line, message: `${match[0]} is a URL other than localhost` }))
    );
  });

const WINDOW_TABLES = ['needed', 'undeclared', 'maintainerSkips', 'verified', 'skipped'] as const;

const matchesWindow: Rule = ({ plan, at, window }) => {
  if (!window) {
    return [];
  }
  const expected = planFromWindow(window, PlanDraft.parse({}));
  const bounds = (['start', 'end'] as const).flatMap((key) =>
    plan[key].tag === expected[key].tag && plan[key].sha === expected[key].sha
      ? []
      : [{ line: at.meta[key], message: `the window has ${boundCell(expected[key])}` }]
  );
  const rows = WINDOW_TABLES.flatMap((key) => {
    const heading = TABLES[key].heading;
    const want = new Map(expected[key].map((row) => [row.pr, row]));
    const have = new Set(plan[key].map((row) => row.pr));
    return [
      ...plan[key].flatMap((row, index) => {
        const line = at.tables[key].rows[index]!;
        const other = want.get(row.pr);
        if (!other) {
          return [{ line, message: `#${row.pr} does not belong in "${heading}" for this window` }];
        }
        return other.title === row.title && other.area === row.area
          ? []
          : [{ line, message: `#${row.pr} has the area and title "${other.title}" in the window` }];
      }),
      ...[...want.keys()]
        .filter((pr) => !have.has(pr))
        .map((pr) => ({
          line: at.tables[key].heading,
          message: `#${pr} of the window has no row in "${heading}"`,
        })),
    ];
  });
  return [...bounds, ...rows];
};

const RULES: Rule[] = [
  slugsAreUnique,
  versionIsOnLine,
  discoveredIdsAreUnique,
  reposAreKnown,
  reposAreCurrent,
  entryPrsHaveRows,
  rowsAreDecided,
  batchesHaveNoGap,
  groupsAreDecided,
  noPrivateLinks,
  stepsStayOnLocalhost,
  matchesWindow,
];

export const checkPlan = (plan: Plan, context: CheckContext): Problem[] => {
  const { lines, at } = layoutPlan(plan);
  return RULES.flatMap((rule) => rule({ ...context, plan, at, lines })).sort(
    (a, b) => a.line - b.line
  );
};

// A valid file equals its rendered form, so nothing the parser skipped can stay in it.
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

export const planHash = (text: string): string =>
  createHash('sha256').update(text).digest('hex').slice(0, 12);

export const planCheckId = (slug: string): string => `plan.${slug}`;

export const planBatches = (plan: Plan): number[] =>
  Array.from({ length: Math.max(0, ...plan.entries.map((entry) => entry.batch)) }, (_, i) => i + 1);

export type PlanRun = { repo: string; part: number; entries: string[] };

// The parts of one repo run in parallel jobs, each upgrading the repo once for its entries.
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
  decisions: z.record(PrKey, Decision.unwrap()).default({}),
  groups: z.array(Group).default([]),
  groupOf: z.record(PrKey, Slug).default({}),
});
export type PlanDraft = z.infer<typeof PlanDraft>;

export const ENTRIES_PER_RUN = 4;

// The most expensive of 32 static runs on Haiku at low effort. A run of plan entries may cost more.
export const USD_PER_RUN = 2.59;

// An issue with sub-issues and a QA heading tracks a project, and its PRs share its instructions.
const trackingIssueOf = (pr: WindowPr) =>
  pr.issues
    .map((issue) =>
      issue.parent?.qaHeading ? issue.parent : issue.subIssues > 0 && issue.qaHeading ? issue : null
    )
    .find((issue) => issue !== null);

/**
 * Build the plan of a window, with the entries and decisions of a draft.
 *
 * @throws {Error} When the draft decides a PR that the window does not hold in that role.
 */
export const planFromWindow = (window: Window, draft: PlanDraft): Plan => {
  const version = window.to.replace(/^v/, '');
  const [, major, minor] = SEMVER.exec(version) ?? [];
  if (!major) {
    throw new Error(`The window ends at ${window.to}, which names no version.`);
  }
  const rowOf = (pr: WindowPr) => ({
    pr: pr.number,
    area: pr.area?.trim() || null,
    title: pr.title.trim(),
  });
  const withStatus = (status: WindowPr['status']) =>
    window.prs.filter((pr) => pr.status === status);
  const decided = (status: WindowPr['status']) =>
    withStatus(status).map((pr) => ({
      ...rowOf(pr),
      decision: draft.decisions[pr.number] ?? null,
    }));

  const maintainerPrs = window.prs.filter(needsGroup);
  const tracked = new Map<string, number>();
  const maintainerSkips = maintainerPrs.map((pr) => {
    const issue = trackingIssueOf(pr);
    const fallback = issue ? `issue-${issue.number}` : null;
    if (issue) {
      tracked.set(`issue-${issue.number}`, issue.number);
    }
    return { ...rowOf(pr), group: draft.groupOf[pr.number] ?? fallback };
  });
  const usedGroups = new Set(maintainerSkips.map((row) => row.group));
  const trackedGroups = [...tracked]
    .filter(([slug]) => usedGroups.has(slug) && !draft.groups.some((group) => group.slug === slug))
    .map(([slug, number]) => ({ slug, source: issueLink(number), decision: null }));

  const statusOf = new Map(window.prs.map((pr) => [pr.number, pr.status]));
  const groupable = new Set(maintainerPrs.map((pr) => pr.number));
  const misplaced = [
    ...Object.keys(draft.decisions)
      .filter((pr) => !['needed', 'undeclared'].includes(statusOf.get(Number(pr)) ?? ''))
      .map((pr) => `The draft decides #${pr}, which is no needed or undeclared PR of the window.`),
    ...Object.keys(draft.groupOf)
      .filter((pr) => !groupable.has(Number(pr)))
      .map(
        (pr) =>
          `The draft groups #${pr}, which is no maintainer PR marked qa:skip that needs a group.`
      ),
  ];
  if (misplaced.length) {
    throw new Error(misplaced.join('\n'));
  }

  return Plan.parse({
    line: `${major}.${minor}`,
    version,
    start: { tag: window.from, sha: window.fromSha },
    end: { tag: window.to, sha: window.toSha },
    entriesPerRun: ENTRIES_PER_RUN,
    entries: draft.entries,
    discovered: draft.discovered,
    needed: decided('needed'),
    undeclared: decided('undeclared'),
    groups: [...draft.groups, ...trackedGroups],
    maintainerSkips,
    verified: withStatus('verified').map(rowOf),
    skipped: withStatus('skip')
      .filter((pr) => !needsGroup(pr))
      .map(rowOf),
  });
};
