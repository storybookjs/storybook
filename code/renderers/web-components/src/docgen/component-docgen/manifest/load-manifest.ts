import { readFile } from 'node:fs/promises';

import type { CustomElementsManifest } from './resolve-declaration.ts';

export interface LoadedManifest {
  path: string;
  manifest: CustomElementsManifest;
}

export interface FailedManifest {
  path: string;
  error: {
    name: 'manifest-invalid' | 'manifest-unsupported';
    message: string;
  };
}

export type ManifestLoadResult = LoadedManifest | FailedManifest;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object';

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
  if (Array.isArray(parsed.modules)) {
    return { path, manifest: parsed as unknown as CustomElementsManifest };
  }
  if (parsed.version === 'experimental' || Array.isArray(parsed.tags)) {
    return { path, error: { name: 'manifest-unsupported', message: unsupportedMessage(path) } };
  }
  return { path, error: { name: 'manifest-invalid', message: invalidMessage(path) } };
}

export async function loadManifest(path: string): Promise<ManifestLoadResult> {
  try {
    return classifyManifest(path, JSON.parse(await readFile(path, 'utf8')));
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
