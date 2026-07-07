import { describe, expect, it } from 'vitest';

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Guards Bug A: `builders.json` points at these published top-level schemas (not the unpublished
// `src/builders/*/schema.json` copies), so they must declare `zoneless` and no longer declare the
// stale `experimentalZoneless` key.
const packageRoot = resolve(import.meta.dirname, '..');

describe('published builder schemas declare `zoneless`, not `experimentalZoneless`', () => {
  it.each(['start-schema.json', 'build-schema.json'])('%s', (schemaFile) => {
    const schema = JSON.parse(readFileSync(resolve(packageRoot, schemaFile), 'utf-8'));

    expect(schema.properties.zoneless).toEqual(
      expect.objectContaining({ type: 'boolean', default: true })
    );
    expect(schema.properties.experimentalZoneless).toBeUndefined();
  });
});
