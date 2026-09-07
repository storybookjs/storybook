import type { JSONEditPath } from 'storybook/internal/cli';
import { getProjectRoot } from 'storybook/internal/common';

type JsonObject = Record<string, unknown>;

export interface AngularTargetGroup {
  pathPrefix: JSONEditPath;
  targets: JsonObject;
}

const asObject = (value: unknown): JsonObject | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as JsonObject)
    : undefined;

export const getTargetGroups = (json: unknown): AngularTargetGroup[] => {
  const root = asObject(json);
  const groups: AngularTargetGroup[] = [];

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
