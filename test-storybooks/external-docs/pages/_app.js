/* eslint-disable react/prop-types */
import React from 'react';
import 'nextra-theme-docs/style.css';
import { ExternalDocs } from '@storybook/addon-docs/blocks';

import * as reactAnnotations from '@storybook/react/preview';
import * as previewAnnotations from '../.storybook/preview';

export default function Nextra({ Component, pageProps }) {
  return (
    <ExternalDocs projectAnnotationsList={[reactAnnotations, previewAnnotations]}>
      <Component {...pageProps} />
    </ExternalDocs>
  );
}
