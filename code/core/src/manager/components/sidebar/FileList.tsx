import { rgba } from 'polished';
import { styled } from 'storybook/theming';

export const FileListWrapper = styled('div')(({ theme }) => ({
  marginTop: '-16px',
  // after element which fades out the list
  '&::after': {
    content: '""',
    position: 'fixed',
    pointerEvents: 'none',
    bottom: 0,
    left: 0,
    right: 0,
    height: '80px',
    background: `linear-gradient(${rgba(theme.barBg, 0)} 10%, ${theme.barBg} 80%)`,
  },
}));

export const FileList = styled('div')({
  height: '280px',
  overflow: 'auto',
  msOverflowStyle: 'none',
  scrollbarWidth: 'none',
  position: 'relative',
  '::-webkit-scrollbar': {
    display: 'none',
  },
});

export const FileListLi = styled('li')(({ theme }) => ({
  ':focus-visible': {
    outline: 'none',

    '.file-list-item': {
      borderRadius: '4px',
      background: theme.base === 'dark' ? 'rgba(255,255,255,.1)' : 'var(--sb-color-mediumlight)',

      '> svg': {
        display: 'flex',
      },
    },
  },
}));

export const FileListItem = styled('div')({
  display: 'flex',
  flexDirection: 'column',
  position: 'relative',
});

export const FileListItemContentWrapper = styled.div<{
  selected: boolean;
  disabled: boolean;
  error: boolean;
}>(({ theme, selected, disabled, error }) => ({
  display: 'flex',
  alignItems: 'flex-start',
  gap: '8px',
  alignSelf: 'stretch',
  padding: '8px 16px',
  cursor: 'pointer',
  borderRadius: '4px',

  ...(selected && {
    borderRadius: '4px',
    background: theme.base === 'dark' ? 'rgba(255,255,255,.1)' : 'var(--sb-color-mediumlight)',

    '> svg': {
      display: 'flex',
    },
  }),

  ...(disabled && {
    cursor: 'not-allowed',

    div: {
      color: `var(--sb-textMutedColor) !important`,
    },
  }),

  ...(error && {
    background: theme.base === 'light' ? '#00000011' : '#00000033',
  }),

  '&:hover': {
    background: error
      ? '#00000022'
      : theme.base === 'dark'
        ? 'rgba(255,255,255,.1)'
        : 'var(--sb-color-mediumlight)',

    '> svg': {
      display: 'flex',
    },
  },
}));

export const FileListUl = styled('ul')({
  margin: 0,
  padding: '0 0 0 0',
  width: '100%',
  position: 'relative',
});

export const FileListItemContent = styled('div')({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  width: 'calc(100% - 50px)',
});

export const FileListIconWrapper = styled('div')<{ error: boolean }>(({ error }) => ({
  color: error ? 'var(--sb-color-negativeText)' : 'var(--sb-color-secondary)',
}));

export const FileListItemLabel = styled('div')<{ error: boolean }>(({ theme, error }) => ({
  color: error
    ? 'var(--sb-color-negativeText)'
    : theme.base === 'dark'
      ? 'var(--sb-color-lighter)'
      : 'var(--sb-color-darkest)',
  fontSize: '14px',
  whiteSpace: 'nowrap',
  textOverflow: 'ellipsis',
  overflow: 'hidden',
  maxWidth: '100%',
}));

export const FileListItemPath = styled('div')({
  color: 'var(--sb-textMutedColor)',
  fontSize: '14px',
  whiteSpace: 'nowrap',
  textOverflow: 'ellipsis',
  overflow: 'hidden',
  maxWidth: '100%',
});

export const FileListExport = styled('ul')({
  margin: 0,
  padding: 0,
});

export const FileListItemExport = styled('li')<{ error: boolean }>(({ theme, error }) => ({
  padding: '8px 16px 8px 58px',
  display: 'flex',
  gap: '8px',
  alignItems: 'center',
  justifyContent: 'space-between',
  fontSize: '14px',
  cursor: 'pointer',
  borderRadius: '4px',

  ':focus-visible': {
    outline: 'none',
  },

  ...(error && {
    background: '#F9ECEC',
    color: 'var(--sb-color-negativeText)',
  }),

  '&:hover,:focus-visible': {
    background: error
      ? '#F9ECEC'
      : theme.base === 'dark'
        ? 'rgba(255, 255, 255, 0.1)'
        : 'var(--sb-color-mediumlight)',

    '> svg': {
      display: 'flex',
    },
  },

  '> div > svg': {
    color: error ? 'var(--sb-color-negativeText)' : 'var(--sb-color-secondary)',
  },
}));

export const FileListItemExportName = styled('div')({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  width: 'calc(100% - 20px)',
});

export const FileListItemExportNameContent = styled('span')(({ theme }) => ({
  whiteSpace: 'nowrap',
  textOverflow: 'ellipsis',
  overflow: 'hidden',
  display: 'inline-block',
  color: theme.base === 'dark' ? 'var(--sb-color-lightest)' : 'var(--sb-color-darkest)',
}));

export const FileListItemExportNameContentWithExport = styled(FileListItemExportNameContent)({
  maxWidth: 'calc(100% - 120px)',
});

export const DefaultExport = styled('span')(({ theme }) => ({
  display: 'inline-block',
  padding: `1px var(--sb-appBorderRadius)`,
  borderRadius: '2px',
  fontSize: '10px',
  color: 'var(--sb-color-defaultText)',
  backgroundColor: theme.base === 'dark' ? 'rgba(255, 255, 255, 0.1)' : '#F2F4F5',
}));

export const NoResults = styled('div')(({ theme }) => ({
  textAlign: 'center',
  maxWidth: '334px',
  margin: '16px auto 50px auto',
  fontSize: '14px',
  color: theme.base === 'dark' ? 'var(--sb-color-lightest)' : '#000',
}));

export const NoResultsDescription = styled('p')({
  margin: 0,
  color: 'var(--sb-textMutedColor)',
});
