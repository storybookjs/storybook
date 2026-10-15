import React, { useState } from 'react';

import { PureArgsTable as ArgsTable } from '@storybook/addon-docs/blocks';

import PropTypes from 'prop-types';
import { storyNameFromExport } from 'storybook/internal/csf';
import { getService, inferControls } from 'storybook/preview-api';
import { ThemeProvider, convert, themes } from 'storybook/theming';

import { component as JsReactMemoComponent } from './docgen-components/9586-js-react-memo/input.jsx';
import { component as JsDefaultValuesComponent } from './docgen-components/9626-js-default-values/input.jsx';
import { component as JsFunctionComponentInlineDefaultsNoPropTypesComponent } from './docgen-components/js-function-component-inline-defaults-no-propTypes/input.jsx';
import { component as JsFunctionComponentInlineDefaultsComponent } from './docgen-components/js-function-component-inline-defaults/input.jsx';

// Detect if we are running in vite in a hacky way for now
const isVite = typeof require === 'undefined';

export default {
  // Portable stories in Vitest have no docgen server to load argTypes from.
  tags: ['!vitest'],
  // The docgen server only extracts subcomponents once `component` resolves to a real component.
  component: JsFunctionComponentInlineDefaultsComponent,
  // Listed so the docgen server extracts every component; each story shows its own entry.
  subcomponents: {
    JsFunctionComponentInlineDefaults: JsFunctionComponentInlineDefaultsComponent,
    JsFunctionComponentInlineDefaultsNoPropTypes:
      JsFunctionComponentInlineDefaultsNoPropTypesComponent,
    JsDefaultValues: JsDefaultValuesComponent,
    JsReactMemo: JsReactMemoComponent,
  },
  loaders: [
    async ({ componentId, name }) => {
      if (!globalThis.FEATURES?.docgenServer) {
        return {};
      }
      const docgen = await getService('core/docgen', { internal: true }).queries.docgen.loaded({
        id: componentId,
      });
      const [, subcomponent] =
        Object.entries(docgen?.subcomponents ?? {}).find(
          ([exportName]) => storyNameFromExport(exportName) === name
        ) ?? [];
      return { argTypes: subcomponent?.argTypes ?? {} };
    },
  ],
  render: (_, { loaded, parameters }) => (
    <ArgsStory
      argTypes={loaded.argTypes ?? parameters.docs.extractArgTypes(parameters.component)}
    />
  ),
  parameters: {
    chromatic: {
      disableSnapshot: isVite,
    },
  },
};

const ArgsStory = ({ argTypes }) => {
  const rows = inferControls({ argTypes, parameters: { __isArgsStory: true } });
  const [args, setArgs] = useState({});

  return (
    <ThemeProvider theme={convert(themes.light)}>
      <ArgsTable rows={rows} args={args} updateArgs={(val) => setArgs({ ...args, ...val })} />
    </ThemeProvider>
  );
};

ArgsStory.propTypes = {
  argTypes: PropTypes.object.isRequired,
};

export const JsFunctionComponentInlineDefaults = {
  parameters: { component: JsFunctionComponentInlineDefaultsComponent },
};

export const JsFunctionComponentInlineDefaultsNoPropTypes = {
  parameters: { component: JsFunctionComponentInlineDefaultsNoPropTypesComponent },
};

export const JsDefaultValues = { parameters: { component: JsDefaultValuesComponent } };

export const JsReactMemo = { parameters: { component: JsReactMemoComponent } };
