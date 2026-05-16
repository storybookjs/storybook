import type { ComponentProps, FC, SyntheticEvent } from 'react';
import React, { useContext, useMemo, useState } from 'react';

import {
  Button,
  PopoverProvider,
  TooltipLinkList,
  TooltipProvider,
} from 'storybook/internal/components';
import {
  type API_HashEntry,
  type Addon_Collection,
  type Addon_TestProviderType,
  Addon_TypesEnum,
  type StatusValue,
} from 'storybook/internal/types';

import { CopyIcon, EditorIcon, EllipsisIcon } from '@storybook/icons';

import type { API, IndexHash } from 'storybook/manager-api';
import { shortcutToHumanString, useStorybookApi } from 'storybook/manager-api';

import { useCopyButton } from '../../../shared/useCopyButton.ts';
import type { Link } from '../../../components/components/tooltip/TooltipLinkList.tsx';
import { getMostCriticalStatusValue } from '../../utils/status.tsx';

import { Shortcut } from '../Shortcut.tsx';
import { UseSymbol } from './IconSymbols.tsx';
import { ContextMenuButton } from './ContextMenuButton.tsx';
import { StatusContext } from './StatusContext.tsx';

// FIXME/TODO: onMouseEnter is actually a data preloading mechanism for test providers to render custom React nodes.
// It helps with perceived performance as it avoids showing loaders for a short span. Find a way to reinstate this.
// AND: rename it to a more meaningful name.
const empty = {
  onMouseEnter: () => {},
  node: null,
};

export type ContextMenuEntryMethod = 'pointer' | 'keyboard';

