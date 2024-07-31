/// <reference path="../typings.d.ts" />

import type { ElementType } from 'react';
import { createElement, forwardRef } from 'react';
import * as typography from './components/typography/components';

export { A } from './components/typography/elements/A';
export { Blockquote } from './components/typography/elements/Blockquote';
export { Code } from './components/typography/elements/Code';
export { Div } from './components/typography/elements/Div';
export { DL } from './components/typography/elements/DL';
export { H1 } from './components/typography/elements/H1';
export { H2 } from './components/typography/elements/H2';
export { H3 } from './components/typography/elements/H3';
export { H4 } from './components/typography/elements/H4';
export { H5 } from './components/typography/elements/H5';
export { H6 } from './components/typography/elements/H6';
export { HR } from './components/typography/elements/HR';
export { Img } from './components/typography/elements/Img';
export { LI } from './components/typography/elements/LI';
export { OL } from './components/typography/elements/OL';
export { P } from './components/typography/elements/P';
export { Pre } from './components/typography/elements/Pre';
export { Span } from './components/typography/elements/Span';
export { Table } from './components/typography/elements/Table';
export { TT } from './components/typography/elements/TT';
export { UL } from './components/typography/elements/UL';
export { Badge } from './components/Badge/Badge';

// Typography
export { Link } from './components/typography/link/link';
export { DocumentWrapper } from './components/typography/DocumentWrapper';
export type {
  SyntaxHighlighterFormatTypes,
  SyntaxHighlighterProps,
  SyntaxHighlighterRendererProps,
  SupportedLanguage,
} from './components/syntaxhighlighter/syntaxhighlighter-types';
export { SyntaxHighlighter } from './components/syntaxhighlighter/lazy-syntaxhighlighter';
export { createCopyToClipboardFunction } from './components/syntaxhighlighter/syntaxhighlighter';

// UI
export { ActionBar } from './components/ActionBar/ActionBar';
export { Modal } from './components/Modal/Modal';
export { Spaced } from './components/spaced/Spaced';
export { Placeholder } from './components/placeholder/placeholder';
export { ScrollArea } from './components/ScrollArea/ScrollArea';
export { Zoom } from './components/Zoom/Zoom';
export type { ActionItem } from './components/ActionBar/ActionBar';
export { ErrorFormatter } from './components/ErrorFormatter/ErrorFormatter';

// Forms
export { Button } from './components/Button/Button';
export { IconButton } from './components/IconButton/IconButton';
export { Form } from './components/form/index';

// Tooltips
export { WithTooltip, WithTooltipPure } from './components/tooltip/lazy-WithTooltip';
export { TooltipMessage } from './components/tooltip/TooltipMessage';
export { TooltipNote } from './components/tooltip/TooltipNote';
export {
  TooltipLinkList,
  type Link as TooltipLinkListLink,
} from './components/tooltip/TooltipLinkList';
export { default as ListItem } from './components/tooltip/ListItem';

// Toolbar and subcomponents
export { Tabs, TabsState, TabBar, TabWrapper } from './components/tabs/tabs';
export { EmptyTabContent } from './components/tabs/EmptyTabContent';
export { IconButtonSkeleton, TabButton } from './components/bar/button';
export { Separator, interleaveSeparators } from './components/bar/separator';
export { Bar, FlexBar } from './components/bar/bar';
export { AddonPanel } from './components/addon-panel/addon-panel';

// Graphics
export type { IconsProps } from './components/icon/icon';
export { Icons, Symbols } from './components/icon/icon';
export { icons } from './components/icon/icon';
export { StorybookLogo } from './components/brand/StorybookLogo';
export { StorybookIcon } from './components/brand/StorybookIcon';

// Loader
export { Loader } from './components/Loader/Loader';

// Utils
export { getStoryHref } from './components/utils/getStoryHref';

export * from './components/typography/DocumentFormatting';
export * from './components/typography/ResetWrapper';

export { withReset, codeCommon } from './components/typography/lib/common';

export { ClipboardCode } from './components/clipboard/ClipboardCode';

export const components = typography.components;

const resetComponents: Record<string, ElementType> = {};

Object.keys(typography.components).forEach((key) => {
  // eslint-disable-next-line react/display-name
  resetComponents[key] = forwardRef((props, ref) => createElement(key, { ...props, ref }));
});

export { resetComponents };
