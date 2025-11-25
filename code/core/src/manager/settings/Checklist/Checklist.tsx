import React, { useMemo } from 'react';

import { ActionList, Button, Collapsible } from 'storybook/internal/components';

import {
  CheckIcon,
  ChevronSmallDownIcon,
  LockIcon,
  StatusPassIcon,
  UndoIcon,
} from '@storybook/icons';

import { useStorybookApi } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import { Focus } from '../../components/Focus/Focus';
import type { ChecklistItem, useChecklist } from '../../components/sidebar/useChecklist';
import { useLocationHash } from '../../components/useLocationHash';

type ChecklistSection = {
  id: string;
  title: string;
  itemIds: string[];
  progress: number;
};

const Sections = styled.ol(({ theme }) => ({
  listStyle: 'none',
  display: 'flex',
  flexDirection: 'column',
  gap: 20,
  margin: 0,
  padding: 0,

  '& > li': {
    background: theme.background.content,
    border: `1px solid ${theme.base === 'dark' ? theme.color.darker : theme.color.border}`,
    borderRadius: 8,
  },
}));

const Items = styled.ol(({ theme }) => ({
  listStyle: 'none',
  display: 'flex',
  flexDirection: 'column',
  margin: 0,
  padding: 0,

  '& > li:not(:last-child)': {
    boxShadow: `inset 0 -1px 0 ${theme.base === 'dark' ? theme.color.darker : theme.color.border}`,
  },

  '& > li:last-child': {
    borderBottomLeftRadius: 7,
    borderBottomRightRadius: 7,
  },
}));

const SectionSummary = styled.div<{ progress: number; isCollapsed: boolean }>(
  ({ theme, progress, isCollapsed, onClick }) => ({
    position: 'relative',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 10px 10px 15px',
    borderBottom: `5px solid ${theme.base === 'dark' ? theme.color.darker : theme.color.light}`,
    borderBottomLeftRadius: isCollapsed ? 7 : 0,
    borderBottomRightRadius: isCollapsed ? 7 : 0,
    transition: 'border-radius var(--transition-duration, 0.2s)',
    cursor: onClick ? 'pointer' : 'default',
    '--toggle-button-rotate': isCollapsed ? '0deg' : '180deg',
    '--toggle-button-opacity': 0,

    '&:hover, &:focus-visible': {
      outline: 'none',
      '--toggle-button-opacity': 1,
    },

    '&::after': {
      pointerEvents: 'none',
      position: 'absolute',
      top: 0,
      bottom: -5,
      left: 0,
      right: 0,
      content: '""',
      display: 'block',
      width: `${progress}%`,
      borderBottom: `5px solid ${theme.color.positive}`,
      borderBottomLeftRadius: 'inherit',
      borderBottomRightRadius: progress === 100 ? 'inherit' : 0,
      transition: 'width var(--transition-duration, 0.2s)',
    },
  })
);

const SectionHeading = styled.h2(({ theme }) => ({
  flex: 1,
  margin: 0,
  fontSize: theme.typography.size.s3,
  fontWeight: theme.typography.weight.bold,
}));

const ItemSummary = styled.div<{ isCollapsed: boolean; onClick?: () => void }>(
  ({ theme, isCollapsed, onClick }) => ({
    fontWeight: theme.typography.weight.regular,
    fontSize: theme.typography.size.s2,
    display: 'flex',
    alignItems: 'center',
    minHeight: 40,
    gap: 10,
    padding: isCollapsed ? '6px 10px 6px 15px' : '10px 10px 10px 15px',
    transition: 'padding var(--transition-duration, 0.2s)',
    cursor: onClick ? 'pointer' : 'default',
    '--toggle-button-rotate': isCollapsed ? '0deg' : '180deg',

    '&:focus-visible': {
      outline: 'none',
    },
  })
);

const ItemHeading = styled.h3<{ skipped: boolean }>(({ theme, skipped }) => ({
  flex: 1,
  margin: 0,
  color: skipped ? theme.textMutedColor : theme.color.defaultText,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: theme.typography.size.s2,
  fontWeight: theme.typography.weight.bold,
}));

