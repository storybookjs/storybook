import React from 'react';

import { ActionList, PopoverProvider } from 'storybook/internal/components';

import { CloseAltIcon, TransferIcon } from '@storybook/icons';

import { styled } from 'storybook/theming';

import { useViewport } from '../../../viewport/useViewport';
import { iconsMap } from '../../../viewport/viewportIcons';
import { IFrame } from './Iframe';
import { SizeInput } from './SizeInput';

const ViewportWrapper = styled.div<{
  active: boolean;
  viewportWidth: string;
  viewportHeight: string;
}>(({ active, viewportWidth, viewportHeight }) => ({
  gridArea: '1 / 1',
  alignSelf: 'start',
  justifySelf: 'start',
  display: active ? 'inline-flex' : 'none',
  flexDirection: 'column',
  width: viewportWidth.endsWith('%') ? '100%' : 'auto',
  height: viewportHeight.endsWith('%') ? '100%' : 'auto',
  paddingTop: viewportHeight === '100%' ? 0 : 6,
  paddingBottom: viewportHeight === '100%' ? 0 : 40,
  paddingInline: viewportWidth === '100%' ? 0 : 40,
}));

const ViewportControls = styled.div({
  display: 'flex',
  margin: '0 0 6px 6px',
  gap: 6,
});

const ViewportDimensions = styled.div({
  display: 'flex',
  gap: 2,
});

const TimesIcon = styled(CloseAltIcon)({
  padding: 2,
});

const Dimensions = styled.div(({ theme }) => ({
  display: 'flex',
  gap: 2,
  fontFamily: theme.typography.fonts.mono,
  fontSize: theme.typography.size.s1 - 1,
  color: theme.textMutedColor,
}));

const FrameWrapper = styled.div<{ fullWidth: boolean; fullHeight: boolean }>(
  ({ fullWidth, fullHeight, theme }) => ({
    display: 'inline-block',
    border: `1px solid ${theme.button.border}`,
    borderRadius: fullWidth || fullHeight ? 0 : 4,
    overflow: 'hidden',
    ...(fullWidth && { borderLeftWidth: 0, borderRightWidth: 0, width: '100%' }),
    ...(fullHeight && { borderTopWidth: 0, borderBottomWidth: 0, height: '100%' }),
  })
);

export const Viewport = ({
  active,
  id,
  src,
  scale,
}: {
  active: boolean;
  id: string;
  src: string;
  scale: number;
}) => {
  const { name, type, width, height, isDefault, isLocked, options, select, rotate, resize } =
    useViewport();

  return (
    <ViewportWrapper key={id} active={active} viewportWidth={width} viewportHeight={height}>
      {!isDefault && height !== '100%' && (
        <ViewportControls style={width !== '100%' ? { marginLeft: 0 } : {}}>
          <PopoverProvider
            offset={4}
            padding={0}
            popover={() => (
              <ActionList style={{ minWidth: 240 }}>
                {Object.entries(options).map(([key, value]) => (
                  <ActionList.Item key={key}>
                    <ActionList.Action ariaLabel={false} onClick={() => select(key)}>
                      <ActionList.Icon>{iconsMap[value.type!]}</ActionList.Icon>
                      <ActionList.Text>{value.name}</ActionList.Text>
                      <Dimensions>
                        <span>{value.styles.width.replace('px', '')}</span>
                        <span>&times;</span>
                        <span>{value.styles.height.replace('px', '')}</span>
                      </Dimensions>
                    </ActionList.Action>
                  </ActionList.Item>
                ))}
              </ActionList>
            )}
          >
            <ActionList.Button
              size="small"
              variant="outline"
              disabled={isLocked}
              readOnly={isLocked}
            >
              <ActionList.Icon>{iconsMap[type!]}</ActionList.Icon>
              <ActionList.Text>{name}</ActionList.Text>
            </ActionList.Button>
          </PopoverProvider>

          <ViewportDimensions>
            <SizeInput
              label="Viewport width:"
              prefix="W"
              value={width}
              setValue={(value) => resize(value, height)}
            />

            <ActionList.Button
              key="viewport-rotate"
              size="small"
              padding="small"
              variant="ghost"
              ariaLabel={isLocked ? false : 'Rotate viewport'}
              disabled={isLocked}
              readOnly={isLocked}
              onClick={rotate}
            >
              {isLocked ? <TimesIcon /> : <TransferIcon />}
            </ActionList.Button>

            <SizeInput
              label="Viewport height:"
              prefix="H"
              value={height}
              setValue={(value) => resize(width, value)}
            />
          </ViewportDimensions>
        </ViewportControls>
      )}
      <FrameWrapper
        fullWidth={width === '100%'}
        fullHeight={height === '100%'}
        style={{ width, height }}
      >
        <IFrame
          active={active}
          key={id}
          id={id}
          title={id}
          src={src}
          allowFullScreen
          scale={scale}
        />
      </FrameWrapper>
    </ViewportWrapper>
  );
};
