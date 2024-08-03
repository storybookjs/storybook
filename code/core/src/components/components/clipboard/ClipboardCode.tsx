import React from 'react';
import { color, styled, typography } from '@storybook/core/theming';

const Code = styled.pre`
  line-height: 18px;
  padding: 11px 1rem;
  white-space: pre-wrap;
  background: rgba(0, 0, 0, 0.05);
  color: ${color.darkest};
  border-radius: 3px;
  margin: 1rem 0;
  width: 100%;
  display: block;
  overflow: hidden;
  font-family: ${typography.fonts.mono};
  font-size: ${typography.size.s2 - 1}px;
`;

interface ClipboardCodeProps {
  code: string;
}

export const ClipboardCode = ({ code, ...props }: ClipboardCodeProps) => (
  <Code id="clipboard-code" {...props}>
    {code}
  </Code>
);
