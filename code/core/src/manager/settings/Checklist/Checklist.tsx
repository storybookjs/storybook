import React, { createRef, useMemo } from 'react';

import {
  Button,
  Collapsible,
  FocusProxy,
  FocusTarget,
  ListboxItem,
  TooltipNote,
  WithTooltip,
  useLocationHash,
} from 'storybook/internal/components';

import {
  CheckIcon,
  ChevronSmallDownIcon,
  LockIcon,
  StatusPassIcon,
  UndoIcon,
} from '@storybook/icons';

import { type API, useStorybookApi } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import type { useChecklist } from '../../components/sidebar/useChecklist';

export interface ChecklistData {
  sections: {
    id: string;
    title: string;
    items: {
      id: string;
      label: string;
      after?: string[];
      content?: React.ReactNode;
      action?: {
        label: string;
        onClick: (args: { api: API }) => void;
      };
      predicate?: (args: { api: API; complete: () => void }) => void;
    }[];
  }[];
}

type ChecklistSection = Omit<ChecklistData['sections'][number], 'items'> & {
  itemIds: string[];
  progress: number;
};
type ChecklistItem = ChecklistData['sections'][number]['items'][number] & {
  isCompleted: boolean;
  isLockedBy: string[];
  isSkipped: boolean;
  nodeRef?: React.RefObject<HTMLLIElement>;
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
    border: `1px solid ${theme.color.border}`,
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
    boxShadow: `inset 0 -1px 0 ${theme.color.border}`,
  },

  '& > li:last-child': {
    borderBottomLeftRadius: 7,
    borderBottomRightRadius: 7,
  },
}));

