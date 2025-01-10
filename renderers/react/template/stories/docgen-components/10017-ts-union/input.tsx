import React from 'react';

interface AvatarProps {
  /** Specify icon="search" or icon={IconComponent} */
  icon: React.ReactNode | string;
}

const Avatar = ({ icon }: AvatarProps) => {
  return <div className="hello">Hello Component {icon}</div>;
};

export const component = Avatar;