const ItemContent = styled.div(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 8,
  padding: '0 15px 15px 41px',
  fontSize: theme.typography.size.s2,

  code: {
    fontSize: '0.9em',
    backgroundColor: theme.background.app,
    borderRadius: theme.appBorderRadius,
    padding: '1px 3px',
  },
  img: {
    maxWidth: '100%',
    margin: '15px auto',
  },
  p: {
    margin: 0,
    lineHeight: 1.4,
  },
  'ol, ul': {
    paddingLeft: 25,
    listStyleType: 'disc',

    'li::marker': {
      color: theme.color.mediumdark,
    },
  },
}));

const StatusIcon = styled.div(({ theme }) => ({
  position: 'relative',
  flex: '0 0 auto',
  minHeight: 16,
  minWidth: 16,
  margin: 0,
  background: theme.base === 'dark' ? theme.color.darkest : theme.background.app,
  borderRadius: 9,
  outline: `1px solid ${theme.base === 'dark' ? theme.color.darker : theme.color.border}`,
  outlineOffset: -1,
}));
const Checked = styled(StatusPassIcon)<{ 'data-visible'?: boolean }>(
  ({ theme, 'data-visible': visible }) => ({
    position: 'absolute',
    width: 'inherit',
    height: 'inherit',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    padding: 1,
    borderRadius: '50%',
    background: theme.color.positive,
    color: theme.background.content,
    opacity: visible ? 1 : 0,
    transform: visible ? 'scale(1)' : 'scale(0.7)',
    transition: 'all var(--transition-duration, 0.2s)',
  })
);
const Skipped = styled.span<{ visible?: boolean }>(({ theme, visible }) => ({
  display: 'flex',
  alignItems: 'center',
  color: theme.textMutedColor,
  fontSize: '12px',
  fontWeight: 'bold',
  overflow: 'hidden',
  padding: visible ? '0 10px' : 0,
  opacity: visible ? 1 : 0,
  width: visible ? 'auto' : 0,
  height: visible ? 18 : 16,
  transition: 'all var(--transition-duration, 0.2s)',
}));

const Actions = styled.div({
  alignSelf: 'flex-end',
  flexDirection: 'row-reverse',
  display: 'flex',
  gap: 4,
});

const ToggleButton = styled(Button)({
  opacity: 'var(--toggle-button-opacity)',
  transition: 'opacity var(--transition-duration, 0.2s)',

  '&:hover, &:focus': {
    opacity: 1,
  },

  svg: {
    transform: 'rotate(var(--toggle-button-rotate))',
    transition: 'transform var(--transition-duration, 0.2s)',
  },
});

