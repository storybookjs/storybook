"use strict"; function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; } function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }





var _chunk7G76EW2Rjs = require('./chunk-7G76EW2R.js');


var _chunkUIX4URMVjs = require('./chunk-UIX4URMV.js');







var _chunkGQ77QZBOjs = require('./chunk-GQ77QZBO.js');

// node_modules/.pnpm/picomatch@2.3.1/node_modules/picomatch/lib/constants.js
var require_constants = _chunkGQ77QZBOjs.__commonJS.call(void 0, {
  "node_modules/.pnpm/picomatch@2.3.1/node_modules/picomatch/lib/constants.js"(exports, module) {
    "use strict";
    var path3 = _chunkGQ77QZBOjs.__require.call(void 0, "path");
    var WIN_SLASH = "\\\\/";
    var WIN_NO_SLASH = `[^${WIN_SLASH}]`;
    var DOT_LITERAL = "\\.";
    var PLUS_LITERAL = "\\+";
    var QMARK_LITERAL = "\\?";
    var SLASH_LITERAL = "\\/";
    var ONE_CHAR = "(?=.)";
    var QMARK = "[^/]";
    var END_ANCHOR = `(?:${SLASH_LITERAL}|$)`;
    var START_ANCHOR = `(?:^|${SLASH_LITERAL})`;
    var DOTS_SLASH = `${DOT_LITERAL}{1,2}${END_ANCHOR}`;
    var NO_DOT = `(?!${DOT_LITERAL})`;
    var NO_DOTS = `(?!${START_ANCHOR}${DOTS_SLASH})`;
    var NO_DOT_SLASH = `(?!${DOT_LITERAL}{0,1}${END_ANCHOR})`;
    var NO_DOTS_SLASH = `(?!${DOTS_SLASH})`;
    var QMARK_NO_DOT = `[^.${SLASH_LITERAL}]`;
    var STAR = `${QMARK}*?`;
    var POSIX_CHARS = {
      DOT_LITERAL,
      PLUS_LITERAL,
      QMARK_LITERAL,
      SLASH_LITERAL,
      ONE_CHAR,
      QMARK,
      END_ANCHOR,
      DOTS_SLASH,
      NO_DOT,
      NO_DOTS,
      NO_DOT_SLASH,
      NO_DOTS_SLASH,
      QMARK_NO_DOT,
      STAR,
      START_ANCHOR
    };
    var WINDOWS_CHARS = {
      ...POSIX_CHARS,
      SLASH_LITERAL: `[${WIN_SLASH}]`,
      QMARK: WIN_NO_SLASH,
      STAR: `${WIN_NO_SLASH}*?`,
      DOTS_SLASH: `${DOT_LITERAL}{1,2}(?:[${WIN_SLASH}]|$)`,
      NO_DOT: `(?!${DOT_LITERAL})`,
      NO_DOTS: `(?!(?:^|[${WIN_SLASH}])${DOT_LITERAL}{1,2}(?:[${WIN_SLASH}]|$))`,
      NO_DOT_SLASH: `(?!${DOT_LITERAL}{0,1}(?:[${WIN_SLASH}]|$))`,
      NO_DOTS_SLASH: `(?!${DOT_LITERAL}{1,2}(?:[${WIN_SLASH}]|$))`,
      QMARK_NO_DOT: `[^.${WIN_SLASH}]`,
      START_ANCHOR: `(?:^|[${WIN_SLASH}])`,
      END_ANCHOR: `(?:[${WIN_SLASH}]|$)`
    };
    var POSIX_REGEX_SOURCE = {
      alnum: "a-zA-Z0-9",
      alpha: "a-zA-Z",
      ascii: "\\x00-\\x7F",
      blank: " \\t",
      cntrl: "\\x00-\\x1F\\x7F",
      digit: "0-9",
      graph: "\\x21-\\x7E",
      lower: "a-z",
      print: "\\x20-\\x7E ",
      punct: "\\-!\"#$%&'()\\*+,./:;<=>?@[\\]^_`{|}~",
      space: " \\t\\r\\n\\v\\f",
      upper: "A-Z",
      word: "A-Za-z0-9_",
      xdigit: "A-Fa-f0-9"
    };
    module.exports = {
      MAX_LENGTH: 1024 * 64,
      POSIX_REGEX_SOURCE,
      // regular expressions
      REGEX_BACKSLASH: /\\(?![*+?^${}(|)[\]])/g,
      REGEX_NON_SPECIAL_CHARS: /^[^@![\].,$*+?^{}()|\\/]+/,
      REGEX_SPECIAL_CHARS: /[-*+?.^${}(|)[\]]/,
      REGEX_SPECIAL_CHARS_BACKREF: /(\\?)((\W)(\3*))/g,
      REGEX_SPECIAL_CHARS_GLOBAL: /([-*+?.^${}(|)[\]])/g,
      REGEX_REMOVE_BACKSLASH: /(?:\[.*?[^\\]\]|\\(?=.))/g,
      // Replace globs with equivalent patterns to reduce parsing time.
      REPLACEMENTS: {
        "***": "*",
        "**/**": "**",
        "**/**/**": "**"
      },
      // Digits
      CHAR_0: 48,
      /* 0 */
      CHAR_9: 57,
      /* 9 */
      // Alphabet chars.
      CHAR_UPPERCASE_A: 65,
      /* A */
      CHAR_LOWERCASE_A: 97,
      /* a */
      CHAR_UPPERCASE_Z: 90,
      /* Z */
      CHAR_LOWERCASE_Z: 122,
      /* z */
      CHAR_LEFT_PARENTHESES: 40,
      /* ( */
      CHAR_RIGHT_PARENTHESES: 41,
      /* ) */
      CHAR_ASTERISK: 42,
      /* * */
      // Non-alphabetic chars.
      CHAR_AMPERSAND: 38,
      /* & */
      CHAR_AT: 64,
      /* @ */
      CHAR_BACKWARD_SLASH: 92,
      /* \ */
      CHAR_CARRIAGE_RETURN: 13,
      /* \r */
      CHAR_CIRCUMFLEX_ACCENT: 94,
      /* ^ */
      CHAR_COLON: 58,
      /* : */
      CHAR_COMMA: 44,
      /* , */
      CHAR_DOT: 46,
      /* . */
      CHAR_DOUBLE_QUOTE: 34,
      /* " */
      CHAR_EQUAL: 61,
      /* = */
      CHAR_EXCLAMATION_MARK: 33,
      /* ! */
      CHAR_FORM_FEED: 12,
      /* \f */
      CHAR_FORWARD_SLASH: 47,
      /* / */
      CHAR_GRAVE_ACCENT: 96,
      /* ` */
      CHAR_HASH: 35,
      /* # */
      CHAR_HYPHEN_MINUS: 45,
      /* - */
      CHAR_LEFT_ANGLE_BRACKET: 60,
      /* < */
      CHAR_LEFT_CURLY_BRACE: 123,
      /* { */
      CHAR_LEFT_SQUARE_BRACKET: 91,
      /* [ */
      CHAR_LINE_FEED: 10,
      /* \n */
      CHAR_NO_BREAK_SPACE: 160,
      /* \u00A0 */
      CHAR_PERCENT: 37,
      /* % */
      CHAR_PLUS: 43,
      /* + */
      CHAR_QUESTION_MARK: 63,
      /* ? */
      CHAR_RIGHT_ANGLE_BRACKET: 62,
      /* > */
      CHAR_RIGHT_CURLY_BRACE: 125,
      /* } */
      CHAR_RIGHT_SQUARE_BRACKET: 93,
      /* ] */
      CHAR_SEMICOLON: 59,
      /* ; */
      CHAR_SINGLE_QUOTE: 39,
      /* ' */
      CHAR_SPACE: 32,
      /*   */
      CHAR_TAB: 9,
      /* \t */
      CHAR_UNDERSCORE: 95,
      /* _ */
      CHAR_VERTICAL_LINE: 124,
      /* | */
      CHAR_ZERO_WIDTH_NOBREAK_SPACE: 65279,
      /* \uFEFF */
      SEP: path3.sep,
      /**
       * Create EXTGLOB_CHARS
       */
      extglobChars(chars) {
        return {
          "!": { type: "negate", open: "(?:(?!(?:", close: `))${chars.STAR})` },
          "?": { type: "qmark", open: "(?:", close: ")?" },
          "+": { type: "plus", open: "(?:", close: ")+" },
          "*": { type: "star", open: "(?:", close: ")*" },
          "@": { type: "at", open: "(?:", close: ")" }
        };
      },
      /**
       * Create GLOB_CHARS
       */
      globChars(win322) {
        return win322 === true ? WINDOWS_CHARS : POSIX_CHARS;
      }
    };
  }
});

// node_modules/.pnpm/picomatch@2.3.1/node_modules/picomatch/lib/utils.js
var require_utils = _chunkGQ77QZBOjs.__commonJS.call(void 0, {
  "node_modules/.pnpm/picomatch@2.3.1/node_modules/picomatch/lib/utils.js"(exports) {
    "use strict";
    var path3 = _chunkGQ77QZBOjs.__require.call(void 0, "path");
    var win322 = process.platform === "win32";
    var {
      REGEX_BACKSLASH,
      REGEX_REMOVE_BACKSLASH,
      REGEX_SPECIAL_CHARS,
      REGEX_SPECIAL_CHARS_GLOBAL
    } = require_constants();
    exports.isObject = (val) => val !== null && typeof val === "object" && !Array.isArray(val);
    exports.hasRegexChars = (str) => REGEX_SPECIAL_CHARS.test(str);
    exports.isRegexChar = (str) => str.length === 1 && exports.hasRegexChars(str);
    exports.escapeRegex = (str) => str.replace(REGEX_SPECIAL_CHARS_GLOBAL, "\\$1");
    exports.toPosixSlashes = (str) => str.replace(REGEX_BACKSLASH, "/");
    exports.removeBackslashes = (str) => {
      return str.replace(REGEX_REMOVE_BACKSLASH, (match) => {
        return match === "\\" ? "" : match;
      });
    };
    exports.supportsLookbehinds = () => {
      const segs = process.version.slice(1).split(".").map(Number);
      if (segs.length === 3 && segs[0] >= 9 || segs[0] === 8 && segs[1] >= 10) {
        return true;
      }
      return false;
    };
    exports.isWindows = (options) => {
      if (options && typeof options.windows === "boolean") {
        return options.windows;
      }
      return win322 === true || path3.sep === "\\";
    };
    exports.escapeLast = (input, char, lastIdx) => {
      const idx = input.lastIndexOf(char, lastIdx);
      if (idx === -1)
        return input;
      if (input[idx - 1] === "\\")
        return exports.escapeLast(input, char, idx - 1);
      return `${input.slice(0, idx)}\\${input.slice(idx)}`;
    };
    exports.removePrefix = (input, state = {}) => {
      let output = input;
      if (output.startsWith("./")) {
        output = output.slice(2);
        state.prefix = "./";
      }
      return output;
    };
    exports.wrapOutput = (input, state = {}, options = {}) => {
      const prepend = options.contains ? "" : "^";
      const append = options.contains ? "" : "$";
      let output = `${prepend}(?:${input})${append}`;
      if (state.negated === true) {
        output = `(?:^(?!${output}).*$)`;
      }
      return output;
    };
  }
});

// node_modules/.pnpm/picomatch@2.3.1/node_modules/picomatch/lib/scan.js
var require_scan = _chunkGQ77QZBOjs.__commonJS.call(void 0, {
  "node_modules/.pnpm/picomatch@2.3.1/node_modules/picomatch/lib/scan.js"(exports, module) {
    "use strict";
    var utils = require_utils();
    var {
      CHAR_ASTERISK,
      /* * */
      CHAR_AT,
      /* @ */
      CHAR_BACKWARD_SLASH,
      /* \ */
      CHAR_COMMA,
      /* , */
      CHAR_DOT,
      /* . */
      CHAR_EXCLAMATION_MARK,
      /* ! */
      CHAR_FORWARD_SLASH,
      /* / */
      CHAR_LEFT_CURLY_BRACE,
      /* { */
      CHAR_LEFT_PARENTHESES,
      /* ( */
      CHAR_LEFT_SQUARE_BRACKET,
      /* [ */
      CHAR_PLUS,
      /* + */
      CHAR_QUESTION_MARK,
      /* ? */
      CHAR_RIGHT_CURLY_BRACE,
      /* } */
      CHAR_RIGHT_PARENTHESES,
      /* ) */
      CHAR_RIGHT_SQUARE_BRACKET
      /* ] */
    } = require_constants();
    var isPathSeparator = (code) => {
      return code === CHAR_FORWARD_SLASH || code === CHAR_BACKWARD_SLASH;
    };
    var depth = (token) => {
      if (token.isPrefix !== true) {
        token.depth = token.isGlobstar ? Infinity : 1;
      }
    };
    var scan = (input, options) => {
      const opts = options || {};
      const length = input.length - 1;
      const scanToEnd = opts.parts === true || opts.scanToEnd === true;
      const slashes = [];
      const tokens = [];
      const parts = [];
      let str = input;
      let index = -1;
      let start = 0;
      let lastIndex = 0;
      let isBrace = false;
      let isBracket = false;
      let isGlob = false;
      let isExtglob = false;
      let isGlobstar = false;
      let braceEscaped = false;
      let backslashes = false;
      let negated = false;
      let negatedExtglob = false;
      let finished = false;
      let braces = 0;
      let prev;
      let code;
      let token = { value: "", depth: 0, isGlob: false };
      const eos = () => index >= length;
      const peek = () => str.charCodeAt(index + 1);
      const advance = () => {
        prev = code;
        return str.charCodeAt(++index);
      };
      while (index < length) {
        code = advance();
        let next;
        if (code === CHAR_BACKWARD_SLASH) {
          backslashes = token.backslashes = true;
          code = advance();
          if (code === CHAR_LEFT_CURLY_BRACE) {
            braceEscaped = true;
          }
          continue;
        }
        if (braceEscaped === true || code === CHAR_LEFT_CURLY_BRACE) {
          braces++;
          while (eos() !== true && (code = advance())) {
            if (code === CHAR_BACKWARD_SLASH) {
              backslashes = token.backslashes = true;
              advance();
              continue;
            }
            if (code === CHAR_LEFT_CURLY_BRACE) {
              braces++;
              continue;
            }
            if (braceEscaped !== true && code === CHAR_DOT && (code = advance()) === CHAR_DOT) {
              isBrace = token.isBrace = true;
              isGlob = token.isGlob = true;
              finished = true;
              if (scanToEnd === true) {
                continue;
              }
              break;
            }
            if (braceEscaped !== true && code === CHAR_COMMA) {
              isBrace = token.isBrace = true;
              isGlob = token.isGlob = true;
              finished = true;
              if (scanToEnd === true) {
                continue;
              }
              break;
            }
            if (code === CHAR_RIGHT_CURLY_BRACE) {
              braces--;
              if (braces === 0) {
                braceEscaped = false;
                isBrace = token.isBrace = true;
                finished = true;
                break;
              }
            }
          }
          if (scanToEnd === true) {
            continue;
          }
          break;
        }
        if (code === CHAR_FORWARD_SLASH) {
          slashes.push(index);
          tokens.push(token);
          token = { value: "", depth: 0, isGlob: false };
          if (finished === true)
            continue;
          if (prev === CHAR_DOT && index === start + 1) {
            start += 2;
            continue;
          }
          lastIndex = index + 1;
          continue;
        }
        if (opts.noext !== true) {
          const isExtglobChar = code === CHAR_PLUS || code === CHAR_AT || code === CHAR_ASTERISK || code === CHAR_QUESTION_MARK || code === CHAR_EXCLAMATION_MARK;
          if (isExtglobChar === true && peek() === CHAR_LEFT_PARENTHESES) {
            isGlob = token.isGlob = true;
            isExtglob = token.isExtglob = true;
            finished = true;
            if (code === CHAR_EXCLAMATION_MARK && index === start) {
              negatedExtglob = true;
            }
            if (scanToEnd === true) {
              while (eos() !== true && (code = advance())) {
                if (code === CHAR_BACKWARD_SLASH) {
                  backslashes = token.backslashes = true;
                  code = advance();
                  continue;
                }
                if (code === CHAR_RIGHT_PARENTHESES) {
                  isGlob = token.isGlob = true;
                  finished = true;
                  break;
                }
              }
              continue;
            }
            break;
          }
        }
        if (code === CHAR_ASTERISK) {
          if (prev === CHAR_ASTERISK)
            isGlobstar = token.isGlobstar = true;
          isGlob = token.isGlob = true;
          finished = true;
          if (scanToEnd === true) {
            continue;
          }
          break;
        }
        if (code === CHAR_QUESTION_MARK) {
          isGlob = token.isGlob = true;
          finished = true;
          if (scanToEnd === true) {
            continue;
          }
          break;
        }
        if (code === CHAR_LEFT_SQUARE_BRACKET) {
          while (eos() !== true && (next = advance())) {
            if (next === CHAR_BACKWARD_SLASH) {
              backslashes = token.backslashes = true;
              advance();
              continue;
            }
            if (next === CHAR_RIGHT_SQUARE_BRACKET) {
              isBracket = token.isBracket = true;
              isGlob = token.isGlob = true;
              finished = true;
              break;
            }
          }
          if (scanToEnd === true) {
            continue;
          }
          break;
        }
        if (opts.nonegate !== true && code === CHAR_EXCLAMATION_MARK && index === start) {
          negated = token.negated = true;
          start++;
          continue;
        }
        if (opts.noparen !== true && code === CHAR_LEFT_PARENTHESES) {
          isGlob = token.isGlob = true;
          if (scanToEnd === true) {
            while (eos() !== true && (code = advance())) {
              if (code === CHAR_LEFT_PARENTHESES) {
                backslashes = token.backslashes = true;
                code = advance();
                continue;
              }
              if (code === CHAR_RIGHT_PARENTHESES) {
                finished = true;
                break;
              }
            }
            continue;
          }
          break;
        }
        if (isGlob === true) {
          finished = true;
          if (scanToEnd === true) {
            continue;
          }
          break;
        }
      }
      if (opts.noext === true) {
        isExtglob = false;
        isGlob = false;
      }
      let base = str;
      let prefix = "";
      let glob = "";
      if (start > 0) {
        prefix = str.slice(0, start);
        str = str.slice(start);
        lastIndex -= start;
      }
      if (base && isGlob === true && lastIndex > 0) {
        base = str.slice(0, lastIndex);
        glob = str.slice(lastIndex);
      } else if (isGlob === true) {
        base = "";
        glob = str;
      } else {
        base = str;
      }
      if (base && base !== "" && base !== "/" && base !== str) {
        if (isPathSeparator(base.charCodeAt(base.length - 1))) {
          base = base.slice(0, -1);
        }
      }
      if (opts.unescape === true) {
        if (glob)
          glob = utils.removeBackslashes(glob);
        if (base && backslashes === true) {
          base = utils.removeBackslashes(base);
        }
      }
      const state = {
        prefix,
        input,
        start,
        base,
        glob,
        isBrace,
        isBracket,
        isGlob,
        isExtglob,
        isGlobstar,
        negated,
        negatedExtglob
      };
      if (opts.tokens === true) {
        state.maxDepth = 0;
        if (!isPathSeparator(code)) {
          tokens.push(token);
        }
        state.tokens = tokens;
      }
      if (opts.parts === true || opts.tokens === true) {
        let prevIndex;
        for (let idx = 0; idx < slashes.length; idx++) {
          const n = prevIndex ? prevIndex + 1 : start;
          const i = slashes[idx];
          const value = input.slice(n, i);
          if (opts.tokens) {
            if (idx === 0 && start !== 0) {
              tokens[idx].isPrefix = true;
              tokens[idx].value = prefix;
            } else {
              tokens[idx].value = value;
            }
            depth(tokens[idx]);
            state.maxDepth += tokens[idx].depth;
          }
          if (idx !== 0 || value !== "") {
            parts.push(value);
          }
          prevIndex = i;
        }
        if (prevIndex && prevIndex + 1 < input.length) {
          const value = input.slice(prevIndex + 1);
          parts.push(value);
          if (opts.tokens) {
            tokens[tokens.length - 1].value = value;
            depth(tokens[tokens.length - 1]);
            state.maxDepth += tokens[tokens.length - 1].depth;
          }
        }
        state.slashes = slashes;
        state.parts = parts;
      }
      return state;
    };
    module.exports = scan;
  }
});

