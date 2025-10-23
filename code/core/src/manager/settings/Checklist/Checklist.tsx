import React, { createRef, useEffect, useMemo, useState } from 'react';

import {
  Button,
  Collapsible,
  FocusProxy,
  ListboxItem,
  TooltipNote,
  WithTooltip,
} from 'storybook/internal/components';

import {
  CheckIcon,
  ChevronSmallDownIcon,
  LockIcon,
  StatusPassIcon,
  UndoIcon,
} from '@storybook/icons';

import { checklistStore, universalChecklistStore } from '#manager-stores';
import { type API, experimental_useUniversalStore, useStorybookApi } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

export interface ChecklistData {
  sections: {
    id: string;
    title: string;
    items: {
      id: string;
      label: string;
      after?: string[];
      start?: (args: { api: API }) => void;
      predicate?: (args: { api: API; complete: () => void }) => void;
      content?: React.ReactNode;
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

const ItemSummary = styled.div<{ isCollapsed: boolean }>(({ isCollapsed }) => ({
  fontWeight: 'normal',
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
}));

const ItemContent = styled.div({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 8,
  padding: '0 15px 15px 15px',

  p: {
    margin: 0,
    lineHeight: 1.4,
  },
});

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

export const Checklist = ({ data }: { data: ChecklistData }) => {
  const api = useStorybookApi();
  const [checklistState] = experimental_useUniversalStore(universalChecklistStore);
  const { completed, skipped } = checklistState;
  const [hash, setHash] = useState(globalThis.window.location.hash ?? '');
  const targetHash = hash.slice(1);

  useEffect(() => {
    const updateHash = () => setHash(globalThis.window.location.hash ?? '');
    const interval = setInterval(updateHash, 100);
    return () => clearInterval(interval);
  }, []);

  // Focus the target element when the hash changes
  useEffect(() => {
    const timeout = setTimeout(() => {
      const target =
        targetHash && globalThis.document.querySelector(`[for="toggle-${targetHash}"]`);
      if (target instanceof HTMLElement) {
        target.focus({ preventScroll: true });
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 200);
    return () => clearTimeout(timeout);
  }, [targetHash]);

  const sectionsById: Record<ChecklistSection['id'], ChecklistSection> = useMemo(() => {
    const isDone = (id: string) => completed.includes(id) || skipped.includes(id);
    return Object.fromEntries(
      data.sections.map(({ items, ...section }) => {
        const progress =
          (items.reduce((a, b) => (isDone(b.id) ? a + 1 : a), 0) / items.length) * 100;
        const itemIds = items.map(({ id }) => id);
        return [section.id, { ...section, itemIds, progress }];
      })
    );
  }, [data, completed, skipped]);

  const itemsById: Record<ChecklistItem['id'], ChecklistItem> = useMemo(
    () =>
      Object.fromEntries(
        data.sections.flatMap(({ items, id }) => {
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
    [data, sectionsById, completed, skipped]
  );

  const next = Object.values(data.sections).findIndex(({ items }) =>
    items.some((item) => !completed.includes(item.id) && !skipped.includes(item.id))
  );

  return (
    <Sections>
      {data.sections.map(({ id }, index) => {
        const { title, itemIds, progress } = sectionsById[id];
        const hasTarget = itemIds.some((id) => id === targetHash);
        const collapsed = !hasTarget && (progress === 0 || progress === 100) && next !== index;

        return (
          <li key={id}>
            <FocusProxy htmlFor={`toggle-${id}`}>
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
                    const isCollapsed = isCompleted && itemId !== targetHash;
                    const isLocked = isLockedBy.length > 0;

                    return (
                      <ListboxItem key={item.id}>
                        <FocusProxy
                          htmlFor={`toggle-${item.id}`}
                          outlineOffset={-2}
                          tabIndex={-1} // Allow focus via target.focus()
                          onMouseDown={(event) => event.preventDefault()} // Prevent focus on click
                        >
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
                                  {!isCompleted && !isSkipped && !isLocked && item.start && (
                                    <Button
                                      variant="solid"
                                      size="small"
                                      onClick={() => {
                                        checklistStore.complete(item.id);
                                        item.start?.({ api });
                                      }}
                                    >
                                      Start
                                    </Button>
                                  )}
                                  {!isCompleted &&
                                    !isSkipped &&
                                    !isLocked &&
                                    !item.start &&
                                    !item.predicate && (
                                      <Button
                                        variant="outline"
                                        size="small"
                                        onClick={() => checklistStore.complete(item.id)}
                                      >
                                        <CheckIcon />
                                        Mark as complete
                                      </Button>
                                    )}
                                  {!isCompleted && !isSkipped && !isLocked && (
                                    <Button
                                      variant="ghost"
                                      size="small"
                                      onClick={() => checklistStore.skip(item.id)}
                                      aria-label="Skip"
                                    >
                                      Skip
                                    </Button>
                                  )}
                                  {(isCompleted || isSkipped) && !isLocked && (
                                    <Button
                                      variant="ghost"
                                      padding="small"
                                      onClick={() => checklistStore.reset(item.id)}
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
