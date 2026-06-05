import { describe, it, expect } from 'vitest';
import { normalizeUnionLiterals, RADIO_CONTROL_THRESHOLD } from '../utils';

describe('Universal Normalizer Test Matrix', () => {
  const cases = [
    { 
      name: 'Small union with single quotes and undefined', 
      input: "'red' | 'blue' | undefined", 
      expected: ['red', 'blue'], 
      shouldBeRadio: true 
    },
    { 
      name: 'Large union with double quotes and null', 
      input: '"opt1" | "opt2" | "opt3" | "opt4" | "opt5" | "opt6" | null', 
      expected: ['opt1', 'opt2', 'opt3', 'opt4', 'opt5', 'opt6'], 
      shouldBeRadio: false 
    },
    { 
      name: 'Mixed quotes and void', 
      input: "'single' | \"double\" | void", 
      expected: ['single', 'double'], 
      shouldBeRadio: true 
    },
    { 
      name: 'Empty or noise-only union', 
      input: "undefined | null", 
      expected: [], 
      shouldBeRadio: true 
    },
  ];

  cases.forEach(({ name, input, expected, shouldBeRadio }) => {
    it(name, () => {
      const result = normalizeUnionLiterals(input);
      expect(result).toEqual(expected);
      
      const isRadio = result.length < RADIO_CONTROL_THRESHOLD;
      expect(isRadio).toBe(shouldBeRadio);
    });
  });
});
