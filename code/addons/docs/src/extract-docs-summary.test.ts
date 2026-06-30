import { describe, expect, it } from 'vitest';

import { extractDocsSummary } from './extract-docs-summary.ts';

// Ported from:
// https://github.com/storybookjs/mcp/blob/main/packages/mcp/src/utils/manifest-formatter/extract-docs-summary.test.ts
describe('extractDocsSummary', () => {
  describe('import statement removal', () => {
    it('should remove single import statements', () => {
      const content = `import { Button } from './Button';

This is the actual content.`;
      expect(extractDocsSummary(content)).toBe('This is the actual content.');
    });

    it('should remove multiple import statements', () => {
      const content = `import { Button } from './Button';
import { Meta, Story } from '@storybook/blocks';
import React from 'react';

This is the content after imports.`;
      expect(extractDocsSummary(content)).toBe('This is the content after imports.');
    });

    it('should remove side-effect imports', () => {
      const content = `import './styles.css';

Styled content.`;
      expect(extractDocsSummary(content)).toBe('Styled content.');
    });
  });

  describe('expression removal', () => {
    it('should remove simple expressions', () => {
      expect(extractDocsSummary('Some text {expression} more text.')).toBe('Some text more text.');
    });

    it('should remove nested expressions', () => {
      expect(extractDocsSummary('Text {outer {inner} value} end.')).toBe('Text end.');
    });
  });

  describe('JSX/HTML element text extraction', () => {
    it('should extract text from nested elements', () => {
      const content = `<div><p>Nested <strong>bold</strong> text.</p></div>`;
      expect(extractDocsSummary(content)).toBe('Nested bold text.');
    });

    it('should remove self-closing tags', () => {
      const content = `Text before <Component /> text after end.`;
      expect(extractDocsSummary(content)).toBe('Text before text after end.');
    });
  });

  describe('combined scenarios', () => {
    it('should handle typical MDX file content', () => {
      const content = `import { Button } from './Button';
import { Meta, Story } from '@storybook/blocks';

<Meta of={Button} />

# Button Component

The Button component is used for user interactions.

<Canvas>
  <Button>Click me</Button>
</Canvas>
`;
      expect(extractDocsSummary(content)).toBe(
        '# Button Component The Button component is used for user interactions. Click me'
      );
    });

    it('should handle empty content', () => {
      expect(extractDocsSummary('')).toBeUndefined();
    });

    it('should handle content with only imports', () => {
      const content = `import { Button } from './Button';
import { Meta } from '@storybook/blocks';`;
      expect(extractDocsSummary(content)).toBeUndefined();
    });
  });

  describe('truncation', () => {
    it('should truncate content longer than 90 characters', () => {
      const content =
        'This is a very long description that exceeds the maximum summary length limit and should be truncated with an ellipsis.';
      expect(extractDocsSummary(content)).toBe(
        'This is a very long description that exceeds the maximum summary length limit and should b...'
      );
    });

    it('should not truncate content at exactly 90 characters', () => {
      const content = 'A'.repeat(90);
      expect(extractDocsSummary(content)).toBe(content);
    });
  });

  describe('whitespace handling', () => {
    it('should collapse newlines into spaces', () => {
      const content = `Line one.
Line two.
Line three.`;
      expect(extractDocsSummary(content)).toBe('Line one. Line two. Line three.');
    });
  });
});
