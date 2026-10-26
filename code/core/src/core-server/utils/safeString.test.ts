import { describe, expect, it } from 'vitest';

import { escapeForTemplate } from './safeString';

describe('safeString', () => {
  describe('escapeForTemplate', () => {
    it('should escape backticks in template strings', () => {
      expect(escapeForTemplate('button`s.tsx')).toMatchInlineSnapshot('"button\\`s.tsx"');
    });

    it('should escape dollar signs for template expressions', () => {
      expect(escapeForTemplate('button$file.tsx')).toMatchInlineSnapshot('"button\\$file.tsx"');
    });

    it('should escape backslashes', () => {
      expect(escapeForTemplate('button\\file.tsx')).toMatchInlineSnapshot('"button\\\\file.tsx"');
    });

    it('should escape quotes', () => {
      expect(escapeForTemplate("button's.tsx")).toMatchInlineSnapshot(`"button\\'s.tsx"`);
      expect(escapeForTemplate('button"s.tsx')).toMatchInlineSnapshot(`"button\\"s.tsx"`);
    });

    it('should handle multiple special characters', () => {
      expect(escapeForTemplate('button`${file}\\path.tsx')).toMatchInlineSnapshot(
        `"button\\\`\\\${file}\\\\path.tsx"`
      );
    });

    it('should preserve normal file paths', () => {
      expect(escapeForTemplate('./src/components/Button.tsx')).toMatchInlineSnapshot(
        '"./src/components/Button.tsx"'
      );
    });
  });
});
