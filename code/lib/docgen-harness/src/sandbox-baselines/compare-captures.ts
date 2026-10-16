import { SandboxBaselineError } from './error.ts';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { z } from 'zod';

import { collectCurrentOrBetterViolations } from '../compare/expect-current-or-better.ts';
import type { Violation } from '../compare/types.ts';
import { readCapture } from './capture/files.ts';
import type { CompareRunOptions } from './options.ts';
import { stableStringify } from './stable-stringify.ts';

import { compareSvelteCaptureSnippet, type AcceptedRule } from './svelte-rules.ts';
import { isExactCallableClassification } from '../compare/argtypes.ts';

const waiversSchema = z.array(
  z.object({
    componentId: z.string().min(1),
    storyId: z.string().min(1).optional(),
    violation: z.string().min(1),
    reason: z.string().trim().min(1),
    approvedBy: z.string().trim().min(1),
  })
);
export type CaptureViolation = {
  componentId: string;
  storyId?: string;
  kind: Violation['kind'] | 'component-removed' | 'snippet-removed';
  arg: string;
  message: string;
};

export function compareCaptures(options: CompareRunOptions) {
  const before = readCapture(options.before);
  const after = readCapture(options.after);
  if (before.metadata.repo !== after.metadata.repo || before.metadata.sha !== after.metadata.sha)
    throw new SandboxBaselineError('Captures must use the same repository and SHA');
  const violations: CaptureViolation[] = [];
  const accepted: Record<AcceptedRule | 'callable-classification', number> = {
    'text-equivalent': 0,
    'snippet-child': 0,
    'default-omitted': 0,
    'event-omitted': 0,
    'binding-represented': 0,
    'callable-classification': 0,
  };
  const count = (rules: AcceptedRule[]) => {
    for (const rule of rules) accepted[rule] = (accepted[rule] ?? 0) + 1;
  };
  for (const [id, baseline] of Object.entries(before.components)) {
    const candidate = after.components[id];
    if (!candidate) {
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
    if (options.framework === 'svelte') {
      for (const [name, entry] of Object.entries(baseline.argTypes)) {
        if (isExactCallableClassification(entry.type, candidate.argTypes[name]?.type))
          accepted['callable-classification']++;
      }
    }
    if (baseline.description?.trim() && !candidate.description?.trim())
      add([
        {
          kind: 'lost-description',
          arg: 'component',
          message: 'component description missing from candidate',
        },
      ]);
    for (const [storyId, story] of Object.entries(baseline.stories)) {
      const snippet = story.snippet;
      if (snippet === null || snippet === 'timeout') continue;
      const current = candidate.stories[storyId]?.snippet;
      if (current === null || current === undefined || current === 'timeout') {
        violations.push({
          componentId: id,
          storyId,
          kind: 'snippet-removed',
          arg: 'snippet',
          message: 'baseline snippet missing from candidate',
        });
      } else {
        if (options.framework === 'svelte') {
          const result = compareSvelteCaptureSnippet({
            baseline: snippet,
            candidate: current,
            argTypes: candidate.argTypes,
          });
          add(result.violations, storyId);
          count(result.accepted);
        } else {
          add(
            collectCurrentOrBetterViolations({
              kind: 'snippet',
              framework: options.framework,
              baseline: snippet,
              candidate: current,
            }),
            storyId
          );
        }
      }
    }
  }
  const waivers = options.waivers
    ? waiversSchema.parse(JSON.parse(readFileSync(options.waivers, 'utf8')))
    : [];
  const matches = (waiver: z.infer<typeof waiversSchema>[number], violation: CaptureViolation) =>
    waiver.componentId === violation.componentId &&
    waiver.storyId === violation.storyId &&
    waiver.violation === violation.kind;
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
    accepted,
    violations,
    waivers,
    staleWaivers,
    unwaived,
    passed: unwaived.length === 0 && staleWaivers.length === 0,
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
      ...Object.entries(accepted).map(([rule, n]) => `accepted: ${rule} ${n}`),
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
