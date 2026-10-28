import type { ComponentProps } from 'react';
import React, { memo } from 'react';

import { deprecate, logger } from '@storybook/core/internal/client-logger';

import * as StorybookIcons from '@storybook/icons';

import { styled } from '@storybook/ui/theming';

import { LEGACY_ICONS } from '@storybook/core/internal/deep/types/legacy-icons';

export type IconType = keyof typeof icons;
type NewIconTypes = (typeof icons)[IconType];

const NEW_ICON_MAP = StorybookIcons as Record<NewIconTypes, (props: unknown) => React.ReactNode>;

const Svg = styled.svg`
  display: inline-block;
  shape-rendering: inherit;
  vertical-align: middle;
  fill: currentColor;
  path {
    fill: currentColor;
  }
`;

export interface IconsProps extends ComponentProps<typeof Svg> {
  icon: IconType;
  useSymbol?: boolean;
  onClick?: () => void;
  __suppressDeprecationWarning?: boolean;
}

// TODO: Remove in SB11
/**
 * @deprecated No longer used, will be removed in Storybook 9.0 Please use the `@storybook/icons`
 *   package instead.
 */
export const Icons = ({
  icon,
  useSymbol,
  __suppressDeprecationWarning = false,
  ...props
}: IconsProps) => {
  if (!__suppressDeprecationWarning) {
    deprecate(
      `Use of the deprecated Icons ${
        `(${icon})` || ''
      } component detected. Please use the @storybook/icons component directly. For more informations, see the migration notes at https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#icons-is-deprecated`
    );
  }

  const findIcon: NewIconTypes = icons[icon] || null;
  if (!findIcon) {
    logger.warn(
      `Use of an unknown prop ${
        `(${icon})` || ''
      } in the Icons component. The Icons component is deprecated. Please use the @storybook/icons component directly. For more informations, see the migration notes at https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#icons-is-deprecated`
    );
    return null;
  }

  const Icon = NEW_ICON_MAP[findIcon];

  return <Icon {...props} />;
};

export interface SymbolsProps {
  icons?: IconType[];
}

// TODO: Remove in SB11
/**
 * @deprecated No longer used, will be removed in Storybook 9.0 Please use the `@storybook/icons`
 *   package instead.
 */
export const Symbols = memo<SymbolsProps>(function Symbols({ icons: keys = Object.keys(icons) }) {
  return (
    <Svg
      viewBox="0 0 14 14"
      style={{ position: 'absolute', width: 0, height: 0 }}
      data-chromatic="ignore"
    >
      {/* @ts-expect-error (non strict) */}
      {keys.map((key: IconType) => (
        <symbol id={`icon--${key}`} key={key}>
          {icons[key]}
        </symbol>
      ))}
    </Svg>
  );
});

export const icons = LEGACY_ICONS;
