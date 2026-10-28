import React, { type FC, type ReactNode } from 'react';

// A deliberately tiny markdown renderer. The review UI only ever emits a small
// subset of markdown — paragraphs plus inline `**bold**`, `*italic*`/`_italic_`,
// and `` `code` `` — so we render that by hand instead of pulling in a full
// parser like markdown-to-jsx, which adds several megabytes to the bundle.
//
// Raw HTML is intentionally not parsed: any markup in the input is emitted as
// literal text, matching the previous `disableParsingRawHTML: true` behavior.

// Order matters: bold (`**`) is tried before italic (`*`) so a `**` opener is
// not mistaken for an italic span. Each branch captures its inner content.
//
// A fresh regex is created per call: the parser recurses (e.g. bold containing
// code), and a shared `/g` regex carries mutable `lastIndex` state that the
// inner call would clobber, sending the outer loop into an infinite loop.
const createInlinePattern = () => /(\*\*([\s\S]+?)\*\*|\*([\s\S]+?)\*|_([\s\S]+?)_|`([\s\S]+?)`)/g;

const parseInline = (text: string): ReactNode[] => {
  const nodes: ReactNode[] = [];
  const pattern = createInlinePattern();
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const [token, , bold, italicStar, italicUnderscore, code] = match;
    if (bold !== undefined) {
      nodes.push(<strong key={key++}>{parseInline(bold)}</strong>);
    } else if (italicStar !== undefined) {
      nodes.push(<em key={key++}>{parseInline(italicStar)}</em>);
    } else if (italicUnderscore !== undefined) {
      nodes.push(<em key={key++}>{parseInline(italicUnderscore)}</em>);
    } else if (code !== undefined) {
      nodes.push(<code key={key++}>{code}</code>);
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
};

export interface MarkdownProps {
  children: string;
}

export const Markdown: FC<MarkdownProps> = ({ children }) => {
  // Blank lines separate paragraphs; single newlines collapse to whitespace,
  // matching how a browser lays out inline content.
  const paragraphs = children.split(/\n{2,}/).filter((paragraph) => paragraph.trim() !== '');
  return (
    <>
      {paragraphs.map((paragraph, index) => (
        <p key={index}>{parseInline(paragraph)}</p>
      ))}
    </>
  );
};
