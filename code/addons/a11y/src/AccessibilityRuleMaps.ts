export type AxeRuleMap = {
  // The rule id from axe-core
  [axeId: string]: {
    // The simple name of the rule
    title: string;
    // The summary of the rule from axe-core
    axeSummary: string;
    // The UX-friendly summary of the rule
    friendlySummary: string;
  };
};

// Rules that align with WCAG 2.0 A/AA success criteria.
const axeRuleMapping_wcag_2_0_a_aa: AxeRuleMap = {
  'area-alt': {
    title: '<area> alt text',
    axeSummary: 'Ensure <area> elements of image maps have alternative text',
    friendlySummary: 'Add alt text to all <area> elements of image maps.',
  },
  'aria-allowed-attr': {
    title: 'Supported ARIA attributes',
    axeSummary: "Ensure an element's role supports its ARIA attributes",
    friendlySummary: "Only use ARIA attributes that are permitted for the element's role.",
  },
  'aria-braille-equivalent': {
    title: 'Braille equivalent',
    axeSummary:
      'Ensure aria-braillelabel and aria-brailleroledescription have a non-braille equivalent',
    friendlySummary: 'If you use braille ARIA labels, also provide a matching non-braille label.',
  },
  'aria-command-name': {
    title: 'ARIA command name',
    axeSummary: 'Ensure every ARIA button, link and menuitem has an accessible name',
    friendlySummary: 'Every ARIA button, link, or menuitem needs a label or accessible name.',
  },
  'aria-conditional-attr': {
    title: 'ARIA attribute valid for role',
    axeSummary:
      "Ensure ARIA attributes are used as described in the specification of the element's role",
    friendlySummary: "Follow the element role's specification when using ARIA attributes.",
  },
  'aria-deprecated-role': {
    title: 'Deprecated ARIA role',
    axeSummary: 'Ensure elements do not use deprecated roles',
    friendlySummary: "Don't use deprecated ARIA roles on elements.",
  },
  'aria-hidden-body': {
    title: 'Hidden body',
    axeSummary: 'Ensure aria-hidden="true" is not present on the document <body>',
    friendlySummary: 'Never set aria-hidden="true" on the <body> element.',
  },
  'aria-hidden-focus': {
    title: 'Hidden element focus',
    axeSummary: 'Ensure aria-hidden elements are not focusable nor contain focusable elements',
    friendlySummary:
      'Elements marked hidden (aria-hidden) should not be focusable or contain focusable items.',
  },
  'aria-input-field-name': {
    title: 'ARIA input field name',
    axeSummary: 'Ensure every ARIA input field has an accessible name',
    friendlySummary: 'Give each ARIA text input or field a label or accessible name.',
  },
  'aria-meter-name': {
    title: 'ARIA meter name',
    axeSummary: 'Ensure every ARIA meter node has an accessible name',
    friendlySummary: 'Give each element with role="meter" a label or accessible name.',
  },
  'aria-progressbar-name': {
    title: 'ARIA progressbar name',
    axeSummary: 'Ensure every ARIA progressbar node has an accessible name',
    friendlySummary: 'Give each element with role="progressbar" a label or accessible name.',
  },
  'aria-prohibited-attr': {
    title: 'ARIA prohibited attributes',
    axeSummary: "Ensure ARIA attributes are not prohibited for an element's role",
    friendlySummary: "Don't use ARIA attributes that are forbidden for that element's role.",
  },
  'aria-required-attr': {
    title: 'ARIA required attributes',
    axeSummary: 'Ensure elements with ARIA roles have all required ARIA attributes',
    friendlySummary: 'Include all required ARIA attributes for elements with that ARIA role.',
  },
  'aria-required-children': {
    title: 'ARIA required children',
    axeSummary: 'Ensure elements with an ARIA role that require child roles contain them',
    friendlySummary: 'If an ARIA role requires specific child roles, include those child elements.',
  },
  'aria-required-parent': {
    title: 'ARIA required parent',
    axeSummary: 'Ensure elements with an ARIA role that require parent roles are contained by them',
    friendlySummary:
      'Place elements with certain ARIA roles inside the required parent role element.',
  },
  'aria-roles': {
    title: 'ARIA role value',
    axeSummary: 'Ensure all elements with a role attribute use a valid value',
    friendlySummary: 'Use only valid values in the role attribute (no typos or invalid roles).',
  },
  'aria-toggle-field-name': {
    title: 'ARIA toggle field name',
    axeSummary: 'Ensure every ARIA toggle field has an accessible name',
    friendlySummary:
      'Every ARIA toggle field (elements with the checkbox, radio, or switch roles) needs an accessible name.',
  },
  'aria-tooltip-name': {
    title: 'ARIA tooltip name',
    axeSummary: 'Ensure every ARIA tooltip node has an accessible name',
    friendlySummary: 'Give each element with role="tooltip" a descriptive accessible name.',
  },
  'aria-valid-attr-value': {
    title: 'ARIA attribute values valid',
    axeSummary: 'Ensure all ARIA attributes have valid values',
    friendlySummary: 'Use only valid values for ARIA attributes (no typos or invalid values).',
  },
  'aria-valid-attr': {
    title: 'ARIA attribute valid',
    axeSummary: 'Ensure attributes that begin with aria- are valid ARIA attributes',
    friendlySummary: 'Use only valid aria-* attributes (make sure the attribute name is correct).',
  },
  blink: {
    title: '<blink> element',
    axeSummary: 'Ensure <blink> elements are not used',
    friendlySummary: "Don't use the deprecated <blink> element.",
  },
  'button-name': {
    title: 'Button name',
    axeSummary: 'Ensure buttons have discernible text',
    friendlySummary: 'Every <button> needs a visible label or accessible name.',
  },
  bypass: {
    title: 'Navigation bypass',
    axeSummary:
      'Ensure each page has at least one mechanism to bypass navigation and jump to content',
    friendlySummary: 'Provide a way to skip repetitive navigation (e.g. a "Skip to content" link).',
  },
  'color-contrast': {
    title: 'Color contrast',
    axeSummary:
      'Ensure the contrast between foreground and background text meets WCAG 2 AA minimum thresholds',
    friendlySummary:
      'The color contrast between text and its background meets WCAG AA contrast ratio.',
  },
  'definition-list': {
    title: 'Definition list structure',
    axeSummary: 'Ensure <dl> elements are structured correctly',
    friendlySummary:
      'Definition lists (<dl>) should directly contain <dt> and <dd> elements in order.',
  },
  dlitem: {
    title: 'Definition list items',
    axeSummary: 'Ensure <dt> and <dd> elements are contained by a <dl>',
    friendlySummary: 'Ensure <dt> and <dd> elements are contained by a <dl>',
  },
  'document-title': {
    title: 'Document title',
    axeSummary: 'Ensure each HTML document contains a non-empty <title> element',
    friendlySummary: 'Include a non-empty <title> element for every page.',
  },
  'duplicate-id-aria': {
    title: 'Unique id',
    axeSummary: 'Ensure every id attribute value used in ARIA and in labels is unique',
    friendlySummary: 'Every id used for ARIA or form labels should be unique on the page.',
  },
  'form-field-multiple-labels': {
    title: 'Multiple form field labels',
    axeSummary: 'Ensure a form field does not have multiple <label> elements',
    friendlySummary: "Don't give a single form field more than one <label>.",
  },
  'frame-focusable-content': {
    title: 'Focusable frames',
    axeSummary: 'Ensure <frame> and <iframe> with focusable content do not have tabindex="-1"',
    friendlySummary:
      'Don\'t set tabindex="-1" on a <frame> or <iframe> that contains focusable elements.',
  },
  'frame-title-unique': {
    title: 'Unique frame title',
    axeSummary: 'Ensure <iframe> and <frame> elements contain a unique title attribute',
    friendlySummary: 'Use a unique title attribute for each <frame> or <iframe> on the page.',
  },
  'frame-title': {
    title: 'Frame title',
    axeSummary: 'Ensure <iframe> and <frame> elements have an accessible name',
    friendlySummary: 'Every <frame> and <iframe> needs a title or accessible name.',
  },
  'html-has-lang': {
    title: '<html> has lang',
    axeSummary: 'Ensure every HTML document has a lang attribute',
    friendlySummary: 'Add a lang attribute to the <html> element.',
  },
  'html-lang-valid': {
    title: '<html> lang valid',
    axeSummary: 'Ensure the <html lang> attribute has a valid value',
    friendlySummary: 'Use a valid language code in the <html lang> attribute.',
  },
  'html-xml-lang-mismatch': {
    title: 'HTML and XML lang mismatch',
    axeSummary:
      "Ensure that HTML elements with both lang and xml:lang agree on the page's language",
    friendlySummary:
      'If using both lang and xml:lang on <html>, make sure they are the same language.',
  },
  'image-alt': {
    title: 'Image alt text',
    axeSummary: 'Ensure <img> elements have alternative text or a role of none/presentation',
    friendlySummary: 'Give every image alt text or mark it as decorative with alt="".',
  },
  'input-button-name': {
    title: 'Input button name',
    axeSummary: 'Ensure input buttons have discernible text',
    friendlySummary:
      'Give each <input type="button"> or similar a clear label (text or aria-label).',
  },
  'input-image-alt': {
    title: 'Input image alt',
    axeSummary: 'Ensure <input type="image"> elements have alternative text',
    friendlySummary: '<input type="image"> must have alt text describing its image.',
  },
  label: {
    title: 'Form label',
    axeSummary: 'Ensure every form element has a label',
    friendlySummary: 'Every form field needs an associated label.',
  },
  'link-in-text-block': {
    title: 'Identifiable links',
    axeSummary: 'Ensure links are distinguishable from surrounding text without relying on color',
    friendlySummary: 'Make sure links are obviously identifiable without relying only on color.',
  },
  'link-name': {
    title: 'Link name',
    axeSummary: 'Ensure links have discernible text',
    friendlySummary: 'Give each link meaningful text or an aria-label so its purpose is clear.',
  },
  list: {
    title: 'List structure',
    axeSummary: 'Ensure that lists are structured correctly',
    friendlySummary: 'Use proper list structure. Only use <li> inside <ul> or <ol>.',
  },
  listitem: {
    title: 'List item',
    axeSummary: 'Ensure <li> elements are used semantically',
    friendlySummary: 'Only use <li> tags inside <ul> or <ol> lists.',
  },
  marquee: {
    title: '<marquee> element',
    axeSummary: 'Ensure <marquee> elements are not used',
    friendlySummary: "Don't use the deprecated <marquee> element.",
  },
  'meta-refresh': {
    title: '<meta> refresh',
    axeSummary: 'Ensure <meta http-equiv="refresh"> is not used for delayed refresh',
    friendlySummary:
      'Avoid auto-refreshing or redirecting pages using <meta http-equiv="refresh">.',
  },
  'meta-viewport': {
    title: '<meta> viewport scaling',
    axeSummary: 'Ensure <meta name="viewport"> does not disable text scaling and zooming',
    friendlySummary: 'Don\'t disable user zooming in <meta name="viewport"> to allow scaling.',
  },
  'nested-interactive': {
    title: 'Nested interactive controls',
    axeSummary:
      'Ensure interactive controls are not nested (nesting causes screen reader/focus issues)',
    friendlySummary:
      'Do not nest interactive elements; it can confuse screen readers and keyboard focus.',
  },
  'no-autoplay-audio': {
    title: 'Autoplaying video',
    axeSummary:
      'Ensure <video> or <audio> do not autoplay audio > 3 seconds without a control to stop/mute',
    friendlySummary:
      "Don't autoplay audio for more than 3 seconds without providing a way to stop or mute it.",
  },
  'object-alt': {
    title: '<object> alt text',
    axeSummary: 'Ensure <object> elements have alternative text',
    friendlySummary: 'Provide alternative text or content for <object> elements.',
  },
  'role-img-alt': {
    title: 'role="img" alt text',
    axeSummary: 'Ensure elements with role="img" have alternative text',
    friendlySummary: 'Any element with role="img" needs alt text.',
  },
  'scrollable-region-focusable': {
    title: 'Scrollable element focusable',
    axeSummary: 'Ensure elements with scrollable content are keyboard-accessible',
    friendlySummary: 'If an area can scroll, ensure it can be focused and scrolled via keyboard.',
  },
  'select-name': {
    title: '<select> name',
    axeSummary: 'Ensure <select> elements have an accessible name',
    friendlySummary: 'Give each <select> field a label or other accessible name.',
  },
  'server-side-image-map': {
    title: 'Server-side image map',
    axeSummary: 'Ensure that server-side image maps are not used',
    friendlySummary: "Don't use server-side image maps.",
  },
  'svg-img-alt': {
    title: 'SVG image alt text',
    axeSummary: 'Ensure <svg> images/graphics have accessible text',
    friendlySummary: 'SVG images with role="img" or similar need a text description.',
  },
  'td-headers-attr': {
    title: 'Table headers attribute',
    axeSummary: 'Ensure each cell in a table using headers only refers to <th> in that table',
    friendlySummary:
      'In tables using the headers attribute, only reference other cells in the same table.',
  },
  'th-has-data-cells': {
    title: '<th> has data cell',
    axeSummary: 'Ensure <th> (or header role) elements have data cells they describe',
    friendlySummary:
      'Every table header (<th> or header role) should correspond to at least one data cell.',
  },
  'valid-lang': {
    title: 'Valid lang',
    axeSummary: 'Ensure lang attributes have valid values',
    friendlySummary: 'Use valid language codes in all lang attributes.',
  },
  'video-caption': {
    title: '<video> captions',
    axeSummary: 'Ensure <video> elements have captions',
    friendlySummary: 'Provide captions for all <video> content.',
  },
};

