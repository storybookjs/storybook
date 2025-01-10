import { styled } from '@storybook/core/theming';

export const DocumentWrapper = styled.div(({ theme }) => ({
  fontSize: `${theme.typography.size.s2}px`,
  lineHeight: '1.6',

  h1: {
    fontSize: `${theme.typography.size.l1}px`,
    fontWeight: theme.typography.weight.bold,
  },
  h2: {
    fontSize: `${theme.typography.size.m2}px`,
    borderBottom: `1px solid ${theme.appBorderColor}`,
  },
  h3: {
    fontSize: `${theme.typography.size.m1}px`,
  },
  h4: {
    fontSize: `${theme.typography.size.s3}px`,
  },
  h5: {
    fontSize: `${theme.typography.size.s2}px`,
  },
  h6: {
    fontSize: `${theme.typography.size.s2}px`,
    color: theme.color.dark,
  },
  'pre:not(.prismjs)': {
    background: 'transparent',
    border: 'none',
    borderRadius: 0,
    padding: 0,
    margin: 0,
  },
  'pre pre, pre.prismjs': {
    padding: 15,
    margin: 0,
    whiteSpace: 'pre-wrap',
    color: 'inherit',
    fontSize: '13px',
    lineHeight: '19px',
  },
  'pre pre code, pre.prismjs code': {
    color: 'inherit',
    fontSize: 'inherit',
  },
  'pre code': {
    margin: 0,
    padding: 0,
    whiteSpace: 'pre',
    border: 'none',
    background: 'transparent',
  },
  'pre code, pre tt': {
    backgroundColor: 'transparent',
    border: 'none',
  },
  /* GitHub inspired Markdown styles loosely from https://gist.github.com/tuzz/3331384 */
  'body > *:first-of-type': {
    marginTop: '0 !important',
  },
  'body > *:last-child': {
    marginBottom: '0 !important',
  },
  a: {
    color: theme.color.secondary,
    textDecoration: 'none',
  },
  'a.absent': {
    color: '#cc0000',
  },
  'a.anchor': {
    display: 'block',
    paddingLeft: 30,
    marginLeft: -30,
    cursor: 'pointer',
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
  },
  'h1, h2, h3, h4, h5, h6': {
    margin: '20px 0 10px',
    padding: 0,
    cursor: 'text',
    position: 'relative',

    '&:first-of-type': {
      marginTop: 0,
      paddingTop: 0,
    },
    '&:hover a.anchor': {
      textDecoration: 'none',
    },
    '& tt, & code': {
      fontSize: 'inherit',
    },
  },
  'h1:first-of-type + h2': {
    marginTop: 0,
    paddingTop: 0,
  },
  'p, blockquote, ul, ol, dl, li, table, pre': {
    margin: '15px 0',
  },
  hr: {
    border: '0 none',
    borderTop: `1px solid ${theme.appBorderColor}`,
    height: 4,
    padding: 0,
  },
  'body > h1:first-of-type, body > h2:first-of-type, body > h3:first-of-type, body > h4:first-of-type, body > h5:first-of-type, body > h6:first-of-type':
    {
      marginTop: 0,
      paddingTop: 0,
    },
  'body > h1:first-of-type + h2': {
    marginTop: 0,
    paddingTop: 0,
  },
  'a:first-of-type h1, a:first-of-type h2, a:first-of-type h3, a:first-of-type h4, a:first-of-type h5, a:first-of-type h6':
    {
      marginTop: 0,
      paddingTop: 0,
    },
  'h1 p, h2 p, h3 p, h4 p, h5 p, h6 p': {
    marginTop: 0,
  },
  'li p.first': {
    display: 'inline-block',
  },
  'ul, ol': {
    paddingLeft: 30,

    '& :first-of-type': {
      marginTop: 0,
    },
    '& :last-child': {
      marginBottom: 0,
    },
  },
  dl: {
    padding: 0,
  },

  'dl dt': {
    fontSize: '14px',
    fontWeight: 'bold',
    fontStyle: 'italic',
    margin: '0 0 15px',
    padding: '0 15px',

    '&:first-of-type': {
      padding: 0,
    },
    '& > :first-of-type': {
      marginTop: 0,
    },
    '& > :last-child': {
      marginBottom: 0,
    },
  },

  blockquote: {
    borderLeft: `4px solid ${theme.color.medium}`,
    padding: '0 15px',
    color: theme.color.dark,

    '& > :first-of-type': {
      marginTop: 0,
    },

    '& > :last-child': {
      marginBottom: 0,
    },
  },

  table: {
    padding: 0,
    borderCollapse: 'collapse',

    '& tr': {
      borderTop: `1px solid ${theme.appBorderColor}`,
      backgroundColor: 'white',
      margin: 0,
      padding: 0,

      '& th': {
        fontWeight: 'bold',
        border: `1px solid ${theme.appBorderColor}`,
        textAlign: 'left',
        margin: 0,
        padding: '6px 13px',
      },

      '& td': {
        border: `1px solid ${theme.appBorderColor}`,
        textAlign: 'left',
        margin: 0,
        padding: '6px 13px',
      },
      '&:nth-of-type(2n)': {
        backgroundColor: theme.color.lighter,
      },

      '& th :first-of-type, & td :first-of-type': {
        marginTop: 0,
      },
      '& th :last-child, & td :last-child': {
        marginBottom: 0,
      },
    },
  },
  img: {
    maxWidth: '100%',
  },
  'span.frame': {
    display: 'block',
    overflow: 'hidden',

    '& > span': {
      border: `1px solid ${theme.color.medium}`,
      display: 'block',
      float: 'left',
      overflow: 'hidden',
      margin: '13px 0 0',
      padding: 7,
      width: 'auto',
    },

    '& span img': {
      display: 'block',
      float: 'left',
    },

    '& span span': {
      clear: 'both',
      color: theme.color.darkest,
      display: 'block',
      padding: '5px 0 0',
    },
  },
  'span.align-center': {
    display: 'block',
    overflow: 'hidden',
    clear: 'both',

    '& > span': {
      display: 'block',
      overflow: 'hidden',
      margin: '13px auto 0',
      textAlign: 'center',
    },
    '& span img': {
      margin: '0 auto',
      textAlign: 'center',
    },
  },
  'span.align-right': {
    display: 'block',
    overflow: 'hidden',
    clear: 'both',

    '& > span': {
      display: 'block',
      overflow: 'hidden',
      margin: '13px 0 0',
      textAlign: 'right',
    },

    '& span img': {
      margin: 0,
      textAlign: 'right',
    },
  },

  'span.float-left': {
    display: 'block',
    marginRight: 13,
    overflow: 'hidden',
    float: 'left',

    '& span': {
      margin: '13px 0 0',
    },
  },

  'span.float-right': {
    display: 'block',
    marginLeft: 13,
    overflow: 'hidden',
    float: 'right',

    '& > span': {
      display: 'block',
      overflow: 'hidden',
      margin: '13px auto 0',
      textAlign: 'right',
    },
  },
  'code, tt': {
    margin: '0 2px',
    padding: '0 5px',
    whiteSpace: 'nowrap',
    border: `1px solid ${theme.color.mediumlight}`,
    backgroundColor: theme.color.lighter,
    borderRadius: 3,
    color: theme.base === 'dark' ? theme.color.darkest : theme.color.dark,
  },
}));