// node_modules/.pnpm/picomatch@2.3.1/node_modules/picomatch/lib/parse.js
var require_parse = _chunkGQ77QZBOjs.__commonJS.call(void 0, {
  "node_modules/.pnpm/picomatch@2.3.1/node_modules/picomatch/lib/parse.js"(exports, module) {
    "use strict";
    var constants = require_constants();
    var utils = require_utils();
    var {
      MAX_LENGTH,
      POSIX_REGEX_SOURCE,
      REGEX_NON_SPECIAL_CHARS,
      REGEX_SPECIAL_CHARS_BACKREF,
      REPLACEMENTS
    } = constants;
    var expandRange = (args, options) => {
      if (typeof options.expandRange === "function") {
        return options.expandRange(...args, options);
      }
      args.sort();
      const value = `[${args.join("-")}]`;
      try {
        new RegExp(value);
      } catch (ex) {
        return args.map((v) => utils.escapeRegex(v)).join("..");
      }
      return value;
    };
    var syntaxError = (type, char) => {
      return `Missing ${type}: "${char}" - use "\\\\${char}" to match literal characters`;
    };
    var parse = (input, options) => {
      if (typeof input !== "string") {
        throw new TypeError("Expected a string");
      }
      input = REPLACEMENTS[input] || input;
      const opts = { ...options };
      const max = typeof opts.maxLength === "number" ? Math.min(MAX_LENGTH, opts.maxLength) : MAX_LENGTH;
      let len = input.length;
      if (len > max) {
        throw new SyntaxError(`Input length: ${len}, exceeds maximum allowed length: ${max}`);
      }
      const bos = { type: "bos", value: "", output: opts.prepend || "" };
      const tokens = [bos];
      const capture = opts.capture ? "" : "?:";
      const win322 = utils.isWindows(options);
      const PLATFORM_CHARS = constants.globChars(win322);
      const EXTGLOB_CHARS = constants.extglobChars(PLATFORM_CHARS);
      const {
        DOT_LITERAL,
        PLUS_LITERAL,
        SLASH_LITERAL,
        ONE_CHAR,
        DOTS_SLASH,
        NO_DOT,
        NO_DOT_SLASH,
        NO_DOTS_SLASH,
        QMARK,
        QMARK_NO_DOT,
        STAR,
        START_ANCHOR
      } = PLATFORM_CHARS;
      const globstar = (opts2) => {
        return `(${capture}(?:(?!${START_ANCHOR}${opts2.dot ? DOTS_SLASH : DOT_LITERAL}).)*?)`;
      };
      const nodot = opts.dot ? "" : NO_DOT;
      const qmarkNoDot = opts.dot ? QMARK : QMARK_NO_DOT;
      let star = opts.bash === true ? globstar(opts) : STAR;
      if (opts.capture) {
        star = `(${star})`;
      }
      if (typeof opts.noext === "boolean") {
        opts.noextglob = opts.noext;
      }
      const state = {
        input,
        index: -1,
        start: 0,
        dot: opts.dot === true,
        consumed: "",
        output: "",
        prefix: "",
        backtrack: false,
        negated: false,
        brackets: 0,
        braces: 0,
        parens: 0,
        quotes: 0,
        globstar: false,
        tokens
      };
      input = utils.removePrefix(input, state);
      len = input.length;
      const extglobs = [];
      const braces = [];
      const stack = [];
      let prev = bos;
      let value;
      const eos = () => state.index === len - 1;
      const peek = state.peek = (n = 1) => input[state.index + n];
      const advance = state.advance = () => input[++state.index] || "";
      const remaining = () => input.slice(state.index + 1);
      const consume = (value2 = "", num = 0) => {
        state.consumed += value2;
        state.index += num;
      };
      const append = (token) => {
        state.output += token.output != null ? token.output : token.value;
        consume(token.value);
      };
      const negate = () => {
        let count = 1;
        while (peek() === "!" && (peek(2) !== "(" || peek(3) === "?")) {
          advance();
          state.start++;
          count++;
        }
        if (count % 2 === 0) {
          return false;
        }
        state.negated = true;
        state.start++;
        return true;
      };
      const increment = (type) => {
        state[type]++;
        stack.push(type);
      };
      const decrement = (type) => {
        state[type]--;
        stack.pop();
      };
      const push = (tok) => {
        if (prev.type === "globstar") {
          const isBrace = state.braces > 0 && (tok.type === "comma" || tok.type === "brace");
          const isExtglob = tok.extglob === true || extglobs.length && (tok.type === "pipe" || tok.type === "paren");
          if (tok.type !== "slash" && tok.type !== "paren" && !isBrace && !isExtglob) {
            state.output = state.output.slice(0, -prev.output.length);
            prev.type = "star";
            prev.value = "*";
            prev.output = star;
            state.output += prev.output;
          }
        }
        if (extglobs.length && tok.type !== "paren") {
          extglobs[extglobs.length - 1].inner += tok.value;
        }
        if (tok.value || tok.output)
          append(tok);
        if (prev && prev.type === "text" && tok.type === "text") {
          prev.value += tok.value;
          prev.output = (prev.output || "") + tok.value;
          return;
        }
        tok.prev = prev;
        tokens.push(tok);
        prev = tok;
      };
      const extglobOpen = (type, value2) => {
        const token = { ...EXTGLOB_CHARS[value2], conditions: 1, inner: "" };
        token.prev = prev;
        token.parens = state.parens;
        token.output = state.output;
        const output = (opts.capture ? "(" : "") + token.open;
        increment("parens");
        push({ type, value: value2, output: state.output ? "" : ONE_CHAR });
        push({ type: "paren", extglob: true, value: advance(), output });
        extglobs.push(token);
      };
      const extglobClose = (token) => {
        let output = token.close + (opts.capture ? ")" : "");
        let rest;
        if (token.type === "negate") {
          let extglobStar = star;
          if (token.inner && token.inner.length > 1 && token.inner.includes("/")) {
            extglobStar = globstar(opts);
          }
          if (extglobStar !== star || eos() || /^\)+$/.test(remaining())) {
            output = token.close = `)$))${extglobStar}`;
          }
          if (token.inner.includes("*") && (rest = remaining()) && /^\.[^\\/.]+$/.test(rest)) {
            const expression = parse(rest, { ...options, fastpaths: false }).output;
            output = token.close = `)${expression})${extglobStar})`;
          }
          if (token.prev.type === "bos") {
            state.negatedExtglob = true;
          }
        }
        push({ type: "paren", extglob: true, value, output });
        decrement("parens");
      };
      if (opts.fastpaths !== false && !/(^[*!]|[/()[\]{}"])/.test(input)) {
        let backslashes = false;
        let output = input.replace(REGEX_SPECIAL_CHARS_BACKREF, (m, esc, chars, first, rest, index) => {
          if (first === "\\") {
            backslashes = true;
            return m;
          }
          if (first === "?") {
            if (esc) {
              return esc + first + (rest ? QMARK.repeat(rest.length) : "");
            }
            if (index === 0) {
              return qmarkNoDot + (rest ? QMARK.repeat(rest.length) : "");
            }
            return QMARK.repeat(chars.length);
          }
          if (first === ".") {
            return DOT_LITERAL.repeat(chars.length);
          }
          if (first === "*") {
            if (esc) {
              return esc + first + (rest ? star : "");
            }
            return star;
          }
          return esc ? m : `\\${m}`;
        });
        if (backslashes === true) {
          if (opts.unescape === true) {
            output = output.replace(/\\/g, "");
          } else {
            output = output.replace(/\\+/g, (m) => {
              return m.length % 2 === 0 ? "\\\\" : m ? "\\" : "";
            });
          }
        }
        if (output === input && opts.contains === true) {
          state.output = input;
          return state;
        }
        state.output = utils.wrapOutput(output, state, options);
        return state;
      }
      while (!eos()) {
        value = advance();
        if (value === "\0") {
          continue;
        }
        if (value === "\\") {
          const next = peek();
          if (next === "/" && opts.bash !== true) {
            continue;
          }
          if (next === "." || next === ";") {
            continue;
          }
          if (!next) {
            value += "\\";
            push({ type: "text", value });
            continue;
          }
          const match = /^\\+/.exec(remaining());
          let slashes = 0;
          if (match && match[0].length > 2) {
            slashes = match[0].length;
            state.index += slashes;
            if (slashes % 2 !== 0) {
              value += "\\";
            }
          }
          if (opts.unescape === true) {
            value = advance();
          } else {
            value += advance();
          }
          if (state.brackets === 0) {
            push({ type: "text", value });
            continue;
          }
        }
        if (state.brackets > 0 && (value !== "]" || prev.value === "[" || prev.value === "[^")) {
          if (opts.posix !== false && value === ":") {
            const inner = prev.value.slice(1);
            if (inner.includes("[")) {
              prev.posix = true;
              if (inner.includes(":")) {
                const idx = prev.value.lastIndexOf("[");
                const pre = prev.value.slice(0, idx);
                const rest2 = prev.value.slice(idx + 2);
                const posix2 = POSIX_REGEX_SOURCE[rest2];
                if (posix2) {
                  prev.value = pre + posix2;
                  state.backtrack = true;
                  advance();
                  if (!bos.output && tokens.indexOf(prev) === 1) {
                    bos.output = ONE_CHAR;
                  }
                  continue;
                }
              }
            }
          }
          if (value === "[" && peek() !== ":" || value === "-" && peek() === "]") {
            value = `\\${value}`;
          }
          if (value === "]" && (prev.value === "[" || prev.value === "[^")) {
            value = `\\${value}`;
          }
          if (opts.posix === true && value === "!" && prev.value === "[") {
            value = "^";
          }
          prev.value += value;
          append({ value });
          continue;
        }
        if (state.quotes === 1 && value !== '"') {
          value = utils.escapeRegex(value);
          prev.value += value;
          append({ value });
          continue;
        }
        if (value === '"') {
          state.quotes = state.quotes === 1 ? 0 : 1;
          if (opts.keepQuotes === true) {
            push({ type: "text", value });
          }
          continue;
        }
        if (value === "(") {
          increment("parens");
          push({ type: "paren", value });
          continue;
        }
        if (value === ")") {
          if (state.parens === 0 && opts.strictBrackets === true) {
            throw new SyntaxError(syntaxError("opening", "("));
          }
          const extglob = extglobs[extglobs.length - 1];
          if (extglob && state.parens === extglob.parens + 1) {
            extglobClose(extglobs.pop());
            continue;
          }
          push({ type: "paren", value, output: state.parens ? ")" : "\\)" });
          decrement("parens");
          continue;
        }
        if (value === "[") {
          if (opts.nobracket === true || !remaining().includes("]")) {
            if (opts.nobracket !== true && opts.strictBrackets === true) {
              throw new SyntaxError(syntaxError("closing", "]"));
            }
            value = `\\${value}`;
          } else {
            increment("brackets");
          }
          push({ type: "bracket", value });
          continue;
        }
        if (value === "]") {
          if (opts.nobracket === true || prev && prev.type === "bracket" && prev.value.length === 1) {
            push({ type: "text", value, output: `\\${value}` });
            continue;
          }
          if (state.brackets === 0) {
            if (opts.strictBrackets === true) {
              throw new SyntaxError(syntaxError("opening", "["));
            }
            push({ type: "text", value, output: `\\${value}` });
            continue;
          }
          decrement("brackets");
          const prevValue = prev.value.slice(1);
          if (prev.posix !== true && prevValue[0] === "^" && !prevValue.includes("/")) {
            value = `/${value}`;
          }
          prev.value += value;
          append({ value });
          if (opts.literalBrackets === false || utils.hasRegexChars(prevValue)) {
            continue;
          }
          const escaped = utils.escapeRegex(prev.value);
          state.output = state.output.slice(0, -prev.value.length);
          if (opts.literalBrackets === true) {
            state.output += escaped;
            prev.value = escaped;
            continue;
          }
          prev.value = `(${capture}${escaped}|${prev.value})`;
          state.output += prev.value;
          continue;
        }
        if (value === "{" && opts.nobrace !== true) {
          increment("braces");
          const open = {
            type: "brace",
            value,
            output: "(",
            outputIndex: state.output.length,
            tokensIndex: state.tokens.length
          };
          braces.push(open);
          push(open);
          continue;
        }
        if (value === "}") {
          const brace = braces[braces.length - 1];
          if (opts.nobrace === true || !brace) {
            push({ type: "text", value, output: value });
            continue;
          }
          let output = ")";
          if (brace.dots === true) {
            const arr = tokens.slice();
            const range = [];
            for (let i = arr.length - 1; i >= 0; i--) {
              tokens.pop();
              if (arr[i].type === "brace") {
                break;
              }
              if (arr[i].type !== "dots") {
                range.unshift(arr[i].value);
              }
            }
            output = expandRange(range, opts);
            state.backtrack = true;
          }
          if (brace.comma !== true && brace.dots !== true) {
            const out = state.output.slice(0, brace.outputIndex);
            const toks = state.tokens.slice(brace.tokensIndex);
            brace.value = brace.output = "\\{";
            value = output = "\\}";
            state.output = out;
            for (const t of toks) {
              state.output += t.output || t.value;
            }
          }
          push({ type: "brace", value, output });
          decrement("braces");
          braces.pop();
          continue;
        }
        if (value === "|") {
          if (extglobs.length > 0) {
            extglobs[extglobs.length - 1].conditions++;
          }
          push({ type: "text", value });
          continue;
        }
        if (value === ",") {
          let output = value;
          const brace = braces[braces.length - 1];
          if (brace && stack[stack.length - 1] === "braces") {
            brace.comma = true;
            output = "|";
          }
          push({ type: "comma", value, output });
          continue;
        }
        if (value === "/") {
          if (prev.type === "dot" && state.index === state.start + 1) {
            state.start = state.index + 1;
            state.consumed = "";
            state.output = "";
            tokens.pop();
            prev = bos;
            continue;
          }
          push({ type: "slash", value, output: SLASH_LITERAL });
          continue;
        }
        if (value === ".") {
          if (state.braces > 0 && prev.type === "dot") {
            if (prev.value === ".")
              prev.output = DOT_LITERAL;
            const brace = braces[braces.length - 1];
            prev.type = "dots";
            prev.output += value;
            prev.value += value;
            brace.dots = true;
            continue;
          }
          if (state.braces + state.parens === 0 && prev.type !== "bos" && prev.type !== "slash") {
            push({ type: "text", value, output: DOT_LITERAL });
            continue;
          }
          push({ type: "dot", value, output: DOT_LITERAL });
          continue;
        }
        if (value === "?") {
          const isGroup = prev && prev.value === "(";
          if (!isGroup && opts.noextglob !== true && peek() === "(" && peek(2) !== "?") {
            extglobOpen("qmark", value);
            continue;
          }
          if (prev && prev.type === "paren") {
            const next = peek();
            let output = value;
            if (next === "<" && !utils.supportsLookbehinds()) {
              throw new Error("Node.js v10 or higher is required for regex lookbehinds");
            }
            if (prev.value === "(" && !/[!=<:]/.test(next) || next === "<" && !/<([!=]|\w+>)/.test(remaining())) {
              output = `\\${value}`;
            }
            push({ type: "text", value, output });
            continue;
          }
          if (opts.dot !== true && (prev.type === "slash" || prev.type === "bos")) {
            push({ type: "qmark", value, output: QMARK_NO_DOT });
            continue;
          }
          push({ type: "qmark", value, output: QMARK });
          continue;
        }
        if (value === "!") {
          if (opts.noextglob !== true && peek() === "(") {
            if (peek(2) !== "?" || !/[!=<:]/.test(peek(3))) {
              extglobOpen("negate", value);
              continue;
            }
          }
          if (opts.nonegate !== true && state.index === 0) {
            negate();
            continue;
          }
        }
        if (value === "+") {
          if (opts.noextglob !== true && peek() === "(" && peek(2) !== "?") {
            extglobOpen("plus", value);
            continue;
          }
          if (prev && prev.value === "(" || opts.regex === false) {
            push({ type: "plus", value, output: PLUS_LITERAL });
            continue;
          }
          if (prev && (prev.type === "bracket" || prev.type === "paren" || prev.type === "brace") || state.parens > 0) {
            push({ type: "plus", value });
            continue;
          }
          push({ type: "plus", value: PLUS_LITERAL });
          continue;
        }
        if (value === "@") {
          if (opts.noextglob !== true && peek() === "(" && peek(2) !== "?") {
            push({ type: "at", extglob: true, value, output: "" });
            continue;
          }
          push({ type: "text", value });
          continue;
        }
        if (value !== "*") {
          if (value === "$" || value === "^") {
            value = `\\${value}`;
          }
          const match = REGEX_NON_SPECIAL_CHARS.exec(remaining());
          if (match) {
            value += match[0];
            state.index += match[0].length;
          }
          push({ type: "text", value });
          continue;
        }
        if (prev && (prev.type === "globstar" || prev.star === true)) {
          prev.type = "star";
          prev.star = true;
          prev.value += value;
          prev.output = star;
          state.backtrack = true;
          state.globstar = true;
          consume(value);
          continue;
        }
        let rest = remaining();
        if (opts.noextglob !== true && /^\([^?]/.test(rest)) {
          extglobOpen("star", value);
          continue;
        }
        if (prev.type === "star") {
          if (opts.noglobstar === true) {
            consume(value);
            continue;
          }
          const prior = prev.prev;
          const before = prior.prev;
          const isStart = prior.type === "slash" || prior.type === "bos";
          const afterStar = before && (before.type === "star" || before.type === "globstar");
          if (opts.bash === true && (!isStart || rest[0] && rest[0] !== "/")) {
            push({ type: "star", value, output: "" });
            continue;
          }
          const isBrace = state.braces > 0 && (prior.type === "comma" || prior.type === "brace");
          const isExtglob = extglobs.length && (prior.type === "pipe" || prior.type === "paren");
          if (!isStart && prior.type !== "paren" && !isBrace && !isExtglob) {
            push({ type: "star", value, output: "" });
            continue;
          }
          while (rest.slice(0, 3) === "/**") {
            const after = input[state.index + 4];
            if (after && after !== "/") {
              break;
            }
            rest = rest.slice(3);
            consume("/**", 3);
          }
          if (prior.type === "bos" && eos()) {
            prev.type = "globstar";
            prev.value += value;
            prev.output = globstar(opts);
            state.output = prev.output;
            state.globstar = true;
            consume(value);
            continue;
          }
          if (prior.type === "slash" && prior.prev.type !== "bos" && !afterStar && eos()) {
            state.output = state.output.slice(0, -(prior.output + prev.output).length);
            prior.output = `(?:${prior.output}`;
            prev.type = "globstar";
            prev.output = globstar(opts) + (opts.strictSlashes ? ")" : "|$)");
            prev.value += value;
            state.globstar = true;
            state.output += prior.output + prev.output;
            consume(value);
            continue;
          }
          if (prior.type === "slash" && prior.prev.type !== "bos" && rest[0] === "/") {
            const end = rest[1] !== void 0 ? "|$" : "";
            state.output = state.output.slice(0, -(prior.output + prev.output).length);
            prior.output = `(?:${prior.output}`;
            prev.type = "globstar";
            prev.output = `${globstar(opts)}${SLASH_LITERAL}|${SLASH_LITERAL}${end})`;
            prev.value += value;
            state.output += prior.output + prev.output;
            state.globstar = true;
            consume(value + advance());
            push({ type: "slash", value: "/", output: "" });
            continue;
          }
          if (prior.type === "bos" && rest[0] === "/") {
            prev.type = "globstar";
            prev.value += value;
            prev.output = `(?:^|${SLASH_LITERAL}|${globstar(opts)}${SLASH_LITERAL})`;
            state.output = prev.output;
            state.globstar = true;
            consume(value + advance());
            push({ type: "slash", value: "/", output: "" });
            continue;
          }
          state.output = state.output.slice(0, -prev.output.length);
          prev.type = "globstar";
          prev.output = globstar(opts);
          prev.value += value;
          state.output += prev.output;
          state.globstar = true;
          consume(value);
          continue;
        }
        const token = { type: "star", value, output: star };
        if (opts.bash === true) {
          token.output = ".*?";
          if (prev.type === "bos" || prev.type === "slash") {
            token.output = nodot + token.output;
          }
          push(token);
          continue;
        }
        if (prev && (prev.type === "bracket" || prev.type === "paren") && opts.regex === true) {
          token.output = value;
          push(token);
          continue;
        }
        if (state.index === state.start || prev.type === "slash" || prev.type === "dot") {
          if (prev.type === "dot") {
            state.output += NO_DOT_SLASH;
            prev.output += NO_DOT_SLASH;
          } else if (opts.dot === true) {
            state.output += NO_DOTS_SLASH;
            prev.output += NO_DOTS_SLASH;
          } else {
            state.output += nodot;
            prev.output += nodot;
          }
          if (peek() !== "*") {
            state.output += ONE_CHAR;
            prev.output += ONE_CHAR;
          }
        }
        push(token);
      }
      while (state.brackets > 0) {
        if (opts.strictBrackets === true)
          throw new SyntaxError(syntaxError("closing", "]"));
        state.output = utils.escapeLast(state.output, "[");
        decrement("brackets");
      }
      while (state.parens > 0) {
        if (opts.strictBrackets === true)
          throw new SyntaxError(syntaxError("closing", ")"));
        state.output = utils.escapeLast(state.output, "(");
        decrement("parens");
      }
      while (state.braces > 0) {
        if (opts.strictBrackets === true)
          throw new SyntaxError(syntaxError("closing", "}"));
        state.output = utils.escapeLast(state.output, "{");
        decrement("braces");
      }
      if (opts.strictSlashes !== true && (prev.type === "star" || prev.type === "bracket")) {
        push({ type: "maybe_slash", value: "", output: `${SLASH_LITERAL}?` });
      }
      if (state.backtrack === true) {
        state.output = "";
        for (const token of state.tokens) {
          state.output += token.output != null ? token.output : token.value;
          if (token.suffix) {
            state.output += token.suffix;
          }
        }
      }
      return state;
    };
    parse.fastpaths = (input, options) => {
      const opts = { ...options };
      const max = typeof opts.maxLength === "number" ? Math.min(MAX_LENGTH, opts.maxLength) : MAX_LENGTH;
      const len = input.length;
      if (len > max) {
        throw new SyntaxError(`Input length: ${len}, exceeds maximum allowed length: ${max}`);
      }
      input = REPLACEMENTS[input] || input;
      const win322 = utils.isWindows(options);
      const {
        DOT_LITERAL,
        SLASH_LITERAL,
        ONE_CHAR,
        DOTS_SLASH,
        NO_DOT,
        NO_DOTS,
        NO_DOTS_SLASH,
        STAR,
        START_ANCHOR
      } = constants.globChars(win322);
      const nodot = opts.dot ? NO_DOTS : NO_DOT;
      const slashDot = opts.dot ? NO_DOTS_SLASH : NO_DOT;
      const capture = opts.capture ? "" : "?:";
      const state = { negated: false, prefix: "" };
      let star = opts.bash === true ? ".*?" : STAR;
      if (opts.capture) {
        star = `(${star})`;
      }
      const globstar = (opts2) => {
        if (opts2.noglobstar === true)
          return star;
        return `(${capture}(?:(?!${START_ANCHOR}${opts2.dot ? DOTS_SLASH : DOT_LITERAL}).)*?)`;
      };
      const create = (str) => {
        switch (str) {
          case "*":
            return `${nodot}${ONE_CHAR}${star}`;
          case ".*":
            return `${DOT_LITERAL}${ONE_CHAR}${star}`;
          case "*.*":
            return `${nodot}${star}${DOT_LITERAL}${ONE_CHAR}${star}`;
          case "*/*":
            return `${nodot}${star}${SLASH_LITERAL}${ONE_CHAR}${slashDot}${star}`;
          case "**":
            return nodot + globstar(opts);
          case "**/*":
            return `(?:${nodot}${globstar(opts)}${SLASH_LITERAL})?${slashDot}${ONE_CHAR}${star}`;
          case "**/*.*":
            return `(?:${nodot}${globstar(opts)}${SLASH_LITERAL})?${slashDot}${star}${DOT_LITERAL}${ONE_CHAR}${star}`;
          case "**/.*":
            return `(?:${nodot}${globstar(opts)}${SLASH_LITERAL})?${DOT_LITERAL}${ONE_CHAR}${star}`;
          default: {
            const match = /^(.*?)\.(\w+)$/.exec(str);
            if (!match)
              return;
            const source2 = create(match[1]);
            if (!source2)
              return;
            return source2 + DOT_LITERAL + match[2];
          }
        }
      };
      const output = utils.removePrefix(input, state);
      let source = create(output);
      if (source && opts.strictSlashes !== true) {
        source += `${SLASH_LITERAL}?`;
      }
      return source;
    };
    module.exports = parse;
  }
});

// node_modules/.pnpm/picomatch@2.3.1/node_modules/picomatch/lib/picomatch.js
var require_picomatch = _chunkGQ77QZBOjs.__commonJS.call(void 0, {
  "node_modules/.pnpm/picomatch@2.3.1/node_modules/picomatch/lib/picomatch.js"(exports, module) {
    "use strict";
    var path3 = _chunkGQ77QZBOjs.__require.call(void 0, "path");
    var scan = require_scan();
    var parse = require_parse();
    var utils = require_utils();
    var constants = require_constants();
    var isObject = (val) => val && typeof val === "object" && !Array.isArray(val);
    var picomatch = (glob, options, returnState = false) => {
      if (Array.isArray(glob)) {
        const fns = glob.map((input) => picomatch(input, options, returnState));
        const arrayMatcher = (str) => {
          for (const isMatch of fns) {
            const state2 = isMatch(str);
            if (state2)
              return state2;
          }
          return false;
        };
        return arrayMatcher;
      }
      const isState = isObject(glob) && glob.tokens && glob.input;
      if (glob === "" || typeof glob !== "string" && !isState) {
        throw new TypeError("Expected pattern to be a non-empty string");
      }
      const opts = options || {};
      const posix2 = utils.isWindows(options);
      const regex = isState ? picomatch.compileRe(glob, options) : picomatch.makeRe(glob, options, false, true);
      const state = regex.state;
      delete regex.state;
      let isIgnored = () => false;
      if (opts.ignore) {
        const ignoreOpts = { ...options, ignore: null, onMatch: null, onResult: null };
        isIgnored = picomatch(opts.ignore, ignoreOpts, returnState);
      }
      const matcher = (input, returnObject = false) => {
        const { isMatch, match, output } = picomatch.test(input, regex, options, { glob, posix: posix2 });
        const result = { glob, state, regex, posix: posix2, input, output, match, isMatch };
        if (typeof opts.onResult === "function") {
          opts.onResult(result);
        }
        if (isMatch === false) {
          result.isMatch = false;
          return returnObject ? result : false;
        }
        if (isIgnored(input)) {
          if (typeof opts.onIgnore === "function") {
            opts.onIgnore(result);
          }
          result.isMatch = false;
          return returnObject ? result : false;
        }
        if (typeof opts.onMatch === "function") {
          opts.onMatch(result);
        }
        return returnObject ? result : true;
      };
      if (returnState) {
        matcher.state = state;
      }
      return matcher;
    };
    picomatch.test = (input, regex, options, { glob, posix: posix2 } = {}) => {
      if (typeof input !== "string") {
        throw new TypeError("Expected input to be a string");
      }
      if (input === "") {
        return { isMatch: false, output: "" };
      }
      const opts = options || {};
      const format = opts.format || (posix2 ? utils.toPosixSlashes : null);
      let match = input === glob;
      let output = match && format ? format(input) : input;
      if (match === false) {
        output = format ? format(input) : input;
        match = output === glob;
      }
      if (match === false || opts.capture === true) {
        if (opts.matchBase === true || opts.basename === true) {
          match = picomatch.matchBase(input, regex, options, posix2);
        } else {
          match = regex.exec(output);
        }
      }
      return { isMatch: Boolean(match), match, output };
    };
    picomatch.matchBase = (input, glob, options, posix2 = utils.isWindows(options)) => {
      const regex = glob instanceof RegExp ? glob : picomatch.makeRe(glob, options);
      return regex.test(path3.basename(input));
    };
    picomatch.isMatch = (str, patterns, options) => picomatch(patterns, options)(str);
    picomatch.parse = (pattern, options) => {
      if (Array.isArray(pattern))
        return pattern.map((p) => picomatch.parse(p, options));
      return parse(pattern, { ...options, fastpaths: false });
    };
    picomatch.scan = (input, options) => scan(input, options);
    picomatch.compileRe = (state, options, returnOutput = false, returnState = false) => {
      if (returnOutput === true) {
        return state.output;
      }
      const opts = options || {};
      const prepend = opts.contains ? "" : "^";
      const append = opts.contains ? "" : "$";
      let source = `${prepend}(?:${state.output})${append}`;
      if (state && state.negated === true) {
        source = `^(?!${source}).*$`;
      }
      const regex = picomatch.toRegex(source, options);
      if (returnState === true) {
        regex.state = state;
      }
      return regex;
    };
    picomatch.makeRe = (input, options = {}, returnOutput = false, returnState = false) => {
      if (!input || typeof input !== "string") {
        throw new TypeError("Expected a non-empty string");
      }
      let parsed = { negated: false, fastpaths: true };
      if (options.fastpaths !== false && (input[0] === "." || input[0] === "*")) {
        parsed.output = parse.fastpaths(input, options);
      }
      if (!parsed.output) {
        parsed = parse(input, options);
      }
      return picomatch.compileRe(parsed, options, returnOutput, returnState);
    };
    picomatch.toRegex = (source, options) => {
      try {
        const opts = options || {};
        return new RegExp(source, opts.flags || (opts.nocase ? "i" : ""));
      } catch (err) {
        if (options && options.debug === true)
          throw err;
        return /$^/;
      }
    };
    picomatch.constants = constants;
    module.exports = picomatch;
  }
});

// node_modules/.pnpm/picomatch@2.3.1/node_modules/picomatch/index.js
var require_picomatch2 = _chunkGQ77QZBOjs.__commonJS.call(void 0, {
  "node_modules/.pnpm/picomatch@2.3.1/node_modules/picomatch/index.js"(exports, module) {
    "use strict";
    module.exports = require_picomatch();
  }
});

// node_modules/.pnpm/resolve@1.20.0/node_modules/resolve/lib/caller.js
var require_caller = _chunkGQ77QZBOjs.__commonJS.call(void 0, {
  "node_modules/.pnpm/resolve@1.20.0/node_modules/resolve/lib/caller.js"(exports, module) {
    "use strict";
    module.exports = function() {
      var origPrepareStackTrace = Error.prepareStackTrace;
      Error.prepareStackTrace = function(_, stack2) {
        return stack2;
      };
      var stack = new Error().stack;
      Error.prepareStackTrace = origPrepareStackTrace;
      return stack[2].getFileName();
    };
  }
});

// node_modules/.pnpm/path-parse@1.0.7/node_modules/path-parse/index.js
var require_path_parse = _chunkGQ77QZBOjs.__commonJS.call(void 0, {
  "node_modules/.pnpm/path-parse@1.0.7/node_modules/path-parse/index.js"(exports, module) {
    "use strict";
    var isWindows = process.platform === "win32";
    var splitWindowsRe = /^(((?:[a-zA-Z]:|[\\\/]{2}[^\\\/]+[\\\/]+[^\\\/]+)?[\\\/]?)(?:[^\\\/]*[\\\/])*)((\.{1,2}|[^\\\/]+?|)(\.[^.\/\\]*|))[\\\/]*$/;
    var win322 = {};
    function win32SplitPath(filename) {
      return splitWindowsRe.exec(filename).slice(1);
    }
    win322.parse = function(pathString) {
      if (typeof pathString !== "string") {
        throw new TypeError(
          "Parameter 'pathString' must be a string, not " + typeof pathString
        );
      }
      var allParts = win32SplitPath(pathString);
      if (!allParts || allParts.length !== 5) {
        throw new TypeError("Invalid path '" + pathString + "'");
      }
      return {
        root: allParts[1],
        dir: allParts[0] === allParts[1] ? allParts[0] : allParts[0].slice(0, -1),
        base: allParts[2],
        ext: allParts[4],
        name: allParts[3]
      };
    };
    var splitPathRe = /^((\/?)(?:[^\/]*\/)*)((\.{1,2}|[^\/]+?|)(\.[^.\/]*|))[\/]*$/;
    var posix2 = {};
    function posixSplitPath(filename) {
      return splitPathRe.exec(filename).slice(1);
    }
    posix2.parse = function(pathString) {
      if (typeof pathString !== "string") {
        throw new TypeError(
          "Parameter 'pathString' must be a string, not " + typeof pathString
        );
      }
      var allParts = posixSplitPath(pathString);
      if (!allParts || allParts.length !== 5) {
        throw new TypeError("Invalid path '" + pathString + "'");
      }
      return {
        root: allParts[1],
        dir: allParts[0].slice(0, -1),
        base: allParts[2],
        ext: allParts[4],
        name: allParts[3]
      };
    };
    if (isWindows)
      module.exports = win322.parse;
    else
      module.exports = posix2.parse;
    module.exports.posix = posix2.parse;
    module.exports.win32 = win322.parse;
  }
});

// node_modules/.pnpm/resolve@1.20.0/node_modules/resolve/lib/node-modules-paths.js
var require_node_modules_paths = _chunkGQ77QZBOjs.__commonJS.call(void 0, {
  "node_modules/.pnpm/resolve@1.20.0/node_modules/resolve/lib/node-modules-paths.js"(exports, module) {
    "use strict";
    var path3 = _chunkGQ77QZBOjs.__require.call(void 0, "path");
    var parse = path3.parse || require_path_parse();
    var getNodeModulesDirs = function getNodeModulesDirs2(absoluteStart, modules) {
      var prefix = "/";
      if (/^([A-Za-z]:)/.test(absoluteStart)) {
        prefix = "";
      } else if (/^\\\\/.test(absoluteStart)) {
        prefix = "\\\\";
      }
      var paths = [absoluteStart];
      var parsed = parse(absoluteStart);
      while (parsed.dir !== paths[paths.length - 1]) {
        paths.push(parsed.dir);
        parsed = parse(parsed.dir);
      }
      return paths.reduce(function(dirs, aPath) {
        return dirs.concat(modules.map(function(moduleDir) {
          return path3.resolve(prefix, aPath, moduleDir);
        }));
      }, []);
    };
    module.exports = function nodeModulesPaths(start, opts, request) {
      var modules = opts && opts.moduleDirectory ? [].concat(opts.moduleDirectory) : ["node_modules"];
      if (opts && typeof opts.paths === "function") {
        return opts.paths(
          request,
          start,
          function() {
            return getNodeModulesDirs(start, modules);
          },
          opts
        );
      }
      var dirs = getNodeModulesDirs(start, modules);
      return opts && opts.paths ? dirs.concat(opts.paths) : dirs;
    };
  }
});

// node_modules/.pnpm/resolve@1.20.0/node_modules/resolve/lib/normalize-options.js
var require_normalize_options = _chunkGQ77QZBOjs.__commonJS.call(void 0, {
  "node_modules/.pnpm/resolve@1.20.0/node_modules/resolve/lib/normalize-options.js"(exports, module) {
    "use strict";
    module.exports = function(x, opts) {
      return opts || {};
    };
  }
});

// node_modules/.pnpm/function-bind@1.1.1/node_modules/function-bind/implementation.js
var require_implementation = _chunkGQ77QZBOjs.__commonJS.call(void 0, {
  "node_modules/.pnpm/function-bind@1.1.1/node_modules/function-bind/implementation.js"(exports, module) {
    "use strict";
    var ERROR_MESSAGE = "Function.prototype.bind called on incompatible ";
    var slice = Array.prototype.slice;
    var toStr = Object.prototype.toString;
    var funcType = "[object Function]";
    module.exports = function bind(that) {
      var target = this;
      if (typeof target !== "function" || toStr.call(target) !== funcType) {
        throw new TypeError(ERROR_MESSAGE + target);
      }
      var args = slice.call(arguments, 1);
      var bound;
      var binder = function() {
        if (this instanceof bound) {
          var result = target.apply(
            this,
            args.concat(slice.call(arguments))
          );
          if (Object(result) === result) {
            return result;
          }
          return this;
        } else {
          return target.apply(
            that,
            args.concat(slice.call(arguments))
          );
        }
      };
      var boundLength = Math.max(0, target.length - args.length);
      var boundArgs = [];
      for (var i = 0; i < boundLength; i++) {
        boundArgs.push("$" + i);
      }
      bound = Function("binder", "return function (" + boundArgs.join(",") + "){ return binder.apply(this,arguments); }")(binder);
      if (target.prototype) {
        var Empty = function Empty2() {
        };
        Empty.prototype = target.prototype;
        bound.prototype = new Empty();
        Empty.prototype = null;
      }
      return bound;
    };
  }
});

// node_modules/.pnpm/function-bind@1.1.1/node_modules/function-bind/index.js
var require_function_bind = _chunkGQ77QZBOjs.__commonJS.call(void 0, {
  "node_modules/.pnpm/function-bind@1.1.1/node_modules/function-bind/index.js"(exports, module) {
    "use strict";
    var implementation = require_implementation();
    module.exports = Function.prototype.bind || implementation;
  }
});

// node_modules/.pnpm/has@1.0.3/node_modules/has/src/index.js
var require_src = _chunkGQ77QZBOjs.__commonJS.call(void 0, {
  "node_modules/.pnpm/has@1.0.3/node_modules/has/src/index.js"(exports, module) {
    "use strict";
    var bind = require_function_bind();
    module.exports = bind.call(Function.call, Object.prototype.hasOwnProperty);
  }
});

// node_modules/.pnpm/is-core-module@2.8.0/node_modules/is-core-module/core.json
var require_core = _chunkGQ77QZBOjs.__commonJS.call(void 0, {
  "node_modules/.pnpm/is-core-module@2.8.0/node_modules/is-core-module/core.json"(exports, module) {
    module.exports = {
      assert: true,
      "node:assert": [">= 14.18 && < 15", ">= 16"],
      "assert/strict": ">= 15",
      "node:assert/strict": ">= 16",
      async_hooks: ">= 8",
      "node:async_hooks": [">= 14.18 && < 15", ">= 16"],
      buffer_ieee754: "< 0.9.7",
      buffer: true,
      "node:buffer": [">= 14.18 && < 15", ">= 16"],
      child_process: true,
      "node:child_process": [">= 14.18 && < 15", ">= 16"],
      cluster: true,
      "node:cluster": [">= 14.18 && < 15", ">= 16"],
      console: true,
      "node:console": [">= 14.18 && < 15", ">= 16"],
      constants: true,
      "node:constants": [">= 14.18 && < 15", ">= 16"],
      crypto: true,
      "node:crypto": [">= 14.18 && < 15", ">= 16"],
      _debug_agent: ">= 1 && < 8",
      _debugger: "< 8",
      dgram: true,
      "node:dgram": [">= 14.18 && < 15", ">= 16"],
      diagnostics_channel: [">= 14.17 && < 15", ">= 15.1"],
      "node:diagnostics_channel": [">= 14.18 && < 15", ">= 16"],
      dns: true,
      "node:dns": [">= 14.18 && < 15", ">= 16"],
      "dns/promises": ">= 15",
      "node:dns/promises": ">= 16",
      domain: ">= 0.7.12",
      "node:domain": [">= 14.18 && < 15", ">= 16"],
      events: true,
      "node:events": [">= 14.18 && < 15", ">= 16"],
      freelist: "< 6",
      fs: true,
      "node:fs": [">= 14.18 && < 15", ">= 16"],
      "fs/promises": [">= 10 && < 10.1", ">= 14"],
      "node:fs/promises": [">= 14.18 && < 15", ">= 16"],
      _http_agent: ">= 0.11.1",
      "node:_http_agent": [">= 14.18 && < 15", ">= 16"],
      _http_client: ">= 0.11.1",
      "node:_http_client": [">= 14.18 && < 15", ">= 16"],
      _http_common: ">= 0.11.1",
      "node:_http_common": [">= 14.18 && < 15", ">= 16"],
      _http_incoming: ">= 0.11.1",
      "node:_http_incoming": [">= 14.18 && < 15", ">= 16"],
      _http_outgoing: ">= 0.11.1",
      "node:_http_outgoing": [">= 14.18 && < 15", ">= 16"],
      _http_server: ">= 0.11.1",
      "node:_http_server": [">= 14.18 && < 15", ">= 16"],
      http: true,
      "node:http": [">= 14.18 && < 15", ">= 16"],
      http2: ">= 8.8",
      "node:http2": [">= 14.18 && < 15", ">= 16"],
      https: true,
      "node:https": [">= 14.18 && < 15", ">= 16"],
      inspector: ">= 8",
      "node:inspector": [">= 14.18 && < 15", ">= 16"],
      _linklist: "< 8",
      module: true,
      "node:module": [">= 14.18 && < 15", ">= 16"],
      net: true,
      "node:net": [">= 14.18 && < 15", ">= 16"],
      "node-inspect/lib/_inspect": ">= 7.6 && < 12",
      "node-inspect/lib/internal/inspect_client": ">= 7.6 && < 12",
      "node-inspect/lib/internal/inspect_repl": ">= 7.6 && < 12",
      os: true,
      "node:os": [">= 14.18 && < 15", ">= 16"],
      path: true,
      "node:path": [">= 14.18 && < 15", ">= 16"],
      "path/posix": ">= 15.3",
      "node:path/posix": ">= 16",
      "path/win32": ">= 15.3",
      "node:path/win32": ">= 16",
      perf_hooks: ">= 8.5",
      "node:perf_hooks": [">= 14.18 && < 15", ">= 16"],
      process: ">= 1",
      "node:process": [">= 14.18 && < 15", ">= 16"],
      punycode: true,
      "node:punycode": [">= 14.18 && < 15", ">= 16"],
      querystring: true,
      "node:querystring": [">= 14.18 && < 15", ">= 16"],
      readline: true,
      "node:readline": [">= 14.18 && < 15", ">= 16"],
      "readline/promises": ">= 17",
      "node:readline/promises": ">= 17",
      repl: true,
      "node:repl": [">= 14.18 && < 15", ">= 16"],
      smalloc: ">= 0.11.5 && < 3",
      _stream_duplex: ">= 0.9.4",
      "node:_stream_duplex": [">= 14.18 && < 15", ">= 16"],
      _stream_transform: ">= 0.9.4",
      "node:_stream_transform": [">= 14.18 && < 15", ">= 16"],
      _stream_wrap: ">= 1.4.1",
      "node:_stream_wrap": [">= 14.18 && < 15", ">= 16"],
      _stream_passthrough: ">= 0.9.4",
      "node:_stream_passthrough": [">= 14.18 && < 15", ">= 16"],
      _stream_readable: ">= 0.9.4",
      "node:_stream_readable": [">= 14.18 && < 15", ">= 16"],
      _stream_writable: ">= 0.9.4",
      "node:_stream_writable": [">= 14.18 && < 15", ">= 16"],
      stream: true,
      "node:stream": [">= 14.18 && < 15", ">= 16"],
      "stream/consumers": ">= 16.7",
      "node:stream/consumers": ">= 16.7",
      "stream/promises": ">= 15",
      "node:stream/promises": ">= 16",
      "stream/web": ">= 16.5",
      "node:stream/web": ">= 16.5",
      string_decoder: true,
      "node:string_decoder": [">= 14.18 && < 15", ">= 16"],
      sys: [">= 0.6 && < 0.7", ">= 0.8"],
      "node:sys": [">= 14.18 && < 15", ">= 16"],
      timers: true,
      "node:timers": [">= 14.18 && < 15", ">= 16"],
      "timers/promises": ">= 15",
      "node:timers/promises": ">= 16",
      _tls_common: ">= 0.11.13",
      "node:_tls_common": [">= 14.18 && < 15", ">= 16"],
      _tls_legacy: ">= 0.11.3 && < 10",
      _tls_wrap: ">= 0.11.3",
      "node:_tls_wrap": [">= 14.18 && < 15", ">= 16"],
      tls: true,
      "node:tls": [">= 14.18 && < 15", ">= 16"],
      trace_events: ">= 10",
      "node:trace_events": [">= 14.18 && < 15", ">= 16"],
      tty: true,
      "node:tty": [">= 14.18 && < 15", ">= 16"],
      url: true,
      "node:url": [">= 14.18 && < 15", ">= 16"],
      util: true,
      "node:util": [">= 14.18 && < 15", ">= 16"],
      "util/types": ">= 15.3",
      "node:util/types": ">= 16",
      "v8/tools/arguments": ">= 10 && < 12",
      "v8/tools/codemap": [">= 4.4 && < 5", ">= 5.2 && < 12"],
      "v8/tools/consarray": [">= 4.4 && < 5", ">= 5.2 && < 12"],
      "v8/tools/csvparser": [">= 4.4 && < 5", ">= 5.2 && < 12"],
      "v8/tools/logreader": [">= 4.4 && < 5", ">= 5.2 && < 12"],
      "v8/tools/profile_view": [">= 4.4 && < 5", ">= 5.2 && < 12"],
      "v8/tools/splaytree": [">= 4.4 && < 5", ">= 5.2 && < 12"],
      v8: ">= 1",
      "node:v8": [">= 14.18 && < 15", ">= 16"],
      vm: true,
      "node:vm": [">= 14.18 && < 15", ">= 16"],
      wasi: ">= 13.4 && < 13.5",
      worker_threads: ">= 11.7",
      "node:worker_threads": [">= 14.18 && < 15", ">= 16"],
      zlib: true,
      "node:zlib": [">= 14.18 && < 15", ">= 16"]
    };
  }
});

// node_modules/.pnpm/is-core-module@2.8.0/node_modules/is-core-module/index.js
var require_is_core_module = _chunkGQ77QZBOjs.__commonJS.call(void 0, {
  "node_modules/.pnpm/is-core-module@2.8.0/node_modules/is-core-module/index.js"(exports, module) {
    "use strict";
    var has = require_src();
    function specifierIncluded(current, specifier) {
      var nodeParts = current.split(".");
      var parts = specifier.split(" ");
      var op = parts.length > 1 ? parts[0] : "=";
      var versionParts = (parts.length > 1 ? parts[1] : parts[0]).split(".");
      for (var i = 0; i < 3; ++i) {
        var cur = parseInt(nodeParts[i] || 0, 10);
        var ver = parseInt(versionParts[i] || 0, 10);
        if (cur === ver) {
          continue;
        }
        if (op === "<") {
          return cur < ver;
        }
        if (op === ">=") {
          return cur >= ver;
        }
        return false;
      }
      return op === ">=";
    }
    function matchesRange(current, range) {
      var specifiers = range.split(/ ?&& ?/);
      if (specifiers.length === 0) {
        return false;
      }
      for (var i = 0; i < specifiers.length; ++i) {
        if (!specifierIncluded(current, specifiers[i])) {
          return false;
        }
      }
      return true;
    }
    function versionIncluded(nodeVersion, specifierValue) {
      if (typeof specifierValue === "boolean") {
        return specifierValue;
      }
      var current = typeof nodeVersion === "undefined" ? process.versions && process.versions.node : nodeVersion;
      if (typeof current !== "string") {
        throw new TypeError(typeof nodeVersion === "undefined" ? "Unable to determine current node version" : "If provided, a valid node version is required");
      }
      if (specifierValue && typeof specifierValue === "object") {
        for (var i = 0; i < specifierValue.length; ++i) {
          if (matchesRange(current, specifierValue[i])) {
            return true;
          }
        }
        return false;
      }
      return matchesRange(current, specifierValue);
    }
    var data = require_core();
    module.exports = function isCore(x, nodeVersion) {
      return has(data, x) && versionIncluded(nodeVersion, data[x]);
    };
  }
});

// node_modules/.pnpm/resolve@1.20.0/node_modules/resolve/lib/async.js
var require_async = _chunkGQ77QZBOjs.__commonJS.call(void 0, {
  "node_modules/.pnpm/resolve@1.20.0/node_modules/resolve/lib/async.js"(exports, module) {
    "use strict";
    var fs2 = _chunkGQ77QZBOjs.__require.call(void 0, "fs");
    var path3 = _chunkGQ77QZBOjs.__require.call(void 0, "path");
    var caller = require_caller();
    var nodeModulesPaths = require_node_modules_paths();
    var normalizeOptions = require_normalize_options();
    var isCore = require_is_core_module();
    var realpathFS = fs2.realpath && typeof fs2.realpath.native === "function" ? fs2.realpath.native : fs2.realpath;
    var defaultIsFile = function isFile(file, cb) {
      fs2.stat(file, function(err, stat) {
        if (!err) {
          return cb(null, stat.isFile() || stat.isFIFO());
        }
        if (err.code === "ENOENT" || err.code === "ENOTDIR")
          return cb(null, false);
        return cb(err);
      });
    };
    var defaultIsDir = function isDirectory(dir, cb) {
      fs2.stat(dir, function(err, stat) {
        if (!err) {
          return cb(null, stat.isDirectory());
        }
        if (err.code === "ENOENT" || err.code === "ENOTDIR")
          return cb(null, false);
        return cb(err);
      });
    };
    var defaultRealpath = function realpath(x, cb) {
      realpathFS(x, function(realpathErr, realPath) {
        if (realpathErr && realpathErr.code !== "ENOENT")
          cb(realpathErr);
        else
          cb(null, realpathErr ? x : realPath);
      });
    };
    var maybeRealpath = function maybeRealpath2(realpath, x, opts, cb) {
      if (opts && opts.preserveSymlinks === false) {
        realpath(x, cb);
      } else {
        cb(null, x);
      }
    };
    var defaultReadPackage = function defaultReadPackage2(readFile, pkgfile, cb) {
      readFile(pkgfile, function(readFileErr, body) {
        if (readFileErr)
          cb(readFileErr);
        else {
          try {
            var pkg = JSON.parse(body);
            cb(null, pkg);
          } catch (jsonErr) {
            cb(null);
          }
        }
      });
    };
    var getPackageCandidates = function getPackageCandidates2(x, start, opts) {
      var dirs = nodeModulesPaths(start, opts, x);
      for (var i = 0; i < dirs.length; i++) {
        dirs[i] = path3.join(dirs[i], x);
      }
      return dirs;
    };
    module.exports = function resolve2(x, options, callback) {
      var cb = callback;
      var opts = options;
      if (typeof options === "function") {
        cb = opts;
        opts = {};
      }
      if (typeof x !== "string") {
        var err = new TypeError("Path must be a string.");
        return process.nextTick(function() {
          cb(err);
        });
      }
      opts = normalizeOptions(x, opts);
      var isFile = opts.isFile || defaultIsFile;
      var isDirectory = opts.isDirectory || defaultIsDir;
      var readFile = opts.readFile || fs2.readFile;
      var realpath = opts.realpath || defaultRealpath;
      var readPackage = opts.readPackage || defaultReadPackage;
      if (opts.readFile && opts.readPackage) {
        var conflictErr = new TypeError("`readFile` and `readPackage` are mutually exclusive.");
        return process.nextTick(function() {
          cb(conflictErr);
        });
      }
      var packageIterator = opts.packageIterator;
      var extensions = opts.extensions || [".js"];
      var includeCoreModules = opts.includeCoreModules !== false;
      var basedir = opts.basedir || path3.dirname(caller());
      var parent = opts.filename || basedir;
      opts.paths = opts.paths || [];
      var absoluteStart = path3.resolve(basedir);
      maybeRealpath(
        realpath,
        absoluteStart,
        opts,
        function(err2, realStart) {
          if (err2)
            cb(err2);
          else
            init(realStart);
        }
      );
      var res;
      function init(basedir2) {
        if (/^(?:\.\.?(?:\/|$)|\/|([A-Za-z]:)?[/\\])/.test(x)) {
          res = path3.resolve(basedir2, x);
          if (x === "." || x === ".." || x.slice(-1) === "/")
            res += "/";
          if (/\/$/.test(x) && res === basedir2) {
            loadAsDirectory(res, opts.package, onfile);
          } else
            loadAsFile(res, opts.package, onfile);
        } else if (includeCoreModules && isCore(x)) {
          return cb(null, x);
        } else
          loadNodeModules(x, basedir2, function(err2, n, pkg) {
            if (err2)
              cb(err2);
            else if (n) {
              return maybeRealpath(realpath, n, opts, function(err3, realN) {
                if (err3) {
                  cb(err3);
                } else {
                  cb(null, realN, pkg);
                }
              });
            } else {
              var moduleError = new Error("Cannot find module '" + x + "' from '" + parent + "'");
              moduleError.code = "MODULE_NOT_FOUND";
              cb(moduleError);
            }
          });
      }
      function onfile(err2, m, pkg) {
        if (err2)
          cb(err2);
        else if (m)
          cb(null, m, pkg);
        else
          loadAsDirectory(res, function(err3, d, pkg2) {
            if (err3)
              cb(err3);
            else if (d) {
              maybeRealpath(realpath, d, opts, function(err4, realD) {
                if (err4) {
                  cb(err4);
                } else {
                  cb(null, realD, pkg2);
                }
              });
            } else {
              var moduleError = new Error("Cannot find module '" + x + "' from '" + parent + "'");
              moduleError.code = "MODULE_NOT_FOUND";
              cb(moduleError);
            }
          });
      }
      function loadAsFile(x2, thePackage, callback2) {
        var loadAsFilePackage = thePackage;
        var cb2 = callback2;
        if (typeof loadAsFilePackage === "function") {
          cb2 = loadAsFilePackage;
          loadAsFilePackage = void 0;
        }
        var exts = [""].concat(extensions);
        load(exts, x2, loadAsFilePackage);
        function load(exts2, x3, loadPackage) {
          if (exts2.length === 0)
            return cb2(null, void 0, loadPackage);
          var file = x3 + exts2[0];
          var pkg = loadPackage;
          if (pkg)
            onpkg(null, pkg);
          else
            loadpkg(path3.dirname(file), onpkg);
          function onpkg(err2, pkg_, dir) {
            pkg = pkg_;
            if (err2)
              return cb2(err2);
            if (dir && pkg && opts.pathFilter) {
              var rfile = path3.relative(dir, file);
              var rel = rfile.slice(0, rfile.length - exts2[0].length);
              var r = opts.pathFilter(pkg, x3, rel);
              if (r)
                return load(
                  [""].concat(extensions.slice()),
                  path3.resolve(dir, r),
                  pkg
                );
            }
            isFile(file, onex);
          }
          function onex(err2, ex) {
            if (err2)
              return cb2(err2);
            if (ex)
              return cb2(null, file, pkg);
            load(exts2.slice(1), x3, pkg);
          }
        }
      }
      function loadpkg(dir, cb2) {
        if (dir === "" || dir === "/")
          return cb2(null);
        if (process.platform === "win32" && /^\w:[/\\]*$/.test(dir)) {
          return cb2(null);
        }
        if (/[/\\]node_modules[/\\]*$/.test(dir))
          return cb2(null);
        maybeRealpath(realpath, dir, opts, function(unwrapErr, pkgdir) {
          if (unwrapErr)
            return loadpkg(path3.dirname(dir), cb2);
          var pkgfile = path3.join(pkgdir, "package.json");
          isFile(pkgfile, function(err2, ex) {
            if (!ex)
              return loadpkg(path3.dirname(dir), cb2);
            readPackage(readFile, pkgfile, function(err3, pkgParam) {
              if (err3)
                cb2(err3);
              var pkg = pkgParam;
              if (pkg && opts.packageFilter) {
                pkg = opts.packageFilter(pkg, pkgfile);
              }
              cb2(null, pkg, dir);
            });
          });
        });
      }
      function loadAsDirectory(x2, loadAsDirectoryPackage, callback2) {
        var cb2 = callback2;
        var fpkg = loadAsDirectoryPackage;
        if (typeof fpkg === "function") {
          cb2 = fpkg;
          fpkg = opts.package;
        }
        maybeRealpath(realpath, x2, opts, function(unwrapErr, pkgdir) {
          if (unwrapErr)
            return cb2(unwrapErr);
          var pkgfile = path3.join(pkgdir, "package.json");
          isFile(pkgfile, function(err2, ex) {
            if (err2)
              return cb2(err2);
            if (!ex)
              return loadAsFile(path3.join(x2, "index"), fpkg, cb2);
            readPackage(readFile, pkgfile, function(err3, pkgParam) {
              if (err3)
                return cb2(err3);
              var pkg = pkgParam;
              if (pkg && opts.packageFilter) {
                pkg = opts.packageFilter(pkg, pkgfile);
              }
              if (pkg && pkg.main) {
                if (typeof pkg.main !== "string") {
                  var mainError = new TypeError("package \u201C" + pkg.name + "\u201D `main` must be a string");
                  mainError.code = "INVALID_PACKAGE_MAIN";
                  return cb2(mainError);
                }
                if (pkg.main === "." || pkg.main === "./") {
                  pkg.main = "index";
                }
                loadAsFile(path3.resolve(x2, pkg.main), pkg, function(err4, m, pkg2) {
                  if (err4)
                    return cb2(err4);
                  if (m)
                    return cb2(null, m, pkg2);
                  if (!pkg2)
                    return loadAsFile(path3.join(x2, "index"), pkg2, cb2);
                  var dir = path3.resolve(x2, pkg2.main);
                  loadAsDirectory(dir, pkg2, function(err5, n, pkg3) {
                    if (err5)
                      return cb2(err5);
                    if (n)
                      return cb2(null, n, pkg3);
                    loadAsFile(path3.join(x2, "index"), pkg3, cb2);
                  });
                });
                return;
              }
              loadAsFile(path3.join(x2, "/index"), pkg, cb2);
            });
          });
        });
      }
      function processDirs(cb2, dirs) {
        if (dirs.length === 0)
          return cb2(null, void 0);
        var dir = dirs[0];
        isDirectory(path3.dirname(dir), isdir);
        function isdir(err2, isdir2) {
          if (err2)
            return cb2(err2);
          if (!isdir2)
            return processDirs(cb2, dirs.slice(1));
          loadAsFile(dir, opts.package, onfile2);
        }
        function onfile2(err2, m, pkg) {
          if (err2)
            return cb2(err2);
          if (m)
            return cb2(null, m, pkg);
          loadAsDirectory(dir, opts.package, ondir);
        }
        function ondir(err2, n, pkg) {
          if (err2)
            return cb2(err2);
          if (n)
            return cb2(null, n, pkg);
          processDirs(cb2, dirs.slice(1));
        }
      }
      function loadNodeModules(x2, start, cb2) {
        var thunk = function() {
          return getPackageCandidates(x2, start, opts);
        };
        processDirs(
          cb2,
          packageIterator ? packageIterator(x2, start, thunk, opts) : thunk()
        );
      }
    };
  }
});

// node_modules/.pnpm/resolve@1.20.0/node_modules/resolve/lib/core.json
var require_core2 = _chunkGQ77QZBOjs.__commonJS.call(void 0, {
  "node_modules/.pnpm/resolve@1.20.0/node_modules/resolve/lib/core.json"(exports, module) {
    module.exports = {
      assert: true,
      "assert/strict": ">= 15",
      async_hooks: ">= 8",
      buffer_ieee754: "< 0.9.7",
      buffer: true,
      child_process: true,
      cluster: true,
      console: true,
      constants: true,
      crypto: true,
      _debug_agent: ">= 1 && < 8",
      _debugger: "< 8",
      dgram: true,
      diagnostics_channel: ">= 15.1",
      dns: true,
      "dns/promises": ">= 15",
      domain: ">= 0.7.12",
      events: true,
      freelist: "< 6",
      fs: true,
      "fs/promises": [">= 10 && < 10.1", ">= 14"],
      _http_agent: ">= 0.11.1",
      _http_client: ">= 0.11.1",
      _http_common: ">= 0.11.1",
      _http_incoming: ">= 0.11.1",
      _http_outgoing: ">= 0.11.1",
      _http_server: ">= 0.11.1",
      http: true,
      http2: ">= 8.8",
      https: true,
      inspector: ">= 8.0.0",
      _linklist: "< 8",
      module: true,
      net: true,
      "node-inspect/lib/_inspect": ">= 7.6.0 && < 12",
      "node-inspect/lib/internal/inspect_client": ">= 7.6.0 && < 12",
      "node-inspect/lib/internal/inspect_repl": ">= 7.6.0 && < 12",
      os: true,
      path: true,
      "path/posix": ">= 15.3",
      "path/win32": ">= 15.3",
      perf_hooks: ">= 8.5",
      process: ">= 1",
      punycode: true,
      querystring: true,
      readline: true,
      repl: true,
      smalloc: ">= 0.11.5 && < 3",
      _stream_duplex: ">= 0.9.4",
      _stream_transform: ">= 0.9.4",
      _stream_wrap: ">= 1.4.1",
      _stream_passthrough: ">= 0.9.4",
      _stream_readable: ">= 0.9.4",
      _stream_writable: ">= 0.9.4",
      stream: true,
      "stream/promises": ">= 15",
      string_decoder: true,
      sys: [">= 0.6 && < 0.7", ">= 0.8"],
      timers: true,
      "timers/promises": ">= 15",
      _tls_common: ">= 0.11.13",
      _tls_legacy: ">= 0.11.3 && < 10",
      _tls_wrap: ">= 0.11.3",
      tls: true,
      trace_events: ">= 10",
      tty: true,
      url: true,
      util: true,
      "util/types": ">= 15.3",
      "v8/tools/arguments": ">= 10 && < 12",
      "v8/tools/codemap": [">= 4.4.0 && < 5", ">= 5.2.0 && < 12"],
      "v8/tools/consarray": [">= 4.4.0 && < 5", ">= 5.2.0 && < 12"],
      "v8/tools/csvparser": [">= 4.4.0 && < 5", ">= 5.2.0 && < 12"],
      "v8/tools/logreader": [">= 4.4.0 && < 5", ">= 5.2.0 && < 12"],
      "v8/tools/profile_view": [">= 4.4.0 && < 5", ">= 5.2.0 && < 12"],
      "v8/tools/splaytree": [">= 4.4.0 && < 5", ">= 5.2.0 && < 12"],
      v8: ">= 1",
      vm: true,
      wasi: ">= 13.4 && < 13.5",
      worker_threads: ">= 11.7",
      zlib: true
    };
  }
});

// node_modules/.pnpm/resolve@1.20.0/node_modules/resolve/lib/core.js
var require_core3 = _chunkGQ77QZBOjs.__commonJS.call(void 0, {
  "node_modules/.pnpm/resolve@1.20.0/node_modules/resolve/lib/core.js"(exports, module) {
    "use strict";
    var current = process.versions && process.versions.node && process.versions.node.split(".") || [];
    function specifierIncluded(specifier) {
      var parts = specifier.split(" ");
      var op = parts.length > 1 ? parts[0] : "=";
      var versionParts = (parts.length > 1 ? parts[1] : parts[0]).split(".");
      for (var i = 0; i < 3; ++i) {
        var cur = parseInt(current[i] || 0, 10);
        var ver = parseInt(versionParts[i] || 0, 10);
        if (cur === ver) {
          continue;
        }
        if (op === "<") {
          return cur < ver;
        } else if (op === ">=") {
          return cur >= ver;
        } else {
          return false;
        }
      }
      return op === ">=";
    }
    function matchesRange(range) {
      var specifiers = range.split(/ ?&& ?/);
      if (specifiers.length === 0) {
        return false;
      }
      for (var i = 0; i < specifiers.length; ++i) {
        if (!specifierIncluded(specifiers[i])) {
          return false;
        }
      }
      return true;
    }
    function versionIncluded(specifierValue) {
      if (typeof specifierValue === "boolean") {
        return specifierValue;
      }
      if (specifierValue && typeof specifierValue === "object") {
        for (var i = 0; i < specifierValue.length; ++i) {
          if (matchesRange(specifierValue[i])) {
            return true;
          }
        }
        return false;
      }
      return matchesRange(specifierValue);
    }
    var data = require_core2();
    var core = {};
    for (mod in data) {
      if (Object.prototype.hasOwnProperty.call(data, mod)) {
        core[mod] = versionIncluded(data[mod]);
      }
    }
    var mod;
    module.exports = core;
  }
});

// node_modules/.pnpm/resolve@1.20.0/node_modules/resolve/lib/is-core.js
var require_is_core = _chunkGQ77QZBOjs.__commonJS.call(void 0, {
  "node_modules/.pnpm/resolve@1.20.0/node_modules/resolve/lib/is-core.js"(exports, module) {
    "use strict";
    var isCoreModule = require_is_core_module();
    module.exports = function isCore(x) {
      return isCoreModule(x);
    };
  }
});

// node_modules/.pnpm/resolve@1.20.0/node_modules/resolve/lib/sync.js
var require_sync = _chunkGQ77QZBOjs.__commonJS.call(void 0, {
  "node_modules/.pnpm/resolve@1.20.0/node_modules/resolve/lib/sync.js"(exports, module) {
    "use strict";
    var isCore = require_is_core_module();
    var fs2 = _chunkGQ77QZBOjs.__require.call(void 0, "fs");
    var path3 = _chunkGQ77QZBOjs.__require.call(void 0, "path");
    var caller = require_caller();
    var nodeModulesPaths = require_node_modules_paths();
    var normalizeOptions = require_normalize_options();
    var realpathFS = fs2.realpathSync && typeof fs2.realpathSync.native === "function" ? fs2.realpathSync.native : fs2.realpathSync;
    var defaultIsFile = function isFile(file) {
      try {
        var stat = fs2.statSync(file);
      } catch (e) {
        if (e && (e.code === "ENOENT" || e.code === "ENOTDIR"))
          return false;
        throw e;
      }
      return stat.isFile() || stat.isFIFO();
    };
    var defaultIsDir = function isDirectory(dir) {
      try {
        var stat = fs2.statSync(dir);
      } catch (e) {
        if (e && (e.code === "ENOENT" || e.code === "ENOTDIR"))
          return false;
        throw e;
      }
      return stat.isDirectory();
    };
    var defaultRealpathSync = function realpathSync(x) {
      try {
        return realpathFS(x);
      } catch (realpathErr) {
        if (realpathErr.code !== "ENOENT") {
          throw realpathErr;
        }
      }
      return x;
    };
    var maybeRealpathSync = function maybeRealpathSync2(realpathSync, x, opts) {
      if (opts && opts.preserveSymlinks === false) {
        return realpathSync(x);
      }
      return x;
    };
    var defaultReadPackageSync = function defaultReadPackageSync2(readFileSync, pkgfile) {
      var body = readFileSync(pkgfile);
      try {
        var pkg = JSON.parse(body);
        return pkg;
      } catch (jsonErr) {
      }
    };
    var getPackageCandidates = function getPackageCandidates2(x, start, opts) {
      var dirs = nodeModulesPaths(start, opts, x);
      for (var i = 0; i < dirs.length; i++) {
        dirs[i] = path3.join(dirs[i], x);
      }
      return dirs;
    };
    module.exports = function resolveSync(x, options) {
      if (typeof x !== "string") {
        throw new TypeError("Path must be a string.");
      }
      var opts = normalizeOptions(x, options);
      var isFile = opts.isFile || defaultIsFile;
      var readFileSync = opts.readFileSync || fs2.readFileSync;
      var isDirectory = opts.isDirectory || defaultIsDir;
      var realpathSync = opts.realpathSync || defaultRealpathSync;
      var readPackageSync = opts.readPackageSync || defaultReadPackageSync;
      if (opts.readFileSync && opts.readPackageSync) {
        throw new TypeError("`readFileSync` and `readPackageSync` are mutually exclusive.");
      }
      var packageIterator = opts.packageIterator;
      var extensions = opts.extensions || [".js"];
      var includeCoreModules = opts.includeCoreModules !== false;
      var basedir = opts.basedir || path3.dirname(caller());
      var parent = opts.filename || basedir;
      opts.paths = opts.paths || [];
      var absoluteStart = maybeRealpathSync(realpathSync, path3.resolve(basedir), opts);
      if (/^(?:\.\.?(?:\/|$)|\/|([A-Za-z]:)?[/\\])/.test(x)) {
        var res = path3.resolve(absoluteStart, x);
        if (x === "." || x === ".." || x.slice(-1) === "/")
          res += "/";
        var m = loadAsFileSync(res) || loadAsDirectorySync(res);
        if (m)
          return maybeRealpathSync(realpathSync, m, opts);
      } else if (includeCoreModules && isCore(x)) {
        return x;
      } else {
        var n = loadNodeModulesSync(x, absoluteStart);
        if (n)
          return maybeRealpathSync(realpathSync, n, opts);
      }
      var err = new Error("Cannot find module '" + x + "' from '" + parent + "'");
      err.code = "MODULE_NOT_FOUND";
      throw err;
      function loadAsFileSync(x2) {
        var pkg = loadpkg(path3.dirname(x2));
        if (pkg && pkg.dir && pkg.pkg && opts.pathFilter) {
          var rfile = path3.relative(pkg.dir, x2);
          var r = opts.pathFilter(pkg.pkg, x2, rfile);
          if (r) {
            x2 = path3.resolve(pkg.dir, r);
          }
        }
        if (isFile(x2)) {
          return x2;
        }
        for (var i = 0; i < extensions.length; i++) {
          var file = x2 + extensions[i];
          if (isFile(file)) {
            return file;
          }
        }
      }
      function loadpkg(dir) {
        if (dir === "" || dir === "/")
          return;
        if (process.platform === "win32" && /^\w:[/\\]*$/.test(dir)) {
          return;
        }
        if (/[/\\]node_modules[/\\]*$/.test(dir))
          return;
        var pkgfile = path3.join(maybeRealpathSync(realpathSync, dir, opts), "package.json");
        if (!isFile(pkgfile)) {
          return loadpkg(path3.dirname(dir));
        }
        var pkg = readPackageSync(readFileSync, pkgfile);
        if (pkg && opts.packageFilter) {
          pkg = opts.packageFilter(
            pkg,
            /*pkgfile,*/
            dir
          );
        }
        return { pkg, dir };
      }
      function loadAsDirectorySync(x2) {
        var pkgfile = path3.join(maybeRealpathSync(realpathSync, x2, opts), "/package.json");
        if (isFile(pkgfile)) {
          try {
            var pkg = readPackageSync(readFileSync, pkgfile);
          } catch (e) {
          }
          if (pkg && opts.packageFilter) {
            pkg = opts.packageFilter(
              pkg,
              /*pkgfile,*/
              x2
            );
          }
          if (pkg && pkg.main) {
            if (typeof pkg.main !== "string") {
              var mainError = new TypeError("package \u201C" + pkg.name + "\u201D `main` must be a string");
              mainError.code = "INVALID_PACKAGE_MAIN";
              throw mainError;
            }
            if (pkg.main === "." || pkg.main === "./") {
              pkg.main = "index";
            }
            try {
              var m2 = loadAsFileSync(path3.resolve(x2, pkg.main));
              if (m2)
                return m2;
              var n2 = loadAsDirectorySync(path3.resolve(x2, pkg.main));
              if (n2)
                return n2;
            } catch (e) {
            }
          }
        }
        return loadAsFileSync(path3.join(x2, "/index"));
      }
      function loadNodeModulesSync(x2, start) {
        var thunk = function() {
          return getPackageCandidates(x2, start, opts);
        };
        var dirs = packageIterator ? packageIterator(x2, start, thunk, opts) : thunk();
        for (var i = 0; i < dirs.length; i++) {
          var dir = dirs[i];
          if (isDirectory(path3.dirname(dir))) {
            var m2 = loadAsFileSync(dir);
            if (m2)
              return m2;
            var n2 = loadAsDirectorySync(dir);
            if (n2)
              return n2;
          }
        }
      }
    };
  }
});

// node_modules/.pnpm/resolve@1.20.0/node_modules/resolve/index.js
var require_resolve = _chunkGQ77QZBOjs.__commonJS.call(void 0, {
  "node_modules/.pnpm/resolve@1.20.0/node_modules/resolve/index.js"(exports, module) {
    "use strict";
    var async = require_async();
    async.core = require_core3();
    async.isCore = require_is_core();
    async.sync = require_sync();
    module.exports = async;
  }
});

// node_modules/.pnpm/js-tokens@4.0.0/node_modules/js-tokens/index.js
var require_js_tokens = _chunkGQ77QZBOjs.__commonJS.call(void 0, {
  "node_modules/.pnpm/js-tokens@4.0.0/node_modules/js-tokens/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = /((['"])(?:(?!\2|\\).|\\(?:\r\n|[\s\S]))*(\2)?|`(?:[^`\\$]|\\[\s\S]|\$(?!\{)|\$\{(?:[^{}]|\{[^}]*\}?)*\}?)*(`)?)|(\/\/.*)|(\/\*(?:[^*]|\*(?!\/))*(\*\/)?)|(\/(?!\*)(?:\[(?:(?![\]\\]).|\\.)*\]|(?![\/\]\\]).|\\.)+\/(?:(?!\s*(?:\b|[\u0080-\uFFFF$\\'"~({]|[+\-!](?!=)|\.?\d))|[gmiyus]{1,6}\b(?![\u0080-\uFFFF$\\]|\s*(?:[+\-*%&|^<>!=?({]|\/(?![\/*])))))|(0[xX][\da-fA-F]+|0[oO][0-7]+|0[bB][01]+|(?:\d*\.\d+|\d+\.?)(?:[eE][+-]?\d+)?)|((?!\d)(?:(?!\s)[$\w\u0080-\uFFFF]|\\u[\da-fA-F]{4}|\\u\{[\da-fA-F]+\})+)|(--|\+\+|&&|\|\||=>|\.{3}|(?:[+\-\/%&|^]|\*{1,2}|<{1,2}|>{1,3}|!=?|={1,2})=?|[?~.,:;[\](){}])|(\s+)|(^$|[\s\S])/g;
    exports.matchToToken = function(match) {
      var token = { type: "invalid", value: match[0], closed: void 0 };
      if (match[1])
        token.type = "string", token.closed = !!(match[3] || match[4]);
      else if (match[5])
        token.type = "comment";
      else if (match[6])
        token.type = "comment", token.closed = !!match[7];
      else if (match[8])
        token.type = "regex";
      else if (match[9])
        token.type = "number";
      else if (match[10])
        token.type = "name";
      else if (match[11])
        token.type = "punctuator";
      else if (match[12])
        token.type = "whitespace";
      return token;
    };
  }
});

// node_modules/.pnpm/@babel+helper-validator-identifier@7.22.20/node_modules/@babel/helper-validator-identifier/lib/identifier.js
var require_identifier = _chunkGQ77QZBOjs.__commonJS.call(void 0, {
  "node_modules/.pnpm/@babel+helper-validator-identifier@7.22.20/node_modules/@babel/helper-validator-identifier/lib/identifier.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.isIdentifierChar = isIdentifierChar;
    exports.isIdentifierName = isIdentifierName;
    exports.isIdentifierStart = isIdentifierStart;
    var nonASCIIidentifierStartChars = "\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0370-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u048A-\u052F\u0531-\u0556\u0559\u0560-\u0588\u05D0-\u05EA\u05EF-\u05F2\u0620-\u064A\u066E\u066F\u0671-\u06D3\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07CA-\u07EA\u07F4\u07F5\u07FA\u0800-\u0815\u081A\u0824\u0828\u0840-\u0858\u0860-\u086A\u0870-\u0887\u0889-\u088E\u08A0-\u08C9\u0904-\u0939\u093D\u0950\u0958-\u0961\u0971-\u0980\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD\u09CE\u09DC\u09DD\u09DF-\u09E1\u09F0\u09F1\u09FC\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A59-\u0A5C\u0A5E\u0A72-\u0A74\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD\u0AD0\u0AE0\u0AE1\u0AF9\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B5C\u0B5D\u0B5F-\u0B61\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BD0\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D\u0C58-\u0C5A\u0C5D\u0C60\u0C61\u0C80\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD\u0CDD\u0CDE\u0CE0\u0CE1\u0CF1\u0CF2\u0D04-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D\u0D4E\u0D54-\u0D56\u0D5F-\u0D61\u0D7A-\u0D7F\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E46\u0E81\u0E82\u0E84\u0E86-\u0E8A\u0E8C-\u0EA3\u0EA5\u0EA7-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EC6\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F88-\u0F8C\u1000-\u102A\u103F\u1050-\u1055\u105A-\u105D\u1061\u1065\u1066\u106E-\u1070\u1075-\u1081\u108E\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1380-\u138F\u13A0-\u13F5\u13F8-\u13FD\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F8\u1700-\u1711\u171F-\u1731\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17D7\u17DC\u1820-\u1878\u1880-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191E\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u1A00-\u1A16\u1A20-\u1A54\u1AA7\u1B05-\u1B33\u1B45-\u1B4C\u1B83-\u1BA0\u1BAE\u1BAF\u1BBA-\u1BE5\u1C00-\u1C23\u1C4D-\u1C4F\u1C5A-\u1C7D\u1C80-\u1C88\u1C90-\u1CBA\u1CBD-\u1CBF\u1CE9-\u1CEC\u1CEE-\u1CF3\u1CF5\u1CF6\u1CFA\u1D00-\u1DBF\u1E00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u2071\u207F\u2090-\u209C\u2102\u2107\u210A-\u2113\u2115\u2118-\u211D\u2124\u2126\u2128\u212A-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2CE4\u2CEB-\u2CEE\u2CF2\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303C\u3041-\u3096\u309B-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312F\u3131-\u318E\u31A0-\u31BF\u31F0-\u31FF\u3400-\u4DBF\u4E00-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA61F\uA62A\uA62B\uA640-\uA66E\uA67F-\uA69D\uA6A0-\uA6EF\uA717-\uA71F\uA722-\uA788\uA78B-\uA7CA\uA7D0\uA7D1\uA7D3\uA7D5-\uA7D9\uA7F2-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA822\uA840-\uA873\uA882-\uA8B3\uA8F2-\uA8F7\uA8FB\uA8FD\uA8FE\uA90A-\uA925\uA930-\uA946\uA960-\uA97C\uA984-\uA9B2\uA9CF\uA9E0-\uA9E4\uA9E6-\uA9EF\uA9FA-\uA9FE\uAA00-\uAA28\uAA40-\uAA42\uAA44-\uAA4B\uAA60-\uAA76\uAA7A\uAA7E-\uAAAF\uAAB1\uAAB5\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAADD\uAAE0-\uAAEA\uAAF2-\uAAF4\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB69\uAB70-\uABE2\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC";
    var nonASCIIidentifierChars = "\u200C\u200D\xB7\u0300-\u036F\u0387\u0483-\u0487\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u0610-\u061A\u064B-\u0669\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED\u06F0-\u06F9\u0711\u0730-\u074A\u07A6-\u07B0\u07C0-\u07C9\u07EB-\u07F3\u07FD\u0816-\u0819\u081B-\u0823\u0825-\u0827\u0829-\u082D\u0859-\u085B\u0898-\u089F\u08CA-\u08E1\u08E3-\u0903\u093A-\u093C\u093E-\u094F\u0951-\u0957\u0962\u0963\u0966-\u096F\u0981-\u0983\u09BC\u09BE-\u09C4\u09C7\u09C8\u09CB-\u09CD\u09D7\u09E2\u09E3\u09E6-\u09EF\u09FE\u0A01-\u0A03\u0A3C\u0A3E-\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A66-\u0A71\u0A75\u0A81-\u0A83\u0ABC\u0ABE-\u0AC5\u0AC7-\u0AC9\u0ACB-\u0ACD\u0AE2\u0AE3\u0AE6-\u0AEF\u0AFA-\u0AFF\u0B01-\u0B03\u0B3C\u0B3E-\u0B44\u0B47\u0B48\u0B4B-\u0B4D\u0B55-\u0B57\u0B62\u0B63\u0B66-\u0B6F\u0B82\u0BBE-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCD\u0BD7\u0BE6-\u0BEF\u0C00-\u0C04\u0C3C\u0C3E-\u0C44\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C62\u0C63\u0C66-\u0C6F\u0C81-\u0C83\u0CBC\u0CBE-\u0CC4\u0CC6-\u0CC8\u0CCA-\u0CCD\u0CD5\u0CD6\u0CE2\u0CE3\u0CE6-\u0CEF\u0CF3\u0D00-\u0D03\u0D3B\u0D3C\u0D3E-\u0D44\u0D46-\u0D48\u0D4A-\u0D4D\u0D57\u0D62\u0D63\u0D66-\u0D6F\u0D81-\u0D83\u0DCA\u0DCF-\u0DD4\u0DD6\u0DD8-\u0DDF\u0DE6-\u0DEF\u0DF2\u0DF3\u0E31\u0E34-\u0E3A\u0E47-\u0E4E\u0E50-\u0E59\u0EB1\u0EB4-\u0EBC\u0EC8-\u0ECE\u0ED0-\u0ED9\u0F18\u0F19\u0F20-\u0F29\u0F35\u0F37\u0F39\u0F3E\u0F3F\u0F71-\u0F84\u0F86\u0F87\u0F8D-\u0F97\u0F99-\u0FBC\u0FC6\u102B-\u103E\u1040-\u1049\u1056-\u1059\u105E-\u1060\u1062-\u1064\u1067-\u106D\u1071-\u1074\u1082-\u108D\u108F-\u109D\u135D-\u135F\u1369-\u1371\u1712-\u1715\u1732-\u1734\u1752\u1753\u1772\u1773\u17B4-\u17D3\u17DD\u17E0-\u17E9\u180B-\u180D\u180F-\u1819\u18A9\u1920-\u192B\u1930-\u193B\u1946-\u194F\u19D0-\u19DA\u1A17-\u1A1B\u1A55-\u1A5E\u1A60-\u1A7C\u1A7F-\u1A89\u1A90-\u1A99\u1AB0-\u1ABD\u1ABF-\u1ACE\u1B00-\u1B04\u1B34-\u1B44\u1B50-\u1B59\u1B6B-\u1B73\u1B80-\u1B82\u1BA1-\u1BAD\u1BB0-\u1BB9\u1BE6-\u1BF3\u1C24-\u1C37\u1C40-\u1C49\u1C50-\u1C59\u1CD0-\u1CD2\u1CD4-\u1CE8\u1CED\u1CF4\u1CF7-\u1CF9\u1DC0-\u1DFF\u200C\u200D\u203F\u2040\u2054\u20D0-\u20DC\u20E1\u20E5-\u20F0\u2CEF-\u2CF1\u2D7F\u2DE0-\u2DFF\u302A-\u302F\u3099\u309A\u30FB\uA620-\uA629\uA66F\uA674-\uA67D\uA69E\uA69F\uA6F0\uA6F1\uA802\uA806\uA80B\uA823-\uA827\uA82C\uA880\uA881\uA8B4-\uA8C5\uA8D0-\uA8D9\uA8E0-\uA8F1\uA8FF-\uA909\uA926-\uA92D\uA947-\uA953\uA980-\uA983\uA9B3-\uA9C0\uA9D0-\uA9D9\uA9E5\uA9F0-\uA9F9\uAA29-\uAA36\uAA43\uAA4C\uAA4D\uAA50-\uAA59\uAA7B-\uAA7D\uAAB0\uAAB2-\uAAB4\uAAB7\uAAB8\uAABE\uAABF\uAAC1\uAAEB-\uAAEF\uAAF5\uAAF6\uABE3-\uABEA\uABEC\uABED\uABF0-\uABF9\uFB1E\uFE00-\uFE0F\uFE20-\uFE2F\uFE33\uFE34\uFE4D-\uFE4F\uFF10-\uFF19\uFF3F\uFF65";
    var nonASCIIidentifierStart = new RegExp("[" + nonASCIIidentifierStartChars + "]");
    var nonASCIIidentifier = new RegExp("[" + nonASCIIidentifierStartChars + nonASCIIidentifierChars + "]");
    nonASCIIidentifierStartChars = nonASCIIidentifierChars = null;
    var astralIdentifierStartCodes = [0, 11, 2, 25, 2, 18, 2, 1, 2, 14, 3, 13, 35, 122, 70, 52, 268, 28, 4, 48, 48, 31, 14, 29, 6, 37, 11, 29, 3, 35, 5, 7, 2, 4, 43, 157, 19, 35, 5, 35, 5, 39, 9, 51, 13, 10, 2, 14, 2, 6, 2, 1, 2, 10, 2, 14, 2, 6, 2, 1, 68, 310, 10, 21, 11, 7, 25, 5, 2, 41, 2, 8, 70, 5, 3, 0, 2, 43, 2, 1, 4, 0, 3, 22, 11, 22, 10, 30, 66, 18, 2, 1, 11, 21, 11, 25, 71, 55, 7, 1, 65, 0, 16, 3, 2, 2, 2, 28, 43, 28, 4, 28, 36, 7, 2, 27, 28, 53, 11, 21, 11, 18, 14, 17, 111, 72, 56, 50, 14, 50, 14, 35, 349, 41, 7, 1, 79, 28, 11, 0, 9, 21, 43, 17, 47, 20, 28, 22, 13, 52, 58, 1, 3, 0, 14, 44, 33, 24, 27, 35, 30, 0, 3, 0, 9, 34, 4, 0, 13, 47, 15, 3, 22, 0, 2, 0, 36, 17, 2, 24, 20, 1, 64, 6, 2, 0, 2, 3, 2, 14, 2, 9, 8, 46, 39, 7, 3, 1, 3, 21, 2, 6, 2, 1, 2, 4, 4, 0, 19, 0, 13, 4, 159, 52, 19, 3, 21, 2, 31, 47, 21, 1, 2, 0, 185, 46, 42, 3, 37, 47, 21, 0, 60, 42, 14, 0, 72, 26, 38, 6, 186, 43, 117, 63, 32, 7, 3, 0, 3, 7, 2, 1, 2, 23, 16, 0, 2, 0, 95, 7, 3, 38, 17, 0, 2, 0, 29, 0, 11, 39, 8, 0, 22, 0, 12, 45, 20, 0, 19, 72, 264, 8, 2, 36, 18, 0, 50, 29, 113, 6, 2, 1, 2, 37, 22, 0, 26, 5, 2, 1, 2, 31, 15, 0, 328, 18, 16, 0, 2, 12, 2, 33, 125, 0, 80, 921, 103, 110, 18, 195, 2637, 96, 16, 1071, 18, 5, 4026, 582, 8634, 568, 8, 30, 18, 78, 18, 29, 19, 47, 17, 3, 32, 20, 6, 18, 689, 63, 129, 74, 6, 0, 67, 12, 65, 1, 2, 0, 29, 6135, 9, 1237, 43, 8, 8936, 3, 2, 6, 2, 1, 2, 290, 16, 0, 30, 2, 3, 0, 15, 3, 9, 395, 2309, 106, 6, 12, 4, 8, 8, 9, 5991, 84, 2, 70, 2, 1, 3, 0, 3, 1, 3, 3, 2, 11, 2, 0, 2, 6, 2, 64, 2, 3, 3, 7, 2, 6, 2, 27, 2, 3, 2, 4, 2, 0, 4, 6, 2, 339, 3, 24, 2, 24, 2, 30, 2, 24, 2, 30, 2, 24, 2, 30, 2, 24, 2, 30, 2, 24, 2, 7, 1845, 30, 7, 5, 262, 61, 147, 44, 11, 6, 17, 0, 322, 29, 19, 43, 485, 27, 757, 6, 2, 3, 2, 1, 2, 14, 2, 196, 60, 67, 8, 0, 1205, 3, 2, 26, 2, 1, 2, 0, 3, 0, 2, 9, 2, 3, 2, 0, 2, 0, 7, 0, 5, 0, 2, 0, 2, 0, 2, 2, 2, 1, 2, 0, 3, 0, 2, 0, 2, 0, 2, 0, 2, 0, 2, 1, 2, 0, 3, 3, 2, 6, 2, 3, 2, 3, 2, 0, 2, 9, 2, 16, 6, 2, 2, 4, 2, 16, 4421, 42719, 33, 4153, 7, 221, 3, 5761, 15, 7472, 16, 621, 2467, 541, 1507, 4938, 6, 4191];
    var astralIdentifierCodes = [509, 0, 227, 0, 150, 4, 294, 9, 1368, 2, 2, 1, 6, 3, 41, 2, 5, 0, 166, 1, 574, 3, 9, 9, 370, 1, 81, 2, 71, 10, 50, 3, 123, 2, 54, 14, 32, 10, 3, 1, 11, 3, 46, 10, 8, 0, 46, 9, 7, 2, 37, 13, 2, 9, 6, 1, 45, 0, 13, 2, 49, 13, 9, 3, 2, 11, 83, 11, 7, 0, 3, 0, 158, 11, 6, 9, 7, 3, 56, 1, 2, 6, 3, 1, 3, 2, 10, 0, 11, 1, 3, 6, 4, 4, 193, 17, 10, 9, 5, 0, 82, 19, 13, 9, 214, 6, 3, 8, 28, 1, 83, 16, 16, 9, 82, 12, 9, 9, 84, 14, 5, 9, 243, 14, 166, 9, 71, 5, 2, 1, 3, 3, 2, 0, 2, 1, 13, 9, 120, 6, 3, 6, 4, 0, 29, 9, 41, 6, 2, 3, 9, 0, 10, 10, 47, 15, 406, 7, 2, 7, 17, 9, 57, 21, 2, 13, 123, 5, 4, 0, 2, 1, 2, 6, 2, 0, 9, 9, 49, 4, 2, 1, 2, 4, 9, 9, 330, 3, 10, 1, 2, 0, 49, 6, 4, 4, 14, 9, 5351, 0, 7, 14, 13835, 9, 87, 9, 39, 4, 60, 6, 26, 9, 1014, 0, 2, 54, 8, 3, 82, 0, 12, 1, 19628, 1, 4706, 45, 3, 22, 543, 4, 4, 5, 9, 7, 3, 6, 31, 3, 149, 2, 1418, 49, 513, 54, 5, 49, 9, 0, 15, 0, 23, 4, 2, 14, 1361, 6, 2, 16, 3, 6, 2, 1, 2, 4, 101, 0, 161, 6, 10, 9, 357, 0, 62, 13, 499, 13, 983, 6, 110, 6, 6, 9, 4759, 9, 787719, 239];
    function isInAstralSet(code, set) {
      let pos = 65536;
      for (let i = 0, length = set.length; i < length; i += 2) {
        pos += set[i];
        if (pos > code)
          return false;
        pos += set[i + 1];
        if (pos >= code)
          return true;
      }
      return false;
    }
    function isIdentifierStart(code) {
      if (code < 65)
        return code === 36;
      if (code <= 90)
        return true;
      if (code < 97)
        return code === 95;
      if (code <= 122)
        return true;
      if (code <= 65535) {
        return code >= 170 && nonASCIIidentifierStart.test(String.fromCharCode(code));
      }
      return isInAstralSet(code, astralIdentifierStartCodes);
    }
    function isIdentifierChar(code) {
      if (code < 48)
        return code === 36;
      if (code < 58)
        return true;
      if (code < 65)
        return false;
      if (code <= 90)
        return true;
      if (code < 97)
        return code === 95;
      if (code <= 122)
        return true;
      if (code <= 65535) {
        return code >= 170 && nonASCIIidentifier.test(String.fromCharCode(code));
      }
      return isInAstralSet(code, astralIdentifierStartCodes) || isInAstralSet(code, astralIdentifierCodes);
    }
    function isIdentifierName(name) {
      let isFirst = true;
      for (let i = 0; i < name.length; i++) {
        let cp = name.charCodeAt(i);
        if ((cp & 64512) === 55296 && i + 1 < name.length) {
          const trail = name.charCodeAt(++i);
          if ((trail & 64512) === 56320) {
            cp = 65536 + ((cp & 1023) << 10) + (trail & 1023);
          }
        }
        if (isFirst) {
          isFirst = false;
          if (!isIdentifierStart(cp)) {
            return false;
          }
        } else if (!isIdentifierChar(cp)) {
          return false;
        }
      }
      return !isFirst;
    }
  }
});

// node_modules/.pnpm/@babel+helper-validator-identifier@7.22.20/node_modules/@babel/helper-validator-identifier/lib/keyword.js
var require_keyword = _chunkGQ77QZBOjs.__commonJS.call(void 0, {
  "node_modules/.pnpm/@babel+helper-validator-identifier@7.22.20/node_modules/@babel/helper-validator-identifier/lib/keyword.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.isKeyword = isKeyword;
    exports.isReservedWord = isReservedWord;
    exports.isStrictBindOnlyReservedWord = isStrictBindOnlyReservedWord;
    exports.isStrictBindReservedWord = isStrictBindReservedWord;
    exports.isStrictReservedWord = isStrictReservedWord;
    var reservedWords2 = {
      keyword: ["break", "case", "catch", "continue", "debugger", "default", "do", "else", "finally", "for", "function", "if", "return", "switch", "throw", "try", "var", "const", "while", "with", "new", "this", "super", "class", "extends", "export", "import", "null", "true", "false", "in", "instanceof", "typeof", "void", "delete"],
      strict: ["implements", "interface", "let", "package", "private", "protected", "public", "static", "yield"],
      strictBind: ["eval", "arguments"]
    };
    var keywords = new Set(reservedWords2.keyword);
    var reservedWordsStrictSet = new Set(reservedWords2.strict);
    var reservedWordsStrictBindSet = new Set(reservedWords2.strictBind);
    function isReservedWord(word, inModule) {
      return inModule && word === "await" || word === "enum";
    }
    function isStrictReservedWord(word, inModule) {
      return isReservedWord(word, inModule) || reservedWordsStrictSet.has(word);
    }
    function isStrictBindOnlyReservedWord(word) {
      return reservedWordsStrictBindSet.has(word);
    }
    function isStrictBindReservedWord(word, inModule) {
      return isStrictReservedWord(word, inModule) || isStrictBindOnlyReservedWord(word);
    }
    function isKeyword(word) {
      return keywords.has(word);
    }
  }
});

// node_modules/.pnpm/@babel+helper-validator-identifier@7.22.20/node_modules/@babel/helper-validator-identifier/lib/index.js
var require_lib = _chunkGQ77QZBOjs.__commonJS.call(void 0, {
  "node_modules/.pnpm/@babel+helper-validator-identifier@7.22.20/node_modules/@babel/helper-validator-identifier/lib/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    Object.defineProperty(exports, "isIdentifierChar", {
      enumerable: true,
      get: function() {
        return _identifier.isIdentifierChar;
      }
    });
    Object.defineProperty(exports, "isIdentifierName", {
      enumerable: true,
      get: function() {
        return _identifier.isIdentifierName;
      }
    });
    Object.defineProperty(exports, "isIdentifierStart", {
      enumerable: true,
      get: function() {
        return _identifier.isIdentifierStart;
      }
    });
    Object.defineProperty(exports, "isKeyword", {
      enumerable: true,
      get: function() {
        return _keyword.isKeyword;
      }
    });
    Object.defineProperty(exports, "isReservedWord", {
      enumerable: true,
      get: function() {
        return _keyword.isReservedWord;
      }
    });
    Object.defineProperty(exports, "isStrictBindOnlyReservedWord", {
      enumerable: true,
      get: function() {
        return _keyword.isStrictBindOnlyReservedWord;
      }
    });
    Object.defineProperty(exports, "isStrictBindReservedWord", {
      enumerable: true,
      get: function() {
        return _keyword.isStrictBindReservedWord;
      }
    });
    Object.defineProperty(exports, "isStrictReservedWord", {
      enumerable: true,
      get: function() {
        return _keyword.isStrictReservedWord;
      }
    });
    var _identifier = require_identifier();
    var _keyword = require_keyword();
  }
});

// node_modules/.pnpm/escape-string-regexp@1.0.5/node_modules/escape-string-regexp/index.js
var require_escape_string_regexp = _chunkGQ77QZBOjs.__commonJS.call(void 0, {
  "node_modules/.pnpm/escape-string-regexp@1.0.5/node_modules/escape-string-regexp/index.js"(exports, module) {
    "use strict";
    var matchOperatorsRe = /[|\\{}()[\]^$+*?.]/g;
    module.exports = function(str) {
      if (typeof str !== "string") {
        throw new TypeError("Expected a string");
      }
      return str.replace(matchOperatorsRe, "\\$&");
    };
  }
});

// node_modules/.pnpm/color-name@1.1.3/node_modules/color-name/index.js
var require_color_name = _chunkGQ77QZBOjs.__commonJS.call(void 0, {
  "node_modules/.pnpm/color-name@1.1.3/node_modules/color-name/index.js"(exports, module) {
    "use strict";
    module.exports = {
      "aliceblue": [240, 248, 255],
      "antiquewhite": [250, 235, 215],
      "aqua": [0, 255, 255],
      "aquamarine": [127, 255, 212],
      "azure": [240, 255, 255],
      "beige": [245, 245, 220],
      "bisque": [255, 228, 196],
      "black": [0, 0, 0],
      "blanchedalmond": [255, 235, 205],
      "blue": [0, 0, 255],
      "blueviolet": [138, 43, 226],
      "brown": [165, 42, 42],
      "burlywood": [222, 184, 135],
      "cadetblue": [95, 158, 160],
      "chartreuse": [127, 255, 0],
      "chocolate": [210, 105, 30],
      "coral": [255, 127, 80],
      "cornflowerblue": [100, 149, 237],
      "cornsilk": [255, 248, 220],
      "crimson": [220, 20, 60],
      "cyan": [0, 255, 255],
      "darkblue": [0, 0, 139],
      "darkcyan": [0, 139, 139],
      "darkgoldenrod": [184, 134, 11],
      "darkgray": [169, 169, 169],
      "darkgreen": [0, 100, 0],
      "darkgrey": [169, 169, 169],
      "darkkhaki": [189, 183, 107],
      "darkmagenta": [139, 0, 139],
      "darkolivegreen": [85, 107, 47],
      "darkorange": [255, 140, 0],
      "darkorchid": [153, 50, 204],
      "darkred": [139, 0, 0],
      "darksalmon": [233, 150, 122],
      "darkseagreen": [143, 188, 143],
      "darkslateblue": [72, 61, 139],
      "darkslategray": [47, 79, 79],
      "darkslategrey": [47, 79, 79],
      "darkturquoise": [0, 206, 209],
      "darkviolet": [148, 0, 211],
      "deeppink": [255, 20, 147],
      "deepskyblue": [0, 191, 255],
      "dimgray": [105, 105, 105],
      "dimgrey": [105, 105, 105],
      "dodgerblue": [30, 144, 255],
      "firebrick": [178, 34, 34],
      "floralwhite": [255, 250, 240],
      "forestgreen": [34, 139, 34],
      "fuchsia": [255, 0, 255],
      "gainsboro": [220, 220, 220],
      "ghostwhite": [248, 248, 255],
      "gold": [255, 215, 0],
      "goldenrod": [218, 165, 32],
      "gray": [128, 128, 128],
      "green": [0, 128, 0],
      "greenyellow": [173, 255, 47],
      "grey": [128, 128, 128],
      "honeydew": [240, 255, 240],
      "hotpink": [255, 105, 180],
      "indianred": [205, 92, 92],
      "indigo": [75, 0, 130],
      "ivory": [255, 255, 240],
      "khaki": [240, 230, 140],
      "lavender": [230, 230, 250],
      "lavenderblush": [255, 240, 245],
      "lawngreen": [124, 252, 0],
      "lemonchiffon": [255, 250, 205],
      "lightblue": [173, 216, 230],
      "lightcoral": [240, 128, 128],
      "lightcyan": [224, 255, 255],
      "lightgoldenrodyellow": [250, 250, 210],
      "lightgray": [211, 211, 211],
      "lightgreen": [144, 238, 144],
      "lightgrey": [211, 211, 211],
      "lightpink": [255, 182, 193],
      "lightsalmon": [255, 160, 122],
      "lightseagreen": [32, 178, 170],
      "lightskyblue": [135, 206, 250],
      "lightslategray": [119, 136, 153],
      "lightslategrey": [119, 136, 153],
      "lightsteelblue": [176, 196, 222],
      "lightyellow": [255, 255, 224],
      "lime": [0, 255, 0],
      "limegreen": [50, 205, 50],
      "linen": [250, 240, 230],
      "magenta": [255, 0, 255],
      "maroon": [128, 0, 0],
      "mediumaquamarine": [102, 205, 170],
      "mediumblue": [0, 0, 205],
      "mediumorchid": [186, 85, 211],
      "mediumpurple": [147, 112, 219],
      "mediumseagreen": [60, 179, 113],
      "mediumslateblue": [123, 104, 238],
      "mediumspringgreen": [0, 250, 154],
      "mediumturquoise": [72, 209, 204],
      "mediumvioletred": [199, 21, 133],
      "midnightblue": [25, 25, 112],
      "mintcream": [245, 255, 250],
      "mistyrose": [255, 228, 225],
      "moccasin": [255, 228, 181],
      "navajowhite": [255, 222, 173],
      "navy": [0, 0, 128],
      "oldlace": [253, 245, 230],
      "olive": [128, 128, 0],
      "olivedrab": [107, 142, 35],
      "orange": [255, 165, 0],
      "orangered": [255, 69, 0],
      "orchid": [218, 112, 214],
      "palegoldenrod": [238, 232, 170],
      "palegreen": [152, 251, 152],
      "paleturquoise": [175, 238, 238],
      "palevioletred": [219, 112, 147],
      "papayawhip": [255, 239, 213],
      "peachpuff": [255, 218, 185],
      "peru": [205, 133, 63],
      "pink": [255, 192, 203],
      "plum": [221, 160, 221],
      "powderblue": [176, 224, 230],
      "purple": [128, 0, 128],
      "rebeccapurple": [102, 51, 153],
      "red": [255, 0, 0],
      "rosybrown": [188, 143, 143],
      "royalblue": [65, 105, 225],
      "saddlebrown": [139, 69, 19],
      "salmon": [250, 128, 114],
      "sandybrown": [244, 164, 96],
      "seagreen": [46, 139, 87],
      "seashell": [255, 245, 238],
      "sienna": [160, 82, 45],
      "silver": [192, 192, 192],
      "skyblue": [135, 206, 235],
      "slateblue": [106, 90, 205],
      "slategray": [112, 128, 144],
      "slategrey": [112, 128, 144],
      "snow": [255, 250, 250],
      "springgreen": [0, 255, 127],
      "steelblue": [70, 130, 180],
      "tan": [210, 180, 140],
      "teal": [0, 128, 128],
      "thistle": [216, 191, 216],
      "tomato": [255, 99, 71],
      "turquoise": [64, 224, 208],
      "violet": [238, 130, 238],
      "wheat": [245, 222, 179],
      "white": [255, 255, 255],
      "whitesmoke": [245, 245, 245],
      "yellow": [255, 255, 0],
      "yellowgreen": [154, 205, 50]
    };
  }
});

// node_modules/.pnpm/color-convert@1.9.3/node_modules/color-convert/conversions.js
var require_conversions = _chunkGQ77QZBOjs.__commonJS.call(void 0, {
  "node_modules/.pnpm/color-convert@1.9.3/node_modules/color-convert/conversions.js"(exports, module) {
    "use strict";
    var cssKeywords = require_color_name();
    var reverseKeywords = {};
    for (key in cssKeywords) {
      if (cssKeywords.hasOwnProperty(key)) {
        reverseKeywords[cssKeywords[key]] = key;
      }
    }
    var key;
    var convert = module.exports = {
      rgb: { channels: 3, labels: "rgb" },
      hsl: { channels: 3, labels: "hsl" },
      hsv: { channels: 3, labels: "hsv" },
      hwb: { channels: 3, labels: "hwb" },
      cmyk: { channels: 4, labels: "cmyk" },
      xyz: { channels: 3, labels: "xyz" },
      lab: { channels: 3, labels: "lab" },
      lch: { channels: 3, labels: "lch" },
      hex: { channels: 1, labels: ["hex"] },
      keyword: { channels: 1, labels: ["keyword"] },
      ansi16: { channels: 1, labels: ["ansi16"] },
      ansi256: { channels: 1, labels: ["ansi256"] },
      hcg: { channels: 3, labels: ["h", "c", "g"] },
      apple: { channels: 3, labels: ["r16", "g16", "b16"] },
      gray: { channels: 1, labels: ["gray"] }
    };
    for (model in convert) {
      if (convert.hasOwnProperty(model)) {
        if (!("channels" in convert[model])) {
          throw new Error("missing channels property: " + model);
        }
        if (!("labels" in convert[model])) {
          throw new Error("missing channel labels property: " + model);
        }
        if (convert[model].labels.length !== convert[model].channels) {
          throw new Error("channel and label counts mismatch: " + model);
        }
        channels = convert[model].channels;
        labels = convert[model].labels;
        delete convert[model].channels;
        delete convert[model].labels;
        Object.defineProperty(convert[model], "channels", { value: channels });
        Object.defineProperty(convert[model], "labels", { value: labels });
      }
    }
    var channels;
    var labels;
    var model;
    convert.rgb.hsl = function(rgb) {
      var r = rgb[0] / 255;
      var g = rgb[1] / 255;
      var b = rgb[2] / 255;
      var min = Math.min(r, g, b);
      var max = Math.max(r, g, b);
      var delta = max - min;
      var h;
      var s;
      var l;
      if (max === min) {
        h = 0;
      } else if (r === max) {
        h = (g - b) / delta;
      } else if (g === max) {
        h = 2 + (b - r) / delta;
      } else if (b === max) {
        h = 4 + (r - g) / delta;
      }
      h = Math.min(h * 60, 360);
      if (h < 0) {
        h += 360;
      }
      l = (min + max) / 2;
      if (max === min) {
        s = 0;
      } else if (l <= 0.5) {
        s = delta / (max + min);
      } else {
        s = delta / (2 - max - min);
      }
      return [h, s * 100, l * 100];
    };
    convert.rgb.hsv = function(rgb) {
      var rdif;
      var gdif;
      var bdif;
      var h;
      var s;
      var r = rgb[0] / 255;
      var g = rgb[1] / 255;
      var b = rgb[2] / 255;
      var v = Math.max(r, g, b);
      var diff = v - Math.min(r, g, b);
      var diffc = function(c) {
        return (v - c) / 6 / diff + 1 / 2;
      };
      if (diff === 0) {
        h = s = 0;
      } else {
        s = diff / v;
        rdif = diffc(r);
        gdif = diffc(g);
        bdif = diffc(b);
        if (r === v) {
          h = bdif - gdif;
        } else if (g === v) {
          h = 1 / 3 + rdif - bdif;
        } else if (b === v) {
          h = 2 / 3 + gdif - rdif;
        }
        if (h < 0) {
          h += 1;
        } else if (h > 1) {
          h -= 1;
        }
      }
      return [
        h * 360,
        s * 100,
        v * 100
      ];
    };
    convert.rgb.hwb = function(rgb) {
      var r = rgb[0];
      var g = rgb[1];
      var b = rgb[2];
      var h = convert.rgb.hsl(rgb)[0];
      var w = 1 / 255 * Math.min(r, Math.min(g, b));
      b = 1 - 1 / 255 * Math.max(r, Math.max(g, b));
      return [h, w * 100, b * 100];
    };
    convert.rgb.cmyk = function(rgb) {
      var r = rgb[0] / 255;
      var g = rgb[1] / 255;
      var b = rgb[2] / 255;
      var c;
      var m;
      var y;
      var k;
      k = Math.min(1 - r, 1 - g, 1 - b);
      c = (1 - r - k) / (1 - k) || 0;
      m = (1 - g - k) / (1 - k) || 0;
      y = (1 - b - k) / (1 - k) || 0;
      return [c * 100, m * 100, y * 100, k * 100];
    };
    function comparativeDistance(x, y) {
      return Math.pow(x[0] - y[0], 2) + Math.pow(x[1] - y[1], 2) + Math.pow(x[2] - y[2], 2);
    }
    convert.rgb.keyword = function(rgb) {
      var reversed = reverseKeywords[rgb];
      if (reversed) {
        return reversed;
      }
      var currentClosestDistance = Infinity;
      var currentClosestKeyword;
      for (var keyword in cssKeywords) {
        if (cssKeywords.hasOwnProperty(keyword)) {
          var value = cssKeywords[keyword];
          var distance = comparativeDistance(rgb, value);
          if (distance < currentClosestDistance) {
            currentClosestDistance = distance;
            currentClosestKeyword = keyword;
          }
        }
      }
      return currentClosestKeyword;
    };
    convert.keyword.rgb = function(keyword) {
      return cssKeywords[keyword];
    };
    convert.rgb.xyz = function(rgb) {
      var r = rgb[0] / 255;
      var g = rgb[1] / 255;
      var b = rgb[2] / 255;
      r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
      g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
      b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;
      var x = r * 0.4124 + g * 0.3576 + b * 0.1805;
      var y = r * 0.2126 + g * 0.7152 + b * 0.0722;
      var z = r * 0.0193 + g * 0.1192 + b * 0.9505;
      return [x * 100, y * 100, z * 100];
    };
    convert.rgb.lab = function(rgb) {
      var xyz = convert.rgb.xyz(rgb);
      var x = xyz[0];
      var y = xyz[1];
      var z = xyz[2];
      var l;
      var a;
      var b;
      x /= 95.047;
      y /= 100;
      z /= 108.883;
      x = x > 8856e-6 ? Math.pow(x, 1 / 3) : 7.787 * x + 16 / 116;
      y = y > 8856e-6 ? Math.pow(y, 1 / 3) : 7.787 * y + 16 / 116;
      z = z > 8856e-6 ? Math.pow(z, 1 / 3) : 7.787 * z + 16 / 116;
      l = 116 * y - 16;
      a = 500 * (x - y);
      b = 200 * (y - z);
      return [l, a, b];
    };
    convert.hsl.rgb = function(hsl) {
      var h = hsl[0] / 360;
      var s = hsl[1] / 100;
      var l = hsl[2] / 100;
      var t1;
      var t2;
      var t3;
      var rgb;
      var val;
      if (s === 0) {
        val = l * 255;
        return [val, val, val];
      }
      if (l < 0.5) {
        t2 = l * (1 + s);
      } else {
        t2 = l + s - l * s;
      }
      t1 = 2 * l - t2;
      rgb = [0, 0, 0];
      for (var i = 0; i < 3; i++) {
        t3 = h + 1 / 3 * -(i - 1);
        if (t3 < 0) {
          t3++;
        }
        if (t3 > 1) {
          t3--;
        }
        if (6 * t3 < 1) {
          val = t1 + (t2 - t1) * 6 * t3;
        } else if (2 * t3 < 1) {
          val = t2;
        } else if (3 * t3 < 2) {
          val = t1 + (t2 - t1) * (2 / 3 - t3) * 6;
        } else {
          val = t1;
        }
        rgb[i] = val * 255;
      }
      return rgb;
    };
    convert.hsl.hsv = function(hsl) {
      var h = hsl[0];
      var s = hsl[1] / 100;
      var l = hsl[2] / 100;
      var smin = s;
      var lmin = Math.max(l, 0.01);
      var sv;
      var v;
      l *= 2;
      s *= l <= 1 ? l : 2 - l;
      smin *= lmin <= 1 ? lmin : 2 - lmin;
      v = (l + s) / 2;
      sv = l === 0 ? 2 * smin / (lmin + smin) : 2 * s / (l + s);
      return [h, sv * 100, v * 100];
    };
    convert.hsv.rgb = function(hsv) {
      var h = hsv[0] / 60;
      var s = hsv[1] / 100;
      var v = hsv[2] / 100;
      var hi = Math.floor(h) % 6;
      var f = h - Math.floor(h);
      var p = 255 * v * (1 - s);
      var q = 255 * v * (1 - s * f);
      var t = 255 * v * (1 - s * (1 - f));
      v *= 255;
      switch (hi) {
        case 0:
          return [v, t, p];
        case 1:
          return [q, v, p];
        case 2:
          return [p, v, t];
        case 3:
          return [p, q, v];
        case 4:
          return [t, p, v];
        case 5:
          return [v, p, q];
      }
    };
    convert.hsv.hsl = function(hsv) {
      var h = hsv[0];
      var s = hsv[1] / 100;
      var v = hsv[2] / 100;
      var vmin = Math.max(v, 0.01);
      var lmin;
      var sl;
      var l;
      l = (2 - s) * v;
      lmin = (2 - s) * vmin;
      sl = s * vmin;
      sl /= lmin <= 1 ? lmin : 2 - lmin;
      sl = sl || 0;
      l /= 2;
      return [h, sl * 100, l * 100];
    };
    convert.hwb.rgb = function(hwb) {
      var h = hwb[0] / 360;
      var wh = hwb[1] / 100;
      var bl = hwb[2] / 100;
      var ratio = wh + bl;
      var i;
      var v;
      var f;
      var n;
      if (ratio > 1) {
        wh /= ratio;
        bl /= ratio;
      }
      i = Math.floor(6 * h);
      v = 1 - bl;
      f = 6 * h - i;
      if ((i & 1) !== 0) {
        f = 1 - f;
      }
      n = wh + f * (v - wh);
      var r;
      var g;
      var b;
      switch (i) {
        default:
        case 6:
        case 0:
          r = v;
          g = n;
          b = wh;
          break;
        case 1:
          r = n;
          g = v;
          b = wh;
          break;
        case 2:
          r = wh;
          g = v;
          b = n;
          break;
        case 3:
          r = wh;
          g = n;
          b = v;
          break;
        case 4:
          r = n;
          g = wh;
          b = v;
          break;
        case 5:
          r = v;
          g = wh;
          b = n;
          break;
      }
      return [r * 255, g * 255, b * 255];
    };
    convert.cmyk.rgb = function(cmyk) {
      var c = cmyk[0] / 100;
      var m = cmyk[1] / 100;
      var y = cmyk[2] / 100;
      var k = cmyk[3] / 100;
      var r;
      var g;
      var b;
      r = 1 - Math.min(1, c * (1 - k) + k);
      g = 1 - Math.min(1, m * (1 - k) + k);
      b = 1 - Math.min(1, y * (1 - k) + k);
      return [r * 255, g * 255, b * 255];
    };
    convert.xyz.rgb = function(xyz) {
      var x = xyz[0] / 100;
      var y = xyz[1] / 100;
      var z = xyz[2] / 100;
      var r;
      var g;
      var b;
      r = x * 3.2406 + y * -1.5372 + z * -0.4986;
      g = x * -0.9689 + y * 1.8758 + z * 0.0415;
      b = x * 0.0557 + y * -0.204 + z * 1.057;
      r = r > 31308e-7 ? 1.055 * Math.pow(r, 1 / 2.4) - 0.055 : r * 12.92;
      g = g > 31308e-7 ? 1.055 * Math.pow(g, 1 / 2.4) - 0.055 : g * 12.92;
      b = b > 31308e-7 ? 1.055 * Math.pow(b, 1 / 2.4) - 0.055 : b * 12.92;
      r = Math.min(Math.max(0, r), 1);
      g = Math.min(Math.max(0, g), 1);
      b = Math.min(Math.max(0, b), 1);
      return [r * 255, g * 255, b * 255];
    };
    convert.xyz.lab = function(xyz) {
      var x = xyz[0];
      var y = xyz[1];
      var z = xyz[2];
      var l;
      var a;
      var b;
      x /= 95.047;
      y /= 100;
      z /= 108.883;
      x = x > 8856e-6 ? Math.pow(x, 1 / 3) : 7.787 * x + 16 / 116;
      y = y > 8856e-6 ? Math.pow(y, 1 / 3) : 7.787 * y + 16 / 116;
      z = z > 8856e-6 ? Math.pow(z, 1 / 3) : 7.787 * z + 16 / 116;
      l = 116 * y - 16;
      a = 500 * (x - y);
      b = 200 * (y - z);
      return [l, a, b];
    };
    convert.lab.xyz = function(lab) {
      var l = lab[0];
      var a = lab[1];
      var b = lab[2];
      var x;
      var y;
      var z;
      y = (l + 16) / 116;
      x = a / 500 + y;
      z = y - b / 200;
      var y2 = Math.pow(y, 3);
      var x2 = Math.pow(x, 3);
      var z2 = Math.pow(z, 3);
      y = y2 > 8856e-6 ? y2 : (y - 16 / 116) / 7.787;
      x = x2 > 8856e-6 ? x2 : (x - 16 / 116) / 7.787;
      z = z2 > 8856e-6 ? z2 : (z - 16 / 116) / 7.787;
      x *= 95.047;
      y *= 100;
      z *= 108.883;
      return [x, y, z];
    };
    convert.lab.lch = function(lab) {
      var l = lab[0];
      var a = lab[1];
      var b = lab[2];
      var hr;
      var h;
      var c;
      hr = Math.atan2(b, a);
      h = hr * 360 / 2 / Math.PI;
      if (h < 0) {
        h += 360;
      }
      c = Math.sqrt(a * a + b * b);
      return [l, c, h];
    };
    convert.lch.lab = function(lch) {
      var l = lch[0];
      var c = lch[1];
      var h = lch[2];
      var a;
      var b;
      var hr;
      hr = h / 360 * 2 * Math.PI;
      a = c * Math.cos(hr);
      b = c * Math.sin(hr);
      return [l, a, b];
    };
    convert.rgb.ansi16 = function(args) {
      var r = args[0];
      var g = args[1];
      var b = args[2];
      var value = 1 in arguments ? arguments[1] : convert.rgb.hsv(args)[2];
      value = Math.round(value / 50);
      if (value === 0) {
        return 30;
      }
      var ansi = 30 + (Math.round(b / 255) << 2 | Math.round(g / 255) << 1 | Math.round(r / 255));
      if (value === 2) {
        ansi += 60;
      }
      return ansi;
    };
    convert.hsv.ansi16 = function(args) {
      return convert.rgb.ansi16(convert.hsv.rgb(args), args[2]);
    };
    convert.rgb.ansi256 = function(args) {
      var r = args[0];
      var g = args[1];
      var b = args[2];
      if (r === g && g === b) {
        if (r < 8) {
          return 16;
        }
        if (r > 248) {
          return 231;
        }
        return Math.round((r - 8) / 247 * 24) + 232;
      }
      var ansi = 16 + 36 * Math.round(r / 255 * 5) + 6 * Math.round(g / 255 * 5) + Math.round(b / 255 * 5);
      return ansi;
    };
    convert.ansi16.rgb = function(args) {
      var color = args % 10;
      if (color === 0 || color === 7) {
        if (args > 50) {
          color += 3.5;
        }
        color = color / 10.5 * 255;
        return [color, color, color];
      }
      var mult = (~~(args > 50) + 1) * 0.5;
      var r = (color & 1) * mult * 255;
      var g = (color >> 1 & 1) * mult * 255;
      var b = (color >> 2 & 1) * mult * 255;
      return [r, g, b];
    };
    convert.ansi256.rgb = function(args) {
      if (args >= 232) {
        var c = (args - 232) * 10 + 8;
        return [c, c, c];
      }
      args -= 16;
      var rem;
      var r = Math.floor(args / 36) / 5 * 255;
      var g = Math.floor((rem = args % 36) / 6) / 5 * 255;
      var b = rem % 6 / 5 * 255;
      return [r, g, b];
    };
    convert.rgb.hex = function(args) {
      var integer = ((Math.round(args[0]) & 255) << 16) + ((Math.round(args[1]) & 255) << 8) + (Math.round(args[2]) & 255);
      var string = integer.toString(16).toUpperCase();
      return "000000".substring(string.length) + string;
    };
    convert.hex.rgb = function(args) {
      var match = args.toString(16).match(/[a-f0-9]{6}|[a-f0-9]{3}/i);
      if (!match) {
        return [0, 0, 0];
      }
      var colorString = match[0];
      if (match[0].length === 3) {
        colorString = colorString.split("").map(function(char) {
          return char + char;
        }).join("");
      }
      var integer = parseInt(colorString, 16);
      var r = integer >> 16 & 255;
      var g = integer >> 8 & 255;
      var b = integer & 255;
      return [r, g, b];
    };
    convert.rgb.hcg = function(rgb) {
      var r = rgb[0] / 255;
      var g = rgb[1] / 255;
      var b = rgb[2] / 255;
      var max = Math.max(Math.max(r, g), b);
      var min = Math.min(Math.min(r, g), b);
      var chroma = max - min;
      var grayscale;
      var hue;
      if (chroma < 1) {
        grayscale = min / (1 - chroma);
      } else {
        grayscale = 0;
      }
      if (chroma <= 0) {
        hue = 0;
      } else if (max === r) {
        hue = (g - b) / chroma % 6;
      } else if (max === g) {
        hue = 2 + (b - r) / chroma;
      } else {
        hue = 4 + (r - g) / chroma + 4;
      }
      hue /= 6;
      hue %= 1;
      return [hue * 360, chroma * 100, grayscale * 100];
    };
    convert.hsl.hcg = function(hsl) {
      var s = hsl[1] / 100;
      var l = hsl[2] / 100;
      var c = 1;
      var f = 0;
      if (l < 0.5) {
        c = 2 * s * l;
      } else {
        c = 2 * s * (1 - l);
      }
      if (c < 1) {
        f = (l - 0.5 * c) / (1 - c);
      }
      return [hsl[0], c * 100, f * 100];
    };
    convert.hsv.hcg = function(hsv) {
      var s = hsv[1] / 100;
      var v = hsv[2] / 100;
      var c = s * v;
      var f = 0;
      if (c < 1) {
        f = (v - c) / (1 - c);
      }
      return [hsv[0], c * 100, f * 100];
    };
    convert.hcg.rgb = function(hcg) {
      var h = hcg[0] / 360;
      var c = hcg[1] / 100;
      var g = hcg[2] / 100;
      if (c === 0) {
        return [g * 255, g * 255, g * 255];
      }
      var pure = [0, 0, 0];
      var hi = h % 1 * 6;
      var v = hi % 1;
      var w = 1 - v;
      var mg = 0;
      switch (Math.floor(hi)) {
        case 0:
          pure[0] = 1;
          pure[1] = v;
          pure[2] = 0;
          break;
        case 1:
          pure[0] = w;
          pure[1] = 1;
          pure[2] = 0;
          break;
        case 2:
          pure[0] = 0;
          pure[1] = 1;
          pure[2] = v;
          break;
        case 3:
          pure[0] = 0;
          pure[1] = w;
          pure[2] = 1;
          break;
        case 4:
          pure[0] = v;
          pure[1] = 0;
          pure[2] = 1;
          break;
        default:
          pure[0] = 1;
          pure[1] = 0;
          pure[2] = w;
      }
      mg = (1 - c) * g;
      return [
        (c * pure[0] + mg) * 255,
        (c * pure[1] + mg) * 255,
        (c * pure[2] + mg) * 255
      ];
    };
    convert.hcg.hsv = function(hcg) {
      var c = hcg[1] / 100;
      var g = hcg[2] / 100;
      var v = c + g * (1 - c);
      var f = 0;
      if (v > 0) {
        f = c / v;
      }
      return [hcg[0], f * 100, v * 100];
    };
    convert.hcg.hsl = function(hcg) {
      var c = hcg[1] / 100;
      var g = hcg[2] / 100;
      var l = g * (1 - c) + 0.5 * c;
      var s = 0;
      if (l > 0 && l < 0.5) {
        s = c / (2 * l);
      } else if (l >= 0.5 && l < 1) {
        s = c / (2 * (1 - l));
      }
      return [hcg[0], s * 100, l * 100];
    };
    convert.hcg.hwb = function(hcg) {
      var c = hcg[1] / 100;
      var g = hcg[2] / 100;
      var v = c + g * (1 - c);
      return [hcg[0], (v - c) * 100, (1 - v) * 100];
    };
    convert.hwb.hcg = function(hwb) {
      var w = hwb[1] / 100;
      var b = hwb[2] / 100;
      var v = 1 - b;
      var c = v - w;
      var g = 0;
      if (c < 1) {
        g = (v - c) / (1 - c);
      }
      return [hwb[0], c * 100, g * 100];
    };
    convert.apple.rgb = function(apple) {
      return [apple[0] / 65535 * 255, apple[1] / 65535 * 255, apple[2] / 65535 * 255];
    };
    convert.rgb.apple = function(rgb) {
      return [rgb[0] / 255 * 65535, rgb[1] / 255 * 65535, rgb[2] / 255 * 65535];
    };
    convert.gray.rgb = function(args) {
      return [args[0] / 100 * 255, args[0] / 100 * 255, args[0] / 100 * 255];
    };
    convert.gray.hsl = convert.gray.hsv = function(args) {
      return [0, 0, args[0]];
    };
    convert.gray.hwb = function(gray) {
      return [0, 100, gray[0]];
    };
    convert.gray.cmyk = function(gray) {
      return [0, 0, 0, gray[0]];
    };
    convert.gray.lab = function(gray) {
      return [gray[0], 0, 0];
    };
    convert.gray.hex = function(gray) {
      var val = Math.round(gray[0] / 100 * 255) & 255;
      var integer = (val << 16) + (val << 8) + val;
      var string = integer.toString(16).toUpperCase();
      return "000000".substring(string.length) + string;
    };
    convert.rgb.gray = function(rgb) {
      var val = (rgb[0] + rgb[1] + rgb[2]) / 3;
      return [val / 255 * 100];
    };
  }
});

// node_modules/.pnpm/color-convert@1.9.3/node_modules/color-convert/route.js
var require_route = _chunkGQ77QZBOjs.__commonJS.call(void 0, {
  "node_modules/.pnpm/color-convert@1.9.3/node_modules/color-convert/route.js"(exports, module) {
    "use strict";
    var conversions = require_conversions();
    function buildGraph() {
      var graph = {};
      var models = Object.keys(conversions);
      for (var len = models.length, i = 0; i < len; i++) {
        graph[models[i]] = {
          // http://jsperf.com/1-vs-infinity
          // micro-opt, but this is simple.
          distance: -1,
          parent: null
        };
      }
      return graph;
    }
    function deriveBFS(fromModel) {
      var graph = buildGraph();
      var queue = [fromModel];
      graph[fromModel].distance = 0;
      while (queue.length) {
        var current = queue.pop();
        var adjacents = Object.keys(conversions[current]);
        for (var len = adjacents.length, i = 0; i < len; i++) {
          var adjacent = adjacents[i];
          var node = graph[adjacent];
          if (node.distance === -1) {
            node.distance = graph[current].distance + 1;
            node.parent = current;
            queue.unshift(adjacent);
          }
        }
      }
      return graph;
    }
    function link(from, to) {
      return function(args) {
        return to(from(args));
      };
    }
    function wrapConversion(toModel, graph) {
      var path3 = [graph[toModel].parent, toModel];
      var fn = conversions[graph[toModel].parent][toModel];
      var cur = graph[toModel].parent;
      while (graph[cur].parent) {
        path3.unshift(graph[cur].parent);
        fn = link(conversions[graph[cur].parent][cur], fn);
        cur = graph[cur].parent;
      }
      fn.conversion = path3;
      return fn;
    }
    module.exports = function(fromModel) {
      var graph = deriveBFS(fromModel);
      var conversion = {};
      var models = Object.keys(graph);
      for (var len = models.length, i = 0; i < len; i++) {
        var toModel = models[i];
        var node = graph[toModel];
        if (node.parent === null) {
          continue;
        }
        conversion[toModel] = wrapConversion(toModel, graph);
      }
      return conversion;
    };
  }
});

// node_modules/.pnpm/color-convert@1.9.3/node_modules/color-convert/index.js
var require_color_convert = _chunkGQ77QZBOjs.__commonJS.call(void 0, {
  "node_modules/.pnpm/color-convert@1.9.3/node_modules/color-convert/index.js"(exports, module) {
    "use strict";
    var conversions = require_conversions();
    var route = require_route();
    var convert = {};
    var models = Object.keys(conversions);
    function wrapRaw(fn) {
      var wrappedFn = function(args) {
        if (args === void 0 || args === null) {
          return args;
        }
        if (arguments.length > 1) {
          args = Array.prototype.slice.call(arguments);
        }
        return fn(args);
      };
      if ("conversion" in fn) {
        wrappedFn.conversion = fn.conversion;
      }
      return wrappedFn;
    }
    function wrapRounded(fn) {
      var wrappedFn = function(args) {
        if (args === void 0 || args === null) {
          return args;
        }
        if (arguments.length > 1) {
          args = Array.prototype.slice.call(arguments);
        }
        var result = fn(args);
        if (typeof result === "object") {
          for (var len = result.length, i = 0; i < len; i++) {
            result[i] = Math.round(result[i]);
          }
        }
        return result;
      };
      if ("conversion" in fn) {
        wrappedFn.conversion = fn.conversion;
      }
      return wrappedFn;
    }
    models.forEach(function(fromModel) {
      convert[fromModel] = {};
      Object.defineProperty(convert[fromModel], "channels", { value: conversions[fromModel].channels });
      Object.defineProperty(convert[fromModel], "labels", { value: conversions[fromModel].labels });
      var routes = route(fromModel);
      var routeModels = Object.keys(routes);
      routeModels.forEach(function(toModel) {
        var fn = routes[toModel];
        convert[fromModel][toModel] = wrapRounded(fn);
        convert[fromModel][toModel].raw = wrapRaw(fn);
      });
    });
    module.exports = convert;
  }
});

// node_modules/.pnpm/ansi-styles@3.2.1/node_modules/ansi-styles/index.js
var require_ansi_styles = _chunkGQ77QZBOjs.__commonJS.call(void 0, {
  "node_modules/.pnpm/ansi-styles@3.2.1/node_modules/ansi-styles/index.js"(exports, module) {
    "use strict";
    var colorConvert = require_color_convert();
    var wrapAnsi16 = (fn, offset) => function() {
      const code = fn.apply(colorConvert, arguments);
      return `\x1B[${code + offset}m`;
    };
    var wrapAnsi256 = (fn, offset) => function() {
      const code = fn.apply(colorConvert, arguments);
      return `\x1B[${38 + offset};5;${code}m`;
    };
    var wrapAnsi16m = (fn, offset) => function() {
      const rgb = fn.apply(colorConvert, arguments);
      return `\x1B[${38 + offset};2;${rgb[0]};${rgb[1]};${rgb[2]}m`;
    };
    function assembleStyles() {
      const codes = /* @__PURE__ */ new Map();
      const styles = {
        modifier: {
          reset: [0, 0],
          // 21 isn't widely supported and 22 does the same thing
          bold: [1, 22],
          dim: [2, 22],
          italic: [3, 23],
          underline: [4, 24],
          inverse: [7, 27],
          hidden: [8, 28],
          strikethrough: [9, 29]
        },
        color: {
          black: [30, 39],
          red: [31, 39],
          green: [32, 39],
          yellow: [33, 39],
          blue: [34, 39],
          magenta: [35, 39],
          cyan: [36, 39],
          white: [37, 39],
          gray: [90, 39],
          // Bright color
          redBright: [91, 39],
          greenBright: [92, 39],
          yellowBright: [93, 39],
          blueBright: [94, 39],
          magentaBright: [95, 39],
          cyanBright: [96, 39],
          whiteBright: [97, 39]
        },
        bgColor: {
          bgBlack: [40, 49],
          bgRed: [41, 49],
          bgGreen: [42, 49],
          bgYellow: [43, 49],
          bgBlue: [44, 49],
          bgMagenta: [45, 49],
          bgCyan: [46, 49],
          bgWhite: [47, 49],
          // Bright color
          bgBlackBright: [100, 49],
          bgRedBright: [101, 49],
          bgGreenBright: [102, 49],
          bgYellowBright: [103, 49],
          bgBlueBright: [104, 49],
          bgMagentaBright: [105, 49],
          bgCyanBright: [106, 49],
          bgWhiteBright: [107, 49]
        }
      };
      styles.color.grey = styles.color.gray;
      for (const groupName of Object.keys(styles)) {
        const group = styles[groupName];
        for (const styleName of Object.keys(group)) {
          const style = group[styleName];
          styles[styleName] = {
            open: `\x1B[${style[0]}m`,
            close: `\x1B[${style[1]}m`
          };
          group[styleName] = styles[styleName];
          codes.set(style[0], style[1]);
        }
        Object.defineProperty(styles, groupName, {
          value: group,
          enumerable: false
        });
        Object.defineProperty(styles, "codes", {
          value: codes,
          enumerable: false
        });
      }
      const ansi2ansi = (n) => n;
      const rgb2rgb = (r, g, b) => [r, g, b];
      styles.color.close = "\x1B[39m";
      styles.bgColor.close = "\x1B[49m";
      styles.color.ansi = {
        ansi: wrapAnsi16(ansi2ansi, 0)
      };
      styles.color.ansi256 = {
        ansi256: wrapAnsi256(ansi2ansi, 0)
      };
      styles.color.ansi16m = {
        rgb: wrapAnsi16m(rgb2rgb, 0)
      };
      styles.bgColor.ansi = {
        ansi: wrapAnsi16(ansi2ansi, 10)
      };
      styles.bgColor.ansi256 = {
        ansi256: wrapAnsi256(ansi2ansi, 10)
      };
      styles.bgColor.ansi16m = {
        rgb: wrapAnsi16m(rgb2rgb, 10)
      };
      for (let key of Object.keys(colorConvert)) {
        if (typeof colorConvert[key] !== "object") {
          continue;
        }
        const suite = colorConvert[key];
        if (key === "ansi16") {
          key = "ansi";
        }
        if ("ansi16" in suite) {
          styles.color.ansi[key] = wrapAnsi16(suite.ansi16, 0);
          styles.bgColor.ansi[key] = wrapAnsi16(suite.ansi16, 10);
        }
        if ("ansi256" in suite) {
          styles.color.ansi256[key] = wrapAnsi256(suite.ansi256, 0);
          styles.bgColor.ansi256[key] = wrapAnsi256(suite.ansi256, 10);
        }
        if ("rgb" in suite) {
          styles.color.ansi16m[key] = wrapAnsi16m(suite.rgb, 0);
          styles.bgColor.ansi16m[key] = wrapAnsi16m(suite.rgb, 10);
        }
      }
      return styles;
    }
    Object.defineProperty(module, "exports", {
      enumerable: true,
      get: assembleStyles
    });
  }
});

// node_modules/.pnpm/has-flag@3.0.0/node_modules/has-flag/index.js
var require_has_flag = _chunkGQ77QZBOjs.__commonJS.call(void 0, {
  "node_modules/.pnpm/has-flag@3.0.0/node_modules/has-flag/index.js"(exports, module) {
    "use strict";
    module.exports = (flag, argv) => {
      argv = argv || process.argv;
      const prefix = flag.startsWith("-") ? "" : flag.length === 1 ? "-" : "--";
      const pos = argv.indexOf(prefix + flag);
      const terminatorPos = argv.indexOf("--");
      return pos !== -1 && (terminatorPos === -1 ? true : pos < terminatorPos);
    };
  }
});

// node_modules/.pnpm/supports-color@5.5.0/node_modules/supports-color/index.js
var require_supports_color = _chunkGQ77QZBOjs.__commonJS.call(void 0, {
  "node_modules/.pnpm/supports-color@5.5.0/node_modules/supports-color/index.js"(exports, module) {
    "use strict";
    var os = _chunkGQ77QZBOjs.__require.call(void 0, "os");
    var hasFlag = require_has_flag();
    var env = process.env;
    var forceColor;
    if (hasFlag("no-color") || hasFlag("no-colors") || hasFlag("color=false")) {
      forceColor = false;
    } else if (hasFlag("color") || hasFlag("colors") || hasFlag("color=true") || hasFlag("color=always")) {
      forceColor = true;
    }
    if ("FORCE_COLOR" in env) {
      forceColor = env.FORCE_COLOR.length === 0 || parseInt(env.FORCE_COLOR, 10) !== 0;
    }
    function translateLevel(level) {
      if (level === 0) {
        return false;
      }
      return {
        level,
        hasBasic: true,
        has256: level >= 2,
        has16m: level >= 3
      };
    }
    function supportsColor(stream) {
      if (forceColor === false) {
        return 0;
      }
      if (hasFlag("color=16m") || hasFlag("color=full") || hasFlag("color=truecolor")) {
        return 3;
      }
      if (hasFlag("color=256")) {
        return 2;
      }
      if (stream && !stream.isTTY && forceColor !== true) {
        return 0;
      }
      const min = forceColor ? 1 : 0;
      if (process.platform === "win32") {
        const osRelease = os.release().split(".");
        if (Number(process.versions.node.split(".")[0]) >= 8 && Number(osRelease[0]) >= 10 && Number(osRelease[2]) >= 10586) {
          return Number(osRelease[2]) >= 14931 ? 3 : 2;
        }
        return 1;
      }
      if ("CI" in env) {
        if (["TRAVIS", "CIRCLECI", "APPVEYOR", "GITLAB_CI"].some((sign) => sign in env) || env.CI_NAME === "codeship") {
          return 1;
        }
        return min;
      }
      if ("TEAMCITY_VERSION" in env) {
        return /^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/.test(env.TEAMCITY_VERSION) ? 1 : 0;
      }
      if (env.COLORTERM === "truecolor") {
        return 3;
      }
      if ("TERM_PROGRAM" in env) {
        const version = parseInt((env.TERM_PROGRAM_VERSION || "").split(".")[0], 10);
        switch (env.TERM_PROGRAM) {
          case "iTerm.app":
            return version >= 3 ? 3 : 2;
          case "Apple_Terminal":
            return 2;
        }
      }
      if (/-256(color)?$/i.test(env.TERM)) {
        return 2;
      }
      if (/^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(env.TERM)) {
        return 1;
      }
      if ("COLORTERM" in env) {
        return 1;
      }
      if (env.TERM === "dumb") {
        return min;
      }
      return min;
    }
    function getSupportLevel(stream) {
      const level = supportsColor(stream);
      return translateLevel(level);
    }
    module.exports = {
      supportsColor: getSupportLevel,
      stdout: getSupportLevel(process.stdout),
      stderr: getSupportLevel(process.stderr)
    };
  }
});

// node_modules/.pnpm/chalk@2.4.2/node_modules/chalk/templates.js
var require_templates = _chunkGQ77QZBOjs.__commonJS.call(void 0, {
  "node_modules/.pnpm/chalk@2.4.2/node_modules/chalk/templates.js"(exports, module) {
    "use strict";
    var TEMPLATE_REGEX = /(?:\\(u[a-f\d]{4}|x[a-f\d]{2}|.))|(?:\{(~)?(\w+(?:\([^)]*\))?(?:\.\w+(?:\([^)]*\))?)*)(?:[ \t]|(?=\r?\n)))|(\})|((?:.|[\r\n\f])+?)/gi;
    var STYLE_REGEX = /(?:^|\.)(\w+)(?:\(([^)]*)\))?/g;
    var STRING_REGEX = /^(['"])((?:\\.|(?!\1)[^\\])*)\1$/;
    var ESCAPE_REGEX = /\\(u[a-f\d]{4}|x[a-f\d]{2}|.)|([^\\])/gi;
    var ESCAPES = /* @__PURE__ */ new Map([
      ["n", "\n"],
      ["r", "\r"],
      ["t", "	"],
      ["b", "\b"],
      ["f", "\f"],
      ["v", "\v"],
      ["0", "\0"],
      ["\\", "\\"],
      ["e", "\x1B"],
      ["a", "\x07"]
    ]);
    function unescape2(c) {
      if (c[0] === "u" && c.length === 5 || c[0] === "x" && c.length === 3) {
        return String.fromCharCode(parseInt(c.slice(1), 16));
      }
      return ESCAPES.get(c) || c;
    }
    function parseArguments(name, args) {
      const results = [];
      const chunks = args.trim().split(/\s*,\s*/g);
      let matches;
      for (const chunk of chunks) {
        if (!isNaN(chunk)) {
          results.push(Number(chunk));
        } else if (matches = chunk.match(STRING_REGEX)) {
          results.push(matches[2].replace(ESCAPE_REGEX, (m, escape, chr) => escape ? unescape2(escape) : chr));
        } else {
          throw new Error(`Invalid Chalk template style argument: ${chunk} (in style '${name}')`);
        }
      }
      return results;
    }
    function parseStyle(style) {
      STYLE_REGEX.lastIndex = 0;
      const results = [];
      let matches;
      while ((matches = STYLE_REGEX.exec(style)) !== null) {
        const name = matches[1];
        if (matches[2]) {
          const args = parseArguments(name, matches[2]);
          results.push([name].concat(args));
        } else {
          results.push([name]);
        }
      }
      return results;
    }
    function buildStyle(chalk, styles) {
      const enabled = {};
      for (const layer of styles) {
        for (const style of layer.styles) {
          enabled[style[0]] = layer.inverse ? null : style.slice(1);
        }
      }
      let current = chalk;
      for (const styleName of Object.keys(enabled)) {
        if (Array.isArray(enabled[styleName])) {
          if (!(styleName in current)) {
            throw new Error(`Unknown Chalk style: ${styleName}`);
          }
          if (enabled[styleName].length > 0) {
            current = current[styleName].apply(current, enabled[styleName]);
          } else {
            current = current[styleName];
          }
        }
      }
      return current;
    }
    module.exports = (chalk, tmp) => {
      const styles = [];
      const chunks = [];
      let chunk = [];
      tmp.replace(TEMPLATE_REGEX, (m, escapeChar, inverse, style, close, chr) => {
        if (escapeChar) {
          chunk.push(unescape2(escapeChar));
        } else if (style) {
          const str = chunk.join("");
          chunk = [];
          chunks.push(styles.length === 0 ? str : buildStyle(chalk, styles)(str));
          styles.push({ inverse, styles: parseStyle(style) });
        } else if (close) {
          if (styles.length === 0) {
            throw new Error("Found extraneous } in Chalk template literal");
          }
          chunks.push(buildStyle(chalk, styles)(chunk.join("")));
          chunk = [];
          styles.pop();
        } else {
          chunk.push(chr);
        }
      });
      chunks.push(chunk.join(""));
      if (styles.length > 0) {
        const errMsg = `Chalk template literal is missing ${styles.length} closing bracket${styles.length === 1 ? "" : "s"} (\`}\`)`;
        throw new Error(errMsg);
      }
      return chunks.join("");
    };
  }
});

// node_modules/.pnpm/chalk@2.4.2/node_modules/chalk/index.js
var require_chalk = _chunkGQ77QZBOjs.__commonJS.call(void 0, {
  "node_modules/.pnpm/chalk@2.4.2/node_modules/chalk/index.js"(exports, module) {
    "use strict";
    var escapeStringRegexp = require_escape_string_regexp();
    var ansiStyles = require_ansi_styles();
    var stdoutColor = require_supports_color().stdout;
    var template = require_templates();
    var isSimpleWindowsTerm = process.platform === "win32" && !(process.env.TERM || "").toLowerCase().startsWith("xterm");
    var levelMapping = ["ansi", "ansi", "ansi256", "ansi16m"];
    var skipModels = /* @__PURE__ */ new Set(["gray"]);
    var styles = /* @__PURE__ */ Object.create(null);
    function applyOptions(obj, options) {
      options = options || {};
      const scLevel = stdoutColor ? stdoutColor.level : 0;
      obj.level = options.level === void 0 ? scLevel : options.level;
      obj.enabled = "enabled" in options ? options.enabled : obj.level > 0;
    }
    function Chalk(options) {
      if (!this || !(this instanceof Chalk) || this.template) {
        const chalk = {};
        applyOptions(chalk, options);
        chalk.template = function() {
          const args = [].slice.call(arguments);
          return chalkTag.apply(null, [chalk.template].concat(args));
        };
        Object.setPrototypeOf(chalk, Chalk.prototype);
        Object.setPrototypeOf(chalk.template, chalk);
        chalk.template.constructor = Chalk;
        return chalk.template;
      }
      applyOptions(this, options);
    }
    if (isSimpleWindowsTerm) {
      ansiStyles.blue.open = "\x1B[94m";
    }
    for (const key of Object.keys(ansiStyles)) {
      ansiStyles[key].closeRe = new RegExp(escapeStringRegexp(ansiStyles[key].close), "g");
      styles[key] = {
        get() {
          const codes = ansiStyles[key];
          return build.call(this, this._styles ? this._styles.concat(codes) : [codes], this._empty, key);
        }
      };
    }
    styles.visible = {
      get() {
        return build.call(this, this._styles || [], true, "visible");
      }
    };
    ansiStyles.color.closeRe = new RegExp(escapeStringRegexp(ansiStyles.color.close), "g");
    for (const model of Object.keys(ansiStyles.color.ansi)) {
      if (skipModels.has(model)) {
        continue;
      }
      styles[model] = {
        get() {
          const level = this.level;
          return function() {
            const open = ansiStyles.color[levelMapping[level]][model].apply(null, arguments);
            const codes = {
              open,
              close: ansiStyles.color.close,
              closeRe: ansiStyles.color.closeRe
            };
            return build.call(this, this._styles ? this._styles.concat(codes) : [codes], this._empty, model);
          };
        }
      };
    }
    ansiStyles.bgColor.closeRe = new RegExp(escapeStringRegexp(ansiStyles.bgColor.close), "g");
    for (const model of Object.keys(ansiStyles.bgColor.ansi)) {
      if (skipModels.has(model)) {
        continue;
      }
      const bgModel = "bg" + model[0].toUpperCase() + model.slice(1);
      styles[bgModel] = {
        get() {
          const level = this.level;
          return function() {
            const open = ansiStyles.bgColor[levelMapping[level]][model].apply(null, arguments);
            const codes = {
              open,
              close: ansiStyles.bgColor.close,
              closeRe: ansiStyles.bgColor.closeRe
            };
            return build.call(this, this._styles ? this._styles.concat(codes) : [codes], this._empty, model);
          };
        }
      };
    }
    var proto = Object.defineProperties(() => {
    }, styles);
    function build(_styles, _empty, key) {
      const builder = function() {
        return applyStyle.apply(builder, arguments);
      };
      builder._styles = _styles;
      builder._empty = _empty;
      const self2 = this;
      Object.defineProperty(builder, "level", {
        enumerable: true,
        get() {
          return self2.level;
        },
        set(level) {
          self2.level = level;
        }
      });
      Object.defineProperty(builder, "enabled", {
        enumerable: true,
        get() {
          return self2.enabled;
        },
        set(enabled) {
          self2.enabled = enabled;
        }
      });
      builder.hasGrey = this.hasGrey || key === "gray" || key === "grey";
      builder.__proto__ = proto;
      return builder;
    }
    function applyStyle() {
      const args = arguments;
      const argsLen = args.length;
      let str = String(arguments[0]);
      if (argsLen === 0) {
        return "";
      }
      if (argsLen > 1) {
        for (let a = 1; a < argsLen; a++) {
          str += " " + args[a];
        }
      }
      if (!this.enabled || this.level <= 0 || !str) {
        return this._empty ? "" : str;
      }
      const originalDim = ansiStyles.dim.open;
      if (isSimpleWindowsTerm && this.hasGrey) {
        ansiStyles.dim.open = "";
      }
      for (const code of this._styles.slice().reverse()) {
        str = code.open + str.replace(code.closeRe, code.open) + code.close;
        str = str.replace(/\r?\n/g, `${code.close}$&${code.open}`);
      }
      ansiStyles.dim.open = originalDim;
      return str;
    }
    function chalkTag(chalk, strings) {
      if (!Array.isArray(strings)) {
        return [].slice.call(arguments, 1).join(" ");
      }
      const args = [].slice.call(arguments, 2);
      const parts = [strings.raw[0]];
      for (let i = 1; i < strings.length; i++) {
        parts.push(String(args[i - 1]).replace(/[{}\\]/g, "\\$&"));
        parts.push(String(strings.raw[i]));
      }
      return template(chalk, parts.join(""));
    }
    Object.defineProperties(Chalk.prototype, styles);
    module.exports = Chalk();
    module.exports.supportsColor = stdoutColor;
    module.exports.default = module.exports;
  }
});

// node_modules/.pnpm/@babel+highlight@7.22.20/node_modules/@babel/highlight/lib/index.js
var require_lib2 = _chunkGQ77QZBOjs.__commonJS.call(void 0, {
  "node_modules/.pnpm/@babel+highlight@7.22.20/node_modules/@babel/highlight/lib/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = highlight;
    exports.shouldHighlight = shouldHighlight;
    var _jsTokens = require_js_tokens();
    var _helperValidatorIdentifier = require_lib();
    var _chalk = _interopRequireWildcard(require_chalk(), true);
    function _getRequireWildcardCache(nodeInterop) {
      if (typeof WeakMap !== "function")
        return null;
      var cacheBabelInterop = /* @__PURE__ */ new WeakMap();
      var cacheNodeInterop = /* @__PURE__ */ new WeakMap();
      return (_getRequireWildcardCache = function(nodeInterop2) {
        return nodeInterop2 ? cacheNodeInterop : cacheBabelInterop;
      })(nodeInterop);
    }
    function _interopRequireWildcard(obj, nodeInterop) {
      if (!nodeInterop && obj && obj.__esModule) {
        return obj;
      }
      if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
        return { default: obj };
      }
      var cache = _getRequireWildcardCache(nodeInterop);
      if (cache && cache.has(obj)) {
        return cache.get(obj);
      }
      var newObj = {};
      var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
      for (var key in obj) {
        if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
          var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
          if (desc && (desc.get || desc.set)) {
            Object.defineProperty(newObj, key, desc);
          } else {
            newObj[key] = obj[key];
          }
        }
      }
      newObj.default = obj;
      if (cache) {
        cache.set(obj, newObj);
      }
      return newObj;
    }
    var sometimesKeywords = /* @__PURE__ */ new Set(["as", "async", "from", "get", "of", "set"]);
    function getDefs(chalk) {
      return {
        keyword: chalk.cyan,
        capitalized: chalk.yellow,
        jsxIdentifier: chalk.yellow,
        punctuator: chalk.yellow,
        number: chalk.magenta,
        string: chalk.green,
        regex: chalk.magenta,
        comment: chalk.grey,
        invalid: chalk.white.bgRed.bold
      };
    }
    var NEWLINE = /\r\n|[\n\r\u2028\u2029]/;
    var BRACKET = /^[()[\]{}]$/;
    var tokenize;
    {
      const JSX_TAG = /^[a-z][\w-]*$/i;
      const getTokenType = function(token, offset, text) {
        if (token.type === "name") {
          if ((0, _helperValidatorIdentifier.isKeyword)(token.value) || (0, _helperValidatorIdentifier.isStrictReservedWord)(token.value, true) || sometimesKeywords.has(token.value)) {
            return "keyword";
          }
          if (JSX_TAG.test(token.value) && (text[offset - 1] === "<" || text.slice(offset - 2, offset) == "</")) {
            return "jsxIdentifier";
          }
          if (token.value[0] !== token.value[0].toLowerCase()) {
            return "capitalized";
          }
        }
        if (token.type === "punctuator" && BRACKET.test(token.value)) {
          return "bracket";
        }
        if (token.type === "invalid" && (token.value === "@" || token.value === "#")) {
          return "punctuator";
        }
        return token.type;
      };
      tokenize = function* (text) {
        let match;
        while (match = _jsTokens.default.exec(text)) {
          const token = _jsTokens.matchToToken(match);
          yield {
            type: getTokenType(token, match.index, text),
            value: token.value
          };
        }
      };
    }
    function highlightTokens(defs, text) {
      let highlighted = "";
      for (const {
        type,
        value
      } of tokenize(text)) {
        const colorize = defs[type];
        if (colorize) {
          highlighted += value.split(NEWLINE).map((str) => colorize(str)).join("\n");
        } else {
          highlighted += value;
        }
      }
      return highlighted;
    }
    function shouldHighlight(options) {
      return _chalk.default.level > 0 || options.forceColor;
    }
    var chalkWithForcedColor = void 0;
    function getChalk(forceColor) {
      if (forceColor) {
        var _chalkWithForcedColor;
        (_chalkWithForcedColor = chalkWithForcedColor) != null ? _chalkWithForcedColor : chalkWithForcedColor = new _chalk.default.constructor({
          enabled: true,
          level: 1
        });
        return chalkWithForcedColor;
      }
      return _chalk.default;
    }
    {
      exports.getChalk = (options) => getChalk(options.forceColor);
    }
    function highlight(code, options = {}) {
      if (code !== "" && shouldHighlight(options)) {
        const defs = getDefs(getChalk(options.forceColor));
        return highlightTokens(defs, code);
      } else {
        return code;
      }
    }
  }
});

