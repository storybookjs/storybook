import { mkColor } from '../utils';

interface ColorsHash {
  [key: string]: string;
}
interface ColorsObjectsHash {
  [key: string]: {
    color: string;
  };
}

export const chromeDark = {
  BASE_FONT_FAMILY: 'Menlo, monospace',
  BASE_FONT_SIZE: '11px',
  BASE_LINE_HEIGHT: 1.2,

  BASE_BACKGROUND_COLOR: 'rgb(36, 36, 36)',
  BASE_COLOR: 'rgb(213, 213, 213)',

  OBJECT_PREVIEW_ARRAY_MAX_PROPERTIES: 10,
  OBJECT_PREVIEW_OBJECT_MAX_PROPERTIES: 5,
  OBJECT_NAME_COLOR: 'rgb(227, 110, 236)',
  OBJECT_VALUE_NULL_COLOR: 'rgb(127, 127, 127)',
  OBJECT_VALUE_UNDEFINED_COLOR: 'rgb(127, 127, 127)',
  OBJECT_VALUE_REGEXP_COLOR: 'rgb(233, 63, 59)',
  OBJECT_VALUE_STRING_COLOR: 'rgb(233, 63, 59)',
  OBJECT_VALUE_SYMBOL_COLOR: 'rgb(233, 63, 59)',
  OBJECT_VALUE_NUMBER_COLOR: 'hsl(252, 100%, 75%)',
  OBJECT_VALUE_BOOLEAN_COLOR: 'hsl(252, 100%, 75%)',
  OBJECT_VALUE_FUNCTION_PREFIX_COLOR: 'rgb(85, 106, 242)',

  HTML_TAG_COLOR: 'rgb(93, 176, 215)',
  HTML_TAGNAME_COLOR: 'rgb(93, 176, 215)',
  HTML_TAGNAME_TEXT_TRANSFORM: 'lowercase',
  HTML_ATTRIBUTE_NAME_COLOR: 'rgb(155, 187, 220)',
  HTML_ATTRIBUTE_VALUE_COLOR: 'rgb(242, 151, 102)',
  HTML_COMMENT_COLOR: 'rgb(137, 137, 137)',
  HTML_DOCTYPE_COLOR: 'rgb(192, 192, 192)',

  ARROW_COLOR: 'rgb(145, 145, 145)',
  ARROW_MARGIN_RIGHT: 3,
  ARROW_FONT_SIZE: 12,
  ARROW_ANIMATION_DURATION: '0',

  TREENODE_FONT_FAMILY: 'Menlo, monospace',
  TREENODE_FONT_SIZE: '11px',
  TREENODE_LINE_HEIGHT: 1.2,
  TREENODE_PADDING_LEFT: 12,

  TABLE_BORDER_COLOR: 'rgb(85, 85, 85)',
  TABLE_TH_BACKGROUND_COLOR: 'rgb(44, 44, 44)',
  TABLE_TH_HOVER_COLOR: 'rgb(48, 48, 48)',
  TABLE_SORT_ICON_COLOR: 'black', // 'rgb(48, 57, 66)',
  TABLE_DATA_BACKGROUND_IMAGE:
    'linear-gradient(rgba(255, 255, 255, 0), rgba(255, 255, 255, 0) 50%, rgba(51, 139, 255, 0.0980392) 50%, rgba(51, 139, 255, 0.0980392))',
  TABLE_DATA_BACKGROUND_SIZE: '128px 32px',
};

