import type { ComponentProps, ReactNode, SyntheticEvent } from 'react';
import React from 'react';

import { styled } from '@storybook/core/theming';

import memoize from 'memoizerific';
import { transparentize } from 'polished';

export interface TitleProps {
  children?: ReactNode;
  active?: boolean;
  loading?: boolean;
  disabled?: boolean;
}
const Title = styled(({ active, loading, disabled, ...rest }: TitleProps) => <span {...rest} />)<{
  active: boolean;
  loading: boolean;
  disabled: boolean;
}>(
  ({ theme }) => ({
    color: theme.color.defaultText,
    // Previously was theme.typography.weight.normal but this weight does not exists in Theme
    fontWeight: theme.typography.weight.regular,
  }),
  ({ active, theme }) =>
    active
      ? {
          color: theme.color.secondary,
          fontWeight: theme.typography.weight.bold,
        }
      : {},
  ({ loading, theme }) =>
    loading
      ? {
          display: 'inline-block',
          flex: 'none',
          ...theme.animation.inlineGlow,
        }
      : {},
  ({ disabled, theme }) =>
    disabled
      ? {
          color: transparentize(0.7, theme.color.defaultText),
        }
      : {}
);

export interface RightProps {
  active?: boolean;
}

const Right = styled.span<RightProps>({
  display: 'flex',
  '& svg': {
    height: 12,
    width: 12,
    margin: '3px 0',
    verticalAlign: 'top',
  },
  '& path': {
    fill: 'inherit',
  },
});

const Center = styled.span<{ isIndented: boolean }>(
  {
    flex: 1,
    textAlign: 'left',
    display: 'flex',
    flexDirection: 'column',
  },
  ({ isIndented }) => (isIndented ? { marginLeft: 24 } : {})
);

export interface CenterTextProps {
  active?: boolean;
  disabled?: boolean;
}

const CenterText = styled.span<CenterTextProps>(
  ({ theme }) => ({
    fontSize: '11px',
    lineHeight: '14px',
  }),
  ({ active, theme }) =>
    active
      ? {
          color: theme.color.secondary,
        }
      : {},
  ({ theme, disabled }) =>
    disabled
      ? {
          color: theme.textMutedColor,
        }
      : {}
);

export interface LeftProps {
  active?: boolean;
}

const Left = styled.span<LeftProps>(
  ({ active, theme }) =>
    active
      ? {
          color: theme.color.secondary,
        }
      : {},
  () => ({
    display: 'flex',
    maxWidth: 14,
  })
);

export interface ItemProps {
  disabled?: boolean;
  href?: string;
  onClick?: (event: SyntheticEvent, ...args: any[]) => any;
}

const Item = styled.div<ItemProps>(
  ({ theme }) => ({
    width: '100%',
    border: 'none',
    borderRadius: theme.appBorderRadius,
    background: 'none',
    fontSize: theme.typography.size.s1,
    transition: 'all 150ms ease-out',
    color: theme.color.dark,
    textDecoration: 'none',
    justifyContent: 'space-between',

    lineHeight: '18px',
    padding: '7px 10px',
    display: 'flex',
    alignItems: 'center',

    '& > * + *': {
      paddingLeft: 10,
    },
  }),
  ({ theme, href, onClick }) =>
    (href || onClick) && {
      cursor: 'pointer',
      '&:hover': {
        background: theme.background.hoverable,
      },
      '&:hover svg': {
        opacity: 1,
      },
    },
  ({ theme, as }) =>
    as === 'label' && {
      '&:has(input:not(:disabled))': {
        cursor: 'pointer',
        '&:hover': {
          background: theme.background.hoverable,
        },
      },
    },
  ({ disabled }) => disabled && { cursor: 'not-allowed' }
);

const getItemProps = memoize(100)((onClick, href, LinkWrapper) => ({
  ...(onClick && {
    as: 'button',
    onClick,
  }),
  ...(href && {
    as: 'a',
    href,
    ...(LinkWrapper && {
      as: LinkWrapper,
      to: href,
    }),
  }),
}));

export type LinkWrapperType = (props: any) => ReactNode;

export interface ListItemProps extends Omit<ComponentProps<typeof Item>, 'title'> {
  loading?: boolean;
  title?: ReactNode;
  center?: ReactNode;
  right?: ReactNode;
  icon?: ReactNode;
  active?: boolean;
  disabled?: boolean;
  href?: string;
  LinkWrapper?: LinkWrapperType;
  isIndented?: boolean;
}

const ListItem = ({
  loading = false,
  title = <span>Loading state</span>,
  center = null,
  right = null,

  active = false,
  disabled = false,
  isIndented,
  href = undefined,
  onClick = undefined,
  icon,
  LinkWrapper = undefined,
  ...rest
}: ListItemProps) => {
  const commonProps = { active, disabled };
  const itemProps = getItemProps(onClick, href, LinkWrapper);

  return (
    <Item {...rest} {...commonProps} {...itemProps}>
      <>
        {icon && <Left {...commonProps}>{icon}</Left>}
        {title || center ? (
          <Center isIndented={!!(!icon && isIndented)}>
            {title && (
              <Title {...commonProps} loading={loading}>
                {title}
              </Title>
            )}
            {center && <CenterText {...commonProps}>{center}</CenterText>}
          </Center>
        ) : null}
        {right && <Right {...commonProps}>{right}</Right>}
      </>
    </Item>
  );
};

export default ListItem;