// node_modules/.pnpm/@babel+code-frame@7.22.13/node_modules/@babel/code-frame/lib/index.js
var require_lib3 = _chunkGQ77QZBOjs.__commonJS.call(void 0, {
  "node_modules/.pnpm/@babel+code-frame@7.22.13/node_modules/@babel/code-frame/lib/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.codeFrameColumns = codeFrameColumns;
    exports.default = _default;
    var _highlight = require_lib2();
    var _chalk = _interopRequireWildcard(require_chalk(), true);
    function _getRequireWildcardCache(nodeInterop) {
      if (typeof WeakMap !== "function")
        return null;
      var cacheBabelInterop = /* @__PURE__ */ new WeakMap();
      var cacheNodeInterop = /* @__PURE__ */ new WeakMap();
      return (_getRequireWildcardCache = function(nodeInterop2) {
        return nodeInterop2 ? cacheNodeInterop : cacheBabelInterop;
      })(nodeInterop);
    }
    function _interopRequireWildcard(obj, nodeInterop) {
      if (!nodeInterop && obj && obj.__esModule) {
        return obj;
      }
      if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
        return { default: obj };
      }
      var cache = _getRequireWildcardCache(nodeInterop);
      if (cache && cache.has(obj)) {
        return cache.get(obj);
      }
      var newObj = {};
      var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
      for (var key in obj) {
        if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
          var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
          if (desc && (desc.get || desc.set)) {
            Object.defineProperty(newObj, key, desc);
          } else {
            newObj[key] = obj[key];
          }
        }
      }
      newObj.default = obj;
      if (cache) {
        cache.set(obj, newObj);
      }
      return newObj;
    }
    var chalkWithForcedColor = void 0;
    function getChalk(forceColor) {
      if (forceColor) {
        var _chalkWithForcedColor;
        (_chalkWithForcedColor = chalkWithForcedColor) != null ? _chalkWithForcedColor : chalkWithForcedColor = new _chalk.default.constructor({
          enabled: true,
          level: 1
        });
        return chalkWithForcedColor;
      }
      return _chalk.default;
    }
    var deprecationWarningShown = false;
    function getDefs(chalk) {
      return {
        gutter: chalk.grey,
        marker: chalk.red.bold,
        message: chalk.red.bold
      };
    }
    var NEWLINE = /\r\n|[\n\r\u2028\u2029]/;
    function getMarkerLines(loc, source, opts) {
      const startLoc = Object.assign({
        column: 0,
        line: -1
      }, loc.start);
      const endLoc = Object.assign({}, startLoc, loc.end);
      const {
        linesAbove = 2,
        linesBelow = 3
      } = opts || {};
      const startLine = startLoc.line;
      const startColumn = startLoc.column;
      const endLine = endLoc.line;
      const endColumn = endLoc.column;
      let start = Math.max(startLine - (linesAbove + 1), 0);
      let end = Math.min(source.length, endLine + linesBelow);
      if (startLine === -1) {
        start = 0;
      }
      if (endLine === -1) {
        end = source.length;
      }
      const lineDiff = endLine - startLine;
      const markerLines = {};
      if (lineDiff) {
        for (let i = 0; i <= lineDiff; i++) {
          const lineNumber = i + startLine;
          if (!startColumn) {
            markerLines[lineNumber] = true;
          } else if (i === 0) {
            const sourceLength = source[lineNumber - 1].length;
            markerLines[lineNumber] = [startColumn, sourceLength - startColumn + 1];
          } else if (i === lineDiff) {
            markerLines[lineNumber] = [0, endColumn];
          } else {
            const sourceLength = source[lineNumber - i].length;
            markerLines[lineNumber] = [0, sourceLength];
          }
        }
      } else {
        if (startColumn === endColumn) {
          if (startColumn) {
            markerLines[startLine] = [startColumn, 0];
          } else {
            markerLines[startLine] = true;
          }
        } else {
          markerLines[startLine] = [startColumn, endColumn - startColumn];
        }
      }
      return {
        start,
        end,
        markerLines
      };
    }
    function codeFrameColumns(rawLines, loc, opts = {}) {
      const highlighted = (opts.highlightCode || opts.forceColor) && (0, _highlight.shouldHighlight)(opts);
      const chalk = getChalk(opts.forceColor);
      const defs = getDefs(chalk);
      const maybeHighlight = (chalkFn, string) => {
        return highlighted ? chalkFn(string) : string;
      };
      const lines = rawLines.split(NEWLINE);
      const {
        start,
        end,
        markerLines
      } = getMarkerLines(loc, lines, opts);
      const hasColumns = loc.start && typeof loc.start.column === "number";
      const numberMaxWidth = String(end).length;
      const highlightedLines = highlighted ? (0, _highlight.default)(rawLines, opts) : rawLines;
      let frame = highlightedLines.split(NEWLINE, end).slice(start, end).map((line, index) => {
        const number = start + 1 + index;
        const paddedNumber = ` ${number}`.slice(-numberMaxWidth);
        const gutter = ` ${paddedNumber} |`;
        const hasMarker = markerLines[number];
        const lastMarkerLine = !markerLines[number + 1];
        if (hasMarker) {
          let markerLine = "";
          if (Array.isArray(hasMarker)) {
            const markerSpacing = line.slice(0, Math.max(hasMarker[0] - 1, 0)).replace(/[^\t]/g, " ");
            const numberOfMarkers = hasMarker[1] || 1;
            markerLine = ["\n ", maybeHighlight(defs.gutter, gutter.replace(/\d/g, " ")), " ", markerSpacing, maybeHighlight(defs.marker, "^").repeat(numberOfMarkers)].join("");
            if (lastMarkerLine && opts.message) {
              markerLine += " " + maybeHighlight(defs.message, opts.message);
            }
          }
          return [maybeHighlight(defs.marker, ">"), maybeHighlight(defs.gutter, gutter), line.length > 0 ? ` ${line}` : "", markerLine].join("");
        } else {
          return ` ${maybeHighlight(defs.gutter, gutter)}${line.length > 0 ? ` ${line}` : ""}`;
        }
      }).join("\n");
      if (opts.message && !hasColumns) {
        frame = `${" ".repeat(numberMaxWidth + 1)}${opts.message}
${frame}`;
      }
      if (highlighted) {
        return chalk.reset(frame);
      } else {
        return frame;
      }
    }
    function _default(rawLines, lineNumber, colNumber, opts = {}) {
      if (!deprecationWarningShown) {
        deprecationWarningShown = true;
        const message = "Passing lineNumber and colNumber is deprecated to @babel/code-frame. Please use `codeFrameColumns`.";
        if (process.emitWarning) {
          process.emitWarning(message, "DeprecationWarning");
        } else {
          const deprecationError = new Error(message);
          deprecationError.name = "DeprecationWarning";
          console.warn(new Error(message));
        }
      }
      colNumber = Math.max(colNumber, 0);
      const location = {
        start: {
          column: colNumber,
          line: lineNumber
        }
      };
      return codeFrameColumns(rawLines, location, opts);
    }
  }
});

