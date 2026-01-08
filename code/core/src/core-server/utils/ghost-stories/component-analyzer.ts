function braceDelta(line: string): number {
  // Lightweight heuristic: count braces without trying to parse strings/comments.
  // This is "good enough" for typical type/interface blocks.
  let delta = 0;
  for (const ch of line) {
    if (ch === '{') {
      delta += 1;
    } else if (ch === '}') {
      delta -= 1;
    }
  }
  return delta;
}

function countNonEmptyRuntimeLines(lines: string[]): number {
  // Excludes top-level TypeScript-only declarations that often bloat LOC:
  // - type Foo = ...
  // - interface Foo { ... }
  // - export type { Foo } from '...'
  //
  // Heuristic approach (no TS compiler API at runtime).
  const TYPE_OR_INTERFACE_DECL_RE =
    /^\s*(export\s+)?(declare\s+)?(type|interface)\s+[A-Za-z_$][\w$]*/;
  const TYPE_ONLY_EXPORT_RE = /^\s*export\s+type\s*\{/;

  let nonEmptyRuntimeLines = 0;
  let inTypeBlock = false;
  let typeBraceDepth = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.length === 0) {
      continue;
    }

    // Exclude type-only export lines (no runtime impact).
    if (!inTypeBlock && TYPE_ONLY_EXPORT_RE.test(trimmed)) {
      continue;
    }

    if (!inTypeBlock && TYPE_OR_INTERFACE_DECL_RE.test(trimmed)) {
      inTypeBlock = true;
      typeBraceDepth += braceDelta(trimmed);

      // End immediately for one-liners like:
      // - interface X {}
      // - type X = { ... }
      // - type X = Foo | Bar;
      const endsWithSemicolon = /;\s*$/.test(trimmed);
      const endsWithClosingBrace = /}\s*;?\s*$/.test(trimmed);
      const oneLineBraceBlock = trimmed.includes('{') && trimmed.includes('}');
      if (typeBraceDepth <= 0 && (endsWithSemicolon || endsWithClosingBrace || oneLineBraceBlock)) {
        inTypeBlock = false;
        typeBraceDepth = 0;
      }
      continue;
    }

    if (inTypeBlock) {
      typeBraceDepth += braceDelta(trimmed);
      const endsWithSemicolon = /;\s*$/.test(trimmed);
      const endsWithClosingBrace = /}\s*;?\s*$/.test(trimmed);
      if (typeBraceDepth <= 0 && (endsWithSemicolon || endsWithClosingBrace)) {
        inTypeBlock = false;
        typeBraceDepth = 0;
      }
      continue;
    }

    nonEmptyRuntimeLines += 1;
  }

  return nonEmptyRuntimeLines;
}

const COMPLEXITY_CONFIG = {
  /** Weight applied to non-empty runtime (without TypeScript declarations) lines */
  locWeight: 1,
  /** Imports can be cheap, so they get a lower weight */
  importWeight: 0.5,
  /**
   * Defines what raw complexity value should map to the upper bound of a "simple" file For instance
   * 13 LOC + 4 imports = 15. This would result in a score of 0.3
   */
  simpleBaseline: 15,
  simpleScore: 0.3,
};

/**
 * Simple analyzer which gives a score to a component based on its complexity. In the future, it
 * will be replaced with a thorough check that analyzes many complexity factors like auth usage,
 * theming usage, context usage, imports breakdown, etc. but for now this will do.
 */
export const getComponentComplexity = (fileContent: string): number => {
  const lines = fileContent.split('\n');

  const nonEmptyRuntimeLines = countNonEmptyRuntimeLines(lines);

  const importCount = lines.filter((line) => line.trim().startsWith('import')).length;

  const rawComplexity =
    nonEmptyRuntimeLines * COMPLEXITY_CONFIG.locWeight +
    importCount * COMPLEXITY_CONFIG.importWeight;

  /** Normalize against the "simple" baseline and what score is considered to be simple. */
  const normalizedScore =
    rawComplexity / (COMPLEXITY_CONFIG.simpleBaseline / COMPLEXITY_CONFIG.simpleScore);

  return Math.min(normalizedScore, 1);
};
