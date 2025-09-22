import type { ComponentProps, FC, HTMLAttributes, ReactElement, ReactNode } from 'react';
import React from 'react';

import { AriaTabList, AriaTabPanel, Bar, EmptyTabContent } from 'storybook/internal/components';

import type { TabListState } from 'react-stately';
import { Item, useTabListState } from 'react-stately';
import { styled } from 'storybook/theming';

export interface TabProps {
  id: string;
  'aria-label'?: string;
  title: FC | ReactNode | string;
  children?: FC | ReactNode;
  isDisabled?: boolean;
}

export interface useAriaTabListStateProps {
  defaultSelected?: string;
  selected?: string;
  onSelectionChange?: (key: string) => void;
  tabs: TabProps[];
}

export const useAriaTabListState = ({
  defaultSelected,
  onSelectionChange,
  selected,
  tabs,
}: useAriaTabListStateProps): TabListState<object> => {
  return useTabListState({
    children: tabs.map(({ children: Children, id, 'aria-label': ariaLabel, title: Title }) => (
      <Item key={id} aria-label={ariaLabel} title={typeof Title === 'function' ? <Title /> : Title}>
        {typeof Children === 'function' ? <Children /> : Children}
      </Item>
    )),
    disabledKeys: tabs.filter(({ isDisabled }) => isDisabled).map(({ id }) => id),
    defaultSelectedKey: defaultSelected,
    onSelectionChange: (key) => onSelectionChange?.(`${key}`),
    selectedKey: selected,
  });
};

export const Container = styled.div({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
});

export const FlexTabPanel = styled(AriaTabPanel)(() => ({
  flex: 1,
}));

export interface AriaTabsProps extends HTMLAttributes<HTMLDivElement> {
  /** List of tabs and their associated panel. */
  tabs: TabProps[];

  /** ID of the tab that should be selected on first render. */
  defaultSelected?: string;

  /** ID of the current tab if in controlled rendering mode. */
  selected?: string;

  /** Called when the selected tab changes, use if you want to control the component state. */
  onSelectionChange?: (key: string) => void;

  /**
   * Optional tools to avoid rendering two toolbars in a layout.
   *
   * @warning Only use this if the tools act upon the entire layout,
   * not upon a single tab panel. If you want to edit which tools are
   * visible based on the current tab, then you musn't use `tools` and
   * should handle your own toolbar inside the tabpanel instead.
   */
  tools?: ReactElement;

  /** Background color for the bar containing the tabs and tools. */
  backgroundColor?: string;

  /** Style properties for the inner layout container in the bar containing the tabs and tools. */
  barInnerStyle?: React.CSSProperties;

  /** Show tools instead of the empty state if there are no tabs. */
  showToolsWhenEmpty?: boolean;

  /** Custom UI for the empty state shown when there are no tabs. */
  emptyState?: ReactNode;

  /** Optional ID. */
  id?: string;

  /** Props to pass to the AriaTabPanel component. */
  panelProps?: Omit<ComponentProps<typeof AriaTabPanel>, 'state'>;
}

export const AriaTabs: FC<AriaTabsProps> = ({
  backgroundColor,
  barInnerStyle,
  defaultSelected,
  emptyState,
  onSelectionChange,
  panelProps = {},
  selected,
  showToolsWhenEmpty,
  tabs,
  tools,
  ...props
}) => {
  const state = useAriaTabListState({ defaultSelected, onSelectionChange, selected, tabs });

  const EmptyContent = emptyState ?? <EmptyTabContent title="Nothing found" />;

  if (!showToolsWhenEmpty && tabs.length === 0) {
    return EmptyContent;
  }

  return (
    <Container {...props}>
      <Bar
        {...props}
        scrollable={true}
        border
        backgroundColor={backgroundColor}
        innerStyle={{
          display: 'flex',
          justifyContent: 'space-between',
          paddingInlineStart: 0,
          paddingInlineEnd: 10,
          // A11y: the tools must be before the tab list in the DOM for correct tab order.
          // This lets us control order without adding a wrapper div, leading to better flex
          // behavior on tools for our callees (e.g. containerType: 'inline-size' in a11y-addon).
          '> *:not(:last-child)': {
            order: 2,
          },
          ...barInnerStyle,
        }}
      >
        {tools}
        <AriaTabList state={state} />
      </Bar>
      <FlexTabPanel state={state} {...panelProps} />
    </Container>
  );
};
