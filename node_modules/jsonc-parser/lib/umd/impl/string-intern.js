(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.supportedEols = exports.cachedBreakLinesWithSpaces = exports.cachedSpaces = void 0;
    exports.cachedSpaces = new Array(20).fill(0).map((_, index) => {
        return ' '.repeat(index);
    });
    const maxCachedValues = 200;
    exports.cachedBreakLinesWithSpaces = {
        ' ': {
            '\n': new Array(maxCachedValues).fill(0).map((_, index) => {
                return '\n' + ' '.repeat(index);
            }),
            '\r': new Array(maxCachedValues).fill(0).map((_, index) => {
                return '\r' + ' '.repeat(index);
            }),
            '\r\n': new Array(maxCachedValues).fill(0).map((_, index) => {
                return '\r\n' + ' '.repeat(index);
            }),
        },
        '\t': {
            '\n': new Array(maxCachedValues).fill(0).map((_, index) => {
                return '\n' + '\t'.repeat(index);
            }),
            '\r': new Array(maxCachedValues).fill(0).map((_, index) => {
                return '\r' + '\t'.repeat(index);
            }),
            '\r\n': new Array(maxCachedValues).fill(0).map((_, index) => {
                return '\r\n' + '\t'.repeat(index);
            }),
        }
    };
    exports.supportedEols = ['\n', '\r', '\r\n'];
});
