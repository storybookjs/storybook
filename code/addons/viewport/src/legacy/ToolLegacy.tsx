import type { ReactNode, FC } from 'react';
import React, { useState, Fragment, useEffect, useRef, memo } from 'react';
import memoize from 'memoizerific';

import { styled, Global } from 'storybook/internal/theming';

import { IconButton, WithTooltip, TooltipLinkList } from 'storybook/internal/components';

import { useStorybookApi, useParameter, useGlobals } from 'storybook/internal/manager-api';
import { GrowIcon, TransferIcon } from '@storybook/icons';
import { registerShortcuts } from '../shortcuts';
import { PARAM_KEY } from '../constants';
import { MINIMAL_VIEWPORTS } from '../defaults';
import type { ViewportMap, ViewportStyles, Styles } from '../types';
import type { ViewportAddonParameter } from './ViewportAddonParameter';

interface ViewportItem {
  id: string;
  title: string;
  styles: Styles;
  type: 'desktop' | 'mobile' | 'tablet' | 'other';
  default?: boolean;
}

const toList = memoize(50)((items: ViewportMap): ViewportItem[] => [
  ...baseViewports,
  ...Object.entries(items).map(([id, { name, ...rest }]) => ({ ...rest, id, title: name })),
]);

const responsiveViewport: ViewportItem = {
  id: 'reset',
  title: 'Reset viewport',
  styles: null,
  type: 'other',
};

const baseViewports: ViewportItem[] = [responsiveViewport];

const toLinks = memoize(50)((
  list: ViewportItem[],
  active: LinkBase,
  updateGlobals,
  close
): Link[] => {
  return list
    .filter((i) => i.id !== responsiveViewport.id || active.id !== i.id)
    .map((i) => {
      return {
        ...i,
        onClick: () => {
          updateGlobals({ viewport: i.id });
          close();
        },
      };
    });
});

interface LinkBase {
  id: string;
  title: string;
  right?: ReactNode;
  type: 'desktop' | 'mobile' | 'tablet' | 'other';
  styles: ViewportStyles | ((s: ViewportStyles) => ViewportStyles) | null;
}

interface Link extends LinkBase {
  onClick: () => void;
}

const flip = ({ width, height, ...styles }: ViewportStyles) => ({
  ...styles,
  height: width,
  width: height,
});

const ActiveViewportSize = styled.div(() => ({
  display: 'inline-flex',
  alignItems: 'center',
}));

const ActiveViewportLabel = styled.div(({ theme }) => ({
  display: 'inline-block',
  textDecoration: 'none',
  padding: 10,
  fontWeight: theme.typography.weight.bold,
  fontSize: theme.typography.size.s2 - 1,
  lineHeight: '1',
  height: 40,
  border: 'none',
  borderTop: '3px solid transparent',
  borderBottom: '3px solid transparent',
  background: 'transparent',
}));

const IconButtonWithLabel = styled(IconButton)(() => ({
  display: 'inline-flex',
  alignItems: 'center',
}));

const IconButtonLabel = styled.div(({ theme }) => ({
  fontSize: theme.typography.size.s2 - 1,
  marginLeft: 10,
}));

const getStyles = (
  prevStyles: ViewportStyles | undefined,
  styles: Styles,
  isRotated: boolean
): ViewportStyles | undefined => {
  if (styles === null) {
    return undefined;
  }

  const result = typeof styles === 'function' ? styles(prevStyles) : styles;
  return isRotated ? flip(result) : result;
};

export const ViewportToolLegacy: FC = memo(function Tool() {
  const [globals, updateGlobals] = useGlobals();

  const {
    viewports = MINIMAL_VIEWPORTS,
    defaultOrientation,
    defaultViewport,
    disable,
  } = useParameter<ViewportAddonParameter>(PARAM_KEY, {});

  const list = toList(viewports);
  const api = useStorybookApi();
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);

  if (defaultViewport && !list.find((i) => i.id === defaultViewport)) {
    console.warn(
      `Cannot find "defaultViewport" of "${defaultViewport}" in addon-viewport configs, please check the "viewports" setting in the configuration.`
    );
  }

  useEffect(() => {
    registerShortcuts(api, globals, updateGlobals, Object.keys(viewports));
  }, [viewports, globals, globals.viewport, updateGlobals, api]);

  useEffect(() => {
    const defaultRotated = defaultOrientation === 'landscape';

    if (
      (defaultViewport && globals.viewport !== defaultViewport) ||
      (defaultOrientation && globals.viewportRotated !== defaultRotated)
    ) {
      updateGlobals({
        viewport: defaultViewport,
        viewportRotated: defaultRotated,
      });
    }
    // NOTE: we don't want to re-run this effect when `globals` changes
    // due to https://github.com/storybookjs/storybook/issues/26334
    //
    // Also, this *will* rerun every time you change story as the parameter is briefly `undefined`.
    // This behavior is intentional, if a bit of a happy accident in implementation.
    //
    // Ultimately this process of "locking in" a parameter value should be
    // replaced by https://github.com/storybookjs/storybook/discussions/23347
    // or something similar.
    //
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultOrientation, defaultViewport, updateGlobals]);

  const item =
    list.find((i) => i.id === globals.viewport) ||
    list.find((i) => i.id === defaultViewport) ||
    list.find((i) => i.default) ||
    responsiveViewport;

  const ref = useRef<ViewportStyles>();

  const styles = getStyles(ref.current, item.styles, globals.viewportRotated);

  useEffect(() => {
    ref.current = styles;
  }, [item]);

  if (disable || Object.entries(viewports).length === 0) {
    return null;
  }

  return (
    <Fragment>
      <WithTooltip
        placement="top"
        tooltip={({ onHide }) => (
          <TooltipLinkList links={toLinks(list, item, updateGlobals, onHide)} />
        )}
        closeOnOutsideClick
        onVisibleChange={setIsTooltipVisible}
      >
        <IconButtonWithLabel
          key="viewport"
          title="Change the size of the preview"
          active={isTooltipVisible || !!styles}
          onDoubleClick={() => {
            updateGlobals({ viewport: responsiveViewport.id });
          }}
        >
          <GrowIcon />
          {styles ? (
            <IconButtonLabel>
              {globals.viewportRotated ? `${item.title} (L)` : `${item.title} (P)`}
            </IconButtonLabel>
          ) : null}
        </IconButtonWithLabel>
      </WithTooltip>

      {styles ? (
        <ActiveViewportSize>
          <Global
            styles={{
              [`iframe[data-is-storybook="true"]`]: {
                ...(styles || {
                  width: '100%',
                  height: '100%',
                }),
              },
            }}
          />
          <ActiveViewportLabel title="Viewport width">
            {styles.width.replace('px', '')}
          </ActiveViewportLabel>
          <IconButton
            key="viewport-rotate"
            title="Rotate viewport"
            onClick={() => {
              updateGlobals({ viewportRotated: !globals.viewportRotated });
            }}
          >
            <TransferIcon />
          </IconButton>
          <ActiveViewportLabel title="Viewport height">
            {styles.height.replace('px', '')}
          </ActiveViewportLabel>
        </ActiveViewportSize>
      ) : null}
    </Fragment>
  );
});
