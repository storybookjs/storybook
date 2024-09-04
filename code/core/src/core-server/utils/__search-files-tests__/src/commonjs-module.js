// named exports detection
module.exports.a = 'a';

(function () {
  exports.b = 'b';
})();

Object.defineProperty(exports, 'c', { value: 'c' });
/* exports.d = 'not detected'; */

// reexports detection
if (maybe) module.exports = require('./dep1.js');
if (another) module.exports = require('./dep2.js');

// literal exports assignments
module.exports = { a, b: c, d, e: f };

// __esModule detection
Object.defineProperty(module.exports, '__esModule', { value: true });
