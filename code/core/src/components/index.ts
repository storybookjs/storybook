/// <reference path="../typings.d.ts" />
import type { ElementType } from 'react';
import { createElement, forwardRef } from 'react';

import * as typography from './components/typography/components.tsx';

export { A } from './components/typography/elements/A.tsx';
export { Blockquote } from './components/typography/elements/Blockquote.tsx';
export { Code } from './components/typography/elements/Code.tsx';
export { Div } from './components/typography/elements/Div.tsx';
export { DL } from './components/typography/elements/DL.tsx';
export { H1 } from './components/typography/elements/H1.tsx';
export { H2 } from './components/typography/elements/H2.tsx';
export { H3 } from './components/typography/elements/H3.tsx';
export { H4 } from './components/typography/elements/H4.tsx';
export { H5 } from './components/typography/elements/H5.tsx';
export { H6 } from './components/typography/elements/H6.tsx';
export { HR } from './components/typography/elements/HR.tsx';
export { Img } from './components/typography/elements/Img.tsx';
export { LI } from './components/typography/elements/LI.tsx';
export { OL } from './components/typography/elements/OL.tsx';
export { P } from './components/typography/elements/P.tsx';
export { Pre } from './components/typography/elements/Pre.tsx';
export { Span } from './components/typography/elements/Span.tsx';
export { Table } from './components/typography/elements/Table.tsx';
export { TT } from './components/typography/elements/TT.tsx';
export { UL } from './components/typography/elements/UL.tsx';
export { Badge } from './components/Badge/Badge.tsx';

// Typography
export { Link } from './components/typography/link/link.tsx';
export { DocumentWrapper } from './components/typography/DocumentWrapper.tsx';
export type {
  SyntaxHighlighterFormatTypes,
  SyntaxHighlighterProps,
  SyntaxHighlighterRendererProps,
  SupportedLanguage,
} from './components/syntaxhighlighter/syntaxhighlighter-types.ts';
export { SyntaxHighlighter } from './components/syntaxhighlighter/lazy-syntaxhighlighter.tsx';
export { createCopyToClipboardFunction } from './components/syntaxhighlighter/clipboard.ts';

// UI
export { ActionBar } from './components/ActionBar/ActionBar.tsx';
export { ActionList } from './components/ActionList/ActionList.tsx';
export { Collapsible } from './components/Collapsible/Collapsible.tsx';
export { Card } from './components/Card/Card.tsx';
export { Modal, ModalDecorator } from './components/Modal/Modal.tsx';
export { Spaced } from './components/spaced/Spaced.tsx';
export { Placeholder } from './components/placeholder/placeholder.tsx';
export { ScrollArea } from './components/ScrollArea/ScrollArea.tsx';
export { Zoom } from './components/Zoom/Zoom.tsx';
export type { ActionItem } from './components/ActionBar/ActionBar.tsx';
export { ErrorFormatter } from './components/ErrorFormatter/ErrorFormatter.tsx';

// Buttons
export { Button, IconButton } from './components/Button/Button.tsx';
export type { ButtonProps } from './components/Button/Button.tsx';
export { ToggleButton } from './components/ToggleButton/ToggleButton.tsx';
export { Select } from './components/Select/Select.tsx';

// Forms
export { Form } from './components/Form/Form.tsx';

// Overlay helpers for popovers, menus, tooltips
export { convertToReactAriaPlacement } from './components/shared/overlayHelpers.tsx';
export type { PopperPlacement } from './components/shared/overlayHelpers.tsx';

// Popovers
export { Popover } from './components/Popover/Popover.tsx';
export type { PopoverProps } from './components/Popover/Popover.tsx';
export { PopoverProvider } from './components/Popover/PopoverProvider.tsx';
export type { PopoverProviderProps } from './components/Popover/PopoverProvider.tsx';

// Tooltips
export { Tooltip } from './components/tooltip/Tooltip.tsx';
export type { TooltipProps } from './components/tooltip/Tooltip.tsx';
export { TooltipNote } from './components/tooltip/TooltipNote.tsx';
export type { TooltipNoteProps } from './components/tooltip/TooltipNote.tsx';
export { TooltipProvider } from './components/tooltip/TooltipProvider.tsx';
export type { TooltipProviderProps } from './components/tooltip/TooltipProvider.tsx';

// Old tooltips - deprecated and to remove in Storybook 11
export { WithTooltip, WithTooltipPure } from './components/tooltip/lazy-WithTooltip.tsx';
export { TooltipMessage } from './components/tooltip/TooltipMessage.tsx';
export {
  TooltipLinkList,
  type Link as TooltipLinkListLink,
} from './components/tooltip/TooltipLinkList.tsx';
export { default as ListItem } from './components/tooltip/ListItem.tsx';

// Bar, Toolbar and Tabs
export { Tabs, TabsState, TabBar, TabWrapper } from './components/Tabs/Tabs.tsx';
export { TabButton } from './components/Tabs/Button.tsx';
export { Separator, interleaveSeparators } from './components/Bar/Separator.tsx';
export { Bar, FlexBar, type BarProps } from './components/Bar/Bar.tsx';
export { EmptyTabContent } from './components/Tabs/EmptyTabContent.tsx';
export { AddonPanel } from './components/addon-panel/addon-panel.tsx';
export { Toolbar, AbstractToolbar } from './components/Toolbar/Toolbar.tsx';
export { TabList } from './components/Tabs/TabList.tsx';
export type { TabListProps } from './components/Tabs/TabList.tsx';
export { TabPanel } from './components/Tabs/TabPanel.tsx';
export type { TabPanelProps } from './components/Tabs/TabPanel.tsx';
export { TabsView, useTabsState } from './components/Tabs/TabsView.tsx';
export type { TabProps, TabsViewProps } from './components/Tabs/TabsView.tsx';

export { StatelessTabList } from './components/Tabs/StatelessTabList.tsx';
export type { StatelessTabListProps } from './components/Tabs/StatelessTabList.tsx';
export { StatelessTabPanel } from './components/Tabs/StatelessTabPanel.tsx';
export type { StatelessTabPanelProps } from './components/Tabs/StatelessTabPanel.tsx';
export { StatelessTabsView } from './components/Tabs/StatelessTabsView.tsx';
export type { StatelessTabsViewProps } from './components/Tabs/StatelessTabsView.tsx';
export { StatelessTab } from './components/Tabs/StatelessTab.tsx';
export type { StatelessTabProps } from './components/Tabs/StatelessTab.tsx';

// Graphics
export { StorybookLogo } from './brand/StorybookLogo.tsx';
export { StorybookIcon } from './brand/StorybookIcon.tsx';

// Loader
export { Loader } from './components/Loader/Loader.tsx';
export { ProgressSpinner } from './components/ProgressSpinner/ProgressSpinner.tsx';

// Utils
export { getStoryHref } from './components/utils/getStoryHref.ts';

export * from './components/typography/DocumentFormatting.tsx';
export * from './components/typography/ResetWrapper.tsx';

export { withReset, codeCommon } from './components/typography/lib/common.tsx';

export { ClipboardCode } from './components/clipboard/ClipboardCode.tsx';

export const components = typography.components;

const resetComponents: Record<string, ElementType> = {};

Object.keys(typography.components).forEach((key) => {
  // eslint-disable-next-line react/display-name
  resetComponents[key] = forwardRef((props, ref) => createElement(key, { ...props, ref }));
});

export { resetComponents };
