import { describe, expect, it } from 'vitest';

import {
  PR_BODY_MAX_CHARS,
  PR_TITLE_MAX_CHARS,
  RETRY_CONTEXT_MAX_CHARS,
  assertWithinPromptTokenBudget,
  estimatePromptTokens,
  sanitizeUntrustedText,
  truncateUntrustedText,
} from './agent-prompt.ts';

// EPIC-5.10 — the prompt sanitizer (C7): fence-literal redaction, NUL/ANSI/
// control-char stripping, and the cap/truncation boundary.

describe('sanitizeUntrustedText — control + ANSI stripping', () => {
  it('strips NUL and other C0 control chars but keeps \\n and \\t', () => {
    const input = 'a\x00b\x07c\x1bd\te\nf';
    const out = sanitizeUntrustedText(input);
    expect(out).toBe('abcd\te\nf');
    expect(out).not.toContain('\x00');
    expect(out).not.toContain('\x07');
    expect(out).not.toContain('\x1b');
  });

  it('strips a full ANSI SGR escape sequence (terminal-repaint defense)', () => {
    // ESC [ 3 1 m  ... ESC [ 0 m  — the ESC (\x1b) chars are removed; the
    // bracket/digits are plain text and remain (regex only targets controls).
    const input = '\x1b[31mDANGER\x1b[0m';
    const out = sanitizeUntrustedText(input);
    expect(out).not.toContain('\x1b');
    expect(out).toBe('[31mDANGER[0m');
  });

  it('removes the DEL-adjacent C1 control range too (\\x0e-\\x1f)', () => {
    const out = sanitizeUntrustedText('x\x0ey\x1fz');
    expect(out).toBe('xyz');
  });

  it('is a no-op for clean text', () => {
    const clean = 'A normal PR title — with em-dash and (parens).';
    expect(sanitizeUntrustedText(clean)).toBe(clean);
  });
});

describe('sanitizeUntrustedText — C7 spec-fence literal redaction', () => {
  it('redacts a literal <<<SPEC_START>>> marker', () => {
    const out = sanitizeUntrustedText('prefix <<<SPEC_START>>> suffix');
    expect(out).toBe('prefix <<<__redacted__>>> suffix');
    expect(out).not.toContain('SPEC_START');
  });

  it('redacts a literal <<<SPEC_END>>> marker', () => {
    const out = sanitizeUntrustedText('<<<SPEC_END>>>');
    expect(out).toBe('<<<__redacted__>>>');
    expect(out).not.toContain('SPEC_END');
  });

  it('redacts EVERY occurrence (global), not just the first', () => {
    const out = sanitizeUntrustedText('<<<SPEC_START>>>x<<<SPEC_END>>>y<<<SPEC_START>>>');
    expect(out).toBe('<<<__redacted__>>>x<<<__redacted__>>>y<<<__redacted__>>>');
    expect(out).not.toMatch(/SPEC_(START|END)/);
  });

  it('redacts a fence even when smuggled alongside control chars', () => {
    const out = sanitizeUntrustedText('\x00<<<SPEC_START>>>\x1bpayload');
    expect(out).toBe('<<<__redacted__>>>payload');
  });

  it('does not redact a near-miss that is not the exact fence literal', () => {
    const input = '<<<SPEC_MIDDLE>>> and <<SPEC_START>>';
    expect(sanitizeUntrustedText(input)).toBe(input);
  });
});

describe('truncateUntrustedText — cap / truncation boundary', () => {
  it('returns input unchanged when exactly at the cap', () => {
    const s = 'a'.repeat(100);
    expect(truncateUntrustedText(s, 100)).toBe(s);
  });

  it('returns input unchanged when under the cap', () => {
    const s = 'a'.repeat(99);
    expect(truncateUntrustedText(s, 100)).toBe(s);
  });

  it('truncates and appends the marker when ONE char over the cap', () => {
    const s = 'a'.repeat(101);
    const out = truncateUntrustedText(s, 100);
    expect(out).toBe('a'.repeat(100) + '\n... [truncated]');
    expect(out.startsWith('a'.repeat(100))).toBe(true);
    expect(out.endsWith('... [truncated]')).toBe(true);
  });

  it('the documented hard caps are the expected constants', () => {
    expect(PR_TITLE_MAX_CHARS).toBe(512);
    expect(PR_BODY_MAX_CHARS).toBe(4096);
    expect(RETRY_CONTEXT_MAX_CHARS).toBe(8192);
  });

  it('respects the real PR_TITLE cap boundary', () => {
    const atCap = 't'.repeat(PR_TITLE_MAX_CHARS);
    const overCap = 't'.repeat(PR_TITLE_MAX_CHARS + 1);
    expect(truncateUntrustedText(atCap, PR_TITLE_MAX_CHARS)).toBe(atCap);
    expect(truncateUntrustedText(overCap, PR_TITLE_MAX_CHARS)).toContain('... [truncated]');
  });
});

describe('prompt token budget (C10)', () => {
  it('estimatePromptTokens uses the chars/4 heuristic (rounded)', () => {
    expect(estimatePromptTokens('a'.repeat(400))).toBe(100);
    expect(estimatePromptTokens('a'.repeat(402))).toBe(101); // 100.5 → round
  });

  it('does not throw for a prompt within the 80k-token budget', () => {
    expect(() => assertWithinPromptTokenBudget('a'.repeat(4 * 80_000))).not.toThrow();
  });

  it('throws an actionable error when the prompt exceeds the budget', () => {
    const oversize = 'a'.repeat(4 * 80_000 + 4);
    expect(() => assertWithinPromptTokenBudget(oversize)).toThrowError(/prompt-too-large/);
  });
});