export const Checklist = ({
  availableItems,
  accept,
  skip,
  reset,
}: Pick<ReturnType<typeof useChecklist>, 'availableItems' | 'accept' | 'skip' | 'reset'>) => {
  const api = useStorybookApi();
  const locationHash = useLocationHash();

  const { itemsById, sectionsById } = useMemo(
    () =>
      availableItems.reduce<{
        itemsById: Record<string, ChecklistItem>;
        sectionsById: Record<string, ChecklistSection>;
      }>(
        (acc, item) => {
          acc.itemsById[item.id] = item;
          const { sectionId: id, sectionTitle: title } = item;
          acc.sectionsById[id] = acc.sectionsById[id] ?? { id, title, itemIds: [] };
          acc.sectionsById[id].itemIds.push(item.id);
          return acc;
        },
        { itemsById: {}, sectionsById: {} }
      ),
    [availableItems]
  );

  const sections = useMemo(
    () =>
      Object.values(sectionsById).map(({ id, title, itemIds }) => {
        const items = itemIds.map<ChecklistItem>((id) => itemsById[id]);
        const progress =
          (items.reduce((acc, item) => (item.isOpen ? acc : acc + 1), 0) / items.length) * 100;
        return { id, title, items, progress };
      }),
    [itemsById, sectionsById]
  );

  return (
    <Sections>
      {sections.map(({ id, title, items, progress }) => {
        const collapsed = progress === 100 && items.every((item) => item.id !== locationHash);

        return (
          <li key={id}>
            <Focus.Proxy targetId={`toggle-${id}`}>
              <Collapsible
                collapsed={collapsed}
                summary={({ isCollapsed, toggleCollapsed, toggleProps }) => (
                  <SectionSummary
                    progress={progress}
                    isCollapsed={isCollapsed}
                    onClick={toggleCollapsed}
                  >
                    <StatusIcon>
                      <Checked data-visible={progress === 100} />
                    </StatusIcon>
                    <SectionHeading>{title}</SectionHeading>
                    <Actions>
                      <ToggleButton
                        {...toggleProps}
                        data-target-id={`toggle-${id}`}
                        variant="ghost"
                        padding="small"
                        aria-label={title}
                      >
                        <ChevronSmallDownIcon />
                      </ToggleButton>
                    </Actions>
                  </SectionSummary>
                )}
              >
                <Items>
                  {items.map(
                    ({
                      content,
                      isOpen,
                      isAccepted,
                      isDone,
                      isLockedBy,
                      isImmutable,
                      isSkipped,
                      ...item
                    }) => {
                      const isChecked = isAccepted || isDone;
                      const isCollapsed = item.id !== locationHash;
                      const isLocked = !!isLockedBy;
                      const itemContent = content?.({ api });

                      return (
                        <ActionList.Item key={item.id}>
                          <Focus.Target
                            targetHash={item.id}
                            highlightDuration={2000}
                            outlineOffset={-2}
                          >
                            <Focus.Proxy targetId={`toggle-${item.id}`} outlineOffset={-2}>
                              <Collapsible
                                collapsed={isCollapsed}
                                summary={({ isCollapsed, toggleCollapsed, toggleProps }) => (
                                  <ItemSummary
                                    isCollapsed={isCollapsed || !itemContent}
                                    onClick={itemContent ? toggleCollapsed : undefined}
                                  >
                                    <StatusIcon>
                                      <Checked data-visible={isChecked} />
                                      <Skipped visible={isSkipped}>Skipped</Skipped>
                                    </StatusIcon>
                                    <ItemHeading skipped={isSkipped}>{item.label}</ItemHeading>
                                    <Actions>
                                      {itemContent && (
                                        <ToggleButton
                                          {...toggleProps}
                                          data-target-id={`toggle-${item.id}`}
                                          variant="ghost"
                                          padding="small"
                                          ariaLabel={`${isCollapsed ? 'Expand' : 'Collapse'} ${item.label}`}
                                        >
                                          <ChevronSmallDownIcon />
                                        </ToggleButton>
                                      )}
                                      {isLocked && (
                                        <Button
                                          variant="ghost"
                                          padding="small"
                                          ariaLabel="Locked"
                                          tooltip={`Complete “${itemsById[isLockedBy].label}” first`}
                                          disabled
                                          readOnly
                                        >
                                          <LockIcon />
                                        </Button>
                                      )}
                                      {isOpen && !isLocked && item.action && (
                                        <Button
                                          ariaLabel={false}
                                          variant="solid"
                                          size="small"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            item.action?.onClick({
                                              api,
                                              accept: () => accept(item.id),
                                            });
                                          }}
                                        >
                                          {item.action.label}
                                        </Button>
                                      )}
                                      {isOpen && !isLocked && !item.action && !item.subscribe && (
                                        <Button
                                          ariaLabel={false}
                                          variant="outline"
                                          size="small"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            accept(item.id);
                                          }}
                                        >
                                          <CheckIcon />
                                          Mark as complete
                                        </Button>
                                      )}
                                      {isOpen && !isLocked && (
                                        <Button
                                          ariaLabel={false}
                                          variant="ghost"
                                          size="small"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            skip(item.id);
                                          }}
                                        >
                                          Skip
                                        </Button>
                                      )}
                                      {((isAccepted && !isImmutable) || isSkipped) && !isLocked && (
                                        <Button
                                          ariaLabel="Undo"
                                          variant="ghost"
                                          padding="small"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            reset(item.id);
                                          }}
                                        >
                                          <UndoIcon />
                                        </Button>
                                      )}
                                    </Actions>
                                  </ItemSummary>
                                )}
                              >
                                {itemContent && <ItemContent>{itemContent}</ItemContent>}
                              </Collapsible>
                            </Focus.Proxy>
                          </Focus.Target>
                        </ActionList.Item>
                      );
                    }
                  )}
                </Items>
              </Collapsible>
            </Focus.Proxy>
          </li>
        );
      })}
    </Sections>
  );
};
