import React, { type ComponentProps, type ReactNode, type SyntheticEvent, forwardRef } from 'react';

import { deprecate } from 'storybook/internal/client-logger';

import memoize from 'memoizerific';
import { styled } from 'storybook/theming';

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
  {
    color: 'var(--sb-color-defaultText)',
    fontWeight: 'var(--sb-typography-weight-regular)',
  },
  ({ active }) =>
    active
      ? {
          color: 'var(--sb-color-secondary)',
          fontWeight: 'var(--sb-typography-weight-bold)',
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
  ({ disabled }) => (disabled ? { color: 'var(--sb-textMutedColor)' } : {})
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
});

const Center = styled.span<{ isIndented: boolean }>(
  {
    flex: 1,
    textAlign: 'left',
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0, // required for overflow
  },
  ({ isIndented }) => (isIndented ? { marginLeft: 24 } : {})
);

export interface CenterTextProps {
  active?: boolean;
  disabled?: boolean;
}

const CenterText = styled.span<CenterTextProps>(
  {
    fontSize: '11px',
    lineHeight: '14px',
  },
  ({ active }) => (active ? { color: 'var(--sb-color-secondary)' } : {}),
  ({ disabled }) => (disabled ? { color: 'var(--sb-textMutedColor)' } : {})
);

export interface LeftProps {
  active?: boolean;
}

const Left = styled.span<LeftProps>(
  ({ active }) => (active ? { color: 'var(--sb-color-secondary)' } : {}),
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

const Item = styled.button<ItemProps>(
  {
    width: '100%',
    minWidth: 0, // required for overflow
    border: 'none',
    borderRadius: 'var(--sb-appBorderRadius)',
    background: 'none',
    fontSize: 'var(--sb-typography-size-s1)',
    transition: 'background 150ms ease-out',
    color: 'var(--sb-color-dark)',
    textDecoration: 'none',
    justifyContent: 'space-between',

    lineHeight: '18px',
    padding: '7px 10px',
    display: 'flex',
    alignItems: 'center',

    '& > * + *': {
      paddingLeft: 10,
    },

    '&:focus-visible': {
      outline: `2px solid var(--sb-color-secondary)`,
      outlineOffset: 0,
    },
  },
  ({ href, onClick }) =>
    (href || onClick) && {
      cursor: 'pointer',
      '&:hover': {
        background: 'var(--sb-background-hoverable)',
      },
      '&:hover svg': {
        opacity: 1,
      },
    },
  ({ as }) =>
    as === 'label' && {
      '&:has(input:not(:disabled))': {
        cursor: 'pointer',
        '&:hover': {
          background: 'var(--sb-background-hoverable)',
        },
      },
    },
  ({ disabled }) => disabled && { cursor: 'not-allowed' }
);

const getItemProps = memoize(100)(({ onClick, input, href, LinkWrapper }) => ({
  ...(onClick && {
    as: 'button',
    role: 'button',
    onClick,
  }),
  ...(input && {
    as: 'label',
  }),
  ...(href && {
    as: 'a',
    role: 'link',
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
  input?: ReactNode;
  active?: boolean;
  disabled?: boolean;
  href?: string;
  LinkWrapper?: LinkWrapperType;
  isIndented?: boolean;
}

const ListItem = forwardRef((props: ListItemProps, ref) => {
  const {
    loading = false,
    title = <span>Loading state</span>,
    center = null,
    right = null,
    active = false,
    disabled = false,
    isIndented = false,
    href = undefined,
    onClick = undefined,
    icon,
    input,
    LinkWrapper = undefined,
    ...rest
  } = props;
  const commonProps = { active, disabled };
  const itemProps = getItemProps(props);
  const left = icon || input;

  deprecate(
    '`ListItem` is deprecated and will be removed in Storybook 11, use `MenuItem` instead.'
  );

  return (
    <Item data-deprecated="ListItem" ref={ref} {...rest} {...commonProps} {...itemProps}>
      <>
        {left && <Left {...commonProps}>{left}</Left>}
        {title || center ? (
          <Center isIndented={isIndented && !left}>
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
});
ListItem.displayName = 'ListItem';

export default ListItem;