const SectionSummary = styled.div<{ progress: number; isCollapsed: boolean }>(
  ({ theme, progress, isCollapsed }) => ({
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
    '--toggle-button-rotate': isCollapsed ? '0deg' : '180deg',
    '--toggle-button-opacity': 0,

    '&:hover, &:focus-visible': {
      outline: 'none',
      '--toggle-button-opacity': 1,
    },

    h3: {
      flex: 1,
      margin: 0,
      fontSize: 'inherit',
      fontWeight: theme.typography.weight.bold,
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

const SectionHeading = styled.h3({
  cursor: 'default',
});

const ItemSummary = styled.div<{ isCollapsed: boolean }>(({ theme, isCollapsed }) => ({
  fontWeight: theme.typography.weight.regular,
  fontSize: theme.typography.size.s2,
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: isCollapsed ? '6px 10px 6px 15px' : '10px 10px 10px 15px',
  transition: 'padding var(--transition-duration, 0.2s)',
  '--toggle-button-rotate': isCollapsed ? '0deg' : '180deg',

  '&:focus-visible': {
    outline: 'none',
  },

  h4: {
    flex: 1,
    margin: 0,
    fontSize: 'inherit',
  },
}));

const ItemHeading = styled.h4<{ skipped: boolean }>(({ theme, skipped }) => ({
  color: skipped ? theme.color.mediumdark : theme.color.defaultText,
  cursor: 'default',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: theme.typography.size.s2,
}));

const ItemContent = styled.div(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 8,
  padding: '0 15px 15px 15px',
  fontSize: theme.typography.size.s2,

  p: {
    margin: 0,
    lineHeight: 1.4,
  },
}));

const StatusIcon = styled.div(({ theme }) => ({
  position: 'relative',
  flex: '0 0 auto',
  minHeight: 16,
  minWidth: 16,
  margin: 0,
  background: theme.background.app,
  borderRadius: 9,
  outline: `1px solid ${theme.color.border}`,
  outlineOffset: -1,
}));
const Checked = styled(StatusPassIcon)<{ visible: boolean }>(({ theme, visible }) => ({
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
}));
const Skipped = styled.span<{ visible: boolean }>(({ theme, visible }) => ({
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
  transition: 'all var(--transition-duration, 0.2s)',

  '&:hover, &:focus': {
    opacity: 1,
  },

  svg: {
    transform: 'rotate(var(--toggle-button-rotate))',
    transition: 'transform var(--transition-duration, 0.2s)',
  },
});

export const Checklist = ({
  sections,
  completed,
  skipped,
  complete,
  skip,
  reset,
}: Pick<
  ReturnType<typeof useChecklist>,
  'sections' | 'completed' | 'skipped' | 'complete' | 'skip' | 'reset'
>) => {
  const api = useStorybookApi();
  const locationHash = useLocationHash();

  const sectionsById: Record<ChecklistSection['id'], ChecklistSection> = useMemo(() => {
    const isDone = (id: string) => completed.includes(id) || skipped.includes(id);
    return Object.fromEntries(
      sections.map(({ items, ...section }) => {
        const progress =
          (items.reduce((a, b) => (isDone(b.id) ? a + 1 : a), 0) / items.length) * 100;
        const itemIds = items.map(({ id }) => id);
        return [section.id, { ...section, itemIds, progress }];
      })
    );
  }, [sections, completed, skipped]);

  const itemsById: Record<ChecklistItem['id'], ChecklistItem> = useMemo(
    () =>
      Object.fromEntries(
        sections.flatMap(({ items, id }) => {
          const { progress } = sectionsById[id];
          return items.map((item) => {
            const isCompleted = progress === 100 || completed.includes(item.id);
            const isLockedBy = item.after?.filter((id) => !completed.includes(id)) ?? [];
            const isSkipped = skipped.includes(item.id);
            const nodeRef = createRef<HTMLLIElement>();
            return [item.id, { ...item, isCompleted, isLockedBy, isSkipped, nodeRef }];
          });
        })
      ),
    [sections, sectionsById, completed, skipped]
  );

  const next = Object.values(sections).findIndex(({ items }) =>
    items.some((item) => !completed.includes(item.id) && !skipped.includes(item.id))
  );

  return (
    <Sections>
      {sections.map(({ id }, index) => {
        const { title, itemIds, progress } = sectionsById[id];
        const hasTarget = itemIds.some((id) => id === locationHash);
        const collapsed = !hasTarget && (progress === 0 || progress === 100) && next !== index;

        return (
          <li key={id}>
            <FocusProxy targetId={`toggle-${id}`}>
              <Collapsible
                collapsed={collapsed}
                summary={({ isCollapsed, toggleCollapsed, toggleProps }) => (
                  <SectionSummary
                    progress={progress}
                    isCollapsed={isCollapsed}
                    onClick={toggleCollapsed}
                  >
                    <StatusIcon>
                      <Checked visible={progress === 100} />
                    </StatusIcon>
                    <SectionHeading>{title}</SectionHeading>
                    <Actions>
                      <ToggleButton
                        {...toggleProps}
                        id={`toggle-${id}`}
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
                  {itemIds.map((itemId) => {
                    const { isCompleted, isLockedBy, isSkipped, ...item } = itemsById[itemId];
                    const isCollapsed = isCompleted && itemId !== locationHash;
                    const isLocked = isLockedBy.length > 0;

                    return (
                      <ListboxItem key={item.id}>
                        <FocusTarget
                          targetHash={item.id}
                          highlightDuration={2000}
                          outlineOffset={-2}
                        >
                          <FocusProxy targetId={`toggle-${item.id}`} outlineOffset={-2}>
                            <Collapsible
                              collapsed={isCollapsed}
                              summary={({ isCollapsed, toggleCollapsed, toggleProps }) => (
                                <ItemSummary
                                  isCollapsed={isCollapsed || !item.content}
                                  onClick={toggleCollapsed}
                                >
                                  <StatusIcon>
                                    <Checked visible={isCompleted && !isSkipped} />
                                    <Skipped visible={isSkipped}>Skipped</Skipped>
                                  </StatusIcon>
                                  <ItemHeading skipped={isSkipped}>{item.label}</ItemHeading>
                                  <Actions>
                                    {item.content && (
                                      <ToggleButton
                                        {...toggleProps}
                                        id={`toggle-${item.id}`}
                                        variant="ghost"
                                        padding="small"
                                        aria-label={item.label}
                                      >
                                        <ChevronSmallDownIcon />
                                      </ToggleButton>
                                    )}
                                    {isLocked && (
                                      <WithTooltip
                                        as="div"
                                        hasChrome={false}
                                        placement="top"
                                        trigger="hover"
                                        tooltip={
                                          <TooltipNote
                                            note={`Complete ${isLockedBy.map((id) => `“${itemsById[id].label}”`).join(', ')} first`}
                                          />
                                        }
                                      >
                                        <Button variant="ghost" padding="small" aria-label="Locked">
                                          <LockIcon />
                                        </Button>
                                      </WithTooltip>
                                    )}
                                    {!isCompleted && !isSkipped && !isLocked && item.action && (
                                      <Button
                                        variant="solid"
                                        size="small"
                                        onClick={() => {
                                          complete(item.id);
                                          item.action?.onClick({ api });
                                        }}
                                      >
                                        {item.action.label}
                                      </Button>
                                    )}
                                    {!isCompleted &&
                                      !isSkipped &&
                                      !isLocked &&
                                      !item.action &&
                                      !item.predicate && (
                                        <Button
                                          variant="outline"
                                          size="small"
                                          onClick={() => complete(item.id)}
                                        >
                                          <CheckIcon />
                                          Mark as complete
                                        </Button>
                                      )}
                                    {!isCompleted && !isSkipped && !isLocked && (
                                      <Button
                                        variant="ghost"
                                        size="small"
                                        onClick={() => skip(item.id)}
                                        aria-label="Skip"
                                      >
                                        Skip
                                      </Button>
                                    )}
                                    {(isCompleted || isSkipped) && !isLocked && (
                                      <Button
                                        variant="ghost"
                                        padding="small"
                                        onClick={() => reset(item.id)}
                                        aria-label="Undo"
                                      >
                                        <UndoIcon />
                                      </Button>
                                    )}
                                  </Actions>
                                </ItemSummary>
                              )}
                            >
                              {item.content && <ItemContent>{item.content}</ItemContent>}
                            </Collapsible>
                          </FocusProxy>
                        </FocusTarget>
                      </ListboxItem>
                    );
                  })}
                </Items>
              </Collapsible>
            </FocusProxy>
          </li>
        );
      })}
    </Sections>
  );
};
