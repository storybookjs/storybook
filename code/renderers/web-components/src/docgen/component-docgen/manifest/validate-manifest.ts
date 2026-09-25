import Ajv from 'ajv';
import schema from 'custom-elements-manifest/schema.json' with { type: 'json' };

import type { ManifestPackage } from './types.ts';

const VALIDATE = new Ajv({ allErrors: true, strict: false }).compile(schema);

export function validateManifest(manifest: ManifestPackage): string[] {
  if (!VALIDATE(manifest)) {
    return compactValidationErrors(VALIDATE.errors ?? []);
  }

  return [];
}

function compactValidationErrors(
  errors: { instancePath: string; keyword: string; message?: string }[]
): string[] {
  const candidates = errors.filter(({ keyword }) => keyword !== 'anyOf');
  const filtered = candidates.filter((error) => {
    if (
      (error.keyword !== 'enum' && error.keyword !== 'const') ||
      !error.instancePath.endsWith('/kind')
    ) {
      return true;
    }

    const objectPrefix = `${error.instancePath.slice(0, -'/kind'.length)}/`;
    return !candidates.some(
      (candidate) =>
        candidate !== error &&
        candidate.instancePath !== error.instancePath &&
        candidate.instancePath.startsWith(objectPrefix)
    );
  });

  const compacted = new Set<string>();
  for (const { instancePath, message = 'failed validation' } of filtered) {
    compacted.add(`${instancePath} ${message}`);
  }
  return [...compacted];
}
