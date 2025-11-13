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
export { createCopyToClipboardFunction } from './components/syntaxhighlighter/clipboard';

// UI
export { ActionBar } from './components/ActionBar/ActionBar';
export { Collapsible } from './components/Collapsible/Collapsible';
export { Card } from './components/Card/Card';
export { FocusProxy, FocusRing, FocusTarget, FocusOutline } from './components/FocusRing/FocusRing';
export {
  Listbox,
  ListboxAction,
  ListboxButton,
  ListboxIcon,
  ListboxItem,
  ListboxHoverItem,
  ListboxText,
} from './components/Listbox/Listbox';
export { Modal, ModalDecorator } from './components/Modal/Modal';
export { Spaced } from './components/spaced/Spaced';
export { Placeholder } from './components/placeholder/placeholder';
export { ScrollArea } from './components/ScrollArea/ScrollArea';
export { Zoom } from './components/Zoom/Zoom';
export type { ActionItem } from './components/ActionBar/ActionBar';
export { ErrorFormatter } from './components/ErrorFormatter/ErrorFormatter';
export { Optional } from './components/Optional/Optional';

// Buttons
export { Button, IconButton } from './components/Button/Button';
export type { ButtonProps } from './components/Button/Button';
export { ToggleButton } from './components/ToggleButton/ToggleButton';
export { Select } from './components/Select/Select';

// Forms
export { Form } from './components/Form/Form';

// Overlay helpers for popovers, menus, tooltips
export { convertToReactAriaPlacement } from './components/shared/overlayHelpers';
export type { PopperPlacement } from './components/shared/overlayHelpers';

// Popovers
export { Popover } from './components/Popover/Popover';
export type { PopoverProps } from './components/Popover/Popover';
export { PopoverProvider } from './components/Popover/PopoverProvider';
export type { PopoverProviderProps } from './components/Popover/PopoverProvider';

// Tooltips
export { Tooltip } from './components/tooltip/Tooltip';
export type { TooltipProps } from './components/tooltip/Tooltip';
export { TooltipNote } from './components/tooltip/TooltipNote';
export type { TooltipNoteProps } from './components/tooltip/TooltipNote';
export { TooltipProvider } from './components/tooltip/TooltipProvider';
export type { TooltipProviderProps } from './components/tooltip/TooltipProvider';

// Old tooltips - deprecated and to remove in Storybook 11
export { WithTooltip, WithTooltipPure } from './components/tooltip/lazy-WithTooltip';
export { TooltipMessage } from './components/tooltip/TooltipMessage';
export {
  TooltipLinkList,
  type Link as TooltipLinkListLink,
} from './components/tooltip/TooltipLinkList';
export { default as ListItem } from './components/tooltip/ListItem';

// Bar, Toolbar and Tabs
export { Tabs, TabsState, TabBar, TabWrapper } from './components/Tabs/Tabs';
export { TabButton } from './components/Tabs/Button';
export { Separator, interleaveSeparators } from './components/Bar/Separator';
export { Bar, FlexBar, type BarProps } from './components/Bar/Bar';
export { EmptyTabContent } from './components/Tabs/EmptyTabContent';
export { AddonPanel } from './components/addon-panel/addon-panel';
export { Toolbar, AbstractToolbar } from './components/Toolbar/Toolbar';
export { TabList } from './components/Tabs/TabList';
export type { TabListProps } from './components/Tabs/TabList';
export { TabPanel } from './components/Tabs/TabPanel';
export type { TabPanelProps } from './components/Tabs/TabPanel';
export { TabsView, useTabsState } from './components/Tabs/TabsView';
export type { TabProps, TabsViewProps } from './components/Tabs/TabsView';

export { StatelessTabList } from './components/Tabs/StatelessTabList';
export type { StatelessTabListProps } from './components/Tabs/StatelessTabList';
export { StatelessTabPanel } from './components/Tabs/StatelessTabPanel';
export type { StatelessTabPanelProps } from './components/Tabs/StatelessTabPanel';
export { StatelessTabsView } from './components/Tabs/StatelessTabsView';
export type { StatelessTabsViewProps } from './components/Tabs/StatelessTabsView';
export { StatelessTab } from './components/Tabs/StatelessTab';
export type { StatelessTabProps } from './components/Tabs/StatelessTab';

export { TourGuide } from './components/TourGuide/TourGuide';
export { TourTooltip } from './components/TourGuide/TourTooltip';
export { HighlightElement } from './components/TourGuide/HighlightElement';

// Graphics
export { StorybookLogo } from './brand/StorybookLogo';
export { StorybookIcon } from './brand/StorybookIcon';

// Loader
export { Loader } from './components/Loader/Loader';
export { ProgressSpinner } from './components/ProgressSpinner/ProgressSpinner';

// Utils
export { getStoryHref } from './components/utils/getStoryHref';
export { useLocationHash } from './components/shared/useLocationHash';

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
