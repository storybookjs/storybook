import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { filterToPackageDiagnostics } from './typescript.ts';

const packageDir = resolve('/repo/code/renderers/react');

describe('filterToPackageDiagnostics', () => {
  it('keeps diagnostics located inside the package', () => {
    const output = ['src/globals.ts(6,16): error TS2339: Property does not exist.', ''].join('\n');

    const { kept, sawDiagnostic } = filterToPackageDiagnostics(output, packageDir);

    expect(kept).toEqual(['src/globals.ts(6,16): error TS2339: Property does not exist.']);
    expect(sawDiagnostic).toBe(true);
  });

  it('drops diagnostics located outside the package', () => {
    const output = [
      '../../addons/docs/src/DocsContext.ts(13,30): error TS7017: Element implicitly has an any type.',
      '',
    ].join('\n');

    const { kept, sawDiagnostic } = filterToPackageDiagnostics(output, packageDir);

    expect(kept).toEqual([]);
    expect(sawDiagnostic).toBe(true);
  });

  it('attaches indented elaboration lines to the preceding diagnostic verdict', () => {
    const output = [
      '../../addons/docs/src/DocsContext.ts(13,30): error TS2769: No overload matches this call.',
      '  The last overload gave the following error.',
      "    Type 'src/inside.ts' mention must not resurrect this block.",
      'src/renderToCanvas.tsx(11,9): error TS2339: Property FRAMEWORK_OPTIONS does not exist.',
      '  The last overload gave the following error.',
      '',
    ].join('\n');

    const { kept } = filterToPackageDiagnostics(output, packageDir);

    expect(kept).toEqual([
      'src/renderToCanvas.tsx(11,9): error TS2339: Property FRAMEWORK_OPTIONS does not exist.',
      '  The last overload gave the following error.',
    ]);
  });

  it('keeps file-less output such as config errors', () => {
    const output = "error TS5083: Cannot read file '/repo/tsconfig.base.json'.";

    const { kept, sawDiagnostic } = filterToPackageDiagnostics(output, packageDir);

    expect(kept).toEqual([output]);
    expect(sawDiagnostic).toBe(false);
  });

  it('keeps diagnostics referenced by tsconfig-relative paths inside the package', () => {
    const output = 'tsconfig.json(5,5): error TS5102: Option baseUrl has been removed.';

    const { kept } = filterToPackageDiagnostics(output, packageDir);

    expect(kept).toEqual([output]);
  });

  it('drops absolute paths outside the package and keeps absolute paths inside it', () => {
    const outside = resolve('/repo/code/addons/docs/src/x.ts');
    const inside = resolve(packageDir, 'src/y.ts');
    const output = [
      `${outside}(1,1): error TS1: outside.`,
      `${inside}(2,2): error TS2: inside.`,
      '',
    ].join('\n');

    const { kept } = filterToPackageDiagnostics(output, packageDir);

    expect(kept).toEqual([`${inside}(2,2): error TS2: inside.`]);
  });

  it('handles CRLF line endings', () => {
    const output = 'src/globals.ts(6,16): error TS2339: Property does not exist.\r\n';

    const { kept, sawDiagnostic } = filterToPackageDiagnostics(output, packageDir);

    expect(kept).toEqual(['src/globals.ts(6,16): error TS2339: Property does not exist.']);
    expect(sawDiagnostic).toBe(true);
  });

  it('does not treat a sibling directory sharing the package dir prefix as inside', () => {
    const output = '../react-native/src/z.ts(1,1): error TS1: sibling.';

    const { kept } = filterToPackageDiagnostics(output, packageDir);

    expect(kept).toEqual([]);
  });

  it('reports no diagnostics for unparseable output', () => {
    const output = 'segmentation fault';

    const { kept, sawDiagnostic } = filterToPackageDiagnostics(output, packageDir);

    // File-less lines are kept so the caller fails loudly.
    expect(kept).toEqual(['segmentation fault']);
    expect(sawDiagnostic).toBe(false);
  });
});
