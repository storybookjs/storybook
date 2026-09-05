import { describe, expect, it } from 'vitest';

import { AGENTIC_REF_CASES } from '../cases.ts';
import { shortNameOf } from '../utils.ts';
import { CASE_COLORS, caseColors } from './colors.ts';

const HEX = /^#[0-9A-F]{6}$/;

describe('CASE_COLORS', () => {
  it('covers every registered case, so adding a case forces a color choice', () => {
    for (const agenticRefCase of AGENTIC_REF_CASES) {
      const shortName = shortNameOf(agenticRefCase.name);
      expect(CASE_COLORS[shortName], `missing CASE_COLORS entry for "${shortName}"`).toBeDefined();
    }
  });

  it('assigns well-formed, unique color pairs', () => {
    const entries = Object.values(CASE_COLORS);
    for (const entry of entries) {
      expect(entry.light).toMatch(HEX);
      expect(entry.dark).toMatch(HEX);
    }
    expect(new Set(entries.map((e) => e.light)).size).toBe(entries.length);
    expect(new Set(entries.map((e) => e.dark)).size).toBe(entries.length);
  });
});

describe('caseColors', () => {
  it('resolves known cases and falls back to neutral gray for unknown ones', () => {
    const colors = caseColors(['do-dont', 'not-a-case']);
    expect(colors['do-dont']).toEqual(CASE_COLORS['do-dont']);
    expect(colors['not-a-case']).toEqual({ light: '#6B7280', dark: '#9CA3AF' });
  });

  it('keys the result in input order', () => {
    expect(Object.keys(caseColors(['full', 'empty']))).toEqual(['full', 'empty']);
  });
});
