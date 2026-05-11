// Declarative retry policy for the recipe-author skill.
// Imported by:
//   - scripts/verify/recipe-author-core.ts (Lane A) — drives the 2-attempt
//     retry loop and constructs the retry-message body.
//   - scripts/verify/lint-invocation.ts (Lane C) — re-exports `maxAttempts`
//     as `LINT_RETRY_POLICY` for the skill caller.

export const RECIPE_RETRY_POLICY = {
  maxAttempts: 2,
  errorCategories: ['listener-before-goto', 'attach-pattern', 'imports'] as const,
} as const;

export type RecipeErrorCategory = (typeof RECIPE_RETRY_POLICY.errorCategories)[number];

// Maps an ESLint rule id to the high-level error category the recipe-author
// retry-prompt buckets violations under. Unknown rules collapse to the
// `imports` bucket at priority 99 (still surfaced, lowest priority).
export const RULE_TO_CATEGORY: Record<string, RecipeErrorCategory> = {
  '@typescript-eslint/no-unused-vars': 'imports',
  'no-unused-vars': 'imports',
  'import/no-unresolved': 'imports',
  'import/no-extraneous-dependencies': 'imports',
  // Synthetic rule ids injected by recipe-author-core for the two
  // post-write regex gates. Keep these in sync with the strings used
  // when building EslintViolationInput entries.
  'verify/listener-before-goto': 'listener-before-goto',
  'verify/attach-pattern': 'attach-pattern',
};

const CATEGORY_PRIORITY: Record<RecipeErrorCategory, number> = {
  'listener-before-goto': 1,
  'attach-pattern': 2,
  imports: 3,
};

const CATEGORY_HUMAN: Record<RecipeErrorCategory, string> = {
  'listener-before-goto':
    "Register `page.on('pageerror', ...)` and `page.on('console', ...)` BEFORE the first `page.goto(...)` call.",
  'attach-pattern':
    "Both `testInfo.attach('pageErrors', ...)` and `testInfo.attach('consoleErrors', ...)` MUST appear inside a `finally` block.",
  imports:
    'Imports must be limited to `@playwright/test` and `./_util.ts`. Remove unused symbols, fix unresolved imports, and avoid extraneous dependencies.',
};

export interface EslintViolationInput {
  ruleId: string;
  message: string;
}

export interface CategorizedBucket {
  category: RecipeErrorCategory | 'unknown';
  priority: number;
  humanMessage: string;
  rawRuleIds: string[];
  messages: string[];
}

const UNUSED_PRIORITY = 99;

export function categorizeEslintViolations(
  violations: ReadonlyArray<EslintViolationInput>
): CategorizedBucket[] {
  const byCategory = new Map<string, CategorizedBucket>();

  for (const v of violations) {
    const ruleId = v.ruleId ?? '';
    const category: RecipeErrorCategory | 'unknown' = RULE_TO_CATEGORY[ruleId] ?? 'unknown';
    const key = category === 'unknown' ? 'imports' : category;
    const resolvedCategory: RecipeErrorCategory = key as RecipeErrorCategory;
    const priority = category === 'unknown' ? UNUSED_PRIORITY : CATEGORY_PRIORITY[resolvedCategory];
    const humanMessage = CATEGORY_HUMAN[resolvedCategory];
    const existing = byCategory.get(key);
    if (existing) {
      if (!existing.rawRuleIds.includes(ruleId)) existing.rawRuleIds.push(ruleId);
      existing.messages.push(v.message);
      // Preserve the lowest (most urgent) priority for known categories.
      if (priority < existing.priority) existing.priority = priority;
    } else {
      byCategory.set(key, {
        category: resolvedCategory,
        priority,
        humanMessage,
        rawRuleIds: [ruleId],
        messages: [v.message],
      });
    }
  }

  return Array.from(byCategory.values()).sort((a, b) => a.priority - b.priority);
}

const RAW_JSON_CAP_BYTES = 8 * 1024;

export function formatRetryMessage(
  buckets: ReadonlyArray<CategorizedBucket>,
  rawEslintJson: string
): string {
  const lines: string[] = [];
  lines.push(
    'Your previous attempt failed the recipe-author gates. Re-emit a corrected spec body between the same fenced markers.'
  );
  lines.push('');
  if (buckets.length === 0) {
    lines.push('No categorized violations — see the raw ESLint output below.');
  } else {
    lines.push('Fix the following, in priority order:');
    lines.push('');
    for (const b of buckets) {
      lines.push(`- [${b.category}] ${b.humanMessage}`);
      if (b.rawRuleIds.length > 0) {
        lines.push(`  rules: ${b.rawRuleIds.filter(Boolean).join(', ') || '(post-write regex)'}`);
      }
      for (const m of b.messages.slice(0, 3)) {
        lines.push(`  - ${m}`);
      }
    }
    lines.push('');
  }
  lines.push('Raw ESLint output (truncated to 8 KB):');
  lines.push('```json');
  const capped =
    rawEslintJson.length <= RAW_JSON_CAP_BYTES
      ? rawEslintJson
      : `${rawEslintJson.slice(0, RAW_JSON_CAP_BYTES)}\n[...truncated]`;
  lines.push(capped);
  lines.push('```');
  return lines.join('\n');
}
