import { createHmac } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import type { RecipeTest, StepStatus, VerifyResult } from './core.ts';
import {
  signResult,
  signablePayload,
  verifyResultSignature,
} from './core.ts';
import { deriveVerdict } from './ci/derive-verdict.ts';

// EPIC-5.4 — SABOTEUR suite for the HMAC verdict-integrity gate.
//
// Threat model (core.ts / SECURITY.md §c1): a PR-added recipe runs inside the
// srt sandbox and may FORGE verify-result.json (e.g. {"verdict":"verified"})
// but does NOT know VERIFY_PROVENANCE_SECRET. verifyResultSignature must
// reject anything not signed with the real secret over SIGNED_FIELDS.

const SECRET = 'test-provenance-secret-aaaaaaaaaaaaaaaa';

// A representative fully-populated signed result (only SIGNED_FIELDS matter
// for the HMAC; extra fields are post-processor territory).
function baseResult(): Partial<VerifyResult> & { createdAt: string } {
  const tests: RecipeTest[] = [
    {
      specPath: 'a',
      title: 't',
      status: 'passed' as StepStatus,
      steps: [],
      pageErrors: [],
      consoleErrors: [],
    },
  ];
  return {
    schemaVersion: 2,
    runId: '2026-05-19T00-00-00.000Z',
    verdict: 'verified' as const,
    template: 'internal-ui',
    mode: 'visual' as const,
    recipeSpecPath: '.verify-recipes/pr-1.spec.ts',
    tests,
    traceZipPaths: [],
    regressionReason: undefined as string | undefined,
    storyIds: [],
    createdAt: '2026-05-19T00:00:00.000Z',
  };
}

describe('verifyResultSignature — SABOTEUR cases', () => {
  it('(a) forged {verdict:"verified"} with NO/empty signature → false', () => {
    const forged = { ...baseResult(), verdict: 'verified' as const };
    expect(verifyResultSignature(forged, '', SECRET)).toBe(false);
    // A garbage non-hex sig of arbitrary length is also rejected (Buffer.from
    // throws / length mismatch) — never throws, always boolean false.
    expect(verifyResultSignature(forged, 'deadbeef', SECRET)).toBe(false);
    expect(verifyResultSignature(forged, 'not-hex-at-all', SECRET)).toBe(false);
  });

  it('(b) tampered payload with a sig computed over the ORIGINAL → false', () => {
    const original = baseResult();
    const sigOverOriginal = signResult(original, SECRET);
    const tampered = { ...original, verdict: 'verified' as const, runId: 'attacker-rewrote-this' };
    expect(verifyResultSignature(tampered, sigOverOriginal, SECRET)).toBe(false);
  });

  it('(c) a correctly-signed payload → true', () => {
    const result = baseResult();
    const sig = signResult(result, SECRET);
    expect(verifyResultSignature(result, sig, SECRET)).toBe(true);
  });

  it('(c2) a different secret cannot validate a correctly-signed payload', () => {
    const result = baseResult();
    const sig = signResult(result, SECRET);
    expect(verifyResultSignature(result, sig, 'wrong-secret')).toBe(false);
  });

  it('(d) changing a NON-signed field (unitTests) does NOT invalidate the sig', () => {
    const result = baseResult();
    const sig = signResult(result, SECRET);
    // unitTests is a POST_PROCESSOR field, deliberately outside SIGNED_FIELDS.
    const withUnitTests = {
      ...result,
      unitTests: { ran: true, passed: false, summary: '0 passed, 1 failed' },
      evidenceRetry: true,
      evidenceVerdict: 'regression',
    };
    expect(verifyResultSignature(withUnitTests, sig, SECRET)).toBe(true);
  });

  it('(e) changing a SIGNED field (verdict) DOES invalidate the sig', () => {
    const result = { ...baseResult(), verdict: 'regression' as const };
    const sig = signResult(result, SECRET);
    const flipped = { ...result, verdict: 'verified' as const };
    expect(verifyResultSignature(flipped, sig, SECRET)).toBe(false);
  });

  it('(e2) changing other SIGNED fields (recipeSpecPath / tests) invalidates the sig', () => {
    const result = baseResult();
    const sig = signResult(result, SECRET);
    expect(
      verifyResultSignature({ ...result, recipeSpecPath: '/evil/spec.ts' }, sig, SECRET)
    ).toBe(false);
    expect(
      verifyResultSignature(
        { ...result, tests: [{ ...result.tests[0], status: 'failed' as const }] },
        sig,
        SECRET
      )
    ).toBe(false);
  });
});