// Rules that align with WCAG 2.1 A/AA success criteria.
const axeRuleMapping_wcag_2_1_a_aa: AxeRuleMap = {
  'autocomplete-valid': {
    title: 'autocomplete attribute valid',
    axeSummary: 'Ensure the autocomplete attribute is correct and suitable for the form field',
    friendlySummary: "Use valid autocomplete values that match the form field's purpose.",
  },
  'avoid-inline-spacing': {
    title: 'Forced inline spacing',
    axeSummary: 'Ensure that text spacing set via inline styles can be adjusted with custom CSS',
    friendlySummary:
      "Don't lock in text spacing with forced (!important) inline styles—allow user CSS to adjust text spacing.",
  },
};

// Rules that align with WCAG 2.2 A/AA success criteria.
const axeRuleMapping_wcag_2_2_a_aa: AxeRuleMap = {
  'target-size': {
    title: 'Touch target size',
    axeSummary: 'Ensure touch targets have sufficient size and space',
    friendlySummary:
      'Make sure interactive elements are big enough and not too close together for touch.',
  },
};

// Rules not tied to specific WCAG criteria, but reflect industry best practices for accessibility.
const axeRuleMapping_best_practices: AxeRuleMap = {
  accesskeys: {
    title: 'Unique accesskey',
    axeSummary: 'Ensure every accesskey attribute value is unique',
    friendlySummary: 'Use unique values for all accesskey attributes.',
  },
  'aria-allowed-role': {
    title: 'Appropriate role value',
    axeSummary: 'Ensure the role attribute has an appropriate value for the element',
    friendlySummary: 'ARIA roles should have a valid value for the element.',
  },
  'aria-dialog-name': {
    title: 'ARIA dialog name',
    axeSummary: 'Ensure every ARIA dialog and alertdialog has an accessible name',
    friendlySummary: 'Give each ARIA dialog or alertdialog a title or accessible name.',
  },
  'aria-text': {
    title: 'ARIA role="text"',
    axeSummary: 'Ensure role="text" is used on elements with no focusable descendants',
    friendlySummary: 'Only use role="text" on elements that don\'t contain focusable elements.',
  },
  'aria-treeitem-name': {
    title: 'ARIA treeitem name',
    axeSummary: 'Ensure every ARIA treeitem node has an accessible name',
    friendlySummary: 'Give each ARIA treeitem a label or accessible name.',
  },
  'empty-heading': {
    title: 'Empty heading',
    axeSummary: 'Ensure headings have discernible text',
    friendlySummary: "Don't leave heading elements empty or hide them.",
  },
  'empty-table-header': {
    title: 'Empty table header',
    axeSummary: 'Ensure table headers have discernible text',
    friendlySummary: 'Make sure table header cells have visible text.',
  },
  'frame-tested': {
    title: 'Test all frames',
    axeSummary: 'Ensure <iframe> and <frame> elements contain the axe-core script',
    friendlySummary:
      'Make sure axe-core is injected into all frames or iframes so they are tested.',
  },
  'heading-order': {
    title: 'Heading order',
    axeSummary: 'Ensure the order of headings is semantically correct (no skipping levels)',
    friendlySummary: "Use proper heading order (don't skip heading levels).",
  },
  'image-redundant-alt': {
    title: 'Redundant image alt text',
    axeSummary: 'Ensure image alternative text is not repeated as nearby text',
    friendlySummary:
      "Avoid repeating the same information in both an image's alt text and nearby text.",
  },
  'label-title-only': {
    title: 'Visible form element label',
    axeSummary: 'Ensure each form element has a visible label (not only title/ARIA)',
    friendlySummary:
      'Every form input needs a visible label (not only a title attribute or hidden text).',
  },
  'landmark-banner-is-top-level': {
    title: 'Top-level landmark banner',
    axeSummary: 'Ensure the banner landmark is at top level (not nested)',
    friendlySummary:
      'Use the banner landmark (e.g. site header) only at the top level of the page, not inside another landmark.',
  },
  'landmark-complementary-is-top-level': {
    title: 'Top-level <aside>',
    axeSummary: 'Ensure the complementary landmark (<aside>) is top level',
    friendlySummary:
      'The complementary landmark <aside> or role="complementary" should be a top-level region, not nested in another landmark.',
  },
  'landmark-contentinfo-is-top-level': {
    title: 'Top-level contentinfo',
    axeSummary: 'Ensure the contentinfo landmark (footer) is top level',
    friendlySummary:
      'Make sure the contentinfo landmark (footer) is at the top level of the page and not contained in another landmark.',
  },
  'landmark-main-is-top-level': {
    title: 'Top-level main',
    axeSummary: 'Ensure the main landmark is at top level',
    friendlySummary:
      'The main landmark should be a top-level element and not nested inside another landmark.',
  },
  'landmark-no-duplicate-banner': {
    title: 'Duplicate banner landmark',
    axeSummary: 'Ensure the document has at most one banner landmark',
    friendlySummary: 'Have only one role="banner" or <header> on a page.',
  },
  'landmark-no-duplicate-contentinfo': {
    title: 'Duplicate contentinfo',
    axeSummary: 'Ensure the document has at most one contentinfo landmark',
    friendlySummary: 'Have only one role="contentinfo" or <footer> on a page.',
  },
  'landmark-no-duplicate-main': {
    title: 'Duplicate main',
    axeSummary: 'Ensure the document has at most one main landmark',
    friendlySummary: 'Have only one role="main" or <main> on a page.',
  },
  'landmark-one-main': {
    title: 'main landmark',
    axeSummary: 'Ensure the document has a main landmark',
    friendlySummary: 'Include a main landmark on each page using a <main> region or role="main".',
  },
  'landmark-unique': {
    title: 'Unique landmark',
    axeSummary: 'Ensure landmarks have a unique role or role/label combination',
    friendlySummary:
      'If you use multiple landmarks of the same type, give them unique labels (names).',
  },
  'meta-viewport-large': {
    title: 'Significant viewport scaling',
    axeSummary: 'Ensure <meta name="viewport"> can scale a significant amount (e.g. 500%)',
    friendlySummary: '<meta name="viewport"> should allow users to significantly scale content.',
  },
  'page-has-heading-one': {
    title: 'Has <h1>',
    axeSummary: 'Ensure the page (or at least one frame) contains a level-one heading',
    friendlySummary: 'Every page or frame should have at least one <h1> heading.',
  },
  'presentation-role-conflict': {
    title: 'Presentational content',
    axeSummary: 'Ensure elements with role="presentation"/"none" have no ARIA or tabindex',
    friendlySummary:
      'Don\'t give elements with role="none"/"presentation" any ARIA attributes or a tabindex.',
  },
  region: {
    title: 'Landmark regions',
    axeSummary: 'Ensure all page content is contained by landmarks',
    friendlySummary:
      'Wrap all page content in appropriate landmark regions (<header>, <main>, <footer>, etc.).',
  },
  'scope-attr-valid': {
    title: 'scope attribute',
    axeSummary: 'Ensure the scope attribute is used correctly on tables',
    friendlySummary:
      'Use the scope attribute only on <th> elements, with proper values (col, row, etc.).',
  },
  'skip-link': {
    title: 'Skip link',
    axeSummary: 'Ensure all "skip" links have a focusable target',
    friendlySummary: 'Make sure any "skip to content" link targets an existing, focusable element.',
  },
  tabindex: {
    title: 'tabindex values',
    axeSummary: 'Ensure tabindex attribute values are not greater than 0',
    friendlySummary: "Don't use tabindex values greater than 0.",
  },
  'table-duplicate-name': {
    title: 'Duplicate names for table',
    axeSummary: 'Ensure the <caption> does not duplicate the summary attribute text',
    friendlySummary:
      "Don't use the same text in both a table's <caption> and its summary attribute.",
  },
};

