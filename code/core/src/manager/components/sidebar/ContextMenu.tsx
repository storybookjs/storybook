import type { ComponentProps, FC, MouseEvent, ReactElement, SyntheticEvent } from 'react';
import React, { useMemo, useRef, useState } from 'react';

import { PopoverProvider, TooltipLinkList } from 'storybook/internal/components';
import {
  type API_HashEntry,
  type Addon_Collection,
  type Addon_ContextMenuRenderOptions,
  type Addon_ContextMenuType,
  type Addon_TestProviderType,
  Addon_TypesEnum,
  type StatusValue,
} from 'storybook/internal/types';

import { CopyIcon, EditorIcon, EllipsisIcon } from '@storybook/icons';

import { useStorybookApi } from 'storybook/manager-api';
import type { API } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import type { Link } from '../../../components/components/tooltip/TooltipLinkList.tsx';
import { useCopyButton } from '../../../shared/useCopyButton.ts';
import { Shortcut } from '../Shortcut.tsx';
import { StatusButton } from './StatusButton.tsx';
import type { ExcludesNull } from './Tree.tsx';

const empty = {
  onMouseEnter: () => {},
  node: null,
};

const FloatingStatusButton = styled(StatusButton)({
  background: 'var(--tree-node-background-hover)',
  boxShadow: '0 0 5px 5px var(--tree-node-background-hover)',
  position: 'absolute',
  right: 0,
  zIndex: 1,
  '&:focus-visible': {
    outlineOffset: -2,
  },
});

export const useContextMenu = (
  context: API_HashEntry,
  links: Link[],
  api: API,
  visibleStatus?: { icon: ReactElement | null; status: StatusValue } | null
) => {
  const [hoverCount, setHoverCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const exportName = context && 'exportName' in context ? (context.exportName ?? '') : '';
  const { children: copyText, buttonProps: copyButtonProps } = useCopyButton<string>({
    children: 'Copy story name',
    content: exportName,
  });

  const shortcutKeys = api.getShortcutKeys();
  const openInEditorShortcut = shortcutKeys?.openInEditor;

  const topLinks = useMemo<Link[]>(() => {
    const defaultLinks = [];

    if (context && 'importPath' in context && context.importPath) {
      defaultLinks.push({
        id: 'open-in-editor',
        title: 'Open in editor',
        icon: <EditorIcon />,
        right: openInEditorShortcut ? <Shortcut keys={openInEditorShortcut} /> : null,
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
  }, [api, context, copyText, copyButtonProps, openInEditorShortcut]);

  const handlers = useMemo(() => {
    return {
      onMouseEnter: () => {
        setHoverCount((c) => c + 1);
      },
      onOpen: (event: SyntheticEvent) => {
        event.stopPropagation();
        triggerRef.current = event.currentTarget as HTMLButtonElement;
        setIsOpen(true);
      },
      onClose: () => {
        setIsOpen(false);
      },
    };
  }, []);
  /**
   * Calculate the addon-provided links whenever the user mouses over the container. We use an
   * incrementor, instead of a simple boolean to ensure that the links are recalculated
   */
  const addonLinks = useMemo(() => {
    const registeredTestProviders = api.getElements(Addon_TypesEnum.experimental_TEST_PROVIDER);
    const registeredContextMenus = api.getElements(Addon_TypesEnum.experimental_CONTEXT_MENU);

    if (hoverCount) {
      return [
        ...generateTestProviderLinks(registeredTestProviders, context),
        ...generateAddonContextMenuLinks(registeredContextMenus, {
          context,
          triggerRef,
          onHide: handlers.onClose,
        }),
      ];
    }
    return [];
  }, [api, context, hoverCount, handlers]);

  // We just don't want to render the context menu for composed storybook stories
  const shouldRender =
    !context.refId && (addonLinks.length > 0 || links.length > 0 || topLinks.length > 0);

  const buttonStatus = visibleStatus?.status ?? 'status-value:unknown';
  const menuIcon = visibleStatus?.icon ?? <EllipsisIcon />;

  return useMemo(() => {
    // Never show the SidebarContextMenu in production
    if (globalThis.CONFIG_TYPE !== 'DEVELOPMENT') {
      return empty;
    }

    return {
      onMouseEnter: handlers.onMouseEnter,
      node: shouldRender ? (
        <PopoverProvider
          ariaLabel="Context menu"
          placement="bottom-end"
          defaultVisible={false}
          visible={isOpen}
          onVisibleChange={setIsOpen}
          popover={({ onHide }) => (
            <LiveContextMenu
              context={context}
              links={[...topLinks, ...links]}
              triggerRef={triggerRef}
              onHide={onHide}
            />
          )}
          hasChrome={true}
          padding={0}
        >
          <FloatingStatusButton
            data-displayed={isOpen ? 'on' : 'off'}
            data-testid="context-menu"
            ariaLabel="Open context menu"
            type="button"
            status={buttonStatus}
            onClick={handlers.onOpen}
          >
            {menuIcon}
          </FloatingStatusButton>
        </PopoverProvider>
      ) : null,
    };
  }, [context, handlers, isOpen, shouldRender, links, topLinks, buttonStatus, menuIcon]);
};

/**
 * This component re-subscribes to storybook's core state, hence the Live prefix. It is used to
 * render the context menu for the sidebar. it self is a tooltip link list that renders the links
 * provided to it. In addition to the links, it also renders entries contributed by context menu
 * addons and test providers.
 */
const LiveContextMenu: FC<
  { context: API_HashEntry } & Omit<Addon_ContextMenuRenderOptions, 'context'> &
    ComponentProps<typeof TooltipLinkList>
> = ({ context, links, triggerRef, onHide, ...rest }) => {
  const api = useStorybookApi();
  const registeredTestProviders = api.getElements(Addon_TypesEnum.experimental_TEST_PROVIDER);
  const providerLinks: Link[] = generateTestProviderLinks(registeredTestProviders, context);
  const addonLinks: Link[] = generateAddonContextMenuLinks(
    api.getElements(Addon_TypesEnum.experimental_CONTEXT_MENU),
    { context, triggerRef, onHide }
  );

  /**
   * The context menu can take a list of lists of links, so that the links are grouped and separated
   * by a line separator, so we need to make sure that links are contained within arrays (but not
   * more than one level deep)
   */
  const groups: Link[][] =
    Array.isArray(links[0]) || links.length === 0 ? (links as Link[][]) : [links as Link[]];

  const all = groups.concat([addonLinks], [providerLinks]);

  return <TooltipLinkList {...rest} links={all} />;
};

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

export function generateAddonContextMenuLinks(
  registeredContextMenus: Addon_Collection<Addon_ContextMenuType>,
  options: Addon_ContextMenuRenderOptions
): Link[] {
  return Object.entries(registeredContextMenus)
    .map(([contextMenuId, addon]) => {
      const content = addon?.render(options);

      if (!content) {
        return null;
      }

      return {
        id: contextMenuId,
        content,
      };
    })
    .filter(Boolean as unknown as ExcludesNull);
}
