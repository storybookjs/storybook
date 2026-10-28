import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const NODE_DTS_ARTIFACT = join(import.meta.dirname, '../../dist/node.d.ts');
const DOCGEN_DTS_ARTIFACT = join(import.meta.dirname, '../../dist/docgen/index.d.ts');
const DTS_BUILT = existsSync(NODE_DTS_ARTIFACT) && existsSync(DOCGEN_DTS_ARTIFACT);

describe('Vue declaration contract', () => {
  it.runIf(process.env.CI)('is built before this suite runs', () => {
    expect(DTS_BUILT).toBe(true);
  });

  it.runIf(DTS_BUILT)('does not expose docgen runtime helpers', () => {
    const declarations = [NODE_DTS_ARTIFACT, DOCGEN_DTS_ARTIFACT]
      .map((artifact) => readFileSync(artifact, 'utf-8'))
      .join('\n');

    expect(declarations).not.toMatch(/(?:loadVueComponentMeta|resolveTypeElements|runTsc)/);
  });
});
