// The wrapper of the locale files of moment, among others.
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' && typeof require === 'function'
    ? factory(require('storybook/manager-api'))
    : typeof define === 'function' && define.amd
      ? define(['storybook/manager-api'], factory)
      : factory(global.managerApi);
})(this, function (api) {
  api.addons.register('umd-with-require', () => {});
});
