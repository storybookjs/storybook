// Assembles the recipe-author prompt for the verify-recipe-author skill.
// Pure string assembly; deterministic given identical inputs.

export interface PromptPRFile {
  path: string;
  additions: number;
  deletions: number;
}

export interface PromptPRMeta {
  title: string;
  body: string;
  files: PromptPRFile[];
  additions: number;
  deletions: number;
  changedFiles: number;
}

export interface PromptReferenceSpec {
  path: string;
  source: string;
}

export interface PromptInput {
  prNumber: number;
  prMeta: PromptPRMeta;
  /** Already truncated upstream per D5 caps. */
  prDiff: string;
  /** Triage-matched specs first; canonical smoke is appended separately at the END. */
  referenceSpecs: PromptReferenceSpec[];
  /** ALWAYS appended at the end of the reference block (D3 iter-2). */
  canonicalSmoke: PromptReferenceSpec;
  /** Verbatim contents of `.verify-recipes/_recipe-authoring-guide.md`. */
  authoringGuide: string;
}

const PROMPT_TOKEN_BUDGET = 20_000;
const BODY_EXCERPT_CAP = 1_000;

/**
 * Build the full recipe-author prompt string. Throws if the assembled
 * string is estimated to exceed the token budget (chars / 4 > 20_000).
 */
export function buildRecipeAuthorPrompt(input: PromptInput): string {
  const sections: string[] = [];

  // 1. Mission
  sections.push(
    [
      `# Mission`,
      '',
      `You are authoring a Playwright recipe for PR #${input.prNumber}. The recipe is a single \`.spec.ts\` file that will be reviewed by a human and then executed by the PR verification harness against a local Storybook (\`react-vite/default-ts\` sandbox). Your output is the spec source only — no commentary, no surrounding markdown. The recipe must observe the runtime behavior of the code paths changed in this PR and emit \`pageErrors\` / \`consoleErrors\` attachments so the runner can compute a verdict.`,
    ].join('\n')
  );

  // 2. Output contract
  sections.push(
    [
      `# Output contract`,
      '',
      `Emit exactly one TypeScript source file between the fenced markers below.`,
      '',
      `\`\`\``,
      `<<<SPEC_START>>>`,
      `// ...your spec source here...`,
      `<<<SPEC_END>>>`,
      `\`\`\``,
      '',
      `Hard requirements:`,
      `- One file, one \`test(...)\` call. No \`describe\`, no \`test.only\`, no \`test.skip\`, no \`beforeEach\`/\`afterEach\`.`,
      `- Imports allowed: \`@playwright/test\` and \`./_util.ts\` only. Nothing else.`,
      `- Use the \`.ts\` extension on the relative import (\`./_util.ts\`).`,
      `- Listeners (\`page.on('pageerror', ...)\` and \`page.on('console', ...)\`) MUST be registered BEFORE the first \`page.goto(...)\`.`,
      `- Both \`testInfo.attach('pageErrors', ...)\` and \`testInfo.attach('consoleErrors', ...)\` MUST appear in a \`finally\` block.`,
      `- No commentary outside the fence; the skill strips the fence markers and writes the body as-is.`,
    ].join('\n')
  );

  // 3. Authoring guide (verbatim)
  sections.push([`# Authoring guide (verbatim)`, '', input.authoringGuide].join('\n'));

  // 4. Reference specs (triage-matched first, then canonical smoke at END)
  const refParts: string[] = [`# Reference specs`, ''];
  if (input.referenceSpecs.length === 0) {
    refParts.push(
      `(No triage-matched reference specs — relying on the canonical smoke shape below as the sole reference.)`,
      ''
    );
  } else {
    refParts.push(
      `Triage-matched references (study these first; their assertion shapes are closest to what this PR needs):`,
      ''
    );
    for (const ref of input.referenceSpecs) {
      refParts.push(`## ${ref.path}`, '', '```ts', ref.source, '```', '');
    }
  }
  refParts.push(
    `# Final reference: minimum-viable shape (use only as fallback for minimal probes)`,
    '',
    `## ${input.canonicalSmoke.path}`,
    '',
    '```ts',
    input.canonicalSmoke.source,
    '```',
    ''
  );
  sections.push(refParts.join('\n'));

  // 5. PR metadata
  const bodyExcerpt =
    input.prMeta.body.length > BODY_EXCERPT_CAP
      ? `${input.prMeta.body.slice(0, BODY_EXCERPT_CAP)}\n[...truncated]`
      : input.prMeta.body;
  const fileTable = input.prMeta.files
    .map((f) => `- ${f.path} (+${f.additions} / -${f.deletions})`)
    .join('\n');
  sections.push(
    [
      `# PR metadata`,
      '',
      `**Title:** ${input.prMeta.title}`,
      `**Changed files:** ${input.prMeta.changedFiles}`,
      `**Additions:** ${input.prMeta.additions}`,
      `**Deletions:** ${input.prMeta.deletions}`,
      '',
      `**Body excerpt:**`,
      '',
      bodyExcerpt || '(empty)',
      '',
      `**File list:**`,
      '',
      fileTable || '(none)',
    ].join('\n')
  );

  // 6. PR diff (verbatim, already truncated)
  sections.push(
    [`# PR diff (truncated per harness caps)`, '', '```diff', input.prDiff, '```'].join('\n')
  );

  // 7. Attachment + verdict signal explanation
  sections.push(
    [
      `# Attachments and verdict signal`,
      '',
      `The runner parses Playwright's JSON report and extracts two named attachments per test:`,
      `- \`pageErrors\`: JSON-stringified array of strings captured from \`page.on('pageerror', ...)\``,
      `- \`consoleErrors\`: JSON-stringified array of strings captured from \`page.on('console', ...)\` where \`msg.type() === 'error'\``,
      '',
      `Verdict = \`regression\` if any of: a test failed, \`pageErrors\` non-empty, \`consoleErrors\` non-empty. Otherwise \`verified\`.`,
      `Playwright records each \`await\` as a step automatically; the runner reads \`steps\` from the same report and surfaces them.`,
      '',
      `Your recipe must:`,
      `1. Register \`pageerror\` and \`console\` listeners BEFORE \`page.goto\`.`,
      `2. Attach BOTH \`pageErrors\` and \`consoleErrors\` (exact attachment names) inside a \`finally\` block so they land even on assertion failure.`,
      `3. End with at least one assertion that exercises the code path the PR touches (smoke + targeted; see authoring guide §8).`,
    ].join('\n')
  );

  // 8. Stop conditions
  sections.push(
    [
      `# Stop conditions`,
      '',
      `Emit ONLY the TypeScript source between \`<<<SPEC_START>>>\` and \`<<<SPEC_END>>>\`. No prose before, between, or after. The skill will reject your output if it contains any text outside the fence.`,
    ].join('\n')
  );

  const assembled = sections.join('\n\n---\n\n');

  // Hard assertion: char/4 heuristic for token budget.
  const estimatedTokens = assembled.length / 4;
  if (estimatedTokens > PROMPT_TOKEN_BUDGET) {
    throw new Error(
      `prompt-too-large: assembled prompt is ${assembled.length} chars (~${Math.round(estimatedTokens)} tokens), exceeds budget of ${PROMPT_TOKEN_BUDGET} tokens`
    );
  }

  return assembled;
}
