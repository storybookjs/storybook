import React, { useState } from 'react';

import { inferControls } from 'storybook/internal/preview-api';
import { ThemeProvider, convert, themes } from 'storybook/internal/theming';

import { PureArgsTable as ArgsTable } from '@storybook/blocks';

import mapValues from 'lodash/mapValues.js';
import PropTypes from 'prop-types';

// import { component as JsStyledDocgenComponent } from './__testfixtures__/8279-js-styled-docgen/input';
import { component as JsPropTypesOneofComponent } from './docgen-components/8140-js-prop-types-oneof/input.jsx';
import { component as JsStaticPropTypesComponent } from './docgen-components/8428-js-static-prop-types/input.jsx';
import { component as JsHocComponent } from './docgen-components/9023-js-hoc/input.jsx';
import { component as JsProptypesShapeComponent } from './docgen-components/9399-js-proptypes-shape/input.jsx';
import { component as JsReactMemoComponent } from './docgen-components/9586-js-react-memo/input.jsx';
// import { component as JsStyledComponentsComponent } from './__testfixtures__/8663-js-styled-components/input';
import { component as JsDefaultValuesComponent } from './docgen-components/9626-js-default-values/input.jsx';
import { component as JsProptypesNoJsdocComponent } from './docgen-components/9668-js-proptypes-no-jsdoc/input.jsx';
import { component as JsClassComponentComponent } from './docgen-components/js-class-component/input.jsx';
import { component as JsFunctionComponentInlineDefaultsNoPropTypesComponent } from './docgen-components/js-function-component-inline-defaults-no-propTypes/input.jsx';
import { component as JsFunctionComponentInlineDefaultsComponent } from './docgen-components/js-function-component-inline-defaults/input.jsx';
import { component as JsFunctionComponentComponent } from './docgen-components/js-function-component/input.jsx';
import { component as JsProptypesComponent } from './docgen-components/js-proptypes/input.jsx';
import { component as JsRexportedComponentComponent } from './docgen-components/js-re-exported-component/input.jsx';
import { component as JsdocComponent } from './docgen-components/jsdoc/input.jsx';

// Detect if we are running in vite in a hacky way for now
const isVite = typeof require === 'undefined';

export default {
  component: {},
  render: (_, context) => <ArgsStory parameters={context.parameters} />,
  parameters: {
    chromatic: {
      disableSnapshot: isVite,
    },
  },
};

const ArgsStory = ({ parameters }) => {
  const argTypes = parameters.docs.extractArgTypes(parameters.component);
  const rows = inferControls({ argTypes, parameters: { __isArgsStory: true } });
  const initialArgs = mapValues(rows, (argType) => argType.defaultValue);
  const [args, setArgs] = useState(initialArgs);

  return (
    <ThemeProvider theme={convert(themes.light)}>
      <ArgsTable rows={rows} args={args} updateArgs={(val) => setArgs({ ...args, ...val })} />
    </ThemeProvider>
  );
};

ArgsStory.propTypes = {
  parameters: PropTypes.shape({
    component: PropTypes.elementType.isRequired,
    docs: PropTypes.shape({
      extractArgTypes: PropTypes.func.isRequired,
    }).isRequired,
  }).isRequired,
};

export const JsClassComponent = { parameters: { component: JsClassComponentComponent } };

export const JsFunctionComponent = { parameters: { component: JsFunctionComponentComponent } };

export const JsRexportedComponent = {
  parameters: { component: JsRexportedComponentComponent },
};

export const JsFunctionComponentInlineDefaults = {
  parameters: { component: JsFunctionComponentInlineDefaultsComponent },
};

export const JsFunctionComponentInlineDefaultsNoPropTypes = {
  parameters: { component: JsFunctionComponentInlineDefaultsNoPropTypesComponent },
};

export const JsProptypesShape = { parameters: { component: JsProptypesShapeComponent } };

// export const JsStyledComponents = { parameters: { component: JsStyledComponentsComponent } };

export const JsDefaultValues = { parameters: { component: JsDefaultValuesComponent } };

export const JsProptypesNoJsdoc = { parameters: { component: JsProptypesNoJsdocComponent } };

// export const JsStyledDocgen = { parameters: { component: JsStyledDocgenComponent } };

export const JsPropTypesOneof = { parameters: { component: JsPropTypesOneofComponent } };

export const JsHoc = { parameters: { component: JsHocComponent } };

export const JsReactMemo = { parameters: { component: JsReactMemoComponent } };

export const JsStaticPropTypes = { parameters: { component: JsStaticPropTypesComponent } };

export const Jsdoc = { parameters: { component: JsdocComponent } };

export const JsProptypes = { parameters: { component: JsProptypesComponent } };
