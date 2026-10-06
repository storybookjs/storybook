import React from 'react';
import { ProfileCard } from './ProfileCard';

export default {
  component: ProfileCard,
  title: 'React/NamedTypeInterface',
};

export const Primary = () => <ProfileCard user={{ name: 'Ada', age: 36 }} />;
