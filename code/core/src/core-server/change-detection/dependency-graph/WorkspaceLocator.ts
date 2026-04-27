import { access, readFile } from 'node:fs/promises';

import { join, normalize } from 'pathe';
import { glob } from 'tinyglobby';
import { parse as parseYaml } from 'yaml';

import { logger } from 'storybook/internal/node-logger';

interface RootPackageJson {
  workspaces?: string[] | { packages?: string[] };
}

interface PnpmWorkspaceFile {
  packages?: string[];
}

/**
 * Locates workspace package roots in the project. Reads the root `package.json`
 * `workspaces` field (string[] OR `{packages: string[]}`); falls back to
 * `pnpm-workspace.yaml` if no workspaces field is present.
 *
 * Returns absolute, normalised paths to directories that contain a `package.json`.
 * Returns an empty `Set` if no workspaces are configured.
 */
export class WorkspaceLocator {
  private readonly projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = normalize(projectRoot);
  }

  async locate(): Promise<Set<string>> {
    const patterns = await this.collectPatterns();
    if (patterns.length === 0) {
      return new Set();
    }

    const matches = await glob(patterns, {
      cwd: this.projectRoot,
      onlyDirectories: true,
      dot: false,
      absolute: true,
    });

    const roots = new Set<string>();
    await Promise.all(
      matches.map(async (matchPath) => {
        const normalised = normalize(matchPath);
        const pkgPath = join(normalised, 'package.json');
        if (await fileExists(pkgPath)) {
          roots.add(normalised);
        }
      })
    );

    return roots;
  }

  private async collectPatterns(): Promise<string[]> {
    const fromPackageJson = await this.readWorkspacesField();
    if (fromPackageJson.length > 0) {
      return fromPackageJson;
    }
    return this.readPnpmWorkspaceYaml();
  }

  private async readWorkspacesField(): Promise<string[]> {
    const pkgPath = join(this.projectRoot, 'package.json');
    let raw: string;
    try {
      raw = await readFile(pkgPath, 'utf8');
    } catch (error) {
      logger.debug(`WorkspaceLocator: no root package.json at '${pkgPath}': ${String(error)}`);
      return [];
    }

    let parsed: RootPackageJson;
    try {
      parsed = JSON.parse(raw) as RootPackageJson;
    } catch (error) {
      logger.debug(`WorkspaceLocator: failed to parse root package.json: ${String(error)}`);
      return [];
    }

    const workspaces = parsed.workspaces;
    if (Array.isArray(workspaces)) {
      return workspaces;
    }
    if (workspaces && Array.isArray(workspaces.packages)) {
      return workspaces.packages;
    }
    return [];
  }

  private async readPnpmWorkspaceYaml(): Promise<string[]> {
    const yamlPath = join(this.projectRoot, 'pnpm-workspace.yaml');
    let raw: string;
    try {
      raw = await readFile(yamlPath, 'utf8');
    } catch (error) {
      logger.debug(`WorkspaceLocator: no pnpm-workspace.yaml at '${yamlPath}': ${String(error)}`);
      return [];
    }

    let parsed: PnpmWorkspaceFile | null;
    try {
      parsed = parseYaml(raw) as PnpmWorkspaceFile | null;
    } catch (error) {
      logger.debug(`WorkspaceLocator: failed to parse pnpm-workspace.yaml: ${String(error)}`);
      return [];
    }

    if (parsed && Array.isArray(parsed.packages)) {
      return parsed.packages;
    }
    return [];
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
