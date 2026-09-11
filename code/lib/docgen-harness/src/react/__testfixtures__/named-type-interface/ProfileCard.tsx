import React from 'react';
import { User } from './user';

export const ProfileCard = ({ user }: { user: User }) => <div>{user.name}</div>;
