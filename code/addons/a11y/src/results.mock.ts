export const results = {
  testEngine: {
    name: 'axe-core',
    version: '4.10.2',
  },
  testRunner: {
    name: 'axe',
  },
  testEnvironment: {
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
    windowWidth: 833,
    windowHeight: 1315,
    orientationAngle: 0,
    orientationType: 'landscape-primary',
  },
  timestamp: '2025-03-17T15:21:16.569Z',
  url: 'http://localhost:6006/iframe.html?viewMode=story&id=manager-sidebar-explorer--with-refs&args=&globals=',
  toolOptions: {
    reporter: 'v1',
  },
  passes: [
    {
      id: 'aria-allowed-attr',
      impact: 'critical',
      tags: ['cat.aria', 'wcag2a', 'wcag412', 'EN-301-549', 'EN-9.4.1.2'],
      description: "Ensure an element's role supports its ARIA attributes",
      help: 'Elements must only use supported ARIA attributes',
      helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/aria-allowed-attr?application=axeAPI',
      nodes: [
        {
          any: [],
          all: [
            {
              id: 'aria-allowed-attr',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attributes are used correctly for the defined role',
              '_constructor-name_': 'CheckResult',
            },
          ],
          none: [
            {
              id: 'aria-unsupported-attr',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute is supported',
              '_constructor-name_': 'CheckResult',
            },
          ],
          impact: null,
          html: '<button tabindex="-1" id="group-1" aria-controls="group-1--child-b1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-ohbggj > .css-ld0a14[data-item-id="group-1"][data-nodetype="group"] > .css-154pbrb[aria-controls="group-1--child-b1"]',
          ],
        },
        {
          any: [],
          all: [
            {
              id: 'aria-allowed-attr',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attributes are used correctly for the defined role',
              '_constructor-name_': 'CheckResult',
            },
          ],
          none: [
            {
              id: 'aria-unsupported-attr',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute is supported',
              '_constructor-name_': 'CheckResult',
            },
          ],
          impact: null,
          html: '<button type="button" data-action="collapse-root" aria-expanded="true" class="css-h7e28b">',
          target: [
            '.css-ohbggj > .css-1ikkmhb.sidebar-subheading[data-item-id="root-1"] > .css-h7e28b[type="button"][data-action="collapse-root"]',
          ],
        },
        {
          any: [],
          all: [
            {
              id: 'aria-allowed-attr',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attributes are used correctly for the defined role',
              '_constructor-name_': 'CheckResult',
            },
          ],
          none: [
            {
              id: 'aria-unsupported-attr',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute is supported',
              '_constructor-name_': 'CheckResult',
            },
          ],
          impact: null,
          html: '<button class="sidebar-subheading-action css-18rvurk" aria-label="Collapse" data-action="expand-all" data-expanded="false">',
          target: [
            '.css-ohbggj > .css-1ikkmhb.sidebar-subheading[data-item-id="root-1"] > .sidebar-subheading-action.css-18rvurk[aria-label="Collapse"]',
          ],
        },
        {
          any: [],
          all: [
            {
              id: 'aria-allowed-attr',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attributes are used correctly for the defined role',
              '_constructor-name_': 'CheckResult',
            },
          ],
          none: [
            {
              id: 'aria-unsupported-attr',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute is supported',
              '_constructor-name_': 'CheckResult',
            },
          ],
          impact: null,
          html: '<button tabindex="-1" id="root-1-child-a1" aria-expanded="false" class="css-1vdojxu"><div class="css-99l9qv"><svg viewBox="0 0 14 14" width="12" height="12" type="component" class="css-1e3avu6"><use xlink:href="#icon--component"></use></svg></div>Child A1</button>',
          target: [
            '.css-ohbggj > .css-ld0a14[data-item-id="root-1-child-a1"][data-parent-id="root-1"] > .css-1vdojxu',
          ],
        },
      ],
    },
    {
      id: 'aria-conditional-attr',
      impact: null,
      tags: ['cat.aria', 'wcag2a', 'wcag412', 'EN-301-549', 'EN-9.4.1.2'],
      description:
        "Ensure ARIA attributes are used as described in the specification of the element's role",
      help: "ARIA attributes must be used as specified for the element's role",
      helpUrl:
        'https://dequeuniversity.com/rules/axe/4.10/aria-conditional-attr?application=axeAPI',
      nodes: [
        {
          any: [],
          all: [
            {
              id: 'aria-conditional-attr',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'ARIA attribute is allowed',
              '_constructor-name_': 'CheckResult',
            },
          ],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="group-1" aria-controls="group-1--child-b1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-ohbggj > .css-ld0a14[data-item-id="group-1"][data-nodetype="group"] > .css-154pbrb[aria-controls="group-1--child-b1"]',
          ],
        },
        {
          any: [],
          all: [
            {
              id: 'aria-conditional-attr',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'ARIA attribute is allowed',
              '_constructor-name_': 'CheckResult',
            },
          ],
          none: [],
          impact: null,
          html: '<button type="button" data-action="collapse-root" aria-expanded="true" class="css-h7e28b">',
          target: [
            '.css-ohbggj > .css-1ikkmhb.sidebar-subheading[data-item-id="root-1"] > .css-h7e28b[type="button"][data-action="collapse-root"]',
          ],
        },
        {
          any: [],
          all: [
            {
              id: 'aria-conditional-attr',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'ARIA attribute is allowed',
              '_constructor-name_': 'CheckResult',
            },
          ],
          none: [],
          impact: null,
          html: '<button class="sidebar-subheading-action css-18rvurk" aria-label="Collapse" data-action="expand-all" data-expanded="false">',
          target: [
            '.css-ohbggj > .css-1ikkmhb.sidebar-subheading[data-item-id="root-1"] > .sidebar-subheading-action.css-18rvurk[aria-label="Collapse"]',
          ],
        },
        {
          any: [],
          all: [
            {
              id: 'aria-conditional-attr',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'ARIA attribute is allowed',
              '_constructor-name_': 'CheckResult',
            },
          ],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="root-1-child-a1" aria-expanded="false" class="css-1vdojxu"><div class="css-99l9qv"><svg viewBox="0 0 14 14" width="12" height="12" type="component" class="css-1e3avu6"><use xlink:href="#icon--component"></use></svg></div>Child A1</button>',
          target: [
            '.css-ohbggj > .css-ld0a14[data-item-id="root-1-child-a1"][data-parent-id="root-1"] > .css-1vdojxu',
          ],
        },
      ],
    },
    {
      id: 'aria-hidden-body',
      impact: null,
      tags: ['cat.aria', 'wcag2a', 'wcag131', 'wcag412', 'EN-301-549', 'EN-9.1.3.1', 'EN-9.4.1.2'],
      description: 'Ensure aria-hidden="true" is not present on the document body.',
      help: 'aria-hidden="true" must not be present on the document body',
      helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/aria-hidden-body?application=axeAPI',
      nodes: [
        {
          any: [
            {
              id: 'aria-hidden-body',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'No aria-hidden attribute is present on document body',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<body class="sb-main-fullscreen sb-show-main" style="background: rgb(255, 255, 255); color: rgb(46, 52, 56);">',
          target: ['body'],
        },
      ],
    },
    {
      id: 'aria-hidden-focus',
      impact: null,
      tags: [
        'cat.name-role-value',
        'wcag2a',
        'wcag412',
        'TTv5',
        'TT6.a',
        'EN-301-549',
        'EN-9.4.1.2',
      ],
      description: 'Ensure aria-hidden elements are not focusable nor contain focusable elements',
      help: 'ARIA hidden element must not be focusable or contain focusable elements',
      helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/aria-hidden-focus?application=axeAPI',
      nodes: [
        {
          any: [],
          all: [
            {
              id: 'focusable-modal-open',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'No focusable elements while a modal is open',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'focusable-disabled',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'No focusable elements contained within element',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'focusable-not-tabbable',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'No focusable elements contained within element',
              '_constructor-name_': 'CheckResult',
            },
          ],
          none: [],
          impact: null,
          html: '<table aria-hidden="true" class="sb-argstableBlock">',
          target: ['table'],
        },
      ],
    },
  ],
  incomplete: [
    {
      id: 'aria-prohibited-attr',
      impact: 'serious',
      tags: ['cat.aria', 'wcag2a', 'wcag412', 'EN-301-549', 'EN-9.4.1.2'],
      description: "Ensure ARIA attributes are not prohibited for an element's role",
      help: 'Elements must only use permitted ARIA attributes',
      helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/aria-prohibited-attr?application=axeAPI',
      nodes: [
        {
          any: [],
          all: [],
          none: [
            {
              id: 'aria-prohibited-attr',
              data: {
                role: null,
                nodeName: 'div',
                messageKey: 'noRoleSingular',
                prohibited: ['aria-label'],
              },
              relatedNodes: [],
              impact: 'serious',
              message:
                'aria-label attribute is not well supported on a div with no valid role attribute.',
              '_constructor-name_': 'CheckResult',
            },
          ],
          impact: 'serious',
          html: '<div aria-label="Hide Basic ref stories" aria-expanded="true" class="css-8kwxkl">',
          target: ['.css-8kwxkl[aria-label="Hide Basic ref stories"]'],
          failureSummary:
            'Fix all of the following:\n  aria-label attribute is not well supported on a div with no valid role attribute.',
        },
        {
          any: [],
          all: [],
          none: [
            {
              id: 'aria-prohibited-attr',
              data: {
                role: null,
                nodeName: 'div',
                messageKey: 'noRoleSingular',
                prohibited: ['aria-label'],
              },
              relatedNodes: [],
              impact: 'serious',
              message:
                'aria-label attribute is not well supported on a div with no valid role attribute.',
              '_constructor-name_': 'CheckResult',
            },
          ],
          impact: 'serious',
          html: '<div aria-label="Hide Not ready stories" aria-expanded="true" class="css-8kwxkl">',
          target: ['.css-8kwxkl[aria-label="Hide Not ready stories"]'],
          failureSummary:
            'Fix all of the following:\n  aria-label attribute is not well supported on a div with no valid role attribute.',
        },
        {
          any: [],
          all: [],
          none: [
            {
              id: 'aria-prohibited-attr',
              data: {
                role: null,
                nodeName: 'div',
                messageKey: 'noRoleSingular',
                prohibited: ['aria-label'],
              },
              relatedNodes: [],
              impact: 'serious',
              message:
                'aria-label attribute is not well supported on a div with no valid role attribute.',
              '_constructor-name_': 'CheckResult',
            },
          ],
          impact: 'serious',
          html: '<div aria-label="Hide Unknown ref stories" aria-expanded="true" class="css-8kwxkl">',
          target: ['.css-8kwxkl[aria-label="Hide Unknown ref stories"]'],
          failureSummary:
            'Fix all of the following:\n  aria-label attribute is not well supported on a div with no valid role attribute.',
        },
        {
          any: [],
          all: [],
          none: [
            {
              id: 'aria-prohibited-attr',
              data: {
                role: null,
                nodeName: 'div',
                messageKey: 'noRoleSingular',
                prohibited: ['aria-label'],
              },
              relatedNodes: [],
              impact: 'serious',
              message:
                'aria-label attribute is not well supported on a div with no valid role attribute.',
              '_constructor-name_': 'CheckResult',
            },
          ],
          impact: 'serious',
          html: '<div aria-label="Hide Lazy loaded ref stories" aria-expanded="true" class="css-8kwxkl">',
          target: ['.css-8kwxkl[aria-label="Hide Lazy loaded ref stories"]'],
          failureSummary:
            'Fix all of the following:\n  aria-label attribute is not well supported on a div with no valid role attribute.',
        },
      ],
    },
    {
      id: 'duplicate-id-aria',
      impact: 'critical',
      tags: ['cat.parsing', 'wcag2a', 'wcag412', 'EN-301-549', 'EN-9.4.1.2'],
      description: 'Ensure every id attribute value used in ARIA and in labels is unique',
      help: 'IDs used in ARIA and labels must be unique',
      helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/duplicate-id-aria?application=axeAPI',
      nodes: [
        {
          any: [
            {
              id: 'duplicate-id-aria',
              data: 'root-1-child-a1',
              relatedNodes: [
                {
                  html: '<button tabindex="-1" id="root-1-child-a1" aria-expanded="false" class="css-1vdojxu"><div class="css-99l9qv"><svg viewBox="0 0 14 14" width="12" height="12" type="component" class="css-1e3avu6"><use xlink:href="#icon--component"></use></svg></div>Child A1</button>',
                  target: [
                    '.css-ohbggj > .css-qyeqia[data-item-id="root-1-child-a1"][data-parent-id="root-1"] > .css-1vdojxu',
                  ],
                },
              ],
              impact: 'critical',
              message:
                'Document has multiple elements referenced with ARIA with the same id attribute: root-1-child-a1',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: 'critical',
          html: '<button tabindex="-1" id="root-1-child-a1" aria-expanded="false" class="css-1vdojxu"><div class="css-99l9qv"><svg viewBox="0 0 14 14" width="12" height="12" type="component" class="css-1e3avu6"><use xlink:href="#icon--component"></use></svg></div>Child A1</button>',
          target: [
            '.css-ohbggj > .css-ld0a14[data-item-id="root-1-child-a1"][data-parent-id="root-1"] > .css-1vdojxu',
          ],
          failureSummary:
            'Fix any of the following:\n  Document has multiple elements referenced with ARIA with the same id attribute: root-1-child-a1',
        },
        {
          any: [
            {
              id: 'duplicate-id-aria',
              data: 'root-1-child-a2--grandchild-a1-1',
              relatedNodes: [
                {
                  html: '<a tabindex="-1" href="/iframe.html?path=/story/root-1-child-a2--grandchild-a1-1" id="root-1-child-a2--grandchild-a1-1" class="css-xwriep">',
                  target: [
                    '.css-1x6s7u8 > div > div[data-highlighted-ref-id="storybook_internal"] > .css-79elbk[data-title="storybook_internal"] > .css-ohbggj > div[data-selected="true"][data-parent-id="root-1-child-a2"][data-nodetype="story"] > .css-xwriep',
                  ],
                },
              ],
              impact: 'critical',
              message:
                'Document has multiple elements referenced with ARIA with the same id attribute: root-1-child-a2--grandchild-a1-1',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: 'critical',
          html: '<a tabindex="-1" href="/iframe.html?path=/story/root-1-child-a2--grandchild-a1-1" id="root-1-child-a2--grandchild-a1-1" class="css-xwriep">',
          target: [
            '.css-ocnlra > div > div[data-highlighted-ref-id="storybook_internal"] > .css-79elbk[data-title="storybook_internal"] > .css-ohbggj > div[data-selected="true"][data-parent-id="root-1-child-a2"][data-nodetype="story"] > .css-xwriep',
          ],
          failureSummary:
            'Fix any of the following:\n  Document has multiple elements referenced with ARIA with the same id attribute: root-1-child-a2--grandchild-a1-1',
        },
      ],
    },
  ],
  violations: [
    {
      id: 'aria-allowed-attr',
      impact: 'critical',
      tags: ['cat.aria', 'wcag2a', 'wcag412', 'EN-301-549', 'EN-9.4.1.2'],
      description: "Ensure an element's role supports its ARIA attributes",
      help: 'Elements must only use supported ARIA attributes',
      helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/aria-allowed-attr?application=axeAPI',
      nodes: [
        {
          any: [],
          all: [
            {
              id: 'aria-allowed-attr',
              data: ['aria-expanded="true"'],
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute is not allowed: aria-expanded="true"',
              '_constructor-name_': 'CheckResult',
            },
          ],
          none: [],
          impact: 'critical',
          html: '<div aria-label="Hide Basic ref stories" aria-expanded="true" class="css-8kwxkl">',
          target: ['.css-8kwxkl[aria-label="Hide Basic ref stories"]'],
          failureSummary:
            'Fix all of the following:\n  ARIA attribute is not allowed: aria-expanded="true"',
        },
        {
          any: [],
          all: [
            {
              id: 'aria-allowed-attr',
              data: ['aria-expanded="true"'],
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute is not allowed: aria-expanded="true"',
              '_constructor-name_': 'CheckResult',
            },
          ],
          none: [],
          impact: 'critical',
          html: '<div aria-label="Hide Not ready stories" aria-expanded="true" class="css-8kwxkl">',
          target: ['.css-8kwxkl[aria-label="Hide Not ready stories"]'],
          failureSummary:
            'Fix all of the following:\n  ARIA attribute is not allowed: aria-expanded="true"',
        },
        {
          any: [],
          all: [
            {
              id: 'aria-allowed-attr',
              data: ['aria-expanded="true"'],
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute is not allowed: aria-expanded="true"',
              '_constructor-name_': 'CheckResult',
            },
          ],
          none: [],
          impact: 'critical',
          html: '<div aria-label="Hide Unknown ref stories" aria-expanded="true" class="css-8kwxkl">',
          target: ['.css-8kwxkl[aria-label="Hide Unknown ref stories"]'],
          failureSummary:
            'Fix all of the following:\n  ARIA attribute is not allowed: aria-expanded="true"',
        },
        {
          any: [],
          all: [
            {
              id: 'aria-allowed-attr',
              data: ['aria-expanded="true"'],
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute is not allowed: aria-expanded="true"',
              '_constructor-name_': 'CheckResult',
            },
          ],
          none: [],
          impact: 'critical',
          html: '<div aria-label="Hide Lazy loaded ref stories" aria-expanded="true" class="css-8kwxkl">',
          target: ['.css-8kwxkl[aria-label="Hide Lazy loaded ref stories"]'],
          failureSummary:
            'Fix all of the following:\n  ARIA attribute is not allowed: aria-expanded="true"',
        },
      ],
    },
    {
      id: 'color-contrast',
      impact: 'serious',
      tags: [
        'cat.color',
        'wcag2aa',
        'wcag143',
        'TTv5',
        'TT13.c',
        'EN-301-549',
        'EN-9.1.4.3',
        'ACT',
      ],
      description:
        'Ensure the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds',
      help: 'Elements must meet minimum color contrast ratio thresholds',
      helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/color-contrast?application=axeAPI',
      nodes: [
        {
          any: [
            {
              id: 'color-contrast',
              data: {
                fgColor: '#ffffff',
                bgColor: '#029cfd',
                contrastRatio: 2.92,
                fontSize: '10.5pt (14px)',
                fontWeight: 'bold',
                messageKey: null,
                expectedContrastRatio: '4.5:1',
              },
              relatedNodes: [
                {
                  html: '<div class="sidebar-item css-ld0a14" data-selected="true" data-ref-id="storybook_internal" data-item-id="root-1-child-a2--grandchild-a1-1" data-parent-id="root-1-child-a2" data-nodetype="story" data-highlightable="true">',
                  target: [
                    '.css-ocnlra > div > div[data-highlighted-ref-id="storybook_internal"] > .css-79elbk[data-title="storybook_internal"] > .css-ohbggj > div[data-selected="true"][data-parent-id="root-1-child-a2"][data-nodetype="story"]',
                  ],
                },
              ],
              impact: 'serious',
              message:
                'Element has insufficient color contrast of 2.92 (foreground color: #ffffff, background color: #029cfd, font size: 10.5pt (14px), font weight: bold). Expected contrast ratio of 4.5:1',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: 'serious',
          html: '<a tabindex="-1" href="/iframe.html?path=/story/root-1-child-a2--grandchild-a1-1" id="root-1-child-a2--grandchild-a1-1" class="css-xwriep">',
          target: [
            '.css-ocnlra > div > div[data-highlighted-ref-id="storybook_internal"] > .css-79elbk[data-title="storybook_internal"] > .css-ohbggj > div[data-selected="true"][data-parent-id="root-1-child-a2"][data-nodetype="story"] > .css-xwriep',
          ],
          failureSummary:
            'Fix any of the following:\n  Element has insufficient color contrast of 2.92 (foreground color: #ffffff, background color: #029cfd, font size: 10.5pt (14px), font weight: bold). Expected contrast ratio of 4.5:1',
        },
        {
          any: [
            {
              id: 'color-contrast',
              data: {
                fgColor: '#798186',
                bgColor: '#1b1c1d',
                contrastRatio: 4.3,
                fontSize: '8.3pt (11px)',
                fontWeight: 'bold',
                messageKey: null,
                expectedContrastRatio: '4.5:1',
              },
              relatedNodes: [
                {
                  html: '<div data-side="right" class="css-1x6s7u8">',
                  target: ['.css-1x6s7u8'],
                },
              ],
              impact: 'serious',
              message:
                'Element has insufficient color contrast of 4.3 (foreground color: #798186, background color: #1b1c1d, font size: 8.3pt (11px), font weight: bold). Expected contrast ratio of 4.5:1',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: 'serious',
          html: '<button type="button" data-action="collapse-root" aria-expanded="true" class="css-h7e28b">',
          target: [
            '.css-ohbggj > .css-170ite8.sidebar-subheading[data-item-id="root-1"] > .css-h7e28b[type="button"][data-action="collapse-root"]',
          ],
          failureSummary:
            'Fix any of the following:\n  Element has insufficient color contrast of 4.3 (foreground color: #798186, background color: #1b1c1d, font size: 8.3pt (11px), font weight: bold). Expected contrast ratio of 4.5:1',
        },
        {
          any: [
            {
              id: 'color-contrast',
              data: {
                fgColor: '#ffffff',
                bgColor: '#029cfd',
                contrastRatio: 2.92,
                fontSize: '10.5pt (14px)',
                fontWeight: 'bold',
                messageKey: null,
                expectedContrastRatio: '4.5:1',
              },
              relatedNodes: [
                {
                  html: '<div class="sidebar-item css-qyeqia" data-selected="true" data-ref-id="storybook_internal" data-item-id="root-1-child-a2--grandchild-a1-1" data-parent-id="root-1-child-a2" data-nodetype="story" data-highlightable="true">',
                  target: [
                    '.css-1x6s7u8 > div > div[data-highlighted-ref-id="storybook_internal"] > .css-79elbk[data-title="storybook_internal"] > .css-ohbggj > div[data-selected="true"][data-parent-id="root-1-child-a2"][data-nodetype="story"]',
                  ],
                },
              ],
              impact: 'serious',
              message:
                'Element has insufficient color contrast of 2.92 (foreground color: #ffffff, background color: #029cfd, font size: 10.5pt (14px), font weight: bold). Expected contrast ratio of 4.5:1',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: 'serious',
          html: '<a tabindex="-1" href="/iframe.html?path=/story/root-1-child-a2--grandchild-a1-1" id="root-1-child-a2--grandchild-a1-1" class="css-xwriep">',
          target: [
            '.css-1x6s7u8 > div > div[data-highlighted-ref-id="storybook_internal"] > .css-79elbk[data-title="storybook_internal"] > .css-ohbggj > div[data-selected="true"][data-parent-id="root-1-child-a2"][data-nodetype="story"] > .css-xwriep',
          ],
          failureSummary:
            'Fix any of the following:\n  Element has insufficient color contrast of 2.92 (foreground color: #ffffff, background color: #029cfd, font size: 10.5pt (14px), font weight: bold). Expected contrast ratio of 4.5:1',
        },
        {
          any: [
            {
              id: 'color-contrast',
              data: {
                fgColor: '#798186',
                bgColor: '#1b1c1d',
                contrastRatio: 4.3,
                fontSize: '8.3pt (11px)',
                fontWeight: 'bold',
                messageKey: null,
                expectedContrastRatio: '4.5:1',
              },
              relatedNodes: [
                {
                  html: '<div data-side="right" class="css-1x6s7u8">',
                  target: ['.css-1x6s7u8'],
                },
              ],
              impact: 'serious',
              message:
                'Element has insufficient color contrast of 4.3 (foreground color: #798186, background color: #1b1c1d, font size: 8.3pt (11px), font weight: bold). Expected contrast ratio of 4.5:1',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: 'serious',
          html: '<button type="button" data-action="collapse-root" aria-expanded="true" class="css-h7e28b">',
          target: [
            '.css-ohbggj > .css-170ite8.sidebar-subheading[data-item-id="root-3"] > .css-h7e28b[type="button"][data-action="collapse-root"]',
          ],
          failureSummary:
            'Fix any of the following:\n  Element has insufficient color contrast of 4.3 (foreground color: #798186, background color: #1b1c1d, font size: 8.3pt (11px), font weight: bold). Expected contrast ratio of 4.5:1',
        },
      ],
    },
    {
      id: 'landmark-unique',
      impact: 'moderate',
      tags: ['cat.semantics', 'best-practice'],
      description: 'Ensure landmarks are unique',
      help: 'Landmarks should have a unique role or role/label/title (i.e. accessible name) combination',
      helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/landmark-unique?application=axeAPI',
      nodes: [
        {
          any: [
            {
              id: 'landmark-is-unique',
              data: {
                role: 'complementary',
                accessibleText: null,
              },
              relatedNodes: [
                {
                  html: '<aside class="css-1s0lzul"><div></div></aside>',
                  target: ['.css-8kwxkl[aria-label="Hide Not ready stories"] > aside'],
                },
                {
                  html: '<aside class="css-1s0lzul"><div></div></aside>',
                  target: ['.css-8kwxkl[aria-label="Hide Unknown ref stories"] > aside'],
                },
                {
                  html: '<aside class="css-1s0lzul"><div></div></aside>',
                  target: ['.css-8kwxkl[aria-label="Hide Lazy loaded ref stories"] > aside'],
                },
                {
                  html: '<aside class="css-1s0lzul"><div></div></aside>',
                  target: ['.css-9whvue[aria-label="Hide Basic ref stories"] > aside'],
                },
                {
                  html: '<aside class="css-1s0lzul"><div></div></aside>',
                  target: ['.css-9whvue[aria-label="Hide Not ready stories"] > aside'],
                },
                {
                  html: '<aside class="css-1s0lzul"><div></div></aside>',
                  target: ['.css-9whvue[aria-label="Hide Unknown ref stories"] > aside'],
                },
                {
                  html: '<aside class="css-1s0lzul"><div></div></aside>',
                  target: ['.css-9whvue[aria-label="Hide Lazy loaded ref stories"] > aside'],
                },
              ],
              impact: 'moderate',
              message:
                'The landmark must have a unique aria-label, aria-labelledby, or title to make landmarks distinguishable',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: 'moderate',
          html: '<aside class="css-1s0lzul"><div></div></aside>',
          target: ['.css-8kwxkl[aria-label="Hide Basic ref stories"] > aside'],
          failureSummary:
            'Fix any of the following:\n  The landmark must have a unique aria-label, aria-labelledby, or title to make landmarks distinguishable',
        },
      ],
    },
  ],
} as any;
