import type { RenderContext } from 'storybook/internal/types';

import { global } from '@storybook/global';

import { dedent } from 'ts-dedent';

import type { EmberRenderer, OptionsArgs } from './types';

const { document } = global;

declare let Ember: any;

const rootEl = document.getElementById('storybook-root');

function loadEmberApp() {
  const config = global.require(`${global.STORYBOOK_NAME}/config/environment`);
  return global.require(`${global.STORYBOOK_NAME}/app`).default.create({
    autoboot: false,
    rootElement: rootEl,
    ...config.APP,
  });
}

const app = loadEmberApp();
let lastPromise = app.boot();
let hasRendered = false;
let isRendering = false;

function render(options: OptionsArgs, el: EmberRenderer['canvasElement']) {
  if (isRendering) return;
  isRendering = true;

  const { template, context = {}, element } = options;

  if (hasRendered) {
    lastPromise = lastPromise.then((instance: any) => instance.destroy());
  }

  lastPromise = lastPromise
    .then(() => {
      const appInstancePrivate = app.buildInstance();
      return appInstancePrivate.boot().then(() => appInstancePrivate);
    })
    .then((instance: any) => {
      instance.register(
        'component:story-mode',
        Ember.Component.extend({
          layout: template || options,
          ...context,
        })
      );

      const component = instance.lookup('component:story-mode');

      if (element) {
        component.appendTo(element);

        element.appendTo(el);
      } else {
        component.appendTo(el);
      }
      hasRendered = true;
      isRendering = false;

      return instance;
    });
}

export function renderToCanvas(
  { storyFn, kind, name, showMain, showError }: RenderContext<EmberRenderer>,
  canvasElement: EmberRenderer['canvasElement']
) {
  const element = storyFn();

  if (!element) {
    showError({
      title: `Expecting a Ember element from the story: "${name}" of "${kind}".`,
      description: dedent`
        Did you forget to return the Ember element from the story?
        Use "() => hbs('{{component}}')" or "() => { return {
          template: hbs\`{{component}}\`
        } }" when defining the story.
      `,
    });
    return;
  }

  showMain();
  render(element, canvasElement);
}