// node_modules/.pnpm/@jridgewell+sourcemap-codec@1.4.15/node_modules/@jridgewell/sourcemap-codec/dist/sourcemap-codec.umd.js
var require_sourcemap_codec_umd = _chunkGQ77QZBOjs.__commonJS.call(void 0, {
  "node_modules/.pnpm/@jridgewell+sourcemap-codec@1.4.15/node_modules/@jridgewell/sourcemap-codec/dist/sourcemap-codec.umd.js"(exports, module) {
    "use strict";
    (function(global, factory) {
      typeof exports === "object" && typeof module !== "undefined" ? factory(exports) : typeof define === "function" && define.amd ? define(["exports"], factory) : (global = typeof globalThis !== "undefined" ? globalThis : global || self, factory(global.sourcemapCodec = {}));
    })(exports, function(exports2) {
      "use strict";
      const comma = ",".charCodeAt(0);
      const semicolon = ";".charCodeAt(0);
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
      const intToChar = new Uint8Array(64);
      const charToInt = new Uint8Array(128);
      for (let i = 0; i < chars.length; i++) {
        const c = chars.charCodeAt(i);
        intToChar[i] = c;
        charToInt[c] = i;
      }
      const td = typeof TextDecoder !== "undefined" ? /* @__PURE__ */ new TextDecoder() : typeof Buffer !== "undefined" ? {
        decode(buf) {
          const out = Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength);
          return out.toString();
        }
      } : {
        decode(buf) {
          let out = "";
          for (let i = 0; i < buf.length; i++) {
            out += String.fromCharCode(buf[i]);
          }
          return out;
        }
      };
      function decode(mappings) {
        const state = new Int32Array(5);
        const decoded = [];
        let index = 0;
        do {
          const semi = indexOf(mappings, index);
          const line = [];
          let sorted = true;
          let lastCol = 0;
          state[0] = 0;
          for (let i = index; i < semi; i++) {
            let seg;
            i = decodeInteger(mappings, i, state, 0);
            const col = state[0];
            if (col < lastCol)
              sorted = false;
            lastCol = col;
            if (hasMoreVlq(mappings, i, semi)) {
              i = decodeInteger(mappings, i, state, 1);
              i = decodeInteger(mappings, i, state, 2);
              i = decodeInteger(mappings, i, state, 3);
              if (hasMoreVlq(mappings, i, semi)) {
                i = decodeInteger(mappings, i, state, 4);
                seg = [col, state[1], state[2], state[3], state[4]];
              } else {
                seg = [col, state[1], state[2], state[3]];
              }
            } else {
              seg = [col];
            }
            line.push(seg);
          }
          if (!sorted)
            sort(line);
          decoded.push(line);
          index = semi + 1;
        } while (index <= mappings.length);
        return decoded;
      }
      function indexOf(mappings, index) {
        const idx = mappings.indexOf(";", index);
        return idx === -1 ? mappings.length : idx;
      }
      function decodeInteger(mappings, pos, state, j) {
        let value = 0;
        let shift = 0;
        let integer = 0;
        do {
          const c = mappings.charCodeAt(pos++);
          integer = charToInt[c];
          value |= (integer & 31) << shift;
          shift += 5;
        } while (integer & 32);
        const shouldNegate = value & 1;
        value >>>= 1;
        if (shouldNegate) {
          value = -2147483648 | -value;
        }
        state[j] += value;
        return pos;
      }
      function hasMoreVlq(mappings, i, length) {
        if (i >= length)
          return false;
        return mappings.charCodeAt(i) !== comma;
      }
      function sort(line) {
        line.sort(sortComparator);
      }
      function sortComparator(a, b) {
        return a[0] - b[0];
      }
      function encode(decoded) {
        const state = new Int32Array(5);
        const bufLength = 1024 * 16;
        const subLength = bufLength - 36;
        const buf = new Uint8Array(bufLength);
        const sub = buf.subarray(0, subLength);
        let pos = 0;
        let out = "";
        for (let i = 0; i < decoded.length; i++) {
          const line = decoded[i];
          if (i > 0) {
            if (pos === bufLength) {
              out += td.decode(buf);
              pos = 0;
            }
            buf[pos++] = semicolon;
          }
          if (line.length === 0)
            continue;
          state[0] = 0;
          for (let j = 0; j < line.length; j++) {
            const segment = line[j];
            if (pos > subLength) {
              out += td.decode(sub);
              buf.copyWithin(0, subLength, pos);
              pos -= subLength;
            }
            if (j > 0)
              buf[pos++] = comma;
            pos = encodeInteger(buf, pos, state, segment, 0);
            if (segment.length === 1)
              continue;
            pos = encodeInteger(buf, pos, state, segment, 1);
            pos = encodeInteger(buf, pos, state, segment, 2);
            pos = encodeInteger(buf, pos, state, segment, 3);
            if (segment.length === 4)
              continue;
            pos = encodeInteger(buf, pos, state, segment, 4);
          }
        }
        return out + td.decode(buf.subarray(0, pos));
      }
      function encodeInteger(buf, pos, state, segment, j) {
        const next = segment[j];
        let num = next - state[j];
        state[j] = next;
        num = num < 0 ? -num << 1 | 1 : num << 1;
        do {
          let clamped = num & 31;
          num >>>= 5;
          if (num > 0)
            clamped |= 32;
          buf[pos++] = intToChar[clamped];
        } while (num > 0);
        return pos;
      }
      exports2.decode = decode;
      exports2.encode = encode;
      Object.defineProperty(exports2, "__esModule", { value: true });
    });
  }
});