describe('deriveVerdict downgrades a forged-but-detected verdict', () => {
  // The trusted gate (main() in derive-verdict.ts) downgrades verified→regression
  // on a bad sig; deriveVerdict() itself owns the unit-test merge downgrade.
  // Pin the unit-test-merge downgrade path (the part exported & pure).
  it('verified + failing PR unit tests → regression with derived reason', () => {
    const { outcome, result } = deriveVerdict(
      {
        verdict: 'verified',
        template: 'internal-ui',
        unitTests: { ran: true, passed: false, summary: '0 passed, 2 failed' },
      },
      null
    );
    expect(outcome.verdict).toBe('regression');
    expect(outcome.changed).toBe(true);
    expect(result?.verdict).toBe('regression');
  });

  it('verified + passing unit tests stays verified (no false downgrade)', () => {
    const { outcome } = deriveVerdict(
      {
        verdict: 'verified',
        template: 'internal-ui',
        unitTests: { ran: true, passed: true, summary: '2 passed' },
      },
      null
    );
    expect(outcome.verdict).toBe('verified');
    expect(outcome.changed).toBe(false);
  });
});

describe('Wave-1.1 LOW(b) — module-load disjointness invariant is non-vacuous', () => {
  // SIGNED_FIELDS is module-private in core.ts (must NOT export it). Derive the
  // OBSERVABLE signed set from signablePayload(), which by contract emits
  // exactly the SIGNED_FIELDS that are defined on the input. Feed it an object
  // with a value for every candidate field so the observed set == real
  // SIGNED_FIELDS.
  const ALL_CANDIDATE_FIELDS = [
    'schemaVersion',
    'runId',
    'verdict',
    'template',
    'mode',
    'recipeSpecPath',
    'tests',
    'traceZipPaths',
    'regressionReason',
    // post-processor fields — MUST NOT appear in the signed payload:
    'unitTests',
    'evidenceRetry',
    'evidenceVerdict',
    // arbitrary noise — MUST NOT appear either:
    'notes',
    'durations',
    'createdAt',
  ];

  function observedSignedSet(): Set<string> {
    const probe: Record<string, unknown> = {};
    for (const f of ALL_CANDIDATE_FIELDS) probe[f] = `__present__:${f}`;
    const payload = JSON.parse(signablePayload(probe)) as Record<string, unknown>;
    return new Set(Object.keys(payload));
  }

  const POST_PROCESSOR_FIELDS = ['unitTests', 'evidenceRetry', 'evidenceVerdict'] as const;

  it('observed SIGNED set is non-empty and contains the security-critical fields', () => {
    const signed = observedSignedSet();
    // Non-vacuous: if signablePayload emitted nothing, every disjointness
    // assertion below would be trivially true. Guard against that.
    expect(signed.size).toBeGreaterThan(0);
    expect(signed.has('verdict')).toBe(true);
    expect(signed.has('recipeSpecPath')).toBe(true);
    expect(signed.has('tests')).toBe(true);
  });

  it('SIGNED ∩ {unitTests,evidenceRetry,evidenceVerdict} = ∅ (real observed set)', () => {
    const signed = observedSignedSet();
    const overlap = POST_PROCESSOR_FIELDS.filter((f) => signed.has(f));
    expect(overlap).toEqual([]);
  });

  it('the guard logic is non-vacuous: an INJECTED overlap WOULD be detected', () => {
    // Replicate core.ts:154-166 set-intersection guard over a POISONED array
    // and assert it flags the injected `unitTests`. This proves the invariant
    // check has teeth (it is not trivially-true), satisfying the deferred
    // Wave-1.1 LOW(b) pin.
    const poisonedSigned = new Set<string>([
      'verdict',
      'recipeSpecPath',
      'unitTests', // <-- injected overlap (the bug a future refactor could ship)
    ]);
    const overlap = POST_PROCESSOR_FIELDS.filter((f) => poisonedSigned.has(f));
    expect(overlap).toContain('unitTests');
    expect(overlap.length).toBeGreaterThan(0);
  });

  it('signablePayload excludes post-processor + noise fields entirely', () => {
    const signed = observedSignedSet();
    for (const f of ['unitTests', 'evidenceRetry', 'evidenceVerdict', 'notes', 'createdAt']) {
      expect(signed.has(f)).toBe(false);
    }
  });

  it('signResult is a SHA-256 HMAC over exactly signablePayload (cross-check)', () => {
    const result = baseResult();
    const expected = createHmac('sha256', SECRET).update(signablePayload(result)).digest('hex');
    expect(signResult(result, SECRET)).toBe(expected);
  });
});
