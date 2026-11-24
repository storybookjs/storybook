import React, { useState } from 'react';
import { addons } from 'storybook/manager-api';

const required = require('react');

globalThis.result = {
  version: React.version,
  useState: typeof useState,
  required: typeof required.useState,
  register: typeof addons.register,
};
