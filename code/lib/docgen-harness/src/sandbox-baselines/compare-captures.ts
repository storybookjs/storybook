import { SandboxBaselineError } from './error.ts';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'pathe';

import { z } from 'zod';

import { collectCurrentOrBetterViolations } from '../compare/expect-current-or-better.ts';
import type { Violation } from '../compare/types.ts';
import { readCapture } from './capture/files.ts';
import type { CompareRunOptions } from './options.ts';
import { stableStringify } from './stable-stringify.ts';

const waiversSchema = z.array(
  z
    .object({
      componentId: z.string().min(1),
      storyId: z.string().min(1).optional(),
      violation: z.string().min(1),
      arg: z.string().min(1),
      reason: z.string().trim().min(1),
      approvedBy: z.string().trim().min(1),
    })
    .strict()
);
export type CaptureViolation = {
  componentId: string;
  storyId?: string;
  kind: Violation['kind'] | 'component-removed' | 'story-removed' | 'snippet-removed';
  arg: string;
  message: string;
};

function snippetResult(
  snippet: string | null
): { kind: 'captured'; code: string } | { kind: 'missing' | 'timeout' } {
  if (snippet === null || snippet.trim() === '') return { kind: 'missing' };
  if (snippet === 'timeout') return { kind: 'timeout' };
  return { kind: 'captured', code: snippet };
}

export function compareCaptures(options: CompareRunOptions) {
  const before = readCapture(options.before);
  const after = readCapture(options.after);
  if (before.metadata.repo !== after.metadata.repo || before.metadata.sha !== after.metadata.sha)
    throw new SandboxBaselineError('Captures must use the same repository and SHA');
  if (before.metadata.engine !== 'legacy' || after.metadata.engine !== 'server')
    throw new SandboxBaselineError('Comparison requires a legacy baseline and a server candidate');
  const coverage = { attempted: 0, compared: 0, incomplete: 0 };
  const violations: CaptureViolation[] = [];
  for (const [id, baseline] of Object.entries(before.components)) {
    const candidate = after.components[id];
    if (!candidate) {
      const stories = Object.keys(baseline.stories).length;
      coverage.attempted += stories;
      coverage.incomplete += stories;
      violations.push({
        componentId: id,
        kind: 'component-removed',
        arg: id,
        message: 'component missing from candidate',
      });
      continue;
    }
    const add = (items: Violation[], storyId?: string) =>
      violations.push(
        ...items.map((item) => ({ ...item, componentId: id, ...(storyId ? { storyId } : {}) }))
      );
    add(
      collectCurrentOrBetterViolations({
        kind: 'argTypes',
        baseline: baseline.argTypes,
        candidate: candidate.argTypes,
        legacyBaseline: true,
      })
    );
    if (baseline.description?.trim() && !candidate.description?.trim())
      add([
        {
          kind: 'lost-description',
          arg: 'component',
          message: 'component description missing from candidate',
        },
      ]);
    for (const [storyId, story] of Object.entries(baseline.stories)) {
      coverage.attempted++;
      const baselineResult = snippetResult(story.snippet);
      const candidateStory = candidate.stories[storyId];
      if (!candidateStory) {
        coverage.incomplete++;
        violations.push({
          componentId: id,
          storyId,
          kind: 'story-removed',
          arg: 'story',
          message: 'story missing from candidate',
        });
        continue;
      }
      const candidateResult = snippetResult(candidateStory.snippet);
      if (baselineResult.kind !== 'captured') {
        coverage.incomplete++;
        continue;
      }
      if (candidateResult.kind !== 'captured') {
        coverage.incomplete++;
        violations.push({
          componentId: id,
          storyId,
          kind: 'snippet-removed',
          arg: 'snippet',
          message: 'baseline snippet missing from candidate',
        });
      } else {
        coverage.compared++;
        add(
          collectCurrentOrBetterViolations({
            kind: 'snippet',
            framework: options.framework,
            baseline: baselineResult.code,
            candidate: candidateResult.code,
          }),
          storyId
        );
      }
    }
  }
  const waivers = options.waivers
    ? waiversSchema.parse(JSON.parse(readFileSync(options.waivers, 'utf8')))
    : [];
  const matches = (waiver: z.infer<typeof waiversSchema>[number], violation: CaptureViolation) =>
    waiver.componentId === violation.componentId &&
    waiver.storyId === violation.storyId &&
    waiver.violation === violation.kind &&
    waiver.arg === violation.arg;
  const staleWaivers = waivers.filter(
    (waiver) => !violations.some((violation) => matches(waiver, violation))
  );
  const unwaived = violations.filter(
    (violation) => !waivers.some((waiver) => matches(waiver, violation))
  );
  const countStories = (capture: typeof before) =>
    Object.values(capture.components).reduce(
      (sum, component) => sum + Object.keys(component.stories).length,
      0
    );
  const countTimeouts = (capture: typeof before) =>
    Object.values(capture.components)
      .flatMap((component) => Object.values(component.stories))
      .filter((story) => story.snippet === 'timeout').length;
  const report = {
    before: before.metadata,
    after: after.metadata,
    components: {
      before: Object.keys(before.components).length,
      after: Object.keys(after.components).length,
    },
    stories: { before: countStories(before), after: countStories(after) },
    timeouts: { before: countTimeouts(before), after: countTimeouts(after) },
    gains: Object.keys(after.components).filter((id) => !before.components[id]),
    violations,
    waivers,
    staleWaivers,
    unwaived,
    coverage,
    passed:
      unwaived.length === 0 &&
      staleWaivers.length === 0 &&
      coverage.compared > 0 &&
      coverage.incomplete === 0,
  };
  mkdirSync(options.report, { recursive: true });
  writeFileSync(join(options.report, 'report.json'), stableStringify(report) + '\n');
  const escape = (value: string) => value.replaceAll('|', '\\|').replaceAll('\n', ' ');
  writeFileSync(
    join(options.report, 'report.md'),
    [
      '| Repo | SHA | Components before / after | Stories before / after | Timeouts before / after | Violations | Waived | Stale waivers | Result |',
      '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
      `| ${escape(before.metadata.repo)} | ${before.metadata.sha} | ${report.components.before} / ${report.components.after} | ${report.stories.before} / ${report.stories.after} | ${report.timeouts.before} / ${report.timeouts.after} | ${violations.length} | ${violations.length - unwaived.length} | ${staleWaivers.length} | ${report.passed ? 'PASS' : 'FAIL'} |`,
      '',
      `Snippet coverage: ${coverage.compared} compared, ${coverage.incomplete} incomplete, ${coverage.attempted} attempted.`,
      '',
      '',
      '| Component | Story | Violation | Arg | Detail |',
      '| --- | --- | --- | --- | --- |',
      ...violations.map(
        (v) =>
          `| ${escape(v.componentId)} | ${escape(v.storyId ?? '')} | ${v.kind} | ${escape(v.arg)} | ${escape(v.message)} |`
      ),
      '',
      `Gained components: ${report.gains.join(', ') || 'none'}.`,
      ...staleWaivers.map(
        (w) => `Stale waiver: ${w.componentId} ${w.storyId ?? ''} ${w.violation}.`
      ),
      '',
    ].join('\n')
  );
  return report;
}
