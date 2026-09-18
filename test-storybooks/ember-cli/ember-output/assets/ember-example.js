'use strict';



;define("ember-example/app", ["exports", "ember-load-initializers", "ember-example/resolver", "ember-example/config/environment"], function (_exports, _emberLoadInitializers, _resolver, _environment) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.default = void 0;
  var App = Ember.Application.extend({
    modulePrefix: _environment.default.modulePrefix,
    podModulePrefix: _environment.default.podModulePrefix,
    Resolver: _resolver.default
  });
  (0, _emberLoadInitializers.default)(App, _environment.default.modulePrefix);
  var _default = App;
  _exports.default = _default;
});
;define("ember-example/components/welcome-banner", ["exports"], function (_exports) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.default = void 0;
  /**
   *
   * `WelcomeBanner` renders a friendly message and is used to welcome Ember.js users when they first generate an application.
   *
   *
   * ```js
   * {{welcome-banner
   *   backgroundColor=backgroundColor
   *   titleColor=titleColor
   *   subTitleColor=subTitleColor
   *   title=title
   *   subtitle=subtitle
   *   click=(action onClick)
   * }}
   * ```
   *
   * @class WelcomeBanner
   */
  var _default = Ember.Component.extend({
    /**
     * The hex-formatted color code for the background.
     * @argument backgroundColor
     * @type {string}
     * @default null
     */
    backgroundColor: null,
    /**
     * The hex-formatted color code for the subtitle.
     * @argument subTitleColor
     * @type {string}
     */
    subTitleColor: null,
    /**
     * The title of the banner.
     * @argument title
     * @type {string}
     */
    title: null,
    /**
     * The subtitle of the banner.
     * @argument subtitle
     * @type {string}
     */
    subtitle: null
  });
  _exports.default = _default;
});
;define("ember-example/components/welcome-page", ["exports"], function (_exports) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.default = void 0;
  var _default = Ember.Component.extend({});
  _exports.default = _default;
});
;define("ember-example/helpers/-has-block-params", ["exports", "ember-named-blocks-polyfill/helpers/-has-block-params"], function (_exports, _hasBlockParams) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  Object.defineProperty(_exports, "default", {
    enumerable: true,
    get: function get() {
      return _hasBlockParams.default;
    }
  });
});
;define("ember-example/helpers/-has-block", ["exports", "ember-named-blocks-polyfill/helpers/-has-block"], function (_exports, _hasBlock) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  Object.defineProperty(_exports, "default", {
    enumerable: true,
    get: function get() {
      return _hasBlock.default;
    }
  });
});
;define("ember-example/helpers/-is-named-block-invocation", ["exports", "ember-named-blocks-polyfill/helpers/-is-named-block-invocation"], function (_exports, _isNamedBlockInvocation) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  Object.defineProperty(_exports, "default", {
    enumerable: true,
    get: function get() {
      return _isNamedBlockInvocation.default;
    }
  });
});
;define("ember-example/helpers/-named-block-invocation", ["exports", "ember-named-blocks-polyfill/helpers/-named-block-invocation"], function (_exports, _namedBlockInvocation) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  Object.defineProperty(_exports, "default", {
    enumerable: true,
    get: function get() {
      return _namedBlockInvocation.default;
    }
  });
});
;define("ember-example/helpers/app-version", ["exports", "ember-example/config/environment", "ember-cli-app-version/utils/regexp"], function (_exports, _environment, _regexp) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.appVersion = appVersion;
  _exports.default = void 0;
  function appVersion(_) {
    var hash = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    var version = _environment.default.APP.version;
    // e.g. 1.0.0-alpha.1+4jds75hf

    // Allow use of 'hideSha' and 'hideVersion' For backwards compatibility
    var versionOnly = hash.versionOnly || hash.hideSha;
    var shaOnly = hash.shaOnly || hash.hideVersion;
    var match = null;
    if (versionOnly) {
      if (hash.showExtended) {
        match = version.match(_regexp.versionExtendedRegExp); // 1.0.0-alpha.1
      }
      // Fallback to just version
      if (!match) {
        match = version.match(_regexp.versionRegExp); // 1.0.0
      }
    }

    if (shaOnly) {
      match = version.match(_regexp.shaRegExp); // 4jds75hf
    }

    return match ? match[0] : version;
  }
  var _default = Ember.Helper.helper(appVersion);
  _exports.default = _default;
});
;define("ember-example/initializers/app-version", ["exports", "ember-cli-app-version/initializer-factory", "ember-example/config/environment"], function (_exports, _initializerFactory, _environment) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.default = void 0;
  var name, version;
  if (_environment.default.APP) {
    name = _environment.default.APP.name;
    version = _environment.default.APP.version;
  }
  var _default = {
    name: 'App Version',
    initialize: (0, _initializerFactory.default)(name, version)
  };
  _exports.default = _default;
});
;define("ember-example/initializers/container-debug-adapter", ["exports", "ember-resolver/resolvers/classic/container-debug-adapter"], function (_exports, _containerDebugAdapter) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.default = void 0;
  var _default = {
    name: 'container-debug-adapter',
    initialize: function initialize() {
      var app = arguments[1] || arguments[0];
      app.register('container-debug-adapter:main', _containerDebugAdapter.default);
      app.inject('container-debug-adapter:main', 'namespace', 'application:main');
    }
  };
  _exports.default = _default;
});
;define("ember-example/resolver", ["exports", "ember-resolver"], function (_exports, _emberResolver) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  Object.defineProperty(_exports, "default", {
    enumerable: true,
    get: function get() {
      return _emberResolver.default;
    }
  });
});
;define("ember-example/router", ["exports", "ember-example/config/environment"], function (_exports, _environment) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.default = void 0;
  var Router = Ember.Router.extend({
    location: _environment.default.locationType,
    rootURL: _environment.default.rootURL
  });
  Router.map(function () {
    return {};
  });
  var _default = Router;
  _exports.default = _default;
});
;define("ember-example/services/ajax", ["exports", "ember-ajax/services/ajax"], function (_exports, _ajax) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  Object.defineProperty(_exports, "default", {
    enumerable: true,
    get: function get() {
      return _ajax.default;
    }
  });
});
;define("ember-example/templates/application", ["exports"], function (_exports) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.default = void 0;
  var _default = Ember.HTMLBars.template({
    "id": "usNxVfQ3",
    "block": "{\"symbols\":[],\"statements\":[[1,[34,0]],[2,\"\\n\\n\"],[1,[30,[36,2],[[30,[36,1],null,null]],null]],[2,\"\\n\"]],\"hasEval\":false,\"upvars\":[\"welcome-page\",\"-outlet\",\"component\"]}",
    "moduleName": "ember-example/templates/application.hbs"
  });
  _exports.default = _default;
});
;define("ember-example/templates/components/named-block", ["exports"], function (_exports) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.default = void 0;
  var _default = Ember.HTMLBars.template({
    "id": "0sKgxZrM",
    "block": "{\"symbols\":[\"&default\"],\"statements\":[[10,\"div\"],[12],[2,\"\\n    \"],[10,\"h1\"],[12],[18,1,[[30,[36,0],[\"title\"],null]]],[13],[2,\"\\n    \"],[10,\"div\"],[12],[18,1,[[30,[36,0],[\"body\"],null]]],[13],[2,\"\\n\"],[13],[2,\"\\n\"]],\"hasEval\":false,\"upvars\":[\"-named-block-invocation\"]}",
    "moduleName": "ember-example/templates/components/named-block.hbs"
  });
  _exports.default = _default;
});
;define("ember-example/templates/components/welcome-banner", ["exports"], function (_exports) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.default = void 0;
  var _default = Ember.HTMLBars.template({
    "id": "cwg4EJtd",
    "block": "{\"symbols\":[],\"statements\":[[10,\"div\"],[14,0,\"banner\"],[15,5,[31,[\"background-color:\",[34,1],\";\",[34,0]]]],[12],[2,\"\\n  \"],[10,\"h1\"],[14,0,\"banner-header\"],[15,5,[31,[\"color:\",[34,2],\";\"]]],[12],[1,[34,3]],[13],[2,\"\\n  \"],[10,\"p\"],[14,0,\"banner-subtitle\"],[15,5,[31,[\"color:\",[34,4]]]],[12],[2,\"\\n    \"],[1,[34,5]],[2,\"\\n  \"],[13],[2,\"\\n\"],[13],[2,\"\\n\"]],\"hasEval\":false,\"upvars\":[\"style\",\"backgroundColor\",\"titleColor\",\"title\",\"subTitleColor\",\"subtitle\"]}",
    "moduleName": "ember-example/templates/components/welcome-banner.hbs"
  });
  _exports.default = _default;
});
;define("ember-example/templates/components/welcome-page", ["exports"], function (_exports) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.default = void 0;
  var _default = Ember.HTMLBars.template({
    "id": "Mm/Msqwa",
    "block": "{\"symbols\":[],\"statements\":[[10,\"div\"],[14,0,\"main\"],[12],[2,\"\\n  \"],[10,\"p\"],[14,0,\"text-align-center\"],[12],[2,\"\\n    \"],[10,\"img\"],[14,0,\"logo\"],[14,\"src\",\"./logo.png\"],[12],[13],[2,\"\\n  \"],[13],[2,\"\\n  \"],[10,\"p\"],[12],[2,\"\\n    We've added some basic stories inside the\\n    \"],[10,\"code\"],[14,0,\"code\"],[12],[2,\"stories\"],[13],[2,\"\\n    directory.\\n    \"],[10,\"br\"],[12],[13],[2,\"\\n    A story is a single state of one or more UI components.\\n    You can have as many stories as you want.\\n    \"],[10,\"br\"],[12],[13],[2,\"\\n    (Basically a story is like a visual test case.)\\n  \"],[13],[2,\"\\n  \"],[10,\"p\"],[12],[2,\"\\n    See these sample\\n    \"],[10,\"a\"],[14,0,\"link\"],[12],[2,\"stories\"],[13],[2,\"\\n    for a component called\\n    \"],[10,\"code\"],[14,0,\"code\"],[12],[2,\"welcome-banner\"],[13],[2,\"\\n    .\\n  \"],[13],[2,\"\\n  \"],[10,\"p\"],[12],[2,\"\\n    Just like that, you can add your own components as stories.\\n    \"],[10,\"br\"],[12],[13],[2,\"\\n    You can also edit those components and see changes right away.\\n    \"],[10,\"br\"],[12],[13],[2,\"\\n    (Try editing the \"],[10,\"code\"],[14,0,\"code\"],[12],[2,\"welcome-banner\"],[13],[2,\" component\\n    located at \"],[10,\"code\"],[14,0,\"code\"],[12],[2,\"app/components/welcome-banner.js\"],[13],[2,\".)\\n  \"],[13],[2,\"\\n  \"],[10,\"p\"],[12],[2,\"\\n    Usually we create stories with smaller UI components in the app.\"],[10,\"br\"],[12],[13],[2,\"\\n    Have a look at the\\n    \"],[10,\"a\"],[14,0,\"link\"],[14,6,\"https://storybook.js.org/basics/writing-stories\"],[14,\"target\",\"_blank\"],[12],[2,\"\\n      Writing Stories\\n    \"],[13],[2,\"\\n    section in our documentation.\\n  \"],[13],[2,\"\\n  \"],[10,\"p\"],[14,0,\"note\"],[12],[2,\"\\n    \"],[10,\"b\"],[12],[2,\"NOTE:\"],[13],[2,\"\\n    \"],[10,\"br\"],[12],[13],[2,\"\\n    Have a look at the\\n    \"],[10,\"code\"],[14,0,\"code\"],[12],[2,\".storybook/webpack.config.js\"],[13],[2,\"\\n    to add webpack\\n    loaders and plugins you are using in this project.\\n  \"],[13],[2,\"\\n\"],[13],[2,\"\\n\"]],\"hasEval\":false,\"upvars\":[]}",
    "moduleName": "ember-example/templates/components/welcome-page.hbs"
  });
  _exports.default = _default;
});
;

;define('ember-example/config/environment', [], function() {
  var prefix = 'ember-example';
try {
  var metaName = prefix + '/config/environment';
  var rawConfig = document.querySelector('meta[name="' + metaName + '"]').getAttribute('content');
  var config = JSON.parse(decodeURIComponent(rawConfig));

  var exports = { 'default': config };

  Object.defineProperty(exports, '__esModule', { value: true });

  return exports;
}
catch(err) {
  throw new Error('Could not read config from meta tag with name "' + metaName + '".');
}

});

;
          if (!runningTests) {
            require("ember-example/app")["default"].create({"name":"ember-example","version":"7.0.0-alpha.42+f020a9b6"});
          }
        
//# sourceMappingURL=ember-example.map
