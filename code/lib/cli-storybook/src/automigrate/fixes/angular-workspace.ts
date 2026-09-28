import { existsSync } from 'node:fs';

import { type JSONEditPath, parseJsonText } from 'storybook/internal/cli';
import { getProjectRoot } from 'storybook/internal/common';

import type { FixFiles } from '../fix-files.ts';

type JsonObject = Record<string, unknown>;

/** `null` when the file cannot be read or is not valid JSON with comments. */
export const readJsonFile = async (
  files: Pick<FixFiles, 'read'>,
  path: string
): Promise<any | null> => {
  try {
    return parseJsonText(await files.read(path));
  } catch {
    return null;
  }
};

const asObject = (value: unknown): JsonObject | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as JsonObject)
    : undefined;

export const getTargetGroups = (json: unknown) => {
  const root = asObject(json);
  const groups: { pathPrefix: JSONEditPath; targets: JsonObject }[] = [];

  for (const [projectName, projectValue] of Object.entries(asObject(root?.projects) ?? {})) {
    const project = asObject(projectValue);
    for (const key of ['architect', 'targets'] as const) {
      const targets = asObject(project?.[key]);
      if (targets) {
        groups.push({ pathPrefix: ['projects', projectName, key], targets });
      }
    }
  }

  const targets = asObject(root?.targets);
  if (targets) {
    groups.push({ pathPrefix: ['targets'], targets });
  }

  return groups;
};

export const findWorkspaceFiles = async (
  basename: 'package.json' | 'project.json'
): Promise<string[]> => {
  // eslint-disable-next-line depend/ban-dependencies
  const { globby } = await import('globby');
  return globby([`**/${basename}`], {
    cwd: getProjectRoot(),
    ignore: ['**/node_modules/**', '**/dist/**', '**/storybook-static/**'],
    absolute: true,
  });
};

/** The existing `siblings` of each package.json, plus every Nx `project.json`. */
export const findWorkspaceJsonFiles = async (packageJsonPaths: string[], siblings: string[]) => [
  ...packageJsonPaths
    .flatMap((path) => siblings.map((name) => path.replace(/[/\\]package\.json$/, `/${name}`)))
    .filter((path) => existsSync(path)),
  ...(await findWorkspaceFiles('project.json')),
];