export const chromeLight = {
  BASE_FONT_FAMILY: 'Menlo, monospace',
  BASE_FONT_SIZE: '11px',
  BASE_LINE_HEIGHT: 1.2,

  BASE_BACKGROUND_COLOR: 'white',
  BASE_COLOR: 'black',

  OBJECT_PREVIEW_ARRAY_MAX_PROPERTIES: 10,
  OBJECT_PREVIEW_OBJECT_MAX_PROPERTIES: 5,
  OBJECT_NAME_COLOR: 'rgb(136, 19, 145)',
  OBJECT_VALUE_NULL_COLOR: 'rgb(128, 128, 128)',
  OBJECT_VALUE_UNDEFINED_COLOR: 'rgb(128, 128, 128)',
  OBJECT_VALUE_REGEXP_COLOR: 'rgb(196, 26, 22)',
  OBJECT_VALUE_STRING_COLOR: 'rgb(196, 26, 22)',
  OBJECT_VALUE_SYMBOL_COLOR: 'rgb(196, 26, 22)',
  OBJECT_VALUE_NUMBER_COLOR: 'rgb(28, 0, 207)',
  OBJECT_VALUE_BOOLEAN_COLOR: 'rgb(28, 0, 207)',
  OBJECT_VALUE_FUNCTION_PREFIX_COLOR: 'rgb(13, 34, 170)',

  HTML_TAG_COLOR: 'rgb(168, 148, 166)',
  HTML_TAGNAME_COLOR: 'rgb(136, 18, 128)',
  HTML_TAGNAME_TEXT_TRANSFORM: 'lowercase',
  HTML_ATTRIBUTE_NAME_COLOR: 'rgb(153, 69, 0)',
  HTML_ATTRIBUTE_VALUE_COLOR: 'rgb(26, 26, 166)',
  HTML_COMMENT_COLOR: 'rgb(35, 110, 37)',
  HTML_DOCTYPE_COLOR: 'rgb(192, 192, 192)',

  ARROW_COLOR: '#6e6e6e',
  ARROW_MARGIN_RIGHT: 3,
  ARROW_FONT_SIZE: 12,
  ARROW_ANIMATION_DURATION: '0',

  TREENODE_FONT_FAMILY: 'Menlo, monospace',
  TREENODE_FONT_SIZE: '11px',
  TREENODE_LINE_HEIGHT: 1.2,
  TREENODE_PADDING_LEFT: 12,

  TABLE_BORDER_COLOR: '#aaa',
  TABLE_TH_BACKGROUND_COLOR: '#eee',
  TABLE_TH_HOVER_COLOR: 'hsla(0, 0%, 90%, 1)',
  TABLE_SORT_ICON_COLOR: '#6e6e6e',
  TABLE_DATA_BACKGROUND_IMAGE:
    'linear-gradient(to bottom, white, white 50%, rgb(234, 243, 255) 50%, rgb(234, 243, 255))',
  TABLE_DATA_BACKGROUND_SIZE: '128px 32px',
};

const convertColors = (colors: ColorsHash): ColorsObjectsHash =>
  Object.entries(colors).reduce((acc, [k, v]) => ({ ...acc, [k]: mkColor(v) }), {});

export const create = ({ colors, mono }: { colors: ColorsHash; mono: string }) => {
  const colorsObjs = convertColors(colors);
  return {
    token: {
      fontFamily: mono,
      WebkitFontSmoothing: 'antialiased',

      '&.tag': colorsObjs.red3,

      '&.comment': { ...colorsObjs.green1, fontStyle: 'italic' },
      '&.prolog': { ...colorsObjs.green1, fontStyle: 'italic' },
      '&.doctype': { ...colorsObjs.green1, fontStyle: 'italic' },
      '&.cdata': { ...colorsObjs.green1, fontStyle: 'italic' },

      '&.string': colorsObjs.red1,

      '&.url': colorsObjs.cyan1,
      '&.symbol': colorsObjs.cyan1,
      '&.number': colorsObjs.cyan1,
      '&.boolean': colorsObjs.cyan1,
      '&.variable': colorsObjs.cyan1,
      '&.constant': colorsObjs.cyan1,
      '&.inserted': colorsObjs.cyan1,

      '&.atrule': colorsObjs.blue1,
      '&.keyword': colorsObjs.blue1,
      '&.attr-value': colorsObjs.blue1,

      '&.punctuation': colorsObjs.gray1,
      '&.operator': colorsObjs.gray1,

      '&.function': colorsObjs.gray1,
      '&.deleted': colorsObjs.red2,

      '&.important': {
        fontWeight: 'bold',
      },
      '&.bold': {
        fontWeight: 'bold',
      },

      '&.italic': {
        fontStyle: 'italic',
      },

      '&.class-name': colorsObjs.cyan2,

      '&.selector': colorsObjs.red3,

      '&.attr-name': colorsObjs.red4,
      '&.property': colorsObjs.red4,
      '&.regex': colorsObjs.red4,
      '&.entity': colorsObjs.red4,

      '&.directive.tag .tag': {
        background: '#ffff00',
        ...colorsObjs.gray1,
      },
    },
    'language-json .token.boolean': colorsObjs.blue1,
    'language-json .token.number': colorsObjs.blue1,
    'language-json .token.property': colorsObjs.cyan2,

    namespace: {
      opacity: 0.7,
    },
  };
};
