import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { STORY_RENDER_PHASE_CHANGED } from 'storybook/internal/core-events';

import { PopoverProvider, TooltipLinkList } from 'storybook/internal/components';
import { ChevronLeftIcon, ChevronRightIcon, InfoIcon, ShareAltIcon } from '@storybook/icons';

import type { API } from 'storybook/manager-api';

import type { NormalLink } from '../components/components/tooltip/TooltipLinkList.tsx';
import { getPreviewIframeId } from '../manager/components/preview/FramesRenderer.tsx';
import {
  HIGHLIGHT,
  HIGHLIGHT_MENU,
  HIGHLIGHT_MENU_CLICK,
  HIGHLIGHT_MENU_INTERACTION,
  REMOVE_HIGHLIGHT,
  RESET_HIGHLIGHT,
} from './constants.ts';
import type { IconName } from './icons.ts';
import { HighlightRegistry } from './registry.ts';
import type { HighlightMenuInteraction, HighlightMenuState, HighlightMenuTarget } from './types.ts';
import { filterMenuGroups } from './utils.ts';
import { parseHighlightMenuState } from './validation.ts';

const MENU_OFFSET = 15;

type OpenMenuState = Extract<HighlightMenuState, { open: true }>;

/** An open menu and the preview frame it belongs to. */
type OpenMenu = { refId?: string; state: OpenMenuState };

const iconByName: Record<IconName, React.ReactNode> = {
  chevronLeft: <ChevronLeftIcon />,
  chevronRight: <ChevronRightIcon />,
  info: <InfoIcon />,
  shareAlt: <ShareAltIcon />,
};

/**
 * Convert coordinates from the preview iframe's viewport space to the manager's viewport space,
 * accounting for the iframe's position and any scaling applied to it (e.g. custom viewports).
 */
const previewToManagerCoords = (coords: { x: number; y: number }, iframe: HTMLIFrameElement) => {
  const rect = iframe.getBoundingClientRect();
  return {
    x: rect.left + coords.x * (rect.width / (iframe.clientWidth || 1)),
    y: rect.top + coords.y * (rect.height / (iframe.clientHeight || 1)),
  };
};

const getPreviewIframe = (api: API, refId?: string) => {
  const refs = api.getRefs();
  if (refId && !refs[refId]) {
    return undefined;
  }

  const iframe = document.getElementById(
    getPreviewIframeId(refId, refs)
  ) as HTMLIFrameElement | null;
  if (!iframe) {
    return undefined;
  }

  const { width, height } = iframe.getBoundingClientRect();
  return width > 0 && height > 0 ? iframe : undefined;
};

export const buildMenuLinks = ({
  state,
  refId,
  registry,
  onInteraction,
  onMenuClick,
}: {
  state: OpenMenuState;
  refId?: string;
  registry: HighlightRegistry;
  onInteraction: (interaction: HighlightMenuInteraction) => void;
  onMenuClick: (target: HighlightMenuTarget, itemId: string) => void;
}): NormalLink[][] => {
  const { targets, selected } = state;
  const selectedTarget = targets.find(({ key }) => key === selected);
  const elementList = selectedTarget ? [selectedTarget] : targets;

  const elementLinks = elementList.map<NormalLink>((target) => {
    const menuGroups = filterMenuGroups(
      registry.find(target.id, refId)?.menu,
      target.details.selectors
    );
    const selectable = elementList.length > 1 && !!menuGroups?.length;
    const isSelected = !!selectedTarget;

    return {
      id: `target-${target.key}`,
      title: <code>{target.label}</code>,
      icon: isSelected ? iconByName.chevronLeft : undefined,
      right: selectable ? iconByName.chevronRight : undefined,
      onClick: selectable
        ? () => onInteraction({ action: 'select', key: target.key })
        : isSelected
          ? () => onInteraction({ action: 'deselect' })
          : undefined,
      onMouseEnter: selectable
        ? () => onInteraction({ action: 'focus', key: target.key })
        : undefined,
      onMouseLeave: selectable ? () => onInteraction({ action: 'blur' }) : undefined,
      as: selectable || isSelected ? undefined : 'div',
    };
  });

  const menuTarget = selectedTarget ?? (targets.length === 1 ? targets[0] : undefined);
  const menuGroups = menuTarget
    ? filterMenuGroups(registry.find(menuTarget.id, refId)?.menu, menuTarget.details.selectors)
    : undefined;
  const menuLinks = (menuGroups ?? []).map((items) =>
    items.map<NormalLink>(({ id, title, description, iconLeft, iconRight, clickable }) => {
      const onClick = clickable ? () => onMenuClick(menuTarget!, id) : undefined;
      return {
        id: `${menuTarget!.id}-${id}`,
        title,
        center: description,
        icon: iconLeft ? iconByName[iconLeft] : undefined,
        right: iconRight ? iconByName[iconRight] : undefined,
        onClick,
        as: onClick ? undefined : 'div',
      };
    })
  );

  const groups = [elementLinks, ...menuLinks].filter((group) => group.length);
  const firstInteractive = groups.flat().find((link) => !!link.onClick);
  if (firstInteractive) {
    firstInteractive.autoFocus = true;
  }
  return groups;
};

