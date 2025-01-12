import React, { Fragment } from 'react';

import { EyeIcon } from '@storybook/icons';

import ListItem from './ListItem';

export default {
  component: ListItem,
};

export const All = {
  render: () => (
    <div>
      <ListItem loading />
      <ListItem title="Default" />
      <ListItem title="Default icon" right={<EyeIcon />} />
      <ListItem title="title" center="center" right="right" />
      <ListItem active title="active" center="center" right="right" />
      <ListItem active title="active icon" center="center" right={<EyeIcon />} />
      <ListItem disabled title="disabled" center="center" right="right" />
    </div>
  ),
};

export const Default = {
  args: {
    title: 'Default',
  },
};

export const Loading = {
  args: {
    loading: true,
  },
};

export const DefaultIcon = {
  args: {
    title: 'Default icon',
    right: <EyeIcon />,
  },
};
export const ActiveIcon = {
  args: {
    title: 'Active icon',
    active: true,
    right: <EyeIcon />,
  },
};
export const ActiveIconLeft = {
  args: {
    title: 'Active icon',
    active: true,
    icon: <EyeIcon />,
  },
};
export const ActiveIconLeftColored = {
  args: {
    title: 'Active icon',
    active: true,
    icon: (
      <Fragment>
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-label="Chrome"
        >
          <path
            d="M5.06982 9.68493L7.99484 4.63927L14.5786 4.62406C14.5252 4.52043 14.4696 4.41742 14.4109 4.31532C12.372 0.768556 7.84405 -0.453864 4.29726 1.58495C3.24614 2.1892 2.39921 3.01211 1.78076 3.96327L5.06982 9.68493Z"
            fill="#DB4437"
          />
          <path
            d="M10.9276 9.68457L5.09539 9.6743L1.79036 3.98022C1.72727 4.07822 1.66591 4.17795 1.60682 4.27985C-0.445348 7.81892 0.759985 12.3515 4.29905 14.4037C5.34791 15.0118 6.48403 15.3338 7.617 15.3939L10.9276 9.68457Z"
            fill="#0F9D58"
          />
          <path
            d="M7.98649 4.61194L10.9032 9.66241L7.63525 15.3778C7.75167 15.3833 7.86871 15.3863 7.98649 15.3863C12.0775 15.3863 15.3939 12.0699 15.3939 7.97893C15.3939 6.76648 15.1025 5.62211 14.5861 4.61194L7.98649 4.61194Z"
            fill="#FFCD40"
          />
          <path
            d="M8.01367 4.6366V6.40005L14.613 4.6366H8.01367Z"
            fill="url(#paint0_radial_466_21161)"
          />
          <path
            d="M1.78198 4.00098L6.60102 8.8192L5.09764 9.687L1.78198 4.00098Z"
            fill="url(#paint1_radial_466_21161)"
          />
          <path
            d="M7.6626 15.4017L9.42689 8.81921L10.9303 9.68702L7.6626 15.4017Z"
            fill="url(#paint2_radial_466_21161)"
          />
          <ellipse cx="8.01347" cy="8.00358" rx="3.36699" ry="3.36699" fill="#F1F1F1" />
          <ellipse cx="8.01367" cy="8.00354" rx="2.69361" ry="2.6936" fill="#4285F4" />
          <defs>
            <radialGradient
              id="paint0_radial_466_21161"
              cx="0"
              cy="0"
              r="1"
              gradientUnits="userSpaceOnUse"
              gradientTransform="translate(7.69229 4.63226) scale(7.07721 1.89116)"
            >
              <stop stopColor="#3E2723" stopOpacity="0.2" />
              <stop offset="1" stopColor="#3E2723" stopOpacity="0.01" />
            </radialGradient>
            <radialGradient
              id="paint1_radial_466_21161"
              cx="0"
              cy="0"
              r="1"
              gradientUnits="userSpaceOnUse"
              gradientTransform="translate(1.77445 4.00677) scale(6.56938 7.75127)"
            >
              <stop stopColor="#3E2723" stopOpacity="0.2" />
              <stop offset="1" stopColor="#3E2723" stopOpacity="0.01" />
            </radialGradient>
            <radialGradient
              id="paint2_radial_466_21161"
              cx="0"
              cy="0"
              r="1"
              gradientUnits="userSpaceOnUse"
              gradientTransform="translate(8.00025 8.01489) scale(7.39644 14.8995)"
            >
              <stop stopColor="#263238" stopOpacity="0.2" />
              <stop offset="1" stopColor="#263238" stopOpacity="0.01" />
            </radialGradient>
          </defs>
        </svg>
      </Fragment>
    ),
  },
};

export const WPositions = {
  args: {
    left: 'left',
    title: 'title',
    center: 'center',
    right: 'right',
  },
};

export const WPositionsActive = {
  args: {
    active: true,
    left: 'left',
    title: 'title',
    center: 'center',
    right: 'right',
  },
};
export const WPositionsDisabled = {
  args: {
    disabled: true,
    left: 'left',
    title: 'title',
    center: 'center',
    right: 'right',
  },
};
