import { describe, it, expect } from 'vitest';
import { extractDocsSummary } from './extract-docs-summary.ts';

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

		it('should remove default imports', () => {
			const content = `import Button from './Button';

Button documentation here.`;
			expect(extractDocsSummary(content)).toBe('Button documentation here.');
		});

		it('should remove namespace imports', () => {
			const content = `import * as Icons from './icons';

Icons documentation.`;
			expect(extractDocsSummary(content)).toBe('Icons documentation.');
		});

		it('should remove side-effect imports', () => {
			const content = `import './styles.css';

Styled content.`;
			expect(extractDocsSummary(content)).toBe('Styled content.');
		});
	});

	describe('expression removal', () => {
		it('should remove simple expressions', () => {
			const content = `Some text {expression} more text.`;
			expect(extractDocsSummary(content)).toBe('Some text more text.');
		});

		it('should remove JSX comments', () => {
			const content = `Some text {/* comment */} more text.`;
			expect(extractDocsSummary(content)).toBe('Some text more text.');
		});

		it('should remove nested expressions', () => {
			const content = `Text {outer {inner} value} end.`;
			expect(extractDocsSummary(content)).toBe('Text end.');
		});

		it('should remove complex expressions with function calls', () => {
			const content = `Count: {items.length} items.`;
			expect(extractDocsSummary(content)).toBe('Count: items.');
		});

		it('should remove expressions with template literals', () => {
			const content = 'Text {`template ${value}`} end.';
			expect(extractDocsSummary(content)).toBe('Text end.');
		});
	});

	describe('JSX/HTML element text extraction', () => {
		it('should extract text from simple elements', () => {
			const content = `<p>This is a paragraph.</p>`;
			expect(extractDocsSummary(content)).toBe('This is a paragraph.');
		});

		it('should extract text from nested elements', () => {
			const content = `<div><p>Nested <strong>bold</strong> text.</p></div>`;
			expect(extractDocsSummary(content)).toBe('Nested bold text.');
		});

		it('should remove self-closing tags', () => {
			const content = `Text before <br /> text after <img src="test.png" /> end.`;
			expect(extractDocsSummary(content)).toBe('Text before text after end.');
		});

		it('should handle PascalCase component names', () => {
			const content = `<CustomComponent>Component content</CustomComponent>`;
			expect(extractDocsSummary(content)).toBe('Component content');
		});

		it('should handle elements with attributes', () => {
			const content = `<div className="wrapper" data-testid="test">Content here</div>`;
			expect(extractDocsSummary(content)).toBe('Content here');
		});

		it('should handle multiple sibling elements', () => {
			const content = `<p>First paragraph.</p> <p>Second paragraph.</p>`;
			expect(extractDocsSummary(content)).toBe('First paragraph. Second paragraph.');
		});
	});

	describe('combined scenarios', () => {
		it('should handle typical MDX file content', () => {
			const content = `import { Button } from './Button';
import { Meta, Story } from '@storybook/blocks';

<Meta title="Components/Button" />

# Button Component

The Button component is used for user interactions.

<div>
  <Story name="Primary">
    <Button variant="primary">Click me</Button>
  </Story>
</div>`;
			const result = extractDocsSummary(content);
			expect(result).toBe(
				'# Button Component The Button component is used for user interactions. Click me',
			);
		});

		it('should handle MDX with expressions and components', () => {
			const content = `<div>
  Welcome to {appName}!
  <CustomComponent prop={value}>
    <p>Inner text content.</p>
  </CustomComponent>
</div>`;
			expect(extractDocsSummary(content)).toBe('Welcome to ! Inner text content.');
		});

		it('should handle empty content', () => {
			expect(extractDocsSummary('')).toBeUndefined();
		});

		it('should handle content with only imports', () => {
			const content = `import { Button } from './Button';
import { Meta } from '@storybook/blocks';`;
			expect(extractDocsSummary(content)).toBeUndefined();
		});

		it('should handle content with only expressions and tags', () => {
			const content = `{expression} <SelfClosing /> <Empty></Empty>`;
			expect(extractDocsSummary(content)).toBeUndefined();
		});
	});

	describe('truncation', () => {
		it('should truncate content longer than 90 characters', () => {
			const content =
				'This is a very long description that exceeds the maximum summary length limit and should be truncated with an ellipsis.';
			const result = extractDocsSummary(content);
			expect(result).toBe(
				'This is a very long description that exceeds the maximum summary length limit and should b...',
			);
			expect(result?.length).toBe(93); // 90 chars + '...'
		});

		it('should not truncate content at exactly 90 characters', () => {
			const content = 'A'.repeat(90);
			expect(extractDocsSummary(content)).toBe(content);
		});

		it('should not truncate content shorter than 90 characters', () => {
			const content = 'Short description.';
			expect(extractDocsSummary(content)).toBe(content);
		});
	});

	describe('whitespace handling', () => {
		it('should collapse multiple spaces', () => {
			const content = `Text   with    multiple     spaces.`;
			expect(extractDocsSummary(content)).toBe('Text with multiple spaces.');
		});

		it('should collapse newlines into spaces', () => {
			const content = `Line one.
Line two.
Line three.`;
			expect(extractDocsSummary(content)).toBe('Line one. Line two. Line three.');
		});

		it('should trim leading and trailing whitespace', () => {
			const content = `   
  Trimmed content.   
  `;
			expect(extractDocsSummary(content)).toBe('Trimmed content.');
		});
	});
});
