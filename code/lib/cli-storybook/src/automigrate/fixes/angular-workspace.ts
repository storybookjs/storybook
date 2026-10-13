import { existsSync } from 'node:fs';

import type { JSONEditPath } from 'storybook/internal/cli';

import { findWorkspaceFiles } from '../helpers/workspace-files.ts';

type JsonObject = Record<string, unknown>;

const asObject = (value: unknown): JsonObject | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as JsonObject)
    : undefined;

export const getTargetGroups = (
  json: unknown
): { pathPrefix: JSONEditPath; targets: JsonObject }[] => {
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

/** The existing `siblings` of each package.json, plus every Nx `project.json`. */
export const findWorkspaceJsonFiles = async (
  packageJsonPaths: string[],
  siblings: string[]
): Promise<string[]> => [
  ...packageJsonPaths
    .flatMap((path) => siblings.map((name) => path.replace(/[/\\]package\.json$/, `/${name}`)))
    .filter((path) => existsSync(path)),
  ...(await findWorkspaceFiles('project.json')),
];
