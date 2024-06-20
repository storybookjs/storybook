"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { newObj[key] = obj[key]; } } } newObj.default = obj; return newObj; } }

var _chunkGQ77QZBOjs = require('./chunk-GQ77QZBO.js');

// src/errors.ts
var _worker_threads = require('worker_threads');

// node_modules/.pnpm/colorette@2.0.16/node_modules/colorette/index.js
var colorette_exports = {};
_chunkGQ77QZBOjs.__export.call(void 0, colorette_exports, {
  bgBlack: () => bgBlack,
  bgBlackBright: () => bgBlackBright,
  bgBlue: () => bgBlue,
  bgBlueBright: () => bgBlueBright,
  bgCyan: () => bgCyan,
  bgCyanBright: () => bgCyanBright,
  bgGreen: () => bgGreen,
  bgGreenBright: () => bgGreenBright,
  bgMagenta: () => bgMagenta,
  bgMagentaBright: () => bgMagentaBright,
  bgRed: () => bgRed,
  bgRedBright: () => bgRedBright,
  bgWhite: () => bgWhite,
  bgWhiteBright: () => bgWhiteBright,
  bgYellow: () => bgYellow,
  bgYellowBright: () => bgYellowBright,
  black: () => black,
  blackBright: () => blackBright,
  blue: () => blue,
  blueBright: () => blueBright,
  bold: () => bold,
  createColors: () => createColors,
  cyan: () => cyan,
  cyanBright: () => cyanBright,
  dim: () => dim,
  gray: () => gray,
  green: () => green,
  greenBright: () => greenBright,
  hidden: () => hidden,
  inverse: () => inverse,
  isColorSupported: () => isColorSupported,
  italic: () => italic,
  magenta: () => magenta,
  magentaBright: () => magentaBright,
  red: () => red,
  redBright: () => redBright,
  reset: () => reset,
  strikethrough: () => strikethrough,
  underline: () => underline,
  white: () => white,
  whiteBright: () => whiteBright,
  yellow: () => yellow,
  yellowBright: () => yellowBright
});
var _tty = require('tty'); var tty = _interopRequireWildcard(_tty);
var env = process.env || {};
var argv = process.argv || [];
var isDisabled = "NO_COLOR" in env || argv.includes("--no-color");
var isForced = "FORCE_COLOR" in env || argv.includes("--color");
var isWindows = process.platform === "win32";
var isCompatibleTerminal = tty && tty.isatty && tty.isatty(1) && env.TERM && env.TERM !== "dumb";
var isCI = "CI" in env && ("GITHUB_ACTIONS" in env || "GITLAB_CI" in env || "CIRCLECI" in env);
var isColorSupported = !isDisabled && (isForced || isWindows || isCompatibleTerminal || isCI);
var replaceClose = (index, string, close, replace, head = string.substring(0, index) + replace, tail = string.substring(index + close.length), next = tail.indexOf(close)) => head + (next < 0 ? tail : replaceClose(next, tail, close, replace));
var clearBleed = (index, string, open, close, replace) => index < 0 ? open + string + close : open + replaceClose(index, string, close, replace) + close;
var filterEmpty = (open, close, replace = open, at = open.length + 1) => (string) => string || !(string === "" || string === void 0) ? clearBleed(
  ("" + string).indexOf(close, at),
  string,
  open,
  close,
  replace
) : "";
var init = (open, close, replace) => filterEmpty(`\x1B[${open}m`, `\x1B[${close}m`, replace);
var colors = {
  reset: init(0, 0),
  bold: init(1, 22, "\x1B[22m\x1B[1m"),
  dim: init(2, 22, "\x1B[22m\x1B[2m"),
  italic: init(3, 23),
  underline: init(4, 24),
  inverse: init(7, 27),
  hidden: init(8, 28),
  strikethrough: init(9, 29),
  black: init(30, 39),
  red: init(31, 39),
  green: init(32, 39),
  yellow: init(33, 39),
  blue: init(34, 39),
  magenta: init(35, 39),
  cyan: init(36, 39),
  white: init(37, 39),
  gray: init(90, 39),
  bgBlack: init(40, 49),
  bgRed: init(41, 49),
  bgGreen: init(42, 49),
  bgYellow: init(43, 49),
  bgBlue: init(44, 49),
  bgMagenta: init(45, 49),
  bgCyan: init(46, 49),
  bgWhite: init(47, 49),
  blackBright: init(90, 39),
  redBright: init(91, 39),
  greenBright: init(92, 39),
  yellowBright: init(93, 39),
  blueBright: init(94, 39),
  magentaBright: init(95, 39),
  cyanBright: init(96, 39),
  whiteBright: init(97, 39),
  bgBlackBright: init(100, 49),
  bgRedBright: init(101, 49),
  bgGreenBright: init(102, 49),
  bgYellowBright: init(103, 49),
  bgBlueBright: init(104, 49),
  bgMagentaBright: init(105, 49),
  bgCyanBright: init(106, 49),
  bgWhiteBright: init(107, 49)
};
var none = (any) => any;
var createColors = ({ useColor = isColorSupported } = {}) => useColor ? colors : Object.keys(colors).reduce(
  (colors2, key) => ({ ...colors2, [key]: none }),
  {}
);
var {
  reset,
  bold,
  dim,
  italic,
  underline,
  inverse,
  hidden,
  strikethrough,
  black,
  red,
  green,
  yellow,
  blue,
  magenta,
  cyan,
  white,
  gray,
  bgBlack,
  bgRed,
  bgGreen,
  bgYellow,
  bgBlue,
  bgMagenta,
  bgCyan,
  bgWhite,
  blackBright,
  redBright,
  greenBright,
  yellowBright,
  blueBright,
  magentaBright,
  cyanBright,
  whiteBright,
  bgBlackBright,
  bgRedBright,
  bgGreenBright,
  bgYellowBright,
  bgBlueBright,
  bgMagentaBright,
  bgCyanBright,
  bgWhiteBright
} = createColors();

// src/errors.ts
var PrettyError = class extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, this.constructor);
    } else {
      this.stack = new Error(message).stack;
    }
  }
};
function handleError(error) {
  if (error.loc) {
    console.error(
      bold(
        red(
          `Error parsing: ${error.loc.file}:${error.loc.line}:${error.loc.column}`
        )
      )
    );
  }
  if (error.frame) {
    console.error(red(error.message));
    console.error(dim(error.frame));
  } else {
    if (error instanceof PrettyError) {
      console.error(red(error.message));
    } else {
      console.error(red(error.stack));
    }
  }
  process.exitCode = 1;
  if (!_worker_threads.isMainThread && _worker_threads.parentPort) {
    _worker_threads.parentPort.postMessage("error");
  }
}








exports.bold = bold; exports.dim = dim; exports.green = green; exports.colorette_exports = colorette_exports; exports.PrettyError = PrettyError; exports.handleError = handleError;
