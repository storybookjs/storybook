import { parseArgs } from 'node:util';

import { join } from 'pathe';
import { z } from 'zod';

import { ghParse, ghText } from './lib/github.ts';
import {
  packageManagerOf,
  PackageJson,
  pnpmCatalogs,
  storybookDirsOf,
  storybookFacts,
} from './lib/pin.ts';

const HELP = `Usage: node ecosystem-qa/pin.ts <owner/repo> [ref] [--dir <storybook directory>]

Prints one line of JSON about the commit of a public repository that a catalog entry would pin:
the repository under the name GitHub answers with, which differs after a rename, the commit, the package manager of the root lockfile, each Storybook directory with its main config,
version range, framework packages and feature addons, the stars, the last push and whether the repository
is archived. The ref defaults to the default branch. It only reads from GitHub and writes nothing.

The Storybook directories come from the full file tree, which GitHub truncates for a very large
repository. --dir names the one directory to read instead.`;

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { dir: { type: 'string' }, help: { type: 'boolean', default: false } },
});
if (values.help) {
  console.log(HELP);
  process.exit(0);
}
const [repo, ref] = positionals;
if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) {
  console.error(`Name a repository as owner/repo.\n\n${HELP}`);
  process.exit(1);
}

const info = ghParse(
  z.object({
    full_name: z.string(),
    stargazers_count: z.number(),
    pushed_at: z.string(),
    archived: z.boolean(),
    default_branch: z.string(),
  }),
  ['api', `repos/${repo}`]
);
const { sha: commit } = ghParse(z.object({ sha: z.string() }), [
  'api',
  `repos/${repo}/commits/${ref ?? info.default_branch}`,
]);
const Tree = z.object({ truncated: z.boolean(), tree: z.array(z.object({ path: z.string() })) });
const treePaths = (dir: string | undefined, recursive: boolean) => {
  const tree = ghParse(Tree, [
    'api',
    `repos/${repo}/git/trees/${commit}${dir ? `:${dir}` : ''}${recursive ? '?recursive=1' : ''}`,
  ]);
  if (tree.truncated) {
    console.error(
      `GitHub truncated the file tree of ${repo} at ${commit}, so its Storybook directories cannot be listed. Name one with --dir.`
    );
    process.exit(1);
  }
  return tree.tree.map((item) => (dir ? join(dir, item.path) : item.path));
};
const subtree = values.dir === '.' ? undefined : values.dir;
const rootPaths = treePaths(undefined, subtree === undefined);
const dirs = storybookDirsOf(subtree === undefined ? rootPaths : treePaths(subtree, true));

const raw = (path: string) => [
  'api',
  '-H',
  'Accept: application/vnd.github.raw+json',
  `repos/${repo}/contents/${path}?ref=${commit}`,
];
const packageJson = (dir: string): PackageJson =>
  ghParse(PackageJson, raw(join(dir, 'package.json')));
const root = rootPaths.includes('package.json') ? packageJson('.') : {};
const catalogs = rootPaths.includes('pnpm-workspace.yaml')
  ? pnpmCatalogs(ghText(raw('pnpm-workspace.yaml')))
  : {};

const factsOf = ({ dir, main }: { dir: string; main: string }) => {
  const own = dir === '.' ? root : packageJson(dir);
  const facts = storybookFacts(own, root, { catalogs });
  return facts.frameworks.length > 1
    ? storybookFacts(own, root, { catalogs, main: ghText(raw(main)) })
    : facts;
};

console.log(
  JSON.stringify({
    repo: info.full_name,
    commit,
    packageManager: packageManagerOf(rootPaths),
    storybookDirs: dirs
      .filter(({ dir }) => values.dir === undefined || dir === values.dir)
      .map((found) => ({ dir: found.dir, main: found.main, ...factsOf(found) })),
    stars: info.stargazers_count,
    pushedAt: info.pushed_at,
    archived: info.archived,
  })
);