// Rules correspond to WCAG AAA success criteria (axe-core does not run these by default, as AAA is often optional).
const axeRuleMapping_wcag_2_x_aaa: AxeRuleMap = {
  'color-contrast-enhanced': {
    title: 'Enhanced color contrast',
    axeSummary:
      'Ensure contrast between text and background meets WCAG 2 AAA enhanced contrast thresholds',
    friendlySummary: 'Use extra-high contrast for text and background to meet WCAG AAA level.',
  },
  'identical-links-same-purpose': {
    title: 'Same link name, same purpose',
    axeSummary: 'Ensure links with the same accessible name serve a similar purpose',
    friendlySummary:
      'If two links have the same text, they should do the same thing (lead to the same content).',
  },
  'meta-refresh-no-exceptions': {
    title: 'No <meta http-equiv="refresh">',
    axeSummary:
      'Ensure <meta http-equiv="refresh"> is not used for delayed refresh (no exceptions)',
    friendlySummary:
      'Don\'t auto-refresh or redirect pages using <meta http-equiv="refresh"> even with a delay.',
  },
};

// Rules are experimental (in development) and disabled by default in axe-core (they may be enabled in axe browser extensions).
const axeRuleMapping_experimental: AxeRuleMap = {
  'css-orientation-lock': {
    title: 'CSS orientation lock',
    axeSummary:
      'Ensure content is not locked to a specific display orientation (works in all orientations)',
    friendlySummary:
      "Don't lock content to one screen orientation; support both portrait and landscape modes.",
  },
  'focus-order-semantics': {
    title: 'Focus order semantic role',
    axeSummary: 'Ensure elements in the tab order have a role appropriate for interactive content',
    friendlySummary:
      'Ensure elements in the tab order have a role appropriate for interactive content',
  },
  'hidden-content': {
    title: 'Hidden content',
    axeSummary: 'Informs users about hidden content',
    friendlySummary: 'Display hidden content on the page for test analysis.',
  },
  'label-content-name-mismatch': {
    title: 'Content name mismatch',
    axeSummary:
      'Ensure elements labeled by their content include that text in their accessible name',
    friendlySummary:
      "If an element's visible text serves as its label, include that text in its accessible name.",
  },
  'p-as-heading': {
    title: 'No <p> headings',
    axeSummary: "Ensure <p> elements aren't styled to look like headings (use real headings)",
    friendlySummary:
      "Don't just style a <p> to look like a heading – use an actual heading tag for headings.",
  },
  'table-fake-caption': {
    title: 'Table caption',
    axeSummary: 'Ensure that tables with a caption use the <caption> element',
    friendlySummary: 'Use a <caption> element for table captions instead of just styled text.',
  },
  'td-has-header': {
    title: '<td> has header',
    axeSummary: 'Ensure each non-empty data cell in large tables (3×3+) has one or more headers',
    friendlySummary:
      'Every data cell in large tables should be associated with at least one header cell.',
  },
};

// Rules are deprecated (no longer recommended and disabled by default). They may be removed in future axe-core releases.
const axeRuleMapping_deprecated: AxeRuleMap = {
  'aria-roledescription': {
    title: 'aria-roledescription',
    axeSummary:
      'Ensure aria-roledescription is only used on elements with an implicit or explicit role',
    friendlySummary: 'Only use aria-roledescription on elements that already have a defined role.',
  },
};

export const combinedRulesMap: AxeRuleMap = {
  ...axeRuleMapping_wcag_2_0_a_aa,
  ...axeRuleMapping_wcag_2_1_a_aa,
  ...axeRuleMapping_wcag_2_2_a_aa,
  ...axeRuleMapping_wcag_2_x_aaa,
  ...axeRuleMapping_best_practices,
  ...axeRuleMapping_experimental,
  ...axeRuleMapping_deprecated,
};
