import { existsSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { CHECKS, CHECK_IDS, type CheckId, checksFor } from '../checks.ts';

type AgentCell =
  | { kind: 'check'; id: CheckId }
  | { kind: 'monorepo'; paths: string[] }
  | { kind: 'manual'; paths: string[] };

interface ChecklistRow {
  row: string;
  agent: AgentCell;
}

const checkIds = new Set<string>(CHECK_IDS);
const isCheckId = (value: string | undefined): value is CheckId =>
  value !== undefined && checkIds.has(value);

const backticked = (text: string) => [...text.matchAll(/`([^`]+)`/g)].map((match) => match[1]!);

const parseAgentCell = (cell: string): AgentCell | undefined => {
  const check = /^(\S+?)(?:; manual: \S.*)?$/.exec(cell);
  if (isCheckId(check?.[1])) {
    return { kind: 'check', id: check[1] };
  }
  const monorepo = /^monorepo: (\S.*)$/.exec(cell);
  if (monorepo) {
    const paths = backticked(monorepo[1]!);
    return paths.length > 0 ? { kind: 'monorepo', paths } : undefined;
  }
  const manual = /^manual: (\S.*)$/.exec(cell);
  if (manual) {
    const [, ...specNotes] = manual[1]!.split('; e2e:');
    const paths = specNotes.flatMap(backticked);
    return specNotes.length > 0 && paths.length === 0 ? undefined : { kind: 'manual', paths };
  }
  return undefined;
};

// The one table of the checklist that lists no rows to run.
const STATES_TABLE = 'State';

const parseChecklist = (markdown: string) => {
  const rows: ChecklistRow[] = [];
  const problems: string[] = [];
  let header: string[] | undefined;
  for (const [index, line] of markdown.split('\n').entries()) {
    if (!line.startsWith('|')) {
      header = undefined;
      continue;
    }
    const cells = line
      .split(/(?<!\\)\|/)
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (!header) {
      header = cells;
      if (!header.includes('Agent') && header[0] !== STATES_TABLE) {
        problems.push(`table at line ${index + 1} has no Agent column`);
      }
      continue;
    }
    const agentColumn = header.indexOf('Agent');
    if (agentColumn === -1 || cells.every((cell) => /^-+$/.test(cell))) {
      continue;
    }
    const row = cells[0] ?? '';
    const cell = cells[agentColumn] ?? '';
    const agent = parseAgentCell(cell);
    if (agent) {
      rows.push({ row, agent });
    } else {
      problems.push(`${row}: cannot read the Agent cell "${cell}"`);
    }
  }
  return { rows, problems };
};

const PATH_ROOTS: readonly (readonly [prefix: string, root: string])[] = [
  ['e2e-tests/', '../../test-storybooks/portable-stories-kitchen-sink/react/'],
  ['scripts/', '../../'],
  ['', '../../code/'],
];
const pathExists = (path: string) => {
  const [, root] = PATH_ROOTS.find(([prefix]) => path.startsWith(prefix))!;
  return existsSync(new URL(root + path, import.meta.url));
};

const table = (...agentCells: string[]) =>
  [
    '| Row | Probe | Agent | Check |',
    '| --- | ----- | ----- | ----- |',
    ...agentCells.map((cell, index) => `| ROW-${index + 1} | probe | ${cell} | title |`),
  ].join('\n');

const checklist = parseChecklist(
  readFileSync(new URL('../references/basic-qa.md', import.meta.url), 'utf8')
);

describe('check registry', () => {
  it('has unique ids', () => {
    expect(new Set(CHECK_IDS).size).toBe(CHECK_IDS.length);
  });

  it('keeps the must tier a strict subset of extended', () => {
    const must = checksFor('must');
    expect(must.every((check) => check.tier === 'must')).toBe(true);
    expect(checksFor('extended')).toHaveLength(CHECKS.length);
    expect(must.length).toBeLessThan(CHECKS.length);
  });

  it('has every id on at least one checklist row', () => {
    const referenced = new Set(
      checklist.rows.flatMap(({ agent }) => (agent.kind === 'check' ? [agent.id] : []))
    );
    expect(CHECK_IDS.filter((id) => !referenced.has(id))).toEqual([]);
  });
});

describe('checklist Agent column', () => {
  it('reads every Agent cell of the checklist', () => {
    expect(checklist.problems).toEqual([]);
  });

  it('names only files that exist in monorepo and e2e notes', () => {
    const missing = checklist.rows.flatMap(({ row, agent }) =>
      agent.kind === 'check'
        ? []
        : agent.paths.filter((path) => !pathExists(path)).map((path) => `${row}: ${path}`)
    );
    expect(missing).toEqual([]);
  });

  it('reads a check id, a monorepo test and a manual row with or without a spec', () => {
    const { rows, problems } = parseChecklist(
      table(
        'core.docs-render',
        'core.docs-render; manual: the rest of the row',
        'monorepo: `lib/a.test.ts` in every job',
        'manual: wording',
        'manual: wording; e2e: `e2e-sandbox/a.spec.ts`'
      )
    );
    expect(problems).toEqual([]);
    expect(rows).toEqual([
      { row: 'ROW-1', agent: { kind: 'check', id: 'core.docs-render' } },
      { row: 'ROW-2', agent: { kind: 'check', id: 'core.docs-render' } },
      { row: 'ROW-3', agent: { kind: 'monorepo', paths: ['lib/a.test.ts'] } },
      { row: 'ROW-4', agent: { kind: 'manual', paths: [] } },
      { row: 'ROW-5', agent: { kind: 'manual', paths: ['e2e-sandbox/a.spec.ts'] } },
    ]);
  });

  it.each([
    'manul: wording',
    'core.Docs-render',
    'docs render check',
    'core.docs-render; manul: the rest of the row',
    'monorepo: test gap, follow-up issue',
    'manual: wording; e2e: the navigation spec',
    'manual: wording; e2e:',
    '',
  ])('rejects the Agent cell "%s" and names its row', (cell) => {
    const { rows, problems } = parseChecklist(table('core.docs-render', cell));
    expect(problems).toEqual([`ROW-2: cannot read the Agent cell "${cell}"`]);
    expect(rows).toHaveLength(1);
  });

  it('rejects a table without an Agent column', () => {
    const { problems } = parseChecklist(
      '| Row | Probe | Check |\n| --- | --- | --- |\n| R-1 | p | t |'
    );
    expect(problems).toEqual(['table at line 1 has no Agent column']);
  });

  it('skips the table of states, which lists no rows', () => {
    expect(
      parseChecklist('| State | Use it when |\n| --- | --- |\n| `pass` | It worked. |')
    ).toEqual({ rows: [], problems: [] });
  });
});