// node_modules/.pnpm/magic-string@0.30.4/node_modules/magic-string/dist/magic-string.cjs.js
var require_magic_string_cjs = _chunkGQ77QZBOjs.__commonJS.call(void 0, {
  "node_modules/.pnpm/magic-string@0.30.4/node_modules/magic-string/dist/magic-string.cjs.js"(exports, module) {
    "use strict";
    var sourcemapCodec = require_sourcemap_codec_umd();
    var BitSet = class {
      constructor(arg) {
        this.bits = arg instanceof BitSet ? arg.bits.slice() : [];
      }
      add(n2) {
        this.bits[n2 >> 5] |= 1 << (n2 & 31);
      }
      has(n2) {
        return !!(this.bits[n2 >> 5] & 1 << (n2 & 31));
      }
    };
    var Chunk = class {
      constructor(start, end, content) {
        this.start = start;
        this.end = end;
        this.original = content;
        this.intro = "";
        this.outro = "";
        this.content = content;
        this.storeName = false;
        this.edited = false;
        {
          this.previous = null;
          this.next = null;
        }
      }
      appendLeft(content) {
        this.outro += content;
      }
      appendRight(content) {
        this.intro = this.intro + content;
      }
      clone() {
        const chunk = new Chunk(this.start, this.end, this.original);
        chunk.intro = this.intro;
        chunk.outro = this.outro;
        chunk.content = this.content;
        chunk.storeName = this.storeName;
        chunk.edited = this.edited;
        return chunk;
      }
      contains(index) {
        return this.start < index && index < this.end;
      }
      eachNext(fn) {
        let chunk = this;
        while (chunk) {
          fn(chunk);
          chunk = chunk.next;
        }
      }
      eachPrevious(fn) {
        let chunk = this;
        while (chunk) {
          fn(chunk);
          chunk = chunk.previous;
        }
      }
      edit(content, storeName, contentOnly) {
        this.content = content;
        if (!contentOnly) {
          this.intro = "";
          this.outro = "";
        }
        this.storeName = storeName;
        this.edited = true;
        return this;
      }
      prependLeft(content) {
        this.outro = content + this.outro;
      }
      prependRight(content) {
        this.intro = content + this.intro;
      }
      split(index) {
        const sliceIndex = index - this.start;
        const originalBefore = this.original.slice(0, sliceIndex);
        const originalAfter = this.original.slice(sliceIndex);
        this.original = originalBefore;
        const newChunk = new Chunk(index, this.end, originalAfter);
        newChunk.outro = this.outro;
        this.outro = "";
        this.end = index;
        if (this.edited) {
          newChunk.edit("", false);
          this.content = "";
        } else {
          this.content = originalBefore;
        }
        newChunk.next = this.next;
        if (newChunk.next)
          newChunk.next.previous = newChunk;
        newChunk.previous = this;
        this.next = newChunk;
        return newChunk;
      }
      toString() {
        return this.intro + this.content + this.outro;
      }
      trimEnd(rx) {
        this.outro = this.outro.replace(rx, "");
        if (this.outro.length)
          return true;
        const trimmed = this.content.replace(rx, "");
        if (trimmed.length) {
          if (trimmed !== this.content) {
            this.split(this.start + trimmed.length).edit("", void 0, true);
            if (this.edited) {
              this.edit(trimmed, this.storeName, true);
            }
          }
          return true;
        } else {
          this.edit("", void 0, true);
          this.intro = this.intro.replace(rx, "");
          if (this.intro.length)
            return true;
        }
      }
      trimStart(rx) {
        this.intro = this.intro.replace(rx, "");
        if (this.intro.length)
          return true;
        const trimmed = this.content.replace(rx, "");
        if (trimmed.length) {
          if (trimmed !== this.content) {
            const newChunk = this.split(this.end - trimmed.length);
            if (this.edited) {
              newChunk.edit(trimmed, this.storeName, true);
            }
            this.edit("", void 0, true);
          }
          return true;
        } else {
          this.edit("", void 0, true);
          this.outro = this.outro.replace(rx, "");
          if (this.outro.length)
            return true;
        }
      }
    };
    function getBtoa() {
      if (typeof window !== "undefined" && typeof window.btoa === "function") {
        return (str) => window.btoa(unescape(encodeURIComponent(str)));
      } else if (typeof Buffer === "function") {
        return (str) => Buffer.from(str, "utf-8").toString("base64");
      } else {
        return () => {
          throw new Error("Unsupported environment: `window.btoa` or `Buffer` should be supported.");
        };
      }
    }
    var btoa = /* @__PURE__ */ getBtoa();
    var SourceMap = class {
      constructor(properties) {
        this.version = 3;
        this.file = properties.file;
        this.sources = properties.sources;
        this.sourcesContent = properties.sourcesContent;
        this.names = properties.names;
        this.mappings = sourcemapCodec.encode(properties.mappings);
        if (typeof properties.x_google_ignoreList !== "undefined") {
          this.x_google_ignoreList = properties.x_google_ignoreList;
        }
      }
      toString() {
        return JSON.stringify(this);
      }
      toUrl() {
        return "data:application/json;charset=utf-8;base64," + btoa(this.toString());
      }
    };
    function guessIndent(code) {
      const lines = code.split("\n");
      const tabbed = lines.filter((line) => /^\t+/.test(line));
      const spaced = lines.filter((line) => /^ {2,}/.test(line));
      if (tabbed.length === 0 && spaced.length === 0) {
        return null;
      }
      if (tabbed.length >= spaced.length) {
        return "	";
      }
      const min = spaced.reduce((previous, current) => {
        const numSpaces = /^ +/.exec(current)[0].length;
        return Math.min(numSpaces, previous);
      }, Infinity);
      return new Array(min + 1).join(" ");
    }
    function getRelativePath(from, to) {
      const fromParts = from.split(/[/\\]/);
      const toParts = to.split(/[/\\]/);
      fromParts.pop();
      while (fromParts[0] === toParts[0]) {
        fromParts.shift();
        toParts.shift();
      }
      if (fromParts.length) {
        let i = fromParts.length;
        while (i--)
          fromParts[i] = "..";
      }
      return fromParts.concat(toParts).join("/");
    }
    var toString = Object.prototype.toString;
    function isObject(thing) {
      return toString.call(thing) === "[object Object]";
    }
    function getLocator(source) {
      const originalLines = source.split("\n");
      const lineOffsets = [];
      for (let i = 0, pos = 0; i < originalLines.length; i++) {
        lineOffsets.push(pos);
        pos += originalLines[i].length + 1;
      }
      return function locate(index) {
        let i = 0;
        let j = lineOffsets.length;
        while (i < j) {
          const m = i + j >> 1;
          if (index < lineOffsets[m]) {
            j = m;
          } else {
            i = m + 1;
          }
        }
        const line = i - 1;
        const column = index - lineOffsets[line];
        return { line, column };
      };
    }
    var wordRegex = /\w/;
    var Mappings = class {
      constructor(hires) {
        this.hires = hires;
        this.generatedCodeLine = 0;
        this.generatedCodeColumn = 0;
        this.raw = [];
        this.rawSegments = this.raw[this.generatedCodeLine] = [];
        this.pending = null;
      }
      addEdit(sourceIndex, content, loc, nameIndex) {
        if (content.length) {
          let contentLineEnd = content.indexOf("\n", 0);
          let previousContentLineEnd = -1;
          while (contentLineEnd >= 0) {
            const segment2 = [this.generatedCodeColumn, sourceIndex, loc.line, loc.column];
            if (nameIndex >= 0) {
              segment2.push(nameIndex);
            }
            this.rawSegments.push(segment2);
            this.generatedCodeLine += 1;
            this.raw[this.generatedCodeLine] = this.rawSegments = [];
            this.generatedCodeColumn = 0;
            previousContentLineEnd = contentLineEnd;
            contentLineEnd = content.indexOf("\n", contentLineEnd + 1);
          }
          const segment = [this.generatedCodeColumn, sourceIndex, loc.line, loc.column];
          if (nameIndex >= 0) {
            segment.push(nameIndex);
          }
          this.rawSegments.push(segment);
          this.advance(content.slice(previousContentLineEnd + 1));
        } else if (this.pending) {
          this.rawSegments.push(this.pending);
          this.advance(content);
        }
        this.pending = null;
      }
      addUneditedChunk(sourceIndex, chunk, original, loc, sourcemapLocations) {
        let originalCharIndex = chunk.start;
        let first = true;
        let charInHiresBoundary = false;
        while (originalCharIndex < chunk.end) {
          if (this.hires || first || sourcemapLocations.has(originalCharIndex)) {
            const segment = [this.generatedCodeColumn, sourceIndex, loc.line, loc.column];
            if (this.hires === "boundary") {
              if (wordRegex.test(original[originalCharIndex])) {
                if (!charInHiresBoundary) {
                  this.rawSegments.push(segment);
                  charInHiresBoundary = true;
                }
              } else {
                this.rawSegments.push(segment);
                charInHiresBoundary = false;
              }
            } else {
              this.rawSegments.push(segment);
            }
          }
          if (original[originalCharIndex] === "\n") {
            loc.line += 1;
            loc.column = 0;
            this.generatedCodeLine += 1;
            this.raw[this.generatedCodeLine] = this.rawSegments = [];
            this.generatedCodeColumn = 0;
            first = true;
          } else {
            loc.column += 1;
            this.generatedCodeColumn += 1;
            first = false;
          }
          originalCharIndex += 1;
        }
        this.pending = null;
      }
      advance(str) {
        if (!str)
          return;
        const lines = str.split("\n");
        if (lines.length > 1) {
          for (let i = 0; i < lines.length - 1; i++) {
            this.generatedCodeLine++;
            this.raw[this.generatedCodeLine] = this.rawSegments = [];
          }
          this.generatedCodeColumn = 0;
        }
        this.generatedCodeColumn += lines[lines.length - 1].length;
      }
    };
    var n = "\n";
    var warned = {
      insertLeft: false,
      insertRight: false,
      storeName: false
    };
    var MagicString = class {
      constructor(string, options = {}) {
        const chunk = new Chunk(0, string.length, string);
        Object.defineProperties(this, {
          original: { writable: true, value: string },
          outro: { writable: true, value: "" },
          intro: { writable: true, value: "" },
          firstChunk: { writable: true, value: chunk },
          lastChunk: { writable: true, value: chunk },
          lastSearchedChunk: { writable: true, value: chunk },
          byStart: { writable: true, value: {} },
          byEnd: { writable: true, value: {} },
          filename: { writable: true, value: options.filename },
          indentExclusionRanges: { writable: true, value: options.indentExclusionRanges },
          sourcemapLocations: { writable: true, value: new BitSet() },
          storedNames: { writable: true, value: {} },
          indentStr: { writable: true, value: void 0 },
          ignoreList: { writable: true, value: options.ignoreList }
        });
        this.byStart[0] = chunk;
        this.byEnd[string.length] = chunk;
      }
      addSourcemapLocation(char) {
        this.sourcemapLocations.add(char);
      }
      append(content) {
        if (typeof content !== "string")
          throw new TypeError("outro content must be a string");
        this.outro += content;
        return this;
      }
      appendLeft(index, content) {
        if (typeof content !== "string")
          throw new TypeError("inserted content must be a string");
        this._split(index);
        const chunk = this.byEnd[index];
        if (chunk) {
          chunk.appendLeft(content);
        } else {
          this.intro += content;
        }
        return this;
      }
      appendRight(index, content) {
        if (typeof content !== "string")
          throw new TypeError("inserted content must be a string");
        this._split(index);
        const chunk = this.byStart[index];
        if (chunk) {
          chunk.appendRight(content);
        } else {
          this.outro += content;
        }
        return this;
      }
      clone() {
        const cloned = new MagicString(this.original, { filename: this.filename });
        let originalChunk = this.firstChunk;
        let clonedChunk = cloned.firstChunk = cloned.lastSearchedChunk = originalChunk.clone();
        while (originalChunk) {
          cloned.byStart[clonedChunk.start] = clonedChunk;
          cloned.byEnd[clonedChunk.end] = clonedChunk;
          const nextOriginalChunk = originalChunk.next;
          const nextClonedChunk = nextOriginalChunk && nextOriginalChunk.clone();
          if (nextClonedChunk) {
            clonedChunk.next = nextClonedChunk;
            nextClonedChunk.previous = clonedChunk;
            clonedChunk = nextClonedChunk;
          }
          originalChunk = nextOriginalChunk;
        }
        cloned.lastChunk = clonedChunk;
        if (this.indentExclusionRanges) {
          cloned.indentExclusionRanges = this.indentExclusionRanges.slice();
        }
        cloned.sourcemapLocations = new BitSet(this.sourcemapLocations);
        cloned.intro = this.intro;
        cloned.outro = this.outro;
        return cloned;
      }
      generateDecodedMap(options) {
        options = options || {};
        const sourceIndex = 0;
        const names = Object.keys(this.storedNames);
        const mappings = new Mappings(options.hires);
        const locate = getLocator(this.original);
        if (this.intro) {
          mappings.advance(this.intro);
        }
        this.firstChunk.eachNext((chunk) => {
          const loc = locate(chunk.start);
          if (chunk.intro.length)
            mappings.advance(chunk.intro);
          if (chunk.edited) {
            mappings.addEdit(
              sourceIndex,
              chunk.content,
              loc,
              chunk.storeName ? names.indexOf(chunk.original) : -1
            );
          } else {
            mappings.addUneditedChunk(sourceIndex, chunk, this.original, loc, this.sourcemapLocations);
          }
          if (chunk.outro.length)
            mappings.advance(chunk.outro);
        });
        return {
          file: options.file ? options.file.split(/[/\\]/).pop() : void 0,
          sources: [
            options.source ? getRelativePath(options.file || "", options.source) : options.file || ""
          ],
          sourcesContent: options.includeContent ? [this.original] : void 0,
          names,
          mappings: mappings.raw,
          x_google_ignoreList: this.ignoreList ? [sourceIndex] : void 0
        };
      }
      generateMap(options) {
        return new SourceMap(this.generateDecodedMap(options));
      }
      _ensureindentStr() {
        if (this.indentStr === void 0) {
          this.indentStr = guessIndent(this.original);
        }
      }
      _getRawIndentString() {
        this._ensureindentStr();
        return this.indentStr;
      }
      getIndentString() {
        this._ensureindentStr();
        return this.indentStr === null ? "	" : this.indentStr;
      }
      indent(indentStr, options) {
        const pattern = /^[^\r\n]/gm;
        if (isObject(indentStr)) {
          options = indentStr;
          indentStr = void 0;
        }
        if (indentStr === void 0) {
          this._ensureindentStr();
          indentStr = this.indentStr || "	";
        }
        if (indentStr === "")
          return this;
        options = options || {};
        const isExcluded = {};
        if (options.exclude) {
          const exclusions = typeof options.exclude[0] === "number" ? [options.exclude] : options.exclude;
          exclusions.forEach((exclusion) => {
            for (let i = exclusion[0]; i < exclusion[1]; i += 1) {
              isExcluded[i] = true;
            }
          });
        }
        let shouldIndentNextCharacter = options.indentStart !== false;
        const replacer = (match) => {
          if (shouldIndentNextCharacter)
            return `${indentStr}${match}`;
          shouldIndentNextCharacter = true;
          return match;
        };
        this.intro = this.intro.replace(pattern, replacer);
        let charIndex = 0;
        let chunk = this.firstChunk;
        while (chunk) {
          const end = chunk.end;
          if (chunk.edited) {
            if (!isExcluded[charIndex]) {
              chunk.content = chunk.content.replace(pattern, replacer);
              if (chunk.content.length) {
                shouldIndentNextCharacter = chunk.content[chunk.content.length - 1] === "\n";
              }
            }
          } else {
            charIndex = chunk.start;
            while (charIndex < end) {
              if (!isExcluded[charIndex]) {
                const char = this.original[charIndex];
                if (char === "\n") {
                  shouldIndentNextCharacter = true;
                } else if (char !== "\r" && shouldIndentNextCharacter) {
                  shouldIndentNextCharacter = false;
                  if (charIndex === chunk.start) {
                    chunk.prependRight(indentStr);
                  } else {
                    this._splitChunk(chunk, charIndex);
                    chunk = chunk.next;
                    chunk.prependRight(indentStr);
                  }
                }
              }
              charIndex += 1;
            }
          }
          charIndex = chunk.end;
          chunk = chunk.next;
        }
        this.outro = this.outro.replace(pattern, replacer);
        return this;
      }
      insert() {
        throw new Error(
          "magicString.insert(...) is deprecated. Use prependRight(...) or appendLeft(...)"
        );
      }
      insertLeft(index, content) {
        if (!warned.insertLeft) {
          console.warn(
            "magicString.insertLeft(...) is deprecated. Use magicString.appendLeft(...) instead"
          );
          warned.insertLeft = true;
        }
        return this.appendLeft(index, content);
      }
      insertRight(index, content) {
        if (!warned.insertRight) {
          console.warn(
            "magicString.insertRight(...) is deprecated. Use magicString.prependRight(...) instead"
          );
          warned.insertRight = true;
        }
        return this.prependRight(index, content);
      }
      move(start, end, index) {
        if (index >= start && index <= end)
          throw new Error("Cannot move a selection inside itself");
        this._split(start);
        this._split(end);
        this._split(index);
        const first = this.byStart[start];
        const last = this.byEnd[end];
        const oldLeft = first.previous;
        const oldRight = last.next;
        const newRight = this.byStart[index];
        if (!newRight && last === this.lastChunk)
          return this;
        const newLeft = newRight ? newRight.previous : this.lastChunk;
        if (oldLeft)
          oldLeft.next = oldRight;
        if (oldRight)
          oldRight.previous = oldLeft;
        if (newLeft)
          newLeft.next = first;
        if (newRight)
          newRight.previous = last;
        if (!first.previous)
          this.firstChunk = last.next;
        if (!last.next) {
          this.lastChunk = first.previous;
          this.lastChunk.next = null;
        }
        first.previous = newLeft;
        last.next = newRight || null;
        if (!newLeft)
          this.firstChunk = first;
        if (!newRight)
          this.lastChunk = last;
        return this;
      }
      overwrite(start, end, content, options) {
        options = options || {};
        return this.update(start, end, content, { ...options, overwrite: !options.contentOnly });
      }
      update(start, end, content, options) {
        if (typeof content !== "string")
          throw new TypeError("replacement content must be a string");
        while (start < 0)
          start += this.original.length;
        while (end < 0)
          end += this.original.length;
        if (end > this.original.length)
          throw new Error("end is out of bounds");
        if (start === end)
          throw new Error(
            "Cannot overwrite a zero-length range \u2013 use appendLeft or prependRight instead"
          );
        this._split(start);
        this._split(end);
        if (options === true) {
          if (!warned.storeName) {
            console.warn(
              "The final argument to magicString.overwrite(...) should be an options object. See https://github.com/rich-harris/magic-string"
            );
            warned.storeName = true;
          }
          options = { storeName: true };
        }
        const storeName = options !== void 0 ? options.storeName : false;
        const overwrite = options !== void 0 ? options.overwrite : false;
        if (storeName) {
          const original = this.original.slice(start, end);
          Object.defineProperty(this.storedNames, original, {
            writable: true,
            value: true,
            enumerable: true
          });
        }
        const first = this.byStart[start];
        const last = this.byEnd[end];
        if (first) {
          let chunk = first;
          while (chunk !== last) {
            if (chunk.next !== this.byStart[chunk.end]) {
              throw new Error("Cannot overwrite across a split point");
            }
            chunk = chunk.next;
            chunk.edit("", false);
          }
          first.edit(content, storeName, !overwrite);
        } else {
          const newChunk = new Chunk(start, end, "").edit(content, storeName);
          last.next = newChunk;
          newChunk.previous = last;
        }
        return this;
      }
      prepend(content) {
        if (typeof content !== "string")
          throw new TypeError("outro content must be a string");
        this.intro = content + this.intro;
        return this;
      }
      prependLeft(index, content) {
        if (typeof content !== "string")
          throw new TypeError("inserted content must be a string");
        this._split(index);
        const chunk = this.byEnd[index];
        if (chunk) {
          chunk.prependLeft(content);
        } else {
          this.intro = content + this.intro;
        }
        return this;
      }
      prependRight(index, content) {
        if (typeof content !== "string")
          throw new TypeError("inserted content must be a string");
        this._split(index);
        const chunk = this.byStart[index];
        if (chunk) {
          chunk.prependRight(content);
        } else {
          this.outro = content + this.outro;
        }
        return this;
      }
      remove(start, end) {
        while (start < 0)
          start += this.original.length;
        while (end < 0)
          end += this.original.length;
        if (start === end)
          return this;
        if (start < 0 || end > this.original.length)
          throw new Error("Character is out of bounds");
        if (start > end)
          throw new Error("end must be greater than start");
        this._split(start);
        this._split(end);
        let chunk = this.byStart[start];
        while (chunk) {
          chunk.intro = "";
          chunk.outro = "";
          chunk.edit("");
          chunk = end > chunk.end ? this.byStart[chunk.end] : null;
        }
        return this;
      }
      lastChar() {
        if (this.outro.length)
          return this.outro[this.outro.length - 1];
        let chunk = this.lastChunk;
        do {
          if (chunk.outro.length)
            return chunk.outro[chunk.outro.length - 1];
          if (chunk.content.length)
            return chunk.content[chunk.content.length - 1];
          if (chunk.intro.length)
            return chunk.intro[chunk.intro.length - 1];
        } while (chunk = chunk.previous);
        if (this.intro.length)
          return this.intro[this.intro.length - 1];
        return "";
      }
      lastLine() {
        let lineIndex = this.outro.lastIndexOf(n);
        if (lineIndex !== -1)
          return this.outro.substr(lineIndex + 1);
        let lineStr = this.outro;
        let chunk = this.lastChunk;
        do {
          if (chunk.outro.length > 0) {
            lineIndex = chunk.outro.lastIndexOf(n);
            if (lineIndex !== -1)
              return chunk.outro.substr(lineIndex + 1) + lineStr;
            lineStr = chunk.outro + lineStr;
          }
          if (chunk.content.length > 0) {
            lineIndex = chunk.content.lastIndexOf(n);
            if (lineIndex !== -1)
              return chunk.content.substr(lineIndex + 1) + lineStr;
            lineStr = chunk.content + lineStr;
          }
          if (chunk.intro.length > 0) {
            lineIndex = chunk.intro.lastIndexOf(n);
            if (lineIndex !== -1)
              return chunk.intro.substr(lineIndex + 1) + lineStr;
            lineStr = chunk.intro + lineStr;
          }
        } while (chunk = chunk.previous);
        lineIndex = this.intro.lastIndexOf(n);
        if (lineIndex !== -1)
          return this.intro.substr(lineIndex + 1) + lineStr;
        return this.intro + lineStr;
      }
      slice(start = 0, end = this.original.length) {
        while (start < 0)
          start += this.original.length;
        while (end < 0)
          end += this.original.length;
        let result = "";
        let chunk = this.firstChunk;
        while (chunk && (chunk.start > start || chunk.end <= start)) {
          if (chunk.start < end && chunk.end >= end) {
            return result;
          }
          chunk = chunk.next;
        }
        if (chunk && chunk.edited && chunk.start !== start)
          throw new Error(`Cannot use replaced character ${start} as slice start anchor.`);
        const startChunk = chunk;
        while (chunk) {
          if (chunk.intro && (startChunk !== chunk || chunk.start === start)) {
            result += chunk.intro;
          }
          const containsEnd = chunk.start < end && chunk.end >= end;
          if (containsEnd && chunk.edited && chunk.end !== end)
            throw new Error(`Cannot use replaced character ${end} as slice end anchor.`);
          const sliceStart = startChunk === chunk ? start - chunk.start : 0;
          const sliceEnd = containsEnd ? chunk.content.length + end - chunk.end : chunk.content.length;
          result += chunk.content.slice(sliceStart, sliceEnd);
          if (chunk.outro && (!containsEnd || chunk.end === end)) {
            result += chunk.outro;
          }
          if (containsEnd) {
            break;
          }
          chunk = chunk.next;
        }
        return result;
      }
      // TODO deprecate this? not really very useful
      snip(start, end) {
        const clone = this.clone();
        clone.remove(0, start);
        clone.remove(end, clone.original.length);
        return clone;
      }
      _split(index) {
        if (this.byStart[index] || this.byEnd[index])
          return;
        let chunk = this.lastSearchedChunk;
        const searchForward = index > chunk.end;
        while (chunk) {
          if (chunk.contains(index))
            return this._splitChunk(chunk, index);
          chunk = searchForward ? this.byStart[chunk.end] : this.byEnd[chunk.start];
        }
      }
      _splitChunk(chunk, index) {
        if (chunk.edited && chunk.content.length) {
          const loc = getLocator(this.original)(index);
          throw new Error(
            `Cannot split a chunk that has already been edited (${loc.line}:${loc.column} \u2013 "${chunk.original}")`
          );
        }
        const newChunk = chunk.split(index);
        this.byEnd[index] = chunk;
        this.byStart[index] = newChunk;
        this.byEnd[newChunk.end] = newChunk;
        if (chunk === this.lastChunk)
          this.lastChunk = newChunk;
        this.lastSearchedChunk = chunk;
        return true;
      }
      toString() {
        let str = this.intro;
        let chunk = this.firstChunk;
        while (chunk) {
          str += chunk.toString();
          chunk = chunk.next;
        }
        return str + this.outro;
      }
      isEmpty() {
        let chunk = this.firstChunk;
        do {
          if (chunk.intro.length && chunk.intro.trim() || chunk.content.length && chunk.content.trim() || chunk.outro.length && chunk.outro.trim())
            return false;
        } while (chunk = chunk.next);
        return true;
      }
      length() {
        let chunk = this.firstChunk;
        let length = 0;
        do {
          length += chunk.intro.length + chunk.content.length + chunk.outro.length;
        } while (chunk = chunk.next);
        return length;
      }
      trimLines() {
        return this.trim("[\\r\\n]");
      }
      trim(charType) {
        return this.trimStart(charType).trimEnd(charType);
      }
      trimEndAborted(charType) {
        const rx = new RegExp((charType || "\\s") + "+$");
        this.outro = this.outro.replace(rx, "");
        if (this.outro.length)
          return true;
        let chunk = this.lastChunk;
        do {
          const end = chunk.end;
          const aborted = chunk.trimEnd(rx);
          if (chunk.end !== end) {
            if (this.lastChunk === chunk) {
              this.lastChunk = chunk.next;
            }
            this.byEnd[chunk.end] = chunk;
            this.byStart[chunk.next.start] = chunk.next;
            this.byEnd[chunk.next.end] = chunk.next;
          }
          if (aborted)
            return true;
          chunk = chunk.previous;
        } while (chunk);
        return false;
      }
      trimEnd(charType) {
        this.trimEndAborted(charType);
        return this;
      }
      trimStartAborted(charType) {
        const rx = new RegExp("^" + (charType || "\\s") + "+");
        this.intro = this.intro.replace(rx, "");
        if (this.intro.length)
          return true;
        let chunk = this.firstChunk;
        do {
          const end = chunk.end;
          const aborted = chunk.trimStart(rx);
          if (chunk.end !== end) {
            if (chunk === this.lastChunk)
              this.lastChunk = chunk.next;
            this.byEnd[chunk.end] = chunk;
            this.byStart[chunk.next.start] = chunk.next;
            this.byEnd[chunk.next.end] = chunk.next;
          }
          if (aborted)
            return true;
          chunk = chunk.next;
        } while (chunk);
        return false;
      }
      trimStart(charType) {
        this.trimStartAborted(charType);
        return this;
      }
      hasChanged() {
        return this.original !== this.toString();
      }
      _replaceRegexp(searchValue, replacement) {
        function getReplacement(match, str) {
          if (typeof replacement === "string") {
            return replacement.replace(/\$(\$|&|\d+)/g, (_, i) => {
              if (i === "$")
                return "$";
              if (i === "&")
                return match[0];
              const num = +i;
              if (num < match.length)
                return match[+i];
              return `$${i}`;
            });
          } else {
            return replacement(...match, match.index, str, match.groups);
          }
        }
        function matchAll(re, str) {
          let match;
          const matches = [];
          while (match = re.exec(str)) {
            matches.push(match);
          }
          return matches;
        }
        if (searchValue.global) {
          const matches = matchAll(searchValue, this.original);
          matches.forEach((match) => {
            if (match.index != null)
              this.overwrite(
                match.index,
                match.index + match[0].length,
                getReplacement(match, this.original)
              );
          });
        } else {
          const match = this.original.match(searchValue);
          if (match && match.index != null)
            this.overwrite(
              match.index,
              match.index + match[0].length,
              getReplacement(match, this.original)
            );
        }
        return this;
      }
      _replaceString(string, replacement) {
        const { original } = this;
        const index = original.indexOf(string);
        if (index !== -1) {
          this.overwrite(index, index + string.length, replacement);
        }
        return this;
      }
      replace(searchValue, replacement) {
        if (typeof searchValue === "string") {
          return this._replaceString(searchValue, replacement);
        }
        return this._replaceRegexp(searchValue, replacement);
      }
      _replaceAllString(string, replacement) {
        const { original } = this;
        const stringLength = string.length;
        for (let index = original.indexOf(string); index !== -1; index = original.indexOf(string, index + stringLength)) {
          this.overwrite(index, index + stringLength, replacement);
        }
        return this;
      }
      replaceAll(searchValue, replacement) {
        if (typeof searchValue === "string") {
          return this._replaceAllString(searchValue, replacement);
        }
        if (!searchValue.global) {
          throw new TypeError(
            "MagicString.prototype.replaceAll called with a non-global RegExp argument"
          );
        }
        return this._replaceRegexp(searchValue, replacement);
      }
    };
    var hasOwnProp = Object.prototype.hasOwnProperty;
    var Bundle = class {
      constructor(options = {}) {
        this.intro = options.intro || "";
        this.separator = options.separator !== void 0 ? options.separator : "\n";
        this.sources = [];
        this.uniqueSources = [];
        this.uniqueSourceIndexByFilename = {};
      }
      addSource(source) {
        if (source instanceof MagicString) {
          return this.addSource({
            content: source,
            filename: source.filename,
            separator: this.separator
          });
        }
        if (!isObject(source) || !source.content) {
          throw new Error(
            "bundle.addSource() takes an object with a `content` property, which should be an instance of MagicString, and an optional `filename`"
          );
        }
        ["filename", "ignoreList", "indentExclusionRanges", "separator"].forEach((option) => {
          if (!hasOwnProp.call(source, option))
            source[option] = source.content[option];
        });
        if (source.separator === void 0) {
          source.separator = this.separator;
        }
        if (source.filename) {
          if (!hasOwnProp.call(this.uniqueSourceIndexByFilename, source.filename)) {
            this.uniqueSourceIndexByFilename[source.filename] = this.uniqueSources.length;
            this.uniqueSources.push({ filename: source.filename, content: source.content.original });
          } else {
            const uniqueSource = this.uniqueSources[this.uniqueSourceIndexByFilename[source.filename]];
            if (source.content.original !== uniqueSource.content) {
              throw new Error(`Illegal source: same filename (${source.filename}), different contents`);
            }
          }
        }
        this.sources.push(source);
        return this;
      }
      append(str, options) {
        this.addSource({
          content: new MagicString(str),
          separator: options && options.separator || ""
        });
        return this;
      }
      clone() {
        const bundle = new Bundle({
          intro: this.intro,
          separator: this.separator
        });
        this.sources.forEach((source) => {
          bundle.addSource({
            filename: source.filename,
            content: source.content.clone(),
            separator: source.separator
          });
        });
        return bundle;
      }
      generateDecodedMap(options = {}) {
        const names = [];
        let x_google_ignoreList = void 0;
        this.sources.forEach((source) => {
          Object.keys(source.content.storedNames).forEach((name) => {
            if (!~names.indexOf(name))
              names.push(name);
          });
        });
        const mappings = new Mappings(options.hires);
        if (this.intro) {
          mappings.advance(this.intro);
        }
        this.sources.forEach((source, i) => {
          if (i > 0) {
            mappings.advance(this.separator);
          }
          const sourceIndex = source.filename ? this.uniqueSourceIndexByFilename[source.filename] : -1;
          const magicString = source.content;
          const locate = getLocator(magicString.original);
          if (magicString.intro) {
            mappings.advance(magicString.intro);
          }
          magicString.firstChunk.eachNext((chunk) => {
            const loc = locate(chunk.start);
            if (chunk.intro.length)
              mappings.advance(chunk.intro);
            if (source.filename) {
              if (chunk.edited) {
                mappings.addEdit(
                  sourceIndex,
                  chunk.content,
                  loc,
                  chunk.storeName ? names.indexOf(chunk.original) : -1
                );
              } else {
                mappings.addUneditedChunk(
                  sourceIndex,
                  chunk,
                  magicString.original,
                  loc,
                  magicString.sourcemapLocations
                );
              }
            } else {
              mappings.advance(chunk.content);
            }
            if (chunk.outro.length)
              mappings.advance(chunk.outro);
          });
          if (magicString.outro) {
            mappings.advance(magicString.outro);
          }
          if (source.ignoreList && sourceIndex !== -1) {
            if (x_google_ignoreList === void 0) {
              x_google_ignoreList = [];
            }
            x_google_ignoreList.push(sourceIndex);
          }
        });
        return {
          file: options.file ? options.file.split(/[/\\]/).pop() : void 0,
          sources: this.uniqueSources.map((source) => {
            return options.file ? getRelativePath(options.file, source.filename) : source.filename;
          }),
          sourcesContent: this.uniqueSources.map((source) => {
            return options.includeContent ? source.content : null;
          }),
          names,
          mappings: mappings.raw,
          x_google_ignoreList
        };
      }
      generateMap(options) {
        return new SourceMap(this.generateDecodedMap(options));
      }
      getIndentString() {
        const indentStringCounts = {};
        this.sources.forEach((source) => {
          const indentStr = source.content._getRawIndentString();
          if (indentStr === null)
            return;
          if (!indentStringCounts[indentStr])
            indentStringCounts[indentStr] = 0;
          indentStringCounts[indentStr] += 1;
        });
        return Object.keys(indentStringCounts).sort((a, b) => {
          return indentStringCounts[a] - indentStringCounts[b];
        })[0] || "	";
      }
      indent(indentStr) {
        if (!arguments.length) {
          indentStr = this.getIndentString();
        }
        if (indentStr === "")
          return this;
        let trailingNewline = !this.intro || this.intro.slice(-1) === "\n";
        this.sources.forEach((source, i) => {
          const separator = source.separator !== void 0 ? source.separator : this.separator;
          const indentStart = trailingNewline || i > 0 && /\r?\n$/.test(separator);
          source.content.indent(indentStr, {
            exclude: source.indentExclusionRanges,
            indentStart
            //: trailingNewline || /\r?\n$/.test( separator )  //true///\r?\n/.test( separator )
          });
          trailingNewline = source.content.lastChar() === "\n";
        });
        if (this.intro) {
          this.intro = indentStr + this.intro.replace(/^[^\n]/gm, (match, index) => {
            return index > 0 ? indentStr + match : match;
          });
        }
        return this;
      }
      prepend(str) {
        this.intro = str + this.intro;
        return this;
      }
      toString() {
        const body = this.sources.map((source, i) => {
          const separator = source.separator !== void 0 ? source.separator : this.separator;
          const str = (i > 0 ? separator : "") + source.content.toString();
          return str;
        }).join("");
        return this.intro + body;
      }
      isEmpty() {
        if (this.intro.length && this.intro.trim())
          return false;
        if (this.sources.some((source) => !source.content.isEmpty()))
          return false;
        return true;
      }
      length() {
        return this.sources.reduce(
          (length, source) => length + source.content.length(),
          this.intro.length
        );
      }
      trimLines() {
        return this.trim("[\\r\\n]");
      }
      trim(charType) {
        return this.trimStart(charType).trimEnd(charType);
      }
      trimStart(charType) {
        const rx = new RegExp("^" + (charType || "\\s") + "+");
        this.intro = this.intro.replace(rx, "");
        if (!this.intro) {
          let source;
          let i = 0;
          do {
            source = this.sources[i++];
            if (!source) {
              break;
            }
          } while (!source.content.trimStartAborted(charType));
        }
        return this;
      }
      trimEnd(charType) {
        const rx = new RegExp((charType || "\\s") + "+$");
        let source;
        let i = this.sources.length - 1;
        do {
          source = this.sources[i--];
          if (!source) {
            this.intro = this.intro.replace(rx, "");
            break;
          }
        } while (!source.content.trimEndAborted(charType));
        return this;
      }
    };
    MagicString.Bundle = Bundle;
    MagicString.SourceMap = SourceMap;
    MagicString.default = MagicString;
    module.exports = MagicString;
  }
});

