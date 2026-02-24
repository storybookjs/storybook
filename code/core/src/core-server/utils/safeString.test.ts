import { describe, expect, it } from 'vitest';

import { escapeForTemplate } from './safeString';

describe('safeString', () => {
  describe('escapeForTemplate', () => {
    it('should escape backticks in template strings', () => {
      expect(escapeForTemplate('button`s.tsx')).toBe('button\\`s.tsx');
    });

    it('should escape dollar signs for template expressions', () => {
      expect(escapeForTemplate('button$file.tsx')).toBe('button\\$file.tsx');
    });

    it('should escape backslashes', () => {
      expect(escapeForTemplate('button\\file.tsx')).toBe('button\\\\file.tsx');
    });

    it('should escape quotes or newlines', () => {
      expect(escapeForTemplate("button's.tsx")).toBe("button\\'s.tsx");
      expect(escapeForTemplate('button"s.tsx')).toBe('button\\"s.tsx');
      expect(escapeForTemplate('button\ns.tsx')).toBe('button\\ns.tsx');
    });

    it('should handle multiple special characters', () => {
      expect(escapeForTemplate('button`${file}\\path.tsx')).toBe('button\\`\\${file}\\\\path.tsx');
    });

    it('should preserve normal file paths', () => {
      expect(escapeForTemplate('./src/components/Button.tsx')).toBe('./src/components/Button.tsx');
    });
  });
});
