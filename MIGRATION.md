<h1>Migration</h1>

- [From version 8.4.x to 8.5.x](#from-version-84x-to-85x)
  - [Indexing behavior of @storybook/experimental-addon-test is changed](#indexing-behavior-of-storybookexperimental-addon-test-is-changed)
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
  - [Core changes](#core-changes)
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
  - [Framework-specific changes](#framework-specific-changes)
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

## From version 8.4.x to 8.5.x

### Indexing behavior of @storybook/experimental-addon-test is changed

The Storybook test addon used to index stories based on the `test.include` field in the Vitest config file. This caused indexing issues with Storybook, because stories could have been indexed by Storybook and not Vitest, and vice versa. Starting in Storybook 8.5.0-alpha.18, we changed the indexing behavior so that it always uses the globs defined in the `stories` field in `.storybook/main.js` for a more consistent experience. It is now discouraged to use `test.include`, please remove it.

## From version 8.2.x to 8.3.x

### Removed `experimental_SIDEBAR_BOTTOM` and deprecated `experimental_SIDEBAR_TOP` addon types

The experimental SIDEBAR_BOTTOM addon type was removed in favor of a built-in filter UI. The enum type definition will remain available until Storybook 9.0 but will be ignored. Similarly the experimental SIDEBAR_TOP addon type is deprecated and will be removed in a future version.

These APIs allowed addons to render arbitrary content in the Storybook sidebar. Due to potential conflicts between addons and challenges regarding styling, these APIs are/will be removed. In the future, Storybook will provide declarative API hooks to allow addons to add content to the sidebar without risk of conflicts or UI inconsistencies. One such API is `experimental_updateStatus` which allow addons to set a status for stories. The SIDEBAR_BOTTOM slot is now used to allow filtering stories with a given status.

### New parameters format for addon backgrounds

> [!NOTE]
> You need to set the feature flag `backgroundsStoryGlobals` to `true` in your `.storybook/main.ts` to use the new format and set the value with `globals`.
>
> See here how to set feature flags: https://storybook.js.org/docs/api/main-config/main-config-features

The `addon-backgrounds` addon now uses a new format for configuring its list of selectable backgrounds.
The `backgrounds` parameter is now an object with an `options` property.
This `options` object is a key-value pair where the key is used when setting the global value, the value is an object with a `name` and `value` property.

```diff
// .storybook/preview.js
export const parameters = {
  backgrounds: {
-   values: [
-     { name: 'twitter', value: '#00aced' },
-     { name: 'facebook', value: '#3b5998' },
-   ],
+   options: {
+     twitter: { name: 'Twitter', value: '#00aced' },
+     facebook: { name: 'Facebook', value: '#3b5998' },
+   },
  },
};
```

Setting an override value should now be done via a `globals` property on your component/meta or story itself:

```diff
// Button.stories.ts
export default {
  component: Button,
- parameters: {
-   backgrounds: {
-     default: "twitter",
-   },
- },
+ globals: {
+   backgrounds: { value: "twitter" },
+ },
};
```

This locks that story to the `twitter` background, it cannot be changed by the addon UI.

### New parameters format for addon viewport

> [!NOTE]
> You need to set the feature flag `viewportStoryGlobals` to `true` in your `.storybook/main.ts` to use the new format and set the value with `globals`.
>
> See here how to set feature flags: https://storybook.js.org/docs/api/main-config/main-config-features

The `addon-viewport` addon now uses a new format for configuring its list of selectable viewports.
The `viewport` parameter is now an object with an `options` property.
This `options` object is a key-value pair where the key is used when setting the global value, the value is an object with a `name` and `styles` property.
The `styles` property is an object with a `width` and a `height` property.

```diff
// .storybook/preview.js
export const parameters = {
  viewport: {
-   viewports: {
-     iphone5: {
-       name: 'phone',
-       styles: {
-         width: '320px',
-         height: '568px',
-       },
-     },
-    },
+   options: {
+     iphone5: {
+       name: 'phone',
+       styles: {
+         width: '320px',
+         height: '568px',
+       },
+     },
+   },
  },
};
```

Setting an override value should now be done via a `globals` property on your component/meta or story itself.
Also note the change from `defaultOrientation: "landscape"` to `isRotated: true`.

```diff
// Button.stories.ts
export default {
  component: Button,
- parameters: {
-   viewport: {
-     defaultViewport: "iphone5",
-     defaultOrientation: "landscape",
-   },
- },
+ globals: {
+   viewport: {
+     value: "iphone5",
+     isRotated: true,
+   },
+ },
};
```

This locks that story to the `iphone5` viewport in landscape orientation, it cannot be changed by the addon UI.

## From version 8.1.x to 8.2.x

### Failed to resolve import "@storybook/X" error

Storybook's package structure changed in 8.2. It is a non-breaking change, but can expose missing project dependencies.

This happens when `@storybook/X` is missing in your `package.json`, but your project references `@storybook/X` in your source code (typically in a story file or in a `.storybook` config file). This is a problem with your project, and if it worked in earlier versions of Storybook, it was purely accidental.

Now in Storybook 8.2, that incorrect project configuration no longer works. The solution is to install `@storybook/X` as a dev dependency and re-run.

Example errors:

```sh
Cannot find module @storybook/preview-api or its corresponding type declarations
```

```sh
Internal server error: Failed to resolve import "@storybook/theming/create" from ".storybook/theme.ts". Does the file exist?
```

To protect your project from missing dependencies, try the `no-extraneous-dependencies` rule in [eslint-plugin-import](https://www.npmjs.com/package/eslint-plugin-import).

### Preview.js globals renamed to initialGlobals

Starting in 8.2 `preview.js` `globals` are deprecated and have been renamed to `initialGlobals`. We will remove `preview.js` `globals` in 9.0.

```diff
// .storybook/preview.js
export default {
-  globals: [ a: 1, b: 2 ],
+  initialGlobals: [ a: 1, b: 2 ],
}
```

## From version 8.0.x to 8.1.x

### Portable stories

#### @storybook/nextjs requires specific path aliases to be setup

In order to properly mock the `next/router`, `next/header`, `next/navigation` and `next/cache` APIs, the `@storybook/nextjs` framework includes internal Webpack aliases to those modules. If you use portable stories in your Jest tests, you should set the aliases in your Jest config files `moduleNameMapper` property using the `getPackageAliases` helper from `@storybook/nextjs/export-mocks`:

```js
const nextJest = require("next/jest.js");
const { getPackageAliases } = require("@storybook/nextjs/export-mocks");
const createJestConfig = nextJest();
const customJestConfig = {
  moduleNameMapper: {
    ...getPackageAliases(), // Add aliases for @storybook/nextjs mocks
  },
};
module.exports = createJestConfig(customJestConfig);
```

This will make sure you end using the correct implementation of the packages and avoid having issues in your tests.

### main.js `docs.autodocs` is deprecated

The `docs.autodocs` setting in `main.js` is deprecated in 8.1 and will be removed in 9.0.

It has been replaced with a tags-based system which is more flexible than before.

`docs.autodocs` takes three values:

- `true`: generate autodocs for every component
- `false`: don't generate autodocs at all
- `tag`: generate autodocs for components that have been tagged `'autodocs'`.

Starting in 8.1, to generate autodocs for every component (`docs.autodocs = true`), add the following code to `.storybook/preview.js`:

```js
// .storybook/preview.js
export default {
  tags: ["autodocs"],
};
```

Tags cascade, so setting `'autodocs'` at the project level automatically propagates to every component and story. If you set autodocs globally and want to opt-out for a particular component, you can remove the `'autodocs'` tag for a component like this:

```js
// Button.stories.ts
export default {
  component: Button,
  tags: ["!autodocs"],
};
```

If you had set `docs.autodocs = 'tag'`, the default setting, you can remove the setting from `.storybook/main.js`. That is now the default behavior.

If you had set `docs.autodocs = false`, this still works in 8.x, but will go away in 9.0 as a breaking change. If you don't want autodocs at all, simply remove the `'autodocs'` tag throughout your Storybook and autodocs will not be created.

### `docs` and `story` system tags removed

Storybook automatically added the tag `'docs'` to any docs entry in the index and `'story'` to any story entry in the index. This behavior was undocumented, and in an effort to reduce the number of tags we've removed them in 8.1. If you depended on these tags, please file an issue on the [Storybook monorepo](https://github.com/storybookjs/storybook) and let us know!

### Subtitle block and `parameters.componentSubtitle`

The `Subtitle` block now accepts an `of` prop, which can be a reference to a CSF file or a default export (meta).

`parameters.componentSubtitle` has been deprecated to be consistent with other parameters related to autodocs, instead use `parameters.docs.subtitle`.

### Title block `of` prop

The `Title` block now accepts an `of` prop, which can be a reference to a CSF file or a default export (meta).

It still accepts being passed `children`.

## From version 7.x to 8.0.0

### Portable stories

#### Project annotations are now merged instead of overwritten in composeStory

When passing project annotations overrides via `composeStory` such as:

```tsx
const projectAnnotationOverrides = { parameters: { foo: "bar" } };
const Primary = composeStory(
  stories.Primary,
  stories,
  projectAnnotationOverrides
);
```

they are now merged with the annotations passed via `setProjectAnnotations` rather than completely overwriting them. This was seen as a bug and it's now fixed. If you have a use case where you really need this, please open an issue to elaborate.

#### Type change in `composeStories` API

There is a TypeScript type change in the `play` function returned from `composeStories` or `composeStory` in `@storybook/react` or `@storybook/vue3`, where before it was always defined, now it is potentially undefined. This means that you might have to make a small change in your code, such as:

```ts
const { Primary } = composeStories(stories)

// before
await Primary.play(...)

// after
await Primary.play?.(...) // if you don't care whether the play function exists
await Primary.play!(...) // if you want a runtime error when the play function does not exist
```

There are plans to make the type of the play function be inferred based on your imported story's play function in a near future, so the types will be 100% accurate.

#### Composed Vue stories are now components instead of functions

`composeStory` (and `composeStories`) from `@storybook/vue3` now return Vue components rather than story functions that return components. This means that when rendering these composed stories you just pass the composed story _without_ first calling it.

Previously when using `composeStory` from `@storybook/testing-vue3`, you would render composed stories with e.g. `render(MyStoryComposedStory({ someProp: true}))`. That is now changed to more [closely match how you would render regular Vue components](https://testing-library.com/docs/vue-testing-library/examples).

When migrating from `@storybook/testing-vue3`, you will likely hit the following error:

```ts
TypeError: Cannot read properties of undefined (reading 'devtoolsRawSetupState')
```

To fix it, you should change the usage of the composed story to reference it instead of calling it as a function. Here's an example using `@testing-library/vue` and Vitest:

```diff
import { it } from 'vitest';
import { render } from '@testing-library/vue';
import * as stories from './Button.stories';
import { composeStory } from '@storybook/vue3';

it('renders primary button', () => {
  const Primary = composeStory(stories.Primary, stories.default);
-  render(Primary({ label: 'Hello world' }));
+  render(Primary, { props: { label: 'Hello world' } });
});
```

### Tab addons are now routed to a query parameter

The URL of a tab used to be: `http://localhost:6006/?path=/my-addon-tab/my-story`.

The new URL of a tab is `http://localhost:6006/?path=/story/my-story&tab=my-addon-tab`.

### Default keyboard shortcuts changed

The default keyboard shortcuts have changed to avoid any conflicts with the browser's default shortcuts or when you are directly typing in the Manager. If you want to get the new default shortcuts, you can reset your shortcuts in the keyboard shortcuts panel by pressing the `Restore default` button.

### Manager addons are now rendered with React 18

The UI added to the manager via addons is now rendered with React 18.

Example:

```tsx
import { addons, types } from "@storybook/manager-api";

addons.register("my-addon", () => {
  addons.add("my-addon/panel", {
    type: types.PANEL,
    title: "My Addon",
    // This will be called as a JSX element by react 18
    render: ({ active }) => (active ? <div>Hello World</div> : null),
  });
});
```

Previously the `key` prop was passed to the render function, that is now no longer the case.

### Removal of `storiesOf`-API

The `storiesOf` API has been removed in Storybook 8.0.

If you need to dynamically create stories, you will need to implement this via the experimental `experimental_indexers` [API](#storyindexers-is-replaced-with-experimental_indexers).

For migrating to CSF, see: [`storyStoreV6` and `storiesOf` is deprecated](#storystorev6-and-storiesof-is-deprecated)

### Removed deprecated shim packages

In Storybook 7, these packages existed for backwards compatibility, but were marked as deprecated:

- `@storybook/addons` - this package has been split into 2 packages: `@storybook/preview-api` and `@storybook/manager-api`, see more here: [New Addons API](#new-addons-api).
- `@storybook/channel-postmessage` - this package has been merged into `@storybook/channels`.
- `@storybook/channel-websocket` - this package has been merged into `@storybook/channels`.
- `@storybook/client-api` - this package has been merged into `@storybook/preview-api`.
- `@storybook/core-client` - this package has been merged into `@storybook/preview-api`.
- `@storybook/preview-web` - this package has been merged into `@storybook/preview-api`.
- `@storybook/store` - this package has been merged into `@storybook/preview-api`.
- `@storybook/api` - this package has been replaced with `@storybook/manager-api`.

These sections explain the rationale, and the required changes you might have to make:

- [New Addons API](#new-addons-api)
- [`addons.setConfig` should now be imported from `@storybook/manager-api`.](#addonssetconfig-should-now-be-imported-from-storybookmanager-api)

### Deprecated `@storybook/testing-library` package

In Storybook 8, `@storybook/testing-library` has been integrated to a new package called `@storybook/test`, which uses Vitest APIs for an improved experience. When upgrading to Storybook 8 with 'npx storybook@latest upgrade', you will get prompted and will get an automigration for the new package. Please migrate when you can.

To migrate by hand, install `@storybook/test` and replace `@storybook/testing-libary` imports globally:

```ts
- import { userEvent } from '@storybook/testing-library';
+ import { userEvent } from '@storybook/test';
```

For more information on the change, see the [announcement post](https://storybook.js.org/blog/storybook-test/).

### Framework-specific Vite plugins have to be explicitly added

In Storybook 7, we would automatically add frameworks-specific Vite plugins, e.g. `@vitejs/plugin-react` if not installed.
In Storybook 8 those plugins have to be added explicitly in the user's `vite.config.ts`:

#### For React:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
});
```

#### For Vue:

```ts
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
});
```

#### For Svelte (without Sveltekit):

```ts
import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  plugins: [svelte()],
});
```

#### For Preact:

```ts
import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

export default defineConfig({
  plugins: [preact()],
});
```

#### For Solid:

```ts
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

export default defineConfig({
  plugins: [solid()],
});
```

#### For Qwik:

```ts
import { defineConfig } from "vite";
import qwik from "vite-plugin-qwik";

export default defineConfig({
  plugins: [qwik()],
});
```

### TurboSnap Vite plugin is no longer needed

At least in build mode, `builder-vite` now supports the `--webpack-stats-json` flag and will output `preview-stats.json`.

This means https://github.com/IanVS/vite-plugin-turbosnap is no longer necessary, and duplicative, and the plugin will automatically be removed if found.

### `--webpack-stats-json` option renamed `--stats-json`

Now that both Vite and Webpack support the `preview-stats.json` file, the flag has been renamed. The old flag will continue to work.

### Implicit actions can not be used during rendering (for example in the play function)

In Storybook 7, we inferred if the component accepts any action props,
by checking if it starts with `onX` (for example `onClick`), or as configured by `actions.argTypesRegex`.
If that was the case, we would fill in jest spies for those args automatically.

```ts
export default {
  component: Button,
};

export const ButtonClick = {
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button"));
    // args.onClick is a jest spy in 7.0
    await expect(args.onClick).toHaveBeenCalled();
  },
};
```

In Storybook 8 this feature is removed, and spies have to added explicitly:

```ts
import { fn } from "@storybook/test";

export default {
  component: Button,
  args: {
    onClick: fn(),
  },
};

export const ButtonClick = {
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button"));
    await expect(args.onClick).toHaveBeenCalled();
  },
};
```

For more context, see this RFC:
https://github.com/storybookjs/storybook/discussions/23649

To summarize:

- This makes CSF files less magical and more portable, so that CSF files will render the same in a test environment where docgen is not available.
- This allows users and (test) integrators to run or build storybook without docgen, boosting the user performance and allows tools to give quicker feedback.
- This will make sure that we can one day lazy load docgen, without changing how stories are rendered.

### MDX related changes

#### MDX is upgraded to v3

Storybook now uses MDX3 under the hood. This change contains many improvements and a few small breaking changes that probably won't affect you. However we recommend checking the [migration notes from MDX here](https://mdxjs.com/blog/v3/).

#### Dropping support for \*.stories.mdx (CSF in MDX) format and MDX1 support

In Storybook 7, we deprecated the ability of using MDX both for documentation and for defining stories in the same .stories.mdx file. It is now removed, and Storybook won't support .stories.mdx files anymore. We provide migration scripts to help you onto the new format.

If you were using the [legacy MDX1 format](#legacy-mdx1-support), you will have to remove the `legacyMdx1` main.js feature flag and the `@storybook/mdx1-csf` package.

Alongside with this change, the `jsxOptions` configuration was removed as it is not used anymore.

[More info here](https://storybook.js.org/docs/migration-guide#storiesmdx-to-mdxcsf).

#### Dropping support for id, name and story in Story block

Referencing stories by `id`, `name` or `story` in the Story block is not possible anymore. [More info here](#story-block).

### Core changes

#### `framework.options.builder.useSWC` for Webpack5-based projects removed

In Storybook 8.0, we have removed the `framework.options.builder.useSWC` option. The `@storybook/builder-webpack5` package is now compiler-agnostic and does not depend on Babel or SWC.

If you want to use SWC, you can add the necessary addon:

```sh
npx storybook@latest add @storybook/addon-webpack5-compiler-swc
```

The goal is to make @storybook/builder-webpack5 lighter and more flexible. We are not locked into a specific compiler or compiler version anymore. This allows us to support Babel 7/8, SWC, and other compilers simultaneously.

#### Removed `@babel/core` and `babel-loader` from `@storybook/builder-webpack5`

In Storybook 8.0, we have removed the `@storybook/builder-webpack5` package's dependency on Babel. This means that Babel is not preconfigured in `@storybook/builder-webpack5`. If you want to use Babel, you can add the necessary addon:

```sh
npx storybook@latest add @storybook/addon-webpack5-compiler-babel
```

We are doing this to make Storybook more flexible and to allow users to use a variety of compilers like SWC, Babel or even pure TypeScript.

#### `framework.options.fastRefresh` for Webpack5-based projects removed

In Storybook 8.0, we have removed the `framework.options.fastRefresh` option.

The fast-refresh implementation currently relies on the `react-refresh/babel` package. While this has served us well, integrating this dependency could pose challenges. Specifically, it locks users into a specific Babel version. This could become a problem when Babel 8 is released. There is uncertainty about whether react-refresh/babel will seamlessly support Babel 8, potentially hindering users from updating smoothly.

Furthermore, the existing implementation does not account for cases where fast-refresh might already be configured in a user's Babel configuration. Rather than filtering out existing configurations, our current approach could lead to duplications, resulting in a sub-optimal development experience.

We believe in empowering our users, and setting up fast-refresh manually is a straightforward process. The following configuration will configure fast-refresh if Storybook does not automatically pick up your fast-refresh configuration:

`package.json`:

```diff
{
  "devDependencies": {
+   "@pmmmwh/react-refresh-webpack-plugin": "^0.5.11",
+   "react-refresh": "^0.14.0",
  }
}
```

`babel.config.js` (optionally, add it to `.storybook/main.js`):

```diff
+const isProdBuild = process.env.NODE_ENV === 'production';

module.exports = (api) => {
  return {
    plugins: [
+     !isProdBuild && 'react-refresh/babel',
    ].filter(Boolean),
  };
};
```

`.storybook/main.js`:

```diff
+import ReactRefreshWebpackPlugin from "@pmmmwh/react-refresh-webpack-plugin";
+const isProdBuild = process.env.NODE_ENV === 'production';
const config = {
  webpackFinal: (config) => {
+   config.plugins = [
+     !isProdBuild && new ReactRefreshWebpackPlugin({
+       overlay: {
+         sockIntegration: 'whm',
+       },
+     }),
+     ...config.plugins,
+   ].filter(Boolean);
    return config;
  },
};

export default config;
```

This approach aligns with our philosophy of transparency and puts users in control of their Webpack and Babel configurations.

We want to minimize magic behind the scenes. By removing `framework.options.fastRefresh`, we are reducing unnecessary configuration. Instead, we encourage users to leverage their existing Webpack and Babel setups, fostering a more transparent and customizable development environment.

You don't have to add fast refresh to `@storybook/nextjs` since it is already configured there as a default to match the same experience as `next dev`.

#### `typescript.skipBabel` removed

We have removed the `typescript.skipBabel` option in Storybook 8.0. Please use `typescript.skipCompiler` instead.

#### Dropping support for Yarn 1

Storybook will stop providing fixes aimed at Yarn 1 projects. This does not necessarily mean that Storybook will stop working for Yarn 1 projects, just that the team won't provide more fixes aimed at it. For context, it's been 6 years since the release of Yarn 1, and Yarn is currently in version 4, which was [released in October 2023](https://yarnpkg.com/blog/release/4.0).

#### Dropping support for Node.js 16

In Storybook 8, we have dropped Node.js 16 support since it reached end-of-life on 2023-09-11. Storybook 8 supports Node.js 18 and above.

#### Autotitle breaking fixes

In Storybook 7, the file name `path/to/foo.bar.stories.js` would result in the [autotitle](https://storybook.js.org/docs/react/configure/overview#configure-story-loading) `path/to/foo`. In 8.0, this has been changed to generate `path/to/foo.bar`. We consider this a bugfix but it is also a breaking change if you depended on the old behavior. To get the old titles, you can manually specify the desired title in the default export of your story file. For example:

```js
export default {
  title: "path/to/foo",
};
```

Alternatively, if you need to achieve a different behavior for a large number of files, you can provide a [custom indexer](https://storybook.js.org/docs/7.0/vue/configure/sidebar-and-urls#processing-custom-titles) to generate the titles dynamically.

#### Storyshots has been removed

Storyshots was an addon for Storybook which allowed users to turn their stories into automated snapshot tests.

Every story would automatically be taken into account and create a snapshot file.

Snapshot testing has since fallen out of favor and is no longer recommended.

In addition to its limited use, and high chance of false positives, Storyshots ran code developed to run in the browser in NodeJS via JSDOM.
JSDOM has limitations and is not a perfect emulation of the browser environment; therefore, Storyshots was always a pain to set up and maintain.

The Storybook team has built the test-runner as a direct replacement, which utilizes Playwright to connect to an actual browser where Storybook runs the code.

In addition, CSF has expanded to allow for play functions to be defined on stories, which allows for more complex testing scenarios, fully integrated within Storybook itself (and supported by the test-runner, and not Storyshots).

Finally, storyStoreV7: true (the default and only option in Storybook 8), was not supported by Storyshots.

By removing Storyshots, the Storybook team was unblocked from moving (eventually) to an ESM-only Storybook, which is a big step towards a more modern Storybook.

Please check the [migration guide](https://storybook.js.org/docs/writing-tests/storyshots-migration-guide) that we prepared.

#### UI layout state has changed shape

In Storybook 7 it was possible to use `addons.setConfig({...});` to configure Storybook UI features and behavior as documented [here (v7)](https://storybook.js.org/docs/7.3/react/configure/features-and-behavior), [(latest)](https://storybook.js.org/docs/react/configure/features-and-behavior). The state and API for the UI layout has changed:

- `showNav: boolean` is now `navSize: number`, where the number represents the size of the sidebar in pixels.
- `showPanel: boolean` is now split into `bottomPanelHeight: number` and `rightPanelWidth: number`, where the numbers represents the size of the panel in pixels.
- `isFullscreen: boolean` is no longer supported, but can be achieved by setting a combination of the above.

#### New UI and props for Button and IconButton components

We used to have a lot of different buttons in `@storybook/components` that were not used anywhere. In Storybook 8.0 we are deprecating `Form.Button` and added a new `Button` component that can be used in all places. The `IconButton` component has also been updated to use the new `Button` component under the hood. Going forward addon creators and Storybook maintainers should use the new `Button` component instead of `Form.Button`.

For the `Button` component, the following props are now deprecated:

- `isLink` - Please use the `asChild` prop instead like this: `<Button asChild><a href="">Link</a></Button>`
- `primary` - Please use the `variant` prop instead.
- `secondary` - Please use the `variant` prop instead.
- `tertiary` - Please use the `variant` prop instead.
- `gray` - Please use the `variant` prop instead.
- `inForm` - Please use the `variant` prop instead.
- `small` - Please use the `size` prop instead.
- `outline` - Please use the `variant` prop instead.
- `containsIcon`. Please add your icon as a child directly. No need for this prop anymore.

The `IconButton` doesn't have any deprecated props but it now uses the new `Button` component under the hood so all props for `IconButton` will be the same as `Button`.

#### Icons is deprecated

In Storybook 8.0 we are introducing a new icon library available with `@storybook/icons`. We are deprecating the `Icons` component in `@storybook/components` and recommend that addon creators and Storybook maintainers use the new `@storybook/icons` component instead.

#### Removed postinstall

We removed the `@storybook/postinstall` package, which provided some utilities for addons to programmatically modify user configuration files on install. This package was years out of date, so this should be a non-disruptive change. If your addon used the package, you can view the old source code [here](https://github.com/storybookjs/storybook/tree/release-7-5/code/lib/postinstall) and adapt it into your addon.

#### Removed stories.json

In addition to the built storybook, `storybook build` generates two files, `index.json` and `stories.json`, that list out the contents of the Storybook. `stories.json` is a legacy format and we included it for backwards compatibility. As of 8.0 we no longer build `stories.json` by default, and we will remove it completely in 9.0.

In the meantime if you have code that relies on `stories.json`, you can find code that transforms the "v4" `index.json` to the "v3" `stories.json` format (and their respective TS types): https://github.com/storybookjs/storybook/blob/release-7-5/code/lib/core-server/src/utils/stories-json.ts#L71-L91

#### Removed `sb babelrc` command

The `sb babelrc` command was used to generate a `.babelrc` file for Storybook. This command is now removed.

From version 8.0 onwards, Storybook is compiler-agnostic and does not depend on Babel or SWC if you use Webpack 5. This move was made to make Storybook more flexible and allow users to configure their own Babel setup according to their project needs and setup. If you need a custom Babel configuration, you can create a `.babelrc` file yourself and configure it according to your project setup.

The reasoning behind is to condense and provide some clarity to what's happened to both the command and what's shifted with the upcoming release.

#### Changed interfaces for `@storybook/router` components

The `hideOnly` prop has been removed from the `<Route />` component in `@storybook/router`. If needed this can be implemented manually with the `<Match />` component.

#### Extract no longer batches

`Preview.extract()` no longer loads CSF files in batches. This was a workaround for resource limitations that slowed down extract. This shouldn't affect behaviour.

### Framework-specific changes

#### React

##### `react-docgen` component analysis by default

In Storybook 7, we used `react-docgen-typescript` to analyze React component props and auto-generate controls. In Storybook 8, we have moved to `react-docgen` as the new default. `react-docgen` is dramatically more efficient, shaving seconds off of dev startup times. However, it only analyzes basic TypeScript constructs.

We feel `react-docgen` is the right tradeoff for most React projects. However, if you need the full fidelity of `react-docgen-typescript`, you can opt-in using the following setting in `.storybook/main.js`:

```js
export default {
  typescript: {
    reactDocgen: "react-docgen-typescript",
  },
};
```

For more information see: https://storybook.js.org/docs/react/api/main-config-typescript#reactdocgen

#### Next.js

##### Require Next.js 13.5 and up

Starting in 8.0, Storybook requires Next.js 13.5 and up.

##### Automatic SWC mode detection

Similar to how Next.js detects if SWC should be used, Storybook will follow more or less the same rules:

- If you use Next.js 14 or higher and you don't have a .babelrc file, Storybook will use SWC to transpile your code.
- Even if you have a .babelrc file, Storybook will still use SWC to transpile your code if you set the experimental `experimental.forceSwcTransforms` flag to `true` in your `next.config.js`.

##### RSC config moved to React renderer

Storybook 7.6 introduced a new feature flag, `experimentalNextRSC`, to enable React Server Components in a Next.js project. It also introduced a parameter `nextjs.rsc` to selectively disable it on particular components or stories.

These flags have been renamed to `experimentalRSC` and `react.rsc`, respectively. This is a breaking change to accommodate RSC support in other, non-Next.js frameworks. For now, `@storybook/nextjs` is the only framework that supports it, and does so experimentally.

#### Vue

##### Require Vue 3 and up

Starting in 8.0, Storybook requires Vue 3 and up.

#### Angular

##### Require Angular 15 and up

Starting in 8.0, Storybook requires Angular 15 and up.

#### Svelte

##### Require Svelte 4 and up

Starting in 8.0, Storybook requires Svelte 4 and up.

#### Preact

##### Require Preact 10 and up

Starting in 8.0, Storybook requires Preact 10 and up.

##### No longer adds default Babel plugins

Until now, Storybook provided a set of default Babel plugins that were applied to Preact projects using Webpack, including the runtime automatic import plugin to allow Preact's `h` pragma to render JSX. However, this is no longer the case in Storybook 8.0. If you want to use this plugin, or if you're going to use TypeScript with Preact, you will need to add it to your Babel config.

```js
.babelrc

{
  "plugins": [
    [
      // Add this to automatically import `h` from `preact` when needed
      "@babel/plugin-transform-react-jsx", {
        "importSource": "preact",
        "runtime": "automatic"
      }
    ],
    // Add this if you want to use TypeScript with Preact
    "@babel/preset-typescript"
  ],
}
```

If you want to configure the plugins only for Storybook, you can add the same setting to your `.storybook/main.js` file.

```js
const config = {
  ...
  babel: async (options) => {
    options.plugins.push(
      [
        "@babel/plugin-transform-react-jsx", {
          "importSource": "preact",
          "runtime": "automatic"
        }
      ],
      "@babel/preset-typescript"
    )
    return options;
  },
}

export default config
```

We are doing this to apply the same configuration you defined in your project. This streamlines the experience of using Storybook with Preact. Additionally, we are not vendor-locked to a specific Babel version anymore, which means that you can upgrade Babel without breaking your Storybook.

#### Web Components

##### Dropping default babel plugins in Webpack5-based projects

Until the 8.0 release, Storybook provided the `@babel/preset-env` preset for Web Component projects by default. This is no longer the case, as any Web Components project will use the configuration you've included. Additionally, if you're using either the `@babel/plugin-syntax-dynamic-import` or `@babel/plugin-syntax-import-meta` plugins, you no longer have to include them as they are now part of `@babel/preset-env`.

### Deprecations which are now removed

#### Removed `config` preset

In Storybook 7.0 we have deprecated the preset field `config` and it has been replaced with 'previewAnnotations'. The `config` preset is now completely removed in Storybook 8.0.

```diff
// .storybook/main.js

// before
const config = {
  framework: "@storybook/your-framework",
- config: (entries) => [...entries, yourEntry],
+ previewAnnotations: (entries) => [...entries, yourEntry],
};

export default config;
```

#### Removed `passArgsFirst` option

Since Storybook 6, we have had an option called `parameters.passArgsFirst` (default=`true`), which sallows you to pass the context to the story function first when set to `false.` We have removed this option. In Storybook 8.0, the args are always passed first, and as a second argument, the context is passed.

```js
// Storybook < 8
export default {
  parameters: {
    passArgsFirst: false,
  },
};

export const Button = (context) => <button {...args} />;

// Storybook >= 8
export const Button = (args, context) => <button {...args} />;
```

#### Methods and properties from AddonStore

The following methods and properties from the class `AddonStore` in `@storybook/manager-api` are now removed:

- `serverChannel` -> Use `channel` instead
- `getServerChannel` -> Use `getChannel` instead
- `setServerChannel` -> Use `setChannel` instead
- `hasServerChannel` -> Use `hasChannel` instead
- `addPanel`

The following methods and properties from the class `AddonStore` in `@storybook/preview-api` are now removed:

- `serverChannel` -> Use `channel` instead
- `getServerChannel` -> Use `getChannel` instead
- `setServerChannel` -> Use `setChannel` instead
- `hasServerChannel` -> Use `hasChannel` instead

#### Methods and properties from PreviewAPI

The following exports from `@storybook/preview-api` are now removed:

- `useSharedState`
- `useAddonState`

Please file an issue if you need these APIs.

#### Removals in @storybook/components

The `TooltipLinkList` UI component used to customize the Storybook toolbar has been updated to use the `icon` property instead of the `left` property to position its content. If you've enabled this property in your `globalTypes` configuration, addons, or any other place, you'll need to replace it with an `icon` property to mimic the same behavior. For example:

```diff
// .storybook/preview.js|ts
// Replace your-framework with the framework you are using (e.g., react, vue3)
import { Preview } from '@storybook/your-framework';

const preview: Preview = {
  globalTypes: {
    locale: {
      description: 'Internationalization locale',
      defaultValue: 'en',
      toolbar: {
        icon: 'globe',
        items: [
          {
            value: 'en',
            right: '🇺🇸',
-            left: '＄'
+            icon: 'facehappy'
            title: 'English'
          },
          { value: 'fr', right: '🇫🇷', title: 'Français' },
          { value: 'es', right: '🇪🇸', title: 'Español' },
          { value: 'zh', right: '🇨🇳', title: '中文' },
          { value: 'kr', right: '🇰🇷', title: '한국어' },
        ],
      },
    },
  },
};

export default preview;
```

To learn more about the available icons and their names, see the [Storybook documentation](https://storybook.js.org/docs/8.0/faq#what-icons-are-available-for-my-toolbar-or-my-addon).

#### Removals in @storybook/types

The following exports from `@storybook/types` are now removed:

- `API_ADDON` -> Use `Addon_Type` instead
- `API_COLLECTION` -> Use `Addon_Collection` instead
- `API_Panels`

#### --use-npm flag in storybook CLI

The `--use-npm` is now removed. Use `--package-manager=npm` instead. [More info here](#cli-option---use-npm-deprecated).

#### hideNoControlsWarning parameter from addon controls

The `hideNoControlsWarning` parameter is now removed. [More info here](#addon-controls-hidenocontrolswarning-parameter-is-deprecated).

#### `setGlobalConfig` from `@storybook/react`

The `setGlobalConfig` (used for reusing stories in your tests) is now removed in favor of `setProjectAnnotations`.

```ts
import { setProjectAnnotations } from `@storybook/react`.
```

#### StorybookViteConfig type from @storybook/builder-vite

The `StorybookViteConfig` type is now removed in favor of `StorybookConfig`:

```ts
import type { StorybookConfig } from "@storybook/react-vite";
```

#### props from WithTooltipComponent from @storybook/components

The deprecated properties `tooltipShown`, `closeOnClick`, and `onVisibilityChange` of `WithTooltipComponent` from `@storybook/components` are now removed. Please replace them:

```tsx
<WithTooltip
  closeOnClick // becomes closeOnOutsideClick
  tooltipShown // becomes defaultVisible
  onVisibilityChange // becomes onVisibleChange
>
  ...
</WithTooltip>
```

#### LinkTo direct import from addon-links

The `LinkTo` (React component) direct import from `@storybook/addon-links` is now removed. You have to import it from `@storybook/addon-links/react` instead.

```ts
// before
import LinkTo from "@storybook/addon-links";

// after
import LinkTo from "@storybook/addon-links/react";
```

#### DecoratorFn, Story, ComponentStory, ComponentStoryObj, ComponentStoryFn and ComponentMeta TypeScript types

The `Story` type is now removed in favor of `StoryFn` and `StoryObj`. More info [here](#story-type-deprecated).

The `DecoratorFn` type is now removed in favor of `Decorator`. [More info](#renamed-decoratorfn-to-decorator).

For React, the `ComponentStory`, `ComponentStoryObj`, `ComponentStoryFn` and `ComponentMeta` types are now removed in favor of `StoryFn`, `StoryObj` and `Meta`. [More info](#componentstory-componentstoryobj-componentstoryfn-and-componentmeta-types-are-deprecated).

#### "Framework" TypeScript types

The Framework types such as `ReactFramework` are now removed in favor of Renderer types such as `ReactRenderer`. This affects all frameworks. [More info](#renamed-xframework-to-xrenderer).

#### `navigateToSettingsPage` method from Storybook's manager-api

The `navigateToSettingsPage` method from manager-api is now removed in favor of `changeSettingsTab`.

```ts
export const Component = () => {
  const api = useStorybookApi();

  const someHandler = () => {
    // Old method: api.navigateToSettingsPage('/settings/about');
    api.changeSettingsTab("about"); // the /settings path is not necessary anymore
  };

  // ...
};
```

#### storyIndexers

The Storybook's main.js configuration property `storyIndexers` is now removed in favor of `experimental_indexers`. [More info](#storyindexers-is-replaced-with-experimental_indexers).

#### Deprecated docs parameters

The following story and meta parameters are now removed:

```ts
parameters.docs.iframeHeight; // becomes docs.story.iframeHeight
parameters.docs.inlineStories; // becomes docs.story.inline
parameters.jsx.transformSource; // becomes parameters.docs.source.transform
parameters.docs.transformSource; // becomes parameters.docs.source.transform
parameters.docs.source.transformSource; // becomes parameters.docs.source.transform
```

More info [here](#autodocs-changes) and [here](#source-block).

#### Description Doc block properties

`children`, `markdown` and `type` are now removed in favor of the `of` property. [More info](#doc-blocks).

#### Story Doc block properties

The `story` prop is now removed in favor of the `of` property. [More info](#doc-blocks).

Additionally, given that CSF in MDX is not supported anymore, the following props are also removed: `args`, `argTypes`, `decorators`, `loaders`, `name`, `parameters`, `play`, `render`, and `storyName`. [More info](#dropping-support-for-storiesmdx-csf-in-mdx-format-and-mdx1-support).

#### Manager API expandAll and collapseAll methods

The `collapseAll` and `expandAll` APIs (possibly used by addons) are now removed. Please emit events for these actions instead:

```ts
import {
  STORIES_COLLAPSE_ALL,
  STORIES_EXPAND_ALL,
} from "@storybook/core-events";
import { useStorybookApi } from "@storybook/manager-api";

const api = useStorybookApi();
api.collapseAll(); // becomes api.emit(STORIES_COLLAPSE_ALL)
api.expandAll(); // becomes api.emit(STORIES_EXPAND_ALL)
```

#### `ArgsTable` Doc block removed

The `ArgsTable` doc block has been removed in favor of `ArgTypes` and `Controls`. [More info](#argstable-block).

With this removal we've reintroduced `subcomponents` support to `ArgTypes`, `Controls`, and autodocs. We've also undeprecated `subcomponents`, by popular demand.

#### `Source` Doc block properties

`id` and `ids` are now removed in favor of the `of` property. [More info](#doc-blocks).

#### `Canvas` Doc block properties

The following properties were removed from the Canvas Doc block:

- children
- isColumn
- columns
- withSource
- mdxSource

[More info](#doc-blocks).

#### `Primary` Doc block properties

The `name` prop is now removed in favor of the `of` property. [More info](#doc-blocks).

#### `createChannel` from `@storybook/postmessage` and `@storybook/channel-websocket`

The `createChannel` APIs from both `@storybook/channel-websocket` and `@storybook/postmessage` are now removed. Please use `createBrowserChannel` instead, from the `@storybook/channels` package.

Additionally, the `PostmsgTransport` type is now removed in favor of `PostMessageTransport`.

#### StoryStore and methods deprecated

The StoryStore (`__STORYBOOK_STORY_STORE__` and `__STORYBOOK_PREVIEW__.storyStore`) are deprecated, and will no longer be accessible in Storybook 9.0.

In particular, the following methods on the `StoryStore` are deprecated and will be removed in 9.0:

- `store.fromId()` - please use `preview.loadStory({ storyId })` instead.
- `store.raw()` - please use `preview.extract()` instead.

Note that both these methods require initialization, so you should await `preview.ready()`.

### Addon author changes

#### Tab addons cannot manually route, Tool addons can filter their visibility via tabId

The TAB type addons now should no longer specify the `match` or `route` property.

Instead storybook will automatically show the addon's rendered content when the query parameter `tab` is set to the addon's ID.

Example:

```tsx
import { addons, types } from "@storybook/manager-api";

addons.register("my-addon", () => {
  addons.add("my-addon/tab", {
    type: types.TAB,
    title: "My Addon",
    render: () => <div>Hello World</div>,
  });
});
```

Tool type addon will now receive the `tabId` property passed to their `match` function.
That way they can chose to show/hide their content based on the current tab.

When the canvas is shown, the `tabId` will be set to `undefined`.

Example:

```tsx
import { addons, types } from "@storybook/manager-api";

addons.register("my-addon", () => {
  addons.add("my-addon/tool", {
    type: types.TOOL,
    title: "My Addon",
    match: ({ tabId }) => tabId === "my-addon/tab",
    render: () => <div>👀</div>,
  });
});
```

#### Removed `config` preset

In Storybook 7.0 we have deprecated the preset field `config` and it has been replaced with `previewAnnotations`. The `config` preset is now completely removed in Storybook 8.0.

```diff
// your-addon/preset.js

module.exports = {
-  config: (entries = []) => [...entries, ...yourEntry],
+  previewAnnotations: (entries = []) => [...entries, ...yourEntry],
};
```

## From version 7.5.0 to 7.6.0

#### CommonJS with Vite is deprecated

Using CommonJS in the `main` configuration with `main.cjs` or `main.cts` is deprecated, and will be removed in Storybook 8.0. This is a necessary change because [Vite will remove support for CommonJS in an upcoming release](https://github.com/vitejs/vite/discussions/13928).

You can address this by converting your `main` configuration file to ESM syntax and renaming it to `main.mjs` or `main.mts` if your project does not have `"type": "module"` in its `package.json`. To convert the config file to ESM you will need to replace any CommonJS syntax like `require()`, `module.exports`, or `__dirname`. If you haven't already, you may also consider adding `"type": "module"` to your package.json and converting your project to ESM.

#### Using implicit actions during rendering is deprecated

In Storybook 7, we inferred if the component accepts any action props,
by checking if it starts with `onX` (for example `onClick`), or as configured by `actions.argTypesRegex`.
If that was the case, we would fill in jest spies for those args automatically.

```ts
export default {
  component: Button,
};

export const ButtonClick = {
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button"));
    // args.onClick is a jest spy in 7.0
    await expect(args.onClick).toHaveBeenCalled();
  },
};
```

In Storybook 8 this feature will be removed, and spies have to added explicitly:

```ts
import { fn } from "@storybook/test";

export default {
  component: Button,
  args: {
    onClick: fn(),
  },
};

export const ButtonClick = {
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button"));
    await expect(args.onClick).toHaveBeenCalled();
  },
};
```

For more context, see this RFC:
https://github.com/storybookjs/storybook/discussions/23649

To summarize:

- This makes CSF files less magical and more portable, so that CSF files will render the same in a test environment where docgen is not available.
- This allows users and (test) integrators to run or build storybook without docgen, boosting the user performance and allows tools to give quicker feedback.
- This will make sure that we can one day lazy load docgen, without changing how stories are rendered.

#### typescript.skipBabel deprecated

We will remove the `typescript.skipBabel` option in Storybook 8.0. Please use `typescript.skipCompiler` instead.

#### Primary doc block accepts of prop

The `Primary` doc block now also accepts an `of` prop as described in the [Doc Blocks](#doc-blocks) section. It still accepts being passed `name` or no props at all.

#### Addons no longer need a peer dependency on React

Historically the majority of addons have had a peer dependency on React and a handful of Storybook core packages. In most cases this has not been necessary since 7.0 because the Storybook manager makes those available on the global scope. It has created an unnecessary burden for users in non-React projects.

We've migrated all the core addons (except for `addon-docs`) to not depend on these packages by:

1. Moving `react`, `react-dom` and the globalized Storybook packages from `peerDependencies` to `devDependencies`
2. Added the list of globalized packages to the `externals` property in the `tsup` configuration, to ensure they are not part of the bundle.

As of Storybook 7.6.0 the list of globalized packages can be imported like this:

```ts
// tsup.config.ts

import { globalPackages as globalManagerPackages } from "@storybook/manager/globals";
import { globalPackages as globalPreviewPackages } from "@storybook/preview/globals";

const allGlobalPackages = [...globalManagerPackages, ...globalPreviewPackages];
```

We recommend checking out [the updates we've made to the addon-kit](https://github.com/storybookjs/addon-kit/pull/60/files#diff-8fed899bdbc24789a7bb4973574e624ed6207c6ce572338bc3c3e117672b2a20), that can serve as a base for the changes you can do in your own addon. These changes are not necessary for your addon to keep working, but they will remove the need for your users to unnecessary install `react` and `react-dom` to their projects, and they'll significantly reduce the install size of your addon.
These changes should not be breaking for your users, unless you support Storybook pre-v7.

## From version 7.4.0 to 7.5.0

#### `storyStoreV6` and `storiesOf` is deprecated

`storyStoreV6` and `storiesOf` is deprecated and will be completely removed in Storybook 8.0.

If you're using `storiesOf` we recommend you migrate your stories to CSF3 for a better story writing experience.
In many cases you can get started with the migration by using two migration scripts:

```bash

# 1. convert storiesOf to CSF
npx storybook@latest migrate storiesof-to-csf --glob="**/*.stories.tsx" --parser=tsx

# 2. Convert CSF 2 to CSF 3
npx storybook@latest migrate csf-2-to-3 --glob="**/*.stories.tsx" --parser=tsx
```

They won't do a perfect migration so we recommend that you manually go through each file afterwards.

Alternatively you can build your own `storiesOf` implementation by leveraging the new (experimental) indexer API ([documentation](https://storybook.js.org/docs/react/api/main-config-indexers), [migration](#storyindexers-is-replaced-with-experimental_indexers)). A proof of concept of such an implementation can be seen in [this StackBlitz demo](https://stackblitz.com/edit/github-h2rgfk?file=README.md). See the demo's `README.md` for a deeper explanation of the implementation.

#### `storyIndexers` is replaced with `experimental_indexers`

Defining custom indexers for stories has become a more official - yet still experimental - API which is now configured at `experimental_indexers` instead of `storyIndexers` in `main.ts`. `storyIndexers` has been deprecated and will be fully removed in version 8.0.

The new experimental indexers are documented [here](https://storybook.js.org/docs/react/api/main-config-indexers). The most notable change from `storyIndexers` is that the indexer must now return a list of [`IndexInput`](https://github.com/storybookjs/storybook/blob/next/code/lib/types/src/modules/indexer.ts#L104-L148) instead of `CsfFile`. It's possible to construct an `IndexInput` from a `CsfFile` using the `CsfFile.indexInputs` getter.

That means you can convert an existing story indexer like this:

```diff
// .storybook/main.ts

import { readFileSync } from 'fs';
import { loadCsf } from '@storybook/csf-tools';

export default {
-  storyIndexers = (indexers) => {
-    const indexer = async (fileName, opts) => {
+  experimental_indexers = (indexers) => {
+    const createIndex = async (fileName, opts) => {
      const code = readFileSync(fileName, { encoding: 'utf-8' });
      const makeTitle = (userTitle) => {
        // Do something with the auto title retrieved by Storybook
        return userTitle;
      };

      // Parse the CSF file with makeTitle as a custom context
-      return loadCsf(code, { ...compilationOptions, makeTitle, fileName }).parse();
+      return loadCsf(code, { ...compilationOptions, makeTitle, fileName }).parse().indexInputs;
    };

    return [
      {
        test: /(stories|story)\.[tj]sx?$/,
-        indexer,
+        createIndex,
      },
      ...(indexers || []),
    ];
  },
};
```

As an addon author you can support previous versions of Storybook by setting both `storyIndexers` and `indexers_experimental`, without triggering the deprecation warning.

## From version 7.0.0 to 7.2.0

#### Addon API is more type-strict

When registering an addon using `@storybook/manager-api`, the addon API is now more type-strict. This means if you use TypeScript to compile your addon before publishing, it might start giving you errors.

The `type` property is now a required field, and the `id` property should not be set anymore.

Here's a correct example:

```tsx
import { addons, types } from "@storybook/manager-api";

addons.register("my-addon", () => {
  addons.add("my-addon/panel", {
    type: types.PANEL,
    title: "My Addon",
    render: ({ active }) => (active ? <div>Hello World</div> : null),
  });
});
```

The API: `addons.addPanel()` is now deprecated, and will be removed in 8.0. Please use `addons.add()` instead.

The `render` method can now be a `React.FunctionComponent` (without the `children` prop). Storybook will now render it, rather than calling it as a function.

#### Addon-controls hideNoControlsWarning parameter is deprecated

The `hideNoControlsWarning` parameter is now unused and deprecated, given that the UI of the Controls addon changed in a way that does not display that message anymore.

```ts
export const Primary = {
  parameters: {
    controls: { hideNoControlsWarning: true }, // this parameter is now unnecessary
  },
};
```

## From version 6.5.x to 7.0.0

A number of these changes can be made automatically by the Storybook CLI. To take advantage of these "automigrations", run `npx storybook@7 upgrade` or `pnpx dlx storybook@7 upgrade`.

### 7.0 breaking changes

#### Dropped support for Node 15 and below

Storybook 7.0 requires **Node 16** or above. If you are using an older version of Node, you will need to upgrade or keep using Storybook 6 in the meantime.

#### Default export in Preview.js

Storybook 7.0 supports a default export in `.storybook/preview.js` that should contain all of its annotations. The previous format is still compatible, but **the default export will be the recommended way going forward**.

If your `preview.js` file looks like this:

```js
export const parameters = {
  actions: { argTypesRegex: "^on[A-Z].*" },
};
```

Please migrate it to use a default export instead:

```js
const preview = {
  parameters: {
    actions: { argTypesRegex: "^on[A-Z].*" },
  },
};
export default preview;
```

Additionally, we introduced typings for that default export (Preview), so you can import it in your config file. If you're using Typescript, make sure to rename your file to be `preview.ts`.

The `Preview` type will come from the Storybook package for the **renderer** you are using. For example, if you are using Angular, you will import it from `@storybook/angular`, or if you're using Vue3, you will import it from `@storybook/vue3`:

```ts
import { Preview } from "@storybook/react";

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: "^on[A-Z].*" },
  },
};
export default preview;
```

In JavaScript projects using `preview.js`, it's also possible to use the `Preview` type (for autocompletion, not type safety), via the JSDoc @type tag:

```js
/** @type { import('@storybook/react').Preview } */
const preview = {
  parameters: {
    actions: { argTypesRegex: "^on[A-Z].*" },
  },
};
export default preview;
```

#### ESM format in Main.js

It's now possible to use ESM in `.storybook/main.js` out of the box. Storybook 7.0 supports a default export in `.storybook/main.js` that should contain all of its configurations. The previous format is still compatible, but **the default export will be the recommended way going forward**.

If your main.js file looks like this:

```js
module.exports = {
  stories: [
    "../stories/**/*.stories.mdx",
    "../stories/**/*.stories.@(js|jsx|ts|tsx)",
  ],
  framework: { name: "@storybook/react-vite" },
};
```

Or like this:

```js
export const stories = [
  "../stories/**/*.stories.mdx",
  "../stories/**/*.stories.@(js|jsx|ts|tsx)",
];
export const framework = { name: "@storybook/react-vite" };
```

Please migrate it to use a default export instead:

```js
const config = {
  stories: [
    "../stories/**/*.stories.mdx",
    "../stories/**/*.stories.@(js|jsx|ts|tsx)",
  ],
  framework: { name: "@storybook/react-vite" },
};
export default config;
```

Additionally, we introduced typings for that default export (StorybookConfig), so you can import it in your config file. If you're using Typescript, make sure to rename your file to be `main.ts`.

The `StorybookConfig` type will come from the Storybook package for the **framework** you are using, which relates to the package in the "framework" field you have in your main.ts file. For example, if you are using React Vite, you will import it from `@storybook/react-vite`:

```ts
import { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: [
    "../stories/**/*.stories.mdx",
    "../stories/**/*.stories.@(js|jsx|ts|tsx)",
  ],
  framework: { name: "@storybook/react-vite" },
};
export default config;
```

In JavaScript projects using `main.js`, it's also possible to use the `StorybookConfig` type (for autocompletion, not type safety), via the JSDoc @type tag:

```ts
/** @type { import('@storybook/react-vite').StorybookConfig } */
const config = {
  stories: [
    "../stories/**/*.stories.mdx",
    "../stories/**/*.stories.@(js|jsx|ts|tsx)",
  ],
  framework: { name: "@storybook/react-vite" },
};
export default config;
```

#### Modern browser support

Starting in Storybook 7.0, Storybook will no longer support IE11, amongst other legacy browser versions.
We now transpile our code with a target of `chrome >= 100` and node code is transpiled with a target of `node >= 16`.

This means code-features such as (but not limited to) `async/await`, arrow-functions, `const`,`let`, etc will exist in the code at runtime, and thus the runtime environment must support it.
Not just the runtime needs to support it, but some legacy loaders for Webpack or other transpilation tools might need to be updated as well. For example, certain versions of Webpack 4 had parsers that could not parse the new syntax (e.g. optional chaining).

Some addons or libraries might depended on this legacy browser support, and thus might break. You might get an error like:

```
regeneratorRuntime is not defined
```

To fix these errors, the addon will have to be re-released with a newer browser-target for transpilation. This often looks something like this (but it's dependent on the build system the addon uses):

```js
// babel.config.js
module.exports = {
  presets: [
    [
      "@babel/preset-env",
      {
        shippedProposals: true,
        useBuiltIns: "usage",
        corejs: "3",
        modules: false,
        targets: { chrome: "100" },
      },
    ],
  ],
};
```

Here's an example PR to one of the Storybook addons: https://github.com/storybookjs/addon-coverage/pull/3 doing just that.

#### React peer dependencies required

_Has automigration_

Starting in 7.0, `react` and `react-dom` are now required peer dependencies of Storybook when using addon-docs (or docs via addon-essentials).

Storybook uses `react` in a variety of docs-related packages. In the past, we've done various trickery hide this from non-React users. However, with stricter peer dependency handling by `npm8`, `npm`, and `yarn pnp` those tricks have started to cause problems for those users. Rather than resorting to even more complicated tricks, we are making `react` and `react-dom` required peer dependencies.

To upgrade manually, add any version of `react` and `react-dom` as devDependencies using your package manager of choice, e.g.

```
npm add react react-dom --save-dev
```

#### start-storybook / build-storybook binaries removed

_Has automigration_

SB6.x framework packages shipped binaries called `start-storybook` and `build-storybook`.

In SB7.0, we've removed these binaries and replaced them with new commands in Storybook's CLI: `storybook dev` and `storybook build`. These commands will look for the `framework` field in your `.storybook/main.js` config--[which is now required](#framework-field-mandatory)--and use that to determine how to start/build your Storybook. The benefit of this change is that it is now possible to install multiple frameworks in a project without having to worry about hoisting issues.

A typical Storybook project includes two scripts in your projects `package.json`:

```json
{
  "scripts": {
    "storybook": "start-storybook <some flags>",
    "build-storybook": "build-storybook <some flags>"
  }
}
```

To convert this project to 7.0:

```json
{
  "scripts": {
    "storybook": "storybook dev <some flags>",
    "build-storybook": "storybook build <some flags>"
  },
  "devDependencies": {
    "storybook": "next"
  }
}
```

The new CLI commands remove the following flags:

| flag     | migration                                                                                     |
| -------- | --------------------------------------------------------------------------------------------- |
| --modern | No migration needed. [All ESM code is modern in SB7](#modern-esm--ie11-support-discontinued). |

#### New Framework API

_Has automigration_

Storybook 7 introduces the concept of `frameworks`, which abstracts configuration for `renderers` (e.g. React, Vue), `builders` (e.g. Webpack, Vite) and defaults to make integrations easier. This requires quite a few changes, depending on what your project is using. **We recommend you to use the automigrations**, but in case the command fails or you'd like to do the changes manually, here's a guide:

> Note:
> All of the following changes can be done automatically either via `npx storybook@latest upgrade --prerelease` or via the `npx storybook@latest automigrate` command. It's highly recommended to use these commands, which will tell you exactly what to do.

##### Available framework packages

In 7.0, `frameworks` combine a `renderer` and a `builder`, with the exception of a few packages that do not contain multiple builders, such as `@storybook/angular`, which only has Webpack 5 support.

You have to pick which framework you want to use from the list below, which will depend on your project configuration. If you're using a framework that has multiple builders, you'll have to pick one. For example, if you're using `@storybook/react`, you'll have to pick between `@storybook/react-vite` and `@storybook/react-webpack5`. If you're using a framework that only has one builder (and therefore hasn't changed), you can just use that.

Additionally, there are framework packages which are specific to meta-frameworks, like Next.js and SvelteKit. If you pick them, make sure to also see [this section]().

The current list of frameworks include:

- `@storybook/angular` (did not change)
- `@storybook/ember` (did not change)
- `@storybook/html-vite`
- `@storybook/html-webpack5`
- `@storybook/preact-vite`
- `@storybook/preact-webpack5`
- `@storybook/react-vite`
- `@storybook/react-webpack5`
- `@storybook/nextjs`
- `@storybook/server-webpack5`
- `@storybook/svelte-vite`
- `@storybook/svelte-webpack5`
- `@storybook/sveltekit`
- `@storybook/vue-vite`
- `@storybook/vue-webpack5`
- `@storybook/vue3-vite`
- `@storybook/vue3-webpack5`
- `@storybook/web-components-vite`
- `@storybook/web-components-webpack5`

You can find more info on the rationale here: [Frameworks RFC](https://chromatic-ui.notion.site/Frameworks-RFC-89f8aafe3f0941ceb4c24683859ed65c).

**After picking your framework, you'll need to install it as a dev dependency.**

Because the new framework package will include the builder as well, you can remove any of the builder packages you were using before:

```js
'@storybook/builder-webpack5',
'@storybook/manager-webpack5',
'@storybook/builder-webpack4',
'@storybook/manager-webpack4',
'@storybook/builder-vite',
'storybook-builder-vite',
```

> Note:
> if your project is still using Webpack 4, you'll have to upgrade to Webpack 5 as [Webpack 4 support was discontinued](#webpack4-support-discontinued)

##### Framework field mandatory

In 6.4 we introduced a new `main.js` field called [`framework`](#mainjs-framework-field). Starting in 7.0, the `main.js` file has to include a `framework` field and it should be of the package you picked in earlier steps.

Here's an example, in case you picked `@storybook/react-vite`:

```js
// .storybook/main.js
export default {
  // ... your configuration
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
};
```

##### frameworkOptions renamed

In 7.0, the `main.js` fields `reactOptions` and `angularOptions` have been renamed. They are now options on the `framework` field.

For React, what used to be:

```js
export default {
  reactOptions: { fastRefresh: true },
  framework: {
    name: "@storybook/react-webpack5",
    options: {},
  },
};
```

Becomes:

```js
export default {
  framework: {
    name: "@storybook/react-webpack5",
    options: { fastRefresh: true },
  },
};
```

For Angular, what used to be:

```js
export default {
  angularOptions: { enableIvy: true },
  framework: {
    name: "@storybook/angular",
    options: {},
  },
};
```

Becomes:

```js
export default {
  framework: {
    name: "@storybook/angular",
    options: { enableIvy: true },
  },
};
```

##### builderOptions renamed

In 7.0, the `main.js` fields `core.builder` are now removed, in favor of the new frameworks api. The builder is defined as part of the framework package you pick, e.g. `@storybook/vue3-vite`. If you had options for your builder, they are now options on the `framework.builder` field.

What used to be:

```js
export default {
  core: {
    builder: {
      name: 'webpack5',
      options: { lazyCompilation: true }
    },
  }
  framework: {
    name: '@storybook/react-webpack5',
    options: {},
  },
};
```

Becomes:

```js
export default {
  framework: {
    name: "@storybook/react-webpack5",
    options: {
      builder: { lazyCompilation: true },
    },
  },
};
```

> Note:
> If after making this change, your `main.js` `core` field is empty, just delete it.

#### TypeScript: StorybookConfig type moved

If you are using TypeScript you should import the `StorybookConfig` type from your framework package.

For example:

```ts
import type { StorybookConfig } from "@storybook/react-vite";
const config: StorybookConfig = {
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  // ... your configuration
};
export default config;
```

#### Titles are statically computed

Up until version 7.0, it was possible to generate the default export of a CSF story by calling a function, or mixing in variables defined in other ES Modules. For instance:

```js
// Dynamically computed local title
const categories = {
  atoms: 'Atoms',
  molecules: 'Molecules',
  // etc.
}

export default {
  title: `${categories.atoms}/MyComponent`
}

// Title returned by a function
import { genDefault } from '../utils/storybook'

export default genDefault({
  category: 'Atoms',
  title: 'MyComponent',
})
```

This is no longer possible in Storybook 7.0, as story titles are parsed at build time. In earlier versions, titles were mostly produced manually. Now that [CSF3 auto-title](#csf3-auto-title-improvements) is available, optimisations were made that constrain how `id` and `title` can be defined manually.

As a result, titles cannot depend on variables or functions, and cannot be dynamically computed (even with local variables). Stories must have a static `title` property, or a static `component` property used by the [CSF3 auto-title](#csf3-auto-title-improvements) feature to compute a title.

Likewise, the `id` property must be statically defined. The URL defined for a story in the sidebar will be statically computed, so if you dynamically add an `id` through a function call like above, the story URL will not match the one in the sidebar and the story will be unreachable.

To opt-out of the old behavior you can set the `storyStoreV7` feature flag to `false` in `main.js`. However, a variety of performance optimizations depend on the new behavior, and the old behavior is deprecated and will be removed from Storybook in 8.0.

```js
module.exports = {
  features: {
    storyStoreV7: false,
  },
};
```

#### Framework standalone build moved

In 7.0 the location of the standalone node API has moved to `@storybook/core-server`.

If you used the React standalone API, for example, you might have written:

```js
const buildStandalone = require("@storybook/react/standalone");
const options = {};
buildStandalone(options).then(() => console.log("done"));
```

In 7.0, you would now use:

```js
const { build } = require("@storybook/core-server");
const options = {};
build(options).then(() => console.log("done"));
```

#### Change of root html IDs

The root ID unto which Storybook renders stories is renamed from `root` to `#storybook-root` to avoid conflicts with user's code.

#### Stories glob matches MDX files

If you used a directory based stories glob, in 6.x it would match `.stories.js` (and other JS extensions) and `.stories.mdx` files. For instance:

```js
// in main.js
export default {
  stories: ['../path/to/directory']
};

// or
export default {
  stories: [{ directory: '../path/to/directory' }]
};
```

In 7.0, this pattern will also match `.mdx` files (the new extension for docs files - see docs changes below). If you have `.mdx` files you don't want to appear in your storybook, either move them out of the directory, or add a `files` specifier with the old pattern (`"**/*.stories.@(mdx|tsx|ts|jsx|js)"`):

```js
export default {
  stories: [
    {
      directory: "../path/to/directory",
      files: "**/*.stories.@(mdx|tsx|ts|jsx|js)",
    },
  ],
};
```

#### Add strict mode

Starting in 7.0, Storybook's build tools add [`"use strict"`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Strict_mode) to the compiled JS output.

If user code in `.storybook/preview.js` or stories relies on "sloppy" mode behavior, it will need to be updated. As a workaround, it is sometimes possible to move the sloppy mode code inside a script tag in `.storybook/preview-head.html`.

#### Importing plain markdown files with `transcludeMarkdown` has changed

The `transcludeMarkdown` option in `addon-docs` have been removed, and the automatic handling of `.md` files in Vite projects have also been disabled.

Instead `.md` files can be imported as plain strings by adding the `?raw` suffix to the import, and then passed to the new `Markdown` block. In an MDX file that would look like this:

```
import { Markdown } from '@storybook/blocks';
import ReadMe from './README.md?raw';

...

<Markdown>{ReadMe}</Markdown>

```

#### Stories field in .storybook/main.js is mandatory

In 6.x, the `stories` key field in `.storybook/main.js` was optional. In 7.0, it is mandatory.
Please follow up the [Configure your Storybook project](https://storybook.js.org/docs/react/configure/#configure-your-storybook-project) section to configure your Storybook project.

#### Stricter global types

In 6.x, you could declare and use [`globals`](https://storybook.js.org/docs/react/essentials/toolbars-and-globals) without declaring their corresponding `globalTypes`. We've made this more strict in 7.0, so that the `globalTypes` declaration is required, and undeclared globals will be ignored.

#### Deploying build artifacts

Starting with 7.x, we are using modern [ECMAScript Modules (ESM)](https://nodejs.org/api/esm.html).

Those end up as `.mjs` files in your static Storybook artifact and need to be served as `application/javascript`, indicated by the `Content-Type` HTTP header.

For a simple HTTP server to view a Storybook build, you can run `npx http-server storybook-static`.

Note that [using the serve package](https://storybook.js.org/docs/react/faq#i-see-a-no-preview-error-with-a-storybook-production-build) will not work.

##### Dropped support for file URLs

In 6.x it was possible to open a Storybook build from the file system.

ESM requires loading over HTTP(S), which is incompatible with the browser's CORS settings for `file://` URLs.

So you now need to use a web server as described above.

##### Serving with nginx

With [nginx](https://www.nginx.com/), you need to extend [the MIME type handling](https://github.com/nginx/nginx/blob/master/conf/mime.types) in your configuration:

```
    include mime.types;
    types {
        application/javascript mjs;
    }
```

It would otherwise default to serving the `.mjs` files as `application/octet-stream`.

##### Ignore story files from node_modules

In 6.x Storybook literally followed the glob patterns specified in your `.storybook/main.js` `stories` field. Storybook 7.0 ignores files from `node_modules` unless your glob pattern includes the string `"node_modules"`.

Given the following `main.js`:

```js
export default {
  stories: ["../**/*.stories.*"],
};
```

If you want to restore the previous behavior to include `node_modules`, you can update it to:

```js
export default {
  stories: ["../**/*.stories.*", "../**/node_modules/**/*.stories.*"],
};
```

The first glob would have node_modules automatically excluded by Storybook, and the second glob would include all stories that are under a nested `node_modules` directory.

### 7.0 Core changes

#### 7.0 feature flags removed

Storybook uses temporary feature flags to opt-in to future breaking changes or opt-in to legacy behaviors. For example:

```js
module.exports = {
  features: {
    emotionAlias: false,
  },
};
```

In 7.0 we've removed the following feature flags:

| flag                | migration instructions                                      |
| ------------------- | ----------------------------------------------------------- |
| `emotionAlias`      | This flag is no longer needed and should be deleted.        |
| `breakingChangesV7` | This flag is no longer needed and should be deleted.        |
| `previewCsfV3`      | This flag is no longer needed and should be deleted.        |
| `babelModeV7`       | See [Babel mode v7 exclusively](#babel-mode-v7-exclusively) |

#### Story context is prepared before for supporting fine grained updates

This change modifies the way Storybook prepares stories to avoid reactive args to get lost for fine-grained updates JS frameworks as `SolidJS` or `Vue`. That's because those frameworks handle args/props as proxies behind the scenes to make reactivity work. So when `argType` mapping was done in `prepareStory` the Proxies were destroyed and args becomes a plain object again, losing the reactivity.

For avoiding that, this change passes the mapped args instead of raw args at `renderToCanvas` so that the proxies stay intact. Also decorators will benefit from this as well by receiving mapped args instead of raw args.

#### Changed decorator order between preview.js and addons/frameworks

In Storybook 7.0 we have changed the order of decorators being applied to allow you to access context information added by decorators defined in addons/frameworks from decorators defined in `preview.js`. To revert the order to the previous behavior, you can set the `features.legacyDecoratorFileOrder` flag to `true` in your `main.js` file:

```js
// main.js
export default {
  features: {
    legacyDecoratorFileOrder: true,
  },
};
```

#### Dark mode detection

Storybook 7 uses `prefers-color-scheme` to detects your system's dark mode preference if a theme is not set.

Earlier versions used the light theme by default, so if you don't set a theme and your system's settings are in dark mode, this could surprise you.

To learn more about theming, read our [documentation](https://storybook.js.org/docs/react/configure/theming).

#### `addons.setConfig` should now be imported from `@storybook/manager-api`.

The previous package, `@storybook/addons`, is now deprecated and will be removed in 8.0.

```diff
- import { addons } from '@storybook/addons';
+ import { addons } from '@storybook/manager-api';

addons.setConfig({
  // ...
})
```

### 7.0 core addons changes

#### Removed auto injection of @storybook/addon-actions decorator

The `withActions` decorator is no longer automatically added to stories. This is because it is really only used in the html renderer, for all other renderers it's redundant.
If you are using the html renderer and use the `handles` parameter, you'll need to manually add the `withActions` decorator:

```diff
import globalThis from 'global';
+import { withActions } from '@storybook/addon-actions/decorator';

export default {
  component: globalThis.Components.Button,
  args: {
    label: 'Click Me!',
  },
  parameters: {
    chromatic: { disable: true },
  },
};
export const Basic = {
  parameters: {
    handles: [{ click: 'clicked', contextmenu: 'right clicked' }],
  },
+  decorators: [withActions],
};
```

#### Addon-backgrounds: Removed deprecated grid parameter

Starting in 7.0 the `grid.cellSize` parameter should now be `backgrounds.grid.cellSize`. This was [deprecated in SB 6.1](#deprecated-grid-parameter).

#### Addon-a11y: Removed deprecated withA11y decorator

We removed the deprecated `withA11y` decorator. This was [deprecated in 6.0](#removed-witha11y-decorator)

#### Addon-interactions: Interactions debugger is now default

The interactions debugger in the panel is now displayed by default. The feature flag is now removed.

```js
// .storybook/main.js

const config = {
  features: {
    interactionsDebugger: true, // This should be removed!
  },
};
export default config;
```

### 7.0 Vite changes

#### Vite builder uses Vite config automatically

When using a [Vite-based framework](#framework-field-mandatory), Storybook will automatically use your `vite.config.(ctm)js` config file starting in 7.0.
Some settings will be overridden by Storybook so that it can function properly, and the merged settings can be modified using `viteFinal` in `.storybook/main.js` (see the [Storybook Vite configuration docs](https://storybook.js.org/docs/react/builders/vite#configuration)).
If you were using `viteFinal` in 6.5 to simply merge in your project's standard Vite config, you can now remove it.

For Svelte projects this means that the `svelteOptions` property in the `main.js` config should be omitted, as it will be loaded automatically via the project's `vite.config.js`.

#### Vite cache moved to node_modules/.cache/.vite-storybook

Previously, Storybook's Vite builder placed cache files in node_modules/.vite-storybook. However, it's more common for tools to place cached files into `node_modules/.cache`, and putting them there makes it quick and easy to clear the cache for multiple tools at once. We don't expect this change will cause any problems, but it's something that users of Storybook Vite projects should know about. It can be configured by setting `cacheDir` in `viteFinal` within `.storybook/main.js` [Storybook Vite configuration docs](https://storybook.js.org/docs/react/builders/vite#configuration)).

### 7.0 Webpack changes

#### Webpack4 support discontinued

SB7.0 no longer supports Webpack4.

Depending on your project specifics, it might be possible to run your Storybook using the webpack5 builder without error.

If you are running into errors, you can upgrade your project to Webpack5 or you can try debugging those errors.

To upgrade:

- If you're configuring Webpack directly, see the Webpack5 [release announcement](https://webpack.js.org/blog/2020-10-10-webpack-5-release/) and [migration guide](https://webpack.js.org/migrate/5).
- If you're using Create React App, see the [migration notes](https://github.com/facebook/create-react-app/blob/main/CHANGELOG.md#migrating-from-40x-to-500) to upgrade from V4 (Webpack4) to 5

During the 7.0 dev cycle we will be updating this section with useful resources as we run across them.

#### Babel mode v7 exclusively

_Has automigration_

Storybook now uses [Babel mode v7](#babel-mode-v7) exclusively. In 6.x, Storybook provided its own babel settings out of the box. Now, Storybook's uses your project's babel settings (`.babelrc`, `babel.config.js`, etc.) instead.

> Note:
> If you are using @storybook/react-webpack5 with the @storybook/preset-create-react-app package, you don't need to do anything. The preset already provides the babel configuration you need.

In the new mode, Storybook expects you to provide a configuration file. Depending on the complexity your project, Storybook will fail to run without a babel configuration. If you want a configuration file that's equivalent to the 6.x default, you can run the following command in your project directory:

```sh
npx storybook@latest babelrc
```

This command will create a `.babelrc.json` file in your project, containing a few babel plugins which will be installed as dev dependencies.

#### Postcss removed

Storybook 6.x installed postcss by default. In 7.0 built-in support has been removed for Webpack-based frameworks. If you need it, you can add it back using [`@storybook/addon-postcss`](https://github.com/storybookjs/addon-postcss).

#### Removed DLL flags

Earlier versions of Storybook used Webpack DLLs as a performance crutch. In 6.1, we've removed Storybook's built-in DLLs and have deprecated the command-line parameters `--no-dll` and `--ui-dll`. In 7.0 those options are removed.

### 7.0 Framework-specific changes

#### Angular: Removed deprecated `component` and `propsMeta` field

The deprecated fields `component` and `propsMeta` on the NgStory type have been removed.

#### Angular: Drop support for Angular < 14

Starting in 7.0, we drop support for Angular < 14

#### Angular: Drop support for calling Storybook directly

_Has automigration_

In Storybook 6.4 we deprecated calling Storybook directly (e.g. `npm run storybook`) for Angular. In Storybook 7.0, we've removed it entirely. Instead, you have to set up the Storybook builder in your `angular.json` and execute `ng run <your-project>:storybook` to start Storybook.

You can run `npx storybook@next automigrate` to automatically fix your configuration, or visit https://github.com/storybookjs/storybook/tree/next/code/frameworks/angular/README.md#how-do-i-migrate-to-an-angular-storybook-builder for instructions on how to set up Storybook for Angular manually.

#### Angular: Application providers and ModuleWithProviders

In Storybook 7.0 we use the new bootstrapApplication API to bootstrap a standalone component to the DOM. The component is configured in a way to respect your configured imports, declarations and schemas, which you can define via the `moduleMetadata` decorator imported from `@storybook/angular`.

This means also, that there is no root ngModule anymore. Previously you were able to add ModuleWithProviders, likely the result of a 'Module.forRoot()'-style call, to your 'imports' array of the moduleMetadata definition. This is now discouraged. Instead, you should use the `applicationConfig` decorator to add your application-wide providers. These providers will be passed to the bootstrapApplication function.

For example, if you want to configure BrowserAnimationModule in your stories, please extract the necessary providers the following way and provide them via the `applicationConfig` decorator:

```js
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { importProvidersFrom } from "@angular/core";
import { applicationConfig, Meta, StoryObj } from "@storybook/angular";
import { ExampleComponent } from "./example.component";

const meta: Meta = {
  title: "Example",
  component: ExampleComponent,
  decorators: [
    // Define application-wide providers with the applicationConfig decorator
    applicationConfig({
      providers: [
        importProvidersFrom(BrowserAnimationsModule),
        // Extract all providers (and nested ones) from a ModuleWithProviders
        importProvidersFrom(SomeOtherModule.forRoot()),
      ],
    }),
  ],
};

export default meta;

type Story = StoryObj<typeof ExampleComponent>;

export const Default: Story = {
  render: () => ({
    // Define application-wide providers directly in the render function
    applicationConfig: {
      providers: [importProvidersFrom(BrowserAnimationsModule)],
    },
  }),
};
```

You can also use the `provide-style` decorator to provide an application-wide service:

```js
import { provideAnimations } from "@angular/platform-browser/animations";
import { moduleMetadata } from "@storybook/angular";

export default {
  title: "Example",
  decorators: [
    applicationConfig({
      providers: [provideAnimations()],
    }),
  ],
};
```

Please visit https://angular.io/guide/standalone-components#configuring-dependency-injection for more information.

#### Angular: Removed legacy renderer

The `parameters.angularLegacyRendering` option is removed. You cannot use the old legacy renderer anymore.

#### Angular: Initializer functions

Initializer functions using the `APP_INITIALIZER` dependency injection token only run when the component renders. To ensure an initializer function is always executed, you can adjust your `.storybook/preview.ts` and invoke it directly.

```js
myCustomInitializer();
export default preview;
```

#### Next.js: use the `@storybook/nextjs` framework

In Storybook 7.0 we introduced a convenient package that provides an out of the box experience for Next.js projects: `@storybook/nextjs`. Please see the [following resource](./code/frameworks/nextjs/README.md#getting-started) to get started with it.

#### SvelteKit: needs the `@storybook/sveltekit` framework

In Storybook 7.0 we introduced a convenient package that provides an out of the box experience for SvelteKit projects: `@storybook/sveltekit`. Please see the [following resource](./code/frameworks/sveltekit/README.md#getting-started) to get started with it.

For existing users, SvelteKit projects need to use the `@storybook/sveltekit` framework in the `main.js` file. Previously it was enough to just setup Storybook with Svelte+Vite, but that is no longer the case.

```js
// .storybook/main.js
export default {
  framework: "@storybook/sveltekit",
};
```

Also see the note in [Vite builder uses Vite config automatically](#vite-builder-uses-vite-config-automatically) about removing `svelteOptions`.

#### Vue3: replaced app export with setup

In 6.x `@storybook/vue3` exported a Vue application instance called `app`. In 7.0, this has been replaced by a `setup` function that can be used to initialize the application in your `.storybook/preview.js`:

Before:

```js
import { app } from "@storybook/vue3";
import Button from "./Button.vue";

app.component("GlobalButton", Button);
```

After:

```js
import { setup } from "@storybook/vue3";
import Button from "./Button.vue";

setup((app) => {
  app.component("GlobalButton", Button);
});
```

#### Web-components: dropped lit-html v1 support

In v6.x `@storybook/web-components` had a peer dependency on `lit-html` v1 or v2. In 7.0 we've dropped support for `lit-html` v1 and now uses `lit` v2 instead. Please upgrade your project's `lit-html` dependency if you're still on 1.x.

#### Create React App: dropped CRA4 support

Since v7 [drops webpack4 support](#webpack4-support-discontinued), it no longer supports Create React App < 5.0. If you're using an earlier version of CRA, please upgrade or stay on Storybook 6.x.

#### HTML: No longer auto-dedents source code

The `@storybook/html` renderer doesn't dedent the source code when displayed in the "Show Code" source viewer any more.

You can get the same result by setting [the parameter `parameters.docs.source.format = "dedent"`](https://storybook.js.org/docs/7.0/html/api/doc-block-source#format) either on a story level or globally in `preview.js`.

### 7.0 Addon authors changes

#### New Addons API

Storybook 7 adds 2 new packages for addon authors to use: `@storybook/preview-api` and `@storybook/manager-api`.
These 2 packages replace `@storybook/addons`.

When adding addons to storybook, you can (for example) add panels:

```js
import { addons } from "@storybook/manager-api";

addons.addPanel("my-panel", {
  title: "My Panel",
  render: ({ active, key }) => <div>My Panel</div>,
});
```

Note that this before would import `addons` from `@storybook/addons`, but now it imports `{ addons }` from `@storybook/manager-api`.
The `addons` export is now a named export only, there's no default export anymore, so make sure to update this usage.

The package `@storybook/addons` is still available, but it's only for backwards compatibility. It's not recommended to use it anymore.

It's also been used by addon creators to gain access to a few APIs like `makeDecorator`.
These APIs are now available in `@storybook/preview-api`.

Storybook users have had access to a few storybook-lifecycle hooks such as `useChannel`, `useParameter`, `useStorybookState`;
when these hooks are used in panels, they should be imported from `@storybook/manager-api`.
When these hooks are used in decorators/stories, they should be imported from `@storybook/preview-api`.

Storybook 7 includes `@storybook/addons` shim package that provides the old API and calls the new API under the hood.
This backwards compatibility will be removed in a future release of storybook.

Here's an example of using the new API:
The `@storybook/preview-api` is used here, because the `useEffect` hook is used in a decorator.

```js
import { useEffect, makeDecorator } from "@storybook/preview-api";

export const withMyAddon = makeDecorator({
  name: "withMyAddon",
  parameterName: "myAddon",
  wrapper: (getStory) => {
    useEffect(() => {
      // do something with the options
    }, []);
    return getStory(context);
  },
});
```

##### Specific instructions for addon creators

If you're an addon creator, you'll have to update your addon to use the new APIs.

That means you'll have to release a breaking release of your addon to make it compatible with Storybook 7.
It should no longer depend on `@storybook/addons`, but instead on `@storybook/preview-api` and/or `@storybook/manager-api`.

You might also depend (and use) these packages in your addon's decorators: `@storybook/store`, `@storybook/preview-web`, `@storybook/core-client`, `@storybook/client-api`; these have all been consolidated into `@storybook/preview-api`.
So if you use any of these packages, please import what you need from `@storybook/preview-api` instead.

Storybook 7 will prepare manager-code for the browser using ESbuild (before it was using a combination of webpack + babel).
This is a very important change, though it will not affect most addons.
It means that when creating custom addons, particularly custom addons within the repo in which they are consumed,
you will need to be aware that this code is not passed though babel, and thus will not use your babel config.
This can result in errors if you are using experimental JS features in your addon code, not supported yet by ESbuild,
or using babel dependent features such as Component selectors in Emotion.

ESbuild also places some constraints on things you can import into your addon's manager code: only woff2 files are supported, and not all image file types are supported.
Here's the [list](https://github.com/storybookjs/storybook/blob/next/code/builders/builder-manager/src/index.ts#L53-L70) of supported file types.

This is not configurable.

If this is a problem for your addon, you need to pre-compile your addon's manager code to ensure it works.

If you addon also introduces preview code (such a decorators) it will be passed though whatever builder + config the user has configured for their project; this hasn't changed.

In both the preview and manager code it's good to remember [Storybook now targets modern browser only](#modern-browser-support).

The package `@storybook/components` contain a lot of components useful for building addons.
Some of these addons have been moved to a new package `@storybook/blocks`.
These components were moved: `ColorControl`, `ColorPalette`, `ArgsTable`, `ArgRow`, `TabbedArgsTable`, `SectionRow`, `Source`, `Code`.

##### Specific instructions for addon users

All of storybook's core addons have been updated and are ready to use with Storybook 7.

We're working with the community to update the most popular addons.
But if you're using an addon that hasn't been updated yet, it might not work.

It's possible for example for older addons to use APIs that are no longer available in Storybook 7.
Your addon might not show upside of the storybook (manager) UI, or storybook might fail to start entirely.

When this happens to you please open an issue on the addon's repo, and ask the addon author to update their addon to be compatible with Storybook 7.
It's also useful for the storybook team to know which addons are not yet compatible, so please open an issue on the storybook repo as well; particularly if the addon is popular and causes a critical failure.

Here's a list of popular addons that are known not to be compatible with Storybook 7 yet:

- [ ] [storybook-addon-jsx](https://github.com/storybookjs/addon-jsx)
- [ ] [storybook-addon-dark-mode](https://github.com/hipstersmoothie/storybook-dark-mode)

Though storybook should de-duplicate storybook packages, storybook CLI's `upgrade` command will warn you when you have multiple storybook-dependencies, because it is a possibility that this causes addons/storybook to not work, so when running into issues, please run this:

```
npx sb upgrade
```

#### register.js removed

In SB 6.x and earlier, addons exported a `register.js` entry point by convention, and users would import this in `.storybook/manager.js`. This was [deprecated in SB 6.5](#deprecated-registerjs)

In 7.0, most of Storybook's addons now export a `manager.js` entry point, which is automatically registered in Storybook's manager when the addon is listed in `.storybook/main.js`'s `addons` field.

If your `.manager.js` config references `register.js` of any of the following addons, you can remove it: `a11y`, `actions`, `backgrounds`, `controls`, `interactions`, `jest`, `links`, `measure`, `outline`, `toolbars`, `viewport`.

#### No more default export from `@storybook/addons`

The default export from `@storybook/addons` has been removed. Please use the named exports instead:

```js
import { addons } from "@storybook/addons";
```

The named export has been available since 6.0 or earlier, so your updated code will be backwards-compatible with older versions of Storybook.

#### No more configuration for manager

The Storybook manager is no longer built with Webpack. Now it's built with esbuild.
Therefore, it's no longer possible to configure the manager. Esbuild comes preconfigured to handle importing CSS, and images.

If you're currently loading files other than CSS or images into the manager, you'll need to make changes so the files get converted to JS before publishing your addon.

This means the preset value `managerWebpack` is no longer respected, and should be removed from presets and `main.js` files.

Addons that run in the manager can depend on `react` and `@storybook/*` packages directly. They do not need to be peerDependencies.
But very importantly, the build system ensures there will only be 1 version of these packages at runtime. The version will come from the `@storybook/ui` package, and not from the addon.
For this reason it's recommended to have these dependencies as `devDependencies` in your addon's `package.json`.

The full list of packages that Storybook's manager bundler makes available for addons is here: https://github.com/storybookjs/storybook/blob/next/code/lib/ui/src/globals/types.ts

Addons in the manager will no longer be bundled together anymore, which means that if 1 fails, it doesn't break the whole manager.
Each addon is imported into the manager as an ESM module that's bundled separately.

#### Icons API changed

For addon authors who use the `Icons` component, its API has been updated in Storybook 7.

```diff
export interface IconsProps extends ComponentProps<typeof Svg> {
-  icon?: IconKey;
-  symbol?: IconKey;
+  icon: IconType;
+  useSymbol?: boolean;
}
```

Full change here: https://github.com/storybookjs/storybook/pull/18809

#### Removed global client APIs

The `addParameters` and `addDecorator` APIs to add global decorators and parameters, exported by the various frameworks (e.g. `@storybook/react`) and `@storybook/client` were deprecated in 6.0 and have been removed in 7.0.

Instead, use `export const parameters = {};` and `export const decorators = [];` in your `.storybook/preview.js`. Addon authors similarly should use such an export in a preview entry file (see [Preview entries](https://github.com/storybookjs/storybook/blob/next/docs/addons/writing-presets.md#preview-entries)).

#### framework parameter renamed to renderer

All SB6.x frameworks injected a parameter called `framework` indicating to addons which framework is running.
For example, the framework value of `@storybook/react` would be `react`, `@storybook/vue` would be `vue`, etc.
Now those packages are called renderers in SB7, so the renderer information is now available in the `renderer`
parameter.

### 7.0 Docs changes

The information hierarchy of docs in Storybook has changed in 7.0. The main difference is that each docs is listed in the sidebar as a separate entry underneath the component, rather than attached to individual stories. You can also opt-in to a Autodocs entry rather than having one for every component (previously stories).

We've also modernized the API for all the doc blocks (the MDX components you use to write custom docs pages), which we'll describe below.

#### Autodocs changes

In 7.0, rather than rendering each story in "docs view mode", Autodocs (formerly known as "Docs Page") operates by adding additional sidebar entries for each component. By default it uses the same template as was used in 6.x, and the entries are entitled `Docs`.

You can configure Autodocs in `main.js`:

```js
module.exports = {
  docs: {
    autodocs: true, // see below for alternatives
    defaultName: "Docs", // set to change the name of generated docs entries
  },
};
```

If you are migrating from 6.x your `docs.autodocs` option will have been set to `true`, which has the effect of enabling docs page for _every_ CSF file. However, as of 7.0, the new default is `'tag'`, which requires opting into Autodocs per-CSF file, with the `autodocs` **tag** on your component export:

```ts
export default {
  component: MyComponent
  // Tags are a new feature coming in 7.1, that we are using to drive this behaviour.
  tags: ['autodocs']
}
```

You can also set `autodocs: false` to opt-out of Autodocs entirely. Further configuration of Autodocs is described below.

**Parameter changes**

We've renamed many of the parameters that control docs rendering for consistency with the blocks (see below). The old parameters are now deprecated and will be removed in 8.0. Here is a full list of changes:

- `docs.inlineStories` has been renamed `docs.story.inline`
- `docs.iframeHeight` has been renamed `docs.story.iframeHeight`
- `notes` and `info` are no longer supported, instead use `docs.description.story | component`

#### MDX docs files

Previously `.stories.mdx` files were used to both define and document stories. In 7.0, we have deprecated defining stories in MDX files, and consequently have changed the suffix to simply `.mdx`. Our default `stories` glob in `main.js` will now match such files -- if you want to write MDX files that do not appear in Storybook, you may need to adjust the glob accordingly.

If you were using `.stories.mdx` files to write stories, we encourage you to move the stories to a CSF file, and _attach_ an `.mdx` file to that CSF file to document them. You can use the `Meta` block to attach a MDX file to a CSF file, and the `Story` block to render the stories:

```mdx
import { Meta, Story } from "@storybook/blocks";
import * as ComponentStories from "./some-component.stories";

<Meta of={ComponentStories} />

<Story of={ComponentStories.Primary} />
```

(Note the `of` prop is only supported if you change your MDX files to plain `.mdx`, it's not supported in `.stories.mdx` files)

You can create as many docs entries as you like for a given component. By default the docs entry will be named the same as the `.mdx` file (e.g. `Introduction.mdx` becomes `Introduction`). If the docs file is named the same as the component (e.g. `Button.mdx`, it will use the default autodocs name (`"Docs"`) and override autodocs).

By default docs entries are listed first for the component. You can sort them using story sorting.

#### Unattached docs files

In Storybook 6.x, to create a unattached docs MDX file (that is, one not attached to story or a CSF file), you'd have to create a `.stories.mdx` file, and describe its location with the `Meta` doc block:

```mdx
import { Meta } from "@storybook/addon-docs";

<Meta title="Introduction" />
```

In 7.0, things are a little simpler -- you should call the file `.mdx` (drop the `.stories`). This will mean behind the scenes there is no story attached to this entry. You may also drop the `title` and use autotitle (and leave the `Meta` component out entirely, potentially).

#### Doc Blocks

Additionally to changing the docs information architecture, we've updated the API of the doc blocks themselves to be more consistent and future proof.

**General changes**

- Each block now uses `of={}` as a primary API -- where the argument to the `of` prop is a CSF or story _export_. The `of` prop is only supported in plain `.mdx` files and not `.stories.mdx` files.

- When you've attached to a CSF file (with the `Meta` block, or in Autodocs), you can drop the `of` and the block will reference the first story or the CSF file as a whole.

- Most other props controlling rendering of blocks now correspond precisely to the parameters for that block [defined for autodocs above](#autodocs-changes).

##### Meta block

The primary change of the `Meta` block is the ability to attach to CSF files with `<Meta of={}>` as described above.

##### Description block, `parameters.notes` and `parameters.info`

In 6.5 the Description doc block accepted a range of different props, `markdown`, `type` and `children` as a way to customize the content.
The props have been simplified and the block now only accepts an `of` prop, which can be a reference to either a CSF file, a default export (meta) or a story export, depending on which description you want to be shown. See TDB DOCS LINK for a deeper explanation of the new prop.

`parameters.notes` and `parameters.info` have been deprecated as a way to specify descriptions. Instead use JSDoc comments above the default export or story export, or use `parameters.docs.description.story | component` directly. See TDB DOCS LINK for a deeper explanation on how to write descriptions.

If you were previously using the `Description` block to render plain markdown in your docs, that behavior can now be achieved with the new `Markdown` block instead like this:

```
import { Markdown } from '@storybook/blocks';
import ReadMe from './README.md?raw';

...

<Markdown>{ReadMe}</Markdown>

```

Notice the `?raw` suffix in the markdown import is needed for this to work.

##### Story block

To reference a story in a MDX file, you should reference it with `of`:

```mdx
import { Meta, Story } from "@storybook/blocks";
import * as ComponentStories from "./some-component.stories";

<Meta of={ComponentStories} />

<Story of={ComponentStories.standard} />
```

You can also reference a story from a different component:

```mdx
import { Meta, Story } from "@storybook/blocks";
import * as ComponentStories from "./some-component.stories";
import * as SecondComponentStories from "./second-component.stories";

<Meta of={ComponentStories} />

<Story of={SecondComponentStories.standard} meta={SecondComponentStories} />
```

Referencing stories by `id="xyz--abc"` is deprecated and should be replaced with `of={}` as above.

##### Source block

The source block now references a single story, the component, or a CSF file itself via the `of={}` parameter.

Referencing stories by `id="xyz--abc"` is deprecated and should be replaced with `of={}` as above. Referencing multiple stories via `ids={["xyz--abc"]}` is now deprecated and should be avoided (instead use two source blocks).

The parameter to transform the source has been consolidated from the multiple parameters of `parameters.docs.transformSource`, `parameters.docs.source.transformSource`, and `parameters.jsx.transformSource` to the single `parameters.docs.source.transform`. The behavior is otherwise unchanged.

##### Canvas block

The Canvas block follows the same changes as [the Story block described above](#story-block).

Previously the Canvas block accepted children (Story blocks) as a way to reference stories. That has now been replaced with the `of={}` prop that accepts a reference to _a story_.
That also means the Canvas block no longer supports containing multiple stories or elements, and thus the props related to that - `isColumn` and `columns` - have also been deprecated.

- To pass props to the inner Story block use the `story={{ }}` prop
- Similarly, to pass props to the inner Source block use the `source={{ }}` prop.
- The `mdxSource` prop has been deprecated in favor of using `source={{ code: '...' }}`
- The `withSource` prop has been renamed to `sourceState`

Here's a full example of the new API:

```mdx
import { Meta, Canvas } from "@storybook/blocks";
import * as ComponentStories from "./some-component.stories";

<Meta of={ComponentStories} />

<Canvas
  of={ComponentStories.standard}
  story={{
    inline: false,
    height: '200px'
  }}
  source={{
    language: 'html',
    code: 'custom code...'
  }}
  withToolbar={true}
  additionalActions={[...]}
  layout="fullscreen"
  className="custom-class"
/>
```

##### ArgsTable block

The `ArgsTable` block is now deprecated, and two new blocks: `ArgTypes` and `Controls` should be preferred.

- `<ArgTypes of={storyExports OR metaExports OR component} />` will render a readonly table of args/props descriptions for a story, CSF file or component. If `of` omitted and the MDX file is attached it will render the arg types defined at the CSF file level.

- `<Controls of={storyExports} />` will render the controls for a story (or the primary story if `of` is omitted and the MDX file is attached).

The following props are not supported in the new blocks:

- `components` - to render more than one component in a single table
- `showComponent` to show the component's props as well as the story's args
- the `subcomponents` annotation to show more components on the table.
- `of="^"` to reference the meta (just omit `of` in that case, for `ArgTypes`).
- `story="^"` to reference the primary story (just omit `of` in that case, for `Controls`).
- `story="."` to reference the current story (this no longer makes sense in Docs 2).
- `story="name"` to reference a story (use `of={}`).

#### Configuring Autodocs

As in 6.x, you can override the docs container to configure docs further. This is the container that each docs entry is rendered inside:

```js
// in preview.js

export const parameters = {
  docs: {
    container: // your container
  }
}
```

Note that the container must be implemented as a _React component_.

You likely want to use the `DocsContainer` component exported by `@storybook/blocks` and consider the following examples:

**Overriding theme**:

To override the theme, you can continue to use the `docs.theme` parameter.

**Overriding MDX components**

If you want to override the MDX components supplied to your docs page, use the `MDXProvider` from `@mdx-js/react`:

```js
import { MDXProvider } from "@mdx-js/react";
import { DocsContainer } from "@storybook/blocks";
import * as DesignSystem from "your-design-system";

export const MyDocsContainer = (props) => (
  <MDXProvider
    components={{
      h1: DesignSystem.H1,
      h2: DesignSystem.H2,
    }}
  >
    <DocsContainer {...props} />
  </MDXProvider>
);
```

**_NOTE_**: due to breaking changes in MDX2, such override will _only_ apply to elements you create via the MDX syntax, not pure HTML -- ie. `## content` not `<h2>content</h2>`.

#### MDX2 upgrade

Storybook 7 Docs uses MDXv2 instead of MDXv1. This means an improved syntax, support for inline JS expression, and improved performance among [other benefits](https://mdxjs.com/blog/v2/).

If you use `.stories.mdx` files in your project, you'll probably need to edit them since MDX2 contains [breaking changes](https://mdxjs.com/migrating/v2/#update-mdx-files). In general, MDX2 is stricter and more structured than MDX1.

We've provided an automigration, `mdx1to2` that makes a few of these changes automatically. For example, `mdx1to2` automatically converts MDX1-style HTML comments into MDX2-style JSX comments to save you time.

Unfortunately, the set of changes from MDX1 to MDX2 is vast, and many changes are subtle, so the bulk of the migration will be manual. You can use the [MDX Playground](https://mdxjs.com/playground/) to try out snippets interactively.

#### Legacy MDX1 support

If you get stuck with the [MDX2 upgrade](#mdx2-upgrade), we also provide opt-in legacy MDX1 support. This is intended as a temporary solution while you upgrade your Storybook; MDX1 will be discontinued in Storybook 8.0. The MDX1 library is no longer maintained and installing it results in `npm audit` security warnings.

To process your `.stories.mdx` files with MDX1, first install the `@storybook/mdx1-csf` package in your project:

```
yarn add -D @storybook/mdx1-csf@latest
```

Then enable the `legacyMdx1` feature flag in your `.storybook/main.js` file:

```js
export default {
  features: {
    legacyMdx1: true,
  },
};
```

NOTE: This only affects `.(stories|story).mdx` files. Notably, if you want to use Storybook 7's "pure" `.mdx` format, you'll need to use MDX2 for that.

#### Default docs styles will leak into non-story user components

Storybook's default styles in docs are now globally applied to any element instead of using classes. This means that any component that you add directly in a docs file will also get the default styles.

To mitigate this you need to wrap any content you don't want styled with the `Unstyled` block like this:

```mdx
import { Unstyled } from "@storybook/blocks";
import { MyComponent } from "./MyComponent";

# This is a header

<Unstyled>
  <MyComponent />
</Unstyled>
```

Components that are part of your stories or in a canvas will not need this mitigation, as the `Story` and `Canvas` blocks already have this built-in.

#### Explicit `<code>` elements are no longer syntax highlighted

Due to how MDX2 works differently from MDX1, manually defined `<code>` elements are no longer transformed to the `Code` component, so it will not be syntax highlighted. This is not the case for markdown \`\`\` code-fences, that will still end up as `Code` with syntax highlighting.

Luckily [MDX2 supports markdown (like code-fences) inside elements better now](https://mdxjs.com/blog/v2/#improvements-to-the-mdx-format), so most cases where you needed a `<code>` element before, you can use code-fences instead:

<!-- prettier-ignore-start -->
````md
<code>This will now be an unstyled line of code</code>

```js
const a = 'This is still a styled code block.';
```

<div style={{ background: 'red', padding: '10px' }}>
  ```js
  const a = 'MDX2 supports markdown in elements better now, so this is possible.';
  ```
</div>
````
<!-- prettier-ignore-end -->

#### Dropped source loader / storiesOf static snippets

In SB 6.x, Storybook Docs used a Webpack loader called `source-loader` to help display static code snippets. This was configurable using the `options.sourceLoaderOptions` field.

In SB 7.0, we've moved to a faster, simpler alternative called `csf-plugin` that **only supports CSF**. It is configurable using the `options.csfPluginOptions` field.

If you're using `storiesOf` and want to restore the previous behavior, you can add `source-loader` by hand to your Webpack config using the following snippet in `main.js`:

```js
module.exports = {
  webpackFinal: (config) => {
    config.module.rules.push({
      test: /\.stories\.[tj]sx?$/,
      use: [
        {
          loader: require.resolve("@storybook/source-loader"),
          options: {} /* your sourceLoaderOptions here */,
        },
      ],
      enforce: "pre",
    });
    return config;
  },
};
```

#### Removed docs.getContainer and getPage parameters

It is no longer possible to set `parameters.docs.getContainer()` and `getPage()`. Instead use `parameters.docs.container` or `parameters.docs.page` directly.

#### Addon-docs: Removed deprecated blocks.js entry

Removed `@storybook/addon-docs/blocks` entry. Import directly from `@storybook/blocks` instead. This was [deprecated in SB 6.3](#deprecated-scoped-blocks-imports).

#### Dropped addon-docs manual babel configuration

Addon-docs previously accepted `configureJsx` and `mdxBabelOptions` options, which allowed full customization of the babel options used to process markdown and mdx files. This has been simplified in 7.0, with a new option, `jsxOptions`, which can be used to customize the behavior of `@babel/preset-react`.

#### Dropped addon-docs manual configuration

Storybook Docs 5.x shipped with instructions for how to manually configure Webpack and Storybook without the use of Storybook's "presets" feature. Over time, these docs went out of sync. Now in Storybook 7 we have removed support for manual configuration entirely.

#### Autoplay in docs

Running play functions in docs is generally tricky, as they can steal focus and cause the window to scroll. Consequently, we've disabled play functions in docs by default.

If your story depends on a play function to render correctly, _and_ you are confident the function autoplaying won't mess up your docs, you can set `parameters.docs.autoplay = true` to have it auto play.

#### Removed STORYBOOK_REACT_CLASSES global

This was a legacy global variable from the early days of react docgen. If you were using this variable, you can instead use docgen information which is added directly to components using `.__docgenInfo`.

### 7.0 Deprecations and default changes

#### storyStoreV7 enabled by default

SB6.4 introduced [Story Store V7](#story-store-v7), an optimization which allows code splitting for faster build and load times. This was an experimental, opt-in change and you can read more about it in [the migration notes below](#story-store-v7). TLDR: you can't use the legacy `storiesOf` API or dynamic titles in CSF.

Now in 7.0, Story Store V7 is the default. You can opt-out of it by setting the feature flag in `.storybook/main.js`:

```js
module.exports = {
  features: {
    storyStoreV7: false,
  },
};
```

During the 7.0 dev cycle we will be preparing recommendations and utilities to make it easier for `storiesOf` users to upgrade.

#### `Story` type deprecated

_Has codemod_

In 6.x you were able to do this:

```ts
import type { Story } from "@storybook/react";

export const MyStory: Story = () => <div />;
```

However with the introduction of CSF3, the `Story` type has been deprecated in favor of two other types: `StoryFn` for CSF2 and `StoryObj` for CSF3.

```ts
import type { StoryFn, StoryObj } from "@storybook/react";

export const MyCsf2Story: StoryFn = () => <div />;
export const MyCsf3Story: StoryObj = {
  render: () => <div />,
};
```

This change is part of our move to CSF3, which uses objects instead of functions to represent stories.
You can read more about the CSF3 format here: https://storybook.js.org/blog/component-story-format-3-0/

We have set up a codemod that attempts to automatically migrate your code for you (update the glob to suit your needs):

```
npx storybook@next migrate upgrade-deprecated-types --glob="**/*.stories.tsx"
```

#### `ComponentStory`, `ComponentStoryObj`, `ComponentStoryFn` and `ComponentMeta` types are deprecated

_Has codemod_

The type of `StoryObj` and `StoryFn` have been changed in 7.0 so that both the "component" as "the props of the component" will be accepted as the generic parameter. You can now replace the types:

```
ComponentStory -> StoryFn (CSF2) or StoryObj (CSF3)
ComponentStoryObj -> StoryObj
ComponentStoryFn -> StoryFn
ComponentMeta -> Meta
```

Here are a few examples:

```ts
import type { StoryFn, StoryObj } from "@storybook/react";
import { Button, ButtonProps } from "./Button";

// This works in 7.0, making the ComponentX types redundant.
const meta: Meta<typeof Button> = { component: Button };

export const CSF3Story: StoryObj<typeof Button> = { args: { label: "Label" } };

export const CSF2Story: StoryFn<typeof Button> = (args) => <Button {...args} />;
CSF2Story.args = { label: "Label" };

// Passing props directly still works as well.
const meta: Meta<ButtonProps> = { component: Button };

export const CSF3Story: StoryObj<ButtonProps> = { args: { label: "Label" } };

export const CSF2Story: StoryFn<ButtonProps> = (args) => <Button {...args} />;
CSF2Story.args = { label: "Label" };
```

We have set up a codemod that attempts to automatically migrate your code for you (update the glob to suit your needs):

```
npx storybook@next migrate upgrade-deprecated-types --glob="**/*.stories.tsx"
```

#### Renamed `renderToDOM` to `renderToCanvas`

The "rendering" function that renderers (ex-frameworks) must export (`renderToDOM`) has been renamed to `renderToCanvas` to acknowledge that some consumers of frameworks/the preview do not work with DOM elements.

#### Renamed `XFramework` to `XRenderer`

In 6.x you could import XFramework types:

```ts
import type { ReactFramework } from "@storybook/react";
import type { VueFramework } from "@storybook/vue";
import type { SvelteFramework } from "@storybook/svelte";

// etc.
```

Those are deprecated in 7.0 as they are renamed to:

```ts
import type { ReactRenderer } from "@storybook/react";
import type { VueRenderer } from "@storybook/vue";
import type { SvelteRenderer } from "@storybook/svelte";

// etc.
```

#### Renamed `DecoratorFn` to `Decorator`

In 6.x you could import the type `DecoratorFn`:

```ts
import type { DecoratorFn } from "@storybook/react";
```

This type is deprecated in 7.0, instead you can use the type `Decorator`, which is now available for all renderers:

```ts
import type { Decorator } from "@storybook/react";
// or
import type { Decorator } from "@storybook/vue";
// or
import type { Decorator } from "@storybook/svelte";
// etc.
```

The type `Decorator` accepts a generic parameter `TArgs`. This can be used like this:

```tsx
import type { Decorator } from "@storybook/react";
import { LocaleProvider } from "./locale";

const withLocale: Decorator<{ locale: "en" | "es" }> = (Story, { args }) => (
  <LocaleProvider lang={args.locale}>
    <Story />
  </LocaleProvider>
);
```

If you want to use `Decorator` in a backwards compatible way to `DecoratorFn`, you can use:

```tsx
import type { Args, Decorator } from '@storybook/react';

// Decorator<Args> behaves the same as DecoratorFn (without generic)
const withLocale: Decorator<Args> = (Story, { args }) => // args has type { [name: string]: any }
```

#### CLI option `--use-npm` deprecated

With increased support for more package managers (pnpm), we have introduced the `--package-manager` CLI option. Please use `--package-manager=npm` to force NPM to be used to install dependencies when running Storybook CLI commands. Other valid options are `pnpm`, `yarn1`, and `yarn2` (`yarn2` is for versions 2 and higher).

#### 'config' preset entry replaced with 'previewAnnotations'

The preset field `'config'` has been replaced with `'previewAnnotations'`. `'config'` is now deprecated and will be removed in Storybook 8.0.

Additionally, the internal field `'previewEntries'` has been removed. If you need a preview entry, just use a `'previewAnnotations'` file and don't export anything.

## From version 6.4.x to 6.5.0

### Vue 3 upgrade

Storybook 6.5 supports Vue 3 out of the box when you install it fresh. However, if you're upgrading your project from a previous version, you'll need to [follow the steps for opting-in to webpack 5](#webpack-5).

### React18 new root API

React 18 introduces a [new root API](https://reactjs.org/blog/2022/03/08/react-18-upgrade-guide.html#updates-to-client-rendering-apis). Starting in 6.5, Storybook for React will auto-detect your react version and use the new root API automatically if you're on React18.

If you wish to opt out of the new root API, set the `reactOptions.legacyRootApi` flag in your `.storybook/main.js` config:

```js
module.exports = {
  reactOptions: { legacyRootApi: true },
};
```

### Renamed isToolshown to showToolbar

Storybook's [manager API](docs/addons/addons-api.md) has deprecated the `isToolshown` option (to show/hide the toolbar) and renamed it to `showToolbar` for consistency with other similar UI options.

Example:

```js
// .storybook/manager.js
import { addons } from "@storybook/addons";

addons.setConfig({
  showToolbar: false,
});
```

### Dropped support for addon-actions addDecorators

Prior to SB6.5, `addon-actions` provided an option called `addDecorators`. In SB6.5, decorators are applied always. This is technically a breaking change, so if this affects you please file an issue in Github and we can consider reverting this in a patch release.

### Vite builder renamed

SB6.5 renames Storybook's [Vite builder](https://github.com/storybookjs/builder-vite) from `storybook-builder-vite` to `@storybook/builder-vite`. This move is part of a larger effort to improve Vite support in Storybook.

Storybook's `automigrate` command can migrate for you. To manually migrate:

1. Remove `storybook-builder-vite` from your `package.json` dependencies
2. Install `@storybook/builder-vite`
3. Update your `core.builder` setting in `.storybook/main.js` to `@storybook/builder-vite`.

### Docs framework refactor for React

SB6.5 moves framework specializations (e.g. ArgType inference, dynamic snippet rendering) out of `@storybook/addon-docs` and into the specific framework packages to which they apply (e.g. `@storybook/react`).

This change should not require any specific migrations on your part if you are using the docs addon as described in the documentation. However, if you are using `react-docgen` or `react-docgen-typescript` information in some custom way outside of `addon-docs`, you should be aware of this change.

In SB6.4, `@storybook/react` added `react-docgen` to its babel settings and `react-docgen-typescript` to its Webpack settings. In SB6.5, this only happens if you are using `addon-docs` or `addon-controls`, either directly or indirectly through `addon-essentials`. If you're not using either of those addons, but require that information for some other addon, please configure that manually in your `.storybook/main.js` configuration. You can see the docs configuration here: https://github.com/storybookjs/storybook/blob/next/code/presets/react-webpack/src/framework-preset-react-docs.ts

### Opt-in MDX2 support

SB6.5 adds experimental opt-in support for MDXv2. To install:

```sh
yarn add @storybook/mdx2-csf -D
```

Then add the `previewMdx2` feature flag to your `.storybook/main.js` config:

```js
module.exports = {
  features: {
    previewMdx2: true,
  },
};
```

### CSF3 auto-title improvements

SB 6.4 introduced experimental "auto-title", in which a story's location in the sidebar (aka `title`) can be automatically inferred from its location on disk. For example, the file `atoms/Button.stories.js` might result in the title `Atoms/Button`.

We've made two improvements to Auto-title based on user feedback:

- Auto-title preserves filename case
- Auto-title removes redundant filenames from the path

#### Auto-title filename case

SB 6.4's implementation of auto-title ran `startCase` on each path component. For example, the file `atoms/MyButton` would be transformed to `Atoms/My Button`.

We've changed this in SB 6.5 to preserve the filename case, so that instead it the same file would result in the title `atoms/MyButton`. The rationale is that this gives more control to users about what their auto-title will be.

This might be considered a breaking change. However, we feel justified to release this in 6.5 because:

1. We consider it a bug in the initial auto-title implementation
2. CSF3 and the auto-title feature are experimental, and we reserve the right to make breaking changes outside of semver (tho we try to avoid it)

If you want to restore the old titles in the UI, you can customize your sidebar with the following code snippet in `.storybook/manager.js`:

```js
import { addons } from "@storybook/addons";
import startCase from "lodash/startCase";

addons.setConfig({
  sidebar: {
    renderLabel: ({ name, type }) =>
      type === "story" ? name : startCase(name),
  },
});
```

#### Auto-title redundant filename

The heuristic failed in the common scenario in which each component gets its own directory, e.g. `atoms/Button/Button.stories.js`, which would result in the redundant title `Atoms/Button/Button`. Alternatively, `atoms/Button/index.stories.js` would result in `Atoms/Button/Index`.

To address this problem, 6.5 introduces a new heuristic to removes the filename if it matches the directory name or `index`. So `atoms/Button/Button.stories.js` and `atoms/Button/index.stories.js` would both result in the title `Atoms/Button` (or `atoms/Button` if `autoTitleFilenameCase` is set, see above).

Since CSF3 is experimental, we are introducing this technically breaking change in a minor release. If you desire the old structure, you can manually specify the title in file. For example:

```js
// atoms/Button/Button.stories.js
export default { title: "Atoms/Button/Button" };
```

#### Auto-title always prefixes

When the user provides a `prefix` in their `main.js` `stories` field, it now prefixes all titles to matching stories, whereas in 6.4 and earlier it only prefixed auto-titles.

Consider the following example:

```js
// main.js
module.exports = {
  stories: [{ directory: '../src', titlePrefix: 'Custom' }]
}

// ../src/NoTitle.stories.js
export default { component: Foo };

// ../src/Title.stories.js
export default { component: Bar, title: 'Bar' }
```

In 6.4, the final titles would be:

- `NoTitle.stories.js` => `Custom/NoTitle`
- `Title.stories.js` => `Bar`

In 6.5, the final titles would be:

- `NoTitle.stories.js` => `Custom/NoTitle`
- `Title.stories.js` => `Custom/Bar`

<!-- markdown-link-check-disable -->

### 6.5 Deprecations

#### Deprecated register.js

In ancient versions of Storybook, addons were registered by referring to `addon-name/register.js`. This is going away in SB7.0. Instead you should just add `addon-name` to the `addons` array in `.storybook/main.js`.

Before:

```js
module.exports = { addons: ["my-addon/register.js"] };
```

After:

```js
module.exports = { addons: ["my-addon"] };
```

## From version 6.3.x to 6.4.0

### Automigrate

Automigrate is a new 6.4 feature that provides zero-config upgrades to your dependencies, configurations, and story files.

Each automigration analyzes your project, and if it's is applicable, propose a change alongside relevant documentation. If you accept the changes, the automigration will update your files accordingly.

For example, if you're in a webpack5 project but still use Storybook's default webpack4 builder, the automigration can detect this and propose an upgrade. If you opt-in, it will install the webpack5 builder and update your `main.js` configuration automatically.

You can run the existing suite of automigrations to see which ones apply to your project. This won't update any files unless you accept the changes:

```

npx sb@latest automigrate

```

The automigration suite also runs when you create a new project (`sb init`) or when you update Storybook (`sb upgrade`).

### CRA5 upgrade

Storybook 6.3 supports CRA5 out of the box when you install it fresh. However, if you're upgrading your project from a previous version, you'll need to upgrade the configuration. You can do this automatically by running:

```

npx sb@latest automigrate

```

Or you can do the following steps manually to force Storybook to use Webpack 5 for building your project:

```shell
yarn add @storybook/builder-webpack5 @storybook/manager-webpack5 --dev
# Or
npm install @storybook/builder-webpack5 @storybook/manager-webpack5 --save-dev
```

Then edit your `.storybook/main.js` config:

```js
module.exports = {
  core: {
    builder: "webpack5",
  },
};
```

### CSF3 enabled

SB6.3 introduced a feature flag, `features.previewCsfV3`, to opt-in to experimental [CSF3 syntax support](https://storybook.js.org/blog/component-story-format-3-0/). In SB6.4, CSF3 is supported regardless of `previewCsfV3`'s value. This should be a fully backwards-compatible change. The `previewCsfV3` flag has been deprecated and will be removed in SB7.0.

#### Optional titles

In SB6.3 and earlier, component titles were required in CSF default exports. Starting in 6.4, they are optional.
If you don't specify a component file, it will be inferred from the file's location on disk.

Consider a project configuration `/path/to/project/.storybook/main.js` containing:

```js
module.exports = { stories: ["../src/**/*.stories.*"] };
```

And the file `/path/to/project/src/components/Button.stories.tsx` containing the default export:

```js
import { Button } from "./Button";
export default { component: Button };
// named exports...
```

The inferred title of this file will be `components/Button` based on the stories glob in the configuration file.
We will provide more documentation soon on how to configure this.

#### String literal titles

Starting in 6.4 CSF component [titles are optional](#optional-titles). However, if you do specify titles, title handing is becoming more strict in V7 and is limited to string literals.

Earlier versions of Storybook supported story titles that are dynamic Javascript expressions

```js
// ✅ string literals 6.3 OK / 7.0 OK
export default {
  title: 'Components/Atoms/Button',
};

// ✅ undefined 6.3 OK / 7.0 OK
export default {
  component: Button,
};

// ❌ expressions: 6.3 OK / 7.0 KO
export default {
  title: foo('bar'),
};

// ❌ template literals 6.3 OK / 7.0 KO
export default {
  title: `${bar}`,
};
```

#### StoryObj type

The TypeScript type for CSF3 story objects is `StoryObj`, and this will become the default in Storybook 7.0. In 6.x, the `StoryFn` type is the default, and `Story` is aliased to `StoryFn`.

If you are migrating to experimental CSF3, the following is compatible with 6.4 and requires the least amount of change to your code today:

```ts
// CSF2 function stories, current API, will break in 7.0
import type { Story } from "@storybook/<framework>";

// CSF3 object stories, will persist in 7.0
import type { StoryObj } from "@storybook/<framework>";
```

The following is compatible with 6.4 and also forward-compatible with anticipated 7.0 changes:

```ts
// CSF2 function stories, forward-compatible mode
import type { StoryFn } from "@storybook/<framework>";

// CSF3 object stories, using future 7.0 types
import type { Story } from "@storybook/<framework>/types-7-0";
```

### Story Store v7

SB6.4 introduces an opt-in feature flag, `features.storyStoreV7`, which loads stories in an "on demand" way (that is when rendered), rather than up front when the Storybook is booted. This way of operating will become the default in 7.0 and will likely be switched to opt-out in that version.

The key benefit of the on demand store is that stories are code-split automatically (in `builder-webpack4` and `builder-webpack5`), which allows for much smaller bundle sizes, faster rendering, and improved general performance via various opt-in Webpack features.

The on-demand store relies on the "story index" data structure which is generated in the server (node) via static code analysis. As such, it has the following limitations:

- Does not work with `storiesOf()`
- Does not work if you use dynamic story names or component titles.

However, the `autoTitle` feature is supported.

#### Behavioral differences

The key behavioral differences of the v7 store are:

- `SET_STORIES` is not emitted on boot up. Instead the manager loads the story index independently.
- A new event `STORY_PREPARED` is emitted when a story is rendered for the first time, which contains metadata about the story, such as `parameters`.
- All "entire" store APIs such as `extract()` need to be proceeded by an async call to `loadAllCSFFiles()` which fetches all CSF files and processes them.

#### Main.js framework field

In earlier versions of Storybook, each framework package (e.g. `@storybook/react`) provided its own `start-storybook` and `build-storybook` binaries, which automatically filled in various settings.

In 7.0, we're moving towards a model where the user specifies their framework in `main.js`.

```js
module.exports = {
  // ... your existing config
  framework: "@storybook/react", // OR whatever framework you're using
};
```

Each framework must export a `renderToDOM` function and `parameters.framework`. We'll be adding more documentation for framework authors in a future release.

#### Using the v7 store

To activate the v7 mode set the feature flag in your `.storybook/main.js` config:

```js
module.exports = {
  // ... your existing config
  framework: "@storybook/react", // OR whatever framework you're using
  features: {
    storyStoreV7: true,
  },
};
```

NOTE: `features.storyStoreV7` implies `features.buildStoriesJson` and has the same limitations.

#### v7-style story sort

If you've written a custom `storySort` function, you'll need to rewrite it for V7.

SB6.x supports a global story function specified in `.storybook/preview.js`. It accepts two arrays which each contain:

- The story ID
- A story object that contains the name, title, etc.
- The component's parameters
- The project-level parameters

SB 7.0 streamlines the story function. It now accepts a `StoryIndexEntry` which is
an object that contains only the story's `id`, `title`, `name`, and `importPath`.

Consider the following example, before and after:

```js
// v6-style sort
function storySort(a, b) {
  return a[1].kind === b[1].kind
    ? 0
    : a[1].id.localeCompare(b[1].id, undefined, { numeric: true });
},
```

And the after version using `title` instead of `kind` and not receiving the full parameters:

```js
// v7-style sort
function storySort(a, b) {
  return a.title === b.title
    ? 0
    : a.id.localeCompare(b.id, undefined, { numeric: true });
},
```

**NOTE:** v7-style sorting is statically analyzed by Storybook, which puts a variety of constraints versus v6:

- Sorting must be specified in the user's `.storybook/preview.js`. It cannot be specified by an addon or preset.
- The `preview.js` export should not be generated by a function.
- `storySort` must be a self-contained function that does not reference external variables.

#### v7 default sort behavior

The behavior of the default `storySort` function has also changed in v7 thanks to [#18423](https://github.com/storybookjs/storybook/pull/18243), which gives better control over hierarchical sorting.

In 6.x, the following configuration would sort any story/doc containing the title segment `Introduction` to the top of the sidebar, so this would match `Introduction`, `Example/Introduction`, `Very/Nested/Introduction`, etc.

```js
// preview.js
export default {
  parameters: {
    options: {
      storySort: {
        order: ["Introduction", "*"],
      },
    },
  },
};
```

In 7.0+, the targeting is more precise, so the preceding example would match `Introduction`, but not anything nested. If you wanted to sort `Example/Introduction` first, you'd need to specify that:

```js
storySort: {
  order: ['*', ['Introduction', '*']],
}
```

This would sort `*/Introduction` first, but not `Introduction` or `Very/Nested/Introduction`. If you want to target `Introduction` stories/docs anywhere in the hierarchy, you can do this with a [custom sort function](https://storybook.js.org/docs/react/writing-stories/naming-components-and-hierarchy#sorting-stories).

#### v7 Store API changes for addon authors

The Story Store in v7 mode is async, so synchronous story loading APIs no longer work. In particular:

- `store.fromId()` has been replaced by `store.loadStory()`, which is async (i.e. returns a `Promise` you will need to await).
- `store.raw()/store.extract()` and friends that list all stories require a prior call to `store.cacheAllCSFFiles()` (which is async). This will load all stories, and isn't generally a good idea in an addon, as it will force the whole store to load.

#### Storyshots compatibility in the v7 store

Storyshots is not currently compatible with the v7 store. However, you can use the following workaround to opt-out of the v7 store when running storyshots; in your `main.js`:

```js
module.exports = {
  features: {
    storyStoreV7: !global.navigator?.userAgent?.match?.("jsdom"),
  },
};
```

There are some caveats with the above approach:

- The code path in the v6 store is different to the v7 store and your mileage may vary in identical behavior. Buyer beware.
- The story sort API [changed between the stores](#v7-style-story-sort). If you are using a custom story sort function, you will need to ensure it works in both contexts (perhaps using the check `global.navigator.userAgent.match('jsdom')`).

### Emotion11 quasi-compatibility

Now that the web is moving to Emotion 11 for styling, popular libraries like MUI5 and ChakraUI are breaking with Storybook 6.3 which only supports emotion@10.

Unfortunately we're unable to upgrade Storybook to Emotion 11 without a semver major release, and we're not ready for that. So, as a workaround, we've created a feature flag which opts-out of the previous behavior of pinning the Emotion version to v10. To enable this workaround, add the following to your `.storybook/main.js` config:

```js
module.exports = {
  features: {
    emotionAlias: false,
  },
};
```

Setting this should unlock theming for emotion11-based libraries in Storybook 6.4.

### Babel mode v7

SB6.4 introduces an opt-in feature flag, `features.babelModeV7`, that reworks the way Babel is configured in Storybook to make it more consistent with the Babel is configured in your app. This breaking change will become the default in SB 7.0, but we encourage you to migrate today.

> NOTE: CRA apps using `@storybook/preset-create-react-app` use CRA's handling, so the new flag has no effect on CRA apps.

In SB6.x and earlier, Storybook provided its own default configuration and inconsistently handled configurations from the user's babelrc file. This resulted in a final configuration that differs from your application's configuration AND is difficult to debug.

In `babelModeV7`, Storybook no longer provides its own default configuration and is primarily configured via babelrc file, with small, incremental updates from Storybook addons.

In 6.x, Storybook supported a `.storybook/babelrc` configuration option. This is no longer supported and it's up to you to reconcile this with your project babelrc.

To activate the v7 mode set the feature flag in your `.storybook/main.js` config:

```js
module.exports = {
  // ... your existing config
  features: {
    babelModeV7: true,
  },
};
```

In the new mode, Storybook expects you to provide a configuration file. If you want a configuration file that's equivalent to the 6.x default, you can run the following command in your project directory:

```sh
npx sb@latest babelrc
```

This will create a `.babelrc.json` file. This file includes a bunch of babel plugins, so you may need to add new package devDependencies accordingly.

### Loader behavior with args changes

In 6.4 the behavior of loaders when arg changes occurred was tweaked so loaders do not re-run. Instead the previous value of the loader is passed to the story, irrespective of the new args.

### 6.4 Angular changes

#### SB Angular builder

Since SB6.3, Storybook for Angular supports a builder configuration in your project's `angular.json`. This provides an Angular-style configuration for running and building your Storybook. An example builder configuration is now part of the [get started documentation page](https://storybook.js.org/docs/angular/get-started/install).

If you want to know all the available options, please checks the builders' validation schemas :

- `start-storybook`: [schema](https://github.com/storybookjs/storybook/blob/next/code/frameworks/angular/src/builders/start-storybook/schema.json)
- `build-storybook`: [schema](https://github.com/storybookjs/storybook/blob/next/code/frameworks/angular/src/builders/build-storybook/schema.json)

#### Angular13

Angular 13 introduces breaking changes that require updating your Storybook configuration if you are migrating from a previous version of Angular.

Most notably, the documented way of including global styles is no longer supported by Angular13. Previously you could write the following in your `.storybook/preview.js` config:

```
import '!style-loader!css-loader!sass-loader!./styles.scss';
```

If you use Angular 13 and above, you should use the builder configuration instead:

```json
   "my-default-project": {
      "architect": {
        "build": {
          "builder": "@angular-devkit/build-angular:browser",
          "options": {
            "styles": ["src/styles.css", "src/styles.scss"],
          }
        }
      },
   },
```

If you need storybook-specific styles separate from your app, you can configure the styles in the [SB Angular builder](#sb-angular-builder), which completely overrides your project's styles:

```json
      "storybook": {
        "builder": "@storybook/angular:start-storybook",
        "options": {
          "browserTarget": "my-default-project:build",
          "styles": [".storybook/custom-styles.scss"],
        },
      }
```

Then, once you've set this up, you should run Storybook through the builder:

```sh
ng run my-default-project:storybook
ng run my-default-project:build-storybook
```

#### Angular component parameter removed

In SB6.3 and earlier, the `default.component` metadata was implemented as a parameter, meaning that stories could set `parameters.component` to override the default export. This was an internal implementation that was never documented, but it was mistakenly used in some Angular examples.

If you have Angular stories of the form:

```js
export const MyStory = () => ({ ... })
SomeStory.parameters = { component: MyComponent };
```

You should rewrite them as:

```js
export const MyStory = () => ({ component: MyComponent, ... })
```

[More discussion here.](https://github.com/storybookjs/storybook/pull/16010#issuecomment-917378595)

### 6.4 deprecations

#### Deprecated --static-dir CLI flag

In 6.4 we've replaced the `--static-dir` CLI flag with the `staticDirs` field in `.storybook/main.js`. Note that the CLI directories are relative to the current working directory, whereas the `staticDirs` are relative to the location of `main.js`.

Before:

```sh
start-storybook --static-dir ./public,./static,./foo/assets:/assets
```

After:

```js
// .storybook/main.js
module.exports = {
  staticDirs: [
    "../public",
    "../static",
    { from: "../foo/assets", to: "/assets" },
  ],
};
```

The `--static-dir` flag has been deprecated and will be removed in Storybook 7.0.

## From version 6.2.x to 6.3.0

### Webpack 5

Storybook 6.3 brings opt-in support for building both your project and the manager UI with webpack 5. To do so, there are two ways:

1 - Upgrade command

If you're upgrading your Storybook version, run this command, which will both upgrade your dependencies but also detect whether you should migrate to webpack5 builders and apply the changes automatically:

```shell
npx sb upgrade
```

2 - Automigrate command

If you don't want to change your Storybook version but want Storybook to detect whether you should migrate to webpack5 builders and apply the changes automatically:

```shell
npx sb automigrate
```

3 - Manually

If either methods did not work or you just want to proceed manually, do the following steps:

Install the dependencies:

```shell
yarn add @storybook/builder-webpack5 @storybook/manager-webpack5 --dev
# Or
npm install @storybook/builder-webpack5 @storybook/manager-webpack5 --save-dev
```

Then edit your `.storybook/main.js` config:

```js
module.exports = {
  core: {
    builder: "webpack5",
  },
};
```

> NOTE: If you're using `@storybook/preset-create-react-app` make sure to update it to version 4.0.0 as well.

#### Fixing hoisting issues

##### Webpack 5 manager build

Storybook 6.2 introduced **experimental** webpack5 support for building user components. Storybook 6.3 also supports building the manager UI in webpack 5 to avoid strange hoisting issues.

If you're upgrading from 6.2 and already using the experimental webpack5 feature, this might be a breaking change (hence the 'experimental' label) and you should try adding the manager builder:

```shell
yarn add @storybook/manager-webpack5 --dev
# Or
npm install @storybook/manager-webpack5 --save-dev
```

##### Wrong webpack version

Because Storybook uses `webpack@4` as the default, it's possible for the wrong version of webpack to get hoisted by your package manager. If you receive an error that looks like you might be using the wrong version of webpack, install `webpack@5` explicitly as a dev dependency to force it to be hoisted:

```shell
yarn add webpack@5 --dev
# Or
npm install webpack@5 --save-dev
```

Alternatively or additionally you might need to add a resolution to your package.json to ensure that a consistent webpack version is provided across all of storybook packages. Replacing the {app} with the app (react, vue, etc.) that you're using:

```js
// package.json
...
resolutions: {
  "@storybook/{app}/webpack": "^5"
}
...
```

### Angular 12 upgrade

Storybook 6.3 supports Angular 12 out of the box when you install it fresh. However, if you're upgrading your project from a previous version, you'll need to [follow the steps for opting-in to webpack 5](#webpack-5).

### Lit support

Storybook 6.3 introduces Lit 2 support in a non-breaking way to ease migration from `lit-html`/`lit-element` to `lit`.

To do so, it relies on helpers added in the latest minor versions of `lit-html`/`lit-element`. So when upgrading to Storybook 6.3, please ensure your project is using `lit-html` 1.4.x or `lit-element` 2.5.x.

According to the package manager you are using, it can be handled automatically when updating Storybook or can require to manually update the versions and regenerate the lockfile.

### No longer inferring default values of args

Previously, unset `args` were set to the `argType.defaultValue` if set or inferred from the component's prop types (etc.). In 6.3 we no longer infer default values and instead set arg values to `undefined` when unset, allowing the framework to supply the default value.

If you were using `argType.defaultValue` to fix issues with the above inference, it should no longer be necessary, you can remove that code.

If you were using `argType.defaultValue` or relying on inference to set a default value for an arg, you should now set a value for the arg at the component level:

```js
export default {
  component: MyComponent,
  args: {
    argName: "default-value",
  },
};
```

To manually configure the value that is shown in the ArgsTable doc block, you can configure the `table.defaultValue` setting:

```js
export default {
  component: MyComponent,
  argTypes: {
    argName: {
      table: { defaultValue: { summary: "SomeType<T>" } },
    },
  },
};
```

### 6.3 deprecations

#### Deprecated addon-knobs

We are replacing `@storybook/addon-knobs` with `@storybook/addon-controls`.

- [Rationale & discussion](https://github.com/storybookjs/storybook/discussions/15060)
- [Migration notes](https://github.com/storybookjs/storybook/blob/next/code/addons/controls/README.md#how-do-i-migrate-from-addon-knobs)

#### Deprecated scoped blocks imports

In 6.3, we changed doc block imports from `@storybook/addon-docs/blocks` to `@storybook/addon-docs`. This makes it possible for bundlers to automatically choose the ESM or CJS version of the library depending on the context.

To update your code, you should be able to global replace `@storybook/addon-docs/blocks` with `@storybook/addon-docs`. Example:

```js
// before
import { Meta, Story } from "@storybook/addon-docs/blocks";

// after
import { Meta, Story } from "@storybook/addon-docs";
```

#### Deprecated layout URL params

Several URL params to control the manager layout have been deprecated and will be removed in 7.0:

- `addons=0`: use `panel=false` instead
- `panelRight=1`: use `panel=right` instead
- `stories=0`: use `nav=false` instead

Additionally, support for legacy URLs using `selectedKind` and `selectedStory` will be removed in 7.0. Use `path` instead.

## From version 6.1.x to 6.2.0

### MDX pattern tweaked

In 6.2 files ending in `stories.mdx` or `story.mdx` are now processed with Storybook's MDX compiler. Previously it only applied to files ending in `.stories.mdx` or `.story.mdx`. See more here: [#13996](https://github.com/storybookjs/storybook/pull/13996).

### 6.2 Angular overhaul

#### New Angular storyshots format

We've updated the Angular storyshots format in 6.2, which is technically a breaking change. Apologies to semver purists: if you're using storyshots, you'll need to [update your snapshots](https://jestjs.io/docs/en/snapshot-testing#updating-snapshots).

The new format hides the implementation details of `@storybook/angular` so that we can evolve its renderer without breaking your snapshots in the future.

#### Deprecated Angular story component

Storybook 6.2 for Angular uses `parameters.component` as the preferred way to specify your stories' components. The previous method, in which the component was a return value of the story, has been deprecated.

Consider the existing story from 6.1 or earlier:

```ts
export default { title: "Button" };
export const Basic = () => ({
  component: Button,
  props: { label: "Label" },
});
```

From 6.2 this should be rewritten as:

```ts
export default { title: "Button", component: Button };
export const Basic = () => ({
  props: { label: "Label" },
});
```

The new convention is consistent with how other frameworks and addons work in Storybook. The old way will be supported until 7.0. For a full discussion see <https://github.com/storybookjs/storybook/issues/8673>.

#### New Angular renderer

We've rewritten the Angular renderer in Storybook 6.2. It's meant to be entirely backwards compatible, but if you need to use the legacy renderer it's still available via a [parameter](https://storybook.js.org/docs/angular/writing-stories/parameters). To opt out of the new renderer, add the following to `.storybook/preview.ts`:

```ts
export const parameters = {
  angularLegacyRendering: true,
};
```

Please also file an issue if you need to opt out. We plan to remove the legacy renderer in 7.0.

#### Components without selectors

When the new Angular renderer is used, all Angular Story components must either have a selector, or be added to the `entryComponents` array of the story's `moduleMetadata`. If the component has any `Input`s or `Output`s to be controlled with `args`, a selector should be added.

### Packages now available as ESModules

Many Storybook packages are now available as ESModules in addition to CommonJS. If your jest tests stop working, this is likely why. One common culprit is doc blocks, which [is fixed in 6.3](#deprecated-scoped-blocks-imports). In 6.2, you can configure jest to transform the packages like so ([more info](https://jestjs.io/docs/configuration#transformignorepatterns-arraystring)):

```json
// In your jest config
transformIgnorePatterns: ['/node_modules/(?!@storybook)']
```

### 6.2 Deprecations

#### Deprecated implicit PostCSS loader

Previously, `@storybook/core` would automatically add the `postcss-loader` to your preview. This caused issues for consumers when PostCSS upgraded to v8 and tools, like Autoprefixer and Tailwind, starting requiring the new version. Implicitly adding `postcss-loader` will be removed in Storybook 7.0.

Instead of continuing to include PostCSS inside the core library, it has been moved to [`@storybook/addon-postcss`](https://github.com/storybookjs/addon-postcss). This addon provides more fine-grained customization and will be upgraded more flexibly to track PostCSS upgrades.

If you require PostCSS support, please install `@storybook/addon-postcss` in your project, add it to your list of addons inside `.storybook/main.js`, and configure a `postcss.config.js` file.

Further information is available at <https://github.com/storybookjs/storybook/issues/12668> and <https://github.com/storybookjs/storybook/pull/13669>.

If you're not using Postcss and you don't want to see the warning, you can disable it by adding the following to your `.storybook/main.js`:

```js
module.exports = {
  features: {
    postcss: false,
  },
};
```

#### Deprecated default PostCSS plugins

When relying on the [implicit PostCSS loader](#deprecated-implicit-postcss-loader), it would also add [autoprefixer v9](https://www.npmjs.com/package/autoprefixer/v/9.8.6) and [postcss-flexbugs-fixes v4](https://www.npmjs.com/package/postcss-flexbugs-fixes/v/4.2.1) plugins to the `postcss-loader` configuration when you didn't have a PostCSS config file (such as `postcss.config.js`) within your project.

They will no longer be applied when switching to `@storybook/addon-postcss` and the implicit PostCSS features will be removed in Storybook 7.0.

If you depend upon these plugins being applied, install them and create a `postcss.config.js` file within your project that contains:

```js
module.exports = {
  plugins: [
    require("postcss-flexbugs-fixes"),
    require("autoprefixer")({
      flexbox: "no-2009",
    }),
  ],
};
```

#### Deprecated showRoots config option

Config options for the sidebar are now under the `sidebar` namespace. The `showRoots` option should be set as follows:

```js
addons.setConfig({
  sidebar: {
    showRoots: false,
  },
  // showRoots: false   <- this is deprecated
});
```

The top-level `showRoots` option will be removed in Storybook 7.0.

#### Deprecated control.options

Possible `options` for a radio/check/select controls has been moved up to the argType level, and no longer accepts an object. Instead, you should specify `options` as an array. You can use `control.labels` to customize labels. Additionally, you can use a `mapping` to deal with complex values.

```js
argTypes: {
  answer:
    options: ['yes', 'no'],
    mapping: {
      yes: <Check />,
      no: <Cross />,
    },
    control: {
      type: 'radio',
      labels: {
        yes: 'да',
        no: 'нет',
      }
    }
  }
}
```

Keys in `control.labels` as well as in `mapping` should match the values in `options`. Neither object has to be exhaustive, in case of a missing property, the option value will be used directly.

If you are currently using an object as value for `control.options`, be aware that the key and value are reversed in `control.labels`.

#### Deprecated storybook components html entry point

Storybook HTML components are now exported directly from '@storybook/components' for better ESM and Typescript compatibility. The old entry point will be removed in SB 7.0.

```js
// before
import { components } from "@storybook/components/html";

// after
import { components } from "@storybook/components";
```

## From version 6.0.x to 6.1.0

### Addon-backgrounds preset

In 6.1 we introduced an unintentional breaking change to `addon-backgrounds`.

The addon uses decorators which are set up automatically by a preset. The required preset is ignored if you register the addon in `main.js` with the `/register` entry point. This used to be valid in `v6.0.x` and earlier:

```js
module.exports = {
  stories: ["../**/*.stories.js"],
  addons: ["@storybook/addon-backgrounds/register"],
};
```

To fix it, just replace `@storybook/addon-backgrounds/register` with `@storybook/addon-backgrounds`:

```js
module.exports = {
  stories: ["../**/*.stories.js"],
  addons: ["@storybook/addon-backgrounds"],
};
```

### Single story hoisting

Stories which have **no siblings** (i.e. the component has only one story) and which name **exactly matches** the component name will now be hoisted up to replace their parent component in the sidebar. This means you can have a hierarchy like this:

```
DESIGN SYSTEM   [root]
- Atoms         [group]
  - Button      [component]
    - Button    [story]
  - Checkbox    [component]
    - Checkbox  [story]
```

This will then be visually presented in the sidebar like this:

```
DESIGN SYSTEM   [root]
- Atoms         [group]
  - Button      [story]
  - Checkbox    [story]
```

See [Naming components and hierarchy](https://storybook.js.org/docs/react/writing-stories/naming-components-and-hierarchy#single-story-hoisting) for details.

### React peer dependencies

Starting in 6.1, `react` and `react-dom` are required peer dependencies of `@storybook/react`, meaning that if your React project does not have dependencies on them, you need to add them as `devDependencies`. If you don't you'll see errors like this:

```
Error: Cannot find module 'react-dom/package.json'
```

They were also peer dependencies in earlier versions, but due to the package structure they would be installed by Storybook if they were not required by the user's project. For more discussion: <https://github.com/storybookjs/storybook/issues/13269>

### 6.1 deprecations

#### Deprecated DLL flags

Earlier versions of Storybook used Webpack DLLs as a performance crutch. In 6.1, we've removed Storybook's built-in DLLs and have deprecated the command-line parameters `--no-dll` and `--ui-dll`. They will be removed in 7.0.

#### Deprecated storyFn

Each item in the story store contains a field called `storyFn`, which is a fully decorated story that's applied to the denormalized story parameters. Starting in 6.0 we've stopped using this API internally, and have replaced it with a new field called `unboundStoryFn` which, unlike `storyFn`, must passed a story context, typically produced by `applyLoaders`;

Before:

```js
const { storyFn } = store.fromId("some--id");
console.log(storyFn());
```

After:

```js
const { unboundStoryFn, applyLoaders } = store.fromId("some--id");
const context = await applyLoaders();
console.log(unboundStoryFn(context));
```

If you're not using loaders, `storyFn` will work as before. If you are, you'll need to use the new approach.

> NOTE: If you're using `@storybook/addon-docs`, this deprecation warning is triggered by the Docs tab in 6.1. It's safe to ignore and we will be providing a proper fix in a future release. You can track the issue at <https://github.com/storybookjs/storybook/issues/13074>.

#### Deprecated onBeforeRender

The `@storybook/addon-docs` previously accepted a `jsx` option called `onBeforeRender`, which was unfortunately named as it was called after the render.

We've renamed it `transformSource` and also allowed it to receive the `StoryContext` in case source rendering requires additional information.

#### Deprecated grid parameter

Previously when using `@storybook/addon-backgrounds` if you wanted to customize the grid, you would define a parameter like this:

```js
export const Basic = () => <Button />
Basic.parameters: {
  grid: {
    cellSize: 10
  }
},
```

As grid is not an addon, but rather backgrounds is, the grid configuration was moved to be inside `backgrounds` parameter instead. Also, there are new properties that can be used to further customize the grid. Here's an example with the default values:

```js
export const Basic = () => <Button />
Basic.parameters: {
  backgrounds: {
    grid: {
      disable: false,
      cellSize: 20,
      opacity: 0.5,
      cellAmount: 5,
      offsetX: 16, // default is 0 if story has 'fullscreen' layout, 16 if layout is 'padded'
      offsetY: 16, // default is 0 if story has 'fullscreen' layout, 16 if layout is 'padded'
    }
  }
},
```

#### Deprecated package-composition disabled parameter

Like [Deprecated disabled parameter](#deprecated-disabled-parameter). The `disabled` parameter has been deprecated, please use `disable` instead.

For more information, see the [the related documentation](https://storybook.js.org/docs/react/workflows/package-composition#configuring).

## From version 5.3.x to 6.0.x

### Hoisted CSF annotations

Storybook 6 introduces hoisted CSF annotations and deprecates the `StoryFn.story` object-style annotation.

In 5.x CSF, you would annotate a story like this:

```js
export const Basic = () => <Button />
Basic.story = {
  name: 'foo',
  parameters: { ... },
  decorators: [ ... ],
};
```

In 6.0 CSF this becomes:

```js
export const Basic = () => <Button />
Basic.storyName = 'foo';
Basic.parameters = { ... };
Basic.decorators = [ ... ];
```

1. The new syntax is slightly more compact/ergonomic compared the old one
2. Similar to React's `displayName`, `propTypes`, `defaultProps` annotations
3. We're introducing a new feature, [Storybook Args](https://docs.google.com/document/d/1Mhp1UFRCKCsN8pjlfPdz8ZdisgjNXeMXpXvGoALjxYM/edit?usp=sharing), where the new syntax will be significantly more ergonomic

To help you upgrade your stories, we've created a codemod:

```
npx @storybook/cli@latest migrate csf-hoist-story-annotations --glob="**/*.stories.js"
```

For more information, [see the documentation](https://github.com/storybookjs/storybook/blob/next/code/lib/codemod/README.md#csf-hoist-story-annotations).

### Zero config typescript

Storybook has built-in Typescript support in 6.0. That means you should remove your complex Typescript configurations from your `.storybook` config. We've tried to pick sensible defaults that work out of the box, especially for nice prop table generation in `@storybook/addon-docs`.

To migrate from an old setup, we recommend deleting any typescript-specific webpack/babel configurations in your project. You should also remove `@storybook/preset-typescript`, which is superseded by the built-in configuration.

If you want to override the defaults, see the [typescript configuration docs](https://storybook.js.org/docs/react/configure/typescript).

### Correct globs in main.js

In 5.3 we introduced the `main.js` file with a `stories` property. This property was documented as a "glob" pattern. This was our intention, however the implementation allowed for non valid globs to be specified and work. In fact, we promoted invalid globs in our documentation and CLI templates.

We've corrected this, the CLI templates have been changed to use valid globs.

We've also changed the code that resolves these globs, so that invalid globs will log a warning. They will break in the future, so if you see this warning, please ensure you're specifying a valid glob.

Example of an **invalid** glob:

```
stories: ['./**/*.stories.(ts|js)']
```

Example of a **valid** glob:

```
stories: ['./**/*.stories.@(ts|js)']
```

### CRA preset removed

The built-in create-react-app preset, which was [previously deprecated](#create-react-app-preset), has been fully removed.

If you're using CRA and migrating from an earlier Storybook version, please install [`@storybook/preset-create-react-app`](https://github.com/storybookjs/presets/tree/master/packages/preset-create-react-app) if you haven't already.

### Core-JS dependency errors

Some users have experienced `core-js` dependency errors when upgrading to 6.0, such as:

```
Module not found: Error: Can't resolve 'core-js/modules/web.dom-collections.iterator'
```

We think this comes from having multiple versions of `core-js` installed, but haven't isolated a good solution (see [#11255](https://github.com/storybookjs/storybook/issues/11255) for discussion).

For now, the workaround is to install `core-js` directly in your project as a dev dependency:

```sh
npm install core-js@^3.0.1 --save-dev
```

### Args passed as first argument to story

Starting in 6.0, the first argument to a story function is an [Args object](https://storybook.js.org/docs/react/api/csf#args-story-inputs). In 5.3 and earlier, the first argument was a [StoryContext](https://github.com/storybookjs/storybook/blob/release/5.3/lib/addons/src/types.ts#L24-L31), and that context is now passed as the second argument by default.

This breaking change only affects you if your stories actually use the context, which is not common. If you have any stories that use the context, you can either (1) update your stories, or (2) set a flag to opt-out of new behavior.

Consider the following story that uses the context:

```js
export const Dummy = ({ parameters }) => (
  <div>{JSON.stringify(parameters)}</div>
);
```

Here's an updated story for 6.0 that ignores the args object:

```js
export const Dummy = (_args, { parameters }) => (
  <div>{JSON.stringify(parameters)}</div>
);
```

Alternatively, if you want to opt out of the new behavior, you can add the following to your `.storybook/preview.js` config:

```js
export const parameters = {
  passArgsFirst: false,
};
```

### 6.0 Docs breaking changes

#### Remove framework-specific docs presets

In SB 5.2, each framework had its own preset, e.g. `@storybook/addon-docs/react/preset`. In 5.3 we [unified this into a single preset](#unified-docs-preset): `@storybook/addon-docs/preset`. In 6.0 we've removed the deprecated preset.

#### Preview/Props renamed

In 6.0 we renamed `Preview` to `Canvas`, `Props` to `ArgsTable`. The change should be otherwise backwards-compatible.

#### Docs theme separated

In 6.0, you should theme Storybook Docs with the `docs.theme` parameter.

In 5.x, the Storybook UI and Storybook Docs were themed using the same theme object. However, in 5.3 we introduced a new API, `addons.setConfig`, which improved UI theming but broke Docs theming. Rather than trying to keep the two unified, we introduced a separate theming mechanism for docs, `docs.theme`. [Read about Docs theming here](https://github.com/storybookjs/storybook/blob/next/addons/docs/docs/theming.md#storybook-theming).

#### DocsPage slots removed

In SB5.2, we introduced the concept of [DocsPage slots](https://github.com/storybookjs/storybook/blob/0de8575eab73bfd5c5c7ba5fe33e53a49b92db3a/addons/docs/docs/docspage.md#docspage-slots) for customizing the DocsPage.

In 5.3, we introduced `docs.x` story parameters like `docs.prepareForInline` which get filled in by frameworks and can also be overwritten by users, which is a more natural/convenient way to make global customizations.

We also introduced [Custom DocsPage](https://github.com/storybookjs/storybook/blob/next/addons/docs/docs/docspage.md#replacing-docspage), which makes it possible to add/remove/update DocBlocks on the page.

These mechanisms are superior to slots, so we've removed slots in 6.0. For each slot, we provide a migration path here:

| Slot        | Slot function     | Replacement                                  |
| ----------- | ----------------- | -------------------------------------------- |
| Title       | `titleSlot`       | Custom DocsPage                              |
| Subtitle    | `subtitleSlot`    | Custom DocsPage                              |
| Description | `descriptionSlot` | `docs.extractComponentDescription` parameter |
| Primary     | `primarySlot`     | Custom DocsPage                              |
| Props       | `propsSlot`       | `docs.extractProps` parameter                |
| Stories     | `storiesSlot`     | Custom DocsPage                              |

#### React prop tables with Typescript

Props handling in React has changed in 6.0 and should be much less error-prone. This is not a breaking change per se, but documenting the change here since this is an area that has a lot of issues and we've gone back and forth on it.

Starting in 6.0, we have [zero-config typescript support](#zero-config-typescript). The out-of-box experience should be much better now, since the default configuration is designed to work well with `addon-docs`.

There are also two typescript handling options that can be set in `.storybook/main.js`. `react-docgen-typescript` (default) and `react-docgen`. This is [discussed in detail in the docs](https://github.com/storybookjs/storybook/blob/next/addons/docs/react/README.md#typescript-props-with-react-docgen).

#### ConfigureJSX true by default in React

In SB 6.0, the Storybook Docs preset option `configureJSX` is now set to `true` for all React projects. It was previously `false` by default for React only in 5.x). This `configureJSX` option adds `@babel/plugin-transform-react-jsx`, to process the output of the MDX compiler, which should be a safe change for all projects.

If you need to restore the old JSX handling behavior, you can configure `.storybook/main.js`:

```js
module.exports = {
  addons: [
    {
      name: "@storybook/addon-docs",
      options: { configureJSX: false },
    },
  ],
};
```

#### User babelrc disabled by default in MDX

In SB 6.0, the Storybook Docs no longer applies the user's babelrc by default when processing MDX files. It caused lots of hard-to-diagnose bugs.

To restore the old behavior, or pass any MDX-specific babel options, you can configure `.storybook/main.js`:

```js
module.exports = {
  addons: [
    {
      name: "@storybook/addon-docs",
      options: { mdxBabelOptions: { babelrc: true, configFile: true } },
    },
  ],
};
```

#### Docs description parameter

In 6.0, you can customize a component description using the `docs.description.component` parameter, and a story description using `docs.description.story` parameter.

Example:

```js
import { Button } from './Button';

export default {
  title: 'Button'
  parameters: { docs: { description: { component: 'some component **markdown**' }}}
}

export const Basic = () => <Button />
Basic.parameters = { docs: { description: { story: 'some story **markdown**' }}}
```

In 5.3 you customized a story description with the `docs.storyDescription` parameter. This has been deprecated, and support will be removed in 7.0.

#### 6.0 Inline stories

The following frameworks now render stories inline on the Docs tab by default, rather than in an iframe: `react`, `vue`, `web-components`, `html`.

To disable inline rendering, set the `docs.stories.inline` parameter to `false`.

### New addon presets

In Storybook 5.3 we introduced a declarative [main.js configuration](#to-mainjs-configuration), which is now the recommended way to configure Storybook. Part of the change is a simplified syntax for registering addons, which in 6.0 automatically registers many addons _using a preset_, which is a slightly different behavior than in earlier versions.

This breaking change currently applies to: `addon-a11y`, `addon-actions`, `addon-knobs`, `addon-links`, `addon-queryparams`.

Consider the following `main.js` config for `addon-knobs`:

```js
module.exports = {
  stories: ["../**/*.stories.js"],
  addons: ["@storybook/addon-knobs"],
};
```

In earlier versions of Storybook, this would automatically call `@storybook/addon-knobs/register`, which adds the knobs panel to the Storybook UI. As a user you would also add a decorator:

```js
import { withKnobs } from "../index";

addDecorator(withKnobs);
```

Now in 6.0, `addon-knobs` comes with a preset, `@storybook/addon-knobs/preset`, that does this automatically for you. This change simplifies configuration, since now you don't need to add that decorator.

If you wish to disable this new behavior, you can modify your `main.js` to force it to use the `register` logic rather than the `preset`:

```js
module.exports = {
  stories: ["../**/*.stories.js"],
  addons: ["@storybook/addon-knobs/register"],
};
```

If you wish to selectively disable `knobs` checks for a subset of stories, you can control this with story parameters:

```js
export const MyNonCheckedStory = () => <SomeComponent />;
MyNonCheckedStory.story = {
  parameters: {
    knobs: { disable: true },
  },
};
```

### Removed babel-preset-vue from Vue preset

`babel-preset-vue` is not included by default anymore when using Storybook with Vue.
This preset is outdated and [caused problems](https://github.com/storybookjs/storybook/issues/4475) with more modern setups.

If you have an older Vue setup that relied on this preset, make sure it is included in your babel config
(install `babel-preset-vue` and add it to the presets).

```json
{
  "presets": ["babel-preset-vue"]
}
```

However, please take a moment to review why this preset is necessary in your setup.
One usecase used to be to enable JSX in your stories. For this case, we recommend to use `@vue/babel-preset-jsx` instead.

### Removed Deprecated APIs

In 6.0 we removed a number of APIs that were previously deprecated.

See the migration guides for further details:

- [Addon a11y uses parameters, decorator renamed](#addon-a11y-uses-parameters-decorator-renamed)
- [Addon backgrounds uses parameters](#addon-backgrounds-uses-parameters)
- [Source-loader](#source-loader)
- [Unified docs preset](#unified-docs-preset)
- [Addon centered decorator deprecated](#addon-centered-decorator-deprecated)

### New setStories event

The `setStories`/`SET_STORIES` event has changed and now denormalizes global and kind-level parameters. The new format of the event data is:

```js
{
  globalParameters: { p: 'q' },
  kindParameters: { kind: { p: 'q' } },
  stories: /* as before but with only story-level parameters */
}
```

If you want the full denormalized parameters for a story, you can do something like:

```js
import { combineParameters } from "@storybook/api";

const story = data.stories[storyId];
const parameters = combineParameters(
  data.globalParameters,
  data.kindParameters[story.kind],
  story.parameters
);
```

### Removed renderCurrentStory event

The story store no longer emits `renderCurrentStory`/`RENDER_CURRENT_STORY` to tell the renderer to render the story. Instead it emits a new declarative `CURRENT_STORY_WAS_SET` (in response to the existing `SET_CURRENT_STORY`) which is used to decide to render.

### Removed hierarchy separators

We've removed the ability to specify the hierarchy separators (how you control the grouping of story kinds in the sidebar). From Storybook 6.0 we have a single separator `/`, which cannot be configured.

If you are currently using custom separators, we encourage you to migrate to using `/` as the sole separator. If you are using `|` or `.` as a separator currently, we provide a codemod, [`upgrade-hierarchy-separators`](https://github.com/storybookjs/storybook/blob/next/code/lib/codemod/README.md#upgrade-hierarchy-separators), that can be used to rename your components. **Note: the codemod will not work for `.mdx` components, you will need to make the changes by hand.**

```
npx sb@latest migrate upgrade-hierarchy-separators --glob="*/**/*.stories.@(tsx|jsx|ts|js)"
```

We also now default to showing "roots", which are non-expandable groupings in the sidebar for the top-level groups. If you'd like to disable this, set the `showRoots` option in `.storybook/manager.js`:

```js
import { addons } from "@storybook/addons";

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
      source: "custom source",
    },
  },
};
```

The MDX analog:

```jsx
<Story name="Example" parameters={{ storySource: { source: "custom source" } }}>
  <Button />
</Story>
```

### 6.0 Addon API changes

#### Consistent local addon paths in main.js

If you use `.storybook/main.js` config and have locally-defined addons in your project, you need to update your file paths.

In 5.3, `addons` paths were relative to the project root, which was inconsistent with `stories` paths, which were relative to the `.storybook` folder. In 6.0, addon paths are now relative to the config folder.

So, for example, if you had:

```js
module.exports = { addons: ["./.storybook/my-local-addon/register"] };
```

You'd need to update this to:

```js
module.exports = { addons: ["./my-local-addon/register"] };
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
    element: "#storybook-root",
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
  title: "Button",
  parameters: {
    backgrounds: [
      { name: "twitter", value: "#00aced", default: true },
      { name: "facebook", value: "#3b5998" },
    ],
  },
};
```

Here's an updated version of the example, using the new api:

```jsx
// Button.stories.js
export default {
  title: "Button",
  parameters: {
    backgrounds: {
      default: "twitter",
      values: [
        { name: "twitter", value: "#00aced" },
        { name: "facebook", value: "#3b5998" },
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
  parameters: { layout: "centered" },
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
import { addons } from "@storybook/addons";

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
  stories: ["../src/**/*.stories.js"],
};
```

You can also pass an array of single file names if you want to be careful about loading files:

```js
// in .storybook/main.js
module.exports = {
  stories: [
    "../src/components/Button.stories.js",
    "../src/components/Table.stories.js",
    "../src/components/Page.stories.js",
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
  stories: ["../**/*.stories.js"],
  addons: ["@storybook/addon-knobs"],
};
```

You remove all "register" import from `addons.js` and place them inside the array. You can also safely remove the `/register` suffix from these entries, for a cleaner, more readable configuration. If this means `addons.js` is now empty for you, it's safe to remove.

Next you remove the code that imports/requires all your stories from `config.js`, and change it to a glob-pattern and place that glob in the `stories` array. If this means `config.js` is empty, it's safe to remove.

If you had a `presets.js` file before you can add the array of presets to the main.js file and remove `presets.js` like so:

```js
module.exports = {
  stories: ["../**/*.stories.js"],
  addons: [
    "@storybook/preset-create-react-app",
    {
      name: "@storybook/addon-docs",
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
import { addons } from "@storybook/addons";
import { create } from "@storybook/theming/create";

const theme = create({
  base: "light",
  brandTitle: "My custom title",
});

addons.setConfig({
  panelPosition: "bottom",
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
import { INITIAL_VIEWPORTS } from "@storybook/addon-viewport";

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
      a[1].kind === b[1].kind
        ? 0
        : a[1].id.localeCompare(b[1].id, undefined, { numeric: true }),
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
      "core-js/es7/reflect": [
        "node_modules/core-js/proposals/reflect-metadata"
      ],
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
var context = require.context("../stories", true, /\.stories\.js$/);
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
    name: "Storybook",
    url: "https://storybook.js.org",
    goFullScreen: false,
    addonPanelInRight: true,
  })
);
```

And here's its new counterpart:

```js
import { create } from "@storybook/theming/create";
addParameters({
  options: {
    theme: create({
      base: "light",
      brandTitle: "Storybook",
      brandUrl: "https://storybook.js.org",
      // To control appearance:
      // brandImage: 'http://url.of/some.svg',
    }),
    isFullscreen: false,
    panelPosition: "right",
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
storiesOf("Stories", module)
  .add("noncentered", () => "Hello")
  .addDecorator(centered)
  .add("centered", () => "Hello");
```

The semantics has changed in SB5 so that calling `addDecorator` on a kind adds a decorator to all its stories, no matter the order. So in the previous example, both stories would be centered.

To allow for a subset of the stories in a kind to be decorated, we've added the ability to add decorators to individual stories using parameters:

```js
storiesOf("Stories", module)
  .add("noncentered", () => "Hello")
  .add("centered", () => "Hello", { decorators: [centered] });
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
storiesOf("Stories", module).addParameters({ backgrounds: options });
```

You can pass `backgrounds` parameters at the global level (via `addParameters` imported from `@storybook/react` et al.), and the story level (via the third argument to `.add()`).

### Addon cssresources name attribute renamed

In the options object for `@storybook/addon-cssresources`, the `name` attribute for each resource has been renamed to `id`. If you previously had:

```js
import { withCssResources } from "@storybook/addon-cssresources";
import { addDecorator } from "@storybook/react";

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
import { withCssResources } from "@storybook/addon-cssresources";
import { addDecorator } from "@storybook/react";

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
import { addParameters } from "@storybook/react"; // or others

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
import { addParameters } from "@storybook/react"; // or others

addParameters({ a11y: options });
```

You can also pass `a11y` parameters at the component level (via `storiesOf(...).addParameters`), and the story level (via the third argument to `.add()`).

Furthermore, the decorator `checkA11y` has been deprecated and renamed to `withA11y` to make it consistent with other Storybook decorators.

See the [a11y addon README](https://github.com/storybookjs/storybook/blob/master/addons/a11y/README.md) for more information.

### Addon centered decorator deprecated

If you previously had:

```js
import centered from "@storybook/addon-centered";
```

You should replace it with the React or Vue version as appropriate

```js
import centered from "@storybook/addon-centered/react";
```

or

```js
import centered from "@storybook/addon-centered/vue";
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
import { number } from "@storybook/addon-knobs/react";
```

Becomes:

```js
import { number } from "@storybook/addon-knobs";
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
import { withKnobs, text, boolean, number } from "@storybook/addon-knobs/react";
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
storiesOf("composition", module).add(
  "new addons api",
  withInfo("see Notes panel for composition info")(
    withNotes({ text: "Composition: Info(Notes())" })((context) => (
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
  import "@storybook/addon-actions/register";
  import "@storybook/addon-links/register";
  ```

  change `x.story.js` like so:

  ```js
  import React from "react";
  import { storiesOf } from "@storybook/react";
  import { action } from "@storybook/addon-actions";
  import { linkTo } from "@storybook/addon-links";
  ```

  <!-- markdown-link-check-enable -->
