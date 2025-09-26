import React from 'react';

import { StorybookLogo } from 'storybook/internal/components';

import { styled, withTheme } from 'storybook/theming';

export const StorybookLogoStyled = styled(StorybookLogo)(({ theme }) => ({
  width: 'auto',
  height: '22px !important',
  display: 'block',
  color: theme.base === 'light' ? theme.color.defaultText : theme.color.lightest,
}));

export const Img = styled.img({
  display: 'block',
  maxWidth: '150px !important',
  maxHeight: '100px',
});

export const LogoLink = styled.a(({ theme }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  flexGrow: 0,
  height: '100%',
  minHeight: 32,
  padding: '4px 6px',
  borderRadius: 4,
  color: 'inherit',
  textDecoration: 'none',
  '&:focus-visible': {
    outline: `2px solid ${theme.color.secondary}`,
    outlineOffset: 2,
  },
}));

// @ts-expect-error (TODO)
export const Brand = withTheme(({ theme }) => {
  const { title = 'Storybook', url = './', image, target } = theme.brand;
  const targetValue = target || (url === './' ? '' : '_blank');

  // When image is explicitly set to null, enable custom HTML support
  if (image === null) {
    if (title === null) {
      return null;
    }

    if (!url) {
      return <div dangerouslySetInnerHTML={{ __html: title }} />;
    }
    return <LogoLink href={url} target={targetValue} dangerouslySetInnerHTML={{ __html: title }} />;
  }

  const logo = image ? <Img src={image} alt={title} /> : <StorybookLogoStyled alt={title} />;

  if (url) {
    return (
      <LogoLink title={title} href={url} target={targetValue}>
        {logo}
      </LogoLink>
    );
  }

  // The wrapper div serves to prevent image misalignment
  return <div>{logo}</div>;
});
