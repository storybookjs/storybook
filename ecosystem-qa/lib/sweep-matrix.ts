import { z } from 'zod';

import { Engine, RepoClass, type CatalogEntry } from './schema.ts';

const RunnerOs = z.enum(['linux', 'windows']);
type RunnerOs = z.infer<typeof RunnerOs>;

const RUNNER: Record<RunnerOs, { runner: string; sandbox: 'docker' | 'none' }> = {
  linux: { runner: 'ubuntu-latest', sandbox: 'docker' },
  // A Linux container cannot run the Windows build of a project, so the agent works on the runner.
  windows: { runner: 'windows-latest', sandbox: 'none' },
};

// Comma-separated lists, as the workflow inputs give them.
export interface SweepRequest {
  repos: string;
  oses: string;
  engines: string;
}

export interface SweepJob {
  repo: string;
  os: RunnerOs;
  engine: Engine;
  runner: string;
  sandbox: 'docker' | 'none';
}

const listOf = (text: string): string[] => [
  ...new Set(
    text
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item !== '')
  ),
];

const pick = <Value extends string>(
  schema: z.ZodType<Value> & { options: readonly string[] },
  items: string[]
) => ({
  values: items.flatMap((item) => {
    const result = schema.safeParse(item);
    return result.success ? [result.data] : [];
  }),
  problems: items
    .filter((item) => !schema.safeParse(item).success)
    .map((item) => `"${item}" is not one of ${schema.options.join(', ')}`),
});

// A name is a catalog id or a repo class, and a class stands for every entry of it.
const select = (catalog: CatalogEntry[], names: string[]) => {
  const known = [...catalog.map((entry) => entry.id), ...RepoClass.options];
  return {
    entries: [
      ...new Set(
        names.flatMap((name) =>
          catalog.filter((entry) => entry.id === name || entry.class === name)
        )
      ),
    ],
    problems: names
      .filter((name) => !known.includes(name))
      .map(
        (name) => `"${name}" is neither a catalog id nor a repo class. Known: ${known.join(', ')}`
      ),
  };
};

// What a request names and the plan still leaves out. A repo that only its class brought in stays
// off Windows by design, so it gets no note.
const notesFor = (catalog: CatalogEntry[], names: string[], systems: RunnerOs[]): string[] => [
  ...names.flatMap((name) => {
    const entry = catalog.find((candidate) => candidate.id === name);
    return systems.includes('windows') && entry && !entry.windows
      ? [`${name} is not marked for windows in the catalog, so it does not run there`]
      : [];
  }),
  ...names
    .filter(
      (name) => RepoClass.safeParse(name).success && !catalog.some((entry) => entry.class === name)
    )
    .map((name) => `No catalog entry has the class ${name}`),
];

// Plan the jobs of one sweep: every selected repo on every system and engine asked for, with
// Windows only for the repos the catalog marks for it.
export const sweepMatrix = (
  catalog: CatalogEntry[],
  { repos, oses, engines }: SweepRequest
): { include: SweepJob[]; notes: string[] } | { problems: string[] } => {
  const names = listOf(repos);
  if (names.length === 0) {
    return { problems: ['No repo was named'] };
  }
  const selected = select(catalog, names);
  const os = pick(RunnerOs, listOf(oses));
  const engine = pick(Engine, listOf(engines));
  const problems = [...selected.problems, ...os.problems, ...engine.problems];
  if (problems.length > 0) {
    return { problems };
  }
  const include = selected.entries.flatMap((entry) =>
    os.values
      .filter((system) => system !== 'windows' || entry.windows)
      .flatMap((system) =>
        engine.values.map((agent) => ({
          repo: entry.id,
          os: system,
          engine: agent,
          ...RUNNER[system],
        }))
      )
  );
  return include.length > 0
    ? { include, notes: notesFor(catalog, names, os.values) }
    : { problems: [`Nothing to run for ${names.join(', ')} on ${oses} with ${engines}`] };
};