// node_modules/.pnpm/rollup-plugin-dts@6.1.0_rollup@4.0.2_typescript@5.0.2/node_modules/rollup-plugin-dts/dist/rollup-plugin-dts.cjs
var require_rollup_plugin_dts = _chunkGQ77QZBOjs.__commonJS.call(void 0, {
  "node_modules/.pnpm/rollup-plugin-dts@6.1.0_rollup@4.0.2_typescript@5.0.2/node_modules/rollup-plugin-dts/dist/rollup-plugin-dts.cjs"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var path3 = _chunkGQ77QZBOjs.__require.call(void 0, "path");
    var ts2 = _chunkGQ77QZBOjs.__require.call(void 0, "typescript");
    require_lib3();
    var module$1 = _chunkGQ77QZBOjs.__require.call(void 0, "module");
    var MagicString = require_magic_string_cjs();
    var _documentCurrentScript = typeof document !== "undefined" ? document.currentScript : null;
    function _interopNamespaceDefault(e) {
      var n = /* @__PURE__ */ Object.create(null);
      if (e) {
        Object.keys(e).forEach(function(k) {
          if (k !== "default") {
            var d = Object.getOwnPropertyDescriptor(e, k);
            Object.defineProperty(n, k, d.get ? d : {
              enumerable: true,
              get: function() {
                return e[k];
              }
            });
          }
        });
      }
      n.default = e;
      return Object.freeze(n);
    }
    var path__namespace = /* @__PURE__ */ _interopNamespaceDefault(path3);
    function resolveDefaultOptions(options) {
      return {
        ...options,
        compilerOptions: _nullishCoalesce(options.compilerOptions, () => ( {})),
        respectExternal: _nullishCoalesce(options.respectExternal, () => ( false))
      };
    }
    var DTS_EXTENSIONS = /\.d\.(c|m)?tsx?$/;
    var dts = ".d.ts";
    var formatHost = {
      getCurrentDirectory: () => ts2.sys.getCurrentDirectory(),
      getNewLine: () => ts2.sys.newLine,
      getCanonicalFileName: ts2.sys.useCaseSensitiveFileNames ? (f) => f : (f) => f.toLowerCase()
    };
    var DEFAULT_OPTIONS = {
      // Ensure ".d.ts" modules are generated
      declaration: true,
      // Skip ".js" generation
      noEmit: false,
      emitDeclarationOnly: true,
      // Skip code generation when error occurs
      noEmitOnError: true,
      // Avoid extra work
      checkJs: false,
      declarationMap: false,
      skipLibCheck: true,
      // Ensure TS2742 errors are visible
      preserveSymlinks: true,
      // Ensure we can parse the latest code
      target: ts2.ScriptTarget.ESNext
    };
    var configByPath = /* @__PURE__ */ new Map();
    var logCache = (...args) => process.env.DTS_LOG_CACHE ? console.log("[cache]", ...args) : null;
    function cacheConfig([fromPath, toPath], config) {
      logCache(fromPath);
      configByPath.set(fromPath, config);
      while (fromPath !== toPath && // make sure we're not stuck in an infinite loop
      fromPath !== path__namespace.dirname(fromPath)) {
        fromPath = path__namespace.dirname(fromPath);
        logCache("up", fromPath);
        if (configByPath.has(fromPath))
          return logCache("has", fromPath);
        configByPath.set(fromPath, config);
      }
    }
    function getCompilerOptions(input, overrideOptions, overrideConfigPath) {
      const compilerOptions = { ...DEFAULT_OPTIONS, ...overrideOptions };
      let dirName = path__namespace.dirname(input);
      let dtsFiles = [];
      const cacheKey = overrideConfigPath || dirName;
      if (!configByPath.has(cacheKey)) {
        logCache("miss", cacheKey);
        const configPath = overrideConfigPath ? path__namespace.resolve(process.cwd(), overrideConfigPath) : ts2.findConfigFile(dirName, ts2.sys.fileExists);
        if (!configPath) {
          return { dtsFiles, dirName, compilerOptions };
        }
        let inputDirName = dirName;
        dirName = path__namespace.dirname(configPath);
        const { config, error } = ts2.readConfigFile(configPath, ts2.sys.readFile);
        if (error) {
          console.error(ts2.formatDiagnostic(error, formatHost));
          return { dtsFiles, dirName, compilerOptions };
        }
        logCache("tsconfig", config);
        const configContents = ts2.parseJsonConfigFileContent(config, ts2.sys, dirName);
        if (overrideConfigPath) {
          cacheConfig([overrideConfigPath, overrideConfigPath], configContents);
        } else {
          cacheConfig([inputDirName, dirName], configContents);
        }
      } else {
        logCache("HIT", cacheKey);
      }
      const { fileNames, options, errors } = configByPath.get(cacheKey);
      dtsFiles = fileNames.filter((name) => DTS_EXTENSIONS.test(name));
      if (errors.length) {
        console.error(ts2.formatDiagnostics(errors, formatHost));
        return { dtsFiles, dirName, compilerOptions };
      }
      return {
        dtsFiles,
        dirName,
        compilerOptions: {
          ...options,
          ...compilerOptions
        }
      };
    }
    function createProgram$1(fileName, overrideOptions, tsconfig) {
      const { dtsFiles, compilerOptions } = getCompilerOptions(fileName, overrideOptions, tsconfig);
      return ts2.createProgram([fileName].concat(Array.from(dtsFiles)), compilerOptions, ts2.createCompilerHost(compilerOptions, true));
    }
    function createPrograms(input, overrideOptions, tsconfig) {
      const programs = [];
      let inputs = [];
      let dtsFiles = /* @__PURE__ */ new Set();
      let dirName = "";
      let compilerOptions = {};
      for (let main of input) {
        if (DTS_EXTENSIONS.test(main)) {
          continue;
        }
        main = path__namespace.resolve(main);
        const options = getCompilerOptions(main, overrideOptions, tsconfig);
        options.dtsFiles.forEach(dtsFiles.add, dtsFiles);
        if (!inputs.length) {
          inputs.push(main);
          ({ dirName, compilerOptions } = options);
          continue;
        }
        if (options.dirName === dirName) {
          inputs.push(main);
        } else {
          const host = ts2.createCompilerHost(compilerOptions, true);
          const program = ts2.createProgram(inputs.concat(Array.from(dtsFiles)), compilerOptions, host);
          programs.push(program);
          inputs = [main];
          ({ dirName, compilerOptions } = options);
        }
      }
      if (inputs.length) {
        const host = ts2.createCompilerHost(compilerOptions, true);
        const program = ts2.createProgram(inputs.concat(Array.from(dtsFiles)), compilerOptions, host);
        programs.push(program);
      }
      return programs;
    }
    function getCodeFrame() {
      let codeFrameColumns = void 0;
      try {
        ({ codeFrameColumns } = require_lib3());
        return codeFrameColumns;
      } catch (e2) {
        try {
          const esmRequire = module$1.createRequire(typeof document === "undefined" ? _chunkGQ77QZBOjs.__require.call(void 0, "url").pathToFileURL(__filename).href : _documentCurrentScript && _documentCurrentScript.src || new URL("rollup-plugin-dts.cjs", document.baseURI).href);
          ({ codeFrameColumns } = esmRequire("@babel/code-frame"));
          return codeFrameColumns;
        } catch (e3) {
        }
      }
      return void 0;
    }
    function getLocation(node) {
      const sourceFile = node.getSourceFile();
      const start = sourceFile.getLineAndCharacterOfPosition(node.getStart());
      const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
      return {
        start: { line: start.line + 1, column: start.character + 1 },
        end: { line: end.line + 1, column: end.character + 1 }
      };
    }
    function frameNode(node) {
      const codeFrame = getCodeFrame();
      const sourceFile = node.getSourceFile();
      const code = sourceFile.getFullText();
      const location = getLocation(node);
      if (codeFrame) {
        return "\n" + codeFrame(code, location, {
          highlightCode: true
        });
      } else {
        return `
${location.start.line}:${location.start.column}: \`${node.getFullText().trim()}\``;
      }
    }
    var UnsupportedSyntaxError = class extends Error {
      constructor(node, message = "Syntax not yet supported") {
        super(`${message}
${frameNode(node)}`);
      }
    };
    var NamespaceFixer = class {
      constructor(sourceFile) {
        this.sourceFile = sourceFile;
      }
      findNamespaces() {
        const namespaces = [];
        const items = {};
        for (const node of this.sourceFile.statements) {
          const location = {
            start: node.getStart(),
            end: node.getEnd()
          };
          if (ts2.isEmptyStatement(node)) {
            namespaces.unshift({
              name: "",
              exports: [],
              location
            });
            continue;
          }
          if ((ts2.isImportDeclaration(node) || ts2.isExportDeclaration(node)) && node.moduleSpecifier && ts2.isStringLiteral(node.moduleSpecifier)) {
            let { text } = node.moduleSpecifier;
            if (text.startsWith(".") && (text.endsWith(".d.ts") || text.endsWith(".d.cts") || text.endsWith(".d.mts"))) {
              let start = node.moduleSpecifier.getStart() + 1;
              let end = node.moduleSpecifier.getEnd() - 1;
              namespaces.unshift({
                name: "",
                exports: [],
                location: {
                  start,
                  end
                },
                textBeforeCodeAfter: text.replace(/\.d\.ts$/, ".js").replace(/\.d\.cts$/, ".cjs").replace(/\.d\.mts$/, ".mjs")
              });
            }
          }
          if (ts2.isModuleDeclaration(node) && node.body && ts2.isModuleBlock(node.body)) {
            for (const stmt of node.body.statements) {
              if (ts2.isExportDeclaration(stmt) && stmt.exportClause) {
                if (ts2.isNamespaceExport(stmt.exportClause)) {
                  continue;
                }
                for (const decl2 of stmt.exportClause.elements) {
                  if (decl2.propertyName && decl2.propertyName.getText() == decl2.name.getText()) {
                    namespaces.unshift({
                      name: "",
                      exports: [],
                      location: {
                        start: decl2.propertyName.getEnd(),
                        end: decl2.name.getEnd()
                      }
                    });
                  }
                }
              }
            }
          }
          if (ts2.isClassDeclaration(node)) {
            items[node.name.getText()] = { type: "class", generics: node.typeParameters };
          } else if (ts2.isFunctionDeclaration(node)) {
            items[node.name.getText()] = { type: "function" };
          } else if (ts2.isInterfaceDeclaration(node)) {
            items[node.name.getText()] = { type: "interface", generics: node.typeParameters };
          } else if (ts2.isTypeAliasDeclaration(node)) {
            items[node.name.getText()] = { type: "type", generics: node.typeParameters };
          } else if (ts2.isModuleDeclaration(node) && ts2.isIdentifier(node.name)) {
            items[node.name.getText()] = { type: "namespace" };
          } else if (ts2.isEnumDeclaration(node)) {
            items[node.name.getText()] = { type: "enum" };
          }
          if (!ts2.isVariableStatement(node)) {
            continue;
          }
          const { declarations } = node.declarationList;
          if (declarations.length !== 1) {
            continue;
          }
          const decl = declarations[0];
          const name = decl.name.getText();
          if (!decl.initializer || !ts2.isCallExpression(decl.initializer)) {
            items[name] = { type: "var" };
            continue;
          }
          const obj = decl.initializer.arguments[0];
          if (!decl.initializer.expression.getFullText().includes("/*#__PURE__*/Object.freeze") || !ts2.isObjectLiteralExpression(obj)) {
            continue;
          }
          const exports2 = [];
          for (const prop of obj.properties) {
            if (!ts2.isPropertyAssignment(prop) || !(ts2.isIdentifier(prop.name) || ts2.isStringLiteral(prop.name)) || prop.name.text !== "__proto__" && !ts2.isIdentifier(prop.initializer)) {
              throw new UnsupportedSyntaxError(prop, "Expected a property assignment");
            }
            if (prop.name.text === "__proto__") {
              continue;
            }
            exports2.push({
              exportedName: prop.name.text,
              localName: prop.initializer.getText()
            });
          }
          namespaces.unshift({
            name,
            exports: exports2,
            location
          });
        }
        return { namespaces, itemTypes: items };
      }
      fix() {
        let code = this.sourceFile.getFullText();
        const { namespaces, itemTypes } = this.findNamespaces();
        for (const ns of namespaces) {
          const codeAfter = code.slice(ns.location.end);
          code = code.slice(0, ns.location.start);
          for (const { exportedName, localName } of ns.exports) {
            if (exportedName === localName) {
              const { type, generics } = itemTypes[localName] || {};
              if (type === "interface" || type === "type") {
                const typeParams = renderTypeParams(generics);
                code += `type ${ns.name}_${exportedName}${typeParams.in} = ${localName}${typeParams.out};
`;
              } else if (type === "enum" || type === "class") {
                const typeParams = renderTypeParams(generics);
                code += `type ${ns.name}_${exportedName}${typeParams.in} = ${localName}${typeParams.out};
`;
                code += `declare const ${ns.name}_${exportedName}: typeof ${localName};
`;
              } else {
                code += `declare const ${ns.name}_${exportedName}: typeof ${localName};
`;
              }
            }
          }
          if (ns.name) {
            code += `declare namespace ${ns.name} {
`;
            code += `  export {
`;
            for (const { exportedName, localName } of ns.exports) {
              if (exportedName === localName) {
                code += `    ${ns.name}_${exportedName} as ${exportedName},
`;
              } else {
                code += `    ${localName} as ${exportedName},
`;
              }
            }
            code += `  };
`;
            code += `}`;
          }
          code += _nullishCoalesce(ns.textBeforeCodeAfter, () => ( ""));
          code += codeAfter;
        }
        return code;
      }
    };
    function renderTypeParams(typeParameters) {
      if (!typeParameters || !typeParameters.length) {
        return { in: "", out: "" };
      }
      return {
        in: `<${typeParameters.map((param) => param.getText()).join(", ")}>`,
        out: `<${typeParameters.map((param) => param.name.getText()).join(", ")}>`
      };
    }
    var IDs = 1;
    function createProgram(node) {
      return withStartEnd({
        type: "Program",
        sourceType: "module",
        body: []
      }, { start: node.getFullStart(), end: node.getEnd() });
    }
    function createReference(id) {
      const ident = {
        type: "Identifier",
        name: String(IDs++)
      };
      return {
        ident,
        expr: {
          type: "AssignmentPattern",
          left: ident,
          right: id
        }
      };
    }
    function createIdentifier(node) {
      return withStartEnd({
        type: "Identifier",
        name: node.getText()
      }, node);
    }
    function createIIFE(range) {
      const fn = withStartEnd({
        type: "FunctionExpression",
        id: null,
        params: [],
        body: { type: "BlockStatement", body: [] }
      }, range);
      const iife = withStartEnd({
        type: "ExpressionStatement",
        expression: {
          type: "CallExpression",
          callee: { type: "Identifier", name: String(IDs++) },
          arguments: [fn],
          optional: false
        }
      }, range);
      return { fn, iife };
    }
    function createReturn() {
      const expr = {
        type: "ArrayExpression",
        elements: []
      };
      return {
        expr,
        stmt: {
          type: "ReturnStatement",
          argument: expr
        }
      };
    }
    function createDeclaration(id, range) {
      return withStartEnd({
        type: "FunctionDeclaration",
        id: withStartEnd({
          type: "Identifier",
          name: ts2.idText(id)
        }, id),
        params: [],
        body: { type: "BlockStatement", body: [] }
      }, range);
    }
    function convertExpression(node) {
      if (ts2.isLiteralExpression(node)) {
        return { type: "Literal", value: node.text };
      }
      if (ts2.isPropertyAccessExpression(node)) {
        if (ts2.isPrivateIdentifier(node.name)) {
          throw new UnsupportedSyntaxError(node.name);
        }
        return withStartEnd({
          type: "MemberExpression",
          computed: false,
          optional: false,
          object: convertExpression(node.expression),
          property: convertExpression(node.name)
        }, {
          start: node.expression.getStart(),
          end: node.name.getEnd()
        });
      }
      if (ts2.isIdentifier(node)) {
        return createIdentifier(node);
      } else if (node.kind == ts2.SyntaxKind.NullKeyword) {
        return { type: "Literal", value: null };
      } else {
        throw new UnsupportedSyntaxError(node);
      }
    }
    function withStartEnd(esNode, nodeOrRange) {
      let range = "start" in nodeOrRange ? nodeOrRange : { start: nodeOrRange.getStart(), end: nodeOrRange.getEnd() };
      return Object.assign(esNode, range);
    }
    function matchesModifier(node, flags) {
      const nodeFlags = ts2.getCombinedModifierFlags(node);
      return (nodeFlags & flags) === flags;
    }
    function preProcess({ sourceFile }) {
      const code = new MagicString(sourceFile.getFullText());
      const declaredNames = /* @__PURE__ */ new Set();
      const exportedNames = /* @__PURE__ */ new Set();
      let defaultExport = "";
      const inlineImports = /* @__PURE__ */ new Map();
      const nameRanges = /* @__PURE__ */ new Map();
      for (const node of sourceFile.statements) {
        if (ts2.isEmptyStatement(node)) {
          code.remove(node.getStart(), node.getEnd());
          continue;
        }
        if (ts2.isEnumDeclaration(node) || ts2.isFunctionDeclaration(node) || ts2.isInterfaceDeclaration(node) || ts2.isClassDeclaration(node) || ts2.isTypeAliasDeclaration(node) || ts2.isModuleDeclaration(node)) {
          if (node.name) {
            const name = node.name.getText();
            declaredNames.add(name);
            if (matchesModifier(node, ts2.ModifierFlags.ExportDefault)) {
              defaultExport = name;
            } else if (matchesModifier(node, ts2.ModifierFlags.Export)) {
              exportedNames.add(name);
            }
            if (!(node.flags & ts2.NodeFlags.GlobalAugmentation)) {
              pushNamedNode(name, [getStart(node), getEnd(node)]);
            }
          }
          if (ts2.isModuleDeclaration(node)) {
            duplicateExports(code, node);
          }
          fixModifiers(code, node);
        } else if (ts2.isVariableStatement(node)) {
          const { declarations } = node.declarationList;
          const isExport = matchesModifier(node, ts2.ModifierFlags.Export);
          for (const decl of node.declarationList.declarations) {
            if (ts2.isIdentifier(decl.name)) {
              const name = decl.name.getText();
              declaredNames.add(name);
              if (isExport) {
                exportedNames.add(name);
              }
            }
          }
          fixModifiers(code, node);
          if (declarations.length == 1) {
            const decl = declarations[0];
            if (ts2.isIdentifier(decl.name)) {
              pushNamedNode(decl.name.getText(), [getStart(node), getEnd(node)]);
            }
          } else {
            const decls = declarations.slice();
            const first = decls.shift();
            pushNamedNode(first.name.getText(), [getStart(node), first.getEnd()]);
            for (const decl of decls) {
              if (ts2.isIdentifier(decl.name)) {
                pushNamedNode(decl.name.getText(), [decl.getFullStart(), decl.getEnd()]);
              }
            }
          }
          const { flags } = node.declarationList;
          const type = flags & ts2.NodeFlags.Let ? "let" : flags & ts2.NodeFlags.Const ? "const" : "var";
          const prefix = `declare ${type} `;
          const list = node.declarationList.getChildren().find((c) => c.kind === ts2.SyntaxKind.SyntaxList).getChildren();
          let commaPos = 0;
          for (const node2 of list) {
            if (node2.kind === ts2.SyntaxKind.CommaToken) {
              commaPos = node2.getStart();
              code.remove(commaPos, node2.getEnd());
            } else if (commaPos) {
              code.appendLeft(commaPos, ";\n");
              const start = node2.getFullStart();
              const slice = code.slice(start, node2.getStart());
              let whitespace = slice.length - slice.trimStart().length;
              if (whitespace) {
                code.overwrite(start, start + whitespace, prefix);
              } else {
                code.appendLeft(start, prefix);
              }
            }
          }
        }
      }
      for (const node of sourceFile.statements) {
        checkInlineImport(node);
        if (!matchesModifier(node, ts2.ModifierFlags.ExportDefault)) {
          continue;
        }
        if (ts2.isFunctionDeclaration(node) || ts2.isClassDeclaration(node)) {
          if (node.name) {
            continue;
          }
          if (!defaultExport) {
            defaultExport = uniqName("export_default");
          }
          const children = node.getChildren();
          const idx = children.findIndex((node2) => node2.kind === ts2.SyntaxKind.ClassKeyword || node2.kind === ts2.SyntaxKind.FunctionKeyword);
          const token = children[idx];
          const nextToken = children[idx + 1];
          const isPunctuation = nextToken.kind >= ts2.SyntaxKind.FirstPunctuation && nextToken.kind <= ts2.SyntaxKind.LastPunctuation;
          if (isPunctuation) {
            code.appendLeft(nextToken.getStart(), defaultExport);
          } else {
            code.appendRight(token.getEnd(), ` ${defaultExport}`);
          }
        }
      }
      for (const ranges of nameRanges.values()) {
        const last = ranges.pop();
        const start = last[0];
        for (const node of ranges) {
          code.move(node[0], node[1], start);
        }
      }
      if (defaultExport) {
        code.append(`
export default ${defaultExport};
`);
      }
      if (exportedNames.size) {
        code.append(`
export { ${[...exportedNames].join(", ")} };
`);
      }
      for (const [fileId, importName] of inlineImports.entries()) {
        code.prepend(`import * as ${importName} from "${fileId}";
`);
      }
      const lineStarts = sourceFile.getLineStarts();
      const typeReferences = /* @__PURE__ */ new Set();
      for (const ref of sourceFile.typeReferenceDirectives) {
        typeReferences.add(ref.fileName);
        const { line } = sourceFile.getLineAndCharacterOfPosition(ref.pos);
        const start = lineStarts[line];
        let end = sourceFile.getLineEndOfPosition(ref.pos);
        if (code.slice(end, end + 1) == "\n") {
          end += 1;
        }
        code.remove(start, end);
      }
      const fileReferences = /* @__PURE__ */ new Set();
      for (const ref of sourceFile.referencedFiles) {
        fileReferences.add(ref.fileName);
        const { line } = sourceFile.getLineAndCharacterOfPosition(ref.pos);
        const start = lineStarts[line];
        let end = sourceFile.getLineEndOfPosition(ref.pos);
        if (code.slice(end, end + 1) == "\n") {
          end += 1;
        }
        code.remove(start, end);
      }
      return {
        code,
        typeReferences,
        fileReferences
      };
      function checkInlineImport(node) {
        ts2.forEachChild(node, checkInlineImport);
        if (ts2.isImportTypeNode(node)) {
          if (!ts2.isLiteralTypeNode(node.argument) || !ts2.isStringLiteral(node.argument.literal)) {
            throw new UnsupportedSyntaxError(node, "inline imports should have a literal argument");
          }
          const fileId = node.argument.literal.text;
          const children = node.getChildren();
          const start = children.find((t) => t.kind === ts2.SyntaxKind.ImportKeyword).getStart();
          let end = node.getEnd();
          const token = children.find((t) => t.kind === ts2.SyntaxKind.DotToken || t.kind === ts2.SyntaxKind.LessThanToken);
          if (token) {
            end = token.getStart();
          }
          const importName = createNamespaceImport(fileId);
          code.overwrite(start, end, importName);
        }
      }
      function createNamespaceImport(fileId) {
        let importName = inlineImports.get(fileId);
        if (!importName) {
          importName = uniqName(fileId.replace(/[^a-zA-Z0-9_$]/g, () => "_"));
          inlineImports.set(fileId, importName);
        }
        return importName;
      }
      function uniqName(hint) {
        let name = hint;
        while (declaredNames.has(name)) {
          name = `_${name}`;
        }
        declaredNames.add(name);
        return name;
      }
      function pushNamedNode(name, range) {
        let nodes = nameRanges.get(name);
        if (!nodes) {
          nodes = [range];
          nameRanges.set(name, nodes);
        } else {
          const last = nodes[nodes.length - 1];
          if (last[1] === range[0]) {
            last[1] = range[1];
          } else {
            nodes.push(range);
          }
        }
      }
    }
    function fixModifiers(code, node) {
      if (!ts2.canHaveModifiers(node)) {
        return;
      }
      let hasDeclare = false;
      const needsDeclare = ts2.isEnumDeclaration(node) || ts2.isClassDeclaration(node) || ts2.isFunctionDeclaration(node) || ts2.isModuleDeclaration(node) || ts2.isVariableStatement(node);
      for (const mod of _nullishCoalesce(node.modifiers, () => ( []))) {
        switch (mod.kind) {
          case ts2.SyntaxKind.ExportKeyword:
          case ts2.SyntaxKind.DefaultKeyword:
            code.remove(mod.getStart(), mod.getEnd() + 1);
            break;
          case ts2.SyntaxKind.DeclareKeyword:
            hasDeclare = true;
        }
      }
      if (needsDeclare && !hasDeclare) {
        code.appendRight(node.getStart(), "declare ");
      }
    }
    function duplicateExports(code, module2) {
      if (!module2.body || !ts2.isModuleBlock(module2.body)) {
        return;
      }
      for (const node of module2.body.statements) {
        if (ts2.isExportDeclaration(node) && node.exportClause) {
          if (ts2.isNamespaceExport(node.exportClause)) {
            continue;
          }
          for (const decl of node.exportClause.elements) {
            if (!decl.propertyName) {
              code.appendLeft(decl.name.getEnd(), ` as ${decl.name.getText()}`);
            }
          }
        }
      }
    }
    function getStart(node) {
      const start = node.getFullStart();
      return start + (newlineAt(node, start) ? 1 : 0);
    }
    function getEnd(node) {
      const end = node.getEnd();
      return end + (newlineAt(node, end) ? 1 : 0);
    }
    function newlineAt(node, idx) {
      return node.getSourceFile().getFullText()[idx] == "\n";
    }
    var IGNORE_TYPENODES = /* @__PURE__ */ new Set([
      ts2.SyntaxKind.LiteralType,
      ts2.SyntaxKind.VoidKeyword,
      ts2.SyntaxKind.UnknownKeyword,
      ts2.SyntaxKind.AnyKeyword,
      ts2.SyntaxKind.BooleanKeyword,
      ts2.SyntaxKind.NumberKeyword,
      ts2.SyntaxKind.StringKeyword,
      ts2.SyntaxKind.ObjectKeyword,
      ts2.SyntaxKind.NullKeyword,
      ts2.SyntaxKind.UndefinedKeyword,
      ts2.SyntaxKind.SymbolKeyword,
      ts2.SyntaxKind.NeverKeyword,
      ts2.SyntaxKind.ThisKeyword,
      ts2.SyntaxKind.ThisType,
      ts2.SyntaxKind.BigIntKeyword
    ]);
    var DeclarationScope = class {
      constructor({ id, range }) {
        this.scopes = [];
        if (id) {
          this.declaration = createDeclaration(id, range);
        } else {
          const { iife, fn } = createIIFE(range);
          this.iife = iife;
          this.declaration = fn;
        }
        const ret = createReturn();
        this.declaration.body.body.push(ret.stmt);
        this.returnExpr = ret.expr;
      }
      pushScope() {
        this.scopes.push(/* @__PURE__ */ new Set());
      }
      popScope(n = 1) {
        for (let i = 0; i < n; i++) {
          this.scopes.pop();
        }
      }
      pushTypeVariable(id) {
        const name = id.getText();
        _optionalChain([this, 'access', _2 => _2.scopes, 'access', _3 => _3[this.scopes.length - 1], 'optionalAccess', _4 => _4.add, 'call', _5 => _5(name)]);
      }
      pushReference(id) {
        let name;
        if (id.type === "Identifier") {
          name = id.name;
        } else if (id.type === "MemberExpression") {
          if (id.object.type === "Identifier") {
            name = id.object.name;
          }
        }
        if (name) {
          for (const scope of this.scopes) {
            if (scope.has(name)) {
              return;
            }
          }
        }
        if (name === "this")
          return;
        const { ident, expr } = createReference(id);
        this.declaration.params.push(expr);
        this.returnExpr.elements.push(ident);
      }
      pushIdentifierReference(id) {
        this.pushReference(createIdentifier(id));
      }
      convertEntityName(node) {
        if (ts2.isIdentifier(node)) {
          return createIdentifier(node);
        }
        return withStartEnd({
          type: "MemberExpression",
          computed: false,
          optional: false,
          object: this.convertEntityName(node.left),
          property: createIdentifier(node.right)
        }, node);
      }
      convertPropertyAccess(node) {
        if (!ts2.isIdentifier(node.expression) && !ts2.isPropertyAccessExpression(node.expression)) {
          throw new UnsupportedSyntaxError(node.expression);
        }
        if (ts2.isPrivateIdentifier(node.name)) {
          throw new UnsupportedSyntaxError(node.name);
        }
        let object = ts2.isIdentifier(node.expression) ? createIdentifier(node.expression) : this.convertPropertyAccess(node.expression);
        return withStartEnd({
          type: "MemberExpression",
          computed: false,
          optional: false,
          object,
          property: createIdentifier(node.name)
        }, node);
      }
      convertComputedPropertyName(node) {
        if (!node.name || !ts2.isComputedPropertyName(node.name)) {
          return;
        }
        const { expression } = node.name;
        if (ts2.isLiteralExpression(expression) || ts2.isPrefixUnaryExpression(expression)) {
          return;
        }
        if (ts2.isIdentifier(expression)) {
          return this.pushReference(createIdentifier(expression));
        }
        if (ts2.isPropertyAccessExpression(expression)) {
          return this.pushReference(this.convertPropertyAccess(expression));
        }
        throw new UnsupportedSyntaxError(expression);
      }
      convertParametersAndType(node) {
        this.convertComputedPropertyName(node);
        const typeVariables = this.convertTypeParameters(node.typeParameters);
        for (const param of node.parameters) {
          this.convertTypeNode(param.type);
        }
        this.convertTypeNode(node.type);
        this.popScope(typeVariables);
      }
      convertHeritageClauses(node) {
        for (const heritage of node.heritageClauses || []) {
          for (const type of heritage.types) {
            this.pushReference(convertExpression(type.expression));
            this.convertTypeArguments(type);
          }
        }
      }
      convertTypeArguments(node) {
        if (!node.typeArguments) {
          return;
        }
        for (const arg of node.typeArguments) {
          this.convertTypeNode(arg);
        }
      }
      convertMembers(members) {
        for (const node of members) {
          if (ts2.isPropertyDeclaration(node) || ts2.isPropertySignature(node) || ts2.isIndexSignatureDeclaration(node)) {
            if (ts2.isPropertyDeclaration(node) && node.initializer && ts2.isPropertyAccessExpression(node.initializer)) {
              this.pushReference(this.convertPropertyAccess(node.initializer));
            }
            this.convertComputedPropertyName(node);
            this.convertTypeNode(node.type);
            continue;
          }
          if (ts2.isMethodDeclaration(node) || ts2.isMethodSignature(node) || ts2.isConstructorDeclaration(node) || ts2.isConstructSignatureDeclaration(node) || ts2.isCallSignatureDeclaration(node) || ts2.isGetAccessorDeclaration(node) || ts2.isSetAccessorDeclaration(node)) {
            this.convertParametersAndType(node);
          } else {
            throw new UnsupportedSyntaxError(node);
          }
        }
      }
      convertTypeParameters(params) {
        if (!params) {
          return 0;
        }
        for (const node of params) {
          this.convertTypeNode(node.constraint);
          this.convertTypeNode(node.default);
          this.pushScope();
          this.pushTypeVariable(node.name);
        }
        return params.length;
      }
      convertTypeNode(node) {
        if (!node) {
          return;
        }
        if (IGNORE_TYPENODES.has(node.kind)) {
          return;
        }
        if (ts2.isTypeReferenceNode(node)) {
          this.pushReference(this.convertEntityName(node.typeName));
          this.convertTypeArguments(node);
          return;
        }
        if (ts2.isTypeLiteralNode(node)) {
          return this.convertMembers(node.members);
        }
        if (ts2.isArrayTypeNode(node)) {
          return this.convertTypeNode(node.elementType);
        }
        if (ts2.isTupleTypeNode(node)) {
          for (const type of node.elements) {
            this.convertTypeNode(type);
          }
          return;
        }
        if (ts2.isNamedTupleMember(node) || ts2.isParenthesizedTypeNode(node) || ts2.isTypeOperatorNode(node) || ts2.isTypePredicateNode(node)) {
          return this.convertTypeNode(node.type);
        }
        if (ts2.isUnionTypeNode(node) || ts2.isIntersectionTypeNode(node)) {
          for (const type of node.types) {
            this.convertTypeNode(type);
          }
          return;
        }
        if (ts2.isMappedTypeNode(node)) {
          const { typeParameter, type, nameType } = node;
          this.convertTypeNode(typeParameter.constraint);
          this.pushScope();
          this.pushTypeVariable(typeParameter.name);
          this.convertTypeNode(type);
          if (nameType) {
            this.convertTypeNode(nameType);
          }
          this.popScope();
          return;
        }
        if (ts2.isConditionalTypeNode(node)) {
          this.convertTypeNode(node.checkType);
          this.pushScope();
          this.convertTypeNode(node.extendsType);
          this.convertTypeNode(node.trueType);
          this.convertTypeNode(node.falseType);
          this.popScope();
          return;
        }
        if (ts2.isIndexedAccessTypeNode(node)) {
          this.convertTypeNode(node.objectType);
          this.convertTypeNode(node.indexType);
          return;
        }
        if (ts2.isFunctionOrConstructorTypeNode(node)) {
          this.convertParametersAndType(node);
          return;
        }
        if (ts2.isTypeQueryNode(node)) {
          this.pushReference(this.convertEntityName(node.exprName));
          return;
        }
        if (ts2.isRestTypeNode(node)) {
          this.convertTypeNode(node.type);
          return;
        }
        if (ts2.isOptionalTypeNode(node)) {
          this.convertTypeNode(node.type);
          return;
        }
        if (ts2.isTemplateLiteralTypeNode(node)) {
          for (const span of node.templateSpans) {
            this.convertTypeNode(span.type);
          }
          return;
        }
        if (ts2.isInferTypeNode(node)) {
          const { typeParameter } = node;
          this.convertTypeNode(typeParameter.constraint);
          this.pushTypeVariable(typeParameter.name);
          return;
        } else {
          throw new UnsupportedSyntaxError(node);
        }
      }
      convertNamespace(node, relaxedModuleBlock = false) {
        this.pushScope();
        if (relaxedModuleBlock && node.body && ts2.isModuleDeclaration(node.body)) {
          this.convertNamespace(node.body, true);
          return;
        }
        if (!node.body || !ts2.isModuleBlock(node.body)) {
          throw new UnsupportedSyntaxError(node, `namespace must have a "ModuleBlock" body.`);
        }
        const { statements } = node.body;
        for (const stmt of statements) {
          if (ts2.isEnumDeclaration(stmt) || ts2.isFunctionDeclaration(stmt) || ts2.isClassDeclaration(stmt) || ts2.isInterfaceDeclaration(stmt) || ts2.isTypeAliasDeclaration(stmt) || ts2.isModuleDeclaration(stmt)) {
            if (stmt.name && ts2.isIdentifier(stmt.name)) {
              this.pushTypeVariable(stmt.name);
            } else {
              throw new UnsupportedSyntaxError(stmt, `non-Identifier name not supported`);
            }
            continue;
          }
          if (ts2.isVariableStatement(stmt)) {
            for (const decl of stmt.declarationList.declarations) {
              if (ts2.isIdentifier(decl.name)) {
                this.pushTypeVariable(decl.name);
              } else {
                throw new UnsupportedSyntaxError(decl, `non-Identifier name not supported`);
              }
            }
            continue;
          }
          if (ts2.isExportDeclaration(stmt))
            ;
          else {
            throw new UnsupportedSyntaxError(stmt, `namespace child (hoisting) not supported yet`);
          }
        }
        for (const stmt of statements) {
          if (ts2.isVariableStatement(stmt)) {
            for (const decl of stmt.declarationList.declarations) {
              if (decl.type) {
                this.convertTypeNode(decl.type);
              }
            }
            continue;
          }
          if (ts2.isFunctionDeclaration(stmt)) {
            this.convertParametersAndType(stmt);
            continue;
          }
          if (ts2.isInterfaceDeclaration(stmt) || ts2.isClassDeclaration(stmt)) {
            const typeVariables = this.convertTypeParameters(stmt.typeParameters);
            this.convertHeritageClauses(stmt);
            this.convertMembers(stmt.members);
            this.popScope(typeVariables);
            continue;
          }
          if (ts2.isTypeAliasDeclaration(stmt)) {
            const typeVariables = this.convertTypeParameters(stmt.typeParameters);
            this.convertTypeNode(stmt.type);
            this.popScope(typeVariables);
            continue;
          }
          if (ts2.isModuleDeclaration(stmt)) {
            this.convertNamespace(stmt, relaxedModuleBlock);
            continue;
          }
          if (ts2.isEnumDeclaration(stmt)) {
            continue;
          }
          if (ts2.isExportDeclaration(stmt)) {
            if (stmt.exportClause) {
              if (ts2.isNamespaceExport(stmt.exportClause)) {
                throw new UnsupportedSyntaxError(stmt.exportClause);
              }
              for (const decl of stmt.exportClause.elements) {
                const id = decl.propertyName || decl.name;
                this.pushIdentifierReference(id);
              }
            }
          } else {
            throw new UnsupportedSyntaxError(stmt, `namespace child (walking) not supported yet`);
          }
        }
        this.popScope();
      }
    };
    function convert({ sourceFile }) {
      const transformer = new Transformer(sourceFile);
      return transformer.transform();
    }
    var Transformer = class {
      constructor(sourceFile) {
        this.sourceFile = sourceFile;
        this.declarations = /* @__PURE__ */ new Map();
        this.ast = createProgram(sourceFile);
        for (const stmt of sourceFile.statements) {
          this.convertStatement(stmt);
        }
      }
      transform() {
        return {
          ast: this.ast
        };
      }
      pushStatement(node) {
        this.ast.body.push(node);
      }
      createDeclaration(node, id) {
        const range = { start: node.getFullStart(), end: node.getEnd() };
        if (!id) {
          const scope2 = new DeclarationScope({ range });
          this.pushStatement(scope2.iife);
          return scope2;
        }
        const name = id.getText();
        const scope = new DeclarationScope({ id, range });
        const existingScope = this.declarations.get(name);
        if (existingScope) {
          existingScope.pushIdentifierReference(id);
          existingScope.declaration.end = range.end;
          let selfIdx = this.ast.body.findIndex((node2) => node2 == existingScope.declaration);
          for (let i = selfIdx + 1; i < this.ast.body.length; i++) {
            const decl = this.ast.body[i];
            decl.start = decl.end = range.end;
          }
        } else {
          this.pushStatement(scope.declaration);
          this.declarations.set(name, scope);
        }
        return existingScope || scope;
      }
      convertStatement(node) {
        if (ts2.isEnumDeclaration(node)) {
          return this.convertEnumDeclaration(node);
        }
        if (ts2.isFunctionDeclaration(node)) {
          return this.convertFunctionDeclaration(node);
        }
        if (ts2.isInterfaceDeclaration(node) || ts2.isClassDeclaration(node)) {
          return this.convertClassOrInterfaceDeclaration(node);
        }
        if (ts2.isTypeAliasDeclaration(node)) {
          return this.convertTypeAliasDeclaration(node);
        }
        if (ts2.isVariableStatement(node)) {
          return this.convertVariableStatement(node);
        }
        if (ts2.isExportDeclaration(node) || ts2.isExportAssignment(node)) {
          return this.convertExportDeclaration(node);
        }
        if (ts2.isModuleDeclaration(node)) {
          return this.convertNamespaceDeclaration(node);
        }
        if (node.kind == ts2.SyntaxKind.NamespaceExportDeclaration) {
          return this.removeStatement(node);
        }
        if (ts2.isImportDeclaration(node) || ts2.isImportEqualsDeclaration(node)) {
          return this.convertImportDeclaration(node);
        } else {
          throw new UnsupportedSyntaxError(node);
        }
      }
      removeStatement(node) {
        this.pushStatement(withStartEnd({
          type: "ExpressionStatement",
          expression: { type: "Literal", value: "pls remove me" }
        }, node));
      }
      convertNamespaceDeclaration(node) {
        const isGlobalAugmentation = node.flags & ts2.NodeFlags.GlobalAugmentation;
        if (isGlobalAugmentation || !ts2.isIdentifier(node.name)) {
          const scope2 = this.createDeclaration(node);
          scope2.convertNamespace(node, true);
          return;
        }
        const scope = this.createDeclaration(node, node.name);
        scope.pushIdentifierReference(node.name);
        scope.convertNamespace(node);
      }
      convertEnumDeclaration(node) {
        const scope = this.createDeclaration(node, node.name);
        scope.pushIdentifierReference(node.name);
      }
      convertFunctionDeclaration(node) {
        if (!node.name) {
          throw new UnsupportedSyntaxError(node, `FunctionDeclaration should have a name`);
        }
        const scope = this.createDeclaration(node, node.name);
        scope.pushIdentifierReference(node.name);
        scope.convertParametersAndType(node);
      }
      convertClassOrInterfaceDeclaration(node) {
        if (!node.name) {
          throw new UnsupportedSyntaxError(node, `ClassDeclaration / InterfaceDeclaration should have a name`);
        }
        const scope = this.createDeclaration(node, node.name);
        const typeVariables = scope.convertTypeParameters(node.typeParameters);
        scope.convertHeritageClauses(node);
        scope.convertMembers(node.members);
        scope.popScope(typeVariables);
      }
      convertTypeAliasDeclaration(node) {
        const scope = this.createDeclaration(node, node.name);
        const typeVariables = scope.convertTypeParameters(node.typeParameters);
        scope.convertTypeNode(node.type);
        scope.popScope(typeVariables);
      }
      convertVariableStatement(node) {
        const { declarations } = node.declarationList;
        if (declarations.length !== 1) {
          throw new UnsupportedSyntaxError(node, `VariableStatement with more than one declaration not yet supported`);
        }
        for (const decl of declarations) {
          if (!ts2.isIdentifier(decl.name)) {
            throw new UnsupportedSyntaxError(node, `VariableDeclaration must have a name`);
          }
          const scope = this.createDeclaration(node, decl.name);
          scope.convertTypeNode(decl.type);
        }
      }
      convertExportDeclaration(node) {
        if (ts2.isExportAssignment(node)) {
          this.pushStatement(withStartEnd({
            type: "ExportDefaultDeclaration",
            declaration: convertExpression(node.expression)
          }, node));
          return;
        }
        const source = node.moduleSpecifier ? convertExpression(node.moduleSpecifier) : void 0;
        if (!node.exportClause) {
          this.pushStatement(withStartEnd({
            type: "ExportAllDeclaration",
            source,
            exported: null
          }, node));
        } else if (ts2.isNamespaceExport(node.exportClause)) {
          this.pushStatement(withStartEnd({
            type: "ExportAllDeclaration",
            source,
            exported: createIdentifier(node.exportClause.name)
          }, node));
        } else {
          const specifiers = [];
          for (const elem of node.exportClause.elements) {
            specifiers.push(this.convertExportSpecifier(elem));
          }
          this.pushStatement(withStartEnd({
            type: "ExportNamedDeclaration",
            declaration: null,
            specifiers,
            source
          }, node));
        }
      }
      convertImportDeclaration(node) {
        if (ts2.isImportEqualsDeclaration(node)) {
          if (!ts2.isExternalModuleReference(node.moduleReference)) {
            throw new UnsupportedSyntaxError(node, "ImportEquals should have a literal source.");
          }
          this.pushStatement(withStartEnd({
            type: "ImportDeclaration",
            specifiers: [
              {
                type: "ImportDefaultSpecifier",
                local: createIdentifier(node.name)
              }
            ],
            source: convertExpression(node.moduleReference.expression)
          }, node));
          return;
        }
        const source = convertExpression(node.moduleSpecifier);
        const specifiers = node.importClause && node.importClause.namedBindings ? this.convertNamedImportBindings(node.importClause.namedBindings) : [];
        if (node.importClause && node.importClause.name) {
          specifiers.push({
            type: "ImportDefaultSpecifier",
            local: createIdentifier(node.importClause.name)
          });
        }
        this.pushStatement(withStartEnd({
          type: "ImportDeclaration",
          specifiers,
          source
        }, node));
      }
      convertNamedImportBindings(node) {
        if (ts2.isNamedImports(node)) {
          return node.elements.map((el) => {
            const local = createIdentifier(el.name);
            const imported = el.propertyName ? createIdentifier(el.propertyName) : local;
            return {
              type: "ImportSpecifier",
              local,
              imported
            };
          });
        }
        return [
          {
            type: "ImportNamespaceSpecifier",
            local: createIdentifier(node.name)
          }
        ];
      }
      convertExportSpecifier(node) {
        const exported = createIdentifier(node.name);
        return {
          type: "ExportSpecifier",
          exported,
          local: node.propertyName ? createIdentifier(node.propertyName) : exported
        };
      }
    };
    var ExportsFixer = class {
      constructor(source) {
        this.source = source;
        this.DEBUG = !!process.env.DTS_EXPORTS_FIXER_DEBUG;
      }
      fix() {
        const exports2 = this.findExports();
        exports2.sort((a, b) => a.location.start - b.location.start);
        return this.getCodeParts(exports2).join("");
      }
      findExports() {
        const { rawExports, values, types } = this.getExportsAndLocals();
        return rawExports.map((rawExport) => {
          const elements = rawExport.elements.map((e) => {
            const exportedName = e.name.text;
            const localName = _nullishCoalesce(_optionalChain([e, 'access', _6 => _6.propertyName, 'optionalAccess', _7 => _7.text]), () => ( e.name.text));
            const kind = types.some((node) => node.getText() === localName) && !values.some((node) => node.getText() === localName) ? "type" : "value";
            this.DEBUG && console.log(`export ${localName} as ${exportedName} is a ${kind}`);
            return {
              exportedName,
              localName,
              kind
            };
          });
          return {
            location: {
              start: rawExport.getStart(),
              end: rawExport.getEnd()
            },
            exports: elements
          };
        });
      }
      getExportsAndLocals(statements = this.source.statements) {
        const rawExports = [];
        const values = [];
        const types = [];
        const recurseInto = (subStatements) => {
          const { rawExports: subExports, values: subValues, types: subTypes } = this.getExportsAndLocals(subStatements);
          rawExports.push(...subExports);
          values.push(...subValues);
          types.push(...subTypes);
        };
        for (const statement of statements) {
          this.DEBUG && console.log(statement.getText(), statement.kind);
          if (ts2.isImportDeclaration(statement)) {
            continue;
          }
          if (ts2.isInterfaceDeclaration(statement) || ts2.isTypeAliasDeclaration(statement)) {
            this.DEBUG && console.log(`${statement.name.getFullText()} is a type`);
            types.push(statement.name);
            continue;
          }
          if (ts2.isEnumDeclaration(statement) || ts2.isFunctionDeclaration(statement) || ts2.isClassDeclaration(statement) || ts2.isVariableStatement(statement)) {
            if (ts2.isVariableStatement(statement)) {
              for (const declaration of statement.declarationList.declarations) {
                if (ts2.isIdentifier(declaration.name)) {
                  this.DEBUG && console.log(`${declaration.name.getFullText()} is a value (from var statement)`);
                  values.push(declaration.name);
                }
              }
            } else {
              if (statement.name) {
                this.DEBUG && console.log(`${statement.name.getFullText()} is a value (from declaration)`);
                values.push(statement.name);
              }
            }
            continue;
          }
          if (ts2.isModuleBlock(statement)) {
            const subStatements = statement.statements;
            recurseInto(subStatements);
            continue;
          }
          if (ts2.isModuleDeclaration(statement)) {
            if (statement.name && ts2.isIdentifier(statement.name)) {
              this.DEBUG && console.log(`${statement.name.getFullText()} is a value (from module declaration)`);
              values.push(statement.name);
            }
            recurseInto(statement.getChildren());
            continue;
          }
          if (ts2.isExportDeclaration(statement)) {
            if (statement.moduleSpecifier) {
              continue;
            }
            if (statement.isTypeOnly) {
              continue;
            }
            const exportClause = statement.exportClause;
            if (!exportClause || !ts2.isNamedExports(exportClause)) {
              continue;
            }
            rawExports.push(exportClause);
            continue;
          }
          this.DEBUG && console.log("unhandled statement", statement.getFullText(), statement.kind);
        }
        return { rawExports, values, types };
      }
      createNamedExport(exportSpec, elideType = false) {
        return `${!elideType && exportSpec.kind === "type" ? "type " : ""}${exportSpec.localName}${exportSpec.localName === exportSpec.exportedName ? "" : ` as ${exportSpec.exportedName}`}`;
      }
      getCodeParts(exports2) {
        let cursor = 0;
        const code = this.source.getFullText();
        const parts = [];
        for (const exportDeclaration of exports2) {
          const head = code.slice(cursor, exportDeclaration.location.start);
          if (head.length > 0) {
            parts.push(head);
          }
          parts.push(this.getExportStatement(exportDeclaration));
          cursor = exportDeclaration.location.end;
        }
        if (cursor < code.length) {
          parts.push(code.slice(cursor));
        }
        return parts;
      }
      getExportStatement(exportDeclaration) {
        const isTypeOnly = exportDeclaration.exports.every((e) => e.kind === "type") && exportDeclaration.exports.length > 0;
        return `${isTypeOnly ? "type " : ""}{ ${exportDeclaration.exports.map((exp) => this.createNamedExport(exp, isTypeOnly)).join(", ")} }`;
      }
    };
    function parse(fileName, code) {
      return ts2.createSourceFile(fileName, code, ts2.ScriptTarget.Latest, true);
    }
    var transform = () => {
      const allTypeReferences = /* @__PURE__ */ new Map();
      const allFileReferences = /* @__PURE__ */ new Map();
      return {
        name: "dts-transform",
        options({ onLog, ...options }) {
          return {
            ...options,
            onLog(level, log, defaultHandler) {
              if (level === "warn" && log.code == "CIRCULAR_DEPENDENCY") {
                return;
              }
              if (onLog) {
                onLog(level, log, defaultHandler);
              } else {
                defaultHandler(level, log);
              }
            },
            treeshake: {
              moduleSideEffects: "no-external",
              propertyReadSideEffects: true,
              unknownGlobalSideEffects: false
            }
          };
        },
        outputOptions(options) {
          return {
            ...options,
            chunkFileNames: options.chunkFileNames || "[name]-[hash].d.ts",
            entryFileNames: options.entryFileNames || "[name].d.ts",
            format: "es",
            exports: "named",
            compact: false,
            freeze: true,
            interop: "esModule",
            generatedCode: Object.assign({ symbols: false }, options.generatedCode),
            strict: false
          };
        },
        transform(code, fileName) {
          let sourceFile = parse(fileName, code);
          const preprocessed = preProcess({ sourceFile });
          allTypeReferences.set(sourceFile.fileName, preprocessed.typeReferences);
          allFileReferences.set(sourceFile.fileName, preprocessed.fileReferences);
          code = preprocessed.code.toString();
          sourceFile = parse(fileName, code);
          const converted = convert({ sourceFile });
          if (process.env.DTS_DUMP_AST) {
            console.log(fileName);
            console.log(code);
            console.log(JSON.stringify(converted.ast.body, void 0, 2));
          }
          return { code, ast: converted.ast, map: preprocessed.code.generateMap() };
        },
        renderChunk(inputCode, chunk, options) {
          const source = parse(chunk.fileName, inputCode);
          const fixer = new NamespaceFixer(source);
          const typeReferences = /* @__PURE__ */ new Set();
          const fileReferences = /* @__PURE__ */ new Set();
          for (const fileName of Object.keys(chunk.modules)) {
            for (const ref of allTypeReferences.get(fileName.split("\\").join("/")) || []) {
              typeReferences.add(ref);
            }
            for (const ref of allFileReferences.get(fileName.split("\\").join("/")) || []) {
              if (ref.startsWith(".")) {
                const absolutePathToOriginal = path__namespace.join(path__namespace.dirname(fileName), ref);
                const chunkFolder = options.file && path__namespace.dirname(options.file) || chunk.facadeModuleId && path__namespace.dirname(chunk.facadeModuleId) || ".";
                let targetRelPath = path__namespace.relative(chunkFolder, absolutePathToOriginal).split("\\").join("/");
                if (targetRelPath[0] !== ".") {
                  targetRelPath = "./" + targetRelPath;
                }
                fileReferences.add(targetRelPath);
              } else {
                fileReferences.add(ref);
              }
            }
          }
          let code = writeBlock(Array.from(fileReferences, (ref) => `/// <reference path="${ref}" />`));
          code += writeBlock(Array.from(typeReferences, (ref) => `/// <reference types="${ref}" />`));
          code += fixer.fix();
          if (!code) {
            code += "\nexport { }";
          }
          const exportsFixer = new ExportsFixer(parse(chunk.fileName, code));
          return { code: exportsFixer.fix(), map: { mappings: "" } };
        }
      };
    };
    function writeBlock(codes) {
      if (codes.length) {
        return codes.join("\n") + "\n";
      }
      return "";
    }
    var TS_EXTENSIONS = /\.([cm]ts|[tj]sx?)$/;
    function getModule({ programs, resolvedOptions: { compilerOptions, tsconfig } }, fileName, code) {
      if (!programs.length && DTS_EXTENSIONS.test(fileName)) {
        return { code };
      }
      const existingProgram = programs.find((p) => !!p.getSourceFile(fileName));
      if (existingProgram) {
        const source = existingProgram.getSourceFile(fileName);
        return {
          code: _optionalChain([source, 'optionalAccess', _8 => _8.getFullText, 'call', _9 => _9()]),
          source,
          program: existingProgram
        };
      } else if (ts2.sys.fileExists(fileName)) {
        const newProgram = createProgram$1(fileName, compilerOptions, tsconfig);
        programs.push(newProgram);
        const source = newProgram.getSourceFile(fileName);
        return {
          code: _optionalChain([source, 'optionalAccess', _10 => _10.getFullText, 'call', _11 => _11()]),
          source,
          program: newProgram
        };
      } else {
        return null;
      }
    }
    var plugin = (options = {}) => {
      const transformPlugin = transform();
      const ctx = { programs: [], resolvedOptions: resolveDefaultOptions(options) };
      return {
        name: "dts",
        // pass outputOptions & renderChunk hooks to the inner transform plugin
        outputOptions: transformPlugin.outputOptions,
        renderChunk: transformPlugin.renderChunk,
        options(options2) {
          let { input = [] } = options2;
          if (!Array.isArray(input)) {
            input = typeof input === "string" ? [input] : Object.values(input);
          } else if (input.length > 1) {
            options2.input = {};
            for (const filename of input) {
              let name = filename.replace(/((\.d)?\.(c|m)?(t|j)sx?)$/, "");
              if (path__namespace.isAbsolute(filename)) {
                name = path__namespace.basename(name);
              } else {
                name = path__namespace.normalize(name);
              }
              options2.input[name] = filename;
            }
          }
          ctx.programs = createPrograms(Object.values(input), ctx.resolvedOptions.compilerOptions, ctx.resolvedOptions.tsconfig);
          return transformPlugin.options.call(this, options2);
        },
        transform(code, id) {
          if (!TS_EXTENSIONS.test(id)) {
            return null;
          }
          const watchFiles = (module2) => {
            if (module2.program) {
              const sourceDirectory = path__namespace.dirname(id);
              const sourceFilesInProgram = module2.program.getSourceFiles().map((sourceFile) => sourceFile.fileName).filter((fileName) => fileName.startsWith(sourceDirectory));
              sourceFilesInProgram.forEach(this.addWatchFile);
            }
          };
          const handleDtsFile = () => {
            const module2 = getModule(ctx, id, code);
            if (module2) {
              watchFiles(module2);
              return transformPlugin.transform.call(this, module2.code, id);
            }
            return null;
          };
          const treatTsAsDts = () => {
            const declarationId = id.replace(TS_EXTENSIONS, dts);
            let module2 = getModule(ctx, declarationId, code);
            if (module2) {
              watchFiles(module2);
              return transformPlugin.transform.call(this, module2.code, declarationId);
            }
            return null;
          };
          const generateDtsFromTs = () => {
            const module2 = getModule(ctx, id, code);
            if (!module2 || !module2.source || !module2.program)
              return null;
            watchFiles(module2);
            const declarationId = id.replace(TS_EXTENSIONS, dts);
            let generated;
            const { emitSkipped, diagnostics } = module2.program.emit(
              module2.source,
              (_, declarationText) => {
                generated = transformPlugin.transform.call(this, declarationText, declarationId);
              },
              void 0,
              // cancellationToken
              true
            );
            if (emitSkipped) {
              const errors = diagnostics.filter((diag) => diag.category === ts2.DiagnosticCategory.Error);
              if (errors.length) {
                console.error(ts2.formatDiagnostics(errors, formatHost));
                this.error("Failed to compile. Check the logs above.");
              }
            }
            return generated;
          };
          if (DTS_EXTENSIONS.test(id))
            return handleDtsFile();
          return _nullishCoalesce(treatTsAsDts(), () => ( generateDtsFromTs()));
        },
        resolveId(source, importer) {
          if (!importer) {
            return;
          }
          importer = importer.split("\\").join("/");
          let resolvedCompilerOptions = ctx.resolvedOptions.compilerOptions;
          if (ctx.resolvedOptions.tsconfig) {
            const resolvedSource = source.startsWith(".") ? path__namespace.resolve(path__namespace.dirname(importer), source) : source;
            resolvedCompilerOptions = getCompilerOptions(resolvedSource, ctx.resolvedOptions.compilerOptions, ctx.resolvedOptions.tsconfig).compilerOptions;
          }
          const { resolvedModule } = ts2.resolveModuleName(source, importer, resolvedCompilerOptions, ts2.sys);
          if (!resolvedModule) {
            return;
          }
          if (!ctx.resolvedOptions.respectExternal && resolvedModule.isExternalLibraryImport) {
            return { id: source, external: true };
          } else {
            return { id: path__namespace.resolve(resolvedModule.resolvedFileName) };
          }
        }
      };
    };
    exports.default = plugin;
    exports.dts = plugin;
  }
});

