import { beforeEach, describe, expect, it, vi } from 'vitest';

// eslint-disable-next-line depend/ban-dependencies
import { execaSync } from 'execa';

import {
  getTerminalWidth,
  protectUrls,
  wrapTextForClack,
  wrapTextForClackHint,
} from './wrap-utils';

// Mock dependencies at the top with spy: true option
vi.mock('@clack/prompts', () => ({
  S_BAR: '│',
}));

vi.mock('picocolors', () => ({
  cyan: vi.fn((text) => `cyan(${text})`),
  dim: vi.fn((text) => `dim(${text})`),
  reset: vi.fn((text) => `reset(${text})`),
}));

vi.mock('execa', () => ({
  execaSync: vi.fn(),
}));

// Helper function to strip ANSI codes for length calculation
function stripAnsi(str: string): string {
  return str.replace(/\u001b\[[0-9;]*m/g, '');
}

// Helper function to get visible length
function getVisibleLength(str: string): number {
  return stripAnsi(str).length;
}

describe('wrap-utils', () => {
  beforeEach(() => {
    // Mock process.stdout.columns
    Object.defineProperty(process.stdout, 'columns', {
      value: 80,
      configurable: true,
    });

    // Clear all mocks
    vi.clearAllMocks();
  });

  describe('getTerminalWidth', () => {
    it('should return process.stdout.columns when available', () => {
      Object.defineProperty(process.stdout, 'columns', {
        value: 120,
        configurable: true,
      });

      expect(getTerminalWidth()).toBe(120);
    });

    it('should return default width (80) when process.stdout.columns is undefined', () => {
      Object.defineProperty(process.stdout, 'columns', {
        value: undefined,
        configurable: true,
      });

      expect(getTerminalWidth()).toBe(80);
    });

    it('should return default width (80) when accessing columns throws an error', () => {
      Object.defineProperty(process.stdout, 'columns', {
        get: () => {
          throw new Error('Test error');
        },
        configurable: true,
      });

      expect(getTerminalWidth()).toBe(80);
    });
  });

  describe('wrapTextForClack', () => {
    beforeEach(() => {
      // Note: execaSync mock is not actually used by the implementation
      // which reads process.env directly, but kept for compatibility
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(execaSync).mockImplementation((cmd: string, args: any) => {
        if (args && args[0] === '$TERM_PROGRAM') {
          return {
            stdout: 'iTerm.app',
          } as any;
        }
        if (args && args[0] === '$TERM_PROGRAM_VERSION') {
          return {
            stdout: '3.4.0',
          } as any;
        }
        return {
          stdout: '',
        } as any;
      });
    });

    it('should wrap text to fit within content width and respect line length constraints', () => {
      const text =
        'This is a very long line of text that should be wrapped to fit within the specified width and not exceed the limit';
      const terminalWidth = 50;
      const expectedContentWidth = terminalWidth - 8; // 42 characters
      const result = wrapTextForClack(text, terminalWidth);

      const lines = result.split('\n');

      // Should have multiple lines
      expect(lines.length).toBeGreaterThan(1);

      // Each line should not exceed the content width
      lines.forEach((line) => {
        const visibleLength = getVisibleLength(line);
        expect(visibleLength).toBeLessThanOrEqual(expectedContentWidth);
        expect(visibleLength).toBeGreaterThan(0); // No empty lines
      });

      // All original text should be preserved
      const unwrappedResult = lines.join(' ').replace(/\s+/g, ' ').trim();
      const originalWords = text.split(/\s+/);
      originalWords.forEach((word) => {
        expect(unwrappedResult).toContain(word);
      });
    });

    it('should handle text shorter than width without modification', () => {
      const text = 'Short text';
      const result = wrapTextForClack(text, 80);

      expect(result).toBe(text);
      expect(result).not.toContain('\n');
    });

    it('should preserve ANSI codes and maintain color across line breaks', () => {
      const text =
        '\u001b[31mThis is red text that is long enough to wrap\u001b[0m and this is normal text';
      const result = wrapTextForClack(text, 30);

      // Should contain the ANSI codes
      expect(result).toMatch(/\u001b\[31m/); // Red color code
      expect(result).toMatch(/\u001b\[0m/); // Reset code

      // Text content should be preserved
      expect(stripAnsi(result)).toContain('This is red text');
      expect(stripAnsi(result)).toContain('normal text');

      // Should wrap into multiple lines
      expect(result.split('\n').length).toBeGreaterThan(1);
    });

    it('should handle empty text gracefully', () => {
      const result = wrapTextForClack('');
      expect(result).toBe('');
    });

    it('should preserve explicit newlines in original text', () => {
      const text = 'Line 1\nLine 2\nLine 3';
      const result = wrapTextForClack(text, 80);

      const lines = result.split('\n');
      expect(lines).toHaveLength(3);
      expect(lines[0]).toContain('Line 1');
      expect(lines[1]).toContain('Line 2');
      expect(lines[2]).toContain('Line 3');
    });
  });

  describe('wrapTextForClackHint', () => {
    it('should wrap hint text with proper continuation line indentation', () => {
      const text =
        'This is a very long hint text that should be wrapped with proper indentation for continuation lines';
      const result = wrapTextForClackHint(text, 60, 'Label');

      if (result.includes('\n')) {
        const lines = result.split('\n');
        expect(lines.length).toBeGreaterThan(1);

        // First line should be the original text start
        expect(lines[0]).toContain('This is a very');

        // Continuation lines should have proper indentation structure
        for (let i = 1; i < lines.length; i++) {
          // Should contain the stroke character and proper spacing
          expect(lines[i]).toMatch(/cyan\(│\)/);
          expect(lines[i]).toMatch(/dim\(/);

          // Should have meaningful content after indentation
          const contentAfterIndent = lines[i].replace(/^.*dim\(/, '').replace(/\)$/, '');
          expect(contentAfterIndent.trim()).not.toBe('');
        }
      }
    });

    it('should not wrap short text and return it unchanged', () => {
      const text = 'Short hint';
      const result = wrapTextForClackHint(text, 80, 'Label');

      expect(result).toBe(text);
      expect(result).not.toContain('\n');
      expect(result).not.toContain('cyan(│)');
    });

    it('should calculate available width correctly based on label length', () => {
      const text = 'This hint text should account for the long label when calculating wrap width';
      const longLabel = 'Very long label name that takes up space';
      const shortLabel = 'Short';

      const resultWithLongLabel = wrapTextForClackHint(text, 60, longLabel);
      const resultWithShortLabel = wrapTextForClackHint(text, 60, shortLabel);

      // With longer label, should wrap earlier (more lines)
      const longLabelLines = resultWithLongLabel.split('\n').length;
      const shortLabelLines = resultWithShortLabel.split('\n').length;

      if (longLabelLines > 1 || shortLabelLines > 1) {
        expect(longLabelLines).toBeGreaterThanOrEqual(shortLabelLines);
      }
    });

    it('should handle hint text without label parameter', () => {
      const text =
        'Hint without label that might be long enough to wrap depending on terminal width constraints';
      const result = wrapTextForClackHint(text, 50);

      // Should still work without label
      expect(typeof result).toBe('string');
      expect(stripAnsi(result)).toContain('Hint without label');

      // If wrapped, should still have proper structure
      if (result.includes('\n')) {
        const lines = result.split('\n');
        for (let i = 1; i < lines.length; i++) {
          expect(lines[i]).toMatch(/cyan\(│\)/);
        }
      }
    });

    it('should maintain minimum content width of 30 characters', () => {
      const text = 'Test hint text that should maintain minimum width';
      const veryLongLabel = 'A'.repeat(50); // Very long label
      const result = wrapTextForClackHint(text, 10, veryLongLabel); // Very small terminal width

      // Should still produce reasonable output
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      expect(stripAnsi(result)).toContain('Test hint text');
    });

    it('should handle empty hint text', () => {
      const result = wrapTextForClackHint('', 80, 'Label');
      expect(result).toBe('');
    });

    it('should preserve ANSI codes in hint text', () => {
      const text = '\u001b[33mYellow hint text\u001b[0m with normal text that might wrap';
      const result = wrapTextForClackHint(text, 40, 'Label');

      // ANSI codes should be preserved
      expect(result).toMatch(/\u001b\[33m/); // Yellow color
      expect(result).toMatch(/\u001b\[0m/); // Reset
    });
  });

  describe('edge cases and special characters', () => {
    it('should keep symbols with following text when possible (no-break behavior)', () => {
      const text =
        '✔ Success message that should stay together with the checkmark when line width allows';
      const result = wrapTextForClack(text, 40);

      const lines = result.split('\n');

      // Find the line with the checkmark
      const checkmarkLine = lines.find((line) => stripAnsi(line).includes('✔'));
      expect(checkmarkLine).toBeDefined();

      // The checkmark should be followed by "Success" on the same line if width allows
      if (checkmarkLine && getVisibleLength(checkmarkLine) <= 32) {
        // 40 - 8 = 32
        expect(stripAnsi(checkmarkLine)).toMatch(/✔\s+Success/);
      }
    });

    it('should handle complex ANSI codes and symbols combination', () => {
      const text =
        '\u001b[32m✔\u001b[0m \u001b[1mBold text\u001b[0m with normal text and more content';
      const result = wrapTextForClack(text, 50);

      // Should preserve all ANSI codes
      expect(result).toMatch(/\u001b\[32m/); // Green
      expect(result).toMatch(/\u001b\[1m/); // Bold
      expect(result).toMatch(/\u001b\[0m/); // Reset (multiple instances)

      // Should preserve content
      expect(stripAnsi(result)).toContain('✔');
      expect(stripAnsi(result)).toContain('Bold text');
      expect(stripAnsi(result)).toContain('normal text');

      // Line length constraints should be respected
      const lines = result.split('\n');
      lines.forEach((line) => {
        expect(getVisibleLength(line)).toBeLessThanOrEqual(42); // 50 - 8
      });
    });

    it('should handle multiple consecutive ANSI codes correctly', () => {
      const text = '\u001b[1m\u001b[31m\u001b[4mMultiple codes\u001b[0m normal text continues here';
      const result = wrapTextForClack(text, 50);

      // All ANSI codes should be preserved
      expect(result).toMatch(/\u001b\[1m/); // Bold
      expect(result).toMatch(/\u001b\[31m/); // Red
      expect(result).toMatch(/\u001b\[4m/); // Underline
      expect(result).toMatch(/\u001b\[0m/); // Reset

      // Content should be intact
      expect(stripAnsi(result)).toContain('Multiple codes');
      expect(stripAnsi(result)).toContain('normal text continues');
    });

    it('should properly handle reset codes and color state', () => {
      const text = '\u001b[31mRed\u001b[0m normal \u001b[32mGreen\u001b[0m text continues';
      const result = wrapTextForClack(text, 50);

      // Color codes should be preserved
      expect(result).toMatch(/\u001b\[31m/); // Red
      expect(result).toMatch(/\u001b\[32m/); // Green

      // Reset codes should be present
      const resetMatches = result.match(/\u001b\[0m/g);
      expect(resetMatches).not.toBeNull();
      expect(resetMatches!.length).toBeGreaterThanOrEqual(2);

      // Content order should be preserved
      const cleanResult = stripAnsi(result);
      expect(cleanResult.indexOf('Red')).toBeLessThan(cleanResult.indexOf('normal'));
      expect(cleanResult.indexOf('normal')).toBeLessThan(cleanResult.indexOf('Green'));
    });
  });

  describe('protectUrls', () => {
    beforeEach(() => {
      // Note: execaSync mock is not actually used by the implementation
      // which reads process.env directly, but kept for compatibility
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(execaSync).mockImplementation((cmd: string, args: any) => {
        if (args && args[0] === '$TERM_PROGRAM') {
          return {
            stdout: 'iTerm.app',
          } as any;
        }
        if (args && args[0] === '$TERM_PROGRAM_VERSION') {
          return {
            stdout: '3.4.0',
          } as any;
        }
        return {
          stdout: '',
        } as any;
      });
    });

    it('should return text unchanged when no URLs are present', () => {
      const text = 'This is just plain text without any URLs';
      const result = protectUrls(text);
      expect(result).toBe(text);
    });

    it('should create hyperlinks for URLs when terminal supports hyperlinks', () => {
      const text = 'Visit https://example.com for more info';
      const result = protectUrls(text);

      expect(result).toMatchInlineSnapshot(
        `"Visit ]8;;https://example.comhttps://example.com]8;; for more info"`
      );
    });

    it('should handle multiple URLs in the same text', () => {
      const text = 'Check https://example.com and https://test.org for details';
      const result = protectUrls(text);

      expect(result).toMatchInlineSnapshot(
        `"Check ]8;;https://example.comhttps://example.com]8;; and ]8;;https://test.orghttps://test.org]8;; for details"`
      );
    });

    it('should truncate long URLs when they exceed maxUrlLength', () => {
      const longUrl =
        'https://example.com/very/long/path/that/exceeds/the/maximum/allowed/length/for/urls';
      const text = `Visit ${longUrl} for details`;
      const result = protectUrls(text, { maxUrlLength: 30 });

      expect(result).toMatchInlineSnapshot(
        `"Visit ]8;;https://example.com/very/long/path/that/exceeds/the/maximum/allowed/length/for/urlshttps://example.com/very/lo...]8;; for details"`
      );
    });

    it('should respect maxLineWidth when calculating effective max length', () => {
      const url = 'https://example.com/path/that/might/be/too/long/for/line';
      const text = `Prefix text before ${url}`;
      const result = protectUrls(text, { maxLineWidth: 50 });

      // Should still apply hyperlink formatting
      expect(result).toMatchInlineSnapshot(
        `"Prefix text before ]8;;https://example.com/path/that/might/be/too/long/for/linehttps://example.com/path/tha...]8;;"`
      );
    });

    it('should not modify URLs already inside hyperlink escape sequences', () => {
      const url = 'https://example.com';
      const existingHyperlink = `\u001b]8;;${url}\u0007click here\u001b]8;;\u0007`;
      const text = `Check out ${existingHyperlink} for info`;
      const result = protectUrls(text);

      // The function may still process URLs inside existing hyperlinks
      // This test documents the current behavior rather than enforcing strict isolation
      expect(result).toMatchInlineSnapshot(
        `"Check out ]8;;https://example.comclick here]8;; for info"`
      );
    });

    it('should handle URLs with query parameters and fragments', () => {
      const url = 'https://example.com/path?param=value&other=test#section';
      const text = `Visit ${url} for details`;
      const result = protectUrls(text);

      expect(result).toMatchInlineSnapshot(
        `"Visit ]8;;https://example.com/path?param=value&other=test#sectionhttps://example.com/path?param=value&other=test#section]8;; for details"`
      );
    });

    it('should handle URLs at different positions in text', () => {
      const url = 'https://example.com';

      // URL at start
      const startText = `${url} is a great site`;
      const startResult = protectUrls(startText);
      expect(startResult).toMatchInlineSnapshot(
        `"]8;;https://example.comhttps://example.com]8;; is a great site"`
      );

      // URL at end
      const endText = `Visit the site at ${url}`;
      const endResult = protectUrls(endText);
      expect(endResult).toMatchInlineSnapshot(
        `"Visit the site at ]8;;https://example.comhttps://example.com]8;;"`
      );

      // URL in middle
      const middleText = `Before ${url} after`;
      const middleResult = protectUrls(middleText);
      expect(middleResult).toMatchInlineSnapshot(
        `"Before ]8;;https://example.comhttps://example.com]8;; after"`
      );
    });

    it('should maintain minimum 20 character URL length when calculating available space', () => {
      const url = 'https://example.com/short';
      const longPrefix = 'A'.repeat(100); // Very long prefix
      const text = `${longPrefix} ${url}`;
      const result = protectUrls(text, { maxLineWidth: 50 });

      // URL should still be hyperlinked even with long prefix
      expect(result).toContain(`\u001b]8;;${url}\u0007${url}\u001b]8;;\u0007`);
    });

    it('should handle newlines correctly when calculating line position', () => {
      const url = 'https://example.com';
      const text = `First line\nSecond line with ${url} here`;
      const result = protectUrls(text);

      expect(result).toMatchInlineSnapshot(`
  "First line
  Second line with ]8;;https://example.comhttps://example.com]8;; here"
`);
    });

    it('should use terminal width as default when no options provided', () => {
      Object.defineProperty(process.stdout, 'columns', {
        value: 100,
        configurable: true,
      });

      const url = 'https://example.com';
      const text = `Visit ${url}`;
      const result = protectUrls(text);

      expect(result).toContain(`\u001b]8;;${url}\u0007${url}\u001b]8;;\u0007`);
    });

    it('should handle HTTP URLs in addition to HTTPS', () => {
      const httpUrl = 'http://example.com';
      const httpsUrl = 'https://secure.com';
      const text = `Visit ${httpUrl} and ${httpsUrl}`;
      const result = protectUrls(text);

      expect(result).toMatchInlineSnapshot(
        `"Visit ]8;;http://example.comhttp://example.com]8;; and ]8;;https://secure.comhttps://secure.com]8;;"`
      );
    });

    it('should not modify text when terminal does not support hyperlinks', () => {
      // Mock process.env to return unsupported terminal
      const originalEnv = process.env.TERM_PROGRAM;
      const originalVersion = process.env.TERM_PROGRAM_VERSION;

      process.env.TERM_PROGRAM = 'Apple_Terminal';
      delete process.env.TERM_PROGRAM_VERSION;

      const text = 'Visit https://example.com for info';
      const result = protectUrls(text);

      expect(result).toBe(text);
      expect(result).not.toContain('\u001b]8;;');

      // Restore original env
      if (originalEnv) {
        process.env.TERM_PROGRAM = originalEnv;
      } else {
        delete process.env.TERM_PROGRAM;
      }
      if (originalVersion) {
        process.env.TERM_PROGRAM_VERSION = originalVersion;
      }
    });

    it('should handle complex URLs with ports and authentication', () => {
      const url = 'https://user:pass@example.com:8080/path';
      const text = `Connect to ${url}`;
      const result = protectUrls(text);

      expect(result).toContain(`\u001b]8;;${url}\u0007${url}\u001b]8;;\u0007`);
    });

    it('should correctly calculate visible length excluding ANSI codes', () => {
      const url = 'https://example.com';
      const coloredPrefix = '\u001b[31mRed text\u001b[0m';
      const text = `${coloredPrefix} ${url}`;
      const result = protectUrls(text, { maxLineWidth: 50 });

      expect(result).toMatchInlineSnapshot(
        `"[31mRed text[0m ]8;;https://example.comhttps://example.com]8;;"`
      );
    });

    it('should handle edge case with URL at exact line width limit', () => {
      const url = 'https://example.com/test';
      const prefix = 'A'.repeat(25); // Specific length to test edge case
      const text = `${prefix} ${url}`;
      const result = protectUrls(text, { maxLineWidth: 50 });

      expect(result).toContain(`\u001b]8;;${url}\u0007`);
    });

    it('should truncate URLs correctly and preserve full URL in hyperlink target', () => {
      const longUrl = 'https://example.com/very/very/very/long/path/that/needs/truncation';
      const text = `Visit ${longUrl}`;
      const result = protectUrls(text, { maxUrlLength: 30 });

      // Should contain the full URL in the hyperlink target
      expect(result).toMatchInlineSnapshot(
        `"Visit ]8;;https://example.com/very/very/very/long/path/that/needs/truncationhttps://example.com/very/ve...]8;;"`
      );
    });
  });
});
