import type { ComponentProps, FC, SyntheticEvent } from 'react';
import React, { useMemo, useState } from 'react';

import { TooltipLinkList, WithPopover } from 'storybook/internal/components';
import {
  type API_HashEntry,
  type Addon_Collection,
  type Addon_TestProviderType,
  Addon_TypesEnum,
} from 'storybook/internal/types';

import { CopyIcon, EditorIcon, EllipsisIcon } from '@storybook/icons';

import copy from 'copy-to-clipboard';
import { useStorybookApi } from 'storybook/manager-api';
import type { API } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import type { Link } from '../../../components/components/tooltip/TooltipLinkList';
import { Shortcut } from '../../container/Menu';
import { StatusButton } from './StatusButton';
import type { ExcludesNull } from './Tree';

const empty = {
  onMouseEnter: () => {},
  node: null,
};

const FloatingStatusButton = styled(StatusButton)(({ theme }) => {
  // --tree-node-background-hover, but opaque to avoid layering colors
  const background = theme.base === 'dark' ? '#1b2432' : '#ddebfa';
  return {
    background,
    boxShadow: `0 0 5px 5px ${background}`,
    position: 'absolute',
    right: 0,
    zIndex: 1,
    '&:focus-visible': {
      outlineOffset: -2,
    },
  };
});

export const useContextMenu = (context: API_HashEntry, links: Link[], api: API) => {
  const [hoverCount, setHoverCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [copyText, setCopyText] = React.useState('Copy story name');

  const shortcutKeys = api.getShortcutKeys();
  const enableShortcuts = !!shortcutKeys;

  const topLinks = useMemo<Link[]>(() => {
    const defaultLinks = [];

    if (context && 'importPath' in context) {
      defaultLinks.push({
        id: 'open-in-editor',
        title: 'Open in editor',
        icon: <EditorIcon />,
        right: enableShortcuts ? <Shortcut keys={shortcutKeys.openInEditor} /> : null,
        onClick: (e: SyntheticEvent) => {
          e.preventDefault();
          api.openInEditor({
            file: context.importPath,
          });
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
          copy(context.exportName);
          setCopyText('Copied!');
          setTimeout(() => {
            setCopyText('Copy story name');
          }, 2000);
        },
      });
    }

    return defaultLinks;
  }, [context, copyText, enableShortcuts, shortcutKeys]);

  const handlers = useMemo(() => {
    return {
      onMouseEnter: () => {
        setHoverCount((c) => c + 1);
      },
      onOpen: (event: SyntheticEvent) => {
        event.stopPropagation();
        setIsOpen(true);
      },
      onClose: () => {
        setIsOpen(false);
      },
    };
  }, []);
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

  // We just don't want to render the context menu for composed storybook stories
  const shouldRender =
    !context.refId && (providerLinks.length > 0 || links.length > 0 || topLinks.length > 0);

  return useMemo(() => {
    // Never show the SidebarContextMenu in production
    if (globalThis.CONFIG_TYPE !== 'DEVELOPMENT') {
      return empty;
    }

    return {
      onMouseEnter: handlers.onMouseEnter,
      node: shouldRender ? (
        <WithPopover
          placement="bottom-end"
          defaultVisible={false}
          visible={isOpen}
          onVisibleChange={setIsOpen}
          popover={<LiveContextMenu context={context} links={[...topLinks, ...links]} />}
          hasChrome={true}
          padding={0}
        >
          <FloatingStatusButton
            data-displayed={isOpen ? 'on' : 'off'}
            data-testid="context-menu"
            ariaLabel="Open context menu"
            type="button"
            status="status-value:pending"
            onClick={handlers.onOpen}
          >
            <EllipsisIcon />
          </FloatingStatusButton>
        </WithPopover>
      ) : null,
    };
  }, [context, handlers, isOpen, shouldRender, links, topLinks]);
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
    .filter(Boolean as any as ExcludesNull);
}
