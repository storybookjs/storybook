/*! A license comment */
import React, { useState } from 'react';

import { addons, types } from 'storybook/manager-api';

import './style.css';

const Panel = () => <div>{useState(0)[0]}</div>;

addons.register('pure+css', () =>
  addons.add('pure+css/panel', {
    type: types.PANEL,
    render: Panel,
    mode: process.env.NODE_ENV,
    env: Object.keys(process.env),
    global: typeof global,
  })
);

if (module && module.hot && module.hot.decline) {
  module.hot.decline();
}
