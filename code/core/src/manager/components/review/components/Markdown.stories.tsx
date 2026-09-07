import { expect, within } from 'storybook/test';

import preview from '../../../../../../.storybook/preview.tsx';
import { Markdown } from './Markdown.tsx';

const meta = preview.meta({
  component: Markdown,
});

export const Inline = meta.story({
  args: {
    children: 'A **bold** word, an *italic* word, and some `inline code`.',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('bold').tagName).toBe('STRONG');
    await expect(canvas.getByText('italic').tagName).toBe('EM');
    await expect(canvas.getByText('inline code').tagName).toBe('CODE');
  },
});

export const UnderscoreItalic = meta.story({
  args: {
    children: 'An _underscored_ italic word.',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('underscored').tagName).toBe('EM');
  },
});

export const Paragraphs = meta.story({
  args: {
    children: 'First paragraph.\n\nSecond paragraph.',
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll('p')).toHaveLength(2);
  },
});

export const RawHtmlIsEscaped = meta.story({
  args: {
    children: 'Not a <strong>tag</strong>.',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The angle brackets are rendered as literal text, not parsed into markup.
    await expect(canvas.getByText(/Not a <strong>tag<\/strong>\./)).toBeInTheDocument();
    await expect(canvasElement.querySelector('strong')).toBeNull();
  },
});