// src/rollup.ts
var _worker_threads = require('worker_threads');
var _typescript = require('typescript'); var _typescript2 = _interopRequireDefault(_typescript);

// node_modules/.pnpm/@rollup+pluginutils@5.0.2_rollup@4.0.2/node_modules/@rollup/pluginutils/dist/es/index.js
var _path = require('path'); var _path2 = _interopRequireDefault(_path);
var import_picomatch = _chunkGQ77QZBOjs.__toESM.call(void 0, require_picomatch2(), 1);
function isArray(arg) {
  return Array.isArray(arg);
}
function ensureArray(thing) {
  if (isArray(thing))
    return thing;
  if (thing == null)
    return [];
  return [thing];
}
var normalizePath = function normalizePath2(filename) {
  return filename.split(_path.win32.sep).join(_path.posix.sep);
};
function getMatcherString(id, resolutionBase) {
  if (resolutionBase === false || _path.isAbsolute.call(void 0, id) || id.startsWith("*")) {
    return normalizePath(id);
  }
  const basePath = normalizePath(_path.resolve.call(void 0, resolutionBase || "")).replace(/[-^$*+?.()|[\]{}]/g, "\\$&");
  return _path.posix.join(basePath, normalizePath(id));
}
var createFilter = function createFilter2(include, exclude, options) {
  const resolutionBase = options && options.resolve;
  const getMatcher = (id) => id instanceof RegExp ? id : {
    test: (what) => {
      const pattern = getMatcherString(id, resolutionBase);
      const fn = (0, import_picomatch.default)(pattern, { dot: true });
      const result = fn(what);
      return result;
    }
  };
  const includeMatchers = ensureArray(include).map(getMatcher);
  const excludeMatchers = ensureArray(exclude).map(getMatcher);
  return function result(id) {
    if (typeof id !== "string")
      return false;
    if (/\0/.test(id))
      return false;
    const pathId = normalizePath(id);
    for (let i = 0; i < excludeMatchers.length; ++i) {
      const matcher = excludeMatchers[i];
      if (matcher.test(pathId))
        return false;
    }
    for (let i = 0; i < includeMatchers.length; ++i) {
      const matcher = includeMatchers[i];
      if (matcher.test(pathId))
        return true;
    }
    return !includeMatchers.length;
  };
};
var reservedWords = "break case class catch const continue debugger default delete do else export extends finally for function if import in instanceof let new return super switch this throw try typeof var void while with yield enum await implements package protected static interface private public";
var builtins = "arguments Infinity NaN undefined null true false eval uneval isFinite isNaN parseFloat parseInt decodeURI decodeURIComponent encodeURI encodeURIComponent escape unescape Object Function Boolean Symbol Error EvalError InternalError RangeError ReferenceError SyntaxError TypeError URIError Number Math Date String RegExp Array Int8Array Uint8Array Uint8ClampedArray Int16Array Uint16Array Int32Array Uint32Array Float32Array Float64Array Map Set WeakMap WeakSet SIMD ArrayBuffer DataView JSON Promise Generator GeneratorFunction Reflect Proxy Intl";
var forbiddenIdentifiers = new Set(`${reservedWords} ${builtins}`.split(" "));
forbiddenIdentifiers.add("");
var makeLegalIdentifier = function makeLegalIdentifier2(str) {
  let identifier = str.replace(/-(\w)/g, (_, letter) => letter.toUpperCase()).replace(/[^$_a-zA-Z0-9]/g, "_");
  if (/\d/.test(identifier[0]) || forbiddenIdentifiers.has(identifier)) {
    identifier = `_${identifier}`;
  }
  return identifier || "_";
};
function stringify(obj) {
  return (JSON.stringify(obj) || "undefined").replace(/[\u2028\u2029]/g, (char) => `\\u${`000${char.charCodeAt(0).toString(16)}`.slice(-4)}`);
}
function serializeArray(arr, indent, baseIndent) {
  let output = "[";
  const separator = indent ? `
${baseIndent}${indent}` : "";
  for (let i = 0; i < arr.length; i++) {
    const key = arr[i];
    output += `${i > 0 ? "," : ""}${separator}${serialize(key, indent, baseIndent + indent)}`;
  }
  return `${output}${indent ? `
${baseIndent}` : ""}]`;
}
function serializeObject(obj, indent, baseIndent) {
  let output = "{";
  const separator = indent ? `
${baseIndent}${indent}` : "";
  const entries = Object.entries(obj);
  for (let i = 0; i < entries.length; i++) {
    const [key, value] = entries[i];
    const stringKey = makeLegalIdentifier(key) === key ? key : stringify(key);
    output += `${i > 0 ? "," : ""}${separator}${stringKey}:${indent ? " " : ""}${serialize(value, indent, baseIndent + indent)}`;
  }
  return `${output}${indent ? `
${baseIndent}` : ""}}`;
}
function serialize(obj, indent, baseIndent) {
  if (typeof obj === "object" && obj !== null) {
    if (Array.isArray(obj))
      return serializeArray(obj, indent, baseIndent);
    if (obj instanceof Date)
      return `new Date(${obj.getTime()})`;
    if (obj instanceof RegExp)
      return obj.toString();
    return serializeObject(obj, indent, baseIndent);
  }
  if (typeof obj === "number") {
    if (obj === Infinity)
      return "Infinity";
    if (obj === -Infinity)
      return "-Infinity";
    if (obj === 0)
      return 1 / obj === Infinity ? "0" : "-0";
    if (obj !== obj)
      return "NaN";
  }
  if (typeof obj === "symbol") {
    const key = Symbol.keyFor(obj);
    if (key !== void 0)
      return `Symbol.for(${stringify(key)})`;
  }
  if (typeof obj === "bigint")
    return `${obj}n`;
  return stringify(obj);
}
var dataToEsm = function dataToEsm2(data, options = {}) {
  const t = options.compact ? "" : "indent" in options ? options.indent : "	";
  const _ = options.compact ? "" : " ";
  const n = options.compact ? "" : "\n";
  const declarationType = options.preferConst ? "const" : "var";
  if (options.namedExports === false || typeof data !== "object" || Array.isArray(data) || data instanceof Date || data instanceof RegExp || data === null) {
    const code = serialize(data, options.compact ? null : t, "");
    const magic = _ || (/^[{[\-\/]/.test(code) ? "" : " ");
    return `export default${magic}${code};`;
  }
  let namedExportCode = "";
  const defaultExportRows = [];
  for (const [key, value] of Object.entries(data)) {
    if (key === makeLegalIdentifier(key)) {
      if (options.objectShorthand)
        defaultExportRows.push(key);
      else
        defaultExportRows.push(`${key}:${_}${key}`);
      namedExportCode += `export ${declarationType} ${key}${_}=${_}${serialize(value, options.compact ? null : t, "")};${n}`;
    } else {
      defaultExportRows.push(`${stringify(key)}:${_}${serialize(value, options.compact ? null : t, "")}`);
    }
  }
  return `${namedExportCode}export default${_}{${n}${t}${defaultExportRows.join(`,${n}${t}`)}${n}};${n}`;
};

// node_modules/.pnpm/@rollup+plugin-json@6.0.1_rollup@4.0.2/node_modules/@rollup/plugin-json/dist/es/index.js
function json(options) {
  if (options === void 0)
    options = {};
  var filter = createFilter(options.include, options.exclude);
  var indent = "indent" in options ? options.indent : "	";
  return {
    name: "json",
    // eslint-disable-next-line no-shadow
    transform: function transform(code, id) {
      if (id.slice(-5) !== ".json" || !filter(id)) {
        return null;
      }
      try {
        var parsed = JSON.parse(code);
        return {
          code: dataToEsm(parsed, {
            preferConst: options.preferConst,
            compact: options.compact,
            namedExports: options.namedExports,
            indent
          }),
          map: { mappings: "" }
        };
      } catch (err) {
        var message = "Could not parse JSON file";
        this.error({ message, id, cause: err });
        return null;
      }
    }
  };
}

// src/rollup/ts-resolve.ts
var import_resolve = _chunkGQ77QZBOjs.__toESM.call(void 0, require_resolve());
var _fs = require('fs'); var _fs2 = _interopRequireDefault(_fs);

var _debug = require('debug'); var _debug2 = _interopRequireDefault(_debug);
var _module = require('module');
var debug = _debug2.default.call(void 0, "tsup:ts-resolve");
var resolveModule = (id, opts) => new Promise((resolve2, reject) => {
  (0, import_resolve.default)(id, opts, (err, res) => {
    if (_optionalChain([err, 'optionalAccess', _12 => _12.code]) === "MODULE_NOT_FOUND")
      return resolve2(null);
    if (err)
      return reject(err);
    resolve2(res || null);
  });
});
var tsResolvePlugin = ({
  resolveOnly,
  ignore
} = {}) => {
  const resolveExtensions = [".d.ts", ".ts"];
  return {
    name: `ts-resolve`,
    async resolveId(source, importer) {
      debug("resolveId source: %s", source);
      debug("resolveId importer: %s ", importer);
      if (!importer)
        return null;
      if (/\0/.test(source))
        return null;
      if (_module.builtinModules.includes(source))
        return false;
      if (ignore && ignore(source, importer)) {
        debug("ignored %s", source);
        return null;
      }
      if (resolveOnly) {
        const shouldResolve = resolveOnly.some((v) => {
          if (typeof v === "string")
            return v === source;
          return v.test(source);
        });
        if (!shouldResolve) {
          debug("skipped by matching resolveOnly: %s", source);
          return null;
        }
      }
      if (_path2.default.isAbsolute(source)) {
        debug(`skipped absolute path: %s`, source);
        return null;
      }
      const basedir = importer ? await _fs2.default.promises.realpath(_path2.default.dirname(importer)) : process.cwd();
      if (source[0] === ".") {
        return resolveModule(source, {
          basedir,
          extensions: resolveExtensions
        });
      }
      let id = null;
      if (!importer) {
        id = await resolveModule(`./${source}`, {
          basedir,
          extensions: resolveExtensions
        });
      }
      if (!id) {
        id = await resolveModule(source, {
          basedir,
          extensions: resolveExtensions,
          packageFilter(pkg) {
            pkg.main = pkg.types || pkg.typings;
            return pkg;
          },
          paths: ["node_modules", "node_modules/@types"]
        });
      }
      if (id) {
        debug("resolved %s to %s", source, id);
        return id;
      }
      debug("mark %s as external", source);
      return false;
    }
  };
};

// src/rollup.ts

var _resolvefrom = require('resolve-from'); var _resolvefrom2 = _interopRequireDefault(_resolvefrom);
var logger = _chunk7G76EW2Rjs.createLogger.call(void 0, );
var parseCompilerOptions = (compilerOptions) => {
  if (!compilerOptions)
    return {};
  const { options } = _typescript2.default.parseJsonConfigFileContent(
    { compilerOptions },
    _typescript2.default.sys,
    "./"
  );
  return options;
};
var dtsPlugin = require_rollup_plugin_dts();
var getRollupConfig = async (options) => {
  _chunk7G76EW2Rjs.setSilent.call(void 0, options.silent);
  const compilerOptions = parseCompilerOptions(_optionalChain([options, 'access', _13 => _13.dts, 'optionalAccess', _14 => _14.compilerOptions]));
  const dtsOptions = options.dts || {};
  dtsOptions.entry = dtsOptions.entry || options.entry;
  if (Array.isArray(dtsOptions.entry) && dtsOptions.entry.length > 1) {
    dtsOptions.entry = _chunkGQ77QZBOjs.toObjectEntry.call(void 0, dtsOptions.entry);
  }
  let tsResolveOptions;
  if (dtsOptions.resolve) {
    tsResolveOptions = {};
    if (Array.isArray(dtsOptions.resolve)) {
      tsResolveOptions.resolveOnly = dtsOptions.resolve;
    }
    if (compilerOptions.paths) {
      const res = Object.keys(compilerOptions.paths).map(
        (p) => new RegExp(`^${p.replace("*", ".+")}$`)
      );
      tsResolveOptions.ignore = (source) => {
        return res.some((re) => re.test(source));
      };
    }
  }
  const pkg = await _chunk7G76EW2Rjs.loadPkg.call(void 0, process.cwd());
  const deps = await _chunk7G76EW2Rjs.getProductionDeps.call(void 0, process.cwd());
  const tsupCleanPlugin = {
    name: "tsup:clean",
    async buildStart() {
      if (options.clean) {
        await _chunkGQ77QZBOjs.removeFiles.call(void 0, ["**/*.d.{ts,mts,cts}"], options.outDir);
      }
    }
  };
  const ignoreFiles = {
    name: "tsup:ignore-files",
    load(id) {
      if (!/\.(js|cjs|mjs|jsx|ts|tsx|mts|json)$/.test(id)) {
        return "";
      }
    }
  };
  const fixCjsExport = {
    name: "tsup:fix-cjs-export",
    renderChunk(code, info) {
      if (info.type !== "chunk" || !/\.(ts|cts)$/.test(info.fileName) || !info.isEntry || _optionalChain([info, 'access', _15 => _15.exports, 'optionalAccess', _16 => _16.length]) !== 1 || info.exports[0] !== "default")
        return;
      return code.replace(
        /(?<=(?<=[;}]|^)\s*export\s*){\s*([\w$]+)\s*as\s+default\s*}/,
        `= $1`
      );
    }
  };
  return {
    inputConfig: {
      input: dtsOptions.entry,
      onwarn(warning, handler) {
        if (warning.code === "UNRESOLVED_IMPORT" || warning.code === "CIRCULAR_DEPENDENCY" || warning.code === "EMPTY_BUNDLE") {
          return;
        }
        return handler(warning);
      },
      plugins: [
        tsupCleanPlugin,
        tsResolveOptions && tsResolvePlugin(tsResolveOptions),
        json(),
        ignoreFiles,
        dtsPlugin.default({
          tsconfig: options.tsconfig,
          compilerOptions: {
            ...compilerOptions,
            baseUrl: compilerOptions.baseUrl || ".",
            // Ensure ".d.ts" modules are generated
            declaration: true,
            // Skip ".js" generation
            noEmit: false,
            emitDeclarationOnly: true,
            // Skip code generation when error occurs
            noEmitOnError: true,
            // Avoid extra work
            checkJs: false,
            declarationMap: false,
            skipLibCheck: true,
            preserveSymlinks: false,
            // Ensure we can parse the latest code
            target: _typescript2.default.ScriptTarget.ESNext
          }
        })
      ].filter(Boolean),
      external: [
        // Exclude dependencies, e.g. `lodash`, `lodash/get`
        ...deps.map((dep) => new RegExp(`^${dep}($|\\/|\\\\)`)),
        ...options.external || []
      ]
    },
    outputConfig: options.format.map((format) => {
      const outputExtension = _optionalChain([options, 'access', _17 => _17.outExtension, 'optionalCall', _18 => _18({ format, options, pkgType: pkg.type }), 'access', _19 => _19.dts]) || _chunkGQ77QZBOjs.defaultOutExtension.call(void 0, { format, pkgType: pkg.type }).dts;
      return {
        dir: options.outDir || "dist",
        format: "esm",
        exports: "named",
        banner: dtsOptions.banner,
        footer: dtsOptions.footer,
        entryFileNames: `[name]${outputExtension}`,
        chunkFileNames: `[name]-[hash]${outputExtension}`,
        plugins: [
          format === "cjs" && options.cjsInterop && fixCjsExport
        ].filter(Boolean)
      };
    })
  };
};
async function runRollup(options) {
  const { rollup } = await Promise.resolve().then(() => require("rollup"));
  try {
    const start = Date.now();
    const getDuration = () => {
      return `${Math.floor(Date.now() - start)}ms`;
    };
    logger.info("dts", "Build start");
    const bundle = await rollup(options.inputConfig);
    const results = await Promise.all(options.outputConfig.map(bundle.write));
    const outputs = results.flatMap((result) => result.output);
    logger.success("dts", `\u26A1\uFE0F Build success in ${getDuration()}`);
    _chunk7G76EW2Rjs.reportSize.call(void 0, 
      logger,
      "dts",
      outputs.reduce((res, info) => {
        const name = _path2.default.relative(
          process.cwd(),
          _path2.default.join(options.outputConfig[0].dir || ".", info.fileName)
        );
        return {
          ...res,
          [name]: info.type === "chunk" ? info.code.length : info.source.length
        };
      }, {})
    );
  } catch (error) {
    _chunkUIX4URMVjs.handleError.call(void 0, error);
    logger.error("dts", "Build error");
  }
}
async function watchRollup(options) {
  const { watch } = await Promise.resolve().then(() => require("rollup"));
  watch({
    ...options.inputConfig,
    plugins: options.inputConfig.plugins,
    output: options.outputConfig
  }).on("event", (event) => {
    if (event.code === "START") {
      logger.info("dts", "Build start");
    } else if (event.code === "BUNDLE_END") {
      logger.success("dts", `\u26A1\uFE0F Build success in ${event.duration}ms`);
      _optionalChain([_worker_threads.parentPort, 'optionalAccess', _20 => _20.postMessage, 'call', _21 => _21("success")]);
    } else if (event.code === "ERROR") {
      logger.error("dts", "Build failed");
      _chunkUIX4URMVjs.handleError.call(void 0, event.error);
    }
  });
}
var startRollup = async (options) => {
  const config = await getRollupConfig(options);
  if (options.watch) {
    watchRollup(config);
  } else {
    try {
      await runRollup(config);
      _optionalChain([_worker_threads.parentPort, 'optionalAccess', _22 => _22.postMessage, 'call', _23 => _23("success")]);
    } catch (error) {
      _optionalChain([_worker_threads.parentPort, 'optionalAccess', _24 => _24.postMessage, 'call', _25 => _25("error")]);
    }
    _optionalChain([_worker_threads.parentPort, 'optionalAccess', _26 => _26.close, 'call', _27 => _27()]);
  }
};
_optionalChain([_worker_threads.parentPort, 'optionalAccess', _28 => _28.on, 'call', _29 => _29("message", (data) => {
  logger.setName(data.configName);
  const hasTypescript = _resolvefrom2.default.silent(process.cwd(), "typescript");
  if (!hasTypescript) {
    logger.error("dts", `You need to install "typescript" in your project`);
    _optionalChain([_worker_threads.parentPort, 'optionalAccess', _30 => _30.postMessage, 'call', _31 => _31("error")]);
    _optionalChain([_worker_threads.parentPort, 'optionalAccess', _32 => _32.close, 'call', _33 => _33()]);
    return;
  }
  startRollup(data.options);
})]);
