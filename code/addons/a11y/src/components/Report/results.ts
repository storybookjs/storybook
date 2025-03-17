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
          html: '<button tabindex="-1" id="root-1-child-a2" aria-controls="root-1-child-a2--grandchild-a1-1" aria-expanded="true" class="css-154pbrb">',
          target: [
            '.css-ohbggj > .css-ld0a14[data-item-id="root-1-child-a2"][data-parent-id="root-1"] > .css-154pbrb',
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
            '.css-ohbggj > .css-1ikkmhb.sidebar-subheading[data-item-id="root-3"] > .css-h7e28b[type="button"][data-action="collapse-root"]',
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
            '.css-ohbggj > .css-1ikkmhb.sidebar-subheading[data-item-id="root-3"] > .sidebar-subheading-action.css-18rvurk[aria-label="Collapse"]',
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
          html: '<button tabindex="-1" id="root-3-child-a2" aria-controls="root-3-child-a2--grandchild-a1-1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-ohbggj > .css-ld0a14[data-item-id="root-3-child-a2"][data-parent-id="root-3"] > .css-154pbrb',
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
          html: '<button tabindex="-1" id="basic_root-1" aria-controls="root-1-child-a1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-ocnlra > div > div[data-highlighted-ref-id="storybook_internal"] > .css-1d0gimt[data-title="Basic ref"] > .css-159egyp > div[data-ref-id="basic"][data-item-id="root-1"][data-nodetype="group"] > .css-154pbrb[aria-controls="root-1-child-a1"]',
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
          html: '<button tabindex="-1" id="basic_group-1" aria-controls="group-1--child-b1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-ld0a14[data-ref-id="basic"][data-item-id="group-1"] > .css-154pbrb[aria-controls="group-1--child-b1"]',
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
          html: '<button tabindex="-1" id="lazy_group-1" aria-controls="group-1--child-b1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-159egyp > .css-ld0a14[data-item-id="group-1"][data-nodetype="group"] > .css-154pbrb[aria-controls="group-1--child-b1"]',
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
            '.css-159egyp > .css-1ikkmhb.sidebar-subheading[data-item-id="root-1"] > .css-h7e28b[type="button"][data-action="collapse-root"]',
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
            '.css-159egyp > .css-1ikkmhb.sidebar-subheading[data-item-id="root-1"] > .sidebar-subheading-action.css-18rvurk[aria-label="Collapse"]',
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
          html: '<button tabindex="-1" id="lazy_root-1-child-a1" aria-expanded="false" class="css-1vdojxu"><div class="css-99l9qv"><svg viewBox="0 0 14 14" width="12" height="12" type="component" class="css-1e3avu6"><use xlink:href="#icon--component"></use></svg></div>Child A1</button>',
          target: [
            '.css-159egyp > .css-ld0a14[data-item-id="root-1-child-a1"][data-parent-id="root-1"] > .css-1vdojxu',
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
          html: '<button tabindex="-1" id="lazy_root-1-child-a2" aria-controls="root-1-child-a2--grandchild-a1-1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-159egyp > .css-ld0a14[data-item-id="root-1-child-a2"][data-parent-id="root-1"] > .css-154pbrb',
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
            '.css-159egyp > .css-1ikkmhb.sidebar-subheading[data-item-id="root-3"] > .css-h7e28b[type="button"][data-action="collapse-root"]',
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
            '.css-159egyp > .css-1ikkmhb.sidebar-subheading[data-item-id="root-3"] > .sidebar-subheading-action.css-18rvurk[aria-label="Collapse"]',
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
          html: '<button tabindex="-1" id="lazy_root-3-child-a2" aria-controls="root-3-child-a2--grandchild-a1-1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-159egyp > .css-ld0a14[data-item-id="root-3-child-a2"][data-parent-id="root-3"] > .css-154pbrb',
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
          html: '<button tabindex="-1" id="group-1" aria-controls="group-1--child-b1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-ohbggj > .css-qyeqia[data-item-id="group-1"][data-nodetype="group"] > .css-154pbrb[aria-controls="group-1--child-b1"]',
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
            '.css-ohbggj > .css-170ite8.sidebar-subheading[data-item-id="root-1"] > .css-h7e28b[type="button"][data-action="collapse-root"]',
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
            '.css-ohbggj > .css-170ite8.sidebar-subheading[data-item-id="root-1"] > .sidebar-subheading-action.css-18rvurk[aria-label="Collapse"]',
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
            '.css-ohbggj > .css-qyeqia[data-item-id="root-1-child-a1"][data-parent-id="root-1"] > .css-1vdojxu',
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
          html: '<button tabindex="-1" id="root-1-child-a2" aria-controls="root-1-child-a2--grandchild-a1-1" aria-expanded="true" class="css-154pbrb">',
          target: [
            '.css-ohbggj > .css-qyeqia[data-item-id="root-1-child-a2"][data-parent-id="root-1"] > .css-154pbrb',
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
            '.css-ohbggj > .css-170ite8.sidebar-subheading[data-item-id="root-3"] > .css-h7e28b[type="button"][data-action="collapse-root"]',
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
            '.css-ohbggj > .css-170ite8.sidebar-subheading[data-item-id="root-3"] > .sidebar-subheading-action.css-18rvurk[aria-label="Collapse"]',
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
          html: '<button tabindex="-1" id="root-3-child-a2" aria-controls="root-3-child-a2--grandchild-a1-1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-ohbggj > .css-qyeqia[data-item-id="root-3-child-a2"][data-parent-id="root-3"] > .css-154pbrb',
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
          html: '<button tabindex="-1" id="basic_root-1" aria-controls="root-1-child-a1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-1x6s7u8 > div > div[data-highlighted-ref-id="storybook_internal"] > .css-1d0gimt[data-title="Basic ref"] > .css-159egyp > div[data-ref-id="basic"][data-item-id="root-1"][data-nodetype="group"] > .css-154pbrb[aria-controls="root-1-child-a1"]',
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
          html: '<button tabindex="-1" id="basic_group-1" aria-controls="group-1--child-b1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-qyeqia[data-ref-id="basic"][data-item-id="group-1"] > .css-154pbrb[aria-controls="group-1--child-b1"]',
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
          html: '<button tabindex="-1" id="lazy_group-1" aria-controls="group-1--child-b1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-159egyp > .css-qyeqia[data-item-id="group-1"][data-nodetype="group"] > .css-154pbrb[aria-controls="group-1--child-b1"]',
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
            '.css-159egyp > .css-170ite8.sidebar-subheading[data-item-id="root-1"] > .css-h7e28b[type="button"][data-action="collapse-root"]',
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
            '.css-159egyp > .css-170ite8.sidebar-subheading[data-item-id="root-1"] > .sidebar-subheading-action.css-18rvurk[aria-label="Collapse"]',
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
          html: '<button tabindex="-1" id="lazy_root-1-child-a1" aria-expanded="false" class="css-1vdojxu"><div class="css-99l9qv"><svg viewBox="0 0 14 14" width="12" height="12" type="component" class="css-1e3avu6"><use xlink:href="#icon--component"></use></svg></div>Child A1</button>',
          target: [
            '.css-159egyp > .css-qyeqia[data-item-id="root-1-child-a1"][data-parent-id="root-1"] > .css-1vdojxu',
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
          html: '<button tabindex="-1" id="lazy_root-1-child-a2" aria-controls="root-1-child-a2--grandchild-a1-1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-159egyp > .css-qyeqia[data-item-id="root-1-child-a2"][data-parent-id="root-1"] > .css-154pbrb',
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
            '.css-159egyp > .css-170ite8.sidebar-subheading[data-item-id="root-3"] > .css-h7e28b[type="button"][data-action="collapse-root"]',
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
            '.css-159egyp > .css-170ite8.sidebar-subheading[data-item-id="root-3"] > .sidebar-subheading-action.css-18rvurk[aria-label="Collapse"]',
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
          html: '<button tabindex="-1" id="lazy_root-3-child-a2" aria-controls="root-3-child-a2--grandchild-a1-1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-159egyp > .css-qyeqia[data-item-id="root-3-child-a2"][data-parent-id="root-3"] > .css-154pbrb',
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
          html: '<button tabindex="-1" id="root-1-child-a2" aria-controls="root-1-child-a2--grandchild-a1-1" aria-expanded="true" class="css-154pbrb">',
          target: [
            '.css-ohbggj > .css-ld0a14[data-item-id="root-1-child-a2"][data-parent-id="root-1"] > .css-154pbrb',
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
            '.css-ohbggj > .css-1ikkmhb.sidebar-subheading[data-item-id="root-3"] > .css-h7e28b[type="button"][data-action="collapse-root"]',
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
            '.css-ohbggj > .css-1ikkmhb.sidebar-subheading[data-item-id="root-3"] > .sidebar-subheading-action.css-18rvurk[aria-label="Collapse"]',
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
          html: '<button tabindex="-1" id="root-3-child-a2" aria-controls="root-3-child-a2--grandchild-a1-1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-ohbggj > .css-ld0a14[data-item-id="root-3-child-a2"][data-parent-id="root-3"] > .css-154pbrb',
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
          html: '<div aria-label="Hide Basic ref stories" aria-expanded="true" class="css-8kwxkl">',
          target: ['.css-8kwxkl[aria-label="Hide Basic ref stories"]'],
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
          html: '<button tabindex="-1" id="basic_root-1" aria-controls="root-1-child-a1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-ocnlra > div > div[data-highlighted-ref-id="storybook_internal"] > .css-1d0gimt[data-title="Basic ref"] > .css-159egyp > div[data-ref-id="basic"][data-item-id="root-1"][data-nodetype="group"] > .css-154pbrb[aria-controls="root-1-child-a1"]',
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
          html: '<button tabindex="-1" id="basic_group-1" aria-controls="group-1--child-b1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-ld0a14[data-ref-id="basic"][data-item-id="group-1"] > .css-154pbrb[aria-controls="group-1--child-b1"]',
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
          html: '<div aria-label="Hide Not ready stories" aria-expanded="true" class="css-8kwxkl">',
          target: ['.css-8kwxkl[aria-label="Hide Not ready stories"]'],
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
          html: '<div aria-label="Hide Unknown ref stories" aria-expanded="true" class="css-8kwxkl">',
          target: ['.css-8kwxkl[aria-label="Hide Unknown ref stories"]'],
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
          html: '<div aria-label="Hide Lazy loaded ref stories" aria-expanded="true" class="css-8kwxkl">',
          target: ['.css-8kwxkl[aria-label="Hide Lazy loaded ref stories"]'],
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
          html: '<button tabindex="-1" id="lazy_group-1" aria-controls="group-1--child-b1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-159egyp > .css-ld0a14[data-item-id="group-1"][data-nodetype="group"] > .css-154pbrb[aria-controls="group-1--child-b1"]',
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
            '.css-159egyp > .css-1ikkmhb.sidebar-subheading[data-item-id="root-1"] > .css-h7e28b[type="button"][data-action="collapse-root"]',
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
            '.css-159egyp > .css-1ikkmhb.sidebar-subheading[data-item-id="root-1"] > .sidebar-subheading-action.css-18rvurk[aria-label="Collapse"]',
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
          html: '<button tabindex="-1" id="lazy_root-1-child-a1" aria-expanded="false" class="css-1vdojxu"><div class="css-99l9qv"><svg viewBox="0 0 14 14" width="12" height="12" type="component" class="css-1e3avu6"><use xlink:href="#icon--component"></use></svg></div>Child A1</button>',
          target: [
            '.css-159egyp > .css-ld0a14[data-item-id="root-1-child-a1"][data-parent-id="root-1"] > .css-1vdojxu',
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
          html: '<button tabindex="-1" id="lazy_root-1-child-a2" aria-controls="root-1-child-a2--grandchild-a1-1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-159egyp > .css-ld0a14[data-item-id="root-1-child-a2"][data-parent-id="root-1"] > .css-154pbrb',
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
            '.css-159egyp > .css-1ikkmhb.sidebar-subheading[data-item-id="root-3"] > .css-h7e28b[type="button"][data-action="collapse-root"]',
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
            '.css-159egyp > .css-1ikkmhb.sidebar-subheading[data-item-id="root-3"] > .sidebar-subheading-action.css-18rvurk[aria-label="Collapse"]',
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
          html: '<button tabindex="-1" id="lazy_root-3-child-a2" aria-controls="root-3-child-a2--grandchild-a1-1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-159egyp > .css-ld0a14[data-item-id="root-3-child-a2"][data-parent-id="root-3"] > .css-154pbrb',
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
          html: '<button tabindex="-1" id="group-1" aria-controls="group-1--child-b1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-ohbggj > .css-qyeqia[data-item-id="group-1"][data-nodetype="group"] > .css-154pbrb[aria-controls="group-1--child-b1"]',
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
            '.css-ohbggj > .css-170ite8.sidebar-subheading[data-item-id="root-1"] > .css-h7e28b[type="button"][data-action="collapse-root"]',
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
            '.css-ohbggj > .css-170ite8.sidebar-subheading[data-item-id="root-1"] > .sidebar-subheading-action.css-18rvurk[aria-label="Collapse"]',
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
            '.css-ohbggj > .css-qyeqia[data-item-id="root-1-child-a1"][data-parent-id="root-1"] > .css-1vdojxu',
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
          html: '<button tabindex="-1" id="root-1-child-a2" aria-controls="root-1-child-a2--grandchild-a1-1" aria-expanded="true" class="css-154pbrb">',
          target: [
            '.css-ohbggj > .css-qyeqia[data-item-id="root-1-child-a2"][data-parent-id="root-1"] > .css-154pbrb',
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
            '.css-ohbggj > .css-170ite8.sidebar-subheading[data-item-id="root-3"] > .css-h7e28b[type="button"][data-action="collapse-root"]',
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
            '.css-ohbggj > .css-170ite8.sidebar-subheading[data-item-id="root-3"] > .sidebar-subheading-action.css-18rvurk[aria-label="Collapse"]',
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
          html: '<button tabindex="-1" id="root-3-child-a2" aria-controls="root-3-child-a2--grandchild-a1-1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-ohbggj > .css-qyeqia[data-item-id="root-3-child-a2"][data-parent-id="root-3"] > .css-154pbrb',
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
          html: '<div aria-label="Hide Basic ref stories" aria-expanded="true" class="css-9whvue">',
          target: ['.css-9whvue[aria-label="Hide Basic ref stories"]'],
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
          html: '<button tabindex="-1" id="basic_root-1" aria-controls="root-1-child-a1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-1x6s7u8 > div > div[data-highlighted-ref-id="storybook_internal"] > .css-1d0gimt[data-title="Basic ref"] > .css-159egyp > div[data-ref-id="basic"][data-item-id="root-1"][data-nodetype="group"] > .css-154pbrb[aria-controls="root-1-child-a1"]',
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
          html: '<button tabindex="-1" id="basic_group-1" aria-controls="group-1--child-b1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-qyeqia[data-ref-id="basic"][data-item-id="group-1"] > .css-154pbrb[aria-controls="group-1--child-b1"]',
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
          html: '<div aria-label="Hide Not ready stories" aria-expanded="true" class="css-9whvue">',
          target: ['.css-9whvue[aria-label="Hide Not ready stories"]'],
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
          html: '<div aria-label="Hide Unknown ref stories" aria-expanded="true" class="css-9whvue">',
          target: ['.css-9whvue[aria-label="Hide Unknown ref stories"]'],
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
          html: '<div aria-label="Hide Lazy loaded ref stories" aria-expanded="true" class="css-9whvue">',
          target: ['.css-9whvue[aria-label="Hide Lazy loaded ref stories"]'],
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
          html: '<button tabindex="-1" id="lazy_group-1" aria-controls="group-1--child-b1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-159egyp > .css-qyeqia[data-item-id="group-1"][data-nodetype="group"] > .css-154pbrb[aria-controls="group-1--child-b1"]',
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
            '.css-159egyp > .css-170ite8.sidebar-subheading[data-item-id="root-1"] > .css-h7e28b[type="button"][data-action="collapse-root"]',
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
            '.css-159egyp > .css-170ite8.sidebar-subheading[data-item-id="root-1"] > .sidebar-subheading-action.css-18rvurk[aria-label="Collapse"]',
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
          html: '<button tabindex="-1" id="lazy_root-1-child-a1" aria-expanded="false" class="css-1vdojxu"><div class="css-99l9qv"><svg viewBox="0 0 14 14" width="12" height="12" type="component" class="css-1e3avu6"><use xlink:href="#icon--component"></use></svg></div>Child A1</button>',
          target: [
            '.css-159egyp > .css-qyeqia[data-item-id="root-1-child-a1"][data-parent-id="root-1"] > .css-1vdojxu',
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
          html: '<button tabindex="-1" id="lazy_root-1-child-a2" aria-controls="root-1-child-a2--grandchild-a1-1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-159egyp > .css-qyeqia[data-item-id="root-1-child-a2"][data-parent-id="root-1"] > .css-154pbrb',
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
            '.css-159egyp > .css-170ite8.sidebar-subheading[data-item-id="root-3"] > .css-h7e28b[type="button"][data-action="collapse-root"]',
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
            '.css-159egyp > .css-170ite8.sidebar-subheading[data-item-id="root-3"] > .sidebar-subheading-action.css-18rvurk[aria-label="Collapse"]',
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
          html: '<button tabindex="-1" id="lazy_root-3-child-a2" aria-controls="root-3-child-a2--grandchild-a1-1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-159egyp > .css-qyeqia[data-item-id="root-3-child-a2"][data-parent-id="root-3"] > .css-154pbrb',
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
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'ARIA attribute is allowed',
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
          all: [],
          none: [
            {
              id: 'aria-prohibited-attr',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'ARIA attribute is allowed',
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
          all: [],
          none: [
            {
              id: 'aria-prohibited-attr',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'ARIA attribute is allowed',
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
          all: [],
          none: [
            {
              id: 'aria-prohibited-attr',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'ARIA attribute is allowed',
              '_constructor-name_': 'CheckResult',
            },
          ],
          impact: null,
          html: '<button tabindex="-1" id="root-1-child-a1" aria-expanded="false" class="css-1vdojxu"><div class="css-99l9qv"><svg viewBox="0 0 14 14" width="12" height="12" type="component" class="css-1e3avu6"><use xlink:href="#icon--component"></use></svg></div>Child A1</button>',
          target: [
            '.css-ohbggj > .css-ld0a14[data-item-id="root-1-child-a1"][data-parent-id="root-1"] > .css-1vdojxu',
          ],
        },
        {
          any: [],
          all: [],
          none: [
            {
              id: 'aria-prohibited-attr',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'ARIA attribute is allowed',
              '_constructor-name_': 'CheckResult',
            },
          ],
          impact: null,
          html: '<button tabindex="-1" id="root-1-child-a2" aria-controls="root-1-child-a2--grandchild-a1-1" aria-expanded="true" class="css-154pbrb">',
          target: [
            '.css-ohbggj > .css-ld0a14[data-item-id="root-1-child-a2"][data-parent-id="root-1"] > .css-154pbrb',
          ],
        },
        {
          any: [],
          all: [],
          none: [
            {
              id: 'aria-prohibited-attr',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'ARIA attribute is allowed',
              '_constructor-name_': 'CheckResult',
            },
          ],
          impact: null,
          html: '<button type="button" data-action="collapse-root" aria-expanded="true" class="css-h7e28b">',
          target: [
            '.css-ohbggj > .css-1ikkmhb.sidebar-subheading[data-item-id="root-3"] > .css-h7e28b[type="button"][data-action="collapse-root"]',
          ],
        },
        {
          any: [],
          all: [],
          none: [
            {
              id: 'aria-prohibited-attr',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'ARIA attribute is allowed',
              '_constructor-name_': 'CheckResult',
            },
          ],
          impact: null,
          html: '<button class="sidebar-subheading-action css-18rvurk" aria-label="Collapse" data-action="expand-all" data-expanded="false">',
          target: [
            '.css-ohbggj > .css-1ikkmhb.sidebar-subheading[data-item-id="root-3"] > .sidebar-subheading-action.css-18rvurk[aria-label="Collapse"]',
          ],
        },
        {
          any: [],
          all: [],
          none: [
            {
              id: 'aria-prohibited-attr',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'ARIA attribute is allowed',
              '_constructor-name_': 'CheckResult',
            },
          ],
          impact: null,
          html: '<button tabindex="-1" id="root-3-child-a2" aria-controls="root-3-child-a2--grandchild-a1-1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-ohbggj > .css-ld0a14[data-item-id="root-3-child-a2"][data-parent-id="root-3"] > .css-154pbrb',
          ],
        },
        {
          any: [],
          all: [],
          none: [
            {
              id: 'aria-prohibited-attr',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'ARIA attribute is allowed',
              '_constructor-name_': 'CheckResult',
            },
          ],
          impact: null,
          html: '<button tabindex="-1" id="basic_root-1" aria-controls="root-1-child-a1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-ocnlra > div > div[data-highlighted-ref-id="storybook_internal"] > .css-1d0gimt[data-title="Basic ref"] > .css-159egyp > div[data-ref-id="basic"][data-item-id="root-1"][data-nodetype="group"] > .css-154pbrb[aria-controls="root-1-child-a1"]',
          ],
        },
        {
          any: [],
          all: [],
          none: [
            {
              id: 'aria-prohibited-attr',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'ARIA attribute is allowed',
              '_constructor-name_': 'CheckResult',
            },
          ],
          impact: null,
          html: '<button tabindex="-1" id="basic_group-1" aria-controls="group-1--child-b1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-ld0a14[data-ref-id="basic"][data-item-id="group-1"] > .css-154pbrb[aria-controls="group-1--child-b1"]',
          ],
        },
        {
          any: [],
          all: [],
          none: [
            {
              id: 'aria-prohibited-attr',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'ARIA attribute is allowed',
              '_constructor-name_': 'CheckResult',
            },
          ],
          impact: null,
          html: '<button tabindex="-1" id="lazy_group-1" aria-controls="group-1--child-b1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-159egyp > .css-ld0a14[data-item-id="group-1"][data-nodetype="group"] > .css-154pbrb[aria-controls="group-1--child-b1"]',
          ],
        },
        {
          any: [],
          all: [],
          none: [
            {
              id: 'aria-prohibited-attr',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'ARIA attribute is allowed',
              '_constructor-name_': 'CheckResult',
            },
          ],
          impact: null,
          html: '<button type="button" data-action="collapse-root" aria-expanded="true" class="css-h7e28b">',
          target: [
            '.css-159egyp > .css-1ikkmhb.sidebar-subheading[data-item-id="root-1"] > .css-h7e28b[type="button"][data-action="collapse-root"]',
          ],
        },
        {
          any: [],
          all: [],
          none: [
            {
              id: 'aria-prohibited-attr',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'ARIA attribute is allowed',
              '_constructor-name_': 'CheckResult',
            },
          ],
          impact: null,
          html: '<button class="sidebar-subheading-action css-18rvurk" aria-label="Collapse" data-action="expand-all" data-expanded="false">',
          target: [
            '.css-159egyp > .css-1ikkmhb.sidebar-subheading[data-item-id="root-1"] > .sidebar-subheading-action.css-18rvurk[aria-label="Collapse"]',
          ],
        },
        {
          any: [],
          all: [],
          none: [
            {
              id: 'aria-prohibited-attr',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'ARIA attribute is allowed',
              '_constructor-name_': 'CheckResult',
            },
          ],
          impact: null,
          html: '<button tabindex="-1" id="lazy_root-1-child-a1" aria-expanded="false" class="css-1vdojxu"><div class="css-99l9qv"><svg viewBox="0 0 14 14" width="12" height="12" type="component" class="css-1e3avu6"><use xlink:href="#icon--component"></use></svg></div>Child A1</button>',
          target: [
            '.css-159egyp > .css-ld0a14[data-item-id="root-1-child-a1"][data-parent-id="root-1"] > .css-1vdojxu',
          ],
        },
        {
          any: [],
          all: [],
          none: [
            {
              id: 'aria-prohibited-attr',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'ARIA attribute is allowed',
              '_constructor-name_': 'CheckResult',
            },
          ],
          impact: null,
          html: '<button tabindex="-1" id="lazy_root-1-child-a2" aria-controls="root-1-child-a2--grandchild-a1-1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-159egyp > .css-ld0a14[data-item-id="root-1-child-a2"][data-parent-id="root-1"] > .css-154pbrb',
          ],
        },
        {
          any: [],
          all: [],
          none: [
            {
              id: 'aria-prohibited-attr',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'ARIA attribute is allowed',
              '_constructor-name_': 'CheckResult',
            },
          ],
          impact: null,
          html: '<button type="button" data-action="collapse-root" aria-expanded="true" class="css-h7e28b">',
          target: [
            '.css-159egyp > .css-1ikkmhb.sidebar-subheading[data-item-id="root-3"] > .css-h7e28b[type="button"][data-action="collapse-root"]',
          ],
        },
        {
          any: [],
          all: [],
          none: [
            {
              id: 'aria-prohibited-attr',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'ARIA attribute is allowed',
              '_constructor-name_': 'CheckResult',
            },
          ],
          impact: null,
          html: '<button class="sidebar-subheading-action css-18rvurk" aria-label="Collapse" data-action="expand-all" data-expanded="false">',
          target: [
            '.css-159egyp > .css-1ikkmhb.sidebar-subheading[data-item-id="root-3"] > .sidebar-subheading-action.css-18rvurk[aria-label="Collapse"]',
          ],
        },
        {
          any: [],
          all: [],
          none: [
            {
              id: 'aria-prohibited-attr',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'ARIA attribute is allowed',
              '_constructor-name_': 'CheckResult',
            },
          ],
          impact: null,
          html: '<button tabindex="-1" id="lazy_root-3-child-a2" aria-controls="root-3-child-a2--grandchild-a1-1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-159egyp > .css-ld0a14[data-item-id="root-3-child-a2"][data-parent-id="root-3"] > .css-154pbrb',
          ],
        },
        {
          any: [],
          all: [],
          none: [
            {
              id: 'aria-prohibited-attr',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'ARIA attribute is allowed',
              '_constructor-name_': 'CheckResult',
            },
          ],
          impact: null,
          html: '<button tabindex="-1" id="group-1" aria-controls="group-1--child-b1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-ohbggj > .css-qyeqia[data-item-id="group-1"][data-nodetype="group"] > .css-154pbrb[aria-controls="group-1--child-b1"]',
          ],
        },
        {
          any: [],
          all: [],
          none: [
            {
              id: 'aria-prohibited-attr',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'ARIA attribute is allowed',
              '_constructor-name_': 'CheckResult',
            },
          ],
          impact: null,
          html: '<button type="button" data-action="collapse-root" aria-expanded="true" class="css-h7e28b">',
          target: [
            '.css-ohbggj > .css-170ite8.sidebar-subheading[data-item-id="root-1"] > .css-h7e28b[type="button"][data-action="collapse-root"]',
          ],
        },
        {
          any: [],
          all: [],
          none: [
            {
              id: 'aria-prohibited-attr',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'ARIA attribute is allowed',
              '_constructor-name_': 'CheckResult',
            },
          ],
          impact: null,
          html: '<button class="sidebar-subheading-action css-18rvurk" aria-label="Collapse" data-action="expand-all" data-expanded="false">',
          target: [
            '.css-ohbggj > .css-170ite8.sidebar-subheading[data-item-id="root-1"] > .sidebar-subheading-action.css-18rvurk[aria-label="Collapse"]',
          ],
        },
        {
          any: [],
          all: [],
          none: [
            {
              id: 'aria-prohibited-attr',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'ARIA attribute is allowed',
              '_constructor-name_': 'CheckResult',
            },
          ],
          impact: null,
          html: '<button tabindex="-1" id="root-1-child-a1" aria-expanded="false" class="css-1vdojxu"><div class="css-99l9qv"><svg viewBox="0 0 14 14" width="12" height="12" type="component" class="css-1e3avu6"><use xlink:href="#icon--component"></use></svg></div>Child A1</button>',
          target: [
            '.css-ohbggj > .css-qyeqia[data-item-id="root-1-child-a1"][data-parent-id="root-1"] > .css-1vdojxu',
          ],
        },
        {
          any: [],
          all: [],
          none: [
            {
              id: 'aria-prohibited-attr',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'ARIA attribute is allowed',
              '_constructor-name_': 'CheckResult',
            },
          ],
          impact: null,
          html: '<button tabindex="-1" id="root-1-child-a2" aria-controls="root-1-child-a2--grandchild-a1-1" aria-expanded="true" class="css-154pbrb">',
          target: [
            '.css-ohbggj > .css-qyeqia[data-item-id="root-1-child-a2"][data-parent-id="root-1"] > .css-154pbrb',
          ],
        },
        {
          any: [],
          all: [],
          none: [
            {
              id: 'aria-prohibited-attr',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'ARIA attribute is allowed',
              '_constructor-name_': 'CheckResult',
            },
          ],
          impact: null,
          html: '<button type="button" data-action="collapse-root" aria-expanded="true" class="css-h7e28b">',
          target: [
            '.css-ohbggj > .css-170ite8.sidebar-subheading[data-item-id="root-3"] > .css-h7e28b[type="button"][data-action="collapse-root"]',
          ],
        },
        {
          any: [],
          all: [],
          none: [
            {
              id: 'aria-prohibited-attr',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'ARIA attribute is allowed',
              '_constructor-name_': 'CheckResult',
            },
          ],
          impact: null,
          html: '<button class="sidebar-subheading-action css-18rvurk" aria-label="Collapse" data-action="expand-all" data-expanded="false">',
          target: [
            '.css-ohbggj > .css-170ite8.sidebar-subheading[data-item-id="root-3"] > .sidebar-subheading-action.css-18rvurk[aria-label="Collapse"]',
          ],
        },
        {
          any: [],
          all: [],
          none: [
            {
              id: 'aria-prohibited-attr',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'ARIA attribute is allowed',
              '_constructor-name_': 'CheckResult',
            },
          ],
          impact: null,
          html: '<button tabindex="-1" id="root-3-child-a2" aria-controls="root-3-child-a2--grandchild-a1-1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-ohbggj > .css-qyeqia[data-item-id="root-3-child-a2"][data-parent-id="root-3"] > .css-154pbrb',
          ],
        },
        {
          any: [],
          all: [],
          none: [
            {
              id: 'aria-prohibited-attr',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'ARIA attribute is allowed',
              '_constructor-name_': 'CheckResult',
            },
          ],
          impact: null,
          html: '<button tabindex="-1" id="basic_root-1" aria-controls="root-1-child-a1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-1x6s7u8 > div > div[data-highlighted-ref-id="storybook_internal"] > .css-1d0gimt[data-title="Basic ref"] > .css-159egyp > div[data-ref-id="basic"][data-item-id="root-1"][data-nodetype="group"] > .css-154pbrb[aria-controls="root-1-child-a1"]',
          ],
        },
        {
          any: [],
          all: [],
          none: [
            {
              id: 'aria-prohibited-attr',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'ARIA attribute is allowed',
              '_constructor-name_': 'CheckResult',
            },
          ],
          impact: null,
          html: '<button tabindex="-1" id="basic_group-1" aria-controls="group-1--child-b1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-qyeqia[data-ref-id="basic"][data-item-id="group-1"] > .css-154pbrb[aria-controls="group-1--child-b1"]',
          ],
        },
        {
          any: [],
          all: [],
          none: [
            {
              id: 'aria-prohibited-attr',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'ARIA attribute is allowed',
              '_constructor-name_': 'CheckResult',
            },
          ],
          impact: null,
          html: '<button tabindex="-1" id="lazy_group-1" aria-controls="group-1--child-b1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-159egyp > .css-qyeqia[data-item-id="group-1"][data-nodetype="group"] > .css-154pbrb[aria-controls="group-1--child-b1"]',
          ],
        },
        {
          any: [],
          all: [],
          none: [
            {
              id: 'aria-prohibited-attr',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'ARIA attribute is allowed',
              '_constructor-name_': 'CheckResult',
            },
          ],
          impact: null,
          html: '<button type="button" data-action="collapse-root" aria-expanded="true" class="css-h7e28b">',
          target: [
            '.css-159egyp > .css-170ite8.sidebar-subheading[data-item-id="root-1"] > .css-h7e28b[type="button"][data-action="collapse-root"]',
          ],
        },
        {
          any: [],
          all: [],
          none: [
            {
              id: 'aria-prohibited-attr',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'ARIA attribute is allowed',
              '_constructor-name_': 'CheckResult',
            },
          ],
          impact: null,
          html: '<button class="sidebar-subheading-action css-18rvurk" aria-label="Collapse" data-action="expand-all" data-expanded="false">',
          target: [
            '.css-159egyp > .css-170ite8.sidebar-subheading[data-item-id="root-1"] > .sidebar-subheading-action.css-18rvurk[aria-label="Collapse"]',
          ],
        },
        {
          any: [],
          all: [],
          none: [
            {
              id: 'aria-prohibited-attr',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'ARIA attribute is allowed',
              '_constructor-name_': 'CheckResult',
            },
          ],
          impact: null,
          html: '<button tabindex="-1" id="lazy_root-1-child-a1" aria-expanded="false" class="css-1vdojxu"><div class="css-99l9qv"><svg viewBox="0 0 14 14" width="12" height="12" type="component" class="css-1e3avu6"><use xlink:href="#icon--component"></use></svg></div>Child A1</button>',
          target: [
            '.css-159egyp > .css-qyeqia[data-item-id="root-1-child-a1"][data-parent-id="root-1"] > .css-1vdojxu',
          ],
        },
        {
          any: [],
          all: [],
          none: [
            {
              id: 'aria-prohibited-attr',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'ARIA attribute is allowed',
              '_constructor-name_': 'CheckResult',
            },
          ],
          impact: null,
          html: '<button tabindex="-1" id="lazy_root-1-child-a2" aria-controls="root-1-child-a2--grandchild-a1-1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-159egyp > .css-qyeqia[data-item-id="root-1-child-a2"][data-parent-id="root-1"] > .css-154pbrb',
          ],
        },
        {
          any: [],
          all: [],
          none: [
            {
              id: 'aria-prohibited-attr',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'ARIA attribute is allowed',
              '_constructor-name_': 'CheckResult',
            },
          ],
          impact: null,
          html: '<button type="button" data-action="collapse-root" aria-expanded="true" class="css-h7e28b">',
          target: [
            '.css-159egyp > .css-170ite8.sidebar-subheading[data-item-id="root-3"] > .css-h7e28b[type="button"][data-action="collapse-root"]',
          ],
        },
        {
          any: [],
          all: [],
          none: [
            {
              id: 'aria-prohibited-attr',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'ARIA attribute is allowed',
              '_constructor-name_': 'CheckResult',
            },
          ],
          impact: null,
          html: '<button class="sidebar-subheading-action css-18rvurk" aria-label="Collapse" data-action="expand-all" data-expanded="false">',
          target: [
            '.css-159egyp > .css-170ite8.sidebar-subheading[data-item-id="root-3"] > .sidebar-subheading-action.css-18rvurk[aria-label="Collapse"]',
          ],
        },
        {
          any: [],
          all: [],
          none: [
            {
              id: 'aria-prohibited-attr',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'ARIA attribute is allowed',
              '_constructor-name_': 'CheckResult',
            },
          ],
          impact: null,
          html: '<button tabindex="-1" id="lazy_root-3-child-a2" aria-controls="root-3-child-a2--grandchild-a1-1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-159egyp > .css-qyeqia[data-item-id="root-3-child-a2"][data-parent-id="root-3"] > .css-154pbrb',
          ],
        },
      ],
    },
    {
      id: 'aria-valid-attr-value',
      impact: null,
      tags: ['cat.aria', 'wcag2a', 'wcag412', 'EN-301-549', 'EN-9.4.1.2'],
      description: 'Ensure all ARIA attributes have valid values',
      help: 'ARIA attributes must conform to valid values',
      helpUrl:
        'https://dequeuniversity.com/rules/axe/4.10/aria-valid-attr-value?application=axeAPI',
      nodes: [
        {
          any: [],
          all: [
            {
              id: 'aria-valid-attr-value',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute values are valid',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-errormessage',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message:
                'aria-errormessage exists and references elements visible to screen readers that use a supported aria-errormessage technique',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-level',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'aria-level values are valid',
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
              id: 'aria-valid-attr-value',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute values are valid',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-errormessage',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message:
                'aria-errormessage exists and references elements visible to screen readers that use a supported aria-errormessage technique',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-level',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'aria-level values are valid',
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
              id: 'aria-valid-attr-value',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute values are valid',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-errormessage',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message:
                'aria-errormessage exists and references elements visible to screen readers that use a supported aria-errormessage technique',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-level',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'aria-level values are valid',
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
              id: 'aria-valid-attr-value',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute values are valid',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-errormessage',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message:
                'aria-errormessage exists and references elements visible to screen readers that use a supported aria-errormessage technique',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-level',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'aria-level values are valid',
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
        {
          any: [],
          all: [
            {
              id: 'aria-valid-attr-value',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute values are valid',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-errormessage',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message:
                'aria-errormessage exists and references elements visible to screen readers that use a supported aria-errormessage technique',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-level',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'aria-level values are valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="root-1-child-a2" aria-controls="root-1-child-a2--grandchild-a1-1" aria-expanded="true" class="css-154pbrb">',
          target: [
            '.css-ohbggj > .css-ld0a14[data-item-id="root-1-child-a2"][data-parent-id="root-1"] > .css-154pbrb',
          ],
        },
        {
          any: [],
          all: [
            {
              id: 'aria-valid-attr-value',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute values are valid',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-errormessage',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message:
                'aria-errormessage exists and references elements visible to screen readers that use a supported aria-errormessage technique',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-level',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'aria-level values are valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          none: [],
          impact: null,
          html: '<button type="button" data-action="collapse-root" aria-expanded="true" class="css-h7e28b">',
          target: [
            '.css-ohbggj > .css-1ikkmhb.sidebar-subheading[data-item-id="root-3"] > .css-h7e28b[type="button"][data-action="collapse-root"]',
          ],
        },
        {
          any: [],
          all: [
            {
              id: 'aria-valid-attr-value',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute values are valid',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-errormessage',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message:
                'aria-errormessage exists and references elements visible to screen readers that use a supported aria-errormessage technique',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-level',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'aria-level values are valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          none: [],
          impact: null,
          html: '<button class="sidebar-subheading-action css-18rvurk" aria-label="Collapse" data-action="expand-all" data-expanded="false">',
          target: [
            '.css-ohbggj > .css-1ikkmhb.sidebar-subheading[data-item-id="root-3"] > .sidebar-subheading-action.css-18rvurk[aria-label="Collapse"]',
          ],
        },
        {
          any: [],
          all: [
            {
              id: 'aria-valid-attr-value',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute values are valid',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-errormessage',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message:
                'aria-errormessage exists and references elements visible to screen readers that use a supported aria-errormessage technique',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-level',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'aria-level values are valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="root-3-child-a2" aria-controls="root-3-child-a2--grandchild-a1-1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-ohbggj > .css-ld0a14[data-item-id="root-3-child-a2"][data-parent-id="root-3"] > .css-154pbrb',
          ],
        },
        {
          any: [],
          all: [
            {
              id: 'aria-valid-attr-value',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute values are valid',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-errormessage',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message:
                'aria-errormessage exists and references elements visible to screen readers that use a supported aria-errormessage technique',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-level',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'aria-level values are valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          none: [],
          impact: null,
          html: '<div aria-label="Hide Basic ref stories" aria-expanded="true" class="css-8kwxkl">',
          target: ['.css-8kwxkl[aria-label="Hide Basic ref stories"]'],
        },
        {
          any: [],
          all: [
            {
              id: 'aria-valid-attr-value',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute values are valid',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-errormessage',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message:
                'aria-errormessage exists and references elements visible to screen readers that use a supported aria-errormessage technique',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-level',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'aria-level values are valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="basic_root-1" aria-controls="root-1-child-a1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-ocnlra > div > div[data-highlighted-ref-id="storybook_internal"] > .css-1d0gimt[data-title="Basic ref"] > .css-159egyp > div[data-ref-id="basic"][data-item-id="root-1"][data-nodetype="group"] > .css-154pbrb[aria-controls="root-1-child-a1"]',
          ],
        },
        {
          any: [],
          all: [
            {
              id: 'aria-valid-attr-value',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute values are valid',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-errormessage',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message:
                'aria-errormessage exists and references elements visible to screen readers that use a supported aria-errormessage technique',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-level',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'aria-level values are valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="basic_group-1" aria-controls="group-1--child-b1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-ld0a14[data-ref-id="basic"][data-item-id="group-1"] > .css-154pbrb[aria-controls="group-1--child-b1"]',
          ],
        },
        {
          any: [],
          all: [
            {
              id: 'aria-valid-attr-value',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute values are valid',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-errormessage',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message:
                'aria-errormessage exists and references elements visible to screen readers that use a supported aria-errormessage technique',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-level',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'aria-level values are valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          none: [],
          impact: null,
          html: '<div aria-label="Hide Not ready stories" aria-expanded="true" class="css-8kwxkl">',
          target: ['.css-8kwxkl[aria-label="Hide Not ready stories"]'],
        },
        {
          any: [],
          all: [
            {
              id: 'aria-valid-attr-value',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute values are valid',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-errormessage',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message:
                'aria-errormessage exists and references elements visible to screen readers that use a supported aria-errormessage technique',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-level',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'aria-level values are valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          none: [],
          impact: null,
          html: '<div aria-label="Hide Unknown ref stories" aria-expanded="true" class="css-8kwxkl">',
          target: ['.css-8kwxkl[aria-label="Hide Unknown ref stories"]'],
        },
        {
          any: [],
          all: [
            {
              id: 'aria-valid-attr-value',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute values are valid',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-errormessage',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message:
                'aria-errormessage exists and references elements visible to screen readers that use a supported aria-errormessage technique',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-level',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'aria-level values are valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          none: [],
          impact: null,
          html: '<div aria-label="Hide Lazy loaded ref stories" aria-expanded="true" class="css-8kwxkl">',
          target: ['.css-8kwxkl[aria-label="Hide Lazy loaded ref stories"]'],
        },
        {
          any: [],
          all: [
            {
              id: 'aria-valid-attr-value',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute values are valid',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-errormessage',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message:
                'aria-errormessage exists and references elements visible to screen readers that use a supported aria-errormessage technique',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-level',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'aria-level values are valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="lazy_group-1" aria-controls="group-1--child-b1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-159egyp > .css-ld0a14[data-item-id="group-1"][data-nodetype="group"] > .css-154pbrb[aria-controls="group-1--child-b1"]',
          ],
        },
        {
          any: [],
          all: [
            {
              id: 'aria-valid-attr-value',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute values are valid',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-errormessage',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message:
                'aria-errormessage exists and references elements visible to screen readers that use a supported aria-errormessage technique',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-level',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'aria-level values are valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          none: [],
          impact: null,
          html: '<button type="button" data-action="collapse-root" aria-expanded="true" class="css-h7e28b">',
          target: [
            '.css-159egyp > .css-1ikkmhb.sidebar-subheading[data-item-id="root-1"] > .css-h7e28b[type="button"][data-action="collapse-root"]',
          ],
        },
        {
          any: [],
          all: [
            {
              id: 'aria-valid-attr-value',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute values are valid',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-errormessage',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message:
                'aria-errormessage exists and references elements visible to screen readers that use a supported aria-errormessage technique',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-level',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'aria-level values are valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          none: [],
          impact: null,
          html: '<button class="sidebar-subheading-action css-18rvurk" aria-label="Collapse" data-action="expand-all" data-expanded="false">',
          target: [
            '.css-159egyp > .css-1ikkmhb.sidebar-subheading[data-item-id="root-1"] > .sidebar-subheading-action.css-18rvurk[aria-label="Collapse"]',
          ],
        },
        {
          any: [],
          all: [
            {
              id: 'aria-valid-attr-value',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute values are valid',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-errormessage',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message:
                'aria-errormessage exists and references elements visible to screen readers that use a supported aria-errormessage technique',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-level',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'aria-level values are valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="lazy_root-1-child-a1" aria-expanded="false" class="css-1vdojxu"><div class="css-99l9qv"><svg viewBox="0 0 14 14" width="12" height="12" type="component" class="css-1e3avu6"><use xlink:href="#icon--component"></use></svg></div>Child A1</button>',
          target: [
            '.css-159egyp > .css-ld0a14[data-item-id="root-1-child-a1"][data-parent-id="root-1"] > .css-1vdojxu',
          ],
        },
        {
          any: [],
          all: [
            {
              id: 'aria-valid-attr-value',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute values are valid',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-errormessage',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message:
                'aria-errormessage exists and references elements visible to screen readers that use a supported aria-errormessage technique',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-level',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'aria-level values are valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="lazy_root-1-child-a2" aria-controls="root-1-child-a2--grandchild-a1-1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-159egyp > .css-ld0a14[data-item-id="root-1-child-a2"][data-parent-id="root-1"] > .css-154pbrb',
          ],
        },
        {
          any: [],
          all: [
            {
              id: 'aria-valid-attr-value',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute values are valid',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-errormessage',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message:
                'aria-errormessage exists and references elements visible to screen readers that use a supported aria-errormessage technique',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-level',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'aria-level values are valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          none: [],
          impact: null,
          html: '<button type="button" data-action="collapse-root" aria-expanded="true" class="css-h7e28b">',
          target: [
            '.css-159egyp > .css-1ikkmhb.sidebar-subheading[data-item-id="root-3"] > .css-h7e28b[type="button"][data-action="collapse-root"]',
          ],
        },
        {
          any: [],
          all: [
            {
              id: 'aria-valid-attr-value',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute values are valid',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-errormessage',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message:
                'aria-errormessage exists and references elements visible to screen readers that use a supported aria-errormessage technique',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-level',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'aria-level values are valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          none: [],
          impact: null,
          html: '<button class="sidebar-subheading-action css-18rvurk" aria-label="Collapse" data-action="expand-all" data-expanded="false">',
          target: [
            '.css-159egyp > .css-1ikkmhb.sidebar-subheading[data-item-id="root-3"] > .sidebar-subheading-action.css-18rvurk[aria-label="Collapse"]',
          ],
        },
        {
          any: [],
          all: [
            {
              id: 'aria-valid-attr-value',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute values are valid',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-errormessage',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message:
                'aria-errormessage exists and references elements visible to screen readers that use a supported aria-errormessage technique',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-level',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'aria-level values are valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="lazy_root-3-child-a2" aria-controls="root-3-child-a2--grandchild-a1-1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-159egyp > .css-ld0a14[data-item-id="root-3-child-a2"][data-parent-id="root-3"] > .css-154pbrb',
          ],
        },
        {
          any: [],
          all: [
            {
              id: 'aria-valid-attr-value',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute values are valid',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-errormessage',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message:
                'aria-errormessage exists and references elements visible to screen readers that use a supported aria-errormessage technique',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-level',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'aria-level values are valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="group-1" aria-controls="group-1--child-b1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-ohbggj > .css-qyeqia[data-item-id="group-1"][data-nodetype="group"] > .css-154pbrb[aria-controls="group-1--child-b1"]',
          ],
        },
        {
          any: [],
          all: [
            {
              id: 'aria-valid-attr-value',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute values are valid',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-errormessage',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message:
                'aria-errormessage exists and references elements visible to screen readers that use a supported aria-errormessage technique',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-level',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'aria-level values are valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          none: [],
          impact: null,
          html: '<button type="button" data-action="collapse-root" aria-expanded="true" class="css-h7e28b">',
          target: [
            '.css-ohbggj > .css-170ite8.sidebar-subheading[data-item-id="root-1"] > .css-h7e28b[type="button"][data-action="collapse-root"]',
          ],
        },
        {
          any: [],
          all: [
            {
              id: 'aria-valid-attr-value',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute values are valid',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-errormessage',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message:
                'aria-errormessage exists and references elements visible to screen readers that use a supported aria-errormessage technique',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-level',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'aria-level values are valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          none: [],
          impact: null,
          html: '<button class="sidebar-subheading-action css-18rvurk" aria-label="Collapse" data-action="expand-all" data-expanded="false">',
          target: [
            '.css-ohbggj > .css-170ite8.sidebar-subheading[data-item-id="root-1"] > .sidebar-subheading-action.css-18rvurk[aria-label="Collapse"]',
          ],
        },
        {
          any: [],
          all: [
            {
              id: 'aria-valid-attr-value',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute values are valid',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-errormessage',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message:
                'aria-errormessage exists and references elements visible to screen readers that use a supported aria-errormessage technique',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-level',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'aria-level values are valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="root-1-child-a1" aria-expanded="false" class="css-1vdojxu"><div class="css-99l9qv"><svg viewBox="0 0 14 14" width="12" height="12" type="component" class="css-1e3avu6"><use xlink:href="#icon--component"></use></svg></div>Child A1</button>',
          target: [
            '.css-ohbggj > .css-qyeqia[data-item-id="root-1-child-a1"][data-parent-id="root-1"] > .css-1vdojxu',
          ],
        },
        {
          any: [],
          all: [
            {
              id: 'aria-valid-attr-value',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute values are valid',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-errormessage',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message:
                'aria-errormessage exists and references elements visible to screen readers that use a supported aria-errormessage technique',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-level',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'aria-level values are valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="root-1-child-a2" aria-controls="root-1-child-a2--grandchild-a1-1" aria-expanded="true" class="css-154pbrb">',
          target: [
            '.css-ohbggj > .css-qyeqia[data-item-id="root-1-child-a2"][data-parent-id="root-1"] > .css-154pbrb',
          ],
        },
        {
          any: [],
          all: [
            {
              id: 'aria-valid-attr-value',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute values are valid',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-errormessage',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message:
                'aria-errormessage exists and references elements visible to screen readers that use a supported aria-errormessage technique',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-level',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'aria-level values are valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          none: [],
          impact: null,
          html: '<button type="button" data-action="collapse-root" aria-expanded="true" class="css-h7e28b">',
          target: [
            '.css-ohbggj > .css-170ite8.sidebar-subheading[data-item-id="root-3"] > .css-h7e28b[type="button"][data-action="collapse-root"]',
          ],
        },
        {
          any: [],
          all: [
            {
              id: 'aria-valid-attr-value',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute values are valid',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-errormessage',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message:
                'aria-errormessage exists and references elements visible to screen readers that use a supported aria-errormessage technique',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-level',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'aria-level values are valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          none: [],
          impact: null,
          html: '<button class="sidebar-subheading-action css-18rvurk" aria-label="Collapse" data-action="expand-all" data-expanded="false">',
          target: [
            '.css-ohbggj > .css-170ite8.sidebar-subheading[data-item-id="root-3"] > .sidebar-subheading-action.css-18rvurk[aria-label="Collapse"]',
          ],
        },
        {
          any: [],
          all: [
            {
              id: 'aria-valid-attr-value',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute values are valid',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-errormessage',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message:
                'aria-errormessage exists and references elements visible to screen readers that use a supported aria-errormessage technique',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-level',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'aria-level values are valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="root-3-child-a2" aria-controls="root-3-child-a2--grandchild-a1-1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-ohbggj > .css-qyeqia[data-item-id="root-3-child-a2"][data-parent-id="root-3"] > .css-154pbrb',
          ],
        },
        {
          any: [],
          all: [
            {
              id: 'aria-valid-attr-value',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute values are valid',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-errormessage',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message:
                'aria-errormessage exists and references elements visible to screen readers that use a supported aria-errormessage technique',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-level',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'aria-level values are valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          none: [],
          impact: null,
          html: '<div aria-label="Hide Basic ref stories" aria-expanded="true" class="css-9whvue">',
          target: ['.css-9whvue[aria-label="Hide Basic ref stories"]'],
        },
        {
          any: [],
          all: [
            {
              id: 'aria-valid-attr-value',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute values are valid',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-errormessage',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message:
                'aria-errormessage exists and references elements visible to screen readers that use a supported aria-errormessage technique',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-level',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'aria-level values are valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="basic_root-1" aria-controls="root-1-child-a1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-1x6s7u8 > div > div[data-highlighted-ref-id="storybook_internal"] > .css-1d0gimt[data-title="Basic ref"] > .css-159egyp > div[data-ref-id="basic"][data-item-id="root-1"][data-nodetype="group"] > .css-154pbrb[aria-controls="root-1-child-a1"]',
          ],
        },
        {
          any: [],
          all: [
            {
              id: 'aria-valid-attr-value',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute values are valid',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-errormessage',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message:
                'aria-errormessage exists and references elements visible to screen readers that use a supported aria-errormessage technique',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-level',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'aria-level values are valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="basic_group-1" aria-controls="group-1--child-b1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-qyeqia[data-ref-id="basic"][data-item-id="group-1"] > .css-154pbrb[aria-controls="group-1--child-b1"]',
          ],
        },
        {
          any: [],
          all: [
            {
              id: 'aria-valid-attr-value',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute values are valid',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-errormessage',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message:
                'aria-errormessage exists and references elements visible to screen readers that use a supported aria-errormessage technique',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-level',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'aria-level values are valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          none: [],
          impact: null,
          html: '<div aria-label="Hide Not ready stories" aria-expanded="true" class="css-9whvue">',
          target: ['.css-9whvue[aria-label="Hide Not ready stories"]'],
        },
        {
          any: [],
          all: [
            {
              id: 'aria-valid-attr-value',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute values are valid',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-errormessage',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message:
                'aria-errormessage exists and references elements visible to screen readers that use a supported aria-errormessage technique',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-level',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'aria-level values are valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          none: [],
          impact: null,
          html: '<div aria-label="Hide Unknown ref stories" aria-expanded="true" class="css-9whvue">',
          target: ['.css-9whvue[aria-label="Hide Unknown ref stories"]'],
        },
        {
          any: [],
          all: [
            {
              id: 'aria-valid-attr-value',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute values are valid',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-errormessage',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message:
                'aria-errormessage exists and references elements visible to screen readers that use a supported aria-errormessage technique',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-level',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'aria-level values are valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          none: [],
          impact: null,
          html: '<div aria-label="Hide Lazy loaded ref stories" aria-expanded="true" class="css-9whvue">',
          target: ['.css-9whvue[aria-label="Hide Lazy loaded ref stories"]'],
        },
        {
          any: [],
          all: [
            {
              id: 'aria-valid-attr-value',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute values are valid',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-errormessage',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message:
                'aria-errormessage exists and references elements visible to screen readers that use a supported aria-errormessage technique',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-level',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'aria-level values are valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="lazy_group-1" aria-controls="group-1--child-b1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-159egyp > .css-qyeqia[data-item-id="group-1"][data-nodetype="group"] > .css-154pbrb[aria-controls="group-1--child-b1"]',
          ],
        },
        {
          any: [],
          all: [
            {
              id: 'aria-valid-attr-value',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute values are valid',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-errormessage',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message:
                'aria-errormessage exists and references elements visible to screen readers that use a supported aria-errormessage technique',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-level',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'aria-level values are valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          none: [],
          impact: null,
          html: '<button type="button" data-action="collapse-root" aria-expanded="true" class="css-h7e28b">',
          target: [
            '.css-159egyp > .css-170ite8.sidebar-subheading[data-item-id="root-1"] > .css-h7e28b[type="button"][data-action="collapse-root"]',
          ],
        },
        {
          any: [],
          all: [
            {
              id: 'aria-valid-attr-value',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute values are valid',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-errormessage',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message:
                'aria-errormessage exists and references elements visible to screen readers that use a supported aria-errormessage technique',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-level',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'aria-level values are valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          none: [],
          impact: null,
          html: '<button class="sidebar-subheading-action css-18rvurk" aria-label="Collapse" data-action="expand-all" data-expanded="false">',
          target: [
            '.css-159egyp > .css-170ite8.sidebar-subheading[data-item-id="root-1"] > .sidebar-subheading-action.css-18rvurk[aria-label="Collapse"]',
          ],
        },
        {
          any: [],
          all: [
            {
              id: 'aria-valid-attr-value',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute values are valid',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-errormessage',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message:
                'aria-errormessage exists and references elements visible to screen readers that use a supported aria-errormessage technique',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-level',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'aria-level values are valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="lazy_root-1-child-a1" aria-expanded="false" class="css-1vdojxu"><div class="css-99l9qv"><svg viewBox="0 0 14 14" width="12" height="12" type="component" class="css-1e3avu6"><use xlink:href="#icon--component"></use></svg></div>Child A1</button>',
          target: [
            '.css-159egyp > .css-qyeqia[data-item-id="root-1-child-a1"][data-parent-id="root-1"] > .css-1vdojxu',
          ],
        },
        {
          any: [],
          all: [
            {
              id: 'aria-valid-attr-value',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute values are valid',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-errormessage',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message:
                'aria-errormessage exists and references elements visible to screen readers that use a supported aria-errormessage technique',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-level',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'aria-level values are valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="lazy_root-1-child-a2" aria-controls="root-1-child-a2--grandchild-a1-1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-159egyp > .css-qyeqia[data-item-id="root-1-child-a2"][data-parent-id="root-1"] > .css-154pbrb',
          ],
        },
        {
          any: [],
          all: [
            {
              id: 'aria-valid-attr-value',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute values are valid',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-errormessage',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message:
                'aria-errormessage exists and references elements visible to screen readers that use a supported aria-errormessage technique',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-level',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'aria-level values are valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          none: [],
          impact: null,
          html: '<button type="button" data-action="collapse-root" aria-expanded="true" class="css-h7e28b">',
          target: [
            '.css-159egyp > .css-170ite8.sidebar-subheading[data-item-id="root-3"] > .css-h7e28b[type="button"][data-action="collapse-root"]',
          ],
        },
        {
          any: [],
          all: [
            {
              id: 'aria-valid-attr-value',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute values are valid',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-errormessage',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message:
                'aria-errormessage exists and references elements visible to screen readers that use a supported aria-errormessage technique',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-level',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'aria-level values are valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          none: [],
          impact: null,
          html: '<button class="sidebar-subheading-action css-18rvurk" aria-label="Collapse" data-action="expand-all" data-expanded="false">',
          target: [
            '.css-159egyp > .css-170ite8.sidebar-subheading[data-item-id="root-3"] > .sidebar-subheading-action.css-18rvurk[aria-label="Collapse"]',
          ],
        },
        {
          any: [],
          all: [
            {
              id: 'aria-valid-attr-value',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute values are valid',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-errormessage',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message:
                'aria-errormessage exists and references elements visible to screen readers that use a supported aria-errormessage technique',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'aria-level',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'aria-level values are valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="lazy_root-3-child-a2" aria-controls="root-3-child-a2--grandchild-a1-1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-159egyp > .css-qyeqia[data-item-id="root-3-child-a2"][data-parent-id="root-3"] > .css-154pbrb',
          ],
        },
      ],
    },
    {
      id: 'aria-valid-attr',
      impact: null,
      tags: ['cat.aria', 'wcag2a', 'wcag412', 'EN-301-549', 'EN-9.4.1.2'],
      description: 'Ensure attributes that begin with aria- are valid ARIA attributes',
      help: 'ARIA attributes must conform to valid names',
      helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/aria-valid-attr?application=axeAPI',
      nodes: [
        {
          any: [
            {
              id: 'aria-valid-attr',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute name is valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="group-1" aria-controls="group-1--child-b1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-ohbggj > .css-ld0a14[data-item-id="group-1"][data-nodetype="group"] > .css-154pbrb[aria-controls="group-1--child-b1"]',
          ],
        },
        {
          any: [
            {
              id: 'aria-valid-attr',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute name is valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button type="button" data-action="collapse-root" aria-expanded="true" class="css-h7e28b">',
          target: [
            '.css-ohbggj > .css-1ikkmhb.sidebar-subheading[data-item-id="root-1"] > .css-h7e28b[type="button"][data-action="collapse-root"]',
          ],
        },
        {
          any: [
            {
              id: 'aria-valid-attr',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute name is valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button class="sidebar-subheading-action css-18rvurk" aria-label="Collapse" data-action="expand-all" data-expanded="false">',
          target: [
            '.css-ohbggj > .css-1ikkmhb.sidebar-subheading[data-item-id="root-1"] > .sidebar-subheading-action.css-18rvurk[aria-label="Collapse"]',
          ],
        },
        {
          any: [
            {
              id: 'aria-valid-attr',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute name is valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="root-1-child-a1" aria-expanded="false" class="css-1vdojxu"><div class="css-99l9qv"><svg viewBox="0 0 14 14" width="12" height="12" type="component" class="css-1e3avu6"><use xlink:href="#icon--component"></use></svg></div>Child A1</button>',
          target: [
            '.css-ohbggj > .css-ld0a14[data-item-id="root-1-child-a1"][data-parent-id="root-1"] > .css-1vdojxu',
          ],
        },
        {
          any: [
            {
              id: 'aria-valid-attr',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute name is valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="root-1-child-a2" aria-controls="root-1-child-a2--grandchild-a1-1" aria-expanded="true" class="css-154pbrb">',
          target: [
            '.css-ohbggj > .css-ld0a14[data-item-id="root-1-child-a2"][data-parent-id="root-1"] > .css-154pbrb',
          ],
        },
        {
          any: [
            {
              id: 'aria-valid-attr',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute name is valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button type="button" data-action="collapse-root" aria-expanded="true" class="css-h7e28b">',
          target: [
            '.css-ohbggj > .css-1ikkmhb.sidebar-subheading[data-item-id="root-3"] > .css-h7e28b[type="button"][data-action="collapse-root"]',
          ],
        },
        {
          any: [
            {
              id: 'aria-valid-attr',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute name is valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button class="sidebar-subheading-action css-18rvurk" aria-label="Collapse" data-action="expand-all" data-expanded="false">',
          target: [
            '.css-ohbggj > .css-1ikkmhb.sidebar-subheading[data-item-id="root-3"] > .sidebar-subheading-action.css-18rvurk[aria-label="Collapse"]',
          ],
        },
        {
          any: [
            {
              id: 'aria-valid-attr',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute name is valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="root-3-child-a2" aria-controls="root-3-child-a2--grandchild-a1-1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-ohbggj > .css-ld0a14[data-item-id="root-3-child-a2"][data-parent-id="root-3"] > .css-154pbrb',
          ],
        },
        {
          any: [
            {
              id: 'aria-valid-attr',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute name is valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<div aria-label="Hide Basic ref stories" aria-expanded="true" class="css-8kwxkl">',
          target: ['.css-8kwxkl[aria-label="Hide Basic ref stories"]'],
        },
        {
          any: [
            {
              id: 'aria-valid-attr',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute name is valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="basic_root-1" aria-controls="root-1-child-a1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-ocnlra > div > div[data-highlighted-ref-id="storybook_internal"] > .css-1d0gimt[data-title="Basic ref"] > .css-159egyp > div[data-ref-id="basic"][data-item-id="root-1"][data-nodetype="group"] > .css-154pbrb[aria-controls="root-1-child-a1"]',
          ],
        },
        {
          any: [
            {
              id: 'aria-valid-attr',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute name is valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="basic_group-1" aria-controls="group-1--child-b1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-ld0a14[data-ref-id="basic"][data-item-id="group-1"] > .css-154pbrb[aria-controls="group-1--child-b1"]',
          ],
        },
        {
          any: [
            {
              id: 'aria-valid-attr',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute name is valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<div aria-label="Hide Not ready stories" aria-expanded="true" class="css-8kwxkl">',
          target: ['.css-8kwxkl[aria-label="Hide Not ready stories"]'],
        },
        {
          any: [
            {
              id: 'aria-valid-attr',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute name is valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<div aria-label="Hide Unknown ref stories" aria-expanded="true" class="css-8kwxkl">',
          target: ['.css-8kwxkl[aria-label="Hide Unknown ref stories"]'],
        },
        {
          any: [
            {
              id: 'aria-valid-attr',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute name is valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<div aria-label="Hide Lazy loaded ref stories" aria-expanded="true" class="css-8kwxkl">',
          target: ['.css-8kwxkl[aria-label="Hide Lazy loaded ref stories"]'],
        },
        {
          any: [
            {
              id: 'aria-valid-attr',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute name is valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="lazy_group-1" aria-controls="group-1--child-b1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-159egyp > .css-ld0a14[data-item-id="group-1"][data-nodetype="group"] > .css-154pbrb[aria-controls="group-1--child-b1"]',
          ],
        },
        {
          any: [
            {
              id: 'aria-valid-attr',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute name is valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button type="button" data-action="collapse-root" aria-expanded="true" class="css-h7e28b">',
          target: [
            '.css-159egyp > .css-1ikkmhb.sidebar-subheading[data-item-id="root-1"] > .css-h7e28b[type="button"][data-action="collapse-root"]',
          ],
        },
        {
          any: [
            {
              id: 'aria-valid-attr',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute name is valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button class="sidebar-subheading-action css-18rvurk" aria-label="Collapse" data-action="expand-all" data-expanded="false">',
          target: [
            '.css-159egyp > .css-1ikkmhb.sidebar-subheading[data-item-id="root-1"] > .sidebar-subheading-action.css-18rvurk[aria-label="Collapse"]',
          ],
        },
        {
          any: [
            {
              id: 'aria-valid-attr',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute name is valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="lazy_root-1-child-a1" aria-expanded="false" class="css-1vdojxu"><div class="css-99l9qv"><svg viewBox="0 0 14 14" width="12" height="12" type="component" class="css-1e3avu6"><use xlink:href="#icon--component"></use></svg></div>Child A1</button>',
          target: [
            '.css-159egyp > .css-ld0a14[data-item-id="root-1-child-a1"][data-parent-id="root-1"] > .css-1vdojxu',
          ],
        },
        {
          any: [
            {
              id: 'aria-valid-attr',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute name is valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="lazy_root-1-child-a2" aria-controls="root-1-child-a2--grandchild-a1-1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-159egyp > .css-ld0a14[data-item-id="root-1-child-a2"][data-parent-id="root-1"] > .css-154pbrb',
          ],
        },
        {
          any: [
            {
              id: 'aria-valid-attr',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute name is valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button type="button" data-action="collapse-root" aria-expanded="true" class="css-h7e28b">',
          target: [
            '.css-159egyp > .css-1ikkmhb.sidebar-subheading[data-item-id="root-3"] > .css-h7e28b[type="button"][data-action="collapse-root"]',
          ],
        },
        {
          any: [
            {
              id: 'aria-valid-attr',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute name is valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button class="sidebar-subheading-action css-18rvurk" aria-label="Collapse" data-action="expand-all" data-expanded="false">',
          target: [
            '.css-159egyp > .css-1ikkmhb.sidebar-subheading[data-item-id="root-3"] > .sidebar-subheading-action.css-18rvurk[aria-label="Collapse"]',
          ],
        },
        {
          any: [
            {
              id: 'aria-valid-attr',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute name is valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="lazy_root-3-child-a2" aria-controls="root-3-child-a2--grandchild-a1-1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-159egyp > .css-ld0a14[data-item-id="root-3-child-a2"][data-parent-id="root-3"] > .css-154pbrb',
          ],
        },
        {
          any: [
            {
              id: 'aria-valid-attr',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute name is valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="group-1" aria-controls="group-1--child-b1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-ohbggj > .css-qyeqia[data-item-id="group-1"][data-nodetype="group"] > .css-154pbrb[aria-controls="group-1--child-b1"]',
          ],
        },
        {
          any: [
            {
              id: 'aria-valid-attr',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute name is valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button type="button" data-action="collapse-root" aria-expanded="true" class="css-h7e28b">',
          target: [
            '.css-ohbggj > .css-170ite8.sidebar-subheading[data-item-id="root-1"] > .css-h7e28b[type="button"][data-action="collapse-root"]',
          ],
        },
        {
          any: [
            {
              id: 'aria-valid-attr',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute name is valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button class="sidebar-subheading-action css-18rvurk" aria-label="Collapse" data-action="expand-all" data-expanded="false">',
          target: [
            '.css-ohbggj > .css-170ite8.sidebar-subheading[data-item-id="root-1"] > .sidebar-subheading-action.css-18rvurk[aria-label="Collapse"]',
          ],
        },
        {
          any: [
            {
              id: 'aria-valid-attr',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute name is valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="root-1-child-a1" aria-expanded="false" class="css-1vdojxu"><div class="css-99l9qv"><svg viewBox="0 0 14 14" width="12" height="12" type="component" class="css-1e3avu6"><use xlink:href="#icon--component"></use></svg></div>Child A1</button>',
          target: [
            '.css-ohbggj > .css-qyeqia[data-item-id="root-1-child-a1"][data-parent-id="root-1"] > .css-1vdojxu',
          ],
        },
        {
          any: [
            {
              id: 'aria-valid-attr',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute name is valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="root-1-child-a2" aria-controls="root-1-child-a2--grandchild-a1-1" aria-expanded="true" class="css-154pbrb">',
          target: [
            '.css-ohbggj > .css-qyeqia[data-item-id="root-1-child-a2"][data-parent-id="root-1"] > .css-154pbrb',
          ],
        },
        {
          any: [
            {
              id: 'aria-valid-attr',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute name is valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button type="button" data-action="collapse-root" aria-expanded="true" class="css-h7e28b">',
          target: [
            '.css-ohbggj > .css-170ite8.sidebar-subheading[data-item-id="root-3"] > .css-h7e28b[type="button"][data-action="collapse-root"]',
          ],
        },
        {
          any: [
            {
              id: 'aria-valid-attr',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute name is valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button class="sidebar-subheading-action css-18rvurk" aria-label="Collapse" data-action="expand-all" data-expanded="false">',
          target: [
            '.css-ohbggj > .css-170ite8.sidebar-subheading[data-item-id="root-3"] > .sidebar-subheading-action.css-18rvurk[aria-label="Collapse"]',
          ],
        },
        {
          any: [
            {
              id: 'aria-valid-attr',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute name is valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="root-3-child-a2" aria-controls="root-3-child-a2--grandchild-a1-1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-ohbggj > .css-qyeqia[data-item-id="root-3-child-a2"][data-parent-id="root-3"] > .css-154pbrb',
          ],
        },
        {
          any: [
            {
              id: 'aria-valid-attr',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute name is valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<div aria-label="Hide Basic ref stories" aria-expanded="true" class="css-9whvue">',
          target: ['.css-9whvue[aria-label="Hide Basic ref stories"]'],
        },
        {
          any: [
            {
              id: 'aria-valid-attr',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute name is valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="basic_root-1" aria-controls="root-1-child-a1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-1x6s7u8 > div > div[data-highlighted-ref-id="storybook_internal"] > .css-1d0gimt[data-title="Basic ref"] > .css-159egyp > div[data-ref-id="basic"][data-item-id="root-1"][data-nodetype="group"] > .css-154pbrb[aria-controls="root-1-child-a1"]',
          ],
        },
        {
          any: [
            {
              id: 'aria-valid-attr',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute name is valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="basic_group-1" aria-controls="group-1--child-b1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-qyeqia[data-ref-id="basic"][data-item-id="group-1"] > .css-154pbrb[aria-controls="group-1--child-b1"]',
          ],
        },
        {
          any: [
            {
              id: 'aria-valid-attr',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute name is valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<div aria-label="Hide Not ready stories" aria-expanded="true" class="css-9whvue">',
          target: ['.css-9whvue[aria-label="Hide Not ready stories"]'],
        },
        {
          any: [
            {
              id: 'aria-valid-attr',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute name is valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<div aria-label="Hide Unknown ref stories" aria-expanded="true" class="css-9whvue">',
          target: ['.css-9whvue[aria-label="Hide Unknown ref stories"]'],
        },
        {
          any: [
            {
              id: 'aria-valid-attr',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute name is valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<div aria-label="Hide Lazy loaded ref stories" aria-expanded="true" class="css-9whvue">',
          target: ['.css-9whvue[aria-label="Hide Lazy loaded ref stories"]'],
        },
        {
          any: [
            {
              id: 'aria-valid-attr',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute name is valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="lazy_group-1" aria-controls="group-1--child-b1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-159egyp > .css-qyeqia[data-item-id="group-1"][data-nodetype="group"] > .css-154pbrb[aria-controls="group-1--child-b1"]',
          ],
        },
        {
          any: [
            {
              id: 'aria-valid-attr',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute name is valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button type="button" data-action="collapse-root" aria-expanded="true" class="css-h7e28b">',
          target: [
            '.css-159egyp > .css-170ite8.sidebar-subheading[data-item-id="root-1"] > .css-h7e28b[type="button"][data-action="collapse-root"]',
          ],
        },
        {
          any: [
            {
              id: 'aria-valid-attr',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute name is valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button class="sidebar-subheading-action css-18rvurk" aria-label="Collapse" data-action="expand-all" data-expanded="false">',
          target: [
            '.css-159egyp > .css-170ite8.sidebar-subheading[data-item-id="root-1"] > .sidebar-subheading-action.css-18rvurk[aria-label="Collapse"]',
          ],
        },
        {
          any: [
            {
              id: 'aria-valid-attr',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute name is valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="lazy_root-1-child-a1" aria-expanded="false" class="css-1vdojxu"><div class="css-99l9qv"><svg viewBox="0 0 14 14" width="12" height="12" type="component" class="css-1e3avu6"><use xlink:href="#icon--component"></use></svg></div>Child A1</button>',
          target: [
            '.css-159egyp > .css-qyeqia[data-item-id="root-1-child-a1"][data-parent-id="root-1"] > .css-1vdojxu',
          ],
        },
        {
          any: [
            {
              id: 'aria-valid-attr',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute name is valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="lazy_root-1-child-a2" aria-controls="root-1-child-a2--grandchild-a1-1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-159egyp > .css-qyeqia[data-item-id="root-1-child-a2"][data-parent-id="root-1"] > .css-154pbrb',
          ],
        },
        {
          any: [
            {
              id: 'aria-valid-attr',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute name is valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button type="button" data-action="collapse-root" aria-expanded="true" class="css-h7e28b">',
          target: [
            '.css-159egyp > .css-170ite8.sidebar-subheading[data-item-id="root-3"] > .css-h7e28b[type="button"][data-action="collapse-root"]',
          ],
        },
        {
          any: [
            {
              id: 'aria-valid-attr',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute name is valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button class="sidebar-subheading-action css-18rvurk" aria-label="Collapse" data-action="expand-all" data-expanded="false">',
          target: [
            '.css-159egyp > .css-170ite8.sidebar-subheading[data-item-id="root-3"] > .sidebar-subheading-action.css-18rvurk[aria-label="Collapse"]',
          ],
        },
        {
          any: [
            {
              id: 'aria-valid-attr',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'ARIA attribute name is valid',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="lazy_root-3-child-a2" aria-controls="root-3-child-a2--grandchild-a1-1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-159egyp > .css-qyeqia[data-item-id="root-3-child-a2"][data-parent-id="root-3"] > .css-154pbrb',
          ],
        },
      ],
    },
    {
      id: 'avoid-inline-spacing',
      impact: null,
      tags: ['cat.structure', 'wcag21aa', 'wcag1412', 'EN-301-549', 'EN-9.1.4.12', 'ACT'],
      description:
        'Ensure that text spacing set through style attributes can be adjusted with custom stylesheets',
      help: 'Inline text spacing must be adjustable with custom stylesheets',
      helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/avoid-inline-spacing?application=axeAPI',
      nodes: [
        {
          any: [],
          all: [
            {
              id: 'important-letter-spacing',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message:
                'Letter-spacing in the style attribute is not set to !important, or meets the minimum',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'important-word-spacing',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message:
                'word-spacing in the style attribute is not set to !important, or meets the minimum',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'important-line-height',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message:
                'line-height in the style attribute is not set to !important, or meets the minimum',
              '_constructor-name_': 'CheckResult',
            },
          ],
          none: [],
          impact: null,
          html: '<body class="sb-main-fullscreen sb-show-main" style="background: rgb(255, 255, 255); color: rgb(46, 52, 56);">',
          target: ['body'],
        },
        {
          any: [],
          all: [
            {
              id: 'important-letter-spacing',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message:
                'Letter-spacing in the style attribute is not set to !important, or meets the minimum',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'important-word-spacing',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message:
                'word-spacing in the style attribute is not set to !important, or meets the minimum',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'important-line-height',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message:
                'line-height in the style attribute is not set to !important, or meets the minimum',
              '_constructor-name_': 'CheckResult',
            },
          ],
          none: [],
          impact: null,
          html: '<div style="padding: 0px 20px; max-width: 230px;">',
          target: ['.css-ocnlra > div'],
        },
        {
          any: [],
          all: [
            {
              id: 'important-letter-spacing',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message:
                'Letter-spacing in the style attribute is not set to !important, or meets the minimum',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'important-word-spacing',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message:
                'word-spacing in the style attribute is not set to !important, or meets the minimum',
              '_constructor-name_': 'CheckResult',
            },
            {
              id: 'important-line-height',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message:
                'line-height in the style attribute is not set to !important, or meets the minimum',
              '_constructor-name_': 'CheckResult',
            },
          ],
          none: [],
          impact: null,
          html: '<div style="padding: 0px 20px; max-width: 230px;">',
          target: ['.css-1x6s7u8 > div'],
        },
      ],
    },
    {
      id: 'button-name',
      impact: null,
      tags: [
        'cat.name-role-value',
        'wcag2a',
        'wcag412',
        'section508',
        'section508.22.a',
        'TTv5',
        'TT6.a',
        'EN-301-549',
        'EN-9.4.1.2',
        'ACT',
      ],
      description: 'Ensure buttons have discernible text',
      help: 'Buttons must have discernible text',
      helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/button-name?application=axeAPI',
      nodes: [
        {
          any: [
            {
              id: 'button-has-visible-text',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'Element has inner text that is visible to screen readers',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="group-1" aria-controls="group-1--child-b1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-ohbggj > .css-ld0a14[data-item-id="group-1"][data-nodetype="group"] > .css-154pbrb[aria-controls="group-1--child-b1"]',
          ],
        },
        {
          any: [
            {
              id: 'button-has-visible-text',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'Element has inner text that is visible to screen readers',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button type="button" data-action="collapse-root" aria-expanded="true" class="css-h7e28b">',
          target: [
            '.css-ohbggj > .css-1ikkmhb.sidebar-subheading[data-item-id="root-1"] > .css-h7e28b[type="button"][data-action="collapse-root"]',
          ],
        },
        {
          any: [
            {
              id: 'aria-label',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'aria-label attribute exists and is not empty',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button class="sidebar-subheading-action css-18rvurk" aria-label="Collapse" data-action="expand-all" data-expanded="false">',
          target: [
            '.css-ohbggj > .css-1ikkmhb.sidebar-subheading[data-item-id="root-1"] > .sidebar-subheading-action.css-18rvurk[aria-label="Collapse"]',
          ],
        },
        {
          any: [
            {
              id: 'button-has-visible-text',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'Element has inner text that is visible to screen readers',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="root-1-child-a1" aria-expanded="false" class="css-1vdojxu"><div class="css-99l9qv"><svg viewBox="0 0 14 14" width="12" height="12" type="component" class="css-1e3avu6"><use xlink:href="#icon--component"></use></svg></div>Child A1</button>',
          target: [
            '.css-ohbggj > .css-ld0a14[data-item-id="root-1-child-a1"][data-parent-id="root-1"] > .css-1vdojxu',
          ],
        },
        {
          any: [
            {
              id: 'button-has-visible-text',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'Element has inner text that is visible to screen readers',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="root-1-child-a2" aria-controls="root-1-child-a2--grandchild-a1-1" aria-expanded="true" class="css-154pbrb">',
          target: [
            '.css-ohbggj > .css-ld0a14[data-item-id="root-1-child-a2"][data-parent-id="root-1"] > .css-154pbrb',
          ],
        },
        {
          any: [
            {
              id: 'button-has-visible-text',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'Element has inner text that is visible to screen readers',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button type="button" data-action="collapse-root" aria-expanded="true" class="css-h7e28b">',
          target: [
            '.css-ohbggj > .css-1ikkmhb.sidebar-subheading[data-item-id="root-3"] > .css-h7e28b[type="button"][data-action="collapse-root"]',
          ],
        },
        {
          any: [
            {
              id: 'aria-label',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'aria-label attribute exists and is not empty',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button class="sidebar-subheading-action css-18rvurk" aria-label="Collapse" data-action="expand-all" data-expanded="false">',
          target: [
            '.css-ohbggj > .css-1ikkmhb.sidebar-subheading[data-item-id="root-3"] > .sidebar-subheading-action.css-18rvurk[aria-label="Collapse"]',
          ],
        },
        {
          any: [
            {
              id: 'button-has-visible-text',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'Element has inner text that is visible to screen readers',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="root-3-child-a2" aria-controls="root-3-child-a2--grandchild-a1-1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-ohbggj > .css-ld0a14[data-item-id="root-3-child-a2"][data-parent-id="root-3"] > .css-154pbrb',
          ],
        },
        {
          any: [
            {
              id: 'button-has-visible-text',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'Element has inner text that is visible to screen readers',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button data-action="collapse-ref" class="css-1i0dglu">',
          target: [
            '.css-8kwxkl[aria-label="Hide Basic ref stories"] > .css-1i0dglu[data-action="collapse-ref"]',
          ],
        },
        {
          any: [
            {
              id: 'button-has-visible-text',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'Element has inner text that is visible to screen readers',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="basic_root-1" aria-controls="root-1-child-a1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-ocnlra > div > div[data-highlighted-ref-id="storybook_internal"] > .css-1d0gimt[data-title="Basic ref"] > .css-159egyp > div[data-ref-id="basic"][data-item-id="root-1"][data-nodetype="group"] > .css-154pbrb[aria-controls="root-1-child-a1"]',
          ],
        },
        {
          any: [
            {
              id: 'button-has-visible-text',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'Element has inner text that is visible to screen readers',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="basic_group-1" aria-controls="group-1--child-b1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-ld0a14[data-ref-id="basic"][data-item-id="group-1"] > .css-154pbrb[aria-controls="group-1--child-b1"]',
          ],
        },
        {
          any: [
            {
              id: 'button-has-visible-text',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'Element has inner text that is visible to screen readers',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button data-action="collapse-ref" class="css-1i0dglu">',
          target: [
            '.css-8kwxkl[aria-label="Hide Not ready stories"] > .css-1i0dglu[data-action="collapse-ref"]',
          ],
        },
        {
          any: [
            {
              id: 'button-has-visible-text',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'Element has inner text that is visible to screen readers',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button data-action="collapse-ref" class="css-1i0dglu">',
          target: [
            '.css-8kwxkl[aria-label="Hide Unknown ref stories"] > .css-1i0dglu[data-action="collapse-ref"]',
          ],
        },
        {
          any: [
            {
              id: 'button-has-visible-text',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'Element has inner text that is visible to screen readers',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button data-action="collapse-ref" class="css-1i0dglu">',
          target: [
            '.css-8kwxkl[aria-label="Hide Lazy loaded ref stories"] > .css-1i0dglu[data-action="collapse-ref"]',
          ],
        },
        {
          any: [
            {
              id: 'button-has-visible-text',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'Element has inner text that is visible to screen readers',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="lazy_group-1" aria-controls="group-1--child-b1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-159egyp > .css-ld0a14[data-item-id="group-1"][data-nodetype="group"] > .css-154pbrb[aria-controls="group-1--child-b1"]',
          ],
        },
        {
          any: [
            {
              id: 'button-has-visible-text',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'Element has inner text that is visible to screen readers',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button type="button" data-action="collapse-root" aria-expanded="true" class="css-h7e28b">',
          target: [
            '.css-159egyp > .css-1ikkmhb.sidebar-subheading[data-item-id="root-1"] > .css-h7e28b[type="button"][data-action="collapse-root"]',
          ],
        },
        {
          any: [
            {
              id: 'aria-label',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'aria-label attribute exists and is not empty',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button class="sidebar-subheading-action css-18rvurk" aria-label="Collapse" data-action="expand-all" data-expanded="false">',
          target: [
            '.css-159egyp > .css-1ikkmhb.sidebar-subheading[data-item-id="root-1"] > .sidebar-subheading-action.css-18rvurk[aria-label="Collapse"]',
          ],
        },
        {
          any: [
            {
              id: 'button-has-visible-text',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'Element has inner text that is visible to screen readers',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="lazy_root-1-child-a1" aria-expanded="false" class="css-1vdojxu"><div class="css-99l9qv"><svg viewBox="0 0 14 14" width="12" height="12" type="component" class="css-1e3avu6"><use xlink:href="#icon--component"></use></svg></div>Child A1</button>',
          target: [
            '.css-159egyp > .css-ld0a14[data-item-id="root-1-child-a1"][data-parent-id="root-1"] > .css-1vdojxu',
          ],
        },
        {
          any: [
            {
              id: 'button-has-visible-text',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'Element has inner text that is visible to screen readers',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="lazy_root-1-child-a2" aria-controls="root-1-child-a2--grandchild-a1-1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-159egyp > .css-ld0a14[data-item-id="root-1-child-a2"][data-parent-id="root-1"] > .css-154pbrb',
          ],
        },
        {
          any: [
            {
              id: 'button-has-visible-text',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'Element has inner text that is visible to screen readers',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button type="button" data-action="collapse-root" aria-expanded="true" class="css-h7e28b">',
          target: [
            '.css-159egyp > .css-1ikkmhb.sidebar-subheading[data-item-id="root-3"] > .css-h7e28b[type="button"][data-action="collapse-root"]',
          ],
        },
        {
          any: [
            {
              id: 'aria-label',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'aria-label attribute exists and is not empty',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button class="sidebar-subheading-action css-18rvurk" aria-label="Collapse" data-action="expand-all" data-expanded="false">',
          target: [
            '.css-159egyp > .css-1ikkmhb.sidebar-subheading[data-item-id="root-3"] > .sidebar-subheading-action.css-18rvurk[aria-label="Collapse"]',
          ],
        },
        {
          any: [
            {
              id: 'button-has-visible-text',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'Element has inner text that is visible to screen readers',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="lazy_root-3-child-a2" aria-controls="root-3-child-a2--grandchild-a1-1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-159egyp > .css-ld0a14[data-item-id="root-3-child-a2"][data-parent-id="root-3"] > .css-154pbrb',
          ],
        },
        {
          any: [
            {
              id: 'button-has-visible-text',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'Element has inner text that is visible to screen readers',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="group-1" aria-controls="group-1--child-b1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-ohbggj > .css-qyeqia[data-item-id="group-1"][data-nodetype="group"] > .css-154pbrb[aria-controls="group-1--child-b1"]',
          ],
        },
        {
          any: [
            {
              id: 'button-has-visible-text',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'Element has inner text that is visible to screen readers',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button type="button" data-action="collapse-root" aria-expanded="true" class="css-h7e28b">',
          target: [
            '.css-ohbggj > .css-170ite8.sidebar-subheading[data-item-id="root-1"] > .css-h7e28b[type="button"][data-action="collapse-root"]',
          ],
        },
        {
          any: [
            {
              id: 'aria-label',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'aria-label attribute exists and is not empty',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button class="sidebar-subheading-action css-18rvurk" aria-label="Collapse" data-action="expand-all" data-expanded="false">',
          target: [
            '.css-ohbggj > .css-170ite8.sidebar-subheading[data-item-id="root-1"] > .sidebar-subheading-action.css-18rvurk[aria-label="Collapse"]',
          ],
        },
        {
          any: [
            {
              id: 'button-has-visible-text',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'Element has inner text that is visible to screen readers',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="root-1-child-a1" aria-expanded="false" class="css-1vdojxu"><div class="css-99l9qv"><svg viewBox="0 0 14 14" width="12" height="12" type="component" class="css-1e3avu6"><use xlink:href="#icon--component"></use></svg></div>Child A1</button>',
          target: [
            '.css-ohbggj > .css-qyeqia[data-item-id="root-1-child-a1"][data-parent-id="root-1"] > .css-1vdojxu',
          ],
        },
        {
          any: [
            {
              id: 'button-has-visible-text',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'Element has inner text that is visible to screen readers',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="root-1-child-a2" aria-controls="root-1-child-a2--grandchild-a1-1" aria-expanded="true" class="css-154pbrb">',
          target: [
            '.css-ohbggj > .css-qyeqia[data-item-id="root-1-child-a2"][data-parent-id="root-1"] > .css-154pbrb',
          ],
        },
        {
          any: [
            {
              id: 'button-has-visible-text',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'Element has inner text that is visible to screen readers',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button type="button" data-action="collapse-root" aria-expanded="true" class="css-h7e28b">',
          target: [
            '.css-ohbggj > .css-170ite8.sidebar-subheading[data-item-id="root-3"] > .css-h7e28b[type="button"][data-action="collapse-root"]',
          ],
        },
        {
          any: [
            {
              id: 'aria-label',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'aria-label attribute exists and is not empty',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button class="sidebar-subheading-action css-18rvurk" aria-label="Collapse" data-action="expand-all" data-expanded="false">',
          target: [
            '.css-ohbggj > .css-170ite8.sidebar-subheading[data-item-id="root-3"] > .sidebar-subheading-action.css-18rvurk[aria-label="Collapse"]',
          ],
        },
        {
          any: [
            {
              id: 'button-has-visible-text',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'Element has inner text that is visible to screen readers',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="root-3-child-a2" aria-controls="root-3-child-a2--grandchild-a1-1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-ohbggj > .css-qyeqia[data-item-id="root-3-child-a2"][data-parent-id="root-3"] > .css-154pbrb',
          ],
        },
        {
          any: [
            {
              id: 'button-has-visible-text',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'Element has inner text that is visible to screen readers',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button data-action="collapse-ref" class="css-1i0dglu">',
          target: [
            '.css-9whvue[aria-label="Hide Basic ref stories"] > .css-1i0dglu[data-action="collapse-ref"]',
          ],
        },
        {
          any: [
            {
              id: 'button-has-visible-text',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'Element has inner text that is visible to screen readers',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="basic_root-1" aria-controls="root-1-child-a1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-1x6s7u8 > div > div[data-highlighted-ref-id="storybook_internal"] > .css-1d0gimt[data-title="Basic ref"] > .css-159egyp > div[data-ref-id="basic"][data-item-id="root-1"][data-nodetype="group"] > .css-154pbrb[aria-controls="root-1-child-a1"]',
          ],
        },
        {
          any: [
            {
              id: 'button-has-visible-text',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'Element has inner text that is visible to screen readers',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="basic_group-1" aria-controls="group-1--child-b1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-qyeqia[data-ref-id="basic"][data-item-id="group-1"] > .css-154pbrb[aria-controls="group-1--child-b1"]',
          ],
        },
        {
          any: [
            {
              id: 'button-has-visible-text',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'Element has inner text that is visible to screen readers',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button data-action="collapse-ref" class="css-1i0dglu">',
          target: [
            '.css-9whvue[aria-label="Hide Not ready stories"] > .css-1i0dglu[data-action="collapse-ref"]',
          ],
        },
        {
          any: [
            {
              id: 'button-has-visible-text',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'Element has inner text that is visible to screen readers',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button data-action="collapse-ref" class="css-1i0dglu">',
          target: [
            '.css-9whvue[aria-label="Hide Unknown ref stories"] > .css-1i0dglu[data-action="collapse-ref"]',
          ],
        },
        {
          any: [
            {
              id: 'button-has-visible-text',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'Element has inner text that is visible to screen readers',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button data-action="collapse-ref" class="css-1i0dglu">',
          target: [
            '.css-9whvue[aria-label="Hide Lazy loaded ref stories"] > .css-1i0dglu[data-action="collapse-ref"]',
          ],
        },
        {
          any: [
            {
              id: 'button-has-visible-text',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'Element has inner text that is visible to screen readers',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="lazy_group-1" aria-controls="group-1--child-b1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-159egyp > .css-qyeqia[data-item-id="group-1"][data-nodetype="group"] > .css-154pbrb[aria-controls="group-1--child-b1"]',
          ],
        },
        {
          any: [
            {
              id: 'button-has-visible-text',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'Element has inner text that is visible to screen readers',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button type="button" data-action="collapse-root" aria-expanded="true" class="css-h7e28b">',
          target: [
            '.css-159egyp > .css-170ite8.sidebar-subheading[data-item-id="root-1"] > .css-h7e28b[type="button"][data-action="collapse-root"]',
          ],
        },
        {
          any: [
            {
              id: 'aria-label',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'aria-label attribute exists and is not empty',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button class="sidebar-subheading-action css-18rvurk" aria-label="Collapse" data-action="expand-all" data-expanded="false">',
          target: [
            '.css-159egyp > .css-170ite8.sidebar-subheading[data-item-id="root-1"] > .sidebar-subheading-action.css-18rvurk[aria-label="Collapse"]',
          ],
        },
        {
          any: [
            {
              id: 'button-has-visible-text',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'Element has inner text that is visible to screen readers',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="lazy_root-1-child-a1" aria-expanded="false" class="css-1vdojxu"><div class="css-99l9qv"><svg viewBox="0 0 14 14" width="12" height="12" type="component" class="css-1e3avu6"><use xlink:href="#icon--component"></use></svg></div>Child A1</button>',
          target: [
            '.css-159egyp > .css-qyeqia[data-item-id="root-1-child-a1"][data-parent-id="root-1"] > .css-1vdojxu',
          ],
        },
        {
          any: [
            {
              id: 'button-has-visible-text',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'Element has inner text that is visible to screen readers',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="lazy_root-1-child-a2" aria-controls="root-1-child-a2--grandchild-a1-1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-159egyp > .css-qyeqia[data-item-id="root-1-child-a2"][data-parent-id="root-1"] > .css-154pbrb',
          ],
        },
        {
          any: [
            {
              id: 'button-has-visible-text',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'Element has inner text that is visible to screen readers',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button type="button" data-action="collapse-root" aria-expanded="true" class="css-h7e28b">',
          target: [
            '.css-159egyp > .css-170ite8.sidebar-subheading[data-item-id="root-3"] > .css-h7e28b[type="button"][data-action="collapse-root"]',
          ],
        },
        {
          any: [
            {
              id: 'aria-label',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'aria-label attribute exists and is not empty',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button class="sidebar-subheading-action css-18rvurk" aria-label="Collapse" data-action="expand-all" data-expanded="false">',
          target: [
            '.css-159egyp > .css-170ite8.sidebar-subheading[data-item-id="root-3"] > .sidebar-subheading-action.css-18rvurk[aria-label="Collapse"]',
          ],
        },
        {
          any: [
            {
              id: 'button-has-visible-text',
              data: null,
              relatedNodes: [],
              impact: 'critical',
              message: 'Element has inner text that is visible to screen readers',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="lazy_root-3-child-a2" aria-controls="root-3-child-a2--grandchild-a1-1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-159egyp > .css-qyeqia[data-item-id="root-3-child-a2"][data-parent-id="root-3"] > .css-154pbrb',
          ],
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
                fgColor: '#2e3438',
                bgColor: '#ffffff',
                contrastRatio: 12.61,
                fontSize: '10.5pt (14px)',
                fontWeight: 'normal',
                expectedContrastRatio: '4.5:1',
              },
              relatedNodes: [],
              impact: 'serious',
              message: 'Element has sufficient color contrast of 12.61',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="group-1" aria-controls="group-1--child-b1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-ohbggj > .css-ld0a14[data-item-id="group-1"][data-nodetype="group"] > .css-154pbrb[aria-controls="group-1--child-b1"]',
          ],
        },
        {
          any: [
            {
              id: 'color-contrast',
              data: {
                fgColor: '#5c6870',
                bgColor: '#ffffff',
                contrastRatio: 5.72,
                fontSize: '8.3pt (11px)',
                fontWeight: 'bold',
                expectedContrastRatio: '4.5:1',
              },
              relatedNodes: [],
              impact: 'serious',
              message: 'Element has sufficient color contrast of 5.72',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button type="button" data-action="collapse-root" aria-expanded="true" class="css-h7e28b">',
          target: [
            '.css-ohbggj > .css-1ikkmhb.sidebar-subheading[data-item-id="root-1"] > .css-h7e28b[type="button"][data-action="collapse-root"]',
          ],
        },
        {
          any: [
            {
              id: 'color-contrast',
              data: {
                fgColor: '#2e3438',
                bgColor: '#ffffff',
                contrastRatio: 12.61,
                fontSize: '10.5pt (14px)',
                fontWeight: 'normal',
                expectedContrastRatio: '4.5:1',
              },
              relatedNodes: [],
              impact: 'serious',
              message: 'Element has sufficient color contrast of 12.61',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="root-1-child-a1" aria-expanded="false" class="css-1vdojxu"><div class="css-99l9qv"><svg viewBox="0 0 14 14" width="12" height="12" type="component" class="css-1e3avu6"><use xlink:href="#icon--component"></use></svg></div>Child A1</button>',
          target: [
            '.css-ohbggj > .css-ld0a14[data-item-id="root-1-child-a1"][data-parent-id="root-1"] > .css-1vdojxu',
          ],
        },
        {
          any: [
            {
              id: 'color-contrast',
              data: {
                fgColor: '#2e3438',
                bgColor: '#ffffff',
                contrastRatio: 12.61,
                fontSize: '10.5pt (14px)',
                fontWeight: 'normal',
                expectedContrastRatio: '4.5:1',
              },
              relatedNodes: [],
              impact: 'serious',
              message: 'Element has sufficient color contrast of 12.61',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="root-1-child-a2" aria-controls="root-1-child-a2--grandchild-a1-1" aria-expanded="true" class="css-154pbrb">',
          target: [
            '.css-ohbggj > .css-ld0a14[data-item-id="root-1-child-a2"][data-parent-id="root-1"] > .css-154pbrb',
          ],
        },
        {
          any: [
            {
              id: 'color-contrast',
              data: {
                fgColor: '#2e3438',
                bgColor: '#ffffff',
                contrastRatio: 12.61,
                fontSize: '10.5pt (14px)',
                fontWeight: 'normal',
                expectedContrastRatio: '4.5:1',
              },
              relatedNodes: [],
              impact: 'serious',
              message: 'Element has sufficient color contrast of 12.61',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<a tabindex="-1" href="/iframe.html?path=/story/root-1-child-a2--grandchild-a1-2" id="root-1-child-a2--grandchild-a1-2" class="css-xwriep">',
          target: [
            '.css-ocnlra > div > div[data-highlighted-ref-id="storybook_internal"] > .css-79elbk[data-title="storybook_internal"] > .css-ohbggj > div[data-parent-id="root-1-child-a2"][data-selected="false"][data-nodetype="story"] > .css-xwriep',
          ],
        },
        {
          any: [
            {
              id: 'color-contrast',
              data: {
                fgColor: '#5c6870',
                bgColor: '#ffffff',
                contrastRatio: 5.72,
                fontSize: '8.3pt (11px)',
                fontWeight: 'bold',
                expectedContrastRatio: '4.5:1',
              },
              relatedNodes: [],
              impact: 'serious',
              message: 'Element has sufficient color contrast of 5.72',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button type="button" data-action="collapse-root" aria-expanded="true" class="css-h7e28b">',
          target: [
            '.css-ohbggj > .css-1ikkmhb.sidebar-subheading[data-item-id="root-3"] > .css-h7e28b[type="button"][data-action="collapse-root"]',
          ],
        },
        {
          any: [
            {
              id: 'color-contrast',
              data: {
                fgColor: '#2e3438',
                bgColor: '#ffffff',
                contrastRatio: 12.61,
                fontSize: '10.5pt (14px)',
                fontWeight: 'normal',
                expectedContrastRatio: '4.5:1',
              },
              relatedNodes: [],
              impact: 'serious',
              message: 'Element has sufficient color contrast of 12.61',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<a tabindex="-1" href="/iframe.html?path=/story/root-3--child-a1" id="root-3--child-a1" class="css-caedy5"><div class="css-99l9qv"><svg viewBox="0 0 14 14" width="12" height="12" type="story" class="css-ndobih"><use xlink:href="#icon--story"></use></svg></div>Child A1</a>',
          target: [
            '.css-ocnlra > div > div[data-highlighted-ref-id="storybook_internal"] > .css-79elbk[data-title="storybook_internal"] > .css-ohbggj > div[data-item-id="root-3--child-a1"][data-selected="false"][data-parent-id="root-3"] > .css-caedy5',
          ],
        },
        {
          any: [
            {
              id: 'color-contrast',
              data: {
                fgColor: '#2e3438',
                bgColor: '#ffffff',
                contrastRatio: 12.61,
                fontSize: '10.5pt (14px)',
                fontWeight: 'normal',
                expectedContrastRatio: '4.5:1',
              },
              relatedNodes: [],
              impact: 'serious',
              message: 'Element has sufficient color contrast of 12.61',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="root-3-child-a2" aria-controls="root-3-child-a2--grandchild-a1-1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-ohbggj > .css-ld0a14[data-item-id="root-3-child-a2"][data-parent-id="root-3"] > .css-154pbrb',
          ],
        },
        {
          any: [
            {
              id: 'color-contrast',
              data: {
                fgColor: '#2e3438',
                bgColor: '#ffffff',
                contrastRatio: 12.61,
                fontSize: '10.5pt (14px)',
                fontWeight: 'bold',
                expectedContrastRatio: '4.5:1',
              },
              relatedNodes: [],
              impact: 'serious',
              message: 'Element has sufficient color contrast of 12.61',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<div title="Basic ref" class="css-6h78cx">Basic ref</div>',
          target: [
            '.css-8kwxkl[aria-label="Hide Basic ref stories"] > .css-1i0dglu[data-action="collapse-ref"] > .css-6h78cx[title="Basic ref"]',
          ],
        },
        {
          any: [
            {
              id: 'color-contrast',
              data: {
                fgColor: '#2e3438',
                bgColor: '#ffffff',
                contrastRatio: 12.61,
                fontSize: '10.5pt (14px)',
                fontWeight: 'normal',
                expectedContrastRatio: '4.5:1',
              },
              relatedNodes: [],
              impact: 'serious',
              message: 'Element has sufficient color contrast of 12.61',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="basic_root-1" aria-controls="root-1-child-a1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-ocnlra > div > div[data-highlighted-ref-id="storybook_internal"] > .css-1d0gimt[data-title="Basic ref"] > .css-159egyp > div[data-ref-id="basic"][data-item-id="root-1"][data-nodetype="group"] > .css-154pbrb[aria-controls="root-1-child-a1"]',
          ],
        },
        {
          any: [
            {
              id: 'color-contrast',
              data: {
                fgColor: '#2e3438',
                bgColor: '#ffffff',
                contrastRatio: 12.61,
                fontSize: '10.5pt (14px)',
                fontWeight: 'normal',
                expectedContrastRatio: '4.5:1',
              },
              relatedNodes: [],
              impact: 'serious',
              message: 'Element has sufficient color contrast of 12.61',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="basic_group-1" aria-controls="group-1--child-b1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-ld0a14[data-ref-id="basic"][data-item-id="group-1"] > .css-154pbrb[aria-controls="group-1--child-b1"]',
          ],
        },
        {
          any: [
            {
              id: 'color-contrast',
              data: {
                fgColor: '#2e3438',
                bgColor: '#ffffff',
                contrastRatio: 12.61,
                fontSize: '10.5pt (14px)',
                fontWeight: 'bold',
                expectedContrastRatio: '4.5:1',
              },
              relatedNodes: [],
              impact: 'serious',
              message: 'Element has sufficient color contrast of 12.61',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<div title="Not ready" class="css-6h78cx">Not ready</div>',
          target: [
            '.css-8kwxkl[aria-label="Hide Not ready stories"] > .css-1i0dglu[data-action="collapse-ref"] > .css-6h78cx[title="Not ready"]',
          ],
        },
        {
          any: [
            {
              id: 'color-contrast',
              data: {
                fgColor: '#2e3438',
                bgColor: '#ffffff',
                contrastRatio: 12.61,
                fontSize: '10.5pt (14px)',
                fontWeight: 'bold',
                expectedContrastRatio: '4.5:1',
              },
              relatedNodes: [],
              impact: 'serious',
              message: 'Element has sufficient color contrast of 12.61',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<div title="Unknown ref" class="css-6h78cx">Unknown ref</div>',
          target: [
            '.css-8kwxkl[aria-label="Hide Unknown ref stories"] > .css-1i0dglu[data-action="collapse-ref"] > .css-6h78cx[title="Unknown ref"]',
          ],
        },
        {
          any: [
            {
              id: 'color-contrast',
              data: {
                fgColor: '#2e3438',
                bgColor: '#ffffff',
                contrastRatio: 12.61,
                fontSize: '10.5pt (14px)',
                fontWeight: 'bold',
                expectedContrastRatio: '4.5:1',
              },
              relatedNodes: [],
              impact: 'serious',
              message: 'Element has sufficient color contrast of 12.61',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<div title="Lazy loaded ref" class="css-6h78cx">Lazy loaded ref</div>',
          target: [
            '.css-8kwxkl[aria-label="Hide Lazy loaded ref stories"] > .css-1i0dglu[data-action="collapse-ref"] > .css-6h78cx[title="Lazy loaded ref"]',
          ],
        },
        {
          any: [
            {
              id: 'color-contrast',
              data: {
                fgColor: '#2e3438',
                bgColor: '#ffffff',
                contrastRatio: 12.61,
                fontSize: '10.5pt (14px)',
                fontWeight: 'normal',
                expectedContrastRatio: '4.5:1',
              },
              relatedNodes: [],
              impact: 'serious',
              message: 'Element has sufficient color contrast of 12.61',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="lazy_group-1" aria-controls="group-1--child-b1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-159egyp > .css-ld0a14[data-item-id="group-1"][data-nodetype="group"] > .css-154pbrb[aria-controls="group-1--child-b1"]',
          ],
        },
        {
          any: [
            {
              id: 'color-contrast',
              data: {
                fgColor: '#5c6870',
                bgColor: '#ffffff',
                contrastRatio: 5.72,
                fontSize: '8.3pt (11px)',
                fontWeight: 'bold',
                expectedContrastRatio: '4.5:1',
              },
              relatedNodes: [],
              impact: 'serious',
              message: 'Element has sufficient color contrast of 5.72',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button type="button" data-action="collapse-root" aria-expanded="true" class="css-h7e28b">',
          target: [
            '.css-159egyp > .css-1ikkmhb.sidebar-subheading[data-item-id="root-1"] > .css-h7e28b[type="button"][data-action="collapse-root"]',
          ],
        },
        {
          any: [
            {
              id: 'color-contrast',
              data: {
                fgColor: '#2e3438',
                bgColor: '#ffffff',
                contrastRatio: 12.61,
                fontSize: '10.5pt (14px)',
                fontWeight: 'normal',
                expectedContrastRatio: '4.5:1',
              },
              relatedNodes: [],
              impact: 'serious',
              message: 'Element has sufficient color contrast of 12.61',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="lazy_root-1-child-a1" aria-expanded="false" class="css-1vdojxu"><div class="css-99l9qv"><svg viewBox="0 0 14 14" width="12" height="12" type="component" class="css-1e3avu6"><use xlink:href="#icon--component"></use></svg></div>Child A1</button>',
          target: [
            '.css-159egyp > .css-ld0a14[data-item-id="root-1-child-a1"][data-parent-id="root-1"] > .css-1vdojxu',
          ],
        },
        {
          any: [
            {
              id: 'color-contrast',
              data: {
                fgColor: '#2e3438',
                bgColor: '#ffffff',
                contrastRatio: 12.61,
                fontSize: '10.5pt (14px)',
                fontWeight: 'normal',
                expectedContrastRatio: '4.5:1',
              },
              relatedNodes: [],
              impact: 'serious',
              message: 'Element has sufficient color contrast of 12.61',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="lazy_root-1-child-a2" aria-controls="root-1-child-a2--grandchild-a1-1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-159egyp > .css-ld0a14[data-item-id="root-1-child-a2"][data-parent-id="root-1"] > .css-154pbrb',
          ],
        },
        {
          any: [
            {
              id: 'color-contrast',
              data: {
                fgColor: '#5c6870',
                bgColor: '#ffffff',
                contrastRatio: 5.72,
                fontSize: '8.3pt (11px)',
                fontWeight: 'bold',
                expectedContrastRatio: '4.5:1',
              },
              relatedNodes: [],
              impact: 'serious',
              message: 'Element has sufficient color contrast of 5.72',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button type="button" data-action="collapse-root" aria-expanded="true" class="css-h7e28b">',
          target: [
            '.css-159egyp > .css-1ikkmhb.sidebar-subheading[data-item-id="root-3"] > .css-h7e28b[type="button"][data-action="collapse-root"]',
          ],
        },
        {
          any: [
            {
              id: 'color-contrast',
              data: {
                fgColor: '#2e3438',
                bgColor: '#ffffff',
                contrastRatio: 12.61,
                fontSize: '10.5pt (14px)',
                fontWeight: 'normal',
                expectedContrastRatio: '4.5:1',
              },
              relatedNodes: [],
              impact: 'serious',
              message: 'Element has sufficient color contrast of 12.61',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<a tabindex="-1" href="/iframe.html?path=/story/lazy_root-3--child-a1" id="lazy_root-3--child-a1" class="css-caedy5"><div class="css-99l9qv"><svg viewBox="0 0 14 14" width="12" height="12" type="story" class="css-ndobih"><use xlink:href="#icon--story"></use></svg></div>Child A1</a>',
          target: [
            '.css-ocnlra > div > div[data-highlighted-ref-id="storybook_internal"] > .css-1d0gimt[data-title="Lazy loaded ref"] > .css-159egyp > div[data-item-id="root-3--child-a1"][data-selected="false"][data-parent-id="root-3"] > .css-caedy5',
          ],
        },
        {
          any: [
            {
              id: 'color-contrast',
              data: {
                fgColor: '#2e3438',
                bgColor: '#ffffff',
                contrastRatio: 12.61,
                fontSize: '10.5pt (14px)',
                fontWeight: 'normal',
                expectedContrastRatio: '4.5:1',
              },
              relatedNodes: [],
              impact: 'serious',
              message: 'Element has sufficient color contrast of 12.61',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="lazy_root-3-child-a2" aria-controls="root-3-child-a2--grandchild-a1-1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-159egyp > .css-ld0a14[data-item-id="root-3-child-a2"][data-parent-id="root-3"] > .css-154pbrb',
          ],
        },
        {
          any: [
            {
              id: 'color-contrast',
              data: {
                fgColor: '#c9cdcf',
                bgColor: '#1b1c1d',
                contrastRatio: 10.66,
                fontSize: '10.5pt (14px)',
                fontWeight: 'normal',
                expectedContrastRatio: '4.5:1',
              },
              relatedNodes: [],
              impact: 'serious',
              message: 'Element has sufficient color contrast of 10.66',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="group-1" aria-controls="group-1--child-b1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-ohbggj > .css-qyeqia[data-item-id="group-1"][data-nodetype="group"] > .css-154pbrb[aria-controls="group-1--child-b1"]',
          ],
        },
        {
          any: [
            {
              id: 'color-contrast',
              data: {
                fgColor: '#c9cdcf',
                bgColor: '#1b1c1d',
                contrastRatio: 10.66,
                fontSize: '10.5pt (14px)',
                fontWeight: 'normal',
                expectedContrastRatio: '4.5:1',
              },
              relatedNodes: [],
              impact: 'serious',
              message: 'Element has sufficient color contrast of 10.66',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="root-1-child-a1" aria-expanded="false" class="css-1vdojxu"><div class="css-99l9qv"><svg viewBox="0 0 14 14" width="12" height="12" type="component" class="css-1e3avu6"><use xlink:href="#icon--component"></use></svg></div>Child A1</button>',
          target: [
            '.css-ohbggj > .css-qyeqia[data-item-id="root-1-child-a1"][data-parent-id="root-1"] > .css-1vdojxu',
          ],
        },
        {
          any: [
            {
              id: 'color-contrast',
              data: {
                fgColor: '#c9cdcf',
                bgColor: '#1b1c1d',
                contrastRatio: 10.66,
                fontSize: '10.5pt (14px)',
                fontWeight: 'normal',
                expectedContrastRatio: '4.5:1',
              },
              relatedNodes: [],
              impact: 'serious',
              message: 'Element has sufficient color contrast of 10.66',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="root-1-child-a2" aria-controls="root-1-child-a2--grandchild-a1-1" aria-expanded="true" class="css-154pbrb">',
          target: [
            '.css-ohbggj > .css-qyeqia[data-item-id="root-1-child-a2"][data-parent-id="root-1"] > .css-154pbrb',
          ],
        },
        {
          any: [
            {
              id: 'color-contrast',
              data: {
                fgColor: '#c9cdcf',
                bgColor: '#1b1c1d',
                contrastRatio: 10.66,
                fontSize: '10.5pt (14px)',
                fontWeight: 'normal',
                expectedContrastRatio: '4.5:1',
              },
              relatedNodes: [],
              impact: 'serious',
              message: 'Element has sufficient color contrast of 10.66',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<a tabindex="-1" href="/iframe.html?path=/story/root-1-child-a2--grandchild-a1-2" id="root-1-child-a2--grandchild-a1-2" class="css-xwriep">',
          target: [
            '.css-1x6s7u8 > div > div[data-highlighted-ref-id="storybook_internal"] > .css-79elbk[data-title="storybook_internal"] > .css-ohbggj > div[data-parent-id="root-1-child-a2"][data-selected="false"][data-nodetype="story"] > .css-xwriep',
          ],
        },
        {
          any: [
            {
              id: 'color-contrast',
              data: {
                fgColor: '#c9cdcf',
                bgColor: '#1b1c1d',
                contrastRatio: 10.66,
                fontSize: '10.5pt (14px)',
                fontWeight: 'normal',
                expectedContrastRatio: '4.5:1',
              },
              relatedNodes: [],
              impact: 'serious',
              message: 'Element has sufficient color contrast of 10.66',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<a tabindex="-1" href="/iframe.html?path=/story/root-3--child-a1" id="root-3--child-a1" class="css-caedy5"><div class="css-99l9qv"><svg viewBox="0 0 14 14" width="12" height="12" type="story" class="css-ndobih"><use xlink:href="#icon--story"></use></svg></div>Child A1</a>',
          target: [
            '.css-1x6s7u8 > div > div[data-highlighted-ref-id="storybook_internal"] > .css-79elbk[data-title="storybook_internal"] > .css-ohbggj > div[data-item-id="root-3--child-a1"][data-selected="false"][data-parent-id="root-3"] > .css-caedy5',
          ],
        },
        {
          any: [
            {
              id: 'color-contrast',
              data: {
                fgColor: '#c9cdcf',
                bgColor: '#1b1c1d',
                contrastRatio: 10.66,
                fontSize: '10.5pt (14px)',
                fontWeight: 'normal',
                expectedContrastRatio: '4.5:1',
              },
              relatedNodes: [],
              impact: 'serious',
              message: 'Element has sufficient color contrast of 10.66',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="root-3-child-a2" aria-controls="root-3-child-a2--grandchild-a1-1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-ohbggj > .css-qyeqia[data-item-id="root-3-child-a2"][data-parent-id="root-3"] > .css-154pbrb',
          ],
        },
        {
          any: [
            {
              id: 'color-contrast',
              data: {
                fgColor: '#a6aaab',
                bgColor: '#1b1c1d',
                contrastRatio: 7.28,
                fontSize: '10.5pt (14px)',
                fontWeight: 'bold',
                expectedContrastRatio: '4.5:1',
              },
              relatedNodes: [],
              impact: 'serious',
              message: 'Element has sufficient color contrast of 7.28',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<div title="Basic ref" class="css-6h78cx">Basic ref</div>',
          target: [
            '.css-9whvue[aria-label="Hide Basic ref stories"] > .css-1i0dglu[data-action="collapse-ref"] > .css-6h78cx[title="Basic ref"]',
          ],
        },
        {
          any: [
            {
              id: 'color-contrast',
              data: {
                fgColor: '#c9cdcf',
                bgColor: '#1b1c1d',
                contrastRatio: 10.66,
                fontSize: '10.5pt (14px)',
                fontWeight: 'normal',
                expectedContrastRatio: '4.5:1',
              },
              relatedNodes: [],
              impact: 'serious',
              message: 'Element has sufficient color contrast of 10.66',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="basic_root-1" aria-controls="root-1-child-a1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-1x6s7u8 > div > div[data-highlighted-ref-id="storybook_internal"] > .css-1d0gimt[data-title="Basic ref"] > .css-159egyp > div[data-ref-id="basic"][data-item-id="root-1"][data-nodetype="group"] > .css-154pbrb[aria-controls="root-1-child-a1"]',
          ],
        },
        {
          any: [
            {
              id: 'color-contrast',
              data: {
                fgColor: '#c9cdcf',
                bgColor: '#1b1c1d',
                contrastRatio: 10.66,
                fontSize: '10.5pt (14px)',
                fontWeight: 'normal',
                expectedContrastRatio: '4.5:1',
              },
              relatedNodes: [],
              impact: 'serious',
              message: 'Element has sufficient color contrast of 10.66',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="basic_group-1" aria-controls="group-1--child-b1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-qyeqia[data-ref-id="basic"][data-item-id="group-1"] > .css-154pbrb[aria-controls="group-1--child-b1"]',
          ],
        },
        {
          any: [
            {
              id: 'color-contrast',
              data: {
                fgColor: '#a6aaab',
                bgColor: '#1b1c1d',
                contrastRatio: 7.28,
                fontSize: '10.5pt (14px)',
                fontWeight: 'bold',
                expectedContrastRatio: '4.5:1',
              },
              relatedNodes: [],
              impact: 'serious',
              message: 'Element has sufficient color contrast of 7.28',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<div title="Not ready" class="css-6h78cx">Not ready</div>',
          target: [
            '.css-9whvue[aria-label="Hide Not ready stories"] > .css-1i0dglu[data-action="collapse-ref"] > .css-6h78cx[title="Not ready"]',
          ],
        },
        {
          any: [
            {
              id: 'color-contrast',
              data: {
                fgColor: '#a6aaab',
                bgColor: '#1b1c1d',
                contrastRatio: 7.28,
                fontSize: '10.5pt (14px)',
                fontWeight: 'bold',
                expectedContrastRatio: '4.5:1',
              },
              relatedNodes: [],
              impact: 'serious',
              message: 'Element has sufficient color contrast of 7.28',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<div title="Unknown ref" class="css-6h78cx">Unknown ref</div>',
          target: [
            '.css-9whvue[aria-label="Hide Unknown ref stories"] > .css-1i0dglu[data-action="collapse-ref"] > .css-6h78cx[title="Unknown ref"]',
          ],
        },
        {
          any: [
            {
              id: 'color-contrast',
              data: {
                fgColor: '#a6aaab',
                bgColor: '#1b1c1d',
                contrastRatio: 7.28,
                fontSize: '10.5pt (14px)',
                fontWeight: 'bold',
                expectedContrastRatio: '4.5:1',
              },
              relatedNodes: [],
              impact: 'serious',
              message: 'Element has sufficient color contrast of 7.28',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<div title="Lazy loaded ref" class="css-6h78cx">Lazy loaded ref</div>',
          target: [
            '.css-9whvue[aria-label="Hide Lazy loaded ref stories"] > .css-1i0dglu[data-action="collapse-ref"] > .css-6h78cx[title="Lazy loaded ref"]',
          ],
        },
        {
          any: [
            {
              id: 'color-contrast',
              data: {
                fgColor: '#c9cdcf',
                bgColor: '#1b1c1d',
                contrastRatio: 10.66,
                fontSize: '10.5pt (14px)',
                fontWeight: 'normal',
                expectedContrastRatio: '4.5:1',
              },
              relatedNodes: [],
              impact: 'serious',
              message: 'Element has sufficient color contrast of 10.66',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="lazy_group-1" aria-controls="group-1--child-b1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-159egyp > .css-qyeqia[data-item-id="group-1"][data-nodetype="group"] > .css-154pbrb[aria-controls="group-1--child-b1"]',
          ],
        },
        {
          any: [
            {
              id: 'color-contrast',
              data: {
                fgColor: '#c9cdcf',
                bgColor: '#1b1c1d',
                contrastRatio: 10.66,
                fontSize: '10.5pt (14px)',
                fontWeight: 'normal',
                expectedContrastRatio: '4.5:1',
              },
              relatedNodes: [],
              impact: 'serious',
              message: 'Element has sufficient color contrast of 10.66',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="lazy_root-1-child-a1" aria-expanded="false" class="css-1vdojxu"><div class="css-99l9qv"><svg viewBox="0 0 14 14" width="12" height="12" type="component" class="css-1e3avu6"><use xlink:href="#icon--component"></use></svg></div>Child A1</button>',
          target: [
            '.css-159egyp > .css-qyeqia[data-item-id="root-1-child-a1"][data-parent-id="root-1"] > .css-1vdojxu',
          ],
        },
        {
          any: [
            {
              id: 'color-contrast',
              data: {
                fgColor: '#c9cdcf',
                bgColor: '#1b1c1d',
                contrastRatio: 10.66,
                fontSize: '10.5pt (14px)',
                fontWeight: 'normal',
                expectedContrastRatio: '4.5:1',
              },
              relatedNodes: [],
              impact: 'serious',
              message: 'Element has sufficient color contrast of 10.66',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="lazy_root-1-child-a2" aria-controls="root-1-child-a2--grandchild-a1-1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-159egyp > .css-qyeqia[data-item-id="root-1-child-a2"][data-parent-id="root-1"] > .css-154pbrb',
          ],
        },
        {
          any: [
            {
              id: 'color-contrast',
              data: {
                fgColor: '#c9cdcf',
                bgColor: '#1b1c1d',
                contrastRatio: 10.66,
                fontSize: '10.5pt (14px)',
                fontWeight: 'normal',
                expectedContrastRatio: '4.5:1',
              },
              relatedNodes: [],
              impact: 'serious',
              message: 'Element has sufficient color contrast of 10.66',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<a tabindex="-1" href="/iframe.html?path=/story/lazy_root-3--child-a1" id="lazy_root-3--child-a1" class="css-caedy5"><div class="css-99l9qv"><svg viewBox="0 0 14 14" width="12" height="12" type="story" class="css-ndobih"><use xlink:href="#icon--story"></use></svg></div>Child A1</a>',
          target: [
            '.css-1x6s7u8 > div > div[data-highlighted-ref-id="storybook_internal"] > .css-1d0gimt[data-title="Lazy loaded ref"] > .css-159egyp > div[data-item-id="root-3--child-a1"][data-selected="false"][data-parent-id="root-3"] > .css-caedy5',
          ],
        },
        {
          any: [
            {
              id: 'color-contrast',
              data: {
                fgColor: '#c9cdcf',
                bgColor: '#1b1c1d',
                contrastRatio: 10.66,
                fontSize: '10.5pt (14px)',
                fontWeight: 'normal',
                expectedContrastRatio: '4.5:1',
              },
              relatedNodes: [],
              impact: 'serious',
              message: 'Element has sufficient color contrast of 10.66',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="lazy_root-3-child-a2" aria-controls="root-3-child-a2--grandchild-a1-1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-159egyp > .css-qyeqia[data-item-id="root-3-child-a2"][data-parent-id="root-3"] > .css-154pbrb',
          ],
        },
      ],
    },
    {
      id: 'landmark-complementary-is-top-level',
      impact: null,
      tags: ['cat.semantics', 'best-practice'],
      description: 'Ensure the complementary landmark or aside is at top level',
      help: 'Aside should not be contained in another landmark',
      helpUrl:
        'https://dequeuniversity.com/rules/axe/4.10/landmark-complementary-is-top-level?application=axeAPI',
      nodes: [
        {
          any: [
            {
              id: 'landmark-is-top-level',
              data: {
                role: 'complementary',
              },
              relatedNodes: [],
              impact: 'moderate',
              message: 'The complementary landmark is at the top level.',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<aside class="css-1s0lzul"><div></div></aside>',
          target: ['.css-8kwxkl[aria-label="Hide Basic ref stories"] > aside'],
        },
        {
          any: [
            {
              id: 'landmark-is-top-level',
              data: {
                role: 'complementary',
              },
              relatedNodes: [],
              impact: 'moderate',
              message: 'The complementary landmark is at the top level.',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<aside class="css-1s0lzul"><div></div></aside>',
          target: ['.css-8kwxkl[aria-label="Hide Not ready stories"] > aside'],
        },
        {
          any: [
            {
              id: 'landmark-is-top-level',
              data: {
                role: 'complementary',
              },
              relatedNodes: [],
              impact: 'moderate',
              message: 'The complementary landmark is at the top level.',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<aside class="css-1s0lzul"><div></div></aside>',
          target: ['.css-8kwxkl[aria-label="Hide Unknown ref stories"] > aside'],
        },
        {
          any: [
            {
              id: 'landmark-is-top-level',
              data: {
                role: 'complementary',
              },
              relatedNodes: [],
              impact: 'moderate',
              message: 'The complementary landmark is at the top level.',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<aside class="css-1s0lzul"><div></div></aside>',
          target: ['.css-8kwxkl[aria-label="Hide Lazy loaded ref stories"] > aside'],
        },
        {
          any: [
            {
              id: 'landmark-is-top-level',
              data: {
                role: 'complementary',
              },
              relatedNodes: [],
              impact: 'moderate',
              message: 'The complementary landmark is at the top level.',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<aside class="css-1s0lzul"><div></div></aside>',
          target: ['.css-9whvue[aria-label="Hide Basic ref stories"] > aside'],
        },
        {
          any: [
            {
              id: 'landmark-is-top-level',
              data: {
                role: 'complementary',
              },
              relatedNodes: [],
              impact: 'moderate',
              message: 'The complementary landmark is at the top level.',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<aside class="css-1s0lzul"><div></div></aside>',
          target: ['.css-9whvue[aria-label="Hide Not ready stories"] > aside'],
        },
        {
          any: [
            {
              id: 'landmark-is-top-level',
              data: {
                role: 'complementary',
              },
              relatedNodes: [],
              impact: 'moderate',
              message: 'The complementary landmark is at the top level.',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<aside class="css-1s0lzul"><div></div></aside>',
          target: ['.css-9whvue[aria-label="Hide Unknown ref stories"] > aside'],
        },
        {
          any: [
            {
              id: 'landmark-is-top-level',
              data: {
                role: 'complementary',
              },
              relatedNodes: [],
              impact: 'moderate',
              message: 'The complementary landmark is at the top level.',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<aside class="css-1s0lzul"><div></div></aside>',
          target: ['.css-9whvue[aria-label="Hide Lazy loaded ref stories"] > aside'],
        },
      ],
    },
    {
      id: 'link-name',
      impact: null,
      tags: [
        'cat.name-role-value',
        'wcag2a',
        'wcag244',
        'wcag412',
        'section508',
        'section508.22.a',
        'TTv5',
        'TT6.a',
        'EN-301-549',
        'EN-9.2.4.4',
        'EN-9.4.1.2',
        'ACT',
      ],
      description: 'Ensure links have discernible text',
      help: 'Links must have discernible text',
      helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/link-name?application=axeAPI',
      nodes: [
        {
          any: [
            {
              id: 'has-visible-text',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element has text that is visible to screen readers',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [
            {
              id: 'focusable-no-name',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element is not in tab order or has accessible text',
              '_constructor-name_': 'CheckResult',
            },
          ],
          impact: null,
          html: '<a tabindex="-1" href="/iframe.html?path=/story/root-1-child-a2--grandchild-a1-1" id="root-1-child-a2--grandchild-a1-1" class="css-xwriep">',
          target: [
            '.css-ocnlra > div > div[data-highlighted-ref-id="storybook_internal"] > .css-79elbk[data-title="storybook_internal"] > .css-ohbggj > div[data-selected="true"][data-parent-id="root-1-child-a2"][data-nodetype="story"] > .css-xwriep',
          ],
        },
        {
          any: [
            {
              id: 'has-visible-text',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element has text that is visible to screen readers',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [
            {
              id: 'focusable-no-name',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element is not in tab order or has accessible text',
              '_constructor-name_': 'CheckResult',
            },
          ],
          impact: null,
          html: '<a href="#storybook-preview-wrapper" class="css-13ck5d5">Skip to canvas</a>',
          target: ['.css-13ck5d5'],
        },
        {
          any: [
            {
              id: 'has-visible-text',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element has text that is visible to screen readers',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [
            {
              id: 'focusable-no-name',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element is not in tab order or has accessible text',
              '_constructor-name_': 'CheckResult',
            },
          ],
          impact: null,
          html: '<a tabindex="-1" href="/iframe.html?path=/story/root-1-child-a2--grandchild-a1-2" id="root-1-child-a2--grandchild-a1-2" class="css-xwriep">',
          target: [
            '.css-ocnlra > div > div[data-highlighted-ref-id="storybook_internal"] > .css-79elbk[data-title="storybook_internal"] > .css-ohbggj > div[data-parent-id="root-1-child-a2"][data-selected="false"][data-nodetype="story"] > .css-xwriep',
          ],
        },
        {
          any: [
            {
              id: 'has-visible-text',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element has text that is visible to screen readers',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [
            {
              id: 'focusable-no-name',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element is not in tab order or has accessible text',
              '_constructor-name_': 'CheckResult',
            },
          ],
          impact: null,
          html: '<a tabindex="-1" href="/iframe.html?path=/story/root-3--child-a1" id="root-3--child-a1" class="css-caedy5"><div class="css-99l9qv"><svg viewBox="0 0 14 14" width="12" height="12" type="story" class="css-ndobih"><use xlink:href="#icon--story"></use></svg></div>Child A1</a>',
          target: [
            '.css-ocnlra > div > div[data-highlighted-ref-id="storybook_internal"] > .css-79elbk[data-title="storybook_internal"] > .css-ohbggj > div[data-item-id="root-3--child-a1"][data-selected="false"][data-parent-id="root-3"] > .css-caedy5',
          ],
        },
        {
          any: [
            {
              id: 'has-visible-text',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element has text that is visible to screen readers',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [
            {
              id: 'focusable-no-name',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element is not in tab order or has accessible text',
              '_constructor-name_': 'CheckResult',
            },
          ],
          impact: null,
          html: '<a tabindex="-1" href="/iframe.html?path=/story/lazy_root-3--child-a1" id="lazy_root-3--child-a1" class="css-caedy5"><div class="css-99l9qv"><svg viewBox="0 0 14 14" width="12" height="12" type="story" class="css-ndobih"><use xlink:href="#icon--story"></use></svg></div>Child A1</a>',
          target: [
            '.css-ocnlra > div > div[data-highlighted-ref-id="storybook_internal"] > .css-1d0gimt[data-title="Lazy loaded ref"] > .css-159egyp > div[data-item-id="root-3--child-a1"][data-selected="false"][data-parent-id="root-3"] > .css-caedy5',
          ],
        },
        {
          any: [
            {
              id: 'has-visible-text',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element has text that is visible to screen readers',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [
            {
              id: 'focusable-no-name',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element is not in tab order or has accessible text',
              '_constructor-name_': 'CheckResult',
            },
          ],
          impact: null,
          html: '<a tabindex="-1" href="/iframe.html?path=/story/root-1-child-a2--grandchild-a1-1" id="root-1-child-a2--grandchild-a1-1" class="css-xwriep">',
          target: [
            '.css-1x6s7u8 > div > div[data-highlighted-ref-id="storybook_internal"] > .css-79elbk[data-title="storybook_internal"] > .css-ohbggj > div[data-selected="true"][data-parent-id="root-1-child-a2"][data-nodetype="story"] > .css-xwriep',
          ],
        },
        {
          any: [
            {
              id: 'has-visible-text',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element has text that is visible to screen readers',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [
            {
              id: 'focusable-no-name',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element is not in tab order or has accessible text',
              '_constructor-name_': 'CheckResult',
            },
          ],
          impact: null,
          html: '<a href="#storybook-preview-wrapper" class="css-1eed3ko">Skip to canvas</a>',
          target: ['.css-1eed3ko'],
        },
        {
          any: [
            {
              id: 'has-visible-text',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element has text that is visible to screen readers',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [
            {
              id: 'focusable-no-name',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element is not in tab order or has accessible text',
              '_constructor-name_': 'CheckResult',
            },
          ],
          impact: null,
          html: '<a tabindex="-1" href="/iframe.html?path=/story/root-1-child-a2--grandchild-a1-2" id="root-1-child-a2--grandchild-a1-2" class="css-xwriep">',
          target: [
            '.css-1x6s7u8 > div > div[data-highlighted-ref-id="storybook_internal"] > .css-79elbk[data-title="storybook_internal"] > .css-ohbggj > div[data-parent-id="root-1-child-a2"][data-selected="false"][data-nodetype="story"] > .css-xwriep',
          ],
        },
        {
          any: [
            {
              id: 'has-visible-text',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element has text that is visible to screen readers',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [
            {
              id: 'focusable-no-name',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element is not in tab order or has accessible text',
              '_constructor-name_': 'CheckResult',
            },
          ],
          impact: null,
          html: '<a tabindex="-1" href="/iframe.html?path=/story/root-3--child-a1" id="root-3--child-a1" class="css-caedy5"><div class="css-99l9qv"><svg viewBox="0 0 14 14" width="12" height="12" type="story" class="css-ndobih"><use xlink:href="#icon--story"></use></svg></div>Child A1</a>',
          target: [
            '.css-1x6s7u8 > div > div[data-highlighted-ref-id="storybook_internal"] > .css-79elbk[data-title="storybook_internal"] > .css-ohbggj > div[data-item-id="root-3--child-a1"][data-selected="false"][data-parent-id="root-3"] > .css-caedy5',
          ],
        },
        {
          any: [
            {
              id: 'has-visible-text',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element has text that is visible to screen readers',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [
            {
              id: 'focusable-no-name',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element is not in tab order or has accessible text',
              '_constructor-name_': 'CheckResult',
            },
          ],
          impact: null,
          html: '<a tabindex="-1" href="/iframe.html?path=/story/lazy_root-3--child-a1" id="lazy_root-3--child-a1" class="css-caedy5"><div class="css-99l9qv"><svg viewBox="0 0 14 14" width="12" height="12" type="story" class="css-ndobih"><use xlink:href="#icon--story"></use></svg></div>Child A1</a>',
          target: [
            '.css-1x6s7u8 > div > div[data-highlighted-ref-id="storybook_internal"] > .css-1d0gimt[data-title="Lazy loaded ref"] > .css-159egyp > div[data-item-id="root-3--child-a1"][data-selected="false"][data-parent-id="root-3"] > .css-caedy5',
          ],
        },
      ],
    },
    {
      id: 'nested-interactive',
      impact: null,
      tags: ['cat.keyboard', 'wcag2a', 'wcag412', 'TTv5', 'TT6.a', 'EN-301-549', 'EN-9.4.1.2'],
      description:
        'Ensure interactive controls are not nested as they are not always announced by screen readers or can cause focus problems for assistive technologies',
      help: 'Interactive controls must not be nested',
      helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/nested-interactive?application=axeAPI',
      nodes: [
        {
          any: [
            {
              id: 'no-focusable-content',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element does not have focusable descendants',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="group-1" aria-controls="group-1--child-b1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-ohbggj > .css-ld0a14[data-item-id="group-1"][data-nodetype="group"] > .css-154pbrb[aria-controls="group-1--child-b1"]',
          ],
        },
        {
          any: [
            {
              id: 'no-focusable-content',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element does not have focusable descendants',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button type="button" data-action="collapse-root" aria-expanded="true" class="css-h7e28b">',
          target: [
            '.css-ohbggj > .css-1ikkmhb.sidebar-subheading[data-item-id="root-1"] > .css-h7e28b[type="button"][data-action="collapse-root"]',
          ],
        },
        {
          any: [
            {
              id: 'no-focusable-content',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element does not have focusable descendants',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button class="sidebar-subheading-action css-18rvurk" aria-label="Collapse" data-action="expand-all" data-expanded="false">',
          target: [
            '.css-ohbggj > .css-1ikkmhb.sidebar-subheading[data-item-id="root-1"] > .sidebar-subheading-action.css-18rvurk[aria-label="Collapse"]',
          ],
        },
        {
          any: [
            {
              id: 'no-focusable-content',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element does not have focusable descendants',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="root-1-child-a1" aria-expanded="false" class="css-1vdojxu"><div class="css-99l9qv"><svg viewBox="0 0 14 14" width="12" height="12" type="component" class="css-1e3avu6"><use xlink:href="#icon--component"></use></svg></div>Child A1</button>',
          target: [
            '.css-ohbggj > .css-ld0a14[data-item-id="root-1-child-a1"][data-parent-id="root-1"] > .css-1vdojxu',
          ],
        },
        {
          any: [
            {
              id: 'no-focusable-content',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element does not have focusable descendants',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="root-1-child-a2" aria-controls="root-1-child-a2--grandchild-a1-1" aria-expanded="true" class="css-154pbrb">',
          target: [
            '.css-ohbggj > .css-ld0a14[data-item-id="root-1-child-a2"][data-parent-id="root-1"] > .css-154pbrb',
          ],
        },
        {
          any: [
            {
              id: 'no-focusable-content',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element does not have focusable descendants',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button type="button" data-action="collapse-root" aria-expanded="true" class="css-h7e28b">',
          target: [
            '.css-ohbggj > .css-1ikkmhb.sidebar-subheading[data-item-id="root-3"] > .css-h7e28b[type="button"][data-action="collapse-root"]',
          ],
        },
        {
          any: [
            {
              id: 'no-focusable-content',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element does not have focusable descendants',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button class="sidebar-subheading-action css-18rvurk" aria-label="Collapse" data-action="expand-all" data-expanded="false">',
          target: [
            '.css-ohbggj > .css-1ikkmhb.sidebar-subheading[data-item-id="root-3"] > .sidebar-subheading-action.css-18rvurk[aria-label="Collapse"]',
          ],
        },
        {
          any: [
            {
              id: 'no-focusable-content',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element does not have focusable descendants',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="root-3-child-a2" aria-controls="root-3-child-a2--grandchild-a1-1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-ohbggj > .css-ld0a14[data-item-id="root-3-child-a2"][data-parent-id="root-3"] > .css-154pbrb',
          ],
        },
        {
          any: [
            {
              id: 'no-focusable-content',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element does not have focusable descendants',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button data-action="collapse-ref" class="css-1i0dglu">',
          target: [
            '.css-8kwxkl[aria-label="Hide Basic ref stories"] > .css-1i0dglu[data-action="collapse-ref"]',
          ],
        },
        {
          any: [
            {
              id: 'no-focusable-content',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element does not have focusable descendants',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="basic_root-1" aria-controls="root-1-child-a1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-ocnlra > div > div[data-highlighted-ref-id="storybook_internal"] > .css-1d0gimt[data-title="Basic ref"] > .css-159egyp > div[data-ref-id="basic"][data-item-id="root-1"][data-nodetype="group"] > .css-154pbrb[aria-controls="root-1-child-a1"]',
          ],
        },
        {
          any: [
            {
              id: 'no-focusable-content',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element does not have focusable descendants',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="basic_group-1" aria-controls="group-1--child-b1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-ld0a14[data-ref-id="basic"][data-item-id="group-1"] > .css-154pbrb[aria-controls="group-1--child-b1"]',
          ],
        },
        {
          any: [
            {
              id: 'no-focusable-content',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element does not have focusable descendants',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button data-action="collapse-ref" class="css-1i0dglu">',
          target: [
            '.css-8kwxkl[aria-label="Hide Not ready stories"] > .css-1i0dglu[data-action="collapse-ref"]',
          ],
        },
        {
          any: [
            {
              id: 'no-focusable-content',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element does not have focusable descendants',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button data-action="collapse-ref" class="css-1i0dglu">',
          target: [
            '.css-8kwxkl[aria-label="Hide Unknown ref stories"] > .css-1i0dglu[data-action="collapse-ref"]',
          ],
        },
        {
          any: [
            {
              id: 'no-focusable-content',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element does not have focusable descendants',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button data-action="collapse-ref" class="css-1i0dglu">',
          target: [
            '.css-8kwxkl[aria-label="Hide Lazy loaded ref stories"] > .css-1i0dglu[data-action="collapse-ref"]',
          ],
        },
        {
          any: [
            {
              id: 'no-focusable-content',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element does not have focusable descendants',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="lazy_group-1" aria-controls="group-1--child-b1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-159egyp > .css-ld0a14[data-item-id="group-1"][data-nodetype="group"] > .css-154pbrb[aria-controls="group-1--child-b1"]',
          ],
        },
        {
          any: [
            {
              id: 'no-focusable-content',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element does not have focusable descendants',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button type="button" data-action="collapse-root" aria-expanded="true" class="css-h7e28b">',
          target: [
            '.css-159egyp > .css-1ikkmhb.sidebar-subheading[data-item-id="root-1"] > .css-h7e28b[type="button"][data-action="collapse-root"]',
          ],
        },
        {
          any: [
            {
              id: 'no-focusable-content',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element does not have focusable descendants',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button class="sidebar-subheading-action css-18rvurk" aria-label="Collapse" data-action="expand-all" data-expanded="false">',
          target: [
            '.css-159egyp > .css-1ikkmhb.sidebar-subheading[data-item-id="root-1"] > .sidebar-subheading-action.css-18rvurk[aria-label="Collapse"]',
          ],
        },
        {
          any: [
            {
              id: 'no-focusable-content',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element does not have focusable descendants',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="lazy_root-1-child-a1" aria-expanded="false" class="css-1vdojxu"><div class="css-99l9qv"><svg viewBox="0 0 14 14" width="12" height="12" type="component" class="css-1e3avu6"><use xlink:href="#icon--component"></use></svg></div>Child A1</button>',
          target: [
            '.css-159egyp > .css-ld0a14[data-item-id="root-1-child-a1"][data-parent-id="root-1"] > .css-1vdojxu',
          ],
        },
        {
          any: [
            {
              id: 'no-focusable-content',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element does not have focusable descendants',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="lazy_root-1-child-a2" aria-controls="root-1-child-a2--grandchild-a1-1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-159egyp > .css-ld0a14[data-item-id="root-1-child-a2"][data-parent-id="root-1"] > .css-154pbrb',
          ],
        },
        {
          any: [
            {
              id: 'no-focusable-content',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element does not have focusable descendants',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button type="button" data-action="collapse-root" aria-expanded="true" class="css-h7e28b">',
          target: [
            '.css-159egyp > .css-1ikkmhb.sidebar-subheading[data-item-id="root-3"] > .css-h7e28b[type="button"][data-action="collapse-root"]',
          ],
        },
        {
          any: [
            {
              id: 'no-focusable-content',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element does not have focusable descendants',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button class="sidebar-subheading-action css-18rvurk" aria-label="Collapse" data-action="expand-all" data-expanded="false">',
          target: [
            '.css-159egyp > .css-1ikkmhb.sidebar-subheading[data-item-id="root-3"] > .sidebar-subheading-action.css-18rvurk[aria-label="Collapse"]',
          ],
        },
        {
          any: [
            {
              id: 'no-focusable-content',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element does not have focusable descendants',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="lazy_root-3-child-a2" aria-controls="root-3-child-a2--grandchild-a1-1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-159egyp > .css-ld0a14[data-item-id="root-3-child-a2"][data-parent-id="root-3"] > .css-154pbrb',
          ],
        },
        {
          any: [
            {
              id: 'no-focusable-content',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element does not have focusable descendants',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="group-1" aria-controls="group-1--child-b1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-ohbggj > .css-qyeqia[data-item-id="group-1"][data-nodetype="group"] > .css-154pbrb[aria-controls="group-1--child-b1"]',
          ],
        },
        {
          any: [
            {
              id: 'no-focusable-content',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element does not have focusable descendants',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button type="button" data-action="collapse-root" aria-expanded="true" class="css-h7e28b">',
          target: [
            '.css-ohbggj > .css-170ite8.sidebar-subheading[data-item-id="root-1"] > .css-h7e28b[type="button"][data-action="collapse-root"]',
          ],
        },
        {
          any: [
            {
              id: 'no-focusable-content',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element does not have focusable descendants',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button class="sidebar-subheading-action css-18rvurk" aria-label="Collapse" data-action="expand-all" data-expanded="false">',
          target: [
            '.css-ohbggj > .css-170ite8.sidebar-subheading[data-item-id="root-1"] > .sidebar-subheading-action.css-18rvurk[aria-label="Collapse"]',
          ],
        },
        {
          any: [
            {
              id: 'no-focusable-content',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element does not have focusable descendants',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="root-1-child-a1" aria-expanded="false" class="css-1vdojxu"><div class="css-99l9qv"><svg viewBox="0 0 14 14" width="12" height="12" type="component" class="css-1e3avu6"><use xlink:href="#icon--component"></use></svg></div>Child A1</button>',
          target: [
            '.css-ohbggj > .css-qyeqia[data-item-id="root-1-child-a1"][data-parent-id="root-1"] > .css-1vdojxu',
          ],
        },
        {
          any: [
            {
              id: 'no-focusable-content',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element does not have focusable descendants',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="root-1-child-a2" aria-controls="root-1-child-a2--grandchild-a1-1" aria-expanded="true" class="css-154pbrb">',
          target: [
            '.css-ohbggj > .css-qyeqia[data-item-id="root-1-child-a2"][data-parent-id="root-1"] > .css-154pbrb',
          ],
        },
        {
          any: [
            {
              id: 'no-focusable-content',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element does not have focusable descendants',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button type="button" data-action="collapse-root" aria-expanded="true" class="css-h7e28b">',
          target: [
            '.css-ohbggj > .css-170ite8.sidebar-subheading[data-item-id="root-3"] > .css-h7e28b[type="button"][data-action="collapse-root"]',
          ],
        },
        {
          any: [
            {
              id: 'no-focusable-content',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element does not have focusable descendants',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button class="sidebar-subheading-action css-18rvurk" aria-label="Collapse" data-action="expand-all" data-expanded="false">',
          target: [
            '.css-ohbggj > .css-170ite8.sidebar-subheading[data-item-id="root-3"] > .sidebar-subheading-action.css-18rvurk[aria-label="Collapse"]',
          ],
        },
        {
          any: [
            {
              id: 'no-focusable-content',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element does not have focusable descendants',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="root-3-child-a2" aria-controls="root-3-child-a2--grandchild-a1-1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-ohbggj > .css-qyeqia[data-item-id="root-3-child-a2"][data-parent-id="root-3"] > .css-154pbrb',
          ],
        },
        {
          any: [
            {
              id: 'no-focusable-content',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element does not have focusable descendants',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button data-action="collapse-ref" class="css-1i0dglu">',
          target: [
            '.css-9whvue[aria-label="Hide Basic ref stories"] > .css-1i0dglu[data-action="collapse-ref"]',
          ],
        },
        {
          any: [
            {
              id: 'no-focusable-content',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element does not have focusable descendants',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="basic_root-1" aria-controls="root-1-child-a1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-1x6s7u8 > div > div[data-highlighted-ref-id="storybook_internal"] > .css-1d0gimt[data-title="Basic ref"] > .css-159egyp > div[data-ref-id="basic"][data-item-id="root-1"][data-nodetype="group"] > .css-154pbrb[aria-controls="root-1-child-a1"]',
          ],
        },
        {
          any: [
            {
              id: 'no-focusable-content',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element does not have focusable descendants',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="basic_group-1" aria-controls="group-1--child-b1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-qyeqia[data-ref-id="basic"][data-item-id="group-1"] > .css-154pbrb[aria-controls="group-1--child-b1"]',
          ],
        },
        {
          any: [
            {
              id: 'no-focusable-content',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element does not have focusable descendants',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button data-action="collapse-ref" class="css-1i0dglu">',
          target: [
            '.css-9whvue[aria-label="Hide Not ready stories"] > .css-1i0dglu[data-action="collapse-ref"]',
          ],
        },
        {
          any: [
            {
              id: 'no-focusable-content',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element does not have focusable descendants',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button data-action="collapse-ref" class="css-1i0dglu">',
          target: [
            '.css-9whvue[aria-label="Hide Unknown ref stories"] > .css-1i0dglu[data-action="collapse-ref"]',
          ],
        },
        {
          any: [
            {
              id: 'no-focusable-content',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element does not have focusable descendants',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button data-action="collapse-ref" class="css-1i0dglu">',
          target: [
            '.css-9whvue[aria-label="Hide Lazy loaded ref stories"] > .css-1i0dglu[data-action="collapse-ref"]',
          ],
        },
        {
          any: [
            {
              id: 'no-focusable-content',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element does not have focusable descendants',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="lazy_group-1" aria-controls="group-1--child-b1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-159egyp > .css-qyeqia[data-item-id="group-1"][data-nodetype="group"] > .css-154pbrb[aria-controls="group-1--child-b1"]',
          ],
        },
        {
          any: [
            {
              id: 'no-focusable-content',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element does not have focusable descendants',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button type="button" data-action="collapse-root" aria-expanded="true" class="css-h7e28b">',
          target: [
            '.css-159egyp > .css-170ite8.sidebar-subheading[data-item-id="root-1"] > .css-h7e28b[type="button"][data-action="collapse-root"]',
          ],
        },
        {
          any: [
            {
              id: 'no-focusable-content',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element does not have focusable descendants',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button class="sidebar-subheading-action css-18rvurk" aria-label="Collapse" data-action="expand-all" data-expanded="false">',
          target: [
            '.css-159egyp > .css-170ite8.sidebar-subheading[data-item-id="root-1"] > .sidebar-subheading-action.css-18rvurk[aria-label="Collapse"]',
          ],
        },
        {
          any: [
            {
              id: 'no-focusable-content',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element does not have focusable descendants',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="lazy_root-1-child-a1" aria-expanded="false" class="css-1vdojxu"><div class="css-99l9qv"><svg viewBox="0 0 14 14" width="12" height="12" type="component" class="css-1e3avu6"><use xlink:href="#icon--component"></use></svg></div>Child A1</button>',
          target: [
            '.css-159egyp > .css-qyeqia[data-item-id="root-1-child-a1"][data-parent-id="root-1"] > .css-1vdojxu',
          ],
        },
        {
          any: [
            {
              id: 'no-focusable-content',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element does not have focusable descendants',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="lazy_root-1-child-a2" aria-controls="root-1-child-a2--grandchild-a1-1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-159egyp > .css-qyeqia[data-item-id="root-1-child-a2"][data-parent-id="root-1"] > .css-154pbrb',
          ],
        },
        {
          any: [
            {
              id: 'no-focusable-content',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element does not have focusable descendants',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button type="button" data-action="collapse-root" aria-expanded="true" class="css-h7e28b">',
          target: [
            '.css-159egyp > .css-170ite8.sidebar-subheading[data-item-id="root-3"] > .css-h7e28b[type="button"][data-action="collapse-root"]',
          ],
        },
        {
          any: [
            {
              id: 'no-focusable-content',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element does not have focusable descendants',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button class="sidebar-subheading-action css-18rvurk" aria-label="Collapse" data-action="expand-all" data-expanded="false">',
          target: [
            '.css-159egyp > .css-170ite8.sidebar-subheading[data-item-id="root-3"] > .sidebar-subheading-action.css-18rvurk[aria-label="Collapse"]',
          ],
        },
        {
          any: [
            {
              id: 'no-focusable-content',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element does not have focusable descendants',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="lazy_root-3-child-a2" aria-controls="root-3-child-a2--grandchild-a1-1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-159egyp > .css-qyeqia[data-item-id="root-3-child-a2"][data-parent-id="root-3"] > .css-154pbrb',
          ],
        },
      ],
    },
    {
      id: 'tabindex',
      impact: null,
      tags: ['cat.keyboard', 'best-practice'],
      description: 'Ensure tabindex attribute values are not greater than 0',
      help: 'Elements should not have tabindex greater than zero',
      helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/tabindex?application=axeAPI',
      nodes: [
        {
          any: [
            {
              id: 'tabindex',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element does not have a tabindex greater than 0',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="group-1" aria-controls="group-1--child-b1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-ohbggj > .css-ld0a14[data-item-id="group-1"][data-nodetype="group"] > .css-154pbrb[aria-controls="group-1--child-b1"]',
          ],
        },
        {
          any: [
            {
              id: 'tabindex',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element does not have a tabindex greater than 0',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="root-1-child-a1" aria-expanded="false" class="css-1vdojxu"><div class="css-99l9qv"><svg viewBox="0 0 14 14" width="12" height="12" type="component" class="css-1e3avu6"><use xlink:href="#icon--component"></use></svg></div>Child A1</button>',
          target: [
            '.css-ohbggj > .css-ld0a14[data-item-id="root-1-child-a1"][data-parent-id="root-1"] > .css-1vdojxu',
          ],
        },
        {
          any: [
            {
              id: 'tabindex',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element does not have a tabindex greater than 0',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="root-1-child-a2" aria-controls="root-1-child-a2--grandchild-a1-1" aria-expanded="true" class="css-154pbrb">',
          target: [
            '.css-ohbggj > .css-ld0a14[data-item-id="root-1-child-a2"][data-parent-id="root-1"] > .css-154pbrb',
          ],
        },
        {
          any: [
            {
              id: 'tabindex',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element does not have a tabindex greater than 0',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<a tabindex="-1" href="/iframe.html?path=/story/root-1-child-a2--grandchild-a1-1" id="root-1-child-a2--grandchild-a1-1" class="css-xwriep">',
          target: [
            '.css-ocnlra > div > div[data-highlighted-ref-id="storybook_internal"] > .css-79elbk[data-title="storybook_internal"] > .css-ohbggj > div[data-selected="true"][data-parent-id="root-1-child-a2"][data-nodetype="story"] > .css-xwriep',
          ],
        },
        {
          any: [
            {
              id: 'tabindex',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element does not have a tabindex greater than 0',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<a tabindex="-1" href="/iframe.html?path=/story/root-1-child-a2--grandchild-a1-2" id="root-1-child-a2--grandchild-a1-2" class="css-xwriep">',
          target: [
            '.css-ocnlra > div > div[data-highlighted-ref-id="storybook_internal"] > .css-79elbk[data-title="storybook_internal"] > .css-ohbggj > div[data-parent-id="root-1-child-a2"][data-selected="false"][data-nodetype="story"] > .css-xwriep',
          ],
        },
        {
          any: [
            {
              id: 'tabindex',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element does not have a tabindex greater than 0',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<a tabindex="-1" href="/iframe.html?path=/story/root-3--child-a1" id="root-3--child-a1" class="css-caedy5"><div class="css-99l9qv"><svg viewBox="0 0 14 14" width="12" height="12" type="story" class="css-ndobih"><use xlink:href="#icon--story"></use></svg></div>Child A1</a>',
          target: [
            '.css-ocnlra > div > div[data-highlighted-ref-id="storybook_internal"] > .css-79elbk[data-title="storybook_internal"] > .css-ohbggj > div[data-item-id="root-3--child-a1"][data-selected="false"][data-parent-id="root-3"] > .css-caedy5',
          ],
        },
        {
          any: [
            {
              id: 'tabindex',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element does not have a tabindex greater than 0',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="root-3-child-a2" aria-controls="root-3-child-a2--grandchild-a1-1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-ohbggj > .css-ld0a14[data-item-id="root-3-child-a2"][data-parent-id="root-3"] > .css-154pbrb',
          ],
        },
        {
          any: [
            {
              id: 'tabindex',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element does not have a tabindex greater than 0',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="basic_root-1" aria-controls="root-1-child-a1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-ocnlra > div > div[data-highlighted-ref-id="storybook_internal"] > .css-1d0gimt[data-title="Basic ref"] > .css-159egyp > div[data-ref-id="basic"][data-item-id="root-1"][data-nodetype="group"] > .css-154pbrb[aria-controls="root-1-child-a1"]',
          ],
        },
        {
          any: [
            {
              id: 'tabindex',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element does not have a tabindex greater than 0',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="basic_group-1" aria-controls="group-1--child-b1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-ld0a14[data-ref-id="basic"][data-item-id="group-1"] > .css-154pbrb[aria-controls="group-1--child-b1"]',
          ],
        },
        {
          any: [
            {
              id: 'tabindex',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element does not have a tabindex greater than 0',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="lazy_group-1" aria-controls="group-1--child-b1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-159egyp > .css-ld0a14[data-item-id="group-1"][data-nodetype="group"] > .css-154pbrb[aria-controls="group-1--child-b1"]',
          ],
        },
        {
          any: [
            {
              id: 'tabindex',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element does not have a tabindex greater than 0',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="lazy_root-1-child-a1" aria-expanded="false" class="css-1vdojxu"><div class="css-99l9qv"><svg viewBox="0 0 14 14" width="12" height="12" type="component" class="css-1e3avu6"><use xlink:href="#icon--component"></use></svg></div>Child A1</button>',
          target: [
            '.css-159egyp > .css-ld0a14[data-item-id="root-1-child-a1"][data-parent-id="root-1"] > .css-1vdojxu',
          ],
        },
        {
          any: [
            {
              id: 'tabindex',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element does not have a tabindex greater than 0',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="lazy_root-1-child-a2" aria-controls="root-1-child-a2--grandchild-a1-1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-159egyp > .css-ld0a14[data-item-id="root-1-child-a2"][data-parent-id="root-1"] > .css-154pbrb',
          ],
        },
        {
          any: [
            {
              id: 'tabindex',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element does not have a tabindex greater than 0',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<a tabindex="-1" href="/iframe.html?path=/story/lazy_root-3--child-a1" id="lazy_root-3--child-a1" class="css-caedy5"><div class="css-99l9qv"><svg viewBox="0 0 14 14" width="12" height="12" type="story" class="css-ndobih"><use xlink:href="#icon--story"></use></svg></div>Child A1</a>',
          target: [
            '.css-ocnlra > div > div[data-highlighted-ref-id="storybook_internal"] > .css-1d0gimt[data-title="Lazy loaded ref"] > .css-159egyp > div[data-item-id="root-3--child-a1"][data-selected="false"][data-parent-id="root-3"] > .css-caedy5',
          ],
        },
        {
          any: [
            {
              id: 'tabindex',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element does not have a tabindex greater than 0',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="lazy_root-3-child-a2" aria-controls="root-3-child-a2--grandchild-a1-1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-159egyp > .css-ld0a14[data-item-id="root-3-child-a2"][data-parent-id="root-3"] > .css-154pbrb',
          ],
        },
        {
          any: [
            {
              id: 'tabindex',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element does not have a tabindex greater than 0',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="group-1" aria-controls="group-1--child-b1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-ohbggj > .css-qyeqia[data-item-id="group-1"][data-nodetype="group"] > .css-154pbrb[aria-controls="group-1--child-b1"]',
          ],
        },
        {
          any: [
            {
              id: 'tabindex',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element does not have a tabindex greater than 0',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="root-1-child-a1" aria-expanded="false" class="css-1vdojxu"><div class="css-99l9qv"><svg viewBox="0 0 14 14" width="12" height="12" type="component" class="css-1e3avu6"><use xlink:href="#icon--component"></use></svg></div>Child A1</button>',
          target: [
            '.css-ohbggj > .css-qyeqia[data-item-id="root-1-child-a1"][data-parent-id="root-1"] > .css-1vdojxu',
          ],
        },
        {
          any: [
            {
              id: 'tabindex',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element does not have a tabindex greater than 0',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="root-1-child-a2" aria-controls="root-1-child-a2--grandchild-a1-1" aria-expanded="true" class="css-154pbrb">',
          target: [
            '.css-ohbggj > .css-qyeqia[data-item-id="root-1-child-a2"][data-parent-id="root-1"] > .css-154pbrb',
          ],
        },
        {
          any: [
            {
              id: 'tabindex',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element does not have a tabindex greater than 0',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<a tabindex="-1" href="/iframe.html?path=/story/root-1-child-a2--grandchild-a1-1" id="root-1-child-a2--grandchild-a1-1" class="css-xwriep">',
          target: [
            '.css-1x6s7u8 > div > div[data-highlighted-ref-id="storybook_internal"] > .css-79elbk[data-title="storybook_internal"] > .css-ohbggj > div[data-selected="true"][data-parent-id="root-1-child-a2"][data-nodetype="story"] > .css-xwriep',
          ],
        },
        {
          any: [
            {
              id: 'tabindex',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element does not have a tabindex greater than 0',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<a tabindex="-1" href="/iframe.html?path=/story/root-1-child-a2--grandchild-a1-2" id="root-1-child-a2--grandchild-a1-2" class="css-xwriep">',
          target: [
            '.css-1x6s7u8 > div > div[data-highlighted-ref-id="storybook_internal"] > .css-79elbk[data-title="storybook_internal"] > .css-ohbggj > div[data-parent-id="root-1-child-a2"][data-selected="false"][data-nodetype="story"] > .css-xwriep',
          ],
        },
        {
          any: [
            {
              id: 'tabindex',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element does not have a tabindex greater than 0',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<a tabindex="-1" href="/iframe.html?path=/story/root-3--child-a1" id="root-3--child-a1" class="css-caedy5"><div class="css-99l9qv"><svg viewBox="0 0 14 14" width="12" height="12" type="story" class="css-ndobih"><use xlink:href="#icon--story"></use></svg></div>Child A1</a>',
          target: [
            '.css-1x6s7u8 > div > div[data-highlighted-ref-id="storybook_internal"] > .css-79elbk[data-title="storybook_internal"] > .css-ohbggj > div[data-item-id="root-3--child-a1"][data-selected="false"][data-parent-id="root-3"] > .css-caedy5',
          ],
        },
        {
          any: [
            {
              id: 'tabindex',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element does not have a tabindex greater than 0',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="root-3-child-a2" aria-controls="root-3-child-a2--grandchild-a1-1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-ohbggj > .css-qyeqia[data-item-id="root-3-child-a2"][data-parent-id="root-3"] > .css-154pbrb',
          ],
        },
        {
          any: [
            {
              id: 'tabindex',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element does not have a tabindex greater than 0',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="basic_root-1" aria-controls="root-1-child-a1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-1x6s7u8 > div > div[data-highlighted-ref-id="storybook_internal"] > .css-1d0gimt[data-title="Basic ref"] > .css-159egyp > div[data-ref-id="basic"][data-item-id="root-1"][data-nodetype="group"] > .css-154pbrb[aria-controls="root-1-child-a1"]',
          ],
        },
        {
          any: [
            {
              id: 'tabindex',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element does not have a tabindex greater than 0',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="basic_group-1" aria-controls="group-1--child-b1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-qyeqia[data-ref-id="basic"][data-item-id="group-1"] > .css-154pbrb[aria-controls="group-1--child-b1"]',
          ],
        },
        {
          any: [
            {
              id: 'tabindex',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element does not have a tabindex greater than 0',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="lazy_group-1" aria-controls="group-1--child-b1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-159egyp > .css-qyeqia[data-item-id="group-1"][data-nodetype="group"] > .css-154pbrb[aria-controls="group-1--child-b1"]',
          ],
        },
        {
          any: [
            {
              id: 'tabindex',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element does not have a tabindex greater than 0',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="lazy_root-1-child-a1" aria-expanded="false" class="css-1vdojxu"><div class="css-99l9qv"><svg viewBox="0 0 14 14" width="12" height="12" type="component" class="css-1e3avu6"><use xlink:href="#icon--component"></use></svg></div>Child A1</button>',
          target: [
            '.css-159egyp > .css-qyeqia[data-item-id="root-1-child-a1"][data-parent-id="root-1"] > .css-1vdojxu',
          ],
        },
        {
          any: [
            {
              id: 'tabindex',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element does not have a tabindex greater than 0',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="lazy_root-1-child-a2" aria-controls="root-1-child-a2--grandchild-a1-1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-159egyp > .css-qyeqia[data-item-id="root-1-child-a2"][data-parent-id="root-1"] > .css-154pbrb',
          ],
        },
        {
          any: [
            {
              id: 'tabindex',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element does not have a tabindex greater than 0',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<a tabindex="-1" href="/iframe.html?path=/story/lazy_root-3--child-a1" id="lazy_root-3--child-a1" class="css-caedy5"><div class="css-99l9qv"><svg viewBox="0 0 14 14" width="12" height="12" type="story" class="css-ndobih"><use xlink:href="#icon--story"></use></svg></div>Child A1</a>',
          target: [
            '.css-1x6s7u8 > div > div[data-highlighted-ref-id="storybook_internal"] > .css-1d0gimt[data-title="Lazy loaded ref"] > .css-159egyp > div[data-item-id="root-3--child-a1"][data-selected="false"][data-parent-id="root-3"] > .css-caedy5',
          ],
        },
        {
          any: [
            {
              id: 'tabindex',
              data: null,
              relatedNodes: [],
              impact: 'serious',
              message: 'Element does not have a tabindex greater than 0',
              '_constructor-name_': 'CheckResult',
            },
          ],
          all: [],
          none: [],
          impact: null,
          html: '<button tabindex="-1" id="lazy_root-3-child-a2" aria-controls="root-3-child-a2--grandchild-a1-1" aria-expanded="false" class="css-154pbrb">',
          target: [
            '.css-159egyp > .css-qyeqia[data-item-id="root-3-child-a2"][data-parent-id="root-3"] > .css-154pbrb',
          ],
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
          html: '<div aria-label="Hide Basic ref stories" aria-expanded="true" class="css-9whvue">',
          target: ['.css-9whvue[aria-label="Hide Basic ref stories"]'],
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
          html: '<div aria-label="Hide Not ready stories" aria-expanded="true" class="css-9whvue">',
          target: ['.css-9whvue[aria-label="Hide Not ready stories"]'],
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
          html: '<div aria-label="Hide Unknown ref stories" aria-expanded="true" class="css-9whvue">',
          target: ['.css-9whvue[aria-label="Hide Unknown ref stories"]'],
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
          html: '<div aria-label="Hide Lazy loaded ref stories" aria-expanded="true" class="css-9whvue">',
          target: ['.css-9whvue[aria-label="Hide Lazy loaded ref stories"]'],
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
          html: '<div aria-label="Hide Basic ref stories" aria-expanded="true" class="css-9whvue">',
          target: ['.css-9whvue[aria-label="Hide Basic ref stories"]'],
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
          html: '<div aria-label="Hide Not ready stories" aria-expanded="true" class="css-9whvue">',
          target: ['.css-9whvue[aria-label="Hide Not ready stories"]'],
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
          html: '<div aria-label="Hide Unknown ref stories" aria-expanded="true" class="css-9whvue">',
          target: ['.css-9whvue[aria-label="Hide Unknown ref stories"]'],
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
          html: '<div aria-label="Hide Lazy loaded ref stories" aria-expanded="true" class="css-9whvue">',
          target: ['.css-9whvue[aria-label="Hide Lazy loaded ref stories"]'],
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
            '.css-159egyp > .css-170ite8.sidebar-subheading[data-item-id="root-1"] > .css-h7e28b[type="button"][data-action="collapse-root"]',
          ],
          failureSummary:
            'Fix any of the following:\n  Element has insufficient color contrast of 4.3 (foreground color: #798186, background color: #1b1c1d, font size: 8.3pt (11px), font weight: bold). Expected contrast ratio of 4.5:1',
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
            '.css-159egyp > .css-170ite8.sidebar-subheading[data-item-id="root-3"] > .css-h7e28b[type="button"][data-action="collapse-root"]',
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
};