/**
 * Subscribe to the preview's menu state and the manager-side highlight registry. The menu content
 * is resolved from the registry, never from the preview's payload, and invalid runtime payloads are
 * ignored.
 */
export const useHighlightMenu = (api: API) => {
  const channel = api.getChannel();
  const registry = useMemo(() => new HighlightRegistry(), []);
  const [menu, setMenu] = useState<OpenMenu | undefined>();
  const [registryVersion, setRegistryVersion] = useState(0);

  useEffect(
    () => registry.subscribe(() => setRegistryVersion((version) => version + 1)),
    [registry]
  );

  useEffect(() => {
    if (!channel) {
      return;
    }

    const onAddHighlight = function (
      this: { refId?: string; source?: string },
      highlight: unknown
    ) {
      registry.add(this, highlight);
    };
    const onRemoveHighlight = function (this: { refId?: string; source?: string }, id: unknown) {
      registry.remove(this, id);
    };
    const onResetHighlights = function (this: { refId?: string; source?: string }) {
      registry.reset(this);
    };
    const onStoryRenderPhaseChanged = function (
      this: { refId?: string },
      payload?: { newPhase?: string }
    ) {
      if (payload?.newPhase === 'loading') {
        const { refId } = this;
        registry.clearFrame(refId);
        // Only the frame the menu belongs to can close it. Hidden frames stay mounted and keep
        // sending events, which must not close a menu that is open over another frame.
        setMenu((current) => (current?.refId === refId ? undefined : current));
      }
    };
    const onMenuState = function (this: { refId?: string }, payload: unknown) {
      const parsed = parseHighlightMenuState(payload);
      if (!parsed) {
        return;
      }
      const { refId } = this;
      if (parsed.open) {
        setMenu({ refId, state: parsed });
      } else {
        setMenu((current) => (current?.refId === refId ? undefined : current));
      }
    };

    channel.on(HIGHLIGHT, onAddHighlight);
    channel.on(REMOVE_HIGHLIGHT, onRemoveHighlight);
    channel.on(RESET_HIGHLIGHT, onResetHighlights);
    channel.on(STORY_RENDER_PHASE_CHANGED, onStoryRenderPhaseChanged);
    channel.on(HIGHLIGHT_MENU, onMenuState);

    return () => {
      channel.off(HIGHLIGHT, onAddHighlight);
      channel.off(REMOVE_HIGHLIGHT, onRemoveHighlight);
      channel.off(RESET_HIGHLIGHT, onResetHighlights);
      channel.off(STORY_RENDER_PHASE_CHANGED, onStoryRenderPhaseChanged);
      channel.off(HIGHLIGHT_MENU, onMenuState);
    };
  }, [channel, registry]);

  const emitInteraction = useCallback(
    (interaction: HighlightMenuInteraction) => {
      api.emit(HIGHLIGHT_MENU_INTERACTION, {
        ...interaction,
        options: { target: menu?.refId ?? 'storybook_internal' },
      });
    },
    [api, menu?.refId]
  );

  const emitMenuClick = useCallback(
    (target: HighlightMenuTarget, itemId: string) => {
      api.emit(HIGHLIGHT_MENU_CLICK, target.id, itemId, target.details);
    },
    [api]
  );

  const onVisibleChange = useCallback(
    (visible: boolean) => {
      if (!visible) {
        emitInteraction({ action: 'close' });
      }
    },
    [emitInteraction]
  );

  const iframe = menu ? getPreviewIframe(api, menu.refId) : undefined;
  const anchor = menu && iframe ? previewToManagerCoords(menu.state.coords, iframe) : undefined;
  const open = !!anchor;
  // `registryVersion` is read so registry updates re-render the menu content.
  void registryVersion;
  const links = menu
    ? buildMenuLinks({
        state: menu.state,
        refId: menu.refId,
        registry,
        onInteraction: emitInteraction,
        onMenuClick: emitMenuClick,
      })
    : [];

  return { open, anchor, iframe, links, onVisibleChange };
};

/**
 * Renders the interactive highlight menu in the manager, positioned over the preview iframe element
 * it belongs to. The preview reports which highlight targets were hit and where; the menu itself is
 * rendered here from a manager-side registry of the `HighlightOptions` payloads the preview
 * announced over the channel, so a malicious site embedding the preview iframe can never inject menu
 * content or trigger the menu (see GHSA-f2ph-cmg5-wxc8).
 */
export const HighlightMenu = ({ api }: { api: API }) => {
  const { open, anchor, iframe, links, onVisibleChange } = useHighlightMenu(api);

  if (!open || !anchor || !iframe) {
    return null;
  }

  return (
    <PopoverProvider
      ariaLabel="Highlight menu"
      placement="bottom"
      offset={MENU_OFFSET}
      boundaryElement={iframe}
      visible={open}
      onVisibleChange={onVisibleChange}
      popover={<TooltipLinkList links={links} />}
      hasChrome
      padding={0}
    >
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        style={{
          position: 'fixed',
          left: anchor.x,
          top: anchor.y,
          width: 1,
          height: 1,
          padding: 0,
          border: 0,
          pointerEvents: 'none',
        }}
      />
    </PopoverProvider>
  );
};