export const useContextMenu = (
  context: API_HashEntry,
  // isOpen: boolean,
  // setIsOpen: (open: boolean) => void,
  links: Link[],
  api: API,
  data: IndexHash,
  entryMethod?: ContextMenuEntryMethod
) => {
  const [hoverCount, setHoverCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const { allStatuses, groupDualStatus } = useContext(StatusContext);

  const exportName = context && 'exportName' in context ? (context.exportName ?? '') : '';
  const { children: copyText, buttonProps: copyButtonProps } = useCopyButton<string>({
    children: 'Copy story name',
    content: exportName,
  });

  const shortcutKeys = api.getShortcutKeys();
  const enableShortcuts = !!shortcutKeys;

  // FIXME/TODO: if entryMethod is keyboard, add link to story at top of menu.
  // FIXME/TODO: move all the status link stuff in here.

  const topLinks = useMemo<Link[]>(() => {
    const defaultLinks = [];

    if (context && 'importPath' in context && context.importPath) {
      defaultLinks.push({
        id: 'open-in-editor',
        title: 'Open in editor',
        icon: <EditorIcon />,
        right: enableShortcuts ? <Shortcut keys={shortcutKeys.openInEditor} /> : null,
        onClick: (e: SyntheticEvent) => {
          if (context.importPath) {
            e.preventDefault();
            api.openInEditor({ file: context.importPath });
          }
        },
      });
    }

    if (context.type === 'story') {
      defaultLinks.push({
        id: 'copy-story-name',
        title: copyText,
        icon: <CopyIcon />,
        // TODO: bring this back once we want to add shortcuts for this
        // right:
        //   enableShortcuts && shortcutKeys.copyStoryName ? (
        //     <Shortcut keys={shortcutKeys.copyStoryName} />
        //   ) : null,
        onClick: (e: SyntheticEvent) => {
          e.preventDefault();
          copyButtonProps.onClick(e);
        },
      });
    }

    return defaultLinks;
  }, [api, context, copyText, copyButtonProps, enableShortcuts, shortcutKeys]);

  const handlers = useMemo(() => {
    return {
      onMouseEnter: () => {
        setHoverCount((c) => c + 1);
      },
      onOpen: (event: SyntheticEvent) => {
        event.stopPropagation();
        setIsOpen(true);
      },
      // FIXME/TODO: not called in practice
      onClose: () => {
        setIsOpen(false);
      },
    };
  }, [setIsOpen]);
  /**
   * Calculate the providerLinks whenever the user mouses over the container. We use an incrementor,
   * instead of a simple boolean to ensure that the links are recalculated
   */
  const providerLinks = useMemo(() => {
    const registeredTestProviders = api.getElements(Addon_TypesEnum.experimental_TEST_PROVIDER);

    if (hoverCount) {
      return generateTestProviderLinks(registeredTestProviders, context);
    }
    return [];
  }, [api, context, hoverCount]);

  const shouldRender =
    !context.refId && (providerLinks.length > 0 || links.length > 0 || topLinks.length > 0);

  // FIXME/TODO
  // const isLeafNode = context.type === 'story' || context.type === 'docs';

  // const statuses = useMemo(() => allStatuses?.[item.id] || {}, [allStatuses, item.id]);

  // // Compute status items to go in the ContextMenu.
  // const statusLinks = useMemo<Link[]>(() => {
  //   if (item.type !== 'story' && item.type !== 'docs') {
  //     return [];
  //   }
  //   return Object.entries(statuses || {})
  //     .filter(([, status]) => status.sidebarContextMenu !== false)
  //     .map(([typeId, status]) => ({
  //       id: typeId,
  //       title: status.title,
  //       description: status.description,
  //       'aria-label': `${status.title}: ${StatusLabelsInContextMenu[status.value]}.`,
  //       icon: getStatus(theme, status.value).icon,
  //       onClick: () => {
  //         onSelectStoryId(id);
  //         fullStatusStore.selectStatuses([status]);
  //       },
  //     }));
  // }, [id, item.type, onSelectStoryId, statuses, theme]);

  const itemStatus = useMemo<StatusValue>(() => {
    let status: StatusValue = 'status-value:unknown';
    if (!context) {
      return status;
    }

    // FIXME/TODO: stop the leaf/branch separation.
    // if (isLeafNode) {
    const values = Object.values(allStatuses?.[context.id] || {}).map((s) => s.value);
    status = getMostCriticalStatusValue(values);
    // }

    // if (!isLeafNode) {
    //   // On component/groups we only show non-ellipsis on hover on non-success status colors
    //   const groupValue = groupDualStatus && groupDualStatus[context.id];
    //   status =
    //     groupValue === 'status-value:success' || groupValue === undefined
    //       ? 'status-value:unknown'
    //       : groupValue;
    // }

    return status;
  }, [allStatuses, context]);

  const MenuIcon = useMemo(() => {
    if (itemStatus === 'status-value:error') {
      return (
        <svg key="icon" viewBox="0 0 14 14" width="14" height="14">
          <UseSymbol type="error" />
        </svg>
      );
    }
    if (itemStatus === 'status-value:warning') {
      return (
        <svg key="icon" viewBox="0 0 14 14" width="14" height="14">
          <UseSymbol type="warning" />
        </svg>
      );
    }
    if (itemStatus === 'status-value:success') {
      return (
        <svg key="icon" viewBox="0 0 14 14" width="14" height="14">
          <UseSymbol type="success" />
        </svg>
      );
    }
    return <EllipsisIcon />;
  }, [itemStatus, context.type]);

  // FIXME/TODO if shortcutLabel, then customise the actual button's tooltip!
  const shortcutLabel = useMemo(() => {
    if (!enableShortcuts || !shortcutKeys?.contextMenu) {
      console.log('no tooltip', enableShortcuts, shortcutKeys);
      return null;
    }
    return (
      <>
        Actions <kbd>{shortcutToHumanString(shortcutKeys.contextMenu)}</kbd>
      </>
    );
  }, [enableShortcuts, shortcutKeys]);

  return useMemo(() => {
    // Never show the SidebarContextMenu in production
    if (globalThis.CONFIG_TYPE !== 'DEVELOPMENT') {
      return empty;
    }

    const button = (
      <ContextMenuButton
        tabIndex={-1}
        data-displayed={isOpen ? 'on' : 'off'}
        data-testid="context-menu"
        ariaLabel="Open context menu"
        type="button"
        onClick={handlers.onOpen}
      >
        <EllipsisIcon />
      </ContextMenuButton>
    );

    return {
      onMouseEnter: handlers.onMouseEnter,
      node: shouldRender ? (
        <PopoverProvider
          ariaLabel="Context menu"
          placement="bottom-end"
          defaultVisible={false}
          visible={isOpen}
          onVisibleChange={setIsOpen}
          popover={<LiveContextMenu context={context} links={[...topLinks, ...links]} />}
          hasChrome={true}
          padding={0}
        >
          {button}
        </PopoverProvider>
      ) : null,
    };
  }, [
    context,
    handlers,
    isOpen,
    setIsOpen,
    shouldRender,
    links,
    topLinks,
    itemStatus,
    MenuIcon,
    shortcutLabel,
  ]);
};

/**
 * This component re-subscribes to storybook's core state, hence the Live prefix. It is used to
 * render the context menu for the sidebar. it self is a tooltip link list that renders the links
 * provided to it. In addition to the links, it also renders the test providers.
 */
const LiveContextMenu: FC<{ context: API_HashEntry } & ComponentProps<typeof TooltipLinkList>> = ({
  context,
  links,
  ...rest
}) => {
  const registeredTestProviders = useStorybookApi().getElements(
    Addon_TypesEnum.experimental_TEST_PROVIDER
  );
  const providerLinks: Link[] = generateTestProviderLinks(registeredTestProviders, context);

  /**
   * The context menu can take a list of lists of links, so that the links are grouped and separated
   * by a line separator, so we need to make sure that links are contained within arrays (but not
   * more than one level deep)
   */
  const groups: Link[][] =
    Array.isArray(links[0]) || links.length === 0 ? (links as Link[][]) : [links as Link[]];

  const all = groups.concat([providerLinks]);

  return <TooltipLinkList {...rest} links={all} />;
};

type ExcludesNull = <T>(x: T | null) => x is T;
export function generateTestProviderLinks(
  registeredTestProviders: Addon_Collection<Addon_TestProviderType>,
  context: API_HashEntry
): Link[] {
  return Object.entries(registeredTestProviders)
    .map(([testProviderId, state]) => {
      if (!state) {
        return null;
      }
      const content = state.sidebarContextMenu?.({ context });

      if (!content) {
        return null;
      }

      return {
        id: testProviderId,
        content,
      };
    })
    .filter(Boolean as unknown as ExcludesNull);
}
