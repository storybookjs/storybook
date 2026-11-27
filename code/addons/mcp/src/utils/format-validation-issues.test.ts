import { describe, expect, it } from 'vitest';
import * as v from 'valibot';
import { withFriendlyErrors } from './format-validation-issues.ts';

const Collection = v.object({
  title: v.string(),
  rationale: v.string(),
  storyIds: v.array(v.string()),
});

const ReviewState = v.object({
  title: v.string(),
  description: v.string(),
  collections: v.array(Collection),
});

function runValidate(schema: any, input: unknown) {
  const result = schema['~standard'].validate(input);
  if (result instanceof Promise) throw new Error('not async in these tests');
  return result;
}

describe('withFriendlyErrors', () => {
  const friendly = withFriendlyErrors(ReviewState);

  it('passes valid input through unchanged', () => {
    const ok = runValidate(friendly, {
      title: 'x',
      description: 'y',
      collections: [{ title: 'a', rationale: 'b', storyIds: ['c'] }],
    });
    expect((ok as any).value).toBeTruthy();
    expect((ok as any).issues).toBeUndefined();
  });

  it('rewrites missing-required-field issues to a short message', () => {
    // This is exactly the shape we got hit by in the live trial — collection
    // missing `rationale`.
    const result = runValidate(friendly, {
      title: 'x',
      description: 'y',
      collections: [{ title: 'a', storyIds: ['c'] }],
    }) as { issues: Array<{ path: string; message: string }> };
    const missing = result.issues.find((i) => i.message.includes('rationale'));
    expect(missing).toBeDefined();
    expect(missing!.message).toMatch(/^Missing required field `rationale`/);
    expect(missing!.path).toContain('collections');
    expect(missing!.path).toMatch(/\[0\]/);
  });

  it('points the "at" suffix at the parent container, not the missing field itself', () => {
    const result = runValidate(friendly, {
      title: 'x',
      description: 'y',
      collections: [{ title: 'a', storyIds: ['c'] }],
    }) as { issues: Array<{ path: string; message: string }> };
    const missing = result.issues.find((i) => i.message.includes('rationale'))!;
    // Bad: "Missing required field `rationale` at `collections[0].rationale`."
    // Good: "Missing required field `rationale` at `collections[0]`."
    expect(missing.message).toContain('at `collections[0]`');
    expect(missing.message).not.toContain('collections[0].rationale`.');
  });

  it('omits the "at" suffix for top-level missing fields', () => {
    const result = runValidate(friendly, {
      // missing `title` entirely at the top
      description: 'y',
      collections: [],
    }) as { issues: Array<{ path: string; message: string }> };
    const missing = result.issues.find((i) => i.message.includes('title'))!;
    expect(missing.message).toMatch(/^Missing required field `title`\.$/);
  });

  it('strips bulky valibot metadata (`input`, `requirement`, `lang`, …)', () => {
    const result = runValidate(friendly, {
      title: 'x',
      description: 'y',
      collections: [{ title: 'a', storyIds: ['c'] }],
    }) as { issues: Array<Record<string, unknown>> };
    // Only keys we expect on a friendly issue:
    for (const issue of result.issues) {
      expect(Object.keys(issue).sort()).toEqual(['message', 'path']);
    }
  });

  it('produces issues that JSON.stringify to a short string (smoke check)', () => {
    const result = runValidate(friendly, {
      title: 'x',
      description: 'y',
      collections: [{ title: 'a', storyIds: ['c'] }],
    }) as { issues: unknown };
    const json = JSON.stringify(result.issues);
    // Sanity bound: the raw valibot dump for this case is ~3 KB. The friendly
    // envelope should fit comfortably under 500 chars.
    expect(json.length).toBeLessThan(500);
  });

  it('preserves the non-missing-key issues with their original message', () => {
    // Wrong type rather than missing key.
    const result = runValidate(friendly, {
      title: 'x',
      description: 'y',
      collections: [{ title: 'a', rationale: 'b', storyIds: 'not-an-array' }],
    }) as { issues: Array<{ path: string; message: string }> };
    expect(result.issues.length).toBeGreaterThan(0);
    const wrongType = result.issues.find((i) => i.path.includes('storyIds'));
    expect(wrongType).toBeDefined();
    // Original valibot message — not rewritten by the missing-key heuristic.
    expect(wrongType!.message).not.toMatch(/^Missing required field/);
  });
});
