Warning: truncated output (original token count: 104743)
Total output lines: 9026

<h1>Migration</h1>

- [From version 10.x to 11.0.0](#from-version-10x-to-1100)
  - [`storybook dev` now blocks remote iframe embedding](#storybook-dev-now-blocks-remote-iframe-embedding)
  - [Storybook now restricts iframe messaging](#storybook-now-restricts-iframe-messaging)
  - [Legacy highlight object format removed](#legacy-highlight-object-format-removed)
  - [Tag filtering API](#tag-filtering-api)
  - [Addon `TAB` registration removed](#addon-tab-registration-removed)
  - [`storybook dev` no longer opens a browser by default](#storybook-dev-no-longer-opens-a-browser-by-default)
  - [`viewport.defaultViewport` parameter and `responsiveViewport` removed](#viewportdefaultviewport-parameter-and-responsiveviewport-removed)
  - [`parameters.componentSubtitle` removed](#parameterscomponentsubtitle-removed)
  - [`argTypes` `defaultValue` removed](#argtypes-defaultvalue-removed)
  - [Docs Code panel enabled by default](#docs-code-panel-enabled-by-default)
  - [`argTypes` removed from loaders, `beforeEach`, `play` and `afterEach`](#argtypes-removed-from-loaders-beforeeach-play-and-aftereach)
  - [`docgenServer` is stable and enabled by default](#docgenserver-is-stable-and-enabled-by-default)
  - [Builder docgen is deprecated](#builder-docgen-is-deprecated)
  - [Node.js 22.12 or higher](#nodejs-2212-or-higher)
  - [TypeScript 5.9 or 6.x](#typescript-59-or-6x)
  - [CSF Next: meta args no longer need `as const`](#csf-next-meta-args-no-longer-need-as-const)
  - [CSF Next: use `mocked()` for the mock API on args](#csf-next-use-mocked-for-the-mock-api-on-args)
  - [CSF Next: every key in meta args must be an arg](#csf-next-every-key-in-meta-args-must-be-an-arg)
  - [Yarn PnP support removed](#yarn-pnp-support-removed)
  - [Raised browser support floors](#raised-browser-support-floors)
  - [Top-level `setConfig` layout and UI options removed](#top-level-setconfig-layout-and-ui-options-removed)
  - [Sidebar label rendering: renderAriaLabel and a context argument](#sidebar-label-rendering-renderarialabel-and-a-context-argument)
  - [Escape is no longer a configurable shortcut](#escape-is-no-longer-a-configurable-shortcut)
  - ['Create new story' UI feature removed](#create-new-story-ui-feature-removed)
  - [Test runner support ended](#test-runner-support-ended)
  - [Vitest Addon: requires Vitest 4.0 or higher](#vitest-addon-requires-vitest-40-or-higher)
  - [Vitest Addon: `setProjectAnnotations` must not be called in setup files](#vitest-addon-setprojectannotations-must-not-be-called-in-setup-files)
  - [Vite: `publicDir` is handled by Storybook's `staticDirs`](#vite-publicdir-is-handled-by-storybooks-staticdirs)
  - [Vite: requires Vite 6.3 or higher](#vite-requires-vite-63-or-higher)
  - [Next.js: Require v15 and up](#nextjs-require-v15-and-up)
  - [Next.js: most Node.js built-in polyfills removed from `@storybook/nextjs`](#nextjs-most-nodejs-built-in-polyfills-removed-from-storybooknextjs)
  - [`storySort` in the preview replaced by `storySorts` in main](#storysort-in-the-preview-replaced-by-storysorts-in-main)
  - [Angular: requires Angular 21 or higher](#angular-requires-angular-21-or-higher)
  - [Next.js: `@storybook/nextjs` is deprecated](#nextjs-storybooknextjs-is-deprecated)
  - [Create React App support removed](#create-react-app-support-removed)
  - [`@storybook/angular-vite`: legacy animation modules are no longer auto-converted](#storybookangular-vite-legacy-animation-modules-are-no-longer-auto-converted)
  - [Internal CSF tools use the unified mutation API](#internal-csf-tools-use-the-unified-mutation-api)
  - [Internal WebSocket heartbeat controls removed](#internal-websocket-heartbeat-controls-removed)
  - [Internal toolset telemetry now returns with the outcome](#internal-toolset-telemetry-now-returns-with-the-outcome)
  - [Internal toolset inputs must be strict objects](#internal-toolset-inputs-must-be-strict-objects)
  - [Internal `satisfies` helper removed](#internal-satisfies-helper-removed)
  - [Experimental `UniversalStore` API is now internal](#experimental-universalstore-api-is-now-internal)
  - [React: Require v18 and up](#react-require-v18-and-up)
  - [`@storybook/react-dom-shim` removed](#storybookreact-dom-shim-removed)
  - [Preact: Require v10.8.0 and up](#preact-require-v1080-and-up)
  - [`features.legacyDecoratorFileOrder` removed](#featureslegacydecoratorfileorder-removed)
  - [`experimentalReview` feature flag removed](#experimentalreview-feature-flag-removed)
  - [`changeDetection` feature flag removed](#changedetection-feature-flag-removed)
  - [`storybook ai` command removed](#storybook-ai-command-removed)
  - [`--preview-url` and `--force-build-preview` removed](#--preview-url-and---force-build-preview-removed)
  - [Automigrations for Storybook 10 and earlier removed](#automigrations-for-storybook-10-and-earlier-removed)
  - [Web Components: server-side docgen suffixes event, slot and part argType keys](#web-components-server-side-docgen-suffixes-event-slot-and-part-argtype-keys)
  - [Web Components: the default render binds args by key](#web-components-the-default-render-binds-args-by-key)
  - [SvelteKit: Require v3 and up](#sveltekit-require-v3-and-up)
  - [Svelte CSF is built into the Svelte frameworks](#svelte-csf-is-built-into-the-svelte-frameworks)
  - [Svelte CSF: legacy story syntax removed](#svelte-csf-legacy-story-syntax-removed)
    - [`<Meta>` component](#meta-component)
    - [`export const meta`](#export-const-meta)
    - [`let:args` and `let:context`](#letargs-and-letcontext)
    - [`<Template>` component](#template-component)
    - [`id`, `autodocs` and `source` props on `<Story>`](#id-autodocs-and-source-props-on-story)
  - [Svelte CSF: stories files are indexed without preprocessors](#svelte-csf-stories-files-are-indexed-without-preprocessors)
  - [Highlight: menu items emit a fixed `HIGHLIGHT_MENU_CLICK` event with a mandatory `id`](#highlight-menu-items-emit-a-fixed-highlight_menu_click-event-with-a-mandatory-id)
  - [`core/module-graph` query aliases removed](#coremodule-graph-query-aliases-removed)
- [From version 10.6.1 to 10.6.2](#from-version-1061-to-1062)
  - [`storybook dev` now blocks remote iframe embedding](#storybook-dev-now-blocks-remote-iframe-embedding-1)
  - [Storybook now restricts iframe messaging](#storybook-now-restricts-iframe-messaging-1)
  - [Highlight: menu items emit a fixed event and require an `id`](#highlight-menu-items-emit-a-fixed-event-and-require-an-id)
- [From version 10.5.x to 10.6.0](#from-version-105x-to-1060)
  - [Vue 3: `vue-docgen-api` is deprecated](#vue-3-vue-docgen-api-is-deprecated)
  - [Angular Vite: a new `propsTable` framework option](#angular-vite-a-new-propstable-framework-option)
  - [MCP tool names follow toolset.method](#mcp-tool-names-follow-toolsetmethod)
  - [Angular Vite defaults to server-side docgen](#angular-vite-defaults-to-server-side-docgen)
  - [Angular Vite: tsconfig paths now take priority over `node_modules` in production builds too](#angular-vite-tsconfig-paths-now-take-priority-over-node_modules-in-production-builds-too)
  - [Experimental Playwright CT integration removed](#experimental-playwright-ct-integration-removed)
  - [`@storybook/csf-plugin` removed](#storybookcsf-plugin-removed)
- [From version 10.4.0 to 10.5.0](#from-version-1040-to-1050)
  - [ExternalDocs and ExternalDocsContainer are deprecated](#externaldocs-and-externaldocscontainer-are-deprecated)
- [From version 10.3.0 to 10.4.0](#from-version-1030-to-1040)
  - [React Native: on-device addons moved to `deviceAddons`](#react-native-on-device-addons-moved-to-deviceaddons)
  - [TanStack Router projects: migrate from `@storybook/react-vite` to `@storybook/tanstack-react`](#tanstack-router-projects-migrate-from-storybookreact-vite-to-storybooktanstack-react)
- [From version 10.0.0 to 10.1.0](#from-version-1000-to-1010)
  - [API and Component Changes](#api-and-component-changes)
    - [Button Component API Changes](#button-component-api-changes)
      - [Added: ariaLabel](#added-arialabel)
      - [Added: shortcut](#added-shortcut)
      - [Added: tooltip](#added-tooltip)
      - [Deprecated: active](#deprecated-active)
    - [IconButton is deprecated](#iconbutton-is-deprecated)
    - [Bar Component API Changes](#bar-component-api-changes)
      - [Added: innerStyle](#added-innerstyle)
    - [FlexBar is deprecated](#flexbar-is-deprecated)
    - [Tabs is deprecated](#tabs-is-deprecated)
    - [TabsState is deprecated](#tabsstate-is-deprecated)
    - [TabWrapper is deprecated](#tabwrapper-is-deprecated)
    - [TabButton is deprecated](#tabbutton-is-deprecated)
    - [TabBar is deprecated](#tabbar-is-deprecated)
    - [Modal Component API Changes](#modal-component-api-changes)
      - [Deprecated: onInteractOutside](#deprecated-oninteractoutside)
      - [Deprecated: onEscapeKeyDown](#deprecated-onescapekeydown)
      - [Added: `ariaLabel`](#added-arialabel-1)
      - [Renamed: Modal.Dialog.Close and Modal.CloseButton](#renamed-modaldialogclose-and-modalclosebutton)
    - [ListItem, TooltipLinkList and TooltipMessage are deprecated](#listitem-tooltiplinklist-and-tooltipmessage-are-deprecated)
    - [PopoverProvider Component Added](#popoverprovider-component-added)
      - [Added: ariaLabel](#added-arialabel-2)
    - [WithTooltip Component API Changes](#withtooltip-component-api-changes)
      - [Removed: trigger](#removed-trigger)
    - [Added: triggerOnFocusOnly](#added-triggeronfocusonly)
    - [Renamed: startOpen](#renamed-startopen)
    - [Removed: svg, strategy, withArrows, mutationObserverOptions](#removed-svg-strategy-witharrows-mutationobserveroptions)
    - [Removed: hasChrome](#removed-haschrome)
    - [Removed: closeOnTriggerHidden, followCursor, closeOnOutsideClick](#removed-closeontriggerhidden-followcursor-closeonoutsideclick)
    - [Removed: interactive](#removed-interactive)
      - [Other changes](#other-changes)
    - [WithTooltipPure and WithTooltipState are deprecated](#withtooltippure-and-withtooltipstate-are-deprecated)
    - [Link isButton is deprecated](#link-isbutton-is-deprecated)
- [From version 9.x to 10.0.0](#from-version-9x-to-1000)
  - [Core Changes](#core-changes)
    - [Local addons must be fully resolved](#local-addons-must-be-fully-resolved)
    - [The `.storybook/main.*` file and other presets must be valid ESM](#the-storybookmain-file-and-other-presets-must-be-valid-esm)
    - [Node.js 20.19+ or 22.12+ required](#nodejs-2019-or-2212-required)
    - [Require `tsconfig.json` `moduleResolution` set to value that supports `types` condition](#require-tsconfigjson-moduleresolution-set-to-value-that-supports-types-condition)
    - [`core.builder` configuration must be a fully resolved path](#corebuilder-configuration-must-be-a-fully-resolved-path)
    - [Removed x-only builtin tags](#removed-x-only-builtin-tags)
- [From version 9.1.20 to 9.1.21](#from-version-9120-to-9121)
  - [`storybook dev` now blocks remote iframe embedding](#storybook-dev-now-blocks-remote-iframe-embedding-2)
  - [Storybook now restricts iframe messaging](#storybook-now-restricts-iframe-messaging-2)
  - [Highlight: menu items emit a fixed event and require an `id`](#highlight-menu-items-emit-a-fixed-event-and-require-an-id-1)
- [From version 8.x to 9.0.0](#from-version-8x-to-900)
  - [Core Changes and Removals](#core-changes-and-removals)
    - [Dropped support for legacy packages](#dropped-support-for-legacy-packages)
    - [Dropped support](#dropped-support)
      - [Vite 4](#vite-4)
      - [TypeScript \< 4.9](#typescript--49)
      - [Node.js \< 20](#nodejs--20)
      - [Package Managers](#package-managers)
    - [Moving from renderer-based to framework-based configuration](#moving-from-renderer-based-to-framework-based-configuration)
  - [Addon-specific Changes](#addon-specific-changes)
    - [Essentials Addon: Viewport, Controls, Interactions and Actions moved to core](#essentials-addon-viewport-controls-interactions-and-actions-moved-to-core)
    - [A11y Addon: Removed deprecated manual parameter](#a11y-addon-removed-deprecated-manual-parameter)
    - [A11y Addon: Replace `element` parameter with `context` parameter](#a11y-addon-replace-element-parameter-with-context-parameter)
    - [Experimental Test Addon: Stabilized and renamed](#experimental-test-addon-stabilized-and-renamed)
    - [Vitest Addon (former @storybook/experimental-addon-test): Vitest 2.0 support is dropped](#vitest-addon-former-storybookexperimental-addon-test-vitest-20-support-is-dropped)
    - [Viewport/Backgrounds Addon synchronized configuration and `globals` usage](#viewportbackgrounds-addon-synchronized-configuration-and-globals-usage)
    - [Storysource Addon removed](#storysource-addon-removed)
    - [Mdx-gfm Addon removed](#mdx-gfm-addon-removed)
  - [API and Component Changes](#api-and-component-changes-1)
    - [Button Component API Changes](#button-component-api-changes-1)
    - [Icon System Updates](#icon-system-updates)
    - [Sidebar Component Changes](#sidebar-component-changes)
    - [Story Store API Changes](#story-store-api-changes)
    - [Global State Management](#global-state-management)
    - [Experimental Status API has turned into a Status Store](#experimental-status-api-has-turned-into-a-status-store)
    - [`experimental_afterEach` has been stabilized](#experimental_aftereach-has-been-stabilized)
    - [Testing Module Changes](#testing-module-changes)
    - [Consolidate `@storybook/blocks` into addon docs](#consolidate-storybookblocks-into-addon-docs)
  - [Configuration and Type Changes](#configuration-and-type-changes)
    - [Manager builder removed alias for `util`, `assert` and `process`](#manager-builder-removed-alias-for-util-assert-and-process)
    - [Type System Updates](#type-system-updates)
    - [CSF File Changes](#csf-file-changes)
    - [React-Native config dir renamed](#react-native-config-dir-renamed)
    - [`parameters.docs.source.format` removal](#parametersdocssourceformat-removal)
    - [`parameter docs.source.excludeDecorators` has no effect in React](#parameter-docssourceexcludedecorators-has-no-effect-in-react)
    - [Documentation Generation Changes](#documentation-generation-changes)
  - [Framework-specific changes](#framework-specific-changes)
    - [Svelte: Require v5 and up](#svelte-require-v5-and-up)
    - [Svelte: Dropped support for @storybook/svelte-webpack5](#svelte-dropped-support-for-storybooksvelte-webpack5)
    - [Svelte: Dropped automatic docgen for events and slots](#svelte-dropped-automatic-docgen-for-events-and-slots)
    - [Angular: Require v18 and up](#angular-require-v18-and-up)
    - [Angular: Introduce `features.angularFilterNonInputControls`](#angular-introduce-featuresangularfilternoninputcontrols)
    - [Dropped webpack5 Builder Support in Favor of Vite](#dropped-webpack5-builder-support-in-favor-of-vite)
    - [Next.js: Require v14 and up](#nextjs-require-v14-and-up)
    - [Next.js: Vite builder stabilized](#nextjs-vite-builder-stabilized)
    - [Lit = Require v3 and up](#lit--require-v3-and-up)
- [From version 8.6.18 to 8.6.19](#from-version-8618-to-8619)
  - [`storybook dev` now blocks remote iframe embedding](#storybook-dev-now-blocks-remote-iframe-embedding-3)
  - [Storybook now restricts iframe messaging](#storybook-now-restricts-iframe-messaging-3)
  - [Highlight: menu items emit a fixed event and require an `id`](#highlight-menu-items-emit-a-fixed-event-and-require-an-id-2)
- [From version 8.5.x to 8.6.x](#from-version-85x-to-86x)
  - [Angular: Support experimental zoneless support](#angular-support-experimental-zoneless-support)
  - [Addon-a11y: Replaced experimental `ally-test` tag behavior with `parameters.a11y.test`](#addon-a11y-replaced-experimental-ally-test-tag-behavior-with-parametersa11ytest)
- [From version 8.4.x to 8.5.x](#from-version-84x-to-85x)
  - [React Vite: react-docgen-typescript is updated](#react-vite-react-docgen-typescript-is-updated)
  - [Introducing features.developmentModeForBuild](#introducing-featuresdevelopmentmodeforbuild)
  - [Added source code panel to docs](#added-source-code-panel-to-docs)
  - [Addon-a11y: Component test integration](#addon-a11y-component-test-integration)
  - [Addon-a11y: Changing the default element selector](#addon-a11y-changing-the-default-element-selector)
  - [Addon-a11y: Deprecated `parameters.a11y.manual`](#addon-a11y-deprecated-parametersa11ymanual)
  - [Addon-test: You should no longer copy the content of `viteFinal` to your configuration](#addon-test-you-should-no-longer-copy-the-content-of-vitefinal-to-your-configuration)
  - [Addon-test: Indexing behavior of @storybook/experimental-addon-test is changed](#addon-test-indexing-behavior-of-storybookexperimental-addon-test-is-changed)
- [From version 8.2.x to 8.3.x](#from-version-82x-to-83x)
  - [Removed `experimental_SIDEBAR_BOTTOM` and deprecated `experimental_SIDEBAR_TOP` addon types](#removed-experimental_sidebar_bottom-and-deprecated-experimental_sidebar_top-addon-types)
  - [New parameters format for addon backgrounds](#new-parameters-format-for-addon-backgrounds)
  - [New parameters format for addon viewport](#new-parameters-format-for-addon-viewport)
- [From version 8.1.x to 8.2.x](#from-version-81x-to-82x)
  - [Failed to resolve import "@storybook/X" error](#failed-to-resolve-import-storybookx-error)
  - [Preview.js globals renamed to initialGlobals](#previewjs-globals-renamed-to-initialglobals)
- [From version 8.0.x to 8.1.x](#from-version-80x-to-81x)
  - [Portable stories](#portable-stories)
    - [@storybook/nextjs requires specific path aliases to be setup](#storybooknextjs-requires-specific-path-aliases-to-be-setup)
  - [main.js `docs.autodocs` is deprecated](#mainjs-docsautodocs-is-deprecated)
  - [`docs` and `story` system tags removed](#docs-and-story-system-tags-removed)
  - [Subtitle block and `parameters.componentSubtitle`](#subtitle-block-and-parameterscomponentsubtitle)
  - [Title block `of` prop](#title-block-of-prop)
- [From version 7.x to 8.0.0](#from-version-7x-to-800)
  - [Portable stories](#portable-stories-1)
    - [Project annotations are now merged instead of overwritten in composeStory](#project-annotations-are-now-merged-instead-of-overwritten-in-composestory)
    - [Type change in `composeStories` API](#type-change-in-composestories-api)
    - [Composed Vue stories are now components instead of functions](#composed-vue-stories-are-now-components-instead-of-functions)
  - [Tab addons are now routed to a query parameter](#tab-addons-are-now-routed-to-a-query-parameter)
  - [Default keyboard shortcuts changed](#default-keyboard-shortcuts-changed)
  - [Manager addons are now rendered with React 18](#manager-addons-are-now-rendered-with-react-18)
  - [Removal of `storiesOf`-API](#removal-of-storiesof-api)
  - [Removed deprecated shim packages](#removed-deprecated-shim-packages)
  - [Deprecated `@storybook/testing-library` package](#deprecated-storybooktesting-library-package)
  - [Framework-specific Vite plugins have to be explicitly added](#framework-specific-vite-plugins-have-to-be-explicitly-added)
    - [For React:](#for-react)
    - [For Vue:](#for-vue)
    - [For Svelte (without Sveltekit):](#for-svelte-without-sveltekit)
    - [For Preact:](#for-preact)
    - [For Solid:](#for-solid)
    - [For Qwik:](#for-qwik)
  - [TurboSnap Vite plugin is no longer needed](#turbosnap-vite-plugin-is-no-longer-needed)
  - [`--webpack-stats-json` option renamed `--stats-json`](#--webpack-stats-json-option-renamed---stats-json)
  - [Implicit actions can not be used during rendering (for example in the play function)](#implicit-actions-can-not-be-used-during-rendering-for-example-in-the-play-function)
  - [MDX related changes](#mdx-related-changes)
    - [MDX is upgraded to v3](#mdx-is-upgraded-to-v3)
    - [Dropping support for \*.stories.mdx (CSF in MDX) format and MDX1 support](#dropping-support-for-storiesmdx-csf-in-mdx-format-and-mdx1-support)
    - [Dropping support for id, name and story in Story block](#dropping-support-for-id-name-and-story-in-story-block)
  - [Core changes](#core-changes-1)
    - [`framework.options.builder.useSWC` for Webpack5-based projects removed](#frameworkoptionsbuilderuseswc-for-webpack5-based-projects-removed)
    - [Removed `@babel/core` and `babel-loader` from `@storybook/builder-webpack5`](#removed-babelcore-and-babel-loader-from-storybookbuilder-webpack5)
    - [`framework.options.fastRefresh` for Webpack5-based projects removed](#frameworkoptionsfastrefresh-for-webpack5-based-projects-removed)
    - [`typescript.skipBabel` removed](#typescriptskipbabel-removed)
    - [Dropping support for Yarn 1](#dropping-support-for-yarn-1)
    - [Dropping support for Node.js 16](#dropping-support-for-nodejs-16)
    - [Autotitle breaking fixes](#autotitle-breaking-fixes)
    - [Storyshots has been removed](#storyshots-has-been-removed)
    - [UI layout state has changed shape](#ui-layout-state-has-changed-shape)
    - [New UI and props for Button and IconButton components](#new-ui-and-props-for-button-and-iconbutton-components)
    - [Icons is deprecated](#icons-is-deprecated)
    - [Removed postinstall](#removed-postinstall)
    - [Removed stories.json](#removed-storiesjson)
    - [Removed `sb babelrc` command](#removed-sb-babelrc-command)
    - [Changed interfaces for `@storybook/router` components](#changed-interfaces-for-storybookrouter-components)
    - [Extract no longer batches](#extract-no-longer-batches)
  - [Framework-specific changes](#framework-specific-changes-1)
    - [React](#react)
      - [`react-docgen` component analysis by default](#react-docgen-component-analysis-by-default)
    - [Next.js](#nextjs)
      - [Require Next.js 13.5 and up](#require-nextjs-135-and-up)
      - [Automatic SWC mode detection](#automatic-swc-mode-detection)
      - [RSC config moved to React renderer](#rsc-config-moved-to-react-renderer)
    - [Vue](#vue)
      - [Require Vue 3 and up](#require-vue-3-and-up)
    - [Angular](#angular)
      - [Require Angular 15 and up](#require-angular-15-and-up)
    - [Svelte](#svelte)
      - [Require Svelte 4 and up](#require-svelte-4-and-up)
    - [Preact](#preact)
      - [Require Preact 10 and up](#require-preact-10-and-up)
      - [No longer adds default Babel plugins](#no-longer-adds-default-babel-plugins)
    - [Web Components](#web-components)
      - [Dropping default babel plugins in Webpack5-based projects](#dropping-default-babel-plugins-in-webpack5-based-projects)
  - [Deprecations which are now removed](#deprecations-which-are-now-removed)
    - [Removed `config` preset](#removed-config-preset)
    - [Removed `passArgsFirst` option](#removed-passargsfirst-option)
    - [Methods and properties from AddonStore](#methods-and-properties-from-addonstore)
    - [Methods and properties from PreviewAPI](#methods-and-properties-from-previewapi)
    - [Removals in @storybook/components](#removals-in-storybookcomponents)
    - [Removals in @storybook/types](#removals-in-storybooktypes)
    - [--use-npm flag in storybook CLI](#--use-npm-flag-in-storybook-cli)
    - [hideNoControlsWarning parameter from addon controls](#hidenocontrolswarning-parameter-from-addon-controls)
    - [`setGlobalConfig` from `@storybook/react`](#setglobalconfig-from-storybookreact)
    - [StorybookViteConfig type from @storybook/builder-vite](#storybookviteconfig-type-from-storybookbuilder-vite)
    - [props from WithTooltipComponent from @storybook/components](#props-from-withtooltipcomponent-from-storybookcomponents)
    - [LinkTo direct import from addon-links](#linkto-direct-import-from-addon-links)
    - [DecoratorFn, Story, ComponentStory, ComponentStoryObj, ComponentStoryFn and ComponentMeta TypeScript types](#decoratorfn-story-componentstory-componentstoryobj-componentstoryfn-and-componentmeta-typescript-types)
    - ["Framework" TypeScript types](#framework-typescript-types)
    - [`navigateToSettingsPage` method from Storybook's manager-api](#navigatetosettingspage-method-from-storybooks-manager-api)
    - [storyIndexers](#storyindexers)
    - [Deprecated docs parameters](#deprecated-docs-parameters)
    - [Description Doc block properties](#description-doc-block-properties)
    - [Story Doc block properties](#story-doc-block-properties)
    - [Manager API expandAll and collapseAll methods](#manager-api-expandall-and-collapseall-methods)
    - [`ArgsTable` Doc block removed](#argstable-doc-block-removed)
    - [`Source` Doc block properties](#source-doc-block-properties)
    - [`Canvas` Doc block properties](#canvas-doc-block-properties)
    - [`Primary` Doc block properties](#primary-doc-block-properties)
    - [`createChannel` from `@storybook/postmessage` and `@storybook/channel-websocket`](#createchannel-from-storybookpostmessage-and-storybookchannel-websocket)
    - [StoryStore and methods deprecated](#storystore-and-methods-deprecated)
  - [Addon author changes](#addon-author-changes)
    - [Tab addons cannot manually route, Tool addons can filter their visibility via tabId](#tab-addons-cannot-manually-route-tool-addons-can-filter-their-visibility-via-tabid)
    - [Removed `config` preset](#removed-config-preset-1)
- [From version 7.5.0 to 7.6.0](#from-version-750-to-760)
    - [CommonJS with Vite is deprecated](#commonjs-with-vite-is-deprecated)
    - [Using implicit actions during rendering is deprecated](#using-implicit-actions-during-rendering-is-deprecated)
    - [typescript.skipBabel deprecated](#typescriptskipbabel-deprecated)
    - [Primary doc block accepts of prop](#primary-doc-block-accepts-of-prop)
    - [Addons no longer need a peer dependency on React](#addons-no-longer-need-a-peer-dependency-on-react)
- [From version 7.4.0 to 7.5.0](#from-version-740-to-750)
    - [`storyStoreV6` and `storiesOf` is deprecated](#storystorev6-and-storiesof-is-deprecated)
    - [`storyIndexers` is replaced with `experimental_indexers`](#storyindexers-is-replaced-with-experimental_indexers)
- [From version 7.0.0 to 7.2.0](#from-version-700-to-720)
    - [Addon API is more type-strict](#addon-api-is-more-type-strict)
    - [Addon-controls hideNoControlsWarning parameter is deprecated](#addon-controls-hidenocontrolswarning-parameter-is-deprecated)
- [From version 6.5.x to 7.0.0](#from-version-65x-to-700)
  - [7.0 breaking changes](#70-breaking-changes)
    - [Dropped support for Node 15 and below](#dropped-support-for-node-15-and-below)
    - [Default export in Preview.js](#default-export-in-previewjs)
    - [ESM format in Main.js](#esm-format-in-mainjs)
    - [Modern browser support](#modern-browser-support)
    - [React peer dependencies required](#react-peer-dependencies-required)
    - [start-storybook / build-storybook binaries removed](#start-storybook--build-storybook-binaries-removed)
    - [New Framework API](#new-framework-api)
      - [Available framework packages](#available-framework-packages)
      - [Framework field mandatory](#framework-field-mandatory)
      - [frameworkOptions renamed](#frameworkoptions-renamed)
      - [builderOptions renamed](#builderoptions-renamed)
    - [TypeScript: StorybookConfig type moved](#typescript-storybookconfig-type-moved)
    - [Titles are statically computed](#titles-are-statically-computed)
    - [Framework standalone build moved](#framework-standalone-build-moved)
    - [Change of root html IDs](#change-of-root-html-ids)
    - [Stories glob matches MDX files](#stories-glob-matches-mdx-files)
    - [Add strict mode](#add-strict-mode)
    - [Importing plain markdown files with `transcludeMarkdown` has changed](#importing-plain-markdown-files-with-transcludemarkdown-has-changed)
    - [Stories field in .storybook/main.js is mandatory](#stories-field-in-storybookmainjs-is-mandatory)
    - [Stricter global types](#stricter-global-types)
    - [Deploying build artifacts](#deploying-build-artifacts)
      - [Dropped support for file URLs](#dropped-support-for-file-urls)
      - [Serving with nginx](#serving-with-nginx)
      - [Ignore story files from node\_modules](#ignore-story-files-from-node_modules)
  - [7.0 Core changes](#70-core-changes)
    - [7.0 feature flags removed](#70-feature-flags-removed)
    - [Story context is prepared before for supporting fine grained updates](#story-context-is-prepared-before-for-supporting-fine-grained-updates)
    - [Changed decorator order between preview.js and addons/frameworks](#changed-decorator-order-between-previewjs-and-addonsframeworks)
    - [Dark mode detection](#dark-mode-detection)
    - [`addons.setConfig` should now be imported from `@storybook/manager-api`.](#addonssetconfig-should-now-be-imported-from-storybookmanager-api)
  - [7.0 core addons changes](#70-core-addons-changes)
    - [Removed auto injection of @storybook/addon-actions decorator](#removed-auto-injection-of-storybookaddon-actions-decorator)
    - [Addon-backgrounds: Removed deprecated grid parameter](#addon-backgrounds-removed-deprecated-grid-parameter)
    - [Addon-a11y: Removed deprecated withA11y decorator](#addon-a11y-removed-deprecated-witha11y-decorator)
    - [Addon-interactions: Interactions debugger is now default](#addon-interactions-interactions-debugger-is-now-default)
  - [7.0 Vite changes](#70-vite-changes)
    - [Vite builder uses Vite config automatically](#vite-builder-uses-vite-config-automatically)
    - [Vite cache moved to node\_modules/.cache/.vite-storybook](#vite-cache-moved-to-node_modulescachevite-storybook)
  - [7.0 Webpack changes](#70-webpack-changes)
    - [Webpack4 support discontinued](#webpack4-support-discontinued)
    - [Babel mode v7 exclusively](#babel-mode-v7-exclusively)
    - [Postcss removed](#postcss-removed)
    - [Removed DLL flags](#removed-dll-flags)
  - [7.0 Framework-specific changes](#70-framework-specific-changes)
    - [Angular: Removed deprecated `component` and `propsMeta` field](#angular-removed-deprecated-component-and-propsmeta-field)
    - [Angular: Drop support for Angular \< 14](#angular-drop-support-for-angular--14)
    - [Angular: Drop support for calling Storybook directly](#angular-drop-support-for-calling-storybook-directly)
    - [Angular: Application providers and ModuleWithProviders](#angular-application-providers-and-modulewithproviders)
    - [Angular: Removed legacy renderer](#angular-removed-legacy-renderer)
    - [Angular: Initializer functions](#angular-initializer-functions)
    - [Next.js: use the `@storybook/nextjs` framework](#nextjs-use-the-storybooknextjs-framework)
    - [SvelteKit: needs the `@storybook/sveltekit` framework](#sveltekit-needs-the-storybooksveltekit-framework)
    - [Vue3: replaced app export with setup](#vue3-replaced-app-export-with-setup)
    - [Web-components: dropped lit-html v1 support](#web-components-dropped-lit-html-v1-support)
    - [Create React App: dropped CRA4 support](#create-react-app-dropped-cra4-support)
    - [HTML: No longer auto-dedents source code](#html-no-longer-auto-dedents-source-code)
  - [7.0 Addon authors changes](#70-addon-authors-changes)
    - [New Addons API](#new-addons-api)
      - [Specific instructions for addon creators](#specific-instructions-for-addon-creators)
      - [Specific instructions for addon users](#specific-instructions-for-addon-users)
    - [register.js removed](#registerjs-removed)
    - [No more default export from `@storybook/addons`](#no-more-default-export-from-storybookaddons)
    - [No more configuration for manager](#no-more-configuration-for-manager)
    - [Icons API changed](#icons-api-changed)
    - [Removed global client APIs](#removed-global-client-apis)
    - [framework parameter renamed to renderer](#framework-parameter-renamed-to-renderer)
  - [7.0 Docs changes](#70-docs-changes)
    - [Autodocs changes](#autodocs-changes)
    - [MDX docs files](#mdx-docs-files)
    - [Unattached docs files](#unattached-docs-files)
    - [Doc Blocks](#doc-blocks)
      - [Meta block](#meta-block)
      - [Description block, `parameters.notes` and `parameters.info`](#description-block-parametersnotes-and-parametersinfo)
      - [Story block](#story-block)
      - [Source block](#source-block)
      - [Canvas block](#canvas-block)
      - [ArgsTable block](#argstable-block)
    - [Configuring Autodocs](#configuring-autodocs)
    - [MDX2 upgrade](#mdx2-upgrade)
    - [Legacy MDX1 support](#legacy-mdx1-support)
    - [Default docs styles will leak into non-story user components](#default-docs-styles-will-leak-into-non-story-user-components)
    - [Explicit `<code>` elements are no longer syntax highlighted](#explicit-code-elements-are-no-longer-syntax-highlighted)
    - [Dropped source loader / storiesOf static snippets](#dropped-source-loader--storiesof-static-snippets)
    - [Removed docs.getContainer and getPage parameters](#removed-docsgetcontainer-and-getpage-parameters)
    - [Addon-docs: Removed deprecated blocks.js entry](#addon-docs-removed-deprecated-blocksjs-entry)
    - [Dropped addon-docs manual babel configuration](#dropped-addon-docs-manual-babel-configuration)
    - [Dropped addon-docs manual configuration](#dropped-addon-docs-manual-configuration)
    - [Autoplay in docs](#autoplay-in-docs)
    - [Removed STORYBOOK\_REACT\_CLASSES global](#removed-storybook_react_classes-global)
  - [7.0 Deprecations and default changes](#70-deprecations-and-default-changes)
    - [storyStoreV7 enabled by default](#storystorev7-enabled-by-default)
    - [`Story` type deprecated](#story-type-deprecated)
    - [`ComponentStory`, `ComponentStoryObj`, `ComponentStoryFn` and `ComponentMeta` types are deprecated](#componentstory-componentstoryobj-componentstoryfn-and-componentmeta-types-are-deprecated)
    - [Renamed `renderToDOM` to `renderToCanvas`](#renamed-rendertodom-to-rendertocanvas)
    - [Renamed `XFramework` to `XRenderer`](#renamed-xframework-to-xrenderer)
    - [Renamed `DecoratorFn` to `Decorator`](#renamed-decoratorfn-to-decorator)
    - [CLI option `--use-npm` deprecated](#cli-option---use-npm-deprecated)
    - ['config' preset entry replaced with 'previewAnnotations'](#config-preset-entry-replaced-with-previewannotations)
- [From version 6.4.x to 6.5.0](#from-version-64x-to-650)
  - [Vue 3 upgrade](#vue-3-upgrade)
  - [React18 new root API](#react18-new-root-api)
  - [Renamed isToolshown to showToolbar](#renamed-istoolshown-to-showtoolbar)
  - [Dropped support for addon-actions addDecorators](#dropped-support-for-addon-actions-adddecorators)
  - [Vite builder renamed](#vite-builder-renamed)
  - [Docs framework refactor for React](#docs-framework-refactor-for-react)
  - [Opt-in MDX2 support](#opt-in-mdx2-support)
  - [CSF3 auto-title improvements](#csf3-auto-title-improvements)
    - [Auto-title filename case](#auto-title-filename-case)
    - [Auto-title redundant filename](#auto-title-redundant-filename)
    - [Auto-title always prefixes](#auto-title-always-prefixes)
  - [6.5 Deprecations](#65-deprecations)
    - [Deprecated register.js](#deprecated-registerjs)
- [From version 6.3.x to 6.4.0](#from-version-63x-to-640)
  - [Automigrate](#automigrate)
  - [CRA5 upgrade](#cra5-upgrade)
  - [CSF3 enabled](#csf3-enabled)
    - [Optional titles](#optional-titles)
    - [String literal titles](#string-literal-titles)
    - [StoryObj type](#storyobj-type)
  - [Story Store v7](#story-store-v7)
    - [Behavioral differences](#behavioral-differences)
    - [Main.js framework field](#mainjs-framework-field)
    - [Using the v7 store](#using-the-v7-store)
    - [v7-style story sort](#v7-style-story-sort)
    - [v7 default sort behavior](#v7-default-sort-behavior)
    - [v7 Store API changes for addon authors](#v7-store-api-changes-for-addon-authors)
    - [Storyshots compatibility in the v7 store](#storyshots-compatibility-in-the-v7-store)
  - [Emotion11 quasi-compatibility](#emotion11-quasi-compatibility)
  - [Babel mode v7](#babel-mode-v7)
  - [Loader behavior with args changes](#loader-behavior-with-args-changes)
  - [6.4 Angular changes](#64-angular-changes)
    - [SB Angular builder](#sb-angular-builder)
    - [Angular13](#angular13)
    - [Angular component parameter removed](#angular-component-parameter-removed)
  - [6.4 deprecations](#64-deprecations)
    - [Deprecated --static-dir CLI flag](#deprecated---static-dir-cli-flag)
- [From version 6.2.x to 6.3.0](#from-version-62x-to-630)
  - [Webpack 5](#webpack-5)
    - [Fixing hoisting issues](#fixing-hoisting-issues)
      - [Webpack 5 manager build](#webpack-5-manager-build)
      - [Wrong webpack version](#wrong-webpack-version)
  - [Angular 12 upgrade](#angular-12-upgrade)
  - [Lit support](#lit-support)
  - [No longer inferring default values of args](#no-longer-inferring-default-values-of-args)
  - [6.3 deprecations](#63-deprecations)
    - [Deprecated addon-knobs](#deprecated-addon-knobs)
    - [Deprecated scoped blocks imports](#deprecated-scoped-blocks-imports)
    - [Deprecated layout URL params](#deprecated-layout-url-params)
- [From version 6.1.x to 6.2.0](#from-version-61x-to-620)
  - [MDX pattern tweaked](#mdx-pattern-tweaked)
  - [6.2 Angular overhaul](#62-angular-overhaul)
    - [New Angular storyshots format](#new-angular-storyshots-format)
    - [Deprecated Angular story component](#deprecated-angular-story-component)
    - [New Angular renderer](#new-angular-renderer)
    - [Components without selectors](#components-without-selectors)
  - [Packages now available as ESModules](#packages-now-available-as-esmodules)
  - [6.2 Deprecations](#62-deprecations)
    - [Deprecated implicit PostCSS loader](#deprecated-implicit-postcss-loader)
    - [Deprecated default PostCSS plugins](#deprecated-default-postcss-plugins)
    - [Deprecated showRoots config option](#deprecated-showroots-config-option)
    - [Deprecated control.options](#deprecated-controloptions)
    - [Deprecated storybook components html entry point](#deprecated-storybook-components-html-entry-point)
- [From version 6.0.x to 6.1.0](#from-version-60x-to-610)
  - [Addon-backgrounds preset](#addon-backgrounds-preset)
  - [Single story hoisting](#single-story-hoisting)
  - [React peer dependencies](#react-peer-dependencies)
  - [6.1 deprecations](#61-deprecations)
    - [Deprecated DLL flags](#deprecated-dll-flags)
    - [Deprecated storyFn](#deprecated-storyfn)
    - [Deprecated onBeforeRender](#deprecated-onbeforerender)
    - [Deprecated grid parameter](#deprecated-grid-parameter)
    - [Deprecated package-composition disabled parameter](#deprecated-package-composition-disabled-parameter)
- [From version 5.3.x to 6.0.x](#from-version-53x-to-60x)
  - [Hoisted CSF annotations](#hoisted-csf-annotations)
  - [Zero config typescript](#zero-config-typescript)
  - [Correct globs in main.js](#correct-globs-in-mainjs)
  - [CRA preset removed](#cra-preset-removed)
  - [Core-JS dependency errors](#core-js-dependency-errors)
  - [Args passed as first argument to story](#args-passed-as-first-argument-to-story)
  - [6.0 Docs breaking changes](#60-docs-breaking-changes)
    - [Remove framework-specific docs presets](#remove-framework-specific-docs-presets)
    - [Preview/Props renamed](#previewprops-renamed)
    - [Docs theme separated](#docs-theme-separated)
    - [DocsPage slots removed](#docspage-slots-removed)
    - [React prop tables with Typescript](#react-prop-tables-with-typescript)
    - [ConfigureJSX true by default in React](#configurejsx-true-by-default-in-react)
    - [User babelrc disabled by default in MDX](#user-babelrc-disabled-by-default-in-mdx)
    - [Docs description parameter](#docs-description-parameter)
    - [6.0 Inline stories](#60-inline-stories)
  - [New addon presets](#new-addon-presets)
  - [Removed babel-preset-vue from Vue preset](#removed-babel-preset-vue-from-vue-preset)
  - [Removed Deprecated APIs](#removed-deprecated-apis)
  - [New setStories event](#new-setstories-event)
  - [Removed renderCurrentStory event](#removed-rendercurrentstory-event)
  - [Removed hierarchy separators](#removed-hierarchy-separators)
  - [No longer pass denormalized parameters to storySort](#no-longer-pass-denormalized-parameters-to-storysort)
  - [Client API changes](#client-api-changes)
    - [Removed Legacy Story APIs](#removed-legacy-story-apis)
    - [Can no longer add decorators/parameters after stories](#can-no-longer-add-decoratorsparameters-after-stories)
    - [Changed Parameter Handling](#changed-parameter-handling)
  - [Simplified Render Context](#simplified-render-context)
  - [Story Store immutable outside of configuration](#story-store-immutable-outside-of-configuration)
  - [Improved story source handling](#improved-story-source-handling)
  - [6.0 Addon API changes](#60-addon-api-changes)
    - [Consistent local addon paths in main.js](#consistent-local-addon-paths-in-mainjs)
    - [Deprecated setAddon](#deprecated-setaddon)
    - [Deprecated disabled parameter](#deprecated-disabled-parameter)
    - [Actions addon uses parameters](#actions-addon-uses-parameters)
    - [Removed action decorator APIs](#removed-action-decorator-apis)
    - [Removed withA11y decorator](#removed-witha11y-decorator)
    - [Essentials addon disables differently](#essentials-addon-disables-differently)
    - [Backgrounds addon has a new api](#backgrounds-addon-has-a-new-api)
  - [6.0 Deprecations](#60-deprecations)
    - [Deprecated addon-info, addon-notes](#deprecated-addon-info-addon-notes)
    - [Deprecated addon-contexts](#deprecated-addon-contexts)
    - [Removed addon-centered](#removed-addon-centered)
    - [Deprecated polymer](#deprecated-polymer)
    - [Deprecated immutable options parameters](#deprecated-immutable-options-parameters)
    - [Deprecated addParameters and addDecorator](#deprecated-addparameters-and-adddecorator)
    - [Deprecated clearDecorators](#deprecated-cleardecorators)
    - [Deprecated configure](#deprecated-configure)
    - [Deprecated support for duplicate kinds](#deprecated-support-for-duplicate-kinds)
- [From version 5.2.x to 5.3.x](#from-version-52x-to-53x)
  - [To main.js configuration](#to-mainjs-configuration)
    - [Using main.js](#using-mainjs)
    - [Using preview.js](#using-previewjs)
    - [Using manager.js](#using-managerjs)
  - [Create React App preset](#create-react-app-preset)
  - [Description doc block](#description-doc-block)
  - [React Native Async Storage](#react-native-async-storage)
  - [Deprecate displayName parameter](#deprecate-displayname-parameter)
  - [Unified docs preset](#unified-docs-preset)
  - [Simplified hierarchy separators](#simplified-hierarchy-separators)
  - [Addon StoryShots Puppeteer uses external puppeteer](#addon-storyshots-puppeteer-uses-external-puppeteer)
- [From version 5.1.x to 5.2.x](#from-version-51x-to-52x)
  - [Source-loader](#source-loader)
  - [Default viewports](#default-viewports)
  - [Grid toolbar-feature](#grid-toolbar-feature)
  - [Docs mode docgen](#docs-mode-docgen)
  - [storySort option](#storysort-option)
- [From version 5.1.x to 5.1.10](#from-version-51x-to-5110)
  - [babel.config.js support](#babelconfigjs-support)
- [From version 5.0.x to 5.1.x](#from-version-50x-to-51x)
  - [React native server](#react-native-server)
  - [Angular 7](#angular-7)
  - [CoreJS 3](#corejs-3)
- [From version 5.0.1 to 5.0.2](#from-version-501-to-502)
  - [Deprecate webpack extend mode](#deprecate-webpack-extend-mode)
- [From version 4.1.x to 5.0.x](#from-version-41x-to-50x)
  - [sortStoriesByKind](#sortstoriesbykind)
  - [Webpack config simplification](#webpack-config-simplification)
  - [Theming overhaul](#theming-overhaul)
  - [Story hierarchy defaults](#story-hierarchy-defaults)
  - [Options addon deprecated](#options-addon-deprecated)
  - [Individual story decorators](#individual-story-decorators)
  - [Addon backgrounds uses parameters](#addon-backgrounds-uses-parameters)
  - [Addon cssresources name attribute renamed](#addon-cssresources-name-attribute-renamed)
  - [Addon viewport uses parameters](#addon-viewport-uses-parameters)
  - [Addon a11y uses parameters, decorator renamed](#addon-a11y-uses-parameters-decorator-renamed)
  - [Addon centered decorator deprecated](#addon-centered-decorator-deprecated)
  - [New keyboard shortcuts defaults](#new-keyboard-shortcuts-defaults)
  - [New URL structure](#new-url-structure)
  - [Rename of the `--secure` cli parameter to `--https`](#rename-of-the---secure-cli-parameter-to---https)
  - [Vue integration](#vue-integration)
- [From version 4.0.x to 4.1.x](#from-version-40x-to-41x)
  - [Private addon config](#private-addon-config)
  - [React 15.x](#react-15x)
- [From version 3.4.x to 4.0.x](#from-version-34x-to-40x)
  - [React 16.3+](#react-163)
  - [Generic addons](#generic-addons)
  - [Knobs select ordering](#knobs-select-ordering)
  - [Knobs URL parameters](#knobs-url-parameters)
  - [Keyboard shortcuts moved](#keyboard-shortcuts-moved)
  - [Removed addWithInfo](#removed-addwithinfo)
  - [Removed RN packager](#removed-rn-packager)
  - [Removed RN addons](#removed-rn-addons)
  - [Storyshots Changes](#storyshots-changes)
  - [Webpack 4](#webpack-4)
  - [Babel 7](#babel-7)
  - [Create-react-app](#create-react-app)
    - [Upgrade CRA1 to babel 7](#upgrade-cra1-to-babel-7)
    - [Migrate CRA1 while keeping babel 6](#migrate-cra1-while-keeping-babel-6)
  - [start-storybook opens browser](#start-storybook-opens-browser)
  - [CLI Rename](#cli-rename)
  - [Addon story parameters](#addon-story-parameters)
- [From version 3.3.x to 3.4.x](#from-version-33x-to-34x)
- [From version 3.2.x to 3.3.x](#from-version-32x-to-33x)
  - [`babel-core` is now a peer dependency #2494](#babel-core-is-now-a-peer-dependency-2494)
  - [Base webpack config now contains vital plugins #1775](#base-webpack-config-now-contains-vital-plugins-1775)
  - [Refactored Knobs](#refactored-knobs)
- [From version 3.1.x to 3.2.x](#from-version-31x-to-32x)
  - [Moved TypeScript addons definitions](#moved-typescript-addons-definitions)
  - [Updated Addons API](#updated-addons-api)
- [From version 3.0.x to 3.1.x](#from-version-30x-to-31x)
  - [Moved TypeScript definitions](#moved-typescript-definitions)
  - [Deprecated head.html](#deprecated-headhtml)
- [From version 2.x.x to 3.x.x](#from-version-2xx-to-3xx)
  - [Webpack upgrade](#webpack-upgrade)
  - [Packages renaming](#packages-renaming)
  - [Deprecated embedded addons](#deprecated-embedded-addons)

## From version 10.x to 11.0.0

### `storybook dev` now blocks remote iframe embedding

`storybook dev` now sends a [`Content-Security-Policy: frame-ancestors`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors) header with every response, for both the manager and the preview. Only Storybook itself and pages served from `localhost` or `127.0.0.1` can embed the dev server in an `<iframe>`. This prevents a malicious website from embedding your local Storybook and interacting with it.

These cases keep working without changes:

- Composing Storybooks that run locally, when the composing Storybook is opened on `localhost` or `127.0.0.1`
- Tools running on your machine, served from `localhost` or `127.0.0.1`, that embed a running Storybook
- Built and published Storybooks; Only `storybook dev` sends the header, so a built Storybook can still be embedded and composed from any origin

Pages served from any other origin, including your local network address (for example `http://192.168.1.20:6006`), a tunnel, or a custom hostname are now blocked. The embedded Storybook appears empty, and the browser console of the embedding page reports a `frame-ancestors` violation/

If you are affected, build the Storybook you want to embed with `storybook build`, and use its build output, which has no restriction. To keep embedding live `dev` content, set `security.insecureRemoteIframeEmbed` to `true` in the `.storybook/main` file of the Storybook that is being embedded:

```ts
// .storybook/main.ts
import type { StorybookConfig } from '@storybook/your-framework';

const config: StorybookConfig = {
  // ...
  security: {
    insecureRemoteIframeEmbed: true,
  },
};

export default config;
```

Composing live `dev` content from another origin also requires `security.insecureIframeMessaging`, see [Storybook now restricts iframe messaging](#storybook-now-restricts-iframe-messaging).

With this option enabled, any website you visit can embed your local Storybook. Avoid leaving it on for longer than strictly necessary.

### Storybook now restricts iframe messaging

The manager and its preview iframes exchange messages with `postMessage`. The manager now only accepts messages from its own preview iframes. In `storybook dev`, the preview also only accepts messages from its own origin and from a manager served from `localhost` or `127.0.0.1`, and both address their messages to the expected origin instead of `*`. This prevents a malicious website from embedding your Storybook and exchanging messages with it.

These cases keep working without changes:

- Composing Storybooks that run locally, when the composing Storybook is opened on `localhost` or `127.0.0.1`
- Composing a built and published Storybook

These cases are affected:

- Composing a live `dev` Storybook from a page served from any origin other than `localhost` or `127.0.0.1`
- In `storybook dev`, composing a Storybook that serves no `index.json` and whose `refs` URL redirects to another origin, for example from `http://` to `https://` (use the final URL in `refs` instead)

If you are affected, build the Storybook you want to compose with `storybook build`, and compose its build output, which accepts messages from any origin. To keep composing live `dev` content, set `security.insecureIframeMessaging` to `true` in the `.storybook/main` file of the Storybook that is being composed:

```ts
// .storybook/main.ts
import type { StorybookConfig } from '@storybook/your-framework';

const config: StorybookConfig = {
  // ...
  security: {
    insecureIframeMessaging: true,
  },
};

export default config;
```

Composing live `dev` content from another origin also requires `security.insecureRemoteIframeEmbed`, see [`storybook dev` now blocks remote iframe embedding](#storybook-dev-now-blocks-remote-iframe-embedding).

With this option enabled, any website that embeds your Storybook can exchange messages with it. Avoid leaving it on for longer than strictly necessary.

### Legacy highlight object format removed

The legacy highlight payload `{ elements, color, style }` is no longer accepted by the `HIGHLIGHT` event. Senders must use the current format, which targets elements with `selectors` and controls their appearance with `styles`:

| Removed             | Replacement                                                     |
| ------------------- | --------------------------------------------------------------- |
| `elements`          | `selectors`                                                     |
| `color` and `style` | `styles` (CSS properties, e.g. `{ outline: '2px dashed red' }`) |

```diff
import { HIGHLIGHT } from 'storybook/highlight';

- emit(HIGHLIGHT, { elements: ['#button'], color: 'red', style: 'dashed' });
+ emit(HIGHLIGHT, { selectors: ['#button'], styles: { outline: '2px dashed red' } });
```

The full payload contract is `{ selectors, styles, hoverStyles, focusStyles, menu, priority, id }`. See the [highlight documentation](./docs/essentials/highlight.mdx) for the complete reference.

### Tag filtering API

Storybook 11 removes the experimental and undocumented tag filtering names. They no longer work at runtime.

| Removed                              | Replacement                    |
| ------------------------------------ | ------------------------------ |
| `experimental_setFilter`             | `setFilter`                    |
| `experimental_setFilters`            | `setFilters`                   |
| `tags.<name>.excludeFromSidebar`     | `tags.<name>.hideFromSidebar`  |
| `tags.<name>.excludeFromDocsStories` | `tags.<name>.hideFromAutodocs` |

`setFilter(id, filter)` registers one sidebar filter. A story or docs entry is shown only when every registered filter passes. Call `setFilter(id, () => true)` to stop filtering for that id. `setFilters` registers several filters in one index rebuild.

`hideFromSidebar` removes matching stories from the sidebar. Clearing the filter menu does not bring them back. `hideFromAutodocs` removes matching stories from autodocs pages.

`hideFromFilterPanel` hides a tag from the filter menu and leaves the stories visible. A hidden tag can still be an active filter when `defaultFilterSelection` or the URL selects it. The menu then shows an active-filter count and no checkbox for that tag. Do not combine `hideFromFilterPanel` with a default or URL selection for the same tag.

`sidebar.filters` in `manager.ts` is removed and is not rewritten. Replace a tag exclusion with `hideFromSidebar`. Replace a custom filter function with `setFilter`. Automigration prints a notice when it finds `sidebar.filters`.

`storybook automigrate` rewrites the tag option keys in `main.ts`, including when the value is an expression, and renames `experimental_setFilter` / `experimental_setFilters` identifiers in `.storybook` and story files. A call written as `api['experimental_setFilters']` is left unchanged. Rename those calls yourself in addon source outside `.storybook` and story files.

### Addon `TAB` registration removed

`addons.add` no longer accepts `type: types.TAB`. Storybook does not render addon tabs beside the canvas. This is an addon-author change. There is no automigration.

Move the UI into a panel:

```diff
import { addons, types } from 'storybook/manager-api';

addons.register('my-addon', () => {
  addons.add('my-addon/panel', {
-   type: types.TAB,
-   title: 'My Addon',
-   render: () => <div>Hello World</div>,
+   type: types.PANEL,
+   title: 'My Addon',
+   render: ({ active }) => (active ? <div>Hello World</div> : null),
  });
});
```

A panel stays next to the story. A tab replaced the canvas. For a short-lived action, register a `TOOL` that opens a modal instead.

`match` no longer receives `tabId`. Drop checks such as `!tabId` or `tabId === 'my-addon/tab'`. Use `viewMode` when a tool should appear only for stories or docs.

`parameters.previewTabs`, `layout.showTabs`, and the `tabs` URL parameter no longer change the manager UI.

See the [addon migration guide](docs/addons/addon-migration-guide.mdx#tab-ui-type-removed) for the same instructions in the addon-author guide.

### `storybook dev` no longer opens a browser by default

Storybook now starts the development server without automatically opening it in a browser. The CLI
continues to print the local URL, which you can open manually.

To keep opening Storybook automatically, add `--open` to your command or package script:

```json
{
  "scripts": {
    "storybook": "storybook dev --open"
  }
}
```

### `viewport.defaultViewport` parameter and `responsiveViewport` removed

Storybook 11 removes the deprecated `parameters.viewport.defaultViewport` parameter and the `responsiveViewport` export from `storybook/viewport`. Set the viewport with the `globals` API instead:

```diff
// .storybook/preview.ts
export default {
-  viewport: {
-    defaultViewport: 'mobile1',
-  },
+  initialGlobals: {
+    viewport: {
+      value: 'mobile1',
+    },
+  },
};
```

`parameters.viewport.viewports` and `parameters.viewport.options`, which define the available viewports, remain unchanged.

If you imported `responsiveViewport` from `storybook/viewport`, remove the import. Selecting the responsive, full-size view still works through the viewport addon UI.

### `parameters.componentSubtitle` removed

The deprecated `parameters.componentSubtitle` fallback was removed.
Use `parameters.docs.subtitle` instead.

The `component-subtitle` automigration moves it in your preview and story files when you upgrade, or when you run `npx storybook automigrate component-subtitle`:

```diff
export default {
  parameters: {
-   componentSubtitle: 'Button variants',
+   docs: { subtitle: 'Button variants' },
  },
};
```

When the same object already sets `docs.subtitle`, the automigration keeps it and removes `componentSubtitle`, because `docs.subtitle` already took precedence.
A `componentSubtitle` set on a single story never affected the Subtitle block, so the automigration leaves it in place for you to delete.
Files it cannot edit safely, such as parameters built from a spread, are listed in `automigrations-summary.md` for you to change by hand.

Before, any `docs.subtitle` took precedence over any `componentSubtitle`, even one set in the preview over one set in a component's meta.
After the migration, the more specific value wins, like every other parameter.
If your preview sets `docs.subtitle`, check the subtitles on your Docs pages.

### `argTypes` `defaultValue` removed

`argTypes.<name>.defaultValue` is removed. It has not set the value of an arg since Storybook 7.0. Delete the property.

To choose the value a story starts with, set `args`:

```js
export default {
  args: {
    label: 'Hello',
  },
};
```

To choose the text shown in the docs table, set `table.defaultValue`:

```js
export default {
  argTypes: {
    label: {
      table: { defaultValue: { summary: 'Hello' } },
    },
  },
};
```

`table.defaultValue` and `globalTypes.defaultValue` are unchanged.

The `argtypes-default-value` automigration deletes a static `argTypes.<name>.defaultValue` when you upgrade, or when you run `npx storybook automigrate argtypes-default-value`. It does not copy the value anywhere. An explicit `args` value stays as it is. When that property cannot be removed, the file is left unchanged and listed in `automigrations-summary.md`.

The automigration covers Storybook config and configured story files, including static CSF2 `Story.argTypes` assignments. It does not scan shared utility modules; remove deprecated fields in those modules manually.

### Docs Code panel enabled by default

When `@storybook/addon-docs` is installed, the Code panel is now available for stories without setting `parameters.docs.codePanel` to `true`.

To hide it for all stories, set `parameters.docs.codePanel` to `false` in `.storybook/preview.ts`:

```ts
export default {
  parameters: {
    docs: {
      codePanel: false,
    },
  },
};
```

You can also set this parameter at the component or story level. An explicit `true` enables the panel when a broader configuration disables it.

No automigration is needed. Existing boolean settings retain their meaning, and projects with no setting receive the new default.

### `argTypes` removed from loaders, `beforeEach`, `play` and `afterEach`

The story context passed to loaders, `beforeEach`, `play`, `afterEach` and `step` callbacks no longer contains `argTypes`. Reading it throws an error that links here.

With server-side docgen (`features.docgenServer`), the preview no longer infers arg types from components or args. `context.argTypes` in these hooks only ever contained the arg types you declared by hand, so it looked complete but was not.

```ts
// Before
export const Primary: Story = {
  play: async ({ argTypes, args }) => {
    for (const name of Object.keys(argTypes)) {
      // ...
    }
  },
};

// After
export const Primary: Story = {
  play: async ({ args }) => {
    for (const name of Object.keys(args)) {
      // ...
    }
  },
};
```

- Use `args` for the values passed to the story. Iterate `Object.keys(args)` instead of `Object.keys(argTypes)`.
- To see the resolved arg types, including those inferred from your component, use the Controls panel or the `ArgTypes` doc block.
- In portable stories, `composeStory(Story, meta).argTypes` still exposes the story's declared arg types outside of the lifecycle hooks.

Decorators and `render` functions keep receiving `argTypes`, because renderers rely on them while rendering. Their context type is the new `StoryContextForRender`; the `StoryContext` type no longer declares `argTypes`. Custom decorator or render helpers that annotate their context parameter as `StoryContext` and read `argTypes` should switch to `StoryContextForRender`.

### `docgenServer` is stable and enabled by default

T…74743 tokens truncated…ENT_STORY_WAS_SET` (in response to the existing `SET_CURRENT_STORY`) which is used to decide to render.

### Removed hierarchy separators

We've removed the ability to specify the hierarchy separators (how you control the grouping of story kinds in the sidebar). From Storybook 6.0 we have a single separator `/`, which cannot be configured.

If you are currently using custom separators, we encourage you to migrate to using `/` as the sole separator. If you are using `|` or `.` as a separator currently, we provide a codemod, [`upgrade-hierarchy-separators`](https://github.com/storybookjs/storybook/blob/next/code/lib/codemod/README.md#upgrade-hierarchy-separators), that can be used to rename your components. **Note: the codemod will not work for `.mdx` components, you will need to make the changes by hand.**

```
npx sb@latest migrate upgrade-hierarchy-separators --glob="*/**/*.stories.@(tsx|jsx|ts|js)"
```

We also now default to showing "roots", which are non-expandable groupings in the sidebar for the top-level groups. If you'd like to disable this, set the `showRoots` option in `.storybook/manager.js`:

```js
import { addons } from '@storybook/addons';

addons.setConfig({
  showRoots: false,
});
```

### No longer pass denormalized parameters to storySort

The `storySort` function (set via the `parameters.options.storySort` parameter) previously compared two entries `[storyId, storeItem]`, where `storeItem` included the full "denormalized" set of parameters of the story (i.e. the global, kind and story parameters that applied to that story).

For performance reasons, we now store the parameters uncombined, and so pass the format: `[storyId, storeItem, kindParameters, globalParameters]`.

### Client API changes

#### Removed Legacy Story APIs

In 6.0 we removed a set of APIs from the underlying `StoryStore` (which wasn't publicly accessible):

- `getStories`, `getStoryFileName`, `getStoryAndParameters`, `getStory`, `getStoryWithContext`, `hasStoryKind`, `hasStory`, `dumpStoryBook`, `size`, `clean`

Although these were private APIs, if you were using them, you could probably use the newer APIs (which are still private): `getStoriesForKind`, `getRawStory`, `removeStoryKind`, `remove`.

#### Can no longer add decorators/parameters after stories

You can no longer add decorators and parameters globally after you added your first story, and you can no longer add decorators and parameters to a kind after you've added your first story to it.

It's unclear and confusing what would happened if you did. If you want to disable a decorator for certain stories, use a parameter to do so:

```js
export StoryOne = ...;
StoryOne.story = { parameters: { addon: { disable: true } } };
```

If you want to use a parameter for a subset of stories in a kind, simply use a variable to do so:

```js
const commonParameters = { x: { y: 'z' } };
export StoryOne = ...;
StoryOne.story = { parameters: { ...commonParameters, other: 'things' } };
```

> NOTE: also the use of `addParameters` and `addDecorator` at arbitrary points is also deprecated, see [the deprecation warning](#deprecated-addparameters-and-adddecorator).

#### Changed Parameter Handling

There have been a few rationalizations of parameter handling in 6.0 to make things more predictable and fit better with the intention of parameters:

_All parameters are now merged recursively to arbitrary depth._

In 5.3 we sometimes merged parameters all the way down and sometimes did not depending on where you added them. It was confusing. If you were relying on this behaviour, let us know.

_Array parameters are no longer "merged"._

If you override an array parameter, the override will be the end product. If you want the old behaviour (appending a new value to an array parameter), export the original and use array spread. This will give you maximum flexibility:

```js
import { allBackgrounds } from './util/allBackgrounds';

export StoryOne = ...;
StoryOne.story = { parameters: { backgrounds: [...allBackgrounds, '#zyx' ] } };
```

_You cannot set parameters from decorators_

Parameters are intended to be statically set at story load time. So setting them via a decorator doesn't quite make sense. If you were using this to control the rendering of a story, chances are using the new `args` feature is a more idiomatic way to do this.

_You can only set storySort globally_

If you want to change the ordering of stories, use `export const parameters = { options: { storySort: ... } }` in `preview.js`.

### Simplified Render Context

The `RenderContext` that is passed to framework rendering layers in order to render a story has been simplified, dropping a few members that were not used by frameworks to render stories. In particular, the following have been removed:

- `selectedKind`/`selectedStory` -- replaced by `kind`/`name`
- `configApi`
- `storyStore`
- `channel`
- `clientApi`

### Story Store immutable outside of configuration

You can no longer change the contents of the StoryStore outside of a `configure()` call. This is to ensure that any changes are properly published to the manager. If you want to add stories "out of band" you can call `store.startConfiguring()` and `store.finishConfiguring()` to ensure that your changes are published.

### Improved story source handling

The story source code handling has been improved in both `addon-storysource` and `addon-docs`.

In 5.x some users used an undocumented _internal_ API, `mdxSource` to customize source snippetization in `addon-docs`. This has been removed in 6.0.

The preferred way to customize source snippets for stories is now:

```js
export const Example = () => <Button />;
Example.story = {
  parameters: {
    storySource: {
      source: 'custom source',
    },
  },
};
```

The MDX analog:

```mdx
<Story name="Example" parameters={{ storySource: { source: 'custom source' } }}>
  <Button />
</Story>
```

### 6.0 Addon API changes

#### Consistent local addon paths in main.js

If you use `.storybook/main.js` config and have locally-defined addons in your project, you need to update your file paths.

In 5.3, `addons` paths were relative to the project root, which was inconsistent with `stories` paths, which were relative to the `.storybook` folder. In 6.0, addon paths are now relative to the config folder.

So, for example, if you had:

```js
module.exports = { addons: ['./.storybook/my-local-addon/register'] };
```

You'd need to update this to:

```js
module.exports = { addons: ['./my-local-addon/register'] };
```

#### Deprecated setAddon

We've deprecated the `setAddon` method of the `storiesOf` API and plan to remove it in 7.0.

Since early versions, Storybook shipped with a `setAddon` API, which allows you to extend `storiesOf` with arbitrary code. We've removed this from all core addons long ago and recommend writing stories in [Component Story Format](https://medium.com/storybookjs/component-story-format-66f4c32366df) rather than using the internal Storybook API.

#### Deprecated disabled parameter

Starting in 6.0.17, we've renamed the `disabled` parameter to `disable` to resolve an inconsistency where `disabled` had been used to hide the addon panel, whereas `disable` had been used to disable an addon's execution. Since `disable` was much more widespread in the code, we standardized on that.

So, for example:

```
Story.parameters = { actions: { disabled: true } }
```

Should be rewritten as:

```
Story.parameters = { actions: { disable: true } }
```

#### Actions addon uses parameters

Leveraging the new preset `@storybook/addon-actions` uses parameters to pass action options. If you previously had:

```js
import { withActions } from `@storybook/addon-actions`;

export StoryOne = ...;
StoryOne.story = {
  decorators: [withActions('mouseover', 'click .btn')],
}
```

You should replace it with:

```js
export StoryOne = ...;
StoryOne.story = {
  parameters: { actions: ['mouseover', 'click .btn'] },
}
```

#### Removed action decorator APIs

In 6.0 we removed the actions addon decorate API. Actions handles can be configured globally, for a collection of stories or per story via parameters. The ability to manipulate the data arguments of an event is only relevant in a few frameworks and is not a common enough usecase to be worth the complexity of supporting.

#### Removed withA11y decorator

In 6.0 we removed the `withA11y` decorator. The code that runs accessibility checks is now directly injected in the preview.

To configure a11y now, you have to specify configuration using story parameters, e.g. in `.storybook/preview.js`:

```js
export const parameters = {
  a11y: {
    element: '#storybook-root',
    config: {},
    options: {},
    manual: true,
  },
};
```

#### Essentials addon disables differently

In 6.0, `addon-essentials` doesn't configure addons if the user has already configured them in `main.js`. In 5.3 it previously checked to see whether the package had been installed in `package.json` to disable configuration. The new setup is preferably because now users' can install essential packages and import from them without disabling their configuration.

#### Backgrounds addon has a new api

Starting in 6.0, the backgrounds addon now receives an object instead of an array as parameter, with a property to define the default background.

Consider the following example of its usage in `Button.stories.js`:

```jsx
// Button.stories.js
export default {
  title: 'Button',
  parameters: {
    backgrounds: [
      { name: 'twitter', value: '#00aced', default: true },
      { name: 'facebook', value: '#3b5998' },
    ],
  },
};
```

Here's an updated version of the example, using the new api:

```jsx
// Button.stories.js
export default {
  title: 'Button',
  parameters: {
    backgrounds: {
      default: 'twitter',
      values: [
        { name: 'twitter', value: '#00aced' },
        { name: 'facebook', value: '#3b5998' },
      ],
    },
  },
};
```

In addition, backgrounds now ships with the following defaults:

- no selected background (transparent)
- light/dark options

### 6.0 Deprecations

We've deprecated the following in 6.0: `addon-info`, `addon-notes`, `addon-contexts`, `addon-centered`, `polymer`.

#### Deprecated addon-info, addon-notes

The info/notes addons have been replaced by [addon-docs](https://github.com/storybookjs/storybook/tree/next/addons/docs). We've documented a migration in the [docs recipes](https://github.com/storybookjs/storybook/blob/next/addons/docs/docs/recipes.md#migrating-from-notesinfo-addons).

Both addons are still widely used, and their source code is still available in the [deprecated-addons repo](https://github.com/storybookjs/deprecated-addons). We're looking for maintainers for both addons. If you're interested, please get in touch on [our Discord](https://discord.gg/storybook).

#### Deprecated addon-contexts

The contexts addon has been replaced by [addon-toolbars](https://github.com/storybookjs/storybook/blob/next/addons/toolbars), which is simpler, more ergonomic, and compatible with all Storybook frameworks.

The addon's source code is still available in the [deprecated-addons repo](https://github.com/storybookjs/deprecated-addons). If you're interested in maintaining it, please get in touch on [our Discord](https://discord.gg/storybook).

#### Removed addon-centered

In 6.0 we removed the centered addon. Centering is now core feature of storybook, so we no longer need an addon.

Remove the addon-centered decorator and instead add a `layout` parameter:

```js
export const MyStory = () => <div>my story</div>;
MyStory.story = {
  parameters: { layout: 'centered' },
};
```

Other possible values are: `padded` (default) and `fullscreen`.

#### Deprecated polymer

We've deprecated `@storybook/polymer` and are focusing on `@storybook/web-components`. If you use Polymer and are interested in maintaining it, please get in touch on [our Discord](https://discord.gg/storybook).

#### Deprecated immutable options parameters

The UI options `sidebarAnimations`, `enableShortcuts`, `theme`, `showRoots` should not be changed on a per-story basis, and as such there is no reason to set them via parameters.

You should use `addon.setConfig` to set them:

```js
// in .storybook/manager.js
import { addons } from '@storybook/addons';

addons.setConfig({
  showRoots: false,
});
```

#### Deprecated addParameters and addDecorator

The `addParameters` and `addDecorator` APIs to add global decorators and parameters, exported by the various frameworks (e.g. `@storybook/react`) and `@storybook/client` are now deprecated.

Instead, use `export const parameters = {};` and `export const decorators = [];` in your `.storybook/preview.js`. Addon authors similarly should use such an export in a preview entry file (see [Preview entries](https://github.com/storybookjs/storybook/blob/next/docs/addons/writing-presets.md#preview-entries)).

#### Deprecated clearDecorators

Similarly, `clearDecorators`, exported by the various frameworks (e.g. `@storybook/react`) is deprecated.

#### Deprecated configure

The `configure` API to load stories from `preview.js`, exported by the various frameworks (e.g. `@storybook/react`) is now deprecated.

To load stories, use the `stories` field in `main.js`. You can pass a glob or array of globs to load stories like so:

```js
// in .storybook/main.js
module.exports = {
  stories: ['../src/**/*.stories.js'],
};
```

You can also pass an array of single file names if you want to be careful about loading files:

```js
// in .storybook/main.js
module.exports = {
  stories: [
    '../src/components/Button.stories.js',
    '../src/components/Table.stories.js',
    '../src/components/Page.stories.js',
  ],
};
```

#### Deprecated support for duplicate kinds

In 6.0 we deprecated the ability to split a kind's (component's) stories into multiple files because it was causing issues in hot module reloading (HMR). It will likely be removed completely in 7.0.

If you had N stories that contained `export default { title: 'foo/bar' }` (or the MDX equivalent `<Meta title="foo/bar">`), Storybook will now raise the warning `Duplicate title '${kindName}' used in multiple files`.

To split a component's stories into multiple files, e.g. for the `foo/bar` example above:

- Create a single file with the `export default { title: 'foo/bar' }` export, which is the primary file
- Comment out or delete the default export from the other files
- Re-export the stories from the other files in the primary file

So the primary example might look like:

```js
export default { title: 'foo/bar' };
export * from './Bar1.stories'
export * from './Bar2.stories'
export * from './Bar3.stories'

export const SomeStory = () => ...;
```

## From version 5.2.x to 5.3.x

### To main.js configuration

In storybook 5.3 3 new files for configuration were introduced, that replaced some previous files.

These files are now soft-deprecated, (_they still work, but over time we will promote users to migrate_):

- `presets.js` has been renamed to `main.js`. `main.js` is the main point of configuration for storybook.
- `config.js` has been renamed to `preview.js`. `preview.js` configures the "preview" iframe that renders your components.
- `addons.js` has been renamed to `manager.js`. `manager.js` configures Storybook's "manager" UI that wraps the preview, and also configures addons panel.

#### Using main.js

`main.js` is now the main point of configuration for Storybook. This is what a basic `main.js` looks like:

```js
module.exports = {
  stories: ['../**/*.stories.js'],
  addons: ['@storybook/addon-knobs'],
};
```

You remove all "register" import from `addons.js` and place them inside the array. You can also safely remove the `/register` suffix from these entries, for a cleaner, more readable configuration. If this means `addons.js` is now empty for you, it's safe to remove.

Next you remove the code that imports/requires all your stories from `config.js`, and change it to a glob-pattern and place that glob in the `stories` array. If this means `config.js` is empty, it's safe to remove.

If you had a `presets.js` file before you can add the array of presets to the main.js file and remove `presets.js` like so:

```js
module.exports = {
  stories: ['../**/*.stories.js'],
  addons: [
    '@storybook/preset-create-react-app',
    {
      name: '@storybook/addon-docs',
      options: { configureJSX: true },
    },
  ],
};
```

By default, adding a package to the `addons` array will first try to load its `preset` entry, then its `register` entry, and finally, it will just assume the package itself is a preset.

If you want to load a specific package entry, for example you want to use `@storybook/addon-docs/register`, you can also include that in the addons array and Storybook will do the right thing.

#### Using preview.js

If after migrating the imports/requires of your stories to `main.js` you're left with some code in `config.js` it's likely the usage of `addParameters` & `addDecorator`.

This is fine, rename `config.js` to `preview.js`.

This file can also be used to inject global stylesheets, fonts etc, into the preview bundle.

#### Using manager.js

If you are setting storybook options in `config.js`, especially `theme`, you should migrate it to `manager.js`:

```js
import { addons } from '@storybook/addons';
import { create } from '@storybook/theming/create';

const theme = create({
  base: 'light',
  brandTitle: 'My custom title',
});

addons.setConfig({
  panelPosition: 'bottom',
  theme,
});
```

This makes storybook load and use the theme in the manager directly.
This allows for richer theming in the future, and has a much better performance!

> If you're using addon-docs, you should probably not do this. Docs uses the theme as well, but this change makes the theme inaccessible to addon-docs. We'll address this in 6.0.0.

### Create React App preset

You can now move to the new preset for [Create React App](https://create-react-app.dev/). The in-built preset for Create React App will be disabled in Storybook 6.0.

Simply install [`@storybook/preset-create-react-app`](https://github.com/storybookjs/presets/tree/master/packages/preset-create-react-app) and it will be used automatically.

### Description doc block

In 5.3 we've changed `addon-docs`'s `Description` doc block's default behavior. Technically this is a breaking change, but MDX was not officially released in 5.2 and we reserved the right to make small breaking changes. The behavior of `DocsPage`, which was officially released, remains unchanged.

The old behavior of `<Description of={Component} />` was to concatenate the info parameter or notes parameter, if available, with the docgen information loaded from source comments. If you depend on the old behavior, it's still available with `<Description of={Component} type='legacy-5.2' />`. This description type will be removed in Storybook 6.0.

The new default behavior is to use the framework-specific description extractor, which for React/Vue is still docgen, but may come from other places (e.g. a JSON file) for other frameworks.

The description doc block on DocsPage has also been updated. To see how to configure it in 5.3, please see [the updated recipe](https://github.com/storybookjs/storybook/blob/next/addons/docs/docs/recipes.md#migrating-from-notesinfo-addons)

### React Native Async Storage

Starting from version React Native 0.59, Async Storage is deprecated in React Native itself. The new @react-native-async-storage/async-storage module requires native installation, and we don't want to have it as a dependency for React Native Storybook.

To avoid that now you have to manually pass asyncStorage to React Native Storybook with asyncStorage prop. To notify users we are displaying a warning about it.

Solution:

- Use `require('@react-native-async-storage/async-storage').default` for React Native v0.59 and above.
- Use `require('react-native').AsyncStorage` for React Native v0.58 or below.
- Use `null` to disable Async Storage completely.

```javascript
getStorybookUI({
  ...
  asyncStorage: require('@react-native-async-storage/async-storage').default || require('react-native').AsyncStorage || null
});
```

The benefit of using Async Storage is so that when users refresh the app, Storybook can open their last visited story.

### Deprecate displayName parameter

In 5.2, the story parameter `displayName` was introduced as a publicly visible (but internal) API. Storybook's Component Story Format (CSF) loader used it to modify a story's display name independent of the story's `name`/`id` (which were coupled).

In 5.3, the CSF loader decouples the story's `name`/`id`, which means that `displayName` is no longer necessary. Unfortunately, this is a breaking change for any code that uses the story `name` field. Storyshots relies on story `name`, and the appropriate migration is to simply update your snapshots. Apologies for the inconvenience!

### Unified docs preset

Addon-docs configuration gets simpler in 5.3. In 5.2, each framework had its own preset, e.g. `@storybook/addon-docs/react/preset`. Starting in 5.3, everybody should use `@storybook/addon-docs/preset`.

### Simplified hierarchy separators

We've deprecated the ability to specify the hierarchy separators (how you control the grouping of story kinds in the sidebar). From Storybook 6.0 we will have a single separator `/`, which cannot be configured.

If you are currently using custom separators, we encourage you to migrate to using `/` as the sole separator. If you are using `|` or `.` as a separator currently, we provide a codemod, [`upgrade-hierarchy-separators`](https://github.com/storybookjs/storybook/blob/next/code/lib/codemod/README.md#upgrade-hierarchy-separators), that can be used to rename all your components.

```
yarn sb migrate upgrade-hierarchy-separators --glob="*.stories.js"
```

If you were using `|` and wish to keep the "root" behavior, use the `showRoots: true` option to re-enable roots:

```js
addParameters({
  options: {
    showRoots: true,
  },
});
```

NOTE: it is no longer possible to have some stories with roots and others without. If you want to keep the old behavior, simply add a root called "Others" to all your previously unrooted stories.

### Addon StoryShots Puppeteer uses external puppeteer

To give you more control on the Chrome version used when running StoryShots Puppeteer, `puppeteer` is no more included in the addon dependencies. So you can now pick the version of `puppeteer` you want and set it in your project.

If you want the latest version available just run:

```sh
yarn add puppeteer --dev
OR
npm install puppeteer --save-dev
```

## From version 5.1.x to 5.2.x

### Source-loader

Addon-storysource contains a loader, `@storybook/addon-storysource/loader`, which has been deprecated in 5.2. If you use it, you'll see the warning:

```
@storybook/addon-storysource/loader is deprecated, please use @storybook/source-loader instead.
```

To upgrade to `@storybook/source-loader`, run `npm install -D @storybook/source-loader` (or use `yarn`), and replace every instance of `@storybook/addon-storysource/loader` with `@storybook/source-loader`.

### Default viewports

The default viewports have been reduced to a smaller set, we think is enough for most use cases.
You can get the old default back by adding the following to your `config.js`:

```js
import { INITIAL_VIEWPORTS } from '@storybook/addon-viewport';

addParameters({
  viewport: {
    viewports: INITIAL_VIEWPORTS,
  },
});
```

### Grid toolbar-feature

The grid feature in the toolbar has been relocated to [addon-background](https://github.com/storybookjs/storybook/tree/next/addons/backgrounds), follow the setup instructions on that addon to get the feature again.

### Docs mode docgen

This isn't a breaking change per se, because `addon-docs` is a new feature. However it's intended to replace `addon-info`, so if you're migrating from `addon-info` there are a few things you should know:

1. Support for only one prop table
2. Prop table docgen info should be stored on the component and not in the global variable `STORYBOOK_REACT_CLASSES` as before.

### storySort option

In 5.0.x the global option `sortStoriesByKind` option was [inadvertently removed](#sortstoriesbykind). In 5.2 we've introduced a new option, `storySort`, to replace it. `storySort` takes a comparator function, so it is strictly more powerful than `sortStoriesByKind`.

For example, here's how to sort by story ID using `storySort`:

```js
addParameters({
  options: {
    storySort: (a, b) =>
      a[1].kind === b[1].kind ? 0 : a[1].id.localeCompare(b[1].id, undefined, { numeric: true }),
  },
});
```

## From version 5.1.x to 5.1.10

### babel.config.js support

SB 5.1.0 added [support for project root `babel.config.js` files](https://github.com/storybookjs/storybook/pull/6634), which was an [unintentional breaking change](https://github.com/storybookjs/storybook/issues/7058#issuecomment-515398228). 5.1.10 fixes this, but if you relied on project root `babel.config.js` support, this bugfix is a breaking change. The workaround is to copy the file into your `.storybook` config directory. We may add back project-level support in 6.0.

## From version 5.0.x to 5.1.x

### React native server

Storybook 5.1 contains a major overhaul of `@storybook/react-native` as compared to 4.1 (we didn't ship a version of RN in 5.0 due to timing constraints). Storybook for RN consists of an UI for browsing stories on-device or in a simulator, and an optional webserver which can also be used to browse stories and web addons.

5.1 refactors both pieces:

- `@storybook/react-native` no longer depends on the Storybook UI and only contains on-device functionality
- `@storybook/react-native-server` is a new package for those who wish to run a web server alongside their device UI

In addition, both packages share more code with the rest of Storybook, which will reduce bugs and increase compatibility (e.g. with the latest versions of babel, etc.).

As a user with an existing 4.1.x RN setup, no migration should be necessary to your RN app. Upgrading the library should be enough.

If you wish to run the optional web server, you will need to do the following migration:

- Add `babel-loader` as a dev dependency
- Add `@storybook/react-native-server` as a dev dependency
- Change your "storybook" `package.json` script from `storybook start [-p ...]` to `start-storybook [-p ...]`

And with that you should be good to go!

### Angular 7

Storybook 5.1 relies on `core-js@^3.0.0` and therefore causes a conflict with Angular 7 that relies on `core-js@^2.0.0`. In order to get Storybook running on Angular 7 you can either update to Angular 8 (which dropped `core-js` as a dependency) or follow these steps:

- Remove `node_modules/@storybook`
- `npm i core-js@^3.0.0` / `yarn add core-js@^3.0.0`
- Add the following paths to your `tsconfig.json`

```json
{
  "compilerOptions": {
    "paths": {
      "core-js/es7/reflect": ["node_modules/core-js/proposals/reflect-metadata"],
      "core-js/es6/*": ["node_modules/core-js/es"]
    }
  }
}
```

You should now be able to run Storybook and Angular 7 without any errors.

Reference issue: [https://github.com/angular/angular-cli/issues/13954](https://github.com/angular/angular-cli/issues/13954)

### CoreJS 3

Following the rest of the JS ecosystem, Storybook 5.1 upgrades [CoreJS](https://github.com/zloirock/core-js) 2 to 3, which is a breaking change.

This upgrade is problematic because many apps/libraries still rely on CoreJS 2, and many users get corejs-related errors due to bad resolution. To address this, we're using [corejs-upgrade-webpack-plugin](https://github.com/ndelangen/corejs-upgrade-webpack-plugin), which attempts to automatically upgrade code to CoreJS 3.

After a few iterations, this approach seems to be working. However, there are a few exceptions:

- If your app uses `babel-polyfill`, try to remove it

We'll update this section as we find more problem cases. If you have a `core-js` problem, please file an issue (preferably with a repro), and we'll do our best to get you sorted.

**Update**: [corejs-upgrade-webpack-plugin](https://github.com/ndelangen/corejs-upgrade-webpack-plugin) has been removed again after running into further issues as described in [https://github.com/storybookjs/storybook/issues/7445](https://github.com/storybookjs/storybook/issues/7445).

## From version 5.0.1 to 5.0.2

### Deprecate webpack extend mode

Exporting an object from your custom webpack config puts storybook in "extend mode".

There was a bad bug in `v5.0.0` involving webpack "extend mode" that caused webpack issues for users migrating from `4.x`. We've fixed this problem in `v5.0.2` but it means that extend-mode has a different behavior if you're migrating from `5.0.0` or `5.0.1`. In short, `4.x` extended a base config with the custom config, whereas `5.0.0-1` extended the base with a richer config object that could conflict with the custom config in different ways from `4.x`.

We've also deprecated "extend mode" because it doesn't add a lot of value over "full control mode", but adds more code paths, documentation, user confusion etc. Starting in SB6.0 we will only support "full control mode" customization.

To migrate from extend-mode to full-control mode, if your extend-mode webpack config looks like this:

```js
module.exports = {
  module: {
    rules: [
      /* ... */
    ],
  },
};
```

In full control mode, you need modify the default config to have the rules of your liking:

```js
module.exports = ({ config }) => ({
  ...config,
  module: {
    ...config.module,
    rules: [
      /* your own rules "..." here and/or some subset of config.module.rules */
    ],
  },
});
```

Please refer to the [current custom webpack documentation](https://storybook.js.org/docs/react/configure/webpack) for more information on custom webpack config and to [Issue #6081](https://github.com/storybookjs/storybook/issues/6081) for more information about the change.

## From version 4.1.x to 5.0.x

Storybook 5.0 includes sweeping UI changes as well as changes to the addon API and custom webpack configuration. We've tried to keep backwards compatibility in most cases, but there are some notable exceptions documented below.

### sortStoriesByKind

In Storybook 5.0 we changed a lot of UI related code, and 1 oversight caused the `sortStoriesByKind` options to stop working.
We're working on providing a better way of sorting stories for now the feature has been removed. Stories appear in the order they are loaded.

If you're using webpack's `require.context` to load stories, you can sort the execution of requires:

```js
var context = require.context('../stories', true, /\.stories\.js$/);
var modules = context.keys();

// sort them
var sortedModules = modules.slice().sort((a, b) => {
  // sort the stories based on filename/path
  return a < b ? -1 : a > b ? 1 : 0;
});

// execute them
sortedModules.forEach((key) => {
  context(key);
});
```

### Webpack config simplification

The API for custom webpack configuration has been simplified in 5.0, but it's a breaking change. Storybook's "full control mode" for webpack allows you to override the webpack config with a function that returns a configuration object.

In Storybook 5 there is a single signature for full-control mode that takes a parameters object with the fields `config` and `mode`:

```js
module.exports = ({ config, mode }) => { config.module.rules.push(...); return config; }
```

In contrast, the 4.x configuration function accepted either two or three arguments (`(baseConfig, mode)`, or `(baseConfig, mode, defaultConfig)`). The `config` object in the 5.x signature is equivalent to 4.x's `defaultConfig`.

Please see the [current custom webpack documentation](https://storybook.js.org/docs/react/configure/webpack) for more information on custom webpack config.

### Theming overhaul

Theming has been rewritten in v5. If you used theming in v4, please consult the [theming docs](https://storybook.js.org/docs/react/configure/theming) to learn about the new API.

### Story hierarchy defaults

Storybook's UI contains a hierarchical tree of stories that can be configured by `hierarchySeparator` and `hierarchyRootSeparator` [options](https://github.com/storybookjs/deprecated-addons/blob/master/MIGRATION.md#options-addon-deprecated).

In Storybook 4.x the values defaulted to `null` for both of these options, so that there would be no hierarchy by default.

In 5.0, we now provide recommended defaults:

```js
{
  hierarchyRootSeparator: '|',
  hierarchySeparator: /\/|\./,
}
```

This means if you use the characters { `|`, `/`, `.` } in your story kinds it will trigger the story hierarchy to appear. For example `storiesOf('UI|Widgets/Basics/Button')` will create a story root called `UI` containing a `Widgets/Basics` group, containing a `Button` component.

If you wish to opt-out of this new behavior and restore the flat UI, set them back to `null` in your storybook config, or remove { `|`, `/`, `.` } from your story kinds:

```js
addParameters({
  options: {
    hierarchyRootSeparator: null,
    hierarchySeparator: null,
  },
});
```

### Options addon deprecated

In 4.x we added story parameters. In 5.x we've deprecated the options addon in favor of [global parameters](https://storybook.js.org/docs/react/configure/features-and-behavior), and we've also renamed some of the options in the process (though we're maintaining backwards compatibility until 6.0).

Here's an old configuration:

```js
addDecorator(
  withOptions({
    name: 'Storybook',
    url: 'https://storybook.js.org',
    goFullScreen: false,
    addonPanelInRight: true,
  })
);
```

And here's its new counterpart:

```js
import { create } from '@storybook/theming/create';

addParameters({
  options: {
    theme: create({
      base: 'light',
      brandTitle: 'Storybook',
      brandUrl: 'https://storybook.js.org',
      // To control appearance:
      // brandImage: 'http://url.of/some.svg',
    }),
    isFullscreen: false,
    panelPosition: 'right',
    isToolshown: true,
  },
});
```

Here is the mapping from old options to new:

| Old               | New              |
| ----------------- | ---------------- |
| name              | theme.brandTitle |
| url               | theme.brandUrl   |
| goFullScreen      | isFullscreen     |
| showStoriesPanel  | showNav          |
| showAddonPanel    | showPanel        |
| addonPanelInRight | panelPosition    |
| showSearchBox     |                  |
|                   | isToolshown      |

Storybook v5 removes the search dialog box in favor of a quick search in the navigation view, so `showSearchBox` has been removed.

Storybook v5 introduce a new tool bar above the story view and you can show\hide it with the new `isToolshown` option.

### Individual story decorators

The behavior of adding decorators to a kind has changed in SB5 ([#5781](https://github.com/storybookjs/storybook/issues/5781)).

In SB4 it was possible to add decorators to only a subset of the stories of a kind.

```js
storiesOf('Stories', module)
  .add('noncentered', () => 'Hello')
  .addDecorator(centered)
  .add('centered', () => 'Hello');
```

The semantics has changed in SB5 so that calling `addDecorator` on a kind adds a decorator to all its stories, no matter the order. So in the previous example, both stories would be centered.

To allow for a subset of the stories in a kind to be decorated, we've added the ability to add decorators to individual stories using parameters:

```js
storiesOf('Stories', module)
  .add('noncentered', () => 'Hello')
  .add('centered', () => 'Hello', { decorators: [centered] });
```

### Addon backgrounds uses parameters

Similarly, `@storybook/addon-backgrounds` uses parameters to pass background options. If you previously had:

```js
import { withBackgrounds } from `@storybook/addon-backgrounds`;

storiesOf('Stories', module)
  .addDecorator(withBackgrounds(options));
```

You should replace it with:

```js
storiesOf('Stories', module).addParameters({ backgrounds: options });
```

You can pass `backgrounds` parameters at the global level (via `addParameters` imported from `@storybook/react` et al.), and the story level (via the third argument to `.add()`).

### Addon cssresources name attribute renamed

In the options object for `@storybook/addon-cssresources`, the `name` attribute for each resource has been renamed to `id`. If you previously had:

```js
import { addDecorator } from '@storybook/react';
import { withCssResources } from '@storybook/addon-cssresources';

addDecorator(
  withCssResources({
    cssresources: [
      {
        name: `bluetheme`, // Previous
        code: `<style>body { background-color: lightblue; }</style>`,
        picked: false,
      },
    ],
  })
);
```

You should replace it with:

```js
import { addDecorator } from '@storybook/react';
import { withCssResources } from '@storybook/addon-cssresources';

addDecorator(
  withCssResources({
    cssresources: [
      {
        id: `bluetheme`, // Renamed
        code: `<style>body { background-color: lightblue; }</style>`,
        picked: false,
      },
    ],
  })
);
```

### Addon viewport uses parameters

Similarly, `@storybook/addon-viewport` uses parameters to pass viewport options. If you previously had:

```js
import { configureViewport } from `@storybook/addon-viewport`;

configureViewport(options);
```

You should replace it with:

```js
import { addParameters } from '@storybook/react';

// or others

addParameters({ viewport: options });
```

The `withViewport` decorator is also no longer supported and should be replaced with a parameter based API as above. Also the `onViewportChange` callback is no longer supported.

See the [viewport addon README](https://github.com/storybookjs/storybook/blob/master/addons/viewport/README.md) for more information.

### Addon a11y uses parameters, decorator renamed

Similarly, `@storybook/addon-a11y` uses parameters to pass a11y options. If you previously had:

```js
import { configureA11y } from `@storybook/addon-a11y`;

configureA11y(options);
```

You should replace it with:

```js
import { addParameters } from '@storybook/react';

// or others

addParameters({ a11y: options });
```

You can also pass `a11y` parameters at the component level (via `storiesOf(...).addParameters`), and the story level (via the third argument to `.add()`).

Furthermore, the decorator `checkA11y` has been deprecated and renamed to `withA11y` to make it consistent with other Storybook decorators.

See the [a11y addon README](https://github.com/storybookjs/storybook/blob/master/addons/a11y/README.md) for more information.

### Addon centered decorator deprecated

If you previously had:

```js
import centered from '@storybook/addon-centered';
```

You should replace it with the React or Vue version as appropriate

```js
import centered from '@storybook/addon-centered/react';
```

or

```js
import centered from '@storybook/addon-centered/vue';
```

### New keyboard shortcuts defaults

Storybook's keyboard shortcuts are updated in 5.0, but they are configurable via the menu so if you want to set them back you can:

| Shortcut               | Old         | New   |
| ---------------------- | ----------- | ----- |
| Toggle sidebar         | cmd-shift-X | S     |
| Toggle addons panel    | cmd-shift-Z | A     |
| Toggle addons position | cmd-shift-G | D     |
| Toggle fullscreen      | cmd-shift-F | F     |
| Next story             | cmd-shift-→ | alt-→ |
| Prev story             | cmd-shift-← | alt-← |
| Next component         |             | alt-↓ |
| Prev component         |             | alt-↑ |
| Search                 |             | /     |

### New URL structure

We've update Storybook's URL structure in 5.0. The old structure used URL parameters to save the UI state, resulting in long ugly URLs. v5 respects the old URL parameters, but largely does away with them.

The old structure encoded `selectedKind` and `selectedStory` among other parameters. Storybook v5 respects these parameters but will issue a deprecation message in the browser console warning of potential future removal.

The new URL structure looks like:

```
https://url-of-storybook?path=/story/<storyId>
```

The structure of `storyId` is a slugified `<selectedKind>--<selectedStory>` (slugified = lowercase, hyphen-separated). Each `storyId` must be unique. We plan to build more features into Storybook in upcoming versions based on this new structure.

### Rename of the `--secure` cli parameter to `--https`

Storybook for React Native's start commands & the Web versions' start command were a bit different, for no reason.
We've changed the start command for Reactnative to match the other.

This means that when you previously used the `--secure` flag like so:

```sh
start-storybook --secure
# or
start-storybook --s
```

You have to replace it with:

```sh
start-storybook --https
```

### Vue integration

The Vue integration was updated, so that every story returned from a story or decorator function is now being normalized with `Vue.extend` **and** is being wrapped by a functional component. Returning a string from a story or decorator function is still supported and is treated as a component with the returned string as the template.

Currently there is no recommended way of accessing the component options of a story inside a decorator.

## From version 4.0.x to 4.1.x

There are a few migrations you should be aware of in 4.1, including one unintentionally breaking change for advanced addon usage.

### Private addon config

If your Storybook contains custom addons defined that are defined in your app (as opposed to installed from packages) and those addons rely on reconfiguring webpack/babel, Storybook 4.1 may break for you. There's a workaround [described in the issue](https://github.com/storybookjs/storybook/issues/4995), and we're working on official support in the next release.

### React 15.x

Storybook 4.1 supports React 15.x (which had been [lost in the 4.0 release](#react-163)). So if you've been blocked on upgrading, we've got you covered. You should be able to upgrade according to the 4.0 migration notes below, or following the [4.0 upgrade guide](https://medium.com/storybookjs/migrating-to-storybook-4-c65b19a03d2c).

## From version 3.4.x to 4.0.x

With 4.0 as our first major release in over a year, we've collected a lot of cleanup tasks. Most of the deprecations have been marked for months, so we hope that there will be no significant impact on your project. We've also created a [step-by-step guide to help you upgrade](https://medium.com/storybookjs/migrating-to-storybook-4-c65b19a03d2c).

### React 16.3+

Storybook uses [Emotion](https://emotion.sh/) for styling which currently requires React 16.3 and above.

If you're using Storybook for anything other than React, you probably don't need to worry about this.

However, if you're developing React components, this means you need to upgrade to 16.3 or higher to use Storybook 4.0.

> **NOTE:** This is a temporary requirement, and we plan to restore 15.x compatibility in a near-term 4.x release.

Also, here's the error you'll get if you're running an older version of React:

```

core.browser.esm.js:15 Uncaught TypeError: Object(...) is not a function
at Module../node_modules/@emotion/core/core.browser.esm.js (core.browser.esm.js:15)
at **webpack_require** (bootstrap:724)
at fn (bootstrap:101)
at Module../node_modules/@emotion/styled-base/dist/styled-base.browser.esm.js (styled-base.browser.esm.js:1)
at **webpack_require** (bootstrap:724)
at fn (bootstrap:101)
at Module../node_modules/@emotion/styled/dist/styled.esm.js (styled.esm.js:1)
at **webpack_require** (bootstrap:724)
at fn (bootstrap:101)
at Object../node_modules/@storybook/components/dist/navigation/MenuLink.js (MenuLink.js:12)

```

### Generic addons

4.x introduces generic addon decorators that are not tied to specific view layers [#3555](https://github.com/storybookjs/storybook/pull/3555). So for example:

```js
import { number } from '@storybook/addon-knobs/react';
```

Becomes:

```js
import { number } from '@storybook/addon-knobs';
```

### Knobs select ordering

4.0 also reversed the order of addon-knob's `select` knob keys/values, which had been called `selectV2` prior to this breaking change. See the knobs [package README](https://github.com/storybookjs/storybook/blob/master/addons/knobs/README.md#select) for usage.

### Knobs URL parameters

Addon-knobs no longer updates the URL parameters interactively as you edit a knob. This is a UI change but it shouldn't break any code because old URLs are still supported.

In 3.x, editing knobs updated the URL parameters interactively. The implementation had performance and architectural problems. So in 4.0, we changed this to a "copy" button in the addon which generates a URL with the updated knob values and copies it to the clipboard.

### Keyboard shortcuts moved

- Addon Panel to `Z`
- Stories Panel to `X`
- Show Search to `O`
- Addon Panel right side to `G`

### Removed addWithInfo

`Addon-info`'s `addWithInfo` has been marked deprecated since 3.2. In 4.0 we've removed it completely. See the package [README](https://github.com/storybookjs/storybook/blob/master/addons/info/README.md) for the proper usage.

### Removed RN packager

Since storybook version v4.0 packager is removed from storybook. The suggested storybook usage is to include it inside your app.
If you want to keep the old behaviour, you have to start the packager yourself with a different project root.
`npm run storybook start -p 7007 | react-native start --projectRoot storybook`

Removed cli options: `--packager-port --root --projectRoots -r, --reset-cache --skip-packager --haul --platform --metro-config`

### Removed RN addons

The `@storybook/react-native` had built-in addons (`addon-actions` and `addon-links`) that have been marked as deprecated since 3.x. They have been fully removed in 4.x. If your project still uses the built-ins, you'll need to add explicit dependencies on `@storybook/addon-actions` and/or `@storybook/addon-links` and import directly from those packages.

### Storyshots Changes

1. `imageSnapshot` test function was extracted from `addon-storyshots`
   and moved to a new package - `addon-storyshots-puppeteer` that now will
   be dependent on puppeteer. [README](https://github.com/storybookjs/storybook/tree/master/addons/storyshots/storyshots-puppeteer)
2. `getSnapshotFileName` export was replaced with the `Stories2SnapsConverter`
   class that now can be overridden for a custom implementation of the
   snapshot-name generation. [README](https://github.com/storybookjs/storybook/tree/master/addons/storyshots/storyshots-core#stories2snapsconverter)
3. Storybook that was configured with Webpack's `require.context()` feature
   will need to add a babel plugin to polyfill this functionality.
   A possible plugin might be [babel-plugin-require-context-hook](https://github.com/smrq/babel-plugin-require-context-hook).
   [README](https://github.com/storybookjs/storybook/tree/master/addons/storyshots/storyshots-core#configure-jest-to-work-with-webpacks-requirecontext)

### Webpack 4

Storybook now uses webpack 4. If you have a [custom webpack config](https://storybook.js.org/docs/react/configure/webpack), make sure that all the loaders and plugins you use support webpack 4.

### Babel 7

Storybook now uses Babel 7. There's a couple of cases when it can break with your app:

- If you aren't using Babel yourself, and don't have .babelrc, install following dependencies:

  ```
  npm i -D @babel/core babel-loader@latest
  ```

- If you're using Babel 6, make sure that you have direct dependencies on `babel-core@6` and `babel-loader@7` and that you have a `.babelrc` in your project directory.

### Create-react-app

If you are using `create-react-app` (aka CRA), you may need to do some manual steps to upgrade, depending on the setup.

- `create-react-app@1` may require manual migrations.
  - If you're adding storybook for the first time: `sb init` should add the correct dependencies.
  - If you're upgrading an existing project, your `package.json` probably already uses Babel 6, making it incompatible with `@storybook/react@4` which uses Babel 7. There are two ways to make it compatible, each of which is spelled out in detail in the next section:
    - Upgrade to Babel 7 if you are not dependent on Babel 6-specific features.
    - Migrate Babel 6 if you're heavily dependent on some Babel 6-specific features).
- `create-react-app@2` should be compatible as is, since it uses babel 7.

#### Upgrade CRA1 to babel 7

```
yarn remove babel-core babel-runtime
yarn add @babel/core babel-loader --dev
```

#### Migrate CRA1 while keeping babel 6

```
yarn add babel-loader@7
```

Also, make sure you have a `.babelrc` in your project directory. You probably already do if you are using Babel 6 features (otherwise you should consider upgrading to Babel 7 instead). If you don't have one, here's one that works:

```json
{
  "presets": ["env", "react"]
}
```

### start-storybook opens browser

If you're using `start-storybook` on CI, you may need to opt out of this using the new `--ci` flag.

### CLI Rename

We've deprecated the `getstorybook` CLI in 4.0. The new way to install storybook is `sb init`. We recommend using `npx` for convenience and to make sure you're always using the latest version of the CLI:

```
npx -p @storybook/cli sb init
```

### Addon story parameters

Storybook 4 introduces story parameters, a more convenient way to configure how addons are configured.

```js
storiesOf('My component', module)
  .add('story1', withNotes('some notes')(() => <Component ... />))
  .add('story2', withNotes('other notes')(() => <Component ... />));
```

Becomes:

```js
// config.js
addDecorator(withNotes);

// Component.stories.js
storiesOf('My component', module)
  .add('story1', () => <Component ... />, { notes: 'some notes' })
  .add('story2', () => <Component ... />, { notes: 'other notes' });
```

This example applies notes globally to all stories. You can apply it locally with `storiesOf(...).addDecorator(withNotes)`.

The story parameters correspond directly to the old withX arguments, so it's less demanding to migrate your code. See the parameters documentation for the packages that have been upgraded:

- [Notes](https://github.com/storybookjs/storybook/blob/master/addons/notes/README.md)
- [Jest](https://github.com/storybookjs/storybook/blob/master/addons/jest/README.md)
- [Knobs](https://github.com/storybookjs/storybook/blob/master/addons/knobs/README.md)
- [Viewport](https://github.com/storybookjs/storybook/blob/master/addons/viewport/README.md)
- [Backgrounds](https://github.com/storybookjs/storybook/blob/master/addons/backgrounds/README.md)
- [Options](https://github.com/storybookjs/storybook/blob/master/addons/options/README.md)

## From version 3.3.x to 3.4.x

There are no expected breaking changes in the 3.4.x release, but 3.4 contains a major refactor to make it easier to support new frameworks, and we will document any breaking changes here if they arise.

## From version 3.2.x to 3.3.x

It wasn't expected that there would be any breaking changes in this release, but unfortunately it turned out that there are some. We're revisiting our [release strategy](https://github.com/storybookjs/storybook/blob/master/RELEASES.md) to follow semver more strictly.
Also read on if you're using `addon-knobs`: we advise an update to your code for efficiency's sake.

### `babel-core` is now a peer dependency #2494

This affects you if you don't use babel in your project. You may need to add `babel-core` as dev dependency:

```sh
yarn add babel-core --dev
```

This was done to support different major versions of babel.

### Base webpack config now contains vital plugins #1775

This affects you if you use custom webpack config in [Full Control Mode](https://storybook.js.org/docs/react/configure/webpack#full-control-mode) while not preserving the plugins from `storybookBaseConfig`. Before `3.3`, preserving them was a recommendation, but now it [became](https://github.com/storybookjs/storybook/pull/2578) a requirement.

### Refactored Knobs

Knobs users: there was a bug in 3.2.x where using the knobs addon imported all framework runtimes (e.g. React and Vue). To fix the problem, we [refactored knobs](https://github.com/storybookjs/storybook/pull/1832). Switching to the new style is only takes one line of code.

In the case of React or React-Native, import knobs like this:

```js
import { withKnobs, text, boolean, number } from '@storybook/addon-knobs/react';
```

In the case of Vue: `import { ... } from '@storybook/addon-knobs/vue';`

In the case of Angular: `import { ... } from '@storybook/addon-knobs/angular';`

## From version 3.1.x to 3.2.x

**NOTE:** technically this is a breaking change, but only if you use TypeScript. Sorry people!

### Moved TypeScript addons definitions

TypeScript users: we've moved the rest of our addons type definitions into [DefinitelyTyped](http://definitelytyped.org/). Starting in 3.2.0 make sure to use the right addons types:

```sh
yarn add @types/storybook__addon-notes @types/storybook__addon-options @types/storybook__addon-knobs @types/storybook__addon-links --dev
```

See also [TypeScript definitions in 3.1.x](#moved-typescript-definitions).

### Updated Addons API

We're in the process of upgrading our addons APIs. As a first step, we've upgraded the Info and Notes addons. The old API will still work with your existing projects but will be deprecated soon and removed in Storybook 4.0.

Here's an example of using Notes and Info in 3.2 with the new API.

```js
storiesOf('composition', module).add(
  'new addons api',
  withInfo('see Notes panel for composition info')(
    withNotes({ text: 'Composition: Info(Notes())' })((context) => (
      <MyComponent name={context.story} />
    ))
  )
);
```

It's not beautiful, but we'll be adding a more convenient/idiomatic way of using these [withX primitives](https://gist.github.com/shilman/792dc25550daa9c2bf37238f4ef7a398) in Storybook 3.3.

## From version 3.0.x to 3.1.x

**NOTE:** technically this is a breaking change and should be a 4.0.0 release according to semver. However, we're still figuring things out and didn't think this change necessitated a major release. Please bear with us!

### Moved TypeScript definitions

TypeScript users: we are in the process of moving our typescript definitions into [DefinitelyTyped](http://definitelytyped.org/). If you're using TypeScript, starting in 3.1.0 you need to make sure your type definitions are installed:

```sh
yarn add @types/node @types/react @types/storybook__react --dev
```

### Deprecated head.html

We have deprecated the use of `head.html` for including scripts/styles/etc. into stories, though it will still work with a warning.

Now we use:

- `preview-head.html` for including extra content into the preview pane.
- `manager-head.html` for including extra content into the manager window.

[Read our docs](https://storybook.js.org/docs/react/configure/story-rendering#adding-to-head) for more details.

## From version 2.x.x to 3.x.x

This major release is mainly an internal restructuring.
Upgrading requires work on behalf of users, this was unavoidable.
We're sorry if this inconveniences you, we have tried via this document and provided tools to make the process as easy as possible.

### Webpack upgrade

Storybook will now use webpack 2 (and only webpack 2).
If you are using a custom `webpack.config.js` you need to change this to be compatible.
You can find the guide to upgrading your webpack config [on webpack.js.org](https://webpack.js.org/guides/migrating/).

### Packages renaming

All our packages have been renamed and published to npm as version 3.0.0 under the `@storybook` namespace.

To update your app to use the new package names, you can use the cli:

```bash
npx -p @storybook/cli sb init
```

**Details**

If the above doesn't work, or you want to make the changes manually, the details are below:

> We have adopted the same versioning strategy that has been adopted by babel, jest and apollo.
> It's a strategy best suited for ecosystem type tools, which consist of many separately installable features / packages.
> We think this describes storybook pretty well.

The new package names are:

| old                                          | new                              |
| -------------------------------------------- | -------------------------------- |
| `getstorybook`                               | `@storybook/cli`                 |
| `@kadira/getstorybook`                       | `@storybook/cli`                 |
|                                              |                                  |
| `@kadira/storybook`                          | `@storybook/react`               |
| `@kadira/react-storybook`                    | `@storybook/react`               |
| `@kadira/react-native-storybook`             | `@storybook/react-native`        |
|                                              |                                  |
| `storyshots`                                 | `@storybook/addon-storyshots`    |
| `@kadira/storyshots`                         | `@storybook/addon-storyshots`    |
|                                              |                                  |
| `@kadira/storybook-ui`                       | `@storybook/ui`                  |
| `@kadira/storybook-addons`                   | `@storybook/addons`              |
| `@kadira/storybook-channels`                 | `@storybook/channels`            |
| `@kadira/storybook-channel-postmsg`          | `@storybook/channel-postmessage` |
| `@kadira/storybook-channel-websocket`        | `@storybook/channel-websocket`   |
|                                              |                                  |
| `@kadira/storybook-addon-actions`            | `@storybook/addon-actions`       |
| `@kadira/storybook-addon-links`              | `@storybook/addon-links`         |
| `@kadira/storybook-addon-info`               | `@storybook/addon-info`          |
| `@kadira/storybook-addon-knobs`              | `@storybook/addon-knobs`         |
| `@kadira/storybook-addon-notes`              | `@storybook/addon-notes`         |
| `@kadira/storybook-addon-options`            | `@storybook/addon-options`       |
| `@kadira/storybook-addon-graphql`            | `@storybook/addon-graphql`       |
| `@kadira/react-storybook-decorator-centered` | `@storybook/addon-centered`      |

If your codebase is small, it's probably doable to replace them by hand (in your codebase and in `package.json`).

But if you have a lot of occurrences in your codebase, you can use a [codemod we created](./code/lib/codemod) for you.

> A codemod makes automatic changed to your app's code.

You have to change your `package.json`, prune old and install new dependencies by hand.

`npm prune` will remove all dependencies from `node_modules` which are no longer referenced in `package.json`.

### Deprecated embedded addons

We used to ship 2 addons with every single installation of storybook: `actions` and `links`. But in practice not everyone is using them, so we decided to deprecate this and in the future, they will be completely removed. If you use `@storybook/react/addons` you will get a deprecation warning.

If you **are** using these addons, it takes two steps to migrate:

- add the addons you use to your `package.json`.
- update your code:
  change `addons.js` like so:

  ```js
  import '@storybook/addon-actions/register';
  import '@storybook/addon-links/register';
  ```

  change `x.story.js` like so:

  ```js
  import React from 'react';
  import { storiesOf } from '@storybook/react';
  import { action } from '@storybook/addon-actions';
  import { linkTo } from '@storybook/addon-links';
  ```

  <!-- markdown-link-check-enable -->
