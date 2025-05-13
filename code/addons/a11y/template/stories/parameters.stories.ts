import { global as globalThis } from '@storybook/global';

export default {
  component: globalThis.__TEMPLATE_COMPONENTS__.Html,
  args: {
    content: '<button>Click Me!</button>',
  },
  parameters: {
    chromatic: { disable: true },
    a11y: {
      test: 'error',
    },
  },
};

export const Options = {
  args: {
    content:
      '<button style="color: rgb(255, 255, 255); background-color: rgb(76, 175, 80);">Click me!</button>',
  },
  parameters: {
    a11y: {
      config: {},
      options: {
        checks: {
          'color-contrast': { enabled: false },
        },
      },
    },
  },
};

export const Config = {
  args: {
    content:
      '<button style="color: rgb(255, 255, 255); background-color: rgb(76, 175, 80);">Click me!</button>',
  },
  parameters: {
    a11y: {
      config: {
        rules: [{ id: 'avoid-inline-spacing', options: {} }],
        disableOtherRules: true,
      },
      options: {},
    },
  },
};

export const SingleNodeContext = {
  args: {
    content: `
      <div id="custom-target">I have no violations</div>
      <div aria-role="nope!">I have a bad aria-role, but I'm outside the target so my violations will be ignored</div>
      `,
  },
  parameters: {
    a11y: {
      context: '#custom-target',
    },
  },
};

export const MultipleNodeContext = {
  args: {
    content: `
      <div id="first-custom-target">I have no violations</div>
      <div id="second-custom-target">I also have no violations</div>
      <div aria-role="nope!">I have a bad aria-role, but I'm outside the target so my violations will be ignored</div>
      `,
  },
  parameters: {
    a11y: {
      context: ['#first-custom-target', '#second-custom-target'],
    },
  },
};

export const IncludeAndExcludeContext = {
  args: {
    content: `
      <div id="parent-node">
        <div id="first-custom-target">I have no violations</div>
        <div aria-role="nope!" id="second-custom-target">I have a bad aria-role, but I'm explicitly excluded from the target so my violations will be ignored</div>
      </div>
      <div aria-role="nope!">I have a bad aria-role, but I'm outside the included target so my violations will be ignored</div>
      `,
  },
  parameters: {
    a11y: {
      context: {
        include: ['#parent-node'],
        exclude: ['#second-custom-target'],
      },
    },
  },
};

/*

TODO: this doesn't work, for some reason axe doesn't find any elements within the iframe
potentially related to https://github.com/dequelabs/axe-core/issues/4737
export const IncludeAndExcludeFromFramesContext = {
  args: {
    content: `
      <iframe id="parent-frame"
        srcdoc="
          ${`<div id="parent-node">
            <div id="first-custom-target">I have no violations</div>
            <div aria-role="nope!" id="second-custom-target">I have a bad aria-role, but I'm explicitly excluded from the target so my violations will be ignored</div>
          </div>`.replaceAll('"', '&quot;')}">
      </iframe>
      <div aria-role="nope!">I have a bad aria-role, but I'm outside the included targeted iframe so my violations will be ignored</div>
      `,
  },
  parameters: {
    a11y: {
      context: { fromFrames: ['iframe#parent-frame', '*'] },
    },
  },
};
*/

export const IncludeAndExcludeFromShadowDOMContext = {
  args: {
    content: `
      <div id="shadow-target"></div>
      <div aria-role="nope!">I have a bad aria-role, but I'm outside the targeted shadow DOM so my violations will be ignored</div>
    `,
  },
  parameters: {
    a11y: {
      context: {
        include: { fromShadowDom: ['#shadow-dom-host', '#parent-node'] },
        exclude: { fromShadowDom: ['#shadow-dom-host', '#second-shadow-dom-target'] },
      },
    },
  },
  play: () => {
    // See: https://dev.to/js_bits_bill/simplify-shadow-dom-with-sethtmlunsafe-1fne
    // using setHTMLUnsafe() doesn't work for some reason
    const shadowHost = document.createElement('div');
    shadowHost.id = 'shadow-dom-host';
    const shadowTemplate = document.createElement('template');
    shadowTemplate.innerHTML = `
      <div id="parent-node">
        <div id="first-shadow-dom-target">I'm in the shadow DOM without violations</div>
        <div id="second-shadow-dom-target" aria-role="nope!">I have a bad aria-role within the shadow DOM, but I'm explicitly excluded from the target so my violations will be ignored</div>
      </div>`;
    shadowHost
      .attachShadow({
        mode: 'open',
      })
      .appendChild(shadowTemplate.content.cloneNode(true));
    document.getElementById('shadow-target')!.appendChild(shadowHost);
  },
};

export const Disabled = {
  parameters: {
    a11y: {
      disable: true,
    },
  },
};
