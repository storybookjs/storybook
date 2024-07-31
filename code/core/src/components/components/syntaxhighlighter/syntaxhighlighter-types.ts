import type { BuiltInParserName } from 'prettier';
import type { ReactNode } from 'react';
import type { supportedLanguages } from './syntaxhighlighter';

export interface SyntaxHighlighterRendererProps {
  rows: any[];
  stylesheet: string;
  useInlineStyles: boolean;
}

export type SyntaxHighlighterRenderer = (props: SyntaxHighlighterRendererProps) => ReactNode;

export interface SyntaxHighlighterCustomProps {
  language: string;
  copyable?: boolean;
  bordered?: boolean;
  padded?: boolean;
  format?: SyntaxHighlighterFormatTypes;
  formatter?: (type: SyntaxHighlighterFormatTypes, source: string) => Promise<string>;
  className?: string;
  renderer?: SyntaxHighlighterRenderer;
}

export type SyntaxHighlighterFormatTypes = boolean | 'dedent' | BuiltInParserName;

// these are copied from the `react-syntax-highlighter` package
// the reason these a COPIED is the types for this package are defining modules by filename
// which will not match one we've localized type-definitions
type LineTagPropsFunction = (lineNumber: number) => React.HTMLProps<HTMLElement>;

export type SupportedLanguage = 'text' | keyof typeof supportedLanguages;

export interface SyntaxHighlighterBaseProps {
  children?: React.ReactNode;
  codeTagProps?: React.HTMLProps<HTMLElement>;
  customStyle?: any;
  language?: SupportedLanguage;
  lineNumberStyle?: any;
  lineProps?: LineTagPropsFunction | React.HTMLProps<HTMLElement>;
  showLineNumbers?: boolean;
  startingLineNumber?: number;
  wrapLongLines?: boolean;
  style?: any;
  useInlineStyles?: boolean;
}

export type SyntaxHighlighterProps = SyntaxHighlighterBaseProps & SyntaxHighlighterCustomProps;
