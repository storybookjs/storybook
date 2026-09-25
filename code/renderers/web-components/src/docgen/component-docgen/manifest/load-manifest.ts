import { readFile } from 'node:fs/promises';
import { relative } from 'node:path';

import { isRecord } from '../utils.ts';
import type { ManifestPackage } from './types.ts';

export interface LoadedManifest {
  path: string;
  manifest: ManifestPackage;
}

export interface FailedManifest {
  path: string;
  error: {
    name: 'manifest-invalid' | 'manifest-unsupported';
    message: string;
  };
}

export type ManifestLoadResult = LoadedManifest | FailedManifest;

export const isFailedManifest = (result: ManifestLoadResult): result is FailedManifest =>
  'error' in result;

const isCustomElementsManifest = (value: unknown): value is ManifestPackage =>
  isRecord(value) && Array.isArray(value.modules);

const unsupportedMessage = (path: string): string =>
  `${path} uses the web-component-analyzer manifest shape. The Storybook docgen server reads ` +
  `Custom Elements Manifests only; generate one with @custom-elements-manifest/analyzer.`;

const invalidMessage = (path: string, detail?: string): string =>
  detail
    ? `Invalid Custom Elements Manifest at ${path}: ${detail}`
    : `Invalid Custom Elements Manifest at ${path}: expected a top-level modules array.`;

function classifyManifest(path: string, parsed: unknown): ManifestLoadResult {
  if (!isRecord(parsed)) {
    return { path, error: { name: 'manifest-invalid', message: invalidMessage(path) } };
  }
  if (isCustomElementsManifest(parsed)) {
    return { path, manifest: parsed };
  }
  if (parsed.version === 'experimental' || Array.isArray(parsed.tags)) {
    return { path, error: { name: 'manifest-unsupported', message: unsupportedMessage(path) } };
  }
  return { path, error: { name: 'manifest-invalid', message: invalidMessage(path) } };
}

export async function loadManifest(absolutePath: string): Promise<ManifestLoadResult> {
  const path = relative(process.cwd(), absolutePath);

  try {
    return classifyManifest(path, JSON.parse(await readFile(absolutePath, 'utf8')));
  } catch (error) {
    return {
      path,
      error: {
        name: 'manifest-invalid',
        message: invalidMessage(path, error instanceof Error ? error.message : String(error)),
      },
    };
  }
}

export async function loadManifests(paths: string[]): Promise<ManifestLoadResult[]> {
  return Promise.all(paths.map((path) => loadManifest(path)));
}
